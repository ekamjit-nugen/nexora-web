import { Schema, Document } from 'mongoose';

export interface IPayslipEmployeeSnapshot {
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  bankAccount: string;
  pan: string;
  uan: string;
  esiNumber: string;
}

export interface IPayslipOrganizationSnapshot {
  name: string;
  logo: string;
  address: string;
  pan: string;
  tan: string;
}

export interface IPayslipLineItem {
  code: string;
  name: string;
  amount: number;
}

export interface IPayslipTotals {
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  netPayableWords: string;
}

export interface IPayslipYTDTotals {
  grossEarnings: number;
  totalDeductions: number;
  pfTotal: number;
  esiTotal: number;
  tdsTotal: number;
  netPayable: number;
}

export interface IPayslip extends Document {
  organizationId?: string;
  employeeId: string;
  payrollRunId: string;
  payrollEntryId: string;
  payPeriod: { month: number; year: number; label: string };
  employeeSnapshot: IPayslipEmployeeSnapshot;
  organizationSnapshot: IPayslipOrganizationSnapshot;
  earnings: IPayslipLineItem[];
  deductions: IPayslipLineItem[];
  employerContributions: IPayslipLineItem[];
  totals: IPayslipTotals;
  ytdTotals: IPayslipYTDTotals;
  pdfUrl?: string;
  pdfGeneratedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const PayslipSchema = new Schema<IPayslip>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    payrollRunId: { type: String, default: null },
    payrollEntryId: { type: String, default: null },
    payPeriod: {
      month: { type: Number, required: true, min: 1, max: 12 },
      year: { type: Number, required: true },
      label: { type: String, default: null },
    },
    employeeSnapshot: {
      employeeId: { type: String, default: null },
      name: { type: String, default: null },
      designation: { type: String, default: null },
      department: { type: String, default: null },
      bankAccount: { type: String, default: null },
      pan: { type: String, default: null },
      uan: { type: String, default: null },
      esiNumber: { type: String, default: null },
    },
    organizationSnapshot: {
      name: { type: String, default: null },
      logo: { type: String, default: null },
      address: { type: String, default: null },
      pan: { type: String, default: null },
      tan: { type: String, default: null },
    },
    earnings: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, default: 0 },
      },
    ],
    deductions: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, default: 0 },
      },
    ],
    employerContributions: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, default: 0 },
      },
    ],
    totals: {
      grossEarnings: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      netPayable: { type: Number, default: 0 },
      netPayableWords: { type: String, default: null },
    },
    ytdTotals: {
      grossEarnings: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      pfTotal: { type: Number, default: 0 },
      esiTotal: { type: Number, default: 0 },
      tdsTotal: { type: Number, default: 0 },
      netPayable: { type: Number, default: 0 },
    },
    pdfUrl: { type: String, default: null },
    pdfGeneratedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

PayslipSchema.index({ organizationId: 1, employeeId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 }, { unique: true });
PayslipSchema.index({ payrollRunId: 1 });
PayslipSchema.index({ isDeleted: 1 });
