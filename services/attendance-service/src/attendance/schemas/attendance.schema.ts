import { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  organizationId?: string;
  employeeId: string;
  date: Date;
  checkInTime: Date;
  checkOutTime?: Date;
  checkInIP?: string;
  checkOutIP?: string;
  // Geolocation captured from the browser at clock-in/out. Browsers only
  // hand out lat/lng if the user grants permission, so all four fields
  // are optional — a record without a location is still a valid record,
  // it just gets flagged in the UI as "no location" so admins can spot
  // employees who declined to share. `accuracy` is metres; values >100m
  // mean the browser fell back to IP/wifi geolocation rather than GPS.
  // `address` is a human-readable label (e.g. "Office HQ" or a reverse-
  // geocoded city). Stored opportunistically; not required for any
  // downstream calculation. See attendance.service.ts for capture logic.
  checkInLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  } | null;
  checkOutLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  } | null;
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
  // Captured at clock-in from the employee's shift policy so downstream
  // services (payroll OT engine, audit reports) don't have to re-resolve
  // the policy-at-time-of-work. When the policy says `isNightShift=true`,
  // OT worked that day gets the night-shift premium.
  isNightShift?: boolean;
  // ID of the policy used to classify this record. Stable audit breadcrumb
  // so "why was I marked late?" is answerable after policy edits.
  appliedShiftPolicyId?: string;
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
    checkInLocation: {
      type: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        accuracy: { type: Number, default: null },
        address: { type: String, default: null },
      },
      default: null,
    },
    checkOutLocation: {
      type: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        accuracy: { type: Number, default: null },
        address: { type: String, default: null },
      },
      default: null,
    },
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
    isNightShift: { type: Boolean, default: false },
    appliedShiftPolicyId: { type: String, default: null },
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
