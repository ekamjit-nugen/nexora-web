import { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  organizationId?: string;
  name: string;
  code: string;
  description?: string;
  headId?: string;
  parentDepartmentId?: string;
  costCenter?: string;
  budget?: {
    amount: number;
    currency: string;
    period: string;
  };
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DepartmentSchema = new Schema<IDepartment>(
  {
    organizationId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: null },
    headId: { type: String, default: null },
    parentDepartmentId: { type: String, default: null },
    costCenter: { type: String, default: null },
    budget: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      period: { type: String, enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' },
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

DepartmentSchema.index({ code: 1 });
DepartmentSchema.index({ isDeleted: 1, isActive: 1 });
