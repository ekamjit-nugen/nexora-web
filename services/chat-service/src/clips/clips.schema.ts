import { Schema, Document } from 'mongoose';

export interface IClip extends Document {
  conversationId: string;
  senderId: string;
  senderName: string;
  organizationId: string;
  mediaUrl: string;
  thumbnailUrl: string;
  duration: number;
  transcription: string;
  transcriptionStatus: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ClipSchema = new Schema<IClip>(
  {
    conversationId: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    organizationId: { type: String, required: true },
    mediaUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    duration: { type: Number, required: true },
    transcription: { type: String, default: '' },
    transcriptionStatus: {
      type: String,
      enum: ['pending', 'processing', 'complete', 'failed'],
      default: 'pending',
    },
    fileSize: { type: Number, default: null },
    mimeType: { type: String, default: null },
  },
  { timestamps: true },
);

ClipSchema.index({ conversationId: 1, createdAt: -1 });
ClipSchema.index({ organizationId: 1 });
