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
  //
  // `workTiming` now carries the full shift contract. Attendance-service
  // uses it to resolve `late` / `half_day` / `present` on clock-in/out:
  //   - graceMinutes:       free window after startTime (was already there)
  //   - lateToHalfDayMinutes: late beyond this → status jumps to half_day
  //   - minHoursForPresent: worked < this → half_day regardless of late
  //   - isNightShift:       start > end implies straddles midnight; payroll
  //                         applies nightShiftMultiplier to OT on these shifts
  workTiming?: {
    startTime?: string;
    endTime?: string;
    timezone?: string;
    graceMinutes?: number;
    minWorkingHours?: number;
    breakMinutes?: number;
    lateToHalfDayMinutes?: number;
    minHoursForPresent?: number;
    isNightShift?: boolean;
  };
  wfhConfig?: { maxDaysPerMonth?: number; requiresApproval?: boolean; allowedDays?: string[] };
  // `leaveConfig` subsumes leave-service's legacy `LeavePolicy` — the
  // three fields it had that policy-service lacked (blackoutPeriods,
  // probation rules) now live here so the admin has a single config
  // surface. leave-service reads this via policy-client (#10).
  leaveConfig?: {
    leaveTypes?: Array<{
      type: string;
      label?: string;
      annualAllocation: number;
      accrualFrequency?: string;
      maxCarryForward?: number;
      encashable?: boolean;
      maxConsecutiveDays?: number;
      requiresDocument?: boolean;
      minServiceMonths?: number;
      applicableTo?: string; // 'all' | 'male' | 'female'
    }>;
    yearStart?: string;
    halfDayAllowed?: boolean;
    backDatedLeaveMaxDays?: number;
    probationLeaveAllowed?: boolean;
    blackoutPeriods?: Array<{ startDate: Date; endDate: Date; reason: string }>;
  };
  overtimeConfig?: { maxOvertimeHoursPerDay?: number; maxOvertimeHoursPerWeek?: number; requiresApproval?: boolean; multiplier?: number };
  shiftConfig?: { shifts?: Array<{ name: string; startTime: string; endTime: string; isNightShift?: boolean }> };
  expenseConfig?: { maxAmountPerTransaction?: number; requiresReceipt?: boolean; approvalThreshold?: number; allowedCategories?: string[] };
  travelConfig?: { perDiemAmount?: number; maxHotelRate?: number; requiresPreApproval?: boolean; advanceAllowed?: boolean };
  reimbursementConfig?: { maxClaimAmount?: number; submissionDeadlineDays?: number; requiresReceipts?: boolean };
  invoiceConfig?: { paymentTermDays?: number; lateFeePercentage?: number; currency?: string };
  exemptionConfig?: { exemptionType?: string; criteria?: string; autoApprove?: boolean };
  attendanceConfig?: { maxWorkingHoursPerWeek?: number; alerts?: { lateArrival?: boolean; earlyDeparture?: boolean; missedClockIn?: boolean; overtimeAlert?: boolean } };

  // Per-employee statutory overrides for payroll. When a policy in this
  // category is attached to an employee, payroll-service's `processRun`
  // layers these on top of the org-level config from /settings/payroll
  // (most-specific wins). All sub-fields optional — override only what
  // you want, e.g. "reduced PF rate for interns" sets just pfConfig.
  payrollOverrides?: {
    pfConfig?: {
      applicable?: boolean;
      employeeRate?: number;
      employerRate?: number;
      wageCeiling?: number;
      adminChargesRate?: number;
      edliRate?: number;
    };
    esiConfig?: {
      applicable?: boolean;
      employeeRate?: number;
      employerRate?: number;
      wageCeiling?: number;
    };
    ptConfig?: {
      applicable?: boolean;
      state?: string;
    };
    // Overtime policy. The engine used to treat every OT hour as a flat
    // `rate × (basic+DA) / (workingDays × 8)` which is both under-specified
    // (no separate weekend/holiday premium) and unit-stuck (8 hrs/day was
    // hardcoded). These fields let an org honour Factories Act-style
    // overtime — weekday 2×, holiday 2.5× — and cap abuse via a monthly
    // limit without leaving the config surface.
    overtime?: {
      applicable?: boolean;
      rate?: number;                      // weekday multiplier, default 2
      weekendRate?: number;                // defaults to `rate`
      holidayRate?: number;                // defaults to `weekendRate` ?? `rate`
      // Night-shift premium applied when the attendance record is flagged
      // `isNightShift` (resolved at clock-in from the shift policy). Takes
      // precedence over weekday/weekend/holiday buckets — Factories Act §59
      // treats night-shift hours as its own category. Defaults to `rate`.
      nightShiftMultiplier?: number;
      hoursPerDay?: number;                // standard shift length, default 8
      maxOvertimeHoursPerMonth?: number;   // cap total paid OT; 0/undefined = no cap
      includeDA?: boolean;                 // fold DA into hourly rate, default true
    };
    // LOP (Loss of Pay) policy. Payroll-service consults this when
    // building the attendance summary — currently the engine treats
    // every `absent` record as 1 LOP day and ignores half-days entirely,
    // which is wrong for any org that pays half-day absences at 50%.
    // All fields optional; unset falls back to the engine default
    // (absents count as 1, half-days count as 0.5 when enabled).
    lopConfig?: {
      includeAbsentInLop?: boolean;   // default true
      includeHalfDayInLop?: boolean;  // default true — counts half-days as partial LOP
      halfDayLopFactor?: number;      // default 0.5
    };
  };

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
    // Pulled in from leave-service's legacy LeavePolicy so an org-wide
    // rule like "casual leave unlocks after 3 months" fits inside one
    // policy doc instead of being split across services.
    minServiceMonths: { type: Number, default: 0 },
    applicableTo: { type: String, default: 'all' },
  },
  { _id: false },
);

const BlackoutPeriodSubSchema = new Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
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
      // `payroll_override` was added to carry per-employee statutory
      // overrides (PF/ESI/PT rate tweaks for a specific hire, e.g.
      // "intern PF @ 8%"). Payroll-service reads policies of this
      // category attached via employee.policyIds[] when computing runs.
      enum: ['attendance', 'working_hours', 'leave', 'wfh', 'overtime', 'shift', 'invoices', 'expenses', 'exemptions', 'travel', 'reimbursement', 'payroll_override'],
    },

    // Category-specific configs
    workTiming: {
      startTime: { type: String },
      endTime: { type: String },
      timezone: { type: String },
      graceMinutes: { type: Number },
      minWorkingHours: { type: Number },
      breakMinutes: { type: Number },
      // Status-resolution thresholds used by attendance-service:
      lateToHalfDayMinutes: { type: Number },
      minHoursForPresent: { type: Number },
      isNightShift: { type: Boolean },
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
      probationLeaveAllowed: { type: Boolean, default: false },
      blackoutPeriods: [BlackoutPeriodSubSchema],
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
    payrollOverrides: {
      pfConfig: {
        applicable: { type: Boolean },
        employeeRate: { type: Number },
        employerRate: { type: Number },
        wageCeiling: { type: Number },
        adminChargesRate: { type: Number },
        edliRate: { type: Number },
      },
      esiConfig: {
        applicable: { type: Boolean },
        employeeRate: { type: Number },
        employerRate: { type: Number },
        wageCeiling: { type: Number },
      },
      ptConfig: {
        applicable: { type: Boolean },
        state: { type: String },
      },
      overtime: {
        applicable: { type: Boolean },
        rate: { type: Number },
        weekendRate: { type: Number },
        holidayRate: { type: Number },
        nightShiftMultiplier: { type: Number },
        hoursPerDay: { type: Number },
        maxOvertimeHoursPerMonth: { type: Number },
        includeDA: { type: Boolean },
      },
      // LOP config: lets an org (or a specific employee via override)
      // tune how half-days and absents fold into the LOP deduction.
      lopConfig: {
        includeAbsentInLop: { type: Boolean },
        includeHalfDayInLop: { type: Boolean },
        halfDayLopFactor: { type: Number },
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
