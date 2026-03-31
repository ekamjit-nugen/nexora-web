import { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  organizationId?: string;
  userId: string; // recipient
  taskId: string;
  projectId: string;
  type: 'mention' | 'assignment' | 'status_change' | 'comment' | 'due_date';
  actor: {
    userId: string;
    userName: string;
    userEmail: string;
  };
  title: string;
  message: string;
  taskKey?: string;
  read: boolean;
  readAt?: Date;
  actionUrl?: string;
  createdAt: Date;
}

export const NotificationSchema = new Schema<INotification>(
  {
    organizationId: { type: String, default: null, index: true },
    userId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['mention', 'assignment', 'status_change', 'comment', 'due_date'],
      required: true,
    },
    actor: {
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      userEmail: { type: String, required: true },
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    taskKey: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    actionUrl: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: false },
);

// Indexes for common queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
