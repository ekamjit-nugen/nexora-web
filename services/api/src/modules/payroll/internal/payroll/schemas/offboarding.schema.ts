import { Schema, Document } from 'mongoose';

export interface IOffboardingClearanceAsset {
  name: string;
  serialNumber?: string;
  returned: boolean;
  returnedAt?: Date;
}

export interface IOffboardingClearance {
  department: string;
  approver?: string;
  status: string;
  clearedAt?: Date;
  remarks?: string;
  assets?: IOffboardingClearanceAsset[];
}

export interface IExitInterview {
  conducted: boolean;
  conductedBy?: string;
  conductedAt?: Date;
  rating?: number;
  feedback?: string;
  reasonForLeaving?: string;
  wouldRecommend?: boolean;
}

/**
 * Gratuity detail block — persisted on the F&F settlement so HR, the
 * employee, and an external auditor can all see *why* the number is
 * what it is, not just the bottom line. Mandatory under Payment of
 * Gratuity Act 1972 §4 (employer has to be able to explain the calc).
 *
 * - `eligibleReason` distinguishes eligible-by-tenure (the normal case)
 *   from eligible-by-exception (death / disability / retirement — the
 *   5-year minimum is waived for these).
 * - `capped` flags the ₹20 lakh statutory ceiling so HR can explain to
 *   a long-tenure exec why they aren't getting the full formula amount.
 * - `monthlyWage` isolates the (basic+DA) figure used in the formula so
 *   the employee can verify it matches their last payslip.
 */
export interface IGratuityDetail {
  eligible: boolean;
  eligibleReason?: string;
  ineligibleReason?: string;
  yearsOfService: number;          // completed years after rounding
  rawMonthsOfService: number;       // exact, pre-rounding — audit only
  monthlyWage: number;              // basic + DA
  computed: number;                 // before cap
  amount: number;                   // final paid (capped ≤ 20L)
  capped: boolean;
  cap: number;                      // cap value used (for reference)
}

/**
 * Leave encashment detail block — persisted on the F&F settlement so
 * HR and the employee can see which leave types contributed to the
 * encashment, how many days, and what per-day rate was used. #13
 * replaces a hardcoded `leaveBalance = 15` with a real cross-lookup
 * of leave-service + policy-service. Shape mirrors `IGratuityDetail`
 * so UI can render the two blocks with the same template.
 *
 * `source` distinguishes the happy path (leave-service responded) from
 * the fallback path (leave-service down / employee not in balance
 * records) — helpful when HR is reconciling numbers against the leave
 * app directly.
 */
export interface ILeaveEncashmentBucket {
  leaveType: string;
  availableDays: number;
  encashable: boolean;
  includedDays: number;   // 0 when non-encashable
  amount: number;
}

export interface ILeaveEncashmentDetail {
  source: 'leave_service' | 'fallback';
  perDayRate: number;           // (basic + DA) / 30
  monthlyWage: number;           // basic + DA (same denominator as gratuity)
  totalEncashableDays: number;
  totalAmount: number;
  buckets: ILeaveEncashmentBucket[];
  note?: string;                 // human explanation (e.g. "leave-service unreachable")
}

export interface IFnFSettlement {
  basicDue: number;
  leaveEncashment: number;
  leaveEncashmentDetail?: ILeaveEncashmentDetail;
  bonusDue: number;
  gratuity: number;
  gratuityDetail?: IGratuityDetail;
  pendingReimbursements: number;
  noticeRecovery: number;
  otherDeductions: number;
  totalPayable: number;
  status: string;
  approvedBy?: string;
  approvedAt?: Date;
  paidAt?: Date;
}

export interface IOffboardingAuditEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
}

export interface IOffboarding extends Document {
  organizationId: string;
  employeeId: string;
  type: string;
  status: string;
  resignationDate: Date;
  lastWorkingDate: Date;
  noticePeriodDays: number;
  noticePeriodWaived: boolean;
  noticePeriodShortfall?: number;
  noticeRecoveryAmount?: number;
  clearance: IOffboardingClearance[];
  exitInterview: IExitInterview;
  fnfSettlement: IFnFSettlement;
  experienceLetterGenerated: boolean;
  experienceLetterUrl?: string;
  relievingLetterUrl?: string;
  auditTrail: IOffboardingAuditEntry[];
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const OffboardingSchema = new Schema<IOffboarding>(
  {
    organizationId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['resignation', 'termination', 'retirement', 'contract_end', 'mutual_separation', 'death', 'disability'],
    },
    status: {
      type: String,
      enum: ['initiated', 'notice_period', 'clearance', 'fnf_processing', 'fnf_approved', 'completed', 'cancelled'],
      default: 'initiated',
    },
    resignationDate: { type: Date, required: true },
    lastWorkingDate: { type: Date, required: true },
    noticePeriodDays: { type: Number, default: 30 },
    noticePeriodWaived: { type: Boolean, default: false },
    noticePeriodShortfall: { type: Number, default: null },
    noticeRecoveryAmount: { type: Number, default: null },
    clearance: [
      {
        department: { type: String, required: true },
        approver: { type: String, default: null },
        status: {
          type: String,
          enum: ['pending', 'cleared', 'issues_found'],
          default: 'pending',
        },
        clearedAt: { type: Date, default: null },
        remarks: { type: String, default: null },
        assets: [
          {
            name: { type: String, required: true },
            serialNumber: { type: String, default: null },
            returned: { type: Boolean, default: false },
            returnedAt: { type: Date, default: null },
          },
        ],
      },
    ],
    exitInterview: {
      conducted: { type: Boolean, default: false },
      conductedBy: { type: String, default: null },
      conductedAt: { type: Date, default: null },
      rating: { type: Number, default: null, min: 1, max: 5 },
      feedback: { type: String, default: null },
      reasonForLeaving: { type: String, default: null },
      wouldRecommend: { type: Boolean, default: null },
    },
    fnfSettlement: {
      basicDue: { type: Number, default: 0 },
      leaveEncashment: { type: Number, default: 0 },
      leaveEncashmentDetail: {
        source: { type: String, enum: ['leave_service', 'fallback'], default: 'fallback' },
        perDayRate: { type: Number, default: 0 },
        monthlyWage: { type: Number, default: 0 },
        totalEncashableDays: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        buckets: [
          {
            leaveType: { type: String, required: true },
            availableDays: { type: Number, default: 0 },
            encashable: { type: Boolean, default: false },
            includedDays: { type: Number, default: 0 },
            amount: { type: Number, default: 0 },
          },
        ],
        note: { type: String, default: null },
      },
      bonusDue: { type: Number, default: 0 },
      gratuity: { type: Number, default: 0 },
      gratuityDetail: {
        eligible: { type: Boolean, default: false },
        eligibleReason: { type: String, default: null },
        ineligibleReason: { type: String, default: null },
        yearsOfService: { type: Number, default: 0 },
        rawMonthsOfService: { type: Number, default: 0 },
        monthlyWage: { type: Number, default: 0 },
        computed: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
        capped: { type: Boolean, default: false },
        cap: { type: Number, default: 2000000 },  // ₹20 lakh statutory cap
      },
      pendingReimbursements: { type: Number, default: 0 },
      noticeRecovery: { type: Number, default: 0 },
      otherDeductions: { type: Number, default: 0 },
      totalPayable: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['pending', 'calculated', 'approved', 'paid'],
        default: 'pending',
      },
      approvedBy: { type: String, default: null },
      approvedAt: { type: Date, default: null },
      paidAt: { type: Date, default: null },
    },
    experienceLetterGenerated: { type: Boolean, default: false },
    experienceLetterUrl: { type: String, default: null },
    relievingLetterUrl: { type: String, default: null },
    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: String, required: true },
        performedAt: { type: Date, required: true },
        notes: { type: String, default: null },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

OffboardingSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
OffboardingSchema.index({ organizationId: 1, status: 1 });
OffboardingSchema.index({ isDeleted: 1 });
