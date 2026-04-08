import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from './schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';
import { IFlaggedMessage } from '../moderation/schemas/flagged-message.schema';
import { ModerationService } from '../moderation/moderation.service';
import { ConversationsService } from '../conversations/conversations.service';
import { LinkPreviewService } from './link-preview.service';
import { DlpService } from '../compliance/dlp.service';
import { LegalHoldService } from '../compliance/legal-hold.service';
import { CommandsService } from '../commands/commands.service';
import * as DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['b', 'i', 'u', 's', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'span'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  /**
   * Sanitize HTML content to prevent stored XSS.
   * Uses DOMPurify for robust protection against all XSS vectors including
   * <style>, SVG, CSS injection, and event handler bypasses.
   */
  private sanitizeHtml(html: string): string {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
  }

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
    @InjectModel('FlaggedMessage') private flaggedMessageModel: Model<IFlaggedMessage>,
    private moderationService: ModerationService,
    private conversationsService: ConversationsService,
    private linkPreviewService: LinkPreviewService,
    private dlpService: DlpService,
    private legalHoldService: LegalHoldService,
    private commandsService: CommandsService,
  ) {}

  async sendMessage(
    conversationId: string, senderId: string, content: string,
    type: string = 'text', replyTo?: string, senderName?: string,
    fileData?: { fileUrl?: string; fileName?: string; fileSize?: number; fileMimeType?: string },
    idempotencyKey?: string,
  ) {
    // ── Slash Command Handling ──
    if (content && content.startsWith('/')) {
      const commandResult = await this.commandsService.parseAndExecute(content, senderId, conversationId);
      if (commandResult && commandResult.handled) {
        // Validate conversation access before saving command result
        const convo = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
        if (!convo) throw new NotFoundException('Conversation not found');
        if (!convo.participants.some((p) => p.userId === senderId)) {
          throw new ForbiddenException('You are not a participant of this conversation');
        }

        if (commandResult.type === 'system') {
          const systemMessage = new this.messageModel({
            conversationId,
            senderId,
            senderName: senderName || null,
            content: commandResult.response || content,
            type: 'system',
            replyTo: replyTo || null,
            status: 'sent',
            readBy: [{ userId: senderId, readAt: new Date() }],
          });
          await systemMessage.save();
          await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: { content: commandResult.response || content, senderId, sentAt: new Date() },
          });
          this.logger.log(`Command system message saved in conversation ${conversationId} by ${senderId}`);
          const result = systemMessage.toObject();
          (result as any).commandData = commandResult.data;
          return result;
        }
        if (commandResult.type === 'poll') {
          const pollMessage = new this.messageModel({
            conversationId,
            senderId,
            senderName: senderName || null,
            content: commandResult.data?.question || content,
            type: 'poll',
            replyTo: replyTo || null,
            status: 'sent',
            readBy: [{ userId: senderId, readAt: new Date() }],
          });
          await pollMessage.save();
          await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: { content: `Poll: ${commandResult.data?.question}`, senderId, sentAt: new Date() },
          });
          this.logger.log(`Poll message saved in conversation ${conversationId} by ${senderId}`);
          const result = pollMessage.toObject();
          (result as any).commandData = commandResult.data;
          return result;
        }
        if (commandResult.type === 'text') {
          // Replace content with command response and proceed through normal flow
          content = commandResult.response || content;
        }
      }
    }

    // Idempotency check: if key provided, return existing message if found
    if (idempotencyKey) {
      const existing = await this.messageModel.findOne({ idempotencyKey });
      if (existing) return existing;
    }

    const conversation = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new NotFoundException('Conversation not found');

    // UC-007: Reject messages to archived conversations
    if (conversation.isArchived) {
      throw new BadRequestException('Cannot send messages to archived conversation');
    }

    if (!conversation.participants.some((p) => p.userId === senderId)) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    // UC-005: Enforce whoCanPost restriction on channels
    if (
      conversation.type === 'channel' &&
      conversation.settings?.whoCanPost === 'admins'
    ) {
      const senderParticipant = conversation.participants.find((p) => p.userId === senderId);
      if (senderParticipant?.role !== 'admin' && senderParticipant?.role !== 'owner') {
        throw new ForbiddenException('Only admins can post in this channel');
      }
    }

    // Sanitize HTML to prevent stored XSS
    let sanitizedContent = content ? this.sanitizeHtml(content) : '';

    // DLP enforcement: check content against org DLP rules BEFORE saving
    const organizationId = (conversation as any).organizationId;
    if (sanitizedContent && organizationId) {
      const dlpResult = await this.dlpService.checkMessage(organizationId, sanitizedContent);
      if (dlpResult.action === 'block') {
        throw new BadRequestException('Message blocked by DLP policy');
      }
      if (dlpResult.action === 'redact' && dlpResult.redactedContent) {
        sanitizedContent = dlpResult.redactedContent;
      }
      // 'flag' is handled after save (below with moderation)
      // 'warn' is client-side only — save normally
      var dlpFlagged = dlpResult.action === 'flag';
      var dlpRuleName = dlpResult.rule;
    }

    // Strip HTML tags for plain text search index
    const contentPlainText = sanitizedContent ? sanitizedContent.replace(/<[^>]*>/g, '').replace(/[*_~`#>\[\]()!|]/g, '').trim() : '';

    // UC-008: Reject whitespace-only text messages
    if (contentPlainText.trim().length === 0 && type === 'text') {
      throw new BadRequestException('Message cannot be empty');
    }

    const message = new this.messageModel({
      conversationId,
      senderId,
      senderName: senderName || null,
      content: sanitizedContent,
      contentPlainText,
      type,
      replyTo: replyTo || null,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      status: 'sent',
      readBy: [{ userId: senderId, readAt: new Date() }],
      ...(fileData?.fileUrl && { fileUrl: fileData.fileUrl }),
      ...(fileData?.fileName && { fileName: fileData.fileName }),
      ...(fileData?.fileSize && { fileSize: fileData.fileSize }),
      ...(fileData?.fileMimeType && { fileMimeType: fileData.fileMimeType }),
    });

    await message.save();

    // Update conversation lastMessage
    await this.conversationsService.updateLastMessage(conversationId, message);

    // Content moderation (async, non-blocking)
    // L-002: Run moderation on sanitized plain text, not raw HTML content
    if (contentPlainText) {
      this.moderationService.checkMessage(contentPlainText, senderId).then(async (result) => {
        if (result.flagged) {
          const flagged = new this.flaggedMessageModel({
            messageId: message._id.toString(),
            conversationId,
            senderId,
            senderName: senderName || `User ${senderId.toString().slice(-6)}`,
            content,
            reason: result.reason,
            severity: result.severity || 'warning',
          });
          await flagged.save();
          this.logger.warn(`Message ${message._id} flagged: ${result.reason}`);
        }
      }).catch((err) => {
        this.logger.error(`Moderation check failed: ${err.message}`);
      });
    }

    // DLP flag: if DLP action was 'flag', create a moderation flag entry
    if (dlpFlagged) {
      const flagged = new this.flaggedMessageModel({
        messageId: message._id.toString(),
        conversationId,
        senderId,
        senderName: senderName || `User ${senderId.toString().slice(-6)}`,
        content,
        reason: `DLP rule triggered: ${dlpRuleName}`,
        severity: 'warning',
      });
      flagged.save().catch((err) => {
        this.logger.error(`DLP flag save failed: ${err.message}`);
      });
    }

    // Link preview fetching (async, non-blocking)
    if (sanitizedContent && type === 'text') {
      this.linkPreviewService
        .fetchAndAttachPreviews(message._id.toString(), sanitizedContent)
        .catch((err) => {
          this.logger.error(`Link preview fetch failed: ${err.message}`);
        });
    }

    return message;
  }

  async getMessages(conversationId: string, userId: string, page: number = 1, limit: number = 50) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const safeLimit = Math.min(limit || 50, 200);
    const skip = (page - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.messageModel.find({ conversationId, isDeleted: false, threadId: null })
        .sort({ createdAt: 1 }).skip(skip).limit(safeLimit),
      this.messageModel.countDocuments({ conversationId, isDeleted: false, threadId: null }),
    ]);

    return { data, pagination: { page, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
  }

  async editMessage(messageId: string, senderId: string, newContent: string) {
    const message = await this.messageModel.findOne({ _id: messageId, isDeleted: false });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== senderId) throw new ForbiddenException('Can only edit your own messages');

    // Sanitize edited content too
    const sanitizedContent = newContent ? this.sanitizeHtml(newContent) : '';
    const contentPlainText = sanitizedContent ? sanitizedContent.replace(/<[^>]*>/g, '').replace(/[*_~`#>\[\]()!|]/g, '').trim() : '';

    return this.messageModel.findByIdAndUpdate(messageId, {
      content: sanitizedContent,
      contentPlainText,
      isEdited: true,
      editedAt: new Date(),
      $push: { editHistory: { content: message.content, editedAt: new Date() } },
    }, { new: true });
  }

  async deleteMessage(messageId: string, senderId: string) {
    const message = await this.messageModel.findOne({ _id: messageId, isDeleted: false });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== senderId) throw new ForbiddenException('Can only delete your own messages');

    // Legal hold enforcement: prevent deletion of messages under legal hold
    const conversation = await this.conversationModel.findById(message.conversationId);
    const orgId = (conversation as any)?.organizationId;
    if (orgId) {
      const underHold = await this.legalHoldService.isUnderHold(orgId, message.conversationId, message.senderId);
      if (underHold) {
        throw new ForbiddenException('Message cannot be deleted — under legal hold');
      }
    }

    await this.messageModel.findByIdAndUpdate(messageId, {
      isDeleted: true, deletedAt: new Date(), deletedBy: senderId,
    });
    return { message: 'Message deleted successfully' };
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.conversationsService.markAsRead(conversationId, userId);

    await this.messageModel.updateMany(
      { conversationId, isDeleted: false, 'readBy.userId': { $ne: userId } },
      { $push: { readBy: { userId, readAt: new Date() } } },
    );

    // Update status to 'read' for messages from other senders
    await this.messageModel.updateMany(
      { conversationId, isDeleted: false, senderId: { $ne: userId }, status: { $in: ['sent', 'delivered'] } },
      { $set: { status: 'read' } },
    );

    return { message: 'Marked as read' };
  }

  async markAsDelivered(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) return;

    // Don't mark own messages as delivered
    if (message.senderId === userId) return;

    // Check if already delivered to this user
    const alreadyDelivered = message.deliveredTo?.some(d => d.userId === userId);
    if (alreadyDelivered) return;

    await this.messageModel.findByIdAndUpdate(messageId, {
      $push: { deliveredTo: { userId, deliveredAt: new Date() } },
      $set: { status: message.status === 'sent' ? 'delivered' : message.status },
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    const reactionIdx = message.reactions?.findIndex((r) => r.emoji === emoji);

    if (reactionIdx !== undefined && reactionIdx >= 0) {
      const reaction = message.reactions[reactionIdx];
      const userIdx = reaction.users?.findIndex((u) => u.userId === userId);
      if (userIdx !== undefined && userIdx >= 0) {
        reaction.users.splice(userIdx, 1);
        reaction.count = reaction.users.length;
        if (reaction.count === 0) message.reactions.splice(reactionIdx, 1);
      } else {
        reaction.users.push({ userId, createdAt: new Date() } as any);
        reaction.count = reaction.users.length;
      }
    } else {
      if (!message.reactions) message.reactions = [];
      message.reactions.push({
        emoji,
        users: [{ userId, createdAt: new Date() }],
        count: 1,
      } as any);
    }

    await message.save();
    return message;
  }

  async getUnreadCount(userId: string) {
    const result = await this.conversationModel.aggregate([
      { $match: { 'participants.userId': userId, isDeleted: false } },
      { $project: {
        lastRead: {
          $filter: { input: '$participants', as: 'p', cond: { $eq: ['$$p.userId', userId] } },
        },
      }},
      { $lookup: { from: 'messages', let: { convId: '$_id', lr: { $arrayElemAt: ['$lastRead.lastReadAt', 0] } },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$conversationId', '$$convId'] },
            { $gt: ['$createdAt', { $ifNull: ['$$lr', new Date(0)] }] },
            { $ne: ['$senderId', userId] },
            { $ne: ['$isDeleted', true] },
          ]}}},
        ],
        as: 'unread',
      }},
      { $match: { 'unread.0': { $exists: true } } },
      { $count: 'total' },
    ]);
    const count = result[0]?.total || 0;
    return { unreadConversations: count, count };
  }

  async searchMessages(conversationId: string, query: string, userId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    // Escape regex metacharacters to prevent ReDoS
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.messageModel.find({
      conversationId, isDeleted: false,
      content: { $regex: escaped, $options: 'i' },
    }).sort({ createdAt: -1 }).limit(50);
  }

  async getReadStatus(conversationId: string, messageId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const message = await this.messageModel.findOne({ _id: messageId, conversationId }).lean();
    if (!message) throw new NotFoundException('Message not found');

    const totalParticipants = conversation.participants.length;
    const readCount = message.readBy?.length || 0;

    const readBy = conversation.type !== 'channel'
      ? (message.readBy || []).map((r: any) => ({ userId: r.userId, readAt: r.readAt }))
      : [];

    return { totalParticipants, readCount, readBy };
  }
}
