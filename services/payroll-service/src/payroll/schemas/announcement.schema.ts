import { Schema, Document } from 'mongoose';

export interface IAnnouncementAttachment {
  name: string;
  url: string;
  type: string;
}

export interface IAnnouncementRead {
  userId: string;
  readAt: Date;
}

export interface IAnnouncementReaction {
  userId: string;
  emoji: string;
}

export interface IAnnouncement extends Document {
  organizationId: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  targetAudience: string;
  departments: string[];
  designations: string[];
  employeeIds: string[];
  publishedAt?: Date;
  expiresAt?: Date;
  isPinned: boolean;
  attachments: IAnnouncementAttachment[];
  readBy: IAnnouncementRead[];
  reactions: IAnnouncementReaction[];
  commentCount: number;
  status: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    organizationId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['general', 'policy', 'event', 'celebration', 'company_update', 'urgent'],
      default: 'general',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
    },
    targetAudience: {
      type: String,
      enum: ['all', 'department', 'designation', 'specific'],
      default: 'all',
    },
    departments: { type: [String], default: [] },
    designations: { type: [String], default: [] },
    employeeIds: { type: [String], default: [] },
    publishedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    isPinned: { type: Boolean, default: false },
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, required: true },
      },
    ],
    readBy: [
      {
        userId: { type: String, required: true },
        readAt: { type: Date, required: true },
      },
    ],
    reactions: [
      {
        userId: { type: String, required: true },
        emoji: { type: String, required: true },
      },
    ],
    commentCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived', 'scheduled'],
      default: 'draft',
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

AnnouncementSchema.index({ organizationId: 1, status: 1, publishedAt: -1 });
AnnouncementSchema.index({ organizationId: 1, isPinned: -1, publishedAt: -1 });
AnnouncementSchema.index({ isDeleted: 1 });
