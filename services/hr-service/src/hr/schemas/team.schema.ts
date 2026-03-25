import { Schema, Document } from 'mongoose';

export interface ITeam extends Document {
  organizationId?: string;
  name: string;
  description?: string;
  departmentId: string;
  leadId?: string;
  members: string[];
  isCrossFunctional: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const TeamSchema = new Schema<ITeam>(
  {
    organizationId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    departmentId: { type: String, required: true, index: true },
    leadId: { type: String, default: null },
    members: [{ type: String }],
    isCrossFunctional: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

TeamSchema.index({ departmentId: 1, isActive: 1 });
