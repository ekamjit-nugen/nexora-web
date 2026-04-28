import { Injectable, CanActivate, ExecutionContext, ForbiddenException, HttpException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * Channel Permission Guard.
 * Enforces channel-level restrictions: whoCanPost, whoCanMention, whoCanPin,
 * slowModeSeconds, threadRequirement, announcement channel rules.
 *
 * Apply to: message sending, pinning, and actions needing channel-level checks.
 */
@Injectable()
export class ChannelPermissionGuard implements CanActivate {
  constructor(
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<any>,
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<any>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const conversationId = request.params?.id || request.body?.conversationId;
    if (!userId || !conversationId) return true;

    const conv = await this.conversationModel.findById(conversationId);
    if (!conv || conv.type !== 'channel') return true; // Non-channel = no restriction

    const participant = conv.participants.find((p: any) => p.userId === userId);
    if (!participant) throw new ForbiddenException('Not a member of this channel');

    const isAdmin = participant.role === 'owner' || participant.role === 'admin';
    const action = this.deriveAction(request);

    // Announcement channel: only admins can post
    if (action === 'post' && conv.channelType === 'announcement' && !isAdmin) {
      throw new ForbiddenException('Only admins can post in announcement channels');
    }

    // Who can post
    if (action === 'post' && conv.settings?.whoCanPost === 'admins' && !isAdmin) {
      throw new ForbiddenException('Only admins can post in this channel');
    }

    // Slow mode
    if (action === 'post' && conv.settings?.slowModeSeconds > 0 && !isAdmin) {
      const lastMsg = await this.messageModel.findOne({
        conversationId, senderId: userId, isDeleted: false,
      }).sort({ createdAt: -1 }).select('createdAt').lean() as any;

      if (lastMsg) {
        const cooldownMs = conv.settings.slowModeSeconds * 1000;
        const elapsed = Date.now() - new Date(lastMsg.createdAt).getTime();
        if (elapsed < cooldownMs) {
          const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
          throw new HttpException(
            { code: 'SLOW_MODE', message: `Please wait ${remaining}s before posting again` },
            429,
          );
        }
      }
    }

    // Thread requirement
    if (action === 'post' && conv.settings?.threadRequirement === 'required') {
      const threadId = request.body?.threadId;
      if (!threadId) {
        throw new BadRequestException('This channel requires all messages to be in threads');
      }
    }

    // Who can mention @here/@all
    if (action === 'post') {
      const content = request.body?.content || '';
      if ((content.includes('@here') || content.includes('@all')) && conv.settings?.whoCanMention === 'admins' && !isAdmin) {
        throw new ForbiddenException('Only admins can use @here/@all in this channel');
      }
    }

    // Who can pin
    if (action === 'pin' && conv.settings?.whoCanPin === 'admins' && !isAdmin) {
      throw new ForbiddenException('Only admins can pin messages in this channel');
    }

    return true;
  }

  private deriveAction(request: any): string {
    const path = request.route?.path || request.url || '';
    const method = request.method;

    if (path.includes('/pin')) return 'pin';
    if (path.includes('/messages') && method === 'POST') return 'post';
    if (path.includes('/threads') && method === 'POST') return 'post';
    return 'post';
  }
}
