import { Schema, Document } from 'mongoose';

export interface IApprovalDelegation extends Document {
  delegatorId: string;
  delegateId: string;
  organizationId: string;
  type: string;
  projectId?: string;
  reason: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  autoExpire: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ApprovalDelegationSchema = new Schema<IApprovalDelegation>(
  {
    delegatorId: { type: String, required: true, index: true },
    delegateId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['temporary', 'permanent', 'project_specific'],
      required: true,
    },
    projectId: { type: String, default: null },
    reason: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    autoExpire: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ApprovalDelegationSchema.index({ delegatorId: 1, organizationId: 1 });
ApprovalDelegationSchema.index({ delegateId: 1, organizationId: 1 });
ApprovalDelegationSchema.index({ isActive: 1, endDate: 1 });
