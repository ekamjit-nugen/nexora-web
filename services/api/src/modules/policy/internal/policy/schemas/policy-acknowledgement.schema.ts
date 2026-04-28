import { Schema, Document } from 'mongoose';

export interface IPolicyAcknowledgement extends Document {
  policyId: string;
  employeeId: string;
  acknowledgedAt: Date;
  version: number;
}

export const PolicyAcknowledgementSchema = new Schema(
  {
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', required: true },
    employeeId: { type: String, required: true },
    acknowledgedAt: { type: Date, default: Date.now },
    version: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
);

PolicyAcknowledgementSchema.index({ policyId: 1, employeeId: 1 });
PolicyAcknowledgementSchema.index({ employeeId: 1 });
