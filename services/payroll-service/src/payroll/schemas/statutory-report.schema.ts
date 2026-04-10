import { Schema, Document } from 'mongoose';

export interface IStatutoryReportPeriod {
  month?: number;
  quarter?: number;
  year: number;
}

export interface IStatutoryReportTotals {
  totalGross: number;
  totalDeductions: number;
  totalTax: number;
  employeeCount: number;
}

export interface IStatutoryReport extends Document {
  organizationId: string;
  reportType: string;
  financialYear?: string;
  period: IStatutoryReportPeriod;
  employeeId?: string;
  status: string;
  data: Record<string, unknown>;
  downloadUrl?: string;
  generatedAt?: Date;
  generatedBy?: string;
  filedAt?: Date;
  filingReference?: string;
  totals: IStatutoryReportTotals;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const StatutoryReportSchema = new Schema<IStatutoryReport>(
  {
    organizationId: { type: String, required: true, index: true },
    reportType: {
      type: String,
      required: true,
      enum: [
        'form_16',
        'form_16a',
        'pf_ecr',
        'esi_return',
        'tds_quarterly',
        'pt_return',
        'lwf_return',
      ],
    },
    financialYear: { type: String, default: null },
    period: {
      month: { type: Number, default: null, min: 1, max: 12 },
      quarter: { type: Number, default: null, min: 1, max: 4 },
      year: { type: Number, required: true },
    },
    employeeId: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'generated', 'filed', 'rejected'],
      default: 'draft',
    },
    data: { type: Schema.Types.Mixed, default: {} },
    downloadUrl: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    generatedBy: { type: String, default: null },
    filedAt: { type: Date, default: null },
    filingReference: { type: String, default: null },
    totals: {
      totalGross: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      employeeCount: { type: Number, default: 0 },
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

StatutoryReportSchema.index({ organizationId: 1, reportType: 1, financialYear: 1 });
StatutoryReportSchema.index({ organizationId: 1, employeeId: 1, reportType: 1 });
StatutoryReportSchema.index({ isDeleted: 1 });
