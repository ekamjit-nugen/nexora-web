import { Schema, Document } from 'mongoose';

export interface IBookmark extends Document {
  userId: string;
  organizationId: string;
  messageId: string;
  conversationId: string;
  label?: string;
  note?: string;
  createdAt: Date;
}

export const BookmarkSchema = new Schema<IBookmark>(
  {
    userId: { type: String, required: true },
    organizationId: { type: String, default: null },
    messageId: { type: String, required: true },
    conversationId: { type: String, required: true },
    label: { type: String, default: null, trim: true },
    note: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

BookmarkSchema.index({ userId: 1, organizationId: 1, createdAt: -1 });
BookmarkSchema.index({ userId: 1, messageId: 1 }, { unique: true });
