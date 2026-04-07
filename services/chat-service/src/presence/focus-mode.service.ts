import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUserPresence } from './schemas/user-presence.schema';

/**
 * E3 7.3: Focus Mode — goes beyond DND.
 * - Hides unread badge completely
 * - Only shows notifications from priority contacts
 * - Auto-sets "Focusing" status with custom duration
 * - On exit: shows digest of what was missed
 */
@Injectable()
export class FocusModeService {
  private readonly logger = new Logger(FocusModeService.name);

  constructor(
    @InjectModel('UserPresence') private presenceModel: Model<IUserPresence>,
    @InjectModel('Message') private messageModel: Model<any>,
  ) {}

  async enableFocusMode(userId: string, organizationId: string, durationMinutes: number, priorityContactIds: string[] = []) {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    const focusData = {
      enabled: true,
      startedAt: new Date(),
      expiresAt,
      priorityContactIds,
      messagesAtStart: await this.getUnreadSnapshot(userId, organizationId),
    };

    await this.presenceModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: { status: 'dnd', customText: 'Focusing', customStatusExpiresAt: expiresAt, focusMode: focusData } },
      { upsert: true },
    );

    this.logger.log(`Focus mode enabled for ${userId} (${durationMinutes}min)`);
    return { enabled: true, expiresAt };
  }

  async disableFocusMode(userId: string, organizationId: string) {
    const presence = await this.presenceModel.findOne({ userId, organizationId }).lean() as any;
    const focusData = presence?.focusMode;

    await this.presenceModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: { status: 'online', customText: null, customStatusExpiresAt: null, focusMode: null } },
    );

    // Generate digest of what was missed
    if (focusData?.startedAt) {
      return this.generateFocusDigest(userId, organizationId, new Date(focusData.startedAt));
    }

    return { enabled: false, digest: null };
  }

  async getFocusStatus(userId: string, organizationId: string) {
    const presence = await this.presenceModel.findOne({ userId, organizationId }).lean() as any;
    return {
      enabled: !!presence?.focusMode?.enabled,
      expiresAt: presence?.focusMode?.expiresAt || null,
      priorityContactIds: presence?.focusMode?.priorityContactIds || [],
    };
  }

  private async getUnreadSnapshot(userId: string, organizationId: string): Promise<number> {
    // M-018: Scope unread count to organization via conversation lookup
    const orgConversationIds = await this.presenceModel.db
      .collection('conversations')
      .distinct('_id', { organizationId, 'participants.userId': userId, isDeleted: false });

    if (orgConversationIds.length === 0) return 0;

    return this.messageModel.countDocuments({
      conversationId: { $in: orgConversationIds.map((id: any) => id.toString()) },
      senderId: { $ne: userId },
      isDeleted: false,
    });
  }

  private async generateFocusDigest(userId: string, organizationId: string, since: Date) {
    // M-018: Add org scope filter to digest queries via conversation membership
    const orgConversationIds = await this.presenceModel.db
      .collection('conversations')
      .distinct('_id', { organizationId, 'participants.userId': userId, isDeleted: false });

    const convFilter = orgConversationIds.length > 0
      ? { conversationId: { $in: orgConversationIds.map((id: any) => id.toString()) } }
      : { conversationId: { $in: [] as string[] } };

    const newMessages = await this.messageModel.countDocuments({
      ...convFilter,
      senderId: { $ne: userId },
      createdAt: { $gte: since },
      isDeleted: false,
    });

    const mentions = await this.messageModel.countDocuments({
      ...convFilter,
      'mentions.targetId': userId,
      createdAt: { $gte: since },
      isDeleted: false,
    });

    return {
      enabled: false,
      digest: {
        period: { from: since, to: new Date() },
        newMessages,
        mentions,
        summary: `While you were focusing: ${newMessages} new messages, ${mentions} @mentions`,
      },
    };
  }
}
