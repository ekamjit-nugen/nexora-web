import { Schema, Document } from 'mongoose';

export interface ISpace extends Document {
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  visibility: 'public' | 'restricted';
  allowedRoles: string[];
  allowedTeamIds: string[];
  allowedUserIds: string[];
  homepageId: string;
  order: number;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SpaceSchema = new Schema<ISpace>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '📚' },
    color: { type: String, default: '#3B82F6' },
    visibility: { type: String, enum: ['public', 'restricted'], default: 'public' },
    allowedRoles: [{ type: String }],
    allowedTeamIds: [{ type: String }],
    allowedUserIds: [{ type: String }],
    homepageId: { type: String, default: null },
    order: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

SpaceSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
SpaceSchema.index({ organizationId: 1, isDeleted: 1 });
SpaceSchema.index({ name: 'text', description: 'text' });
