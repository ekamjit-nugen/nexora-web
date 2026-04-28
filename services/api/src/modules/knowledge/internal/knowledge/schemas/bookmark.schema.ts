import { Schema, Document } from 'mongoose';

export interface IBookmark extends Document {
  organizationId: string;
  userId: string;
  pageId: string;
  spaceId: string;
  createdAt: Date;
}

export const BookmarkSchema = new Schema<IBookmark>(
  {
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    pageId: { type: String, required: true },
    spaceId: { type: String, required: true },
  },
  { timestamps: true },
);

BookmarkSchema.index({ userId: 1, pageId: 1 }, { unique: true });
BookmarkSchema.index({ userId: 1, organizationId: 1 });
