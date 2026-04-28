import { Schema, Document } from 'mongoose';

export interface ILoanInstallment {
  installmentNumber: number;
  dueMonth: number;
  dueYear: number;
  principal: number;
  interest: number;
  emiAmount: number;
  status: string;
  payrollRunId?: string;
  deductedAt?: Date;
}

export interface ILoanApprovalEntry {
  level: number;
  approverId?: string;
  status: string;
  comments?: string;
  actedAt?: Date;
}

export interface IEmployeeLoan extends Document {
  organizationId: string;
  employeeId: string;
  loanNumber: string;
  type: string;
  amount: number;
  interestRate: number;
  tenure: number;
  emiAmount: number;
  disbursedAmount: number;
  outstandingBalance: number;
  totalInterest: number;
  schedule: ILoanInstallment[];
  reason: string;
  approvalChain: ILoanApprovalEntry[];
  disbursedAt?: Date;
  closedAt?: Date;
  status: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EmployeeLoanSchema = new Schema<IEmployeeLoan>(
  {
    organizationId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    loanNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ['salary_advance', 'personal_loan', 'emergency_loan', 'festival_advance'],
    },
    amount: { type: Number, required: true, min: 0 },
    interestRate: { type: Number, default: 0, min: 0 },
    tenure: { type: Number, required: true, min: 1 },
    emiAmount: { type: Number, default: 0 },
    disbursedAmount: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    totalInterest: { type: Number, default: 0 },
    schedule: [
      {
        installmentNumber: { type: Number, required: true },
        dueMonth: { type: Number, required: true },
        dueYear: { type: Number, required: true },
        principal: { type: Number, required: true },
        interest: { type: Number, required: true },
        emiAmount: { type: Number, required: true },
        status: {
          type: String,
          enum: ['pending', 'deducted', 'skipped'],
          default: 'pending',
        },
        payrollRunId: { type: String, default: null },
        deductedAt: { type: Date, default: null },
      },
    ],
    reason: { type: String, required: true },
    approvalChain: [
      {
        level: { type: Number, required: true },
        approverId: { type: String, default: null },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        comments: { type: String, default: null },
        actedAt: { type: Date, default: null },
      },
    ],
    disbursedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['applied', 'approved', 'disbursed', 'active', 'closed', 'rejected', 'cancelled'],
      default: 'applied',
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

EmployeeLoanSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
EmployeeLoanSchema.index({ loanNumber: 1 }, { unique: true });
EmployeeLoanSchema.index({ organizationId: 1, status: 1 });
EmployeeLoanSchema.index({ isDeleted: 1 });
