import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IConversation } from './schemas/conversation.schema';
import { IMessage } from './schemas/message.schema';
import { IChatSettings } from './schemas/chat-settings.schema';
import { IFlaggedMessage } from './schemas/flagged-message.schema';
import { ModerationService } from './moderation.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('ChatSettings') private chatSettingsModel: Model<IChatSettings>,
    @InjectModel('FlaggedMessage') private flaggedMessageModel: Model<IFlaggedMessage>,
    private moderationService: ModerationService,
  ) {}

  // ── Conversations ──

  async createDirectConversation(userId1: string, userId2: string) {
    // Find existing direct conversation between these two users
    const existing = await this.conversationModel.findOne({
      type: 'direct',
      isDeleted: false,
      'participants.userId': { $all: [userId1, userId2] },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    });

    if (existing) {
      this.logger.log(`Existing direct conversation found: ${existing._id}`);
      return existing;
    }

    const conversation = new this.conversationModel({
      type: 'direct',
      name: null,
      participants: [
        { userId: userId1, role: 'member', joinedAt: new Date(), lastReadAt: new Date(), muted: false },
        { userId: userId2, role: 'member', joinedAt: new Date(), lastReadAt: new Date(), muted: false },
      ],
      createdBy: userId1,
    });

    await conversation.save();
    this.logger.log(`Direct conversation created: ${conversation._id}`);
    return conversation;
  }

  async createGroup(name: string, description: string, memberIds: string[], createdBy: string) {
    const allMemberIds = Array.from(new Set([createdBy, ...memberIds]));

    const participants = allMemberIds.map((userId) => ({
      userId,
      role: userId === createdBy ? 'owner' : 'member',
      joinedAt: new Date(),
      lastReadAt: new Date(),
      muted: false,
    }));

    const conversation = new this.conversationModel({
      type: 'group',
      name,
      description: description || null,
      participants,
      createdBy,
    });

    await conversation.save();
    this.logger.log(`Group created: ${conversation._id} - ${name}`);
    return conversation;
  }

  async createChannel(name: string, description: string, createdBy: string, memberIds?: string[]) {
    const allMemberIds = memberIds ? Array.from(new Set([createdBy, ...memberIds])) : [createdBy];

    const participants = allMemberIds.map((userId) => ({
      userId,
      role: userId === createdBy ? 'owner' : 'member',
      joinedAt: new Date(),
      lastReadAt: new Date(),
      muted: false,
    }));

    const conversation = new this.conversationModel({
      type: 'channel',
      name,
      description: description || null,
      participants,
      createdBy,
    });

    await conversation.save();
    this.logger.log(`Channel created: ${conversation._id} - ${name}`);
    return conversation;
  }

  async getMyConversations(userId: string) {
    const conversations = await this.conversationModel
      .find({
        'participants.userId': userId,
        isDeleted: false,
      })
      .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 })
      .lean();

    return conversations;
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');

    return conversation;
  }

  async addParticipants(conversationId: string, userIds: string[], addedBy: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type === 'direct') throw new ForbiddenException('Cannot add participants to a direct conversation');

    const isParticipant = conversation.participants.some((p) => p.userId === addedBy);
    if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');

    const existingUserIds = conversation.participants.map((p) => p.userId);
    const newUserIds = userIds.filter((id) => !existingUserIds.includes(id));

    if (newUserIds.length === 0) {
      return conversation;
    }

    const newParticipants = newUserIds.map((userId) => ({
      userId,
      role: 'member',
      joinedAt: new Date(),
      lastReadAt: new Date(),
      muted: false,
    }));

    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $push: { participants: { $each: newParticipants } } },
      { new: true },
    );

    this.logger.log(`Added ${newUserIds.length} participants to conversation ${conversationId}`);
    return updated;
  }

  async removeParticipant(conversationId: string, userId: string, removedBy: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type === 'direct') throw new ForbiddenException('Cannot remove participants from a direct conversation');

    const remover = conversation.participants.find((p) => p.userId === removedBy);
    if (!remover) throw new ForbiddenException('You are not a participant of this conversation');

    if (remover.role !== 'owner' && remover.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can remove participants');
    }

    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: { userId } } },
      { new: true },
    );

    this.logger.log(`Removed participant ${userId} from conversation ${conversationId}`);
    return updated;
  }

  async leaveConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');

    if (conversation.type === 'direct') {
      throw new ForbiddenException('Cannot leave a direct conversation');
    }

    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: { userId } } },
      { new: true },
    );

    this.logger.log(`User ${userId} left conversation ${conversationId}`);
    return { message: 'Left conversation successfully' };
  }

  // ── Messages ──

  async sendMessage(conversationId: string, senderId: string, content: string, type: string = 'text', replyTo?: string, fileData?: { fileUrl?: string; fileName?: string; fileSize?: number; fileMimeType?: string }, clipData?: { clipId?: string; mediaUrl?: string; thumbnailUrl?: string; duration?: number; transcription?: string }) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some((p) => p.userId === senderId);
    if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');

    const message = new this.messageModel({
      conversationId,
      senderId,
      content,
      type,
      replyTo: replyTo || null,
      readBy: [{ userId: senderId, readAt: new Date() }],
      ...(fileData?.fileUrl && { fileUrl: fileData.fileUrl }),
      ...(fileData?.fileName && { fileName: fileData.fileName }),
      ...(fileData?.fileSize && { fileSize: fileData.fileSize }),
      ...(fileData?.fileMimeType && { fileMimeType: fileData.fileMimeType }),
      ...(clipData && {
        clip: {
          clipId: clipData.clipId || '',
          mediaUrl: clipData.mediaUrl || '',
          thumbnailUrl: clipData.thumbnailUrl || '',
          duration: clipData.duration || 0,
          transcription: clipData.transcription || '',
        },
      }),
    });

    await message.save();

    // Update lastMessage on conversation
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: {
        content,
        senderId,
        sentAt: new Date(),
      },
    });

    // Content moderation check (AI-based, async)
    this.moderationService.checkMessage(content, senderId).then(async (moderationResult) => {
      if (moderationResult.flagged) {
        const flagged = new this.flaggedMessageModel({
          messageId: message._id.toString(),
          conversationId,
          senderId,
          senderName: senderId,
          content,
          reason: moderationResult.reason,
          severity: moderationResult.severity || 'warning',
        });
        await flagged.save();
        this.logger.warn(`Message ${message._id} flagged: ${moderationResult.reason}`);
      }
    }).catch((err) => {
      this.logger.error(`Moderation check failed for message ${message._id}: ${err.message}`);
    });

    this.logger.log(`Message sent in conversation ${conversationId} by ${senderId}`);
    return message;
  }

  async getMessages(conversationId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.messageModel
        .find({ conversationId, isDeleted: false })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      this.messageModel.countDocuments({ conversationId, isDeleted: false }),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async editMessage(messageId: string, senderId: string, newContent: string) {
    const message = await this.messageModel.findOne({
      _id: messageId,
      isDeleted: false,
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== senderId) throw new ForbiddenException('You can only edit your own messages');

    const updated = await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        content: newContent,
        isEdited: true,
        editedAt: new Date(),
      },
      { new: true },
    );

    this.logger.log(`Message ${messageId} edited by ${senderId}`);
    return updated;
  }

  async deleteMessage(messageId: string, senderId: string) {
    const message = await this.messageModel.findOne({
      _id: messageId,
      isDeleted: false,
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== senderId) throw new ForbiddenException('You can only delete your own messages');

    await this.messageModel.findByIdAndUpdate(messageId, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    this.logger.log(`Message ${messageId} soft-deleted by ${senderId}`);
    return { message: 'Message deleted successfully' };
  }

  async markAsRead(conversationId: string, userId: string) {
    // Update participant's lastReadAt
    await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.userId': userId },
      { $set: { 'participants.$.lastReadAt': new Date() } },
    );

    // Add userId to readBy on all unread messages in this conversation
    await this.messageModel.updateMany(
      {
        conversationId,
        isDeleted: false,
        'readBy.userId': { $ne: userId },
      },
      {
        $push: { readBy: { userId, readAt: new Date() } },
      },
    );

    this.logger.log(`Conversation ${conversationId} marked as read by ${userId}`);
    return { message: 'Marked as read' };
  }

  async getUnreadCount(userId: string) {
    // Get all conversations the user is part of
    const conversations = await this.conversationModel
      .find({
        'participants.userId': userId,
        isDeleted: false,
      })
      .lean();

    let totalUnread = 0;

    for (const conv of conversations) {
      const participant = conv.participants.find((p) => p.userId === userId);
      if (!participant) continue;

      const unreadCount = await this.messageModel.countDocuments({
        conversationId: conv._id.toString(),
        isDeleted: false,
        createdAt: { $gt: participant.lastReadAt },
        senderId: { $ne: userId },
      });

      if (unreadCount > 0) totalUnread++;
    }

    return { unreadConversations: totalUnread };
  }

  async searchMessages(conversationId: string, query: string) {
    const messages = await this.messageModel
      .find({
        conversationId,
        isDeleted: false,
        content: { $regex: query, $options: 'i' },
      })
      .sort({ createdAt: -1 })
      .limit(50);

    return messages;
  }

  async pinConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      isDeleted: false,
      'participants.userId': userId,
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { isPinned: !conversation.isPinned },
      { new: true },
    );

    this.logger.log(`Conversation ${conversationId} pin toggled by ${userId}`);
    return updated;
  }

  async muteConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      isDeleted: false,
      'participants.userId': userId,
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const participant = conversation.participants.find((p) => p.userId === userId);
    const newMuted = !participant.muted;

    await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.userId': userId },
      { $set: { 'participants.$.muted': newMuted } },
    );

    this.logger.log(`Conversation ${conversationId} mute toggled by ${userId}`);
    return { muted: newMuted };
  }

  async getOnlineUsers() {
    // Placeholder: return empty array — real implementation would use WebSockets/Redis
    return { users: [], message: 'Online users placeholder — requires WebSocket integration' };
  }

  async convertToGroup(conversationId: string, newMemberIds: string[], groupName?: string, userId?: string) {
    const convo = await this.conversationModel.findById(conversationId);
    if (!convo || convo.isDeleted) throw new NotFoundException('Conversation not found');
    if (convo.type !== 'direct') throw new BadRequestException('Can only convert direct conversations to groups');

    if (userId) {
      const isParticipant = convo.participants.some((p) => p.userId === userId);
      if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');
    }

    const existingIds = convo.participants.map((p) => p.userId);

    convo.type = 'group';
    convo.name = groupName || 'Group';

    for (const id of newMemberIds) {
      if (!existingIds.includes(id)) {
        convo.participants.push({
          userId: id,
          role: 'member',
          joinedAt: new Date(),
          lastReadAt: new Date(),
          muted: false,
        } as any);
      }
    }

    await convo.save();
    this.logger.log(`Conversation ${conversationId} converted from direct to group`);
    return convo;
  }

  // ── Chat Settings ──

  async getSettings(userId: string) {
    let settings = await this.chatSettingsModel.findOne({ userId });
    if (!settings) {
      settings = new this.chatSettingsModel({ userId });
      await settings.save();
    }
    return settings;
  }

  async updateSettings(userId: string, dto: any) {
    let settings = await this.chatSettingsModel.findOne({ userId });
    if (!settings) {
      settings = new this.chatSettingsModel({ userId, ...dto });
    } else {
      if (dto.readReceipts) {
        Object.assign(settings.readReceipts, dto.readReceipts);
      }
      if (dto.appearance) {
        Object.assign(settings.appearance, dto.appearance);
      }
      if (dto.notifications) {
        Object.assign(settings.notifications, dto.notifications);
      }
    }
    await settings.save();
    return settings;
  }

  async adminOverrideSettings(targetUserId: string, dto: any, adminUserId: string) {
    return this.updateSettings(targetUserId, dto);
  }

  // ── Content Moderation ──

  async getFlaggedMessages() {
    return this.flaggedMessageModel
      .find()
      .sort({ createdAt: -1 })
      .lean();
  }

  async reviewFlaggedMessage(id: string, status: string, reviewedBy: string) {
    const flagged = await this.flaggedMessageModel.findById(id);
    if (!flagged) throw new NotFoundException('Flagged message not found');

    flagged.status = status;
    flagged.reviewedBy = reviewedBy;
    flagged.reviewedAt = new Date();
    await flagged.save();

    this.logger.log(`Flagged message ${id} reviewed by ${reviewedBy} — status: ${status}`);
    return flagged;
  }

  async getModerationStats() {
    const [total, pending, reviewed, dismissed, actioned] = await Promise.all([
      this.flaggedMessageModel.countDocuments(),
      this.flaggedMessageModel.countDocuments({ status: 'pending' }),
      this.flaggedMessageModel.countDocuments({ status: 'reviewed' }),
      this.flaggedMessageModel.countDocuments({ status: 'dismissed' }),
      this.flaggedMessageModel.countDocuments({ status: 'actioned' }),
    ]);
    return { total, pending, reviewed, dismissed, actioned };
  }
}
