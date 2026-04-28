import { Schema, Document } from 'mongoose';

export interface ILeave extends Document {
  organizationId?: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  halfDay?: {
    enabled: boolean;
    date: Date;
    half: string;
  };
  reason: string;
  status: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  cancellation?: {
    cancelledAt: Date;
    cancelledBy: string;
    reason: string;
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const LeaveSchema = new Schema<ILeave>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    leaveType: {
      type: String,
      required: true,
      enum: ['casual', 'sick', 'earned', 'wfh', 'maternity', 'paternity', 'bereavement', 'comp_off', 'lop'],
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    halfDay: {
      enabled: { type: Boolean, default: false },
      date: { type: Date, default: null },
      half: { type: String, enum: ['first_half', 'second_half', null], default: null },
    },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    cancellation: {
      cancelledAt: { type: Date, default: null },
      cancelledBy: { type: String, default: null },
      reason: { type: String, default: null },
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

LeaveSchema.index({ employeeId: 1, status: 1 });
LeaveSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });
LeaveSchema.index({ status: 1, createdAt: -1 });
LeaveSchema.index({ isDeleted: 1 });
