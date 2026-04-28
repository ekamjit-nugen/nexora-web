/**
 * @deprecated since #10 (policy consolidation). policy-service is now
 * the source of truth for shift / working-hours / leave / wfh rules.
 * `attendance.service.ts::resolveShiftPolicy` reads from policy-service
 * first and falls back to this collection only when:
 *   (a) policy-service is unreachable, or
 *   (b) the tenant hasn't migrated their shift config yet.
 *
 * The `checkPolicyCompliance` alert generator still reads from here —
 * consolidating that is a follow-up. Keep this schema + collection
 * around for backward compatibility; do NOT delete before a migration
 * plan is in place. New working-hours policies should be created in
 * policy-service with category `working_hours` or `attendance`.
 */
import { Schema, Document } from 'mongoose';

export interface IPolicyCondition {
  name: string;
  value: string;
  description?: string;
}

export interface ILeaveTypeConfig {
  type: string;
  label: string;
  annualAllocation: number;
  accrualFrequency: string;
  accrualAmount: number;
  maxCarryForward: number;
  encashable: boolean;
  maxConsecutiveDays: number;
  requiresDocument: boolean;
  applicableTo: string;
  minServiceMonths: number;
}

export interface ILeavePolicy {
  leaveTypes: ILeaveTypeConfig[];
  yearStart: string;
  probationLeaveAllowed: boolean;
  halfDayAllowed: boolean;
  backDatedLeaveMaxDays: number;
}

export interface IPolicy extends Document {
  organizationId?: string;
  policyName: string;
  description?: string;
  type: string;
  category: string;
  content?: string;
  workTiming: {
    startTime: string;
    endTime: string;
    timezone: string;
    graceMinutes: number;
    minWorkingHours: number;
    breakMinutes: number;
    // Shift-aware status thresholds. Populated by admin via the
    // attendance-policy editor; consumed on clock-in/out to resolve
    // `late` / `half_day` / `present`. Null falls back to sensible
    // defaults (30 min late → half-day, 4 h worked → half-day).
    lateToHalfDayMinutes?: number;
    minHoursForPresent?: number;
    // Night-shift flag. When true, `startTime` > `endTime` means the
    // window straddles midnight (e.g. 22:00 → 06:00). Payroll-service
    // reads this from the attendance record to apply the night OT
    // multiplier for hours worked on the shift.
    isNightShift?: boolean;
  };
  wfhPolicy: {
    maxDaysPerMonth: number;
    requiresApproval: boolean;
    allowedDays: string[];
  };
  leavePolicy?: ILeavePolicy;
  maxWorkingHoursPerWeek: number;
  conditions: IPolicyCondition[];
  applicableTo: string;
  applicableIds: string[];
  isTemplate: boolean;
  templateName?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  reviewDate?: Date;
  version: number;
  acknowledgementRequired: boolean;
  alerts: {
    lateArrival: boolean;
    earlyDeparture: boolean;
    missedClockIn: boolean;
    overtimeAlert: boolean;
  };
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const POLICY_CATEGORIES = [
  'work_policy',
  'leave_policy',
  'attendance_policy',
  'remote_work',
  'compensation',
  'travel_expense',
  'it_security',
  'code_of_conduct',
  'performance',
  'onboarding',
  'training',
  'communication',
  'health_safety',
  'data_privacy',
  'exit_policy',
] as const;

export type PolicyCategory = typeof POLICY_CATEGORIES[number];

export const PolicySchema = new Schema<IPolicy>(
  {
    organizationId: { type: String, default: null, index: true },
    policyName: { type: String, required: true },
    description: { type: String, default: null },
    type: {
      type: String,
      enum: ['work_timing', 'leave', 'wfh', 'expense', 'travel', 'security', 'code_of_conduct', 'communication', 'equipment', 'general', 'timesheet'],
      default: 'general',
    },
    category: {
      type: String,
      enum: POLICY_CATEGORIES,
      default: 'work_policy',
    },
    content: { type: String, default: null },
    workTiming: {
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      graceMinutes: { type: Number, default: 15 },
      minWorkingHours: { type: Number, default: 8 },
      breakMinutes: { type: Number, default: 60 },
      lateToHalfDayMinutes: { type: Number, default: null },
      minHoursForPresent: { type: Number, default: null },
      isNightShift: { type: Boolean, default: false },
    },
    wfhPolicy: {
      maxDaysPerMonth: { type: Number, default: 0 },
      requiresApproval: { type: Boolean, default: true },
      allowedDays: [{ type: String }],
    },
    leavePolicy: {
      type: {
        leaveTypes: [{
          type: { type: String, required: true },
          label: { type: String, required: true },
          annualAllocation: { type: Number, default: 0 },
          accrualFrequency: { type: String, enum: ['monthly', 'quarterly', 'annual', 'on_request'], default: 'monthly' },
          accrualAmount: { type: Number, default: 0 },
          maxCarryForward: { type: Number, default: 0 },
          encashable: { type: Boolean, default: false },
          maxConsecutiveDays: { type: Number, default: 0 },
          requiresDocument: { type: Boolean, default: false },
          applicableTo: { type: String, enum: ['all', 'male', 'female'], default: 'all' },
          minServiceMonths: { type: Number, default: 0 },
        }],
        yearStart: { type: String, enum: ['january', 'april'], default: 'january' },
        probationLeaveAllowed: { type: Boolean, default: false },
        halfDayAllowed: { type: Boolean, default: true },
        backDatedLeaveMaxDays: { type: Number, default: 7 },
      },
      required: false,
      default: undefined,
    },
    maxWorkingHoursPerWeek: { type: Number, default: 40 },
    conditions: [{
      name: { type: String, required: true },
      value: { type: String, required: true },
      description: { type: String, default: null },
    }],
    applicableTo: {
      type: String,
      enum: ['all', 'department', 'designation', 'specific'],
      default: 'all',
    },
    applicableIds: [{ type: String }],
    isTemplate: { type: Boolean, default: false },
    templateName: { type: String, default: null },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    reviewDate: { type: Date, default: null },
    version: { type: Number, default: 1 },
    acknowledgementRequired: { type: Boolean, default: false },
    alerts: {
      lateArrival: { type: Boolean, default: true },
      earlyDeparture: { type: Boolean, default: true },
      missedClockIn: { type: Boolean, default: true },
      overtimeAlert: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

PolicySchema.index({ isDeleted: 1, isActive: 1 });
PolicySchema.index({ isTemplate: 1 });
PolicySchema.index({ type: 1 });
PolicySchema.index({ applicableTo: 1 });
PolicySchema.index({ category: 1 });
