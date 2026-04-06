import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IConversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class GuestAccessService {
  private readonly logger = new Logger(GuestAccessService.name);

  constructor(
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  async enableGuestAccess(conversationId: string, adminUserId: string): Promise<IConversation> {
    const conv = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== 'channel') throw new ForbiddenException('Guest access is only available for channels');

    const admin = conv.participants.find(p => p.userId === adminUserId);
    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      throw new ForbiddenException('Only owners/admins can manage guest access');
    }

    const inviteLink = uuidv4();
    conv.guestAccess = {
      enabled: true,
      guestIds: conv.guestAccess?.guestIds || [],
      inviteLink,
      linkExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    } as any;

    await conv.save();
    this.logger.log(`Guest access enabled for channel ${conversationId}`);
    return conv;
  }

  async disableGuestAccess(conversationId: string, adminUserId: string): Promise<IConversation> {
    const conv = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conv) throw new NotFoundException('Conversation not found');

    const admin = conv.participants.find(p => p.userId === adminUserId);
    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      throw new ForbiddenException('Only owners/admins can manage guest access');
    }

    if (conv.guestAccess) {
      conv.guestAccess.enabled = false;
      conv.guestAccess.inviteLink = undefined;
    }

    await conv.save();
    this.logger.log(`Guest access disabled for channel ${conversationId}`);
    return conv;
  }

  async addGuest(conversationId: string, guestEmail: string, guestId: string): Promise<IConversation> {
    const conv = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!conv.guestAccess?.enabled) throw new ForbiddenException('Guest access is not enabled');

    if (!conv.guestAccess.guestIds.includes(guestId)) {
      conv.guestAccess.guestIds.push(guestId);
    }

    // Add as participant with limited role
    const existing = conv.participants.find(p => p.userId === guestId);
    if (!existing) {
      conv.participants.push({
        userId: guestId,
        role: 'member',
        joinedAt: new Date(),
        lastReadAt: new Date(),
        muted: false,
      } as any);
    }

    await conv.save();
    this.logger.log(`Guest ${guestEmail} added to channel ${conversationId}`);
    return conv;
  }

  async removeGuest(conversationId: string, guestId: string, adminUserId: string): Promise<IConversation> {
    const conv = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conv) throw new NotFoundException('Conversation not found');

    const admin = conv.participants.find(p => p.userId === adminUserId);
    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      throw new ForbiddenException('Only owners/admins can remove guests');
    }

    if (conv.guestAccess) {
      conv.guestAccess.guestIds = conv.guestAccess.guestIds.filter(id => id !== guestId);
    }
    conv.participants = conv.participants.filter(p => p.userId !== guestId) as any;

    await conv.save();
    this.logger.log(`Guest ${guestId} removed from channel ${conversationId}`);
    return conv;
  }
}
