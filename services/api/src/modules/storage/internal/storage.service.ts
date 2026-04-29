import {
  ForbiddenException, Injectable, Logger, NotFoundException,
  PayloadTooLargeException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { IStorageFile } from './schemas/storage-file.schema';
import { S3Service } from '../../../bootstrap/s3/s3.service';
import { STORAGE_DB, AUTH_DB } from '../../../bootstrap/database/database.tokens';

/**
 * Tenant cloud storage service.
 *
 * Per-org features:
 *   - Files live at s3-nexora/orgs/<orgId>/storage/<uuid>-<safeName>
 *   - Quota lives on the Organization doc (auth DB):
 *       organization.storage = { quotaGb: 10, usedBytes: <number> }
 *     Default 10GB for new orgs (set in this service when first
 *     used). Nugen specifically gets 10GB explicitly via the
 *     init script.
 *
 * Tenant isolation:
 *   - Every method takes organizationId; every Mongo query filters by it
 *   - S3Service builds keys from orgId, so a wrong/stolen storageKey
 *     cannot escape the tenant prefix
 *   - usedBytes is recomputed (not just incremented) periodically to
 *     self-heal from any accounting drift
 */

const DEFAULT_QUOTA_GB = 10;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per file

@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);

  constructor(
    @InjectModel('StorageFile', STORAGE_DB) private readonly fileModel: Model<IStorageFile>,
    // Reach into auth DB for the Organization doc — same Mongo cluster,
    // different db, accessed via the connection mongoose already holds.
    @InjectModel('Organization', AUTH_DB) private readonly orgModel: Model<any>,
    private readonly s3: S3Service,
  ) {}

  // ─── Quota ──────────────────────────────────────────────────────

  async getQuota(organizationId: string): Promise<{
    quotaGb: number;
    quotaBytes: number;
    usedBytes: number;
    usedPercent: number;
    fileCount: number;
  }> {
    const org: any = await this.orgModel.findById(organizationId).lean();
    if (!org) throw new NotFoundException('Organization not found');
    const quotaGb = org?.storage?.quotaGb ?? DEFAULT_QUOTA_GB;
    const quotaBytes = quotaGb * 1024 * 1024 * 1024;
    // Trust the live agg over the cached counter; cheaper than walking S3.
    const agg = await this.fileModel.aggregate([
      { $match: { organizationId, isDeleted: false } },
      { $group: { _id: null, sum: { $sum: '$sizeBytes' }, count: { $sum: 1 } } },
    ]);
    const usedBytes = agg[0]?.sum || 0;
    const fileCount = agg[0]?.count || 0;
    return {
      quotaGb,
      quotaBytes,
      usedBytes,
      usedPercent: quotaBytes ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0,
      fileCount,
    };
  }

  async setQuotaGb(organizationId: string, quotaGb: number): Promise<void> {
    if (quotaGb < 0 || quotaGb > 10_000) {
      throw new BadRequestException('quotaGb out of range');
    }
    await this.orgModel.updateOne(
      { _id: organizationId },
      { $set: { 'storage.quotaGb': quotaGb } },
    );
  }

  // ─── Upload (server-side passthrough) ────────────────────────────

  async uploadFile(opts: {
    organizationId: string;
    userId: string;
    userDisplayName?: string;
    name: string;
    folderPath?: string;
    contentType?: string;
    body: Buffer;
    tags?: string[];
  }): Promise<IStorageFile> {
    if (opts.body.length === 0) {
      throw new BadRequestException('Empty file');
    }
    if (opts.body.length > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds per-file limit of ${MAX_FILE_BYTES} bytes`,
      );
    }
    const quota = await this.getQuota(opts.organizationId);
    if (quota.usedBytes + opts.body.length > quota.quotaBytes) {
      throw new ForbiddenException(
        `Quota exceeded — ${quota.quotaGb} GB total, ` +
          `${(quota.usedBytes / 1024 / 1024 / 1024).toFixed(2)} GB used.`,
      );
    }

    const safeName = opts.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const folderPath = (opts.folderPath || '/').replace(/[^a-zA-Z0-9./_-]/g, '_');
    const storageKey = `storage/${randomUUID()}-${safeName}`;

    await this.s3.uploadObject({
      orgId: opts.organizationId,
      key: storageKey,
      body: opts.body,
      contentType: opts.contentType,
      metadata: { uploadedby: opts.userId },
    });

    const created = await this.fileModel.create({
      organizationId: opts.organizationId,
      name: opts.name,
      sizeBytes: opts.body.length,
      contentType: opts.contentType || 'application/octet-stream',
      storageKey,
      uploadedBy: opts.userId,
      uploadedByName: opts.userDisplayName,
      folderPath,
      tags: opts.tags || [],
      isDeleted: false,
    });
    return created;
  }

  // ─── Pre-signed direct upload (recommended for large files) ──────

  async getPresignedUpload(opts: {
    organizationId: string;
    userId: string;
    userDisplayName?: string;
    name: string;
    sizeBytes: number;
    contentType?: string;
    folderPath?: string;
    tags?: string[];
  }): Promise<{ uploadUrl: string; fileId: string }> {
    if (opts.sizeBytes <= 0 || opts.sizeBytes > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException('File size out of range');
    }
    const quota = await this.getQuota(opts.organizationId);
    if (quota.usedBytes + opts.sizeBytes > quota.quotaBytes) {
      throw new ForbiddenException('Quota would be exceeded');
    }
    const safeName = opts.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const folderPath = (opts.folderPath || '/').replace(/[^a-zA-Z0-9./_-]/g, '_');
    const storageKey = `storage/${randomUUID()}-${safeName}`;

    const { url } = await this.s3.getUploadUrl({
      orgId: opts.organizationId,
      key: storageKey,
      contentType: opts.contentType,
    });

    // Pre-create the row at sizeBytes the user CLAIMED. After the
    // browser PUTs the object, it should call POST /storage/files/:id/finalize
    // which we re-stat from S3.head to get the truth and adjust.
    const row = await this.fileModel.create({
      organizationId: opts.organizationId,
      name: opts.name,
      sizeBytes: opts.sizeBytes,
      contentType: opts.contentType || 'application/octet-stream',
      storageKey,
      uploadedBy: opts.userId,
      uploadedByName: opts.userDisplayName,
      folderPath,
      tags: opts.tags || [],
      isDeleted: false,
    });

    return { uploadUrl: url, fileId: String(row._id) };
  }

  /** Re-stat from S3 after a direct upload. Adjusts size if user lied. */
  async finalizeUpload(organizationId: string, fileId: string): Promise<IStorageFile> {
    const file = await this.fileModel.findOne({
      _id: fileId, organizationId, isDeleted: false,
    });
    if (!file) throw new NotFoundException('File not found');
    const head = await this.s3.headObject(organizationId, file.storageKey);
    if (!head) {
      // Upload didn't happen — clean up the placeholder row.
      await this.fileModel.deleteOne({ _id: fileId });
      throw new BadRequestException('Upload did not complete');
    }
    file.sizeBytes = head.contentLength || file.sizeBytes;
    if (head.contentType) file.contentType = head.contentType;
    await file.save();
    return file;
  }

  // ─── List / get / download / delete ──────────────────────────────

  async listFiles(
    organizationId: string,
    folderPath = '/',
    page = 1,
    limit = 50,
  ): Promise<{ data: IStorageFile[]; total: number }> {
    const filter: any = { organizationId, isDeleted: false };
    if (folderPath) filter.folderPath = folderPath;
    const [data, total] = await Promise.all([
      this.fileModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(Math.min(limit, 200))
        .lean(),
      this.fileModel.countDocuments(filter),
    ]);
    return { data, total };
  }

  async getDownloadUrl(organizationId: string, fileId: string): Promise<{
    url: string;
    name: string;
    contentType: string;
  }> {
    const f = await this.fileModel
      .findOne({ _id: fileId, organizationId, isDeleted: false })
      .lean();
    if (!f) throw new NotFoundException('File not found');
    const url = await this.s3.getDownloadUrl(organizationId, f.storageKey);
    return { url, name: f.name, contentType: f.contentType };
  }

  async deleteFile(organizationId: string, fileId: string): Promise<void> {
    const f = await this.fileModel.findOne({
      _id: fileId, organizationId, isDeleted: false,
    });
    if (!f) throw new NotFoundException('File not found');
    // Soft-delete the row, hard-delete the S3 object — the bytes are
    // gone, the metadata sticks around for audit.
    f.isDeleted = true;
    await f.save();
    try {
      await this.s3.deleteObject(organizationId, f.storageKey);
    } catch (err: any) {
      this.log.warn(`S3 delete failed for ${f.storageKey}: ${err.message}`);
      // Don't throw — the user asked to delete; row is gone from
      // their view. Background cleanup can retry the S3 op later.
    }
  }
}
