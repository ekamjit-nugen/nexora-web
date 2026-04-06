import { Schema, Document } from 'mongoose';

export interface IReminder extends Document {
  userId: string;
  messageId: string;
  conversationId: string;
  reminderAt: Date;
  status: string;
  note?: string;
  createdAt: Date;
}

export const ReminderSchema = new Schema<IReminder>(
  {
    userId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    conversationId: { type: String, required: true },
    reminderAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['pending', 'sent', 'cancelled'], default: 'pending' },
    note: { type: String, default: null },
  },
  { timestamps: true },
);

ReminderSchema.index({ userId: 1, status: 1, reminderAt: 1 });
