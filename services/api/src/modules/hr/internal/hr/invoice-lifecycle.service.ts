import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { IInvoice } from './schemas/invoice.schema';
import { IInvoiceNotification } from './schemas/invoice-notification.schema';

/**
 * Daily lifecycle cron for invoices.
 *
 * What it does (once per day, plus a startup pass after a 30-second delay):
 *   1. Scans every non-deleted, non-paid, non-cancelled invoice.
 *   2. Computes a derived `lifecycleState` from `dueDate` vs today.
 *   3. Writes the new state + supporting fields back to the invoice.
 *   4. Auto-flips `status` from `sent` / `partially_paid` → `overdue`
 *      when the due date passes (status is otherwise admin-controlled).
 *   5. Emits an in-app notification to the invoice creator on three
 *      threshold events:
 *         • invoice_upcoming      — exactly 3 days before due
 *         • invoice_due_today     — on the due date itself
 *         • invoice_overdue       — first day past due (status flips)
 *         • invoice_overdue_repeat — every 7th day past due (weekly nudge)
 *      Each notification is upserted by a stable `scanKey` so the same
 *      threshold can't fire twice for the same invoice on the same day.
 *
 * Tenant gating: this service does NOT explicitly check the org's
 * `features.invoices.enabled` flag — orgs without invoicing simply
 * don't have invoice documents to scan, so the work self-skips. If
 * we later need a per-org "pause notifications" toggle, add it here.
 *
 * Manual trigger: call HrService.runInvoiceLifecycleScan() (exposed
 * via POST /api/v1/invoices/lifecycle/run for admins) for ad-hoc runs
 * — useful for end-to-end testing without waiting until 9am IST.
 */
@Injectable()
export class InvoiceLifecycleService {
  private readonly logger = new Logger(InvoiceLifecycleService.name);

  constructor(
    @InjectModel('Invoice', 'nexora_hr') private invoiceModel: Model<IInvoice>,
    @InjectModel('InvoiceNotification', 'nexora_hr') private notificationModel: Model<IInvoiceNotification>,
  ) {}

  /**
   * Runs every day at 03:30 UTC (~09:00 IST). Picked deliberately:
   * after typical end-of-day close, before most office workdays start,
   * giving Nugen admins a fresh dashboard the moment they open the app.
   */
  @Cron('30 3 * * *', { name: 'invoice-lifecycle-daily', timeZone: 'UTC' })
  async dailyScan() {
    this.logger.log('Starting scheduled invoice lifecycle scan');
    const result = await this.runScan();
    this.logger.log(
      `Lifecycle scan complete: ${result.scanned} scanned, ${result.updated} updated, ${result.notifications} notifications emitted`,
    );
  }

  /**
   * Idempotent core. Pure function of (today, every invoice) — re-running
   * during the same UTC day produces the same end-state and zero
   * additional notifications (scanKey enforces uniqueness on upsert).
   */
  async runScan(): Promise<{ scanned: number; updated: number; notifications: number }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);

    let scanned = 0;
    let updated = 0;
    let notifications = 0;

    // Stream the cursor — for orgs with thousands of invoices, loading
    // them all into memory would balloon RAM. The cron is not latency-
    // sensitive, so a streaming pass is the right tradeoff.
    const cursor = this.invoiceModel.find({
      isDeleted: { $ne: true },
      status: { $in: ['sent', 'partially_paid', 'overdue'] },
    }).cursor();

    for await (const inv of cursor) {
      scanned++;

      // Compute derived fields from the DTO truth (dueDate, amountPaid, total).
      const dueDate = new Date(inv.dueDate);
      dueDate.setUTCHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);

      const fullyPaid = (inv.amountPaid || 0) >= (inv.total || 0) && (inv.total || 0) > 0;

      let lifecycleState: IInvoice['lifecycleState'];
      let overdueDays = 0;
      if (fullyPaid) {
        lifecycleState = 'paid';
      } else if (daysUntilDue > 7) {
        lifecycleState = 'upcoming';
      } else if (daysUntilDue > 1) {
        lifecycleState = 'due_soon';
      } else if (daysUntilDue >= 0) {
        lifecycleState = 'due_today';
      } else {
        lifecycleState = 'overdue';
        overdueDays = -daysUntilDue;
      }

      // Build the patch. We only write if something actually changed —
      // saves churn on Mongoose change-streams and keeps the audit log
      // (when we add one) free of no-op rewrites.
      const patch: Record<string, any> = {
        lifecycleState,
        daysUntilDue,
        overdueDays,
        lastLifecycleScanAt: new Date(),
      };
      // Auto-flip status when an invoice crosses into overdue. We don't
      // un-flip it (an overdue invoice that gets a partial payment stays
      // 'overdue' — that's an explicit admin action via mark-paid).
      if (lifecycleState === 'overdue' && (inv.status === 'sent' || inv.status === 'partially_paid')) {
        patch.status = 'overdue';
      }
      // Flip status to 'paid' on full payment if the cron caught it
      // before the admin marked it manually (rare but defensible).
      if (lifecycleState === 'paid' && inv.status !== 'paid' && inv.status !== 'cancelled') {
        patch.status = 'paid';
      }

      const stateChanged = inv.lifecycleState !== lifecycleState
        || inv.overdueDays !== overdueDays
        || inv.daysUntilDue !== daysUntilDue
        || patch.status !== undefined;

      if (stateChanged) {
        await this.invoiceModel.updateOne({ _id: inv._id }, { $set: patch });
        updated++;
      }

      // ── Notification triggers ──
      // Each rule fires AT MOST once per (invoice, day, type) thanks
      // to the unique scanKey. The cron is safe to re-run within the
      // same day with no side effects.
      const triggers: Array<{ type: IInvoiceNotification['type']; title: string; message: string }> = [];
      const num = inv.invoiceNumber;
      const fmt = (n: number) => `${inv.currency || 'INR'} ${n.toLocaleString('en-IN')}`;

      if (lifecycleState === 'due_soon' && daysUntilDue === 3) {
        triggers.push({
          type: 'invoice_upcoming',
          title: `Invoice ${num} due in 3 days`,
          message: `${fmt(inv.total || 0)} from this invoice is due on ${dueDate.toISOString().slice(0, 10)}.`,
        });
      } else if (lifecycleState === 'due_today') {
        triggers.push({
          type: 'invoice_due_today',
          title: `Invoice ${num} ${daysUntilDue === 0 ? 'is due today' : 'is due tomorrow'}`,
          message: `${fmt(inv.total || 0)} ${daysUntilDue === 0 ? 'is due today' : 'is due tomorrow'} — consider sending a friendly reminder to the client.`,
        });
      } else if (lifecycleState === 'overdue' && overdueDays === 1) {
        triggers.push({
          type: 'invoice_overdue',
          title: `Invoice ${num} is now overdue`,
          message: `${fmt(inv.total || 0)} was due on ${dueDate.toISOString().slice(0, 10)}. The client has not paid yet.`,
        });
      } else if (lifecycleState === 'overdue' && overdueDays > 1 && overdueDays % 7 === 0) {
        triggers.push({
          type: 'invoice_overdue_repeat',
          title: `Invoice ${num} is ${overdueDays} days overdue`,
          message: `${fmt(inv.total || 0)} has been outstanding for ${overdueDays} days. Time for another nudge?`,
        });
      }

      if (triggers.length > 0 && inv.createdBy) {
        for (const t of triggers) {
          const scanKey = `${todayKey}|${inv._id}|${t.type}|${inv.createdBy}`;
          // upsert guarantees idempotency — second-call within the same
          // day on the same key is a no-op.
          const r = await this.notificationModel.updateOne(
            { scanKey },
            {
              $setOnInsert: {
                organizationId: inv.organizationId,
                userId: inv.createdBy,
                invoiceId: String(inv._id),
                invoiceNumber: inv.invoiceNumber,
                clientId: inv.clientId,
                type: t.type,
                title: t.title,
                message: t.message,
                amount: inv.total || 0,
                currency: inv.currency || 'INR',
                daysUntilDue,
                read: false,
                readAt: null,
                actionUrl: `/invoices/${inv._id}`,
                scanKey,
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );
          if (r.upsertedCount) notifications++;
        }
      }
    }

    return { scanned, updated, notifications };
  }

  // ── Notification CRUD (called from the controller) ──

  /**
   * List the calling user's invoice notifications, newest first. The
   * `unreadOnly` flag drives the bell-badge query (count of unread)
   * vs the dropdown body (last N regardless of read state). Cap of 50
   * is plenty — older notifications can be paginated later if anyone
   * actually wants the history.
   */
  async listNotifications(
    userId: string,
    orgId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ) {
    const filter: any = { organizationId: orgId, userId };
    if (opts.unreadOnly) filter.read = false;
    return this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(opts.limit || 50, 200))
      .lean();
  }

  async getUnreadCount(userId: string, orgId: string) {
    return this.notificationModel.countDocuments({
      organizationId: orgId,
      userId,
      read: false,
    });
  }

  async markRead(notificationId: string, userId: string, orgId: string) {
    // Scoped to the calling user — can't mark someone else's read.
    const r = await this.notificationModel.updateOne(
      { _id: notificationId, userId, organizationId: orgId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return { ok: r.modifiedCount > 0 };
  }

  async markAllRead(userId: string, orgId: string) {
    const r = await this.notificationModel.updateMany(
      { userId, organizationId: orgId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return { ok: true, count: r.modifiedCount };
  }

  // ── Lifecycle stats (powers the colored cards on the invoice page) ──

  async getLifecycleStats(orgId: string) {
    // Aggregation rather than 5 separate counts — single round-trip,
    // and the empty-bucket cells fill in client-side.
    const rows = await this.invoiceModel.aggregate([
      { $match: { organizationId: orgId, isDeleted: { $ne: true } } },
      { $group: { _id: '$lifecycleState', count: { $sum: 1 }, totalValue: { $sum: '$total' } } },
    ]);
    const buckets: Record<string, { count: number; totalValue: number }> = {
      upcoming:  { count: 0, totalValue: 0 },
      due_soon:  { count: 0, totalValue: 0 },
      due_today: { count: 0, totalValue: 0 },
      overdue:   { count: 0, totalValue: 0 },
      paid:      { count: 0, totalValue: 0 },
    };
    for (const r of rows) {
      if (r._id && buckets[r._id]) {
        buckets[r._id] = { count: r.count, totalValue: r.totalValue || 0 };
      }
    }
    return buckets;
  }
}
