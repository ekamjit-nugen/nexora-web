import { Schema, Document } from 'mongoose';

export interface IClientContactPerson {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
}

export interface IClient extends Document {
  organizationId?: string;
  companyName: string;
  displayName?: string;
  industry: string;
  contactPerson?: {
    name: string;
    email: string;
    phone: string;
    designation: string;
  };
  contactPersons?: IClientContactPerson[];
  projectIds?: string[];
  totalRevenue?: number;
  outstandingAmount?: number;
  lastInvoiceDate?: Date;
  lastPaymentDate?: Date;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  website?: string;
  taxId?: string;
  currency: string;
  paymentTerms: number;
  status: string;
  tags: string[];
  notes?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ClientSchema = new Schema<IClient>(
  {
    organizationId: { type: String, default: null, index: true },
    companyName: { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, default: null, trim: true },
    industry: {
      type: String,
      enum: ['technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'media', 'consulting', 'other'],
      default: 'other',
    },
    contactPerson: {
      name: { type: String, default: null },
      email: { type: String, default: null },
      phone: { type: String, default: null },
      designation: { type: String, default: null },
    },
    contactPersons: [{
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, default: null },
      designation: { type: String, default: null },
      isPrimary: { type: Boolean, default: false },
    }],
    projectIds: [{ type: String }],
    totalRevenue: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    lastInvoiceDate: { type: Date, default: null },
    lastPaymentDate: { type: Date, default: null },
    billingAddress: {
      street: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
      zip: { type: String, default: null },
    },
    website: { type: String, default: null },
    taxId: { type: String, default: null },
    currency: { type: String, default: 'INR' },
    paymentTerms: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ['active', 'inactive', 'prospect'],
      default: 'active',
    },
    tags: [{ type: String }],
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

ClientSchema.index({ companyName: 'text', displayName: 'text', 'contactPerson.name': 'text', 'contactPerson.email': 'text' });
ClientSchema.index({ isDeleted: 1, status: 1 });
ClientSchema.index({ industry: 1 });
