import { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// BugReport — cross-tenant, platform-level bug + feedback ticket.
//
// Lives in the auth-service because reports are platform-scoped (any user
// from any tenant can file one) and surface to the super-admin dashboard
// alongside the rest of the platform-admin views. Distinct from the
// org-scoped helpdesk-service tickets which are tenant-internal helpdesk
// flows (employee → org admin).
//
// Lifecycle:
//   open → triaged → in_progress → resolved → closed
//   open → won't_fix
//   open → duplicate
//
// On create the auth-service emails platform@nexora.io with the full
// payload so the platform team gets immediate signal even without
// opening the dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export interface IBugReport extends Document {
  // ── Reporter context ──
  reporterUserId: string;          // auth user._id of the reporter
  reporterEmail: string;            // duplicated for offline triage / search
  reporterName?: string;            // first + last for the email subject
  organizationId?: string | null;   // tenant the reporter was in (nullable for platform admins)
  organizationName?: string;        // duplicated to avoid a join during admin listing

  // ── Ticket content ──
  title: string;
  description: string;
  category: 'bug' | 'feature' | 'feedback' | 'security' | 'data';
  severity: 'low' | 'medium' | 'high' | 'critical';
  // Free-form path the user was on when they hit the issue ("/payroll/runs",
  // "Mobile · Time tab", etc.). Optional but very useful for reproduction.
  area?: string;

  // ── Diagnostic snapshot ──
  appVersion?: string;              // Mobile app version OR git sha for web
  platform?: 'web' | 'ios' | 'android' | 'unknown';
  userAgent?: string;
  url?: string;                     // For web: window.location.href at submit

  // ── Workflow ──
  status: 'open' | 'triaged' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix' | 'duplicate';
  // Internal notes from the platform team — never shown to the reporter.
  // Stored as a thread so we can show progress on the admin detail page.
  internalNotes: Array<{
    authorId: string;
    authorEmail: string;
    note: string;
    createdAt: Date;
  }>;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;

  // ── Email tracking ──
  // Set once the auth-service successfully ships the notification to
  // platform@nexora.io. If null, the notification failed and an admin
  // can re-trigger via a "resend" button (future).
  notificationSentAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const BugReportSchema = new Schema<IBugReport>(
  {
    reporterUserId: { type: String, required: true, index: true },
    reporterEmail: { type: String, required: true, lowercase: true, trim: true },
    reporterName: { type: String, default: null },
    organizationId: { type: String, default: null, index: true },
    organizationName: { type: String, default: null },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    category: {
      type: String,
      enum: ['bug', 'feature', 'feedback', 'security', 'data'],
      default: 'bug',
      index: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    area: { type: String, default: null },

    appVersion: { type: String, default: null },
    platform: {
      type: String,
      enum: ['web', 'ios', 'android', 'unknown'],
      default: 'unknown',
    },
    userAgent: { type: String, default: null },
    url: { type: String, default: null },

    status: {
      type: String,
      enum: ['open', 'triaged', 'in_progress', 'resolved', 'closed', 'wont_fix', 'duplicate'],
      default: 'open',
      index: true,
    },
    internalNotes: [
      {
        authorId: { type: String, required: true },
        authorEmail: { type: String, required: true },
        note: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    resolution: { type: String, default: null },

    notificationSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

BugReportSchema.index({ status: 1, createdAt: -1 });
BugReportSchema.index({ category: 1, severity: 1 });
