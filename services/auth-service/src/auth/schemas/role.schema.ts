import { Schema, Document } from 'mongoose';

export interface IPermission {
  resource: string;
  actions: string[];
}

export interface IRole extends Document {
  name: string;
  displayName: string;
  description: string;
  permissions: IPermission[];
  color: string;
  organizationId?: string;
  isSystem: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PermissionSchema = new Schema(
  {
    resource: {
      type: String,
      required: true,
      enum: [
        'dashboard',
        'employees',
        'attendance',
        'leaves',
        'projects',
        'tasks',
        'departments',
        'roles',
        'policies',
        'reports',
        'invoices',
        'expenses',
        'clients',
        'settings',
      ],
    },
    actions: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) =>
          v.every((a) =>
            ['view', 'create', 'edit', 'delete', 'export', 'assign'].includes(a),
          ),
        message: 'Invalid action. Allowed: view, create, edit, delete, export, assign',
      },
    },
  },
  { _id: false },
);

export const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    permissions: {
      type: [PermissionSchema],
      default: [],
    },
    color: {
      type: String,
      default: '#475569',
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    organizationId: {
      type: String,
      default: null,
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
RoleSchema.index({ name: 1, organizationId: 1 }, { unique: true });
RoleSchema.index({ organizationId: 1, isDeleted: 1 });
RoleSchema.index({ isActive: 1 });
RoleSchema.index({ isDeleted: 1 });

/*
 * When: Role document is queried or created
 * if: name field is provided
 * then: ensure uniqueness and store as lowercase
 */
