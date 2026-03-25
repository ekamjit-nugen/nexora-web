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

export interface ITimesheet extends Document {
  organizationId?: string;
  employeeId: string;
  period: string;
  startDate: Date;
  endDate: Date;
  entries: ITimesheetEntry[];
  totalHours: number;
  expectedHours: number;
  status: string;
  submittedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComment?: string;
  isDeleted: boolean;
  createdBy: string;
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

export const TimesheetSchema = new Schema<ITimesheet>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    period: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly'],
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
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
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

TimesheetSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });
TimesheetSchema.index({ status: 1 });
TimesheetSchema.index({ isDeleted: 1 });
