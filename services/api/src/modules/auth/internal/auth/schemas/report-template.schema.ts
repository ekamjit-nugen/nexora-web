import { Schema, Document } from 'mongoose';

export interface IReportTemplate extends Document {
  name: string;
  description: string;
  type: 'organizations' | 'users' | 'analytics' | 'audit-logs';
  format: 'pdf' | 'excel' | 'csv';
  filters: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ReportTemplateSchema = new Schema<IReportTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['organizations', 'users', 'analytics', 'audit-logs'],
      required: true,
    },
    format: {
      type: String,
      enum: ['pdf', 'excel', 'csv'],
      required: true,
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);
