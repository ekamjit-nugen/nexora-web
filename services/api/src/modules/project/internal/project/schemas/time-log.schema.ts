import { Schema, Document, model } from 'mongoose';

export interface ITimeLog extends Document {
  projectId: string;
  taskId: string;
  userId: string;
  duration: number; // in minutes
  description?: string;
  date: Date;
  billable: boolean;
  rate?: number; // hourly rate
  createdAt: Date;
  updatedAt: Date;
}

export const TimeLogSchema = new Schema<ITimeLog>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1, // minimum 1 minute
    },
    description: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    billable: {
      type: Boolean,
      default: true,
    },
    rate: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true },
);

TimeLogSchema.index({ projectId: 1, date: 1 });
TimeLogSchema.index({ userId: 1, date: 1 });
TimeLogSchema.index({ taskId: 1 });

export const TimeLogModel = model<ITimeLog>('TimeLog', TimeLogSchema);
