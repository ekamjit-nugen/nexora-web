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
