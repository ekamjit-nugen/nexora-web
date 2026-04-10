import { Schema, Document } from 'mongoose';

export interface IBankTransactionAuditEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
}

export interface IBankTransactionBankDetails {
  accountNumber: string; // last 4 digits only
  ifsc: string;
  accountHolder: string;
  beneficiaryName?: string;
}

export interface IBankTransaction extends Document {
  organizationId: string;
  payrollRunId: string;
  payrollEntryId?: string;
  employeeId: string;
  amount: number; // paise
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'reversed' | 'cancelled';
  mode: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'manual';
  provider: 'razorpay' | 'cashfree' | 'decentro' | 'manual';
  providerTransactionId?: string;
  providerFundAccountId?: string;
  bankDetails: IBankTransactionBankDetails;
  initiatedAt?: Date;
  processedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  idempotencyKey: string;
  auditTrail: IBankTransactionAuditEntry[];
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const BankTransactionSchema = new Schema<IBankTransaction>(
  {
    organizationId: { type: String, required: true, index: true },
    payrollRunId: { type: String, required: true, index: true },
    payrollEntryId: { type: String, default: null },
    employeeId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed', 'reversed', 'cancelled'],
      default: 'pending',
    },
    mode: {
      type: String,
      enum: ['NEFT', 'RTGS', 'IMPS', 'UPI', 'manual'],
      default: 'NEFT',
    },
    provider: {
      type: String,
      enum: ['razorpay', 'cashfree', 'decentro', 'manual'],
      default: 'razorpay',
    },
    providerTransactionId: { type: String, default: null },
    providerFundAccountId: { type: String, default: null },
    bankDetails: {
      accountNumber: { type: String, required: true },
      ifsc: { type: String, required: true },
      accountHolder: { type: String, required: true },
      beneficiaryName: { type: String, default: null },
    },
    initiatedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    idempotencyKey: { type: String, required: true, unique: true },
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

BankTransactionSchema.index({ organizationId: 1, payrollRunId: 1, employeeId: 1 });
BankTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
BankTransactionSchema.index({ status: 1, initiatedAt: -1 });
BankTransactionSchema.index({ isDeleted: 1 });
