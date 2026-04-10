import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUser } from './schemas/user.schema';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectModel('User') private userModel: Model<IUser>,
  ) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userModel.findById(userId).select('-password -otp -otpExpiresAt').lean();
    if (!user) throw new NotFoundException('User not found');

    const exportedAt = new Date().toISOString();
    return {
      metadata: {
        exportedAt,
        gdprArticles: ['Article 15 - Right of access', 'Article 20 - Data portability'],
        retentionNote: 'This data is retained per your organization\'s policy. For deletion, use /gdpr/delete-request',
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
      note: 'For HR data (attendance, leave, payroll), contact your HR administrator or use the HR data export endpoint. This export covers only your authentication identity.',
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
