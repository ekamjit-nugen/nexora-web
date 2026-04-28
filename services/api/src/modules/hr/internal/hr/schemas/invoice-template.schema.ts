import { Schema, Document } from 'mongoose';

export interface IInvoiceTemplate extends Document {
  organizationId?: string;
  name: string;
  description?: string;
  defaultPaymentTerms: number;
  defaultCurrency: string;
  defaultNotes?: string;
  defaultTerms?: string;
  layout: string;
  colorScheme: string;
  showLogo: boolean;
  showTax: boolean;
  showDiscount: boolean;
  defaultItems?: Array<{ description: string; rate: number }>;
  isDefault: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DefaultItemSchema = new Schema(
  {
    description: { type: String, required: true },
    rate: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export const InvoiceTemplateSchema = new Schema<IInvoiceTemplate>(
  {
    organizationId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    defaultPaymentTerms: { type: Number, default: 30 },
    defaultCurrency: { type: String, default: 'INR' },
    defaultNotes: { type: String, default: null },
    defaultTerms: { type: String, default: null },
    layout: {
      type: String,
      enum: ['standard', 'modern', 'minimal', 'professional', 'creative'],
      default: 'standard',
    },
    colorScheme: { type: String, default: '#2E86C1' },
    showLogo: { type: Boolean, default: true },
    showTax: { type: Boolean, default: true },
    showDiscount: { type: Boolean, default: false },
    defaultItems: [DefaultItemSchema],
    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

InvoiceTemplateSchema.index({ organizationId: 1, name: 1 });
InvoiceTemplateSchema.index({ isDeleted: 1, isDefault: 1 });
