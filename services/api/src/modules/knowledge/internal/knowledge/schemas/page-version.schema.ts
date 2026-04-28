import { Schema, Document } from 'mongoose';

export interface IPageVersion extends Document {
  organizationId: string;
  pageId: string;
  version: number;
  title: string;
  content: string;
  contentPlainText: string;
  editedBy: string;
  changeSummary: string;
  createdAt: Date;
}

export const PageVersionSchema = new Schema<IPageVersion>(
  {
    organizationId: { type: String, required: true, index: true },
    pageId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    contentPlainText: { type: String, default: '' },
    editedBy: { type: String, default: null },
    changeSummary: { type: String, default: '' },
  },
  { timestamps: true },
);

PageVersionSchema.index({ pageId: 1, version: -1 });
