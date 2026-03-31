import { Schema, Document } from 'mongoose';

export interface IVersionSnapshot {
  versionId: string;
  timestamp: Date;
  productId: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'merge' | 'restore';
  changes: Record<string, any>;
  changesSummary: string;
  previousVersion?: string;
  metadata: Record<string, any>;
}

export interface IProductVersion extends Document {
  productId: string;
  versionId: string;
  versionNumber: number;
  snapshotData: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  changedAt: Date;
  action: string;
  changeDescription: string;
  isPublished: boolean;
  tags: string[];
}

export interface IVersionHistory extends Document {
  productId: string;
  totalVersions: number;
  currentVersion: string;
  snapshots: IVersionSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

export const VersionSnapshotSchema = new Schema({
  versionId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  productId: { type: String, required: true },
  userId: { type: String, required: true },
  action: { type: String, enum: ['create', 'update', 'delete', 'merge', 'restore'], required: true },
  changes: Schema.Types.Mixed,
  changesSummary: String,
  previousVersion: String,
  metadata: Schema.Types.Mixed,
});

export const ProductVersionSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    versionId: { type: String, required: true, unique: true, index: true },
    versionNumber: { type: Number, required: true },
    snapshotData: Schema.Types.Mixed,
    createdBy: { type: String, required: true },
    changedAt: Date,
    action: { type: String, required: true },
    changeDescription: String,
    isPublished: { type: Boolean, default: false },
    tags: [String],
  },
  { timestamps: true },
);

export const VersionHistorySchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    totalVersions: { type: Number, default: 0 },
    currentVersion: String,
    snapshots: [VersionSnapshotSchema],
  },
  { timestamps: true },
);

ProductVersionSchema.index({ productId: 1, versionNumber: -1 });
ProductVersionSchema.index({ productId: 1, createdAt: -1 });
VersionHistorySchema.index({ productId: 1 });
