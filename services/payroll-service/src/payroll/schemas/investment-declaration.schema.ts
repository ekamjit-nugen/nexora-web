import { Schema, Document } from 'mongoose';

export interface IInvestmentItem {
  description: string;
  declaredAmount: number;
  proofSubmitted: boolean;
  verifiedAmount: number;
  proofUrl: string;
}

export interface IInvestmentSection {
  section: string;
  items: IInvestmentItem[];
}

export interface IInvestmentDeclaration extends Document {
  organizationId?: string;
  employeeId: string;
  financialYear: string;
  regime: string;
  status: string;
  sections: IInvestmentSection[];
  totalDeclared: number;
  totalVerified: number;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const InvestmentDeclarationSchema = new Schema<IInvestmentDeclaration>(
  {
    organizationId: { type: String, default: null, index: true },
    employeeId: { type: String, required: true, index: true },
    financialYear: { type: String, required: true, trim: true },
    regime: {
      type: String,
      enum: ['old', 'new'],
      default: 'old',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'verified', 'rejected'],
      default: 'draft',
    },
    sections: [
      {
        section: {
          type: String,
          required: true,
          enum: ['80C', '80D', '80E', '80G', '24b', 'HRA'],
        },
        items: [
          {
            description: { type: String, required: true },
            declaredAmount: { type: Number, default: 0 },
            proofSubmitted: { type: Boolean, default: false },
            verifiedAmount: { type: Number, default: 0 },
            proofUrl: { type: String, default: null },
          },
        ],
      },
    ],
    totalDeclared: { type: Number, default: 0 },
    totalVerified: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

InvestmentDeclarationSchema.index({ organizationId: 1, employeeId: 1, financialYear: 1 }, { unique: true });
InvestmentDeclarationSchema.index({ isDeleted: 1 });
