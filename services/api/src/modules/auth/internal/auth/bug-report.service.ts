import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { IBugReport } from './schemas/bug-report.schema';
import { IUser } from './schemas/user.schema';

// Where every new ticket gets shipped. Hard-coded here because the support
// queue address shouldn't be tenant-configurable (this is the platform
// team's address, not a tenant admin one).
const PLATFORM_SUPPORT_EMAIL = 'platform@nexora.io';

@Injectable()
export class BugReportService {
  private readonly logger = new Logger(BugReportService.name);
  private readonly mailTransporter: nodemailer.Transporter;

  constructor(
    @InjectModel('BugReport', 'nexora_auth') private bugReportModel: Model<IBugReport>,
    @InjectModel('User', 'nexora_auth') private userModel: Model<IUser>,
  ) {
    // Same transporter pattern the OTP service uses — keeps dev wiring
    // consistent (MailHog locally, real SMTP in prod).
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mailhog',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      ignoreTLS: true,
    });
  }

  // ─── Create ─────────────────────────────────────────────────────────
  async create(
    reporterUserId: string,
    organizationId: string | null,
    payload: {
      title: string;
      description: string;
      category?: string;
      severity?: string;
      area?: string;
      appVersion?: string;
      platform?: string;
      userAgent?: string;
      url?: string;
    },
  ): Promise<IBugReport> {
    // Pull the reporter's user record so the email + admin UI can show
    // who filed it without needing a second lookup.
    const reporter = await this.userModel.findById(reporterUserId).lean();
    const reporterEmail = (reporter as any)?.email || 'unknown';
    const reporterName = reporter
      ? `${(reporter as any).firstName || ''} ${(reporter as any).lastName || ''}`.trim() || null
      : null;

    // Also pull the org name (best-effort) — gives the support inbox an
    // at-a-glance "which tenant" without an extra hop.
    let organizationName: string | null = null;
    if (organizationId) {
      try {
        const org = await this.bugReportModel.db
          .collection('organizations')
          .findOne({ _id: organizationId as any });
        organizationName = (org as any)?.name || null;
      } catch {
        // ignore — org name is just a nicety
      }
    }

    const report = new this.bugReportModel({
      reporterUserId,
      reporterEmail,
      reporterName,
      organizationId,
      organizationName,
      title: payload.title,
      description: payload.description,
      category: payload.category || 'bug',
      severity: payload.severity || 'medium',
      area: payload.area,
      appVersion: payload.appVersion,
      platform: (payload.platform as any) || 'unknown',
      userAgent: payload.userAgent,
      url: payload.url,
    });

    await report.save();
    this.logger.log(
      `BugReport created id=${report._id} by=${reporterEmail} severity=${report.severity} category=${report.category}`,
    );

    // Fire notification — do NOT await failure. If the email fails the
    // ticket is still saved and the admin UI can re-trigger.
    this.sendSupportEmail(report).catch((err) =>
      this.logger.warn(`Support-email dispatch failed for report ${report._id}: ${err?.message}`),
    );

    return report;
  }

  // ─── Notification ───────────────────────────────────────────────────
  private async sendSupportEmail(report: IBugReport): Promise<void> {
    const sevColor = {
      low: '#94A3B8',
      medium: '#2E86C1',
      high: '#D97706',
      critical: '#DC2626',
    }[report.severity] || '#2E86C1';
    const sevLabel = report.severity.toUpperCase();
    const catLabel = report.category[0].toUpperCase() + report.category.slice(1);

    const subject = `[Nexora ${sevLabel}] ${catLabel}: ${report.title}`;

    const reporterLabel = report.reporterName
      ? `${report.reporterName} (${report.reporterEmail})`
      : report.reporterEmail;
    const orgLabel = report.organizationName
      ? `${report.organizationName} (${report.organizationId})`
      : report.organizationId || '—';

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:${sevColor};padding:18px 28px;color:#FFFFFF;">
            <div style="font-size:11px;letter-spacing:1.2px;font-weight:700;opacity:0.9;text-transform:uppercase;">${sevLabel} · ${catLabel}</div>
            <div style="font-size:18px;font-weight:700;margin-top:4px;line-height:1.3;">${escapeHtml(report.title)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;color:#0F172A;font-size:14px;line-height:1.6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr><td style="padding:6px 0;width:120px;color:#64748B;">Reporter</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(reporterLabel)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748B;">Organisation</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(orgLabel)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748B;">Platform</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(report.platform || 'unknown')}${report.appVersion ? ' · v' + escapeHtml(report.appVersion) : ''}</td></tr>
              ${report.area ? `<tr><td style="padding:6px 0;color:#64748B;">Area</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(report.area)}</td></tr>` : ''}
              ${report.url ? `<tr><td style="padding:6px 0;color:#64748B;">URL</td><td style="padding:6px 0;font-weight:600;font-size:12px;color:#475569;">${escapeHtml(report.url)}</td></tr>` : ''}
              <tr><td style="padding:6px 0;color:#64748B;">Ticket ID</td><td style="padding:6px 0;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;color:#475569;">${report._id}</td></tr>
            </table>

            <div style="margin-top:20px;padding:14px 16px;background:#F8FAFC;border-radius:8px;border-left:3px solid ${sevColor};">
              <div style="font-size:11px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Description</div>
              <div style="font-size:14px;color:#0F172A;white-space:pre-wrap;line-height:1.55;">${escapeHtml(report.description)}</div>
            </div>

            ${report.userAgent ? `<div style="margin-top:18px;font-size:11px;color:#94A3B8;">User-Agent: ${escapeHtml(report.userAgent)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;text-align:center;">
            View &amp; manage in Nexora platform admin → Bug Reports
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const text = [
      `${sevLabel} · ${catLabel}`,
      report.title,
      '',
      `Reporter: ${reporterLabel}`,
      `Organisation: ${orgLabel}`,
      `Platform: ${report.platform}${report.appVersion ? ' · v' + report.appVersion : ''}`,
      report.area ? `Area: ${report.area}` : '',
      report.url ? `URL: ${report.url}` : '',
      `Ticket ID: ${report._id}`,
      '',
      '── Description ──',
      report.description,
      '',
      report.userAgent ? `User-Agent: ${report.userAgent}` : '',
    ].filter(Boolean).join('\n');

    await this.mailTransporter.sendMail({
      from: '"Nexora Support" <no-reply@nexora.io>',
      to: PLATFORM_SUPPORT_EMAIL,
      replyTo: report.reporterEmail,
      subject,
      text,
      html,
    });

    // Mark the notification as sent so we can show in the admin UI
    // whether the email actually went out (vs the ticket just sitting).
    await this.bugReportModel.updateOne(
      { _id: report._id },
      { $set: { notificationSentAt: new Date() } },
    );
    this.logger.log(`Support email dispatched for ${report._id} → ${PLATFORM_SUPPORT_EMAIL}`);
  }

  // ─── Reads ──────────────────────────────────────────────────────────
  async list(filters: { status?: string; severity?: string; category?: string; page?: number; limit?: number }) {
    const filter: any = {};
    if (filters.status) filter.status = filters.status;
    if (filters.severity) filter.severity = filters.severity;
    if (filters.category) filter.category = filters.category;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 30));
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.bugReportModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.bugReportModel.countDocuments(filter),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string): Promise<IBugReport> {
    const report = await this.bugReportModel.findById(id);
    if (!report) throw new NotFoundException('Bug report not found');
    return report;
  }

  // The reporter's own filed tickets — for a "my submissions" view in
  // the user-facing settings page.
  async listMine(reporterUserId: string) {
    return this.bugReportModel
      .find({ reporterUserId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  // ─── Updates (super admin only) ─────────────────────────────────────
  async updateStatus(
    id: string,
    adminUserId: string,
    adminEmail: string,
    update: { status?: string; resolution?: string; note?: string },
  ): Promise<IBugReport> {
    const report = await this.bugReportModel.findById(id);
    if (!report) throw new NotFoundException('Bug report not found');

    if (update.status) {
      report.status = update.status as any;
      // Auto-stamp resolved metadata when transitioning into a resolved state.
      if (['resolved', 'closed', 'wont_fix', 'duplicate'].includes(update.status)) {
        report.resolvedAt = report.resolvedAt || new Date();
        report.resolvedBy = adminUserId;
      }
    }
    if (update.resolution !== undefined) {
      report.resolution = update.resolution;
    }
    if (update.note && update.note.trim()) {
      report.internalNotes.push({
        authorId: adminUserId,
        authorEmail: adminEmail,
        note: update.note.trim(),
        createdAt: new Date(),
      } as any);
    }
    await report.save();
    return report;
  }

  // ─── Stats — for the platform-admin dashboard widget ────────────────
  async stats() {
    const all: any[] = await this.bugReportModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
        },
      },
    ]);
    return all[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, critical: 0, high: 0 };
  }
}

// HTML-escape user-supplied content before embedding in the email
// template. Nodemailer doesn't sanitise — we have to.
function escapeHtml(s: string): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
