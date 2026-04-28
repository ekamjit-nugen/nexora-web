import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Shared S3 upload helper for the processing pipeline.
 * Reuses the same S3 configuration as the upload service.
 */
@Injectable()
export class S3UploadHelper {
  private readonly logger = new Logger(S3UploadHelper.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor() {
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    const bucket = process.env.S3_BUCKET;
    const endpoint = process.env.S3_ENDPOINT;

    if (!accessKey) throw new Error('S3_ACCESS_KEY not configured');
    if (!secretKey) throw new Error('S3_SECRET_KEY not configured');
    if (!bucket) throw new Error('S3_BUCKET not configured');
    if (!endpoint) throw new Error('S3_ENDPOINT not configured');

    this.endpoint = endpoint;
    this.bucket = bucket;

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Upload a buffer to S3 and return the full storage URL.
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `${this.endpoint}/${this.bucket}/${key}`;
    this.logger.debug(`Uploaded processed file: ${key}`);
    return url;
  }

  get bucketName(): string {
    return this.bucket;
  }

  get endpointUrl(): string {
    return this.endpoint;
  }
}
