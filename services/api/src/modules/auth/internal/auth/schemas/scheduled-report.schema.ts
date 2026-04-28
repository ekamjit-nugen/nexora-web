import { Schema, Document, Types } from 'mongoose';

export interface IScheduledReport extends Document {
  templateId: Types.ObjectId;
  recipients: string[];
  schedule: 'daily' | 'weekly' | 'monthly';
  nextRun: Date;
  lastRun?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ScheduledReportSchema = new Schema<IScheduledReport>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'ReportTemplate',
      required: true,
    },
    recipients: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one recipient is required',
      },
    },
    schedule: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    nextRun: {
      type: Date,
      required: true,
    },
    lastRun: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);
