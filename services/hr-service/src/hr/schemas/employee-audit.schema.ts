import { Schema, Document } from 'mongoose';

/**
 * Per-employee profile change audit.
 *
 * Every write to an employee record — admin PUT, self PATCH, bank-change
 * submit/approve/reject — lands here with a structured delta so HR can
 * answer "who changed this, when, and to what" without diffing payroll
 * runs. Separate collection (not on-document) because:
 *   • changes accumulate fast for long-tenure records
 *   • admin bulk updates (e.g. dept reshuffle) would bloat the employee doc
 *   • keeps the employee doc fast to fetch for read-heavy directory views
 *
 * `changes` is a list of {field, from, to} rather than a full before/after
 * snapshot — 99% of edits touch 1–3 fields, and the list format is both
 * query-friendly (find who last touched `bankDetails.accountNumber`) and
 * diff-viewer friendly in the UI.
 */
export interface IEmployeeProfileAudit extends Document {
  organizationId: string;
  employeeId: string;          // HR employee _id (ObjectId as string)
  actorUserId: string;         // auth userId of whoever made the change
  actorType: 'self' | 'admin'; // who authored the edit — used by the UI
                               // to badge self-service vs admin actions
  action: string;              // 'profile_update' | 'bank_change_submit'
                               // | 'bank_change_approve' | 'bank_change_reject'
                               // | 'bank_change_withdraw'
  changes: Array<{
    field: string;
    from: any;
    to: any;
  }>;
  reason?: string;             // admin reason on reject, employee reason on submit
  createdAt: Date;
}

export const EmployeeProfileAuditSchema = new Schema<IEmployeeProfileAudit>(
  {
    organizationId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    actorUserId: { type: String, required: true },
    actorType: { type: String, enum: ['self', 'admin'], required: true },
    action: { type: String, required: true, index: true },
    changes: [
      {
        field: { type: String, required: true },
        from: Schema.Types.Mixed,
        to: Schema.Types.Mixed,
      },
    ],
    reason: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Tenant-scoped timeline query: "show all edits for this employee, newest first"
EmployeeProfileAuditSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });
// Tenant-wide audit query: "who edited what in the last 30 days"
EmployeeProfileAuditSchema.index({ organizationId: 1, createdAt: -1 });
