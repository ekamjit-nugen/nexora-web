import { Schema, Document } from 'mongoose';

export interface IPageTemplate extends Document {
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  category: 'runbook' | 'adr' | 'meeting_notes' | 'rfc' | 'retrospective' | 'onboarding' | 'custom';
  content: string;
  icon: string;
  isSystem: boolean;
  order: number;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PageTemplateSchema = new Schema<IPageTemplate>(
  {
    organizationId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    slug: { type: String, default: '' },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['runbook', 'adr', 'meeting_notes', 'rfc', 'retrospective', 'onboarding', 'custom'],
      default: 'custom',
    },
    content: { type: String, default: '' },
    icon: { type: String, default: '📝' },
    isSystem: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

PageTemplateSchema.index({ organizationId: 1, isDeleted: 1 });
PageTemplateSchema.index({ category: 1 });
