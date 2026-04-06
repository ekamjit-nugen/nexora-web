import { Schema, Document } from 'mongoose';

export interface IOrgMembership extends Document {
  userId: string;
  organizationId: string;
  email?: string;
  roleId?: string;
  role: string;
  department?: string;
  status: string;
  invitedBy?: string;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  invitedAt?: Date;
  joinedAt?: Date;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const OrgMembershipSchema = new Schema<IOrgMembership>(
  {
    userId: { type: String, default: null, index: true },
    organizationId: { type: String, required: true, index: true },
    email: { type: String, default: null },
    roleId: { type: String, default: null },
    role: {
      type: String,
      enum: ['owner', 'admin', 'hr', 'manager', 'developer', 'designer', 'employee', 'member', 'viewer'],
      default: 'employee',
    },
    department: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'pending', 'invited', 'deactivated', 'removed', 'suspended'],
      default: 'active',
    },
    invitedBy: { type: String, default: null },
    inviteToken: { type: String, default: null },
    inviteExpiresAt: { type: Date, default: null },
    invitedAt: { type: Date, default: null },
    joinedAt: { type: Date, default: null },
    deactivatedAt: { type: Date, default: null },
    deactivatedBy: { type: String, default: null },
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
OrgMembershipSchema.index(
  { inviteToken: 1 },
  { sparse: true },
);
OrgMembershipSchema.index({ organizationId: 1, status: 1 });
