import { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  organizationId?: string;
  employeeId: string;
  policyId?: string;
  alertType: string;
  message: string;
  date: Date;
  severity: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const AlertSchema = new Schema<IAlert>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    policyId: { type: String, default: null },
    alertType: {
      type: String,
      enum: ['late_arrival', 'early_departure', 'missed_clock_in', 'overtime', 'policy_breach'],
      required: true,
    },
    message: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
    },
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AlertSchema.index({ employeeId: 1, date: 1 });
AlertSchema.index({ acknowledged: 1 });
AlertSchema.index({ alertType: 1 });
