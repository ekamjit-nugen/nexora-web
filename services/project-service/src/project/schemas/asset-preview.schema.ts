import { Schema, Document, model } from 'mongoose';

export interface IAssetPreview extends Document {
  projectId: string;
  taskId: string;
  uploadedBy: string;
  url: string;
  name: string;
  type: 'image' | 'video' | 'figma' | 'document' | 'other';
  size: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  duration?: number; // for videos, in seconds
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const AssetPreviewSchema = new Schema<IAssetPreview>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    uploadedBy: {
      type: String,
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image', 'video', 'figma', 'document', 'other'],
      required: true,
      index: true,
    },
    size: {
      type: Number,
      required: true, // in bytes
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    format: {
      type: String, // e.g., 'png', 'jpg', 'mp4'
      default: null,
    },
    duration: {
      type: Number,
      default: null, // in seconds for videos
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

AssetPreviewSchema.index({ projectId: 1, taskId: 1 });
AssetPreviewSchema.index({ uploadedBy: 1, createdAt: -1 });
AssetPreviewSchema.index({ taskId: 1, type: 1 });

export const AssetPreviewModel = model<IAssetPreview>(
  'AssetPreview',
  AssetPreviewSchema,
);
