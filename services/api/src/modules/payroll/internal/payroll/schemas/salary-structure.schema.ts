import { Schema, Document } from 'mongoose';

export interface ISalaryComponent {
  code: string;
  name: string;
  type: string;
  calculationMethod: string;
  annualAmount: number;
  monthlyAmount: number;
  percentage?: number;
  isTaxable: boolean;
  taxExemptionLimit?: number;
  isPFApplicable: boolean;
  isESIApplicable: boolean;
  showInPayslip: boolean;
  order: number;
}

export interface IStatutoryDeductions {
  pfEmployee: number;
  pfEmployer: number;
  pfAdminCharges: number;
  edli: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  lwf: number;
}

export interface ISalaryStructureMetadata {
  revision: number;
  previousStructureId?: string;
  revisionReason?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ISalaryStructure extends Document {
  organizationId?: string;
  employeeId: string;
  structureName: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  ctc: number;
  grossSalary: number;
  netSalary: number;
  components: ISalaryComponent[];
  statutoryDeductions: IStatutoryDeductions;
  metadata: ISalaryStructureMetadata;
  status: string;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SalaryStructureSchema = new Schema<ISalaryStructure>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    structureName: { type: String, default: null, trim: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    ctc: { type: Number, required: true },
    grossSalary: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    components: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        type: {
          type: String,
          required: true,
          enum: ['earning', 'deduction', 'employer_contribution', 'reimbursement'],
        },
        calculationMethod: {
          type: String,
          required: true,
          enum: ['fixed', 'percentage_basic', 'percentage_ctc', 'percentage_gross'],
        },
        annualAmount: { type: Number, default: 0 },
        monthlyAmount: { type: Number, default: 0 },
        percentage: { type: Number, default: null },
        isTaxable: { type: Boolean, default: true },
        taxExemptionLimit: { type: Number, default: null },
        isPFApplicable: { type: Boolean, default: false },
        isESIApplicable: { type: Boolean, default: false },
        showInPayslip: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
      },
    ],
    statutoryDeductions: {
      pfEmployee: { type: Number, default: 0 },
      pfEmployer: { type: Number, default: 0 },
      pfAdminCharges: { type: Number, default: 0 },
      edli: { type: Number, default: 0 },
      esiEmployee: { type: Number, default: 0 },
      esiEmployer: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
      lwf: { type: Number, default: 0 },
    },
    metadata: {
      revision: { type: Number, default: 1 },
      previousStructureId: { type: String, default: null },
      revisionReason: { type: String, default: null },
      approvedBy: { type: String, default: null },
      approvedAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'active', 'superseded'],
      default: 'draft',
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

SalaryStructureSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
SalaryStructureSchema.index({ organizationId: 1, effectiveFrom: -1 });
SalaryStructureSchema.index({ employeeId: 1, effectiveFrom: -1 });
SalaryStructureSchema.index({ isDeleted: 1 });
