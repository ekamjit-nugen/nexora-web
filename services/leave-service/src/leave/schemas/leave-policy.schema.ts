import { Schema, Document } from 'mongoose';

export interface ILeaveTypeConfig {
  type: string;
  annualAllocation: number;
  accrualFrequency: string;
  maxCarryForward: number;
  encashable: boolean;
  maxConsecutiveDays: number;
}

export interface IBlackoutPeriod {
  startDate: Date;
  endDate: Date;
  reason: string;
}

export interface ILeavePolicy extends Document {
  organizationId?: string;
  policyName: string;
  status: string;
  leaveTypes: ILeaveTypeConfig[];
  blackoutPeriods: IBlackoutPeriod[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const LeavePolicySchema = new Schema<ILeavePolicy>(
  {
    organizationId: { type: String, default: null, index: true },
    policyName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
    },
    leaveTypes: [
      {
        type: {
          type: String,
          required: true,
          enum: ['casual', 'sick', 'earned', 'wfh', 'maternity', 'paternity', 'bereavement', 'comp_off', 'lop'],
        },
        annualAllocation: { type: Number, required: true, min: 0 },
        accrualFrequency: {
          type: String,
          enum: ['monthly', 'quarterly', 'annual', 'on_request'],
          default: 'monthly',
        },
        maxCarryForward: { type: Number, default: 0 },
        encashable: { type: Boolean, default: false },
        maxConsecutiveDays: { type: Number, default: 0 },
      },
    ],
    blackoutPeriods: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        reason: { type: String, required: true },
      },
    ],
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

LeavePolicySchema.index({ status: 1 });
LeavePolicySchema.index({ policyName: 1 });
