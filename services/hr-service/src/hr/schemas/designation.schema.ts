import { Schema, Document } from 'mongoose';

export interface IDesignation extends Document {
  organizationId?: string;
  title: string;
  level: number;
  track: string;
  departmentId?: string;
  salaryBand?: {
    min: number;
    max: number;
    currency: string;
  };
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DesignationSchema = new Schema<IDesignation>(
  {
    organizationId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    level: { type: Number, required: true, min: 1, max: 10 },
    track: {
      type: String,
      enum: ['individual_contributor', 'management'],
      default: 'individual_contributor',
    },
    departmentId: { type: String, default: null },
    salaryBand: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

DesignationSchema.index({ title: 1, level: 1 });
