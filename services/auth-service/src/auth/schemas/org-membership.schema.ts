import { Schema, Document } from 'mongoose';

export interface IOrgMembership extends Document {
  userId: string;
  organizationId: string;
  email?: string;
  role: string;
  status: string;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const OrgMembershipSchema = new Schema<IOrgMembership>(
  {
    userId: { type: String, default: null, index: true },
    organizationId: { type: String, required: true, index: true },
    email: { type: String, default: null },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'member', 'viewer'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended'],
      default: 'active',
    },
    invitedBy: { type: String, default: null },
    invitedAt: { type: Date, default: null },
    joinedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

OrgMembershipSchema.index(
  { userId: 1, organizationId: 1 },
  { unique: true, partialFilterExpression: { userId: { $ne: null } } },
);
OrgMembershipSchema.index(
  { email: 1, organizationId: 1 },
  { unique: true, partialFilterExpression: { email: { $ne: null } } },
);
