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

export interface IFnFSettlement {
  basicDue: number;
  leaveEncashment: number;
  bonusDue: number;
  gratuity: number;
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
      enum: ['resignation', 'termination', 'retirement', 'contract_end', 'mutual_separation'],
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
      bonusDue: { type: Number, default: 0 },
      gratuity: { type: Number, default: 0 },
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
