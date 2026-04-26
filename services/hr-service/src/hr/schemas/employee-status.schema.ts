import { Schema, Document } from 'mongoose';

export interface IEmployeeStatus extends Document {
  organizationId?: string;
  value: string;      // canonical slug, e.g. 'active', 'on_leave' — stored on Employee.status
  label: string;      // human-readable, e.g. 'Active', 'On Leave'
  color?: string;     // optional hex or semantic key (e.g. 'emerald', '#10b981')
  description?: string;
  order: number;      // display order in dropdowns
  isSystem: boolean;  // defaults cannot be deleted; can be renamed/reordered
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EmployeeStatusSchema = new Schema<IEmployeeStatus>(
  {
    organizationId: { type: String, default: null, index: true },
    value: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
    },
    label: { type: String, required: true, trim: true },
    color: { type: String, default: null },
    description: { type: String, default: null },
    order: { type: Number, default: 0 },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

// One (orgId, value) per org; different orgs can reuse the same slug.
EmployeeStatusSchema.index(
  { organizationId: 1, value: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
EmployeeStatusSchema.index({ organizationId: 1, order: 1 });

// Factory defaults — seeded per org on first access. Keep in sync with the
// legacy Employee.status enum in employee.schema.ts until that enum is retired.
export const DEFAULT_EMPLOYEE_STATUSES: Array<
  Pick<IEmployeeStatus, 'value' | 'label' | 'color' | 'order' | 'description'>
> = [
  { value: 'active', label: 'Active', color: 'emerald', order: 10, description: 'Currently employed' },
  { value: 'invited', label: 'Invited', color: 'amber', order: 20, description: 'Invite sent, not yet accepted' },
  { value: 'pending', label: 'Pending', color: 'amber', order: 30, description: 'Awaiting approval' },
  { value: 'probation', label: 'Probation', color: 'violet', order: 40, description: 'In probation period' },
  { value: 'on_leave', label: 'On Leave', color: 'blue', order: 50, description: 'On approved leave' },
  { value: 'on_notice', label: 'On Notice', color: 'orange', order: 60, description: 'Serving notice period' },
  { value: 'exited', label: 'Exited', color: 'red', order: 70, description: 'No longer with the organization' },
];
