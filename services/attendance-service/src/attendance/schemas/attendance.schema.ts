import { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  organizationId?: string;
  employeeId: string;
  date: Date;
  checkInTime: Date;
  checkOutTime?: Date;
  checkInIP?: string;
  checkOutIP?: string;
  checkInMethod: string;
  checkOutMethod?: string;
  totalWorkingHours?: number;
  effectiveWorkingHours?: number;
  overtimeHours?: number;
  status: string;
  isLateArrival: boolean;
  lateByMinutes?: number;
  isEarlyDeparture: boolean;
  earlyByMinutes?: number;
  entryType: string;
  approvalStatus?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AttendanceSchema = new Schema<IAttendance>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, default: null },
    checkInIP: { type: String, default: null },
    checkOutIP: { type: String, default: null },
    checkInMethod: {
      type: String,
      enum: ['web', 'mobile', 'biometric', 'admin_force'],
      default: 'web',
    },
    checkOutMethod: {
      type: String,
      enum: ['web', 'mobile', 'biometric', 'admin_force', null],
      default: null,
    },
    totalWorkingHours: { type: Number, default: null },
    effectiveWorkingHours: { type: Number, default: null },
    overtimeHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['present', 'late', 'half_day', 'absent', 'holiday', 'leave', 'wfh', 'comp_off'],
      default: 'present',
    },
    isLateArrival: { type: Boolean, default: false },
    lateByMinutes: { type: Number, default: 0 },
    isEarlyDeparture: { type: Boolean, default: false },
    earlyByMinutes: { type: Number, default: 0 },
    entryType: {
      type: String,
      enum: ['system', 'manual', 'regularization', 'force'],
      default: 'system',
    },
    // Manual entry approval fields
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', null],
      default: null,
    },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

AttendanceSchema.index({ employeeId: 1, date: 1 });
AttendanceSchema.index({ isDeleted: 1, status: 1 });
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ entryType: 1, approvalStatus: 1 });
