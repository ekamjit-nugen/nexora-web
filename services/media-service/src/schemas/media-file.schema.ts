import { Schema, Document } from 'mongoose';

export interface IMediaFile extends Document {
  organizationId: string;
  uploadedBy: string;
  conversationId?: string;
  messageId?: string;

  // Original file
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageUrl?: string;

  // Processing results
  processing: {
    status: string;
    error?: string;
    thumbnail?: { storageKey: string; width?: number; height?: number };
    preview?: { storageKey: string; pages?: number };
    metadata?: {
      width?: number;
      height?: number;
      duration?: number;
      codec?: string;
      pageCount?: number;
    };
  };

  // Access control
  accessLevel: string;
  expiresAt?: Date;

  // Virus scan
  scanStatus: string;
  scanResult?: string;

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const MediaFileSchema = new Schema<IMediaFile>(
  {
    organizationId: { type: String, required: true, index: true },
    uploadedBy: { type: String, required: true, index: true },
    conversationId: { type: String, default: null, index: true },
    messageId: { type: String, default: null, index: true },

    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    storageUrl: { type: String, default: null },

    processing: {
      status: { type: String, enum: ['pending', 'processing', 'complete', 'failed'], default: 'pending' },
      error: { type: String, default: null },
      thumbnail: {
        storageKey: { type: String, default: null },
        width: { type: Number, default: null },
        height: { type: Number, default: null },
      },
      preview: {
        storageKey: { type: String, default: null },
        pages: { type: Number, default: null },
      },
      metadata: {
        width: { type: Number, default: null },
        height: { type: Number, default: null },
        duration: { type: Number, default: null },
        codec: { type: String, default: null },
        pageCount: { type: Number, default: null },
      },
    },

    accessLevel: { type: String, enum: ['conversation', 'org', 'public'], default: 'conversation' },
    expiresAt: { type: Date, default: null },

    scanStatus: { type: String, enum: ['pending', 'not_scanned', 'clean', 'infected', 'error'], default: 'pending' },
    scanResult: { type: String, default: null },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

MediaFileSchema.index({ organizationId: 1, createdAt: -1 });
MediaFileSchema.index({ conversationId: 1, createdAt: -1 });
MediaFileSchema.index({ uploadedBy: 1, createdAt: -1 });
MediaFileSchema.index({ mimeType: 1 });
