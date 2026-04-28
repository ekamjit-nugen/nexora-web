import { Schema, Document } from 'mongoose';

export interface IFlaggedMessage extends Document {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
  reason: string;
  severity: string;
  status: string;
  reviewedBy: string;
  reviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const FlaggedMessageSchema = new Schema<IFlaggedMessage>(
  {
    messageId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, default: null },
    content: { type: String, required: true },
    reason: { type: String, required: true },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'dismissed', 'actioned'],
      default: 'pending',
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

FlaggedMessageSchema.index({ status: 1, createdAt: -1 });
