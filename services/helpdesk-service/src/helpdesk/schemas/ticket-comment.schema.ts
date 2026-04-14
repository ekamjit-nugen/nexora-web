import { Schema, Document } from 'mongoose';

export interface ITicketComment extends Document {
  organizationId: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternal: boolean;
  attachments: Array<{ name: string; url: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export const TicketCommentSchema = new Schema<ITicketComment>(
  {
    organizationId: { type: String, required: true },
    ticketId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    authorName: { type: String, default: '' },
    content: { type: String, required: true },
    isInternal: { type: Boolean, default: false },
    attachments: [{ name: String, url: String }],
  },
  { timestamps: true },
);

TicketCommentSchema.index({ ticketId: 1, createdAt: 1 });
