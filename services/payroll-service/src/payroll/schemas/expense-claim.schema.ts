import { Schema, Document } from 'mongoose';

export interface IExpenseItem {
  description: string;
  amount: number;
  date: Date;
  receiptUrl?: string;
  merchant?: string;
  ocrExtracted?: boolean;
}

export interface IApprovalChainEntry {
  level: string;
  approvedBy?: string;
  approvedAt?: Date;
  status: string;
  remarks?: string;
}

export interface IAuditTrailEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
}

export interface IExpenseClaim extends Document {
  organizationId: string;
  employeeId: string;
  claimNumber: string;
  title: string;
  category: string;
  items: IExpenseItem[];
  totalAmount: number;
  currency: string;
  status: string;
  approvalChain: IApprovalChainEntry[];
  submittedAt?: Date;
  paidAt?: Date;
  paidVia?: string;
  payrollRunId?: string;
  rejectionReason?: string;
  auditTrail: IAuditTrailEntry[];
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ExpenseClaimSchema = new Schema<IExpenseClaim>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    claimNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        'travel',
        'food',
        'medical',
        'internet',
        'phone',
        'office_supplies',
        'training',
        'client_entertainment',
        'other',
      ],
    },
    items: [
      {
        description: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true },
        receiptUrl: { type: String, default: null },
        merchant: { type: String, default: null },
        ocrExtracted: { type: Boolean, default: false },
      },
    ],
    totalAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'manager_approved',
        'hr_approved',
        'finance_approved',
        'paid',
        'rejected',
        'cancelled',
      ],
      default: 'draft',
    },
    approvalChain: [
      {
        level: { type: String, required: true },
        approvedBy: { type: String, default: null },
        approvedAt: { type: Date, default: null },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        remarks: { type: String, default: null },
      },
    ],
    submittedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    // QA finding Payroll-6: Mongoose rejected new expense claims because
    // `default: null` isn't a member of the enum, so create-claim always
    // 500'd. Make the field optional (no default at all) — it gets set
    // later when the claim is actually paid.
    paidVia: {
      type: String,
      enum: ['payroll', 'separate_transfer'],
      required: false,
    },
    payrollRunId: { type: String, default: null },
    rejectionReason: { type: String, default: null },
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

ExpenseClaimSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
ExpenseClaimSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
ExpenseClaimSchema.index({ claimNumber: 1 }, { unique: true });
ExpenseClaimSchema.index({ isDeleted: 1 });
