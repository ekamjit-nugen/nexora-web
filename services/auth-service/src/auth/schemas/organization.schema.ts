import { Schema, Document } from 'mongoose';

export interface IOrganizationSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  industry: string;
  size: string;
  plan: string;
  logo?: string;
  domain?: string;
  settings: IOrganizationSettings;
  onboardingCompleted: boolean;
  onboardingStep: number;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    industry: {
      type: String,
      enum: ['it_company', 'agency', 'startup', 'enterprise', 'nonprofit', 'education', 'healthcare', 'finance', 'other'],
      default: 'other',
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
      default: '1-10',
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'professional', 'enterprise'],
      default: 'free',
    },
    logo: { type: String, default: null },
    domain: { type: String, default: null },
    settings: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      currency: { type: String, default: 'INR' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
    },
    onboardingCompleted: { type: Boolean, default: false },
    onboardingStep: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ domain: 1 });
OrganizationSchema.index({ isDeleted: 1, isActive: 1 });
