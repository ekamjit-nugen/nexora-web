import { Schema, Document } from 'mongoose';

export interface IPolicyRule {
  key: string;
  operator: string;
  value: unknown;
  description?: string;
}

export interface IPolicy extends Document {
  organizationId?: string;
  policyName: string;
  description?: string;
  category: string;

  // Category-specific configs (only relevant one populated)
  workTiming?: { startTime?: string; endTime?: string; timezone?: string; graceMinutes?: number; minWorkingHours?: number; breakMinutes?: number };
  wfhConfig?: { maxDaysPerMonth?: number; requiresApproval?: boolean; allowedDays?: string[] };
  leaveConfig?: { leaveTypes?: Array<{ type: string; label?: string; annualAllocation: number; accrualFrequency?: string; maxCarryForward?: number; encashable?: boolean; maxConsecutiveDays?: number; requiresDocument?: boolean }>; yearStart?: string; halfDayAllowed?: boolean; backDatedLeaveMaxDays?: number };
  overtimeConfig?: { maxOvertimeHoursPerDay?: number; maxOvertimeHoursPerWeek?: number; requiresApproval?: boolean; multiplier?: number };
  shiftConfig?: { shifts?: Array<{ name: string; startTime: string; endTime: string; isNightShift?: boolean }> };
  expenseConfig?: { maxAmountPerTransaction?: number; requiresReceipt?: boolean; approvalThreshold?: number; allowedCategories?: string[] };
  travelConfig?: { perDiemAmount?: number; maxHotelRate?: number; requiresPreApproval?: boolean; advanceAllowed?: boolean };
  reimbursementConfig?: { maxClaimAmount?: number; submissionDeadlineDays?: number; requiresReceipts?: boolean };
  invoiceConfig?: { paymentTermDays?: number; lateFeePercentage?: number; currency?: string };
  exemptionConfig?: { exemptionType?: string; criteria?: string; autoApprove?: boolean };
  attendanceConfig?: { maxWorkingHoursPerWeek?: number; alerts?: { lateArrival?: boolean; earlyDeparture?: boolean; missedClockIn?: boolean; overtimeAlert?: boolean } };

  // Dynamic rules
  rules: IPolicyRule[];

  // Applicability
  applicableTo: string;
  applicableIds: string[];

  // Template
  isTemplate: boolean;
  templateName?: string;
  sourceTemplateId?: string;

  // Versioning
  version: number;
  previousVersionId?: string;
  isLatestVersion: boolean;
  changeLog?: string;

  // Lifecycle
  effectiveFrom?: Date;
  effectiveTo?: Date;
  reviewDate?: Date;
  acknowledgementRequired: boolean;
  isActive: boolean;
  isDeleted: boolean;

  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-schemas ──

const PolicyRuleSchema = new Schema(
  {
    key: { type: String, required: true },
    operator: {
      type: String,
      required: true,
      enum: ['equals', 'greater_than', 'less_than', 'contains', 'between', 'in'],
    },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String },
  },
  { _id: false },
);

const LeaveTypeSubSchema = new Schema(
  {
    type: { type: String, required: true },
    label: { type: String },
    annualAllocation: { type: Number, required: true },
    accrualFrequency: { type: String },
    maxCarryForward: { type: Number },
    encashable: { type: Boolean, default: false },
    maxConsecutiveDays: { type: Number },
    requiresDocument: { type: Boolean, default: false },
  },
  { _id: false },
);

const ShiftSubSchema = new Schema(
  {
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isNightShift: { type: Boolean, default: false },
  },
  { _id: false },
);

// ── Main Policy Schema ──

export const PolicySchema = new Schema(
  {
    organizationId: { type: String, index: true },
    policyName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['attendance', 'working_hours', 'leave', 'wfh', 'overtime', 'shift', 'invoices', 'expenses', 'exemptions', 'travel', 'reimbursement'],
    },

    // Category-specific configs
    workTiming: {
      startTime: { type: String },
      endTime: { type: String },
      timezone: { type: String },
      graceMinutes: { type: Number },
      minWorkingHours: { type: Number },
      breakMinutes: { type: Number },
    },
    wfhConfig: {
      maxDaysPerMonth: { type: Number },
      requiresApproval: { type: Boolean },
      allowedDays: [{ type: String }],
    },
    leaveConfig: {
      leaveTypes: [LeaveTypeSubSchema],
      yearStart: { type: String },
      halfDayAllowed: { type: Boolean },
      backDatedLeaveMaxDays: { type: Number },
    },
    overtimeConfig: {
      maxOvertimeHoursPerDay: { type: Number },
      maxOvertimeHoursPerWeek: { type: Number },
      requiresApproval: { type: Boolean },
      multiplier: { type: Number },
    },
    shiftConfig: {
      shifts: [ShiftSubSchema],
    },
    expenseConfig: {
      maxAmountPerTransaction: { type: Number },
      requiresReceipt: { type: Boolean },
      approvalThreshold: { type: Number },
      allowedCategories: [{ type: String }],
    },
    travelConfig: {
      perDiemAmount: { type: Number },
      maxHotelRate: { type: Number },
      requiresPreApproval: { type: Boolean },
      advanceAllowed: { type: Boolean },
    },
    reimbursementConfig: {
      maxClaimAmount: { type: Number },
      submissionDeadlineDays: { type: Number },
      requiresReceipts: { type: Boolean },
    },
    invoiceConfig: {
      paymentTermDays: { type: Number },
      lateFeePercentage: { type: Number },
      currency: { type: String },
    },
    exemptionConfig: {
      exemptionType: { type: String },
      criteria: { type: String },
      autoApprove: { type: Boolean },
    },
    attendanceConfig: {
      maxWorkingHoursPerWeek: { type: Number },
      alerts: {
        lateArrival: { type: Boolean },
        earlyDeparture: { type: Boolean },
        missedClockIn: { type: Boolean },
        overtimeAlert: { type: Boolean },
      },
    },

    // Dynamic rules
    rules: [PolicyRuleSchema],

    // Applicability
    applicableTo: {
      type: String,
      enum: ['all', 'department', 'designation', 'specific'],
      default: 'all',
    },
    applicableIds: [{ type: String }],

    // Template
    isTemplate: { type: Boolean, default: false },
    templateName: { type: String, trim: true },
    sourceTemplateId: { type: Schema.Types.ObjectId, ref: 'Policy' },

    // Versioning
    version: { type: Number, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, ref: 'Policy' },
    isLatestVersion: { type: Boolean, default: true },
    changeLog: { type: String },

    // Lifecycle
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    reviewDate: { type: Date },
    acknowledgementRequired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },

    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
  },
);

// Indexes
PolicySchema.index({ organizationId: 1, isDeleted: 1 });
PolicySchema.index({ category: 1 });
PolicySchema.index({ isTemplate: 1 });
PolicySchema.index({ isLatestVersion: 1 });
