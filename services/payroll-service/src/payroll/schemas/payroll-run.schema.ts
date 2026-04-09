import { Schema, Document } from 'mongoose';

export interface IPayPeriod {
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
}

export interface IPayrollRunSummary {
  totalEmployees: number;
  processedEmployees: number;
  skippedEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerContributions: number;
  totalTDS: number;
  totalPFEmployee: number;
  totalPFEmployer: number;
  totalESIEmployee: number;
  totalESIEmployer: number;
  totalPT: number;
  totalLWF: number;
  totalReimbursements: number;
  totalArrears: number;
  totalOvertime: number;
  totalLOPDeductions: number;
  totalBonuses: number;
}

export interface IAuditTrailEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface IPayrollRun extends Document {
  organizationId?: string;
  payPeriod: IPayPeriod;
  runNumber: string;
  status: string;
  summary: IPayrollRunSummary;
  employeePayrolls: string[];
  auditTrail: IAuditTrailEntry[];
  approvedBy?: string;
  approvedAt?: Date;
  finalizedBy?: string;
  finalizedAt?: Date;
  paidAt?: Date;
  paymentReference?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PayrollRunSchema = new Schema<IPayrollRun>(
  {
    organizationId: { type: String, default: null, index: true },
    payPeriod: {
      month: { type: Number, required: true, min: 1, max: 12 },
      year: { type: Number, required: true },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    runNumber: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['draft', 'processing', 'review', 'approved', 'finalized', 'paid', 'cancelled'],
      default: 'draft',
    },
    summary: {
      totalEmployees: { type: Number, default: 0 },
      processedEmployees: { type: Number, default: 0 },
      skippedEmployees: { type: Number, default: 0 },
      totalGross: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      totalNet: { type: Number, default: 0 },
      totalEmployerContributions: { type: Number, default: 0 },
      totalTDS: { type: Number, default: 0 },
      totalPFEmployee: { type: Number, default: 0 },
      totalPFEmployer: { type: Number, default: 0 },
      totalESIEmployee: { type: Number, default: 0 },
      totalESIEmployer: { type: Number, default: 0 },
      totalPT: { type: Number, default: 0 },
      totalLWF: { type: Number, default: 0 },
      totalReimbursements: { type: Number, default: 0 },
      totalArrears: { type: Number, default: 0 },
      totalOvertime: { type: Number, default: 0 },
      totalLOPDeductions: { type: Number, default: 0 },
      totalBonuses: { type: Number, default: 0 },
    },
    employeePayrolls: [{ type: String }],
    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: String, required: true },
        performedAt: { type: Date, required: true },
        notes: { type: String, default: null },
        previousStatus: { type: String, default: null },
        newStatus: { type: String, default: null },
      },
    ],
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    finalizedBy: { type: String, default: null },
    finalizedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paymentReference: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

PayrollRunSchema.index(
  { organizationId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 },
  { unique: true, partialFilterExpression: { status: { $nin: ['cancelled'] }, isDeleted: false } },
);
PayrollRunSchema.index({ organizationId: 1, status: 1 });
PayrollRunSchema.index({ runNumber: 1 }, { unique: true });
PayrollRunSchema.index({ isDeleted: 1 });
