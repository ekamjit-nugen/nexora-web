import { Schema, Document } from 'mongoose';

/**
 * Tenant cloud storage — file metadata.
 *
 * The actual file bytes live in S3 at `s3-nexora/orgs/<orgId>/storage/<key>`.
 * This row is the index Mongo holds for listing, search, quota math.
 *
 * Tenant isolation: every read/write filters by organizationId. The
 * S3 key always starts with the org's prefix (S3Service enforces),
 * so even a stale row referencing a wrong key cannot read another
 * tenant's bytes.
 */

export interface IStorageFile extends Document {
  organizationId: string;
  /** Path-like name shown in the UI, e.g. "invoices/2026/march.pdf". */
  name: string;
  /** Size in bytes. Trusted from S3.head after upload, NOT from client. */
  sizeBytes: number;
  contentType: string;
  /** Relative key within the tenant prefix (S3Service prepends orgs/<orgId>/). */
  storageKey: string;
  /** Auth user id who uploaded. */
  uploadedBy: string;
  uploadedByName?: string;
  /** Optional folder path (for UI organization). Defaults to root "/". */
  folderPath: string;
  /** Tag set so users can search / filter (free-form). */
  tags: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const StorageFileSchema = new Schema<IStorageFile>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
    storageKey: { type: String, required: true, unique: true },
    uploadedBy: { type: String, required: true, index: true },
    uploadedByName: String,
    folderPath: { type: String, default: '/', index: true },
    tags: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Hot path: list a folder for an org, sorted by recency.
StorageFileSchema.index({ organizationId: 1, folderPath: 1, updatedAt: -1 });
// Quota math: sum sizeBytes for an org.
StorageFileSchema.index({ organizationId: 1, isDeleted: 1 });
