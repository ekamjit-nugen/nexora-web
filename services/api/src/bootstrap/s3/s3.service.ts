import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Shared S3 client + helpers, available to ANY module via DI.
 *
 *   constructor(private readonly s3: S3Service) {}
 *
 *   await this.s3.uploadObject({
 *     orgId, key: 'storage/file.pdf', body: buffer, contentType: 'application/pdf',
 *   });
 *   await this.s3.getDownloadUrl(orgId, 'storage/file.pdf');
 *
 * Tenant safety: every method REQUIRES an `orgId` and prefixes the key
 * with `orgs/<orgId>/...`. Callers cannot accidentally read or write
 * outside their tenant's prefix because the helper builds the full
 * key from orgId + a relative path.
 *
 * Bucket: `S3_BUCKET` env (default `s3-nexora`). All modules share
 * the same bucket; tenants are isolated by key prefix.
 */
@Injectable()
export class S3Service {
  private readonly log = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicEndpoint: string | null;

  constructor(cfg: ConfigService) {
    const region = cfg.get<string>('AWS_REGION') || 'ap-south-1';
    const endpoint = cfg.get<string>('S3_ENDPOINT') || undefined;
    const accessKeyId = cfg.get<string>('S3_ACCESS_KEY') || '';
    const secretAccessKey = cfg.get<string>('S3_SECRET_KEY') || '';
    this.bucket = cfg.get<string>('S3_BUCKET') || 's3-nexora';
    this.publicEndpoint = cfg.get<string>('S3_PUBLIC_ENDPOINT') || null;

    this.client = new S3Client({
      region,
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: !endpoint.includes('amazonaws.com'),
          }
        : {}),
      credentials: { accessKeyId, secretAccessKey },
    });

    if (accessKeyId === 'placeholder' || !accessKeyId) {
      this.log.warn(
        'S3 credentials are placeholder/empty — uploads will fail at request time. ' +
          'Set S3_ACCESS_KEY / S3_SECRET_KEY in .env to enable.',
      );
    }
  }

  bucketName(): string {
    return this.bucket;
  }

  /** Build the canonical tenant-scoped key. ALL helpers funnel through this. */
  private tenantKey(orgId: string, relativeKey: string): string {
    if (!orgId) throw new Error('S3Service: orgId is required');
    const safe = relativeKey.replace(/^\/+/, '');
    return `orgs/${orgId}/${safe}`;
  }

  async uploadObject(opts: {
    orgId: string;
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; bucket: string }> {
    const fullKey = this.tenantKey(opts.orgId, opts.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        Body: opts.body as any,
        ContentType: opts.contentType,
        Metadata: opts.metadata,
      }),
    );
    return { key: fullKey, bucket: this.bucket };
  }

  async deleteObject(orgId: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.tenantKey(orgId, key),
      }),
    );
  }

  async headObject(orgId: string, key: string): Promise<{
    contentLength?: number;
    contentType?: string;
    lastModified?: Date;
  } | null> {
    try {
      const r = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.tenantKey(orgId, key),
        }),
      );
      return {
        contentLength: r.ContentLength,
        contentType: r.ContentType,
        lastModified: r.LastModified,
      };
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
        return null;
      }
      throw err;
    }
  }

  /** List object keys under a tenant-scoped prefix (relative to org root). */
  async listObjects(orgId: string, prefix = ''): Promise<
    Array<{ key: string; size: number; lastModified?: Date }>
  > {
    const fullPrefix = this.tenantKey(orgId, prefix);
    const out: Array<{ key: string; size: number; lastModified?: Date }> = [];
    let continuationToken: string | undefined;
    do {
      const r = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: fullPrefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const o of r.Contents || []) {
        if (o.Key) {
          out.push({
            key: o.Key.slice(`orgs/${orgId}/`.length),
            size: o.Size || 0,
            lastModified: o.LastModified,
          });
        }
      }
      continuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (continuationToken);
    return out;
  }

  /** Pre-signed PUT URL for direct browser → S3 uploads. Default TTL 5 min. */
  async getUploadUrl(opts: {
    orgId: string;
    key: string;
    contentType?: string;
    expiresIn?: number;
  }): Promise<{ url: string; key: string }> {
    const fullKey = this.tenantKey(opts.orgId, opts.key);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        ContentType: opts.contentType,
      }),
      { expiresIn: opts.expiresIn || 300 },
    );
    return { url, key: fullKey };
  }

  /** Pre-signed GET URL for downloads. Default TTL 5 min. */
  async getDownloadUrl(
    orgId: string,
    key: string,
    expiresIn = 300,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.tenantKey(orgId, key),
      }),
      { expiresIn },
    );
  }

  /**
   * Sum of object sizes under a tenant prefix — used by the storage
   * module's quota math. Walks the entire prefix; can be slow for
   * tenants with millions of objects (Nugen will not have this
   * problem for a long time).
   */
  async sumPrefixBytes(orgId: string, prefix = ''): Promise<number> {
    const objs = await this.listObjects(orgId, prefix);
    return objs.reduce((s, o) => s + o.size, 0);
  }
}
