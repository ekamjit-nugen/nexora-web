import { Schema, Document } from 'mongoose';

export interface IBillingRate extends Document {
  organizationId?: string;
  projectId: string;
  type: string;
  role?: string;
  userId?: string;
  userName?: string;
  hourlyRate: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isDeleted: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const BillingRateSchema = new Schema<IBillingRate>(
  {
    organizationId: { type: String, default: null, index: true },
    projectId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['project_default', 'role_based', 'user_specific'],
      required: true,
    },
    role: { type: String, default: null },
    userId: { type: String, default: null },
    userName: { type: String, default: null },
    hourlyRate: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

BillingRateSchema.index({ projectId: 1, type: 1, isDeleted: 1 });
BillingRateSchema.index({ projectId: 1, userId: 1, isDeleted: 1 });
BillingRateSchema.index({ projectId: 1, role: 1, isDeleted: 1 });
