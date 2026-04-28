import { Schema, Document } from 'mongoose';

/**
 * Invoice lifecycle notifications — written by InvoiceLifecycleService
 * during its daily scan. Notifications are scoped per recipient (each
 * invoice's `createdBy` user gets a row), persisted, and surfaced in
 * the in-app dropdown on the Invoices page until marked read.
 *
 * Why a dedicated collection (instead of using task-service's existing
 * `notifications`):
 *   • The task-service notification schema requires `projectId` (so the
 *     model rejects an invoice notification with no project context).
 *   • Keeping invoice notifications inside hr-service avoids cross-DB
 *     joins and means the lifecycle cron can write notifications in the
 *     same Mongoose connection it's already using.
 *   • A future consolidation into a unified notification-service is
 *     straightforward — every doc here has enough denormalised context
 *     (invoiceNumber, clientId snapshot at write-time) that we can
 *     migrate it without a follow-up join.
 *
 * Idempotency: `scanKey` is a unique compound key
 *   `${YYYY-MM-DD}|${invoiceId}|${type}|${userId}`
 * The cron uses upsert on this key, so re-running the same scan day
 * doesn't create duplicate rows. The format is stable across cron runs
 * within a single calendar day, so a partial scan that resumed will
 * idempotently fill in what's missing without doubling up.
 */
export interface IInvoiceNotification extends Document {
  organizationId: string;
  userId: string;             // recipient (invoice creator for v1)
  invoiceId: string;
  invoiceNumber: string;      // denormalised for display without a join
  clientId?: string;          // denormalised
  type: 'invoice_upcoming' | 'invoice_due_today' | 'invoice_overdue' | 'invoice_overdue_repeat';
  title: string;
  message: string;
  amount?: number;            // denormalised total for the row
  currency?: string;
  daysUntilDue?: number;      // negative ⇒ overdue (denormalised at write time)
  read: boolean;
  readAt?: Date | null;
  actionUrl: string;
  scanKey: string;
  createdAt: Date;
}

export const InvoiceNotificationSchema = new Schema<IInvoiceNotification>(
  {
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    invoiceId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    clientId: { type: String, default: null },
    type: {
      type: String,
      enum: ['invoice_upcoming', 'invoice_due_today', 'invoice_overdue', 'invoice_overdue_repeat'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    amount: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    daysUntilDue: { type: Number, default: null },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    actionUrl: { type: String, required: true },
    scanKey: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: false },
);

// Bell-style query: "show me my unread notifications for this org, newest first."
InvoiceNotificationSchema.index({ organizationId: 1, userId: 1, read: 1, createdAt: -1 });
// Idempotency key — the cron upserts on this. Unique index ensures one row
// per (day, invoice, type, recipient).
InvoiceNotificationSchema.index({ scanKey: 1 }, { unique: true });
