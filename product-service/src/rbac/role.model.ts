import { Schema, Document } from 'mongoose';

export interface IPermission {
  resource: string;
  action: 'read' | 'create' | 'update' | 'delete' | 'execute';
  fields?: string[];
  conditions?: Record<string, any>;
}

export interface IRole extends Document {
  productId: string;
  name: string;
  description: string;
  permissions: IPermission[];
  parentRoles: string[];
  isSystem: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoleAssignment extends Document {
  productId: string;
  userId: string;
  roleId: string;
  assignedAt: Date;
  expiresAt?: Date;
  grantedBy: string;
  isActive: boolean;
  createdAt: Date;
}

export const PermissionSchema = new Schema({
  resource: String,
  action: { type: String, enum: ['read', 'create', 'update', 'delete', 'execute'] },
  fields: [String],
  conditions: Schema.Types.Mixed,
});

export const RoleSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    permissions: [PermissionSchema],
    parentRoles: [String],
    isSystem: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const RoleAssignmentSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    roleId: { type: String, required: true },
    assignedAt: Date,
    expiresAt: Date,
    grantedBy: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

RoleSchema.index({ productId: 1, name: 1 });
RoleAssignmentSchema.index({ productId: 1, userId: 1 });
RoleAssignmentSchema.index({ roleId: 1 });
