import { Schema, Document } from 'mongoose';

export interface ITimesheetEntry {
  date: Date;
  taskId?: string;
  projectId?: string;
  projectName: string;
  taskTitle: string;
  hours: number;
  description: string;
  category: string;
}

export interface ITimesheetPeriod {
  startDate: Date;
  endDate: Date;
  type: string;
}

export interface ITimesheet extends Document {
  userId: string;
  organizationId?: string;
  period: ITimesheetPeriod;
  entries: ITimesheetEntry[];
  totalHours: number;
  expectedHours: number;
  status: string;
  submittedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComment?: string;
  approvedByDelegateId?: string;
  delegatorId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TimesheetEntrySchema = new Schema(
  {
    date: { type: Date, required: true },
    taskId: { type: String, default: null },
    projectId: { type: String, default: null },
    projectName: { type: String, default: '' },
    taskTitle: { type: String, default: '' },
    hours: { type: Number, required: true, min: 0, max: 24 },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['development', 'design', 'meeting', 'review', 'testing', 'documentation', 'admin', 'training', 'other'],
      default: 'other',
    },
  },
  { _id: false },
);

const TimesheetPeriodSchema = new Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly',
    },
  },
  { _id: false },
);

export const TimesheetSchema = new Schema<ITimesheet>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, default: null, index: true },
    period: { type: TimesheetPeriodSchema, required: true },
    entries: { type: [TimesheetEntrySchema], default: [] },
    totalHours: { type: Number, default: 0 },
    expectedHours: { type: Number, default: 40 },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected', 'revision_requested'],
      default: 'draft',
    },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: '' },
    approvedByDelegateId: { type: String, default: null },
    delegatorId: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

TimesheetSchema.index({ userId: 1, organizationId: 1, 'period.startDate': 1 }, { unique: true });
TimesheetSchema.index({ status: 1 });
TimesheetSchema.index({ organizationId: 1 });
TimesheetSchema.index({ isDeleted: 1 });
