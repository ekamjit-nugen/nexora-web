import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUser } from './schemas/user.schema';

interface ServiceSlice {
  service: string;
  status: 'ok' | 'unavailable' | 'not_implemented' | 'error';
  data?: unknown;
  error?: string;
}

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectModel('User') private userModel: Model<IUser>,
  ) {}

  /**
   * Fan out to a sibling service's internal GDPR export endpoint.
   *
   * Protocol: `GET {baseUrl}/internal/gdpr-export?userId=X` with header
   * `X-Internal-Token: {INTERNAL_SERVICE_TOKEN}`. Each service is
   * responsible for returning its own slice of the user's data, or a
   * 404/501 if it has no data for the user.
   */
  private async fetchServiceSlice(
    service: string,
    baseUrl: string | undefined,
    userId: string,
  ): Promise<ServiceSlice> {
    if (!baseUrl) {
      return { service, status: 'unavailable', error: 'Service URL not configured' };
    }
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!internalToken) {
      return { service, status: 'unavailable', error: 'INTERNAL_SERVICE_TOKEN not configured' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/internal/gdpr-export?userId=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            'X-Internal-Token': internalToken,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);
      if (res.status === 404 || res.status === 501) {
        return { service, status: 'not_implemented' };
      }
      if (!res.ok) {
        return { service, status: 'error', error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { service, status: 'ok', data };
    } catch (err: any) {
      clearTimeout(timeout);
      return { service, status: 'error', error: err.message || 'Unknown error' };
    }
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userModel.findById(userId).select('-password -otp -otpExpiresAt').lean();
    if (!user) throw new NotFoundException('User not found');

    const exportedAt = new Date().toISOString();

    // Fan out to sibling services in parallel. Each slice fails gracefully
    // so one down service never blocks an entire GDPR export — the customer
    // sees exactly which slices are pending and can re-request later.
    const [hrSlice, chatSlice, taskSlice, payrollSlice, notificationSlice, callingSlice] =
      await Promise.all([
        this.fetchServiceSlice('hr', process.env.HR_SERVICE_URL, userId),
        this.fetchServiceSlice('chat', process.env.CHAT_SERVICE_URL, userId),
        this.fetchServiceSlice('task', process.env.TASK_SERVICE_URL, userId),
        this.fetchServiceSlice('payroll', process.env.PAYROLL_SERVICE_URL, userId),
        this.fetchServiceSlice('notification', process.env.NOTIFICATION_SERVICE_URL, userId),
        this.fetchServiceSlice('calling', process.env.CALLING_SERVICE_URL, userId),
      ]);

    const slices = [hrSlice, chatSlice, taskSlice, payrollSlice, notificationSlice, callingSlice];
    const pending = slices.filter((s) => s.status !== 'ok').map((s) => ({
      service: s.service,
      status: s.status,
      reason: s.error,
    }));

    return {
      metadata: {
        exportedAt,
        gdprArticles: [
          'Article 15 - Right of access',
          'Article 20 - Data portability',
        ],
        retentionNote:
          "This data is retained per your organization's policy. For deletion, use /gdpr/delete-request",
        pendingSlices: pending,
        coverageNote:
          pending.length === 0
            ? 'All service slices included.'
            : `${pending.length} of ${slices.length} service slice(s) could not be retrieved. Re-request the export after the affected services are available.`,
      },
      personalInformation: {
        id: user._id?.toString(),
        email: user.email,
        firstName: (user as any).firstName,
        lastName: (user as any).lastName,
        phone: (user as any).phone,
        createdAt: (user as any).createdAt,
        updatedAt: (user as any).updatedAt,
        lastLoginAt: (user as any).lastLoginAt,
      },
      authentication: {
        organizations: (user as any).organizations || [],
        roles: (user as any).roles || [],
        mfaEnabled: (user as any).mfaEnabled || false,
        isActive: (user as any).isActive,
      },
      activityMetadata: {
        accountCreated: (user as any).createdAt,
        lastLogin: (user as any).lastLoginAt,
        loginAttempts: (user as any).loginAttempts || 0,
      },
      hr: hrSlice.status === 'ok' ? hrSlice.data : null,
      chat: chatSlice.status === 'ok' ? chatSlice.data : null,
      tasks: taskSlice.status === 'ok' ? taskSlice.data : null,
      payroll: payrollSlice.status === 'ok' ? payrollSlice.data : null,
      notifications: notificationSlice.status === 'ok' ? notificationSlice.data : null,
      calls: callingSlice.status === 'ok' ? callingSlice.data : null,
    };
  }

  async requestDeletion(userId: string, reason?: string): Promise<{ deletionScheduledAt: Date; userId: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    (user as any).gdprDeletionRequested = true;
    (user as any).gdprDeletionRequestedAt = new Date();
    (user as any).gdprDeletionScheduledAt = scheduledAt;
    (user as any).gdprDeletionReason = reason || 'User-requested deletion (GDPR Article 17)';
    (user as any).isActive = false;
    await user.save();

    this.logger.warn(`GDPR deletion requested for user ${userId}. Scheduled for ${scheduledAt.toISOString()}`);

    return { deletionScheduledAt: scheduledAt, userId };
  }

  async getDeletionStatus(userId: string) {
    const user = await this.userModel.findById(userId).select('gdprDeletionRequested gdprDeletionRequestedAt gdprDeletionScheduledAt gdprDeletionReason').lean();
    if (!user) throw new NotFoundException('User not found');
    return {
      requested: (user as any).gdprDeletionRequested || false,
      requestedAt: (user as any).gdprDeletionRequestedAt || null,
      scheduledAt: (user as any).gdprDeletionScheduledAt || null,
      reason: (user as any).gdprDeletionReason || null,
    };
  }

  async cancelDeletion(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    (user as any).gdprDeletionRequested = false;
    (user as any).gdprDeletionRequestedAt = null;
    (user as any).gdprDeletionScheduledAt = null;
    (user as any).gdprDeletionReason = null;
    (user as any).isActive = true;
    await user.save();
    this.logger.log(`GDPR deletion request cancelled for user ${userId}`);
  }
}
