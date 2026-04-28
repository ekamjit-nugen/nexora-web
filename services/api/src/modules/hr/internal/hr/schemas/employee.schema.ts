import { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  organizationId?: string;
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
  departmentId?: string;
  designationId?: string;
  teamId?: string;
  reportingManagerId?: string;
  employmentType: string;
  joiningDate: Date;
  probationEndDate?: Date;
  confirmationDate?: Date;
  exitDate?: Date;
  exitReason?: string;
  location?: string;
  timezone?: string;
  skills: string[];
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  // Permanent address — separate from `address` (which is the current
  // residential address). Employees can self-edit both; admins never
  // override these without reason. Useful for address proof / I9-type
  // verification and tax forms where ordinary residence matters.
  permanentAddress?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  // Personal email for post-exit communication (offer/relieving letters
  // etc. still go here after company email is deactivated). Employee-owned
  // field — self-editable.
  personalEmail?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
  };
  // Pending bank-details change awaiting admin approval. Bank detail edits
  // are NOT applied directly from self-service (too easy to redirect
  // payouts with a phished session). Employee submits → lands here →
  // admin reviews from the approval queue → approve merges into
  // `bankDetails` or reject drops it. Only one pending change allowed
  // at a time; resubmit overrides the prior pending.
  pendingBankChange?: {
    bankDetails: {
      bankName: string;
      accountNumber: string;
      ifsc: string;
      accountHolder: string;
    };
    submittedAt: Date;
    submittedBy: string;       // auth userId of the submitter
    reason?: string;
  } | null;
  // Audit of approved/rejected bank changes. Kept on-document because
  // bank changes are low-frequency per employee (typically <5 in a
  // career). Cap at the last 20 via $slice on push. Rejected entries
  // are not logged here — they're in the central EmployeeProfileAudit.
  bankChangeHistory?: Array<{
    bankDetails: {
      bankName: string;
      accountNumber: string;
      ifsc: string;
      accountHolder: string;
    };
    submittedAt: Date;
    submittedBy: string;
    approvedAt: Date;
    approvedBy: string;
  }>;
  // Statutory identifiers — required for:
  //   • PF ECR filing with EPFO (needs UAN + PF account)
  //   • Form 16 / TDS filing with Income Tax Dept (needs PAN)
  //   • ESI returns (needs ESIC number)
  //   • Payslip PDF compliance header
  // All optional on the schema because (a) new hires may not have a UAN
  // until their first PF contribution month, (b) interns / probationers
  // may not be enrolled in ESI, (c) non-Indian employees won't have PAN.
  // Format validation is deliberately light here — the directory edit UI
  // does client-side checks but we don't want to block a legit edge case
  // (e.g. new UAN format if EPFO changes it) from being saved.
  pan?: string;          // 10-char alphanumeric, e.g. ABCDE1234F
  uan?: string;          // 12-digit Universal Account Number for PF
  pfAccountNumber?: string; // Legacy member-id style (pre-UAN), or regional code
  esiNumber?: string;    // 10-digit ESIC Insurance Number
  documents: Array<{
    type: string;
    url: string;
    uploadedAt: Date;
    verified: boolean;
  }>;
  status: string;
  // Captured at termination time so Reactivate can restore the real prior
  // state (e.g. someone terminated while still `invited` goes back to
  // `invited`, not `active`). Populated automatically on any status → exited
  // transition in the update path.
  previousStatus?: string;
  isActive: boolean;
  isDeleted: boolean;
  policyIds?: string[];
  deletedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EmployeeSchema = new Schema<IEmployee>(
  {
    organizationId: { type: String, default: null, index: true },
    // Bug #3 (P1) consequence: previously `userId` and `email` were GLOBALLY
    // unique, which blocked a single user from being an employee in multiple
    // tenants — the cross-org invite-accept failure observed as "Bob missing
    // from Beta directory" was a downstream symptom of this. Uniqueness is
    // now scoped to (organizationId, userId) and (organizationId, email) via
    // the compound indexes at the bottom of the file.
    userId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    avatar: { type: String, default: null },
    phone: { type: String, default: null },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
    departmentId: { type: String, default: null, index: true },
    designationId: { type: String, default: null },
    teamId: { type: String, default: null },
    reportingManagerId: { type: String, default: null, index: true },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      default: 'full_time',
    },
    joiningDate: { type: Date, required: true },
    probationEndDate: { type: Date, default: null },
    confirmationDate: { type: Date, default: null },
    exitDate: { type: Date, default: null },
    exitReason: { type: String, default: null },
    location: { type: String, default: null },
    timezone: { type: String, default: 'Asia/Kolkata' },
    skills: [{ type: String }],
    emergencyContact: {
      name: String,
      relation: String,
      phone: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zip: String,
    },
    permanentAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      zip: String,
    },
    personalEmail: { type: String, default: null, lowercase: true, trim: true },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed', null],
      default: null,
    },
    bloodGroup: {
      type: String,
      // Standard ABO/Rh groups plus null. Kept permissive enum — some
      // regional records use "O Positive" etc., but standardising to
      // short codes keeps exports consistent.
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
      default: null,
    },
    bankDetails: {
      bankName: String,
      accountNumber: String,
      ifsc: String,
      accountHolder: String,
    },
    pendingBankChange: {
      type: {
        bankDetails: {
          bankName: String,
          accountNumber: String,
          ifsc: String,
          accountHolder: String,
        },
        submittedAt: Date,
        submittedBy: String,
        reason: String,
      },
      default: null,
    },
    bankChangeHistory: {
      type: [
        {
          bankDetails: {
            bankName: String,
            accountNumber: String,
            ifsc: String,
            accountHolder: String,
          },
          submittedAt: Date,
          submittedBy: String,
          approvedAt: Date,
          approvedBy: String,
        },
      ],
      default: [],
    },
    // Statutory identifiers (see interface comment). Stored as-typed, the
    // sensitive ones (PAN + bank account) are masked by the payslip
    // generator before rendering; raw values only ever leave the DB for
    // admin directory reads.
    pan: { type: String, default: null, trim: true, uppercase: true },
    uan: { type: String, default: null, trim: true },
    pfAccountNumber: { type: String, default: null, trim: true },
    esiNumber: { type: String, default: null, trim: true },
    documents: [
      {
        type: { type: String },
        url: String,
        uploadedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
      },
    ],
    // Status is validated dynamically against the per-org EmployeeStatus catalog
    // (see HrService.ensureEmployeeStatusValid). Kept as a plain string here so
    // orgs can define custom statuses without a schema migration.
    status: {
      type: String,
      // No `enum` here — see the doc comment above (status is validated
      // dynamically against the per-org EmployeeStatus catalog so orgs can
      // define custom statuses without a schema migration). Notable values
      // include `declined` (invitee explicitly rejected the org invite —
      // keeps the audit trail visible to admins instead of silently
      // reverting to "invited") and the lifecycle states active/on_notice/
      // exited/on_leave/probation.
      default: 'active',
    },
    // See interface comment — set by the update path when a record is
    // transitioned to `exited` so reactivation can restore the true prior
    // state instead of defaulting to `active`.
    previousStatus: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    policyIds: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

EmployeeSchema.index({ firstName: 'text', lastName: 'text', email: 'text', skills: 'text' });
EmployeeSchema.index({ isDeleted: 1, isActive: 1 });
EmployeeSchema.index({ departmentId: 1, status: 1 });
// Bug #3 — tenant-scoped uniqueness: one auth user / one email can appear
// once per organisation, but legitimately in multiple organisations.
EmployeeSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
EmployeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });
