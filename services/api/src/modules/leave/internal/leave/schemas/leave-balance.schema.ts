import { Schema, Document } from 'mongoose';

export interface ILeaveBalanceEntry {
  leaveType: string;
  opening: number;
  accrued: number;
  used: number;
  adjusted: number;
  carriedForward: number;
  available: number;
}

export interface ILeaveBalance extends Document {
  organizationId?: string;
  employeeId: string;
  year: number;
  balances: ILeaveBalanceEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export const LeaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    year: { type: Number, required: true },
    balances: [
      {
        leaveType: {
          type: String,
          required: true,
          enum: ['casual', 'sick', 'earned', 'wfh', 'maternity', 'paternity', 'bereavement', 'comp_off', 'lop'],
        },
        opening: { type: Number, default: 0 },
        accrued: { type: Number, default: 0 },
        used: { type: Number, default: 0 },
        adjusted: { type: Number, default: 0 },
        carriedForward: { type: Number, default: 0 },
        available: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);

LeaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });
