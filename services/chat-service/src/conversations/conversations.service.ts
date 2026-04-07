import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IConversation } from './schemas/conversation.schema';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
    private cacheService: CacheService,
  ) {}

  /**
   * Invalidate conversation caches for all participants of a conversation.
   */
  private async invalidateConversationCache(conversationId: string, participantUserIds: string[]) {
    await this.cacheService.del(`conv:${conversationId}`);
    for (const userId of participantUserIds) {
      await this.cacheService.del(`conv:user:${userId}`);
    }
  }

  async createDirectConversation(userId1: string, userId2: string) {
    const existing = await this.conversationModel.findOne({
      type: 'direct',
      isDeleted: false,
      'participants.userId': { $all: [userId1, userId2] },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    });

    if (existing) return existing;

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
    await this.invalidateConversationCache(conversation._id.toString(), [userId1, userId2]);
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
    await this.invalidateConversationCache(conversation._id.toString(), allMemberIds);
    this.logger.log(`Group created: ${conversation._id} - ${name}`);
    return conversation;
  }

  async createChannel(
    name: string, description: string, createdBy: string,
    memberIds?: string[], channelType: string = 'public', topic?: string, categoryId?: string,
  ) {
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
      channelType,
      name,
      description: description || null,
      topic: topic || null,
      categoryId: categoryId || null,
      participants,
      createdBy,
    });

    await conversation.save();
    await this.invalidateConversationCache(conversation._id.toString(), allMemberIds);
    this.logger.log(`Channel created: ${conversation._id} - ${name} (${channelType})`);
    return conversation;
  }

  async getMyConversations(userId: string) {
    // Check cache first
    const cacheKey = `conv:user:${userId}`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const conversations = await this.conversationModel
      .find({ 'participants.userId': userId, isDeleted: false })
      .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 })
      .lean();

    conversations.sort((a: any, b: any) => {
      const aPinned = a.participants?.find((p: any) => p.userId?.toString() === userId)?.isPinned ? 1 : 0;
      const bPinned = b.participants?.find((p: any) => p.userId?.toString() === userId)?.isPinned ? 1 : 0;
      return bPinned - aPinned;
    });

    // Cache for 60 seconds
    await this.cacheService.set(cacheKey, conversations, 60);

    return conversations;
  }

  async getConversation(conversationId: string, userId: string) {
    // Check cache first
    const cacheKey = `conv:${conversationId}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      // Still validate participant access from cached data
      const isParticipant = cached.participants?.some((p: any) => p.userId === userId);
      if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');
      return cached;
    }

    const conversation = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');

    // Cache for 120 seconds
    await this.cacheService.set(cacheKey, conversation.toObject(), 120);

    return conversation;
  }

  async addParticipants(conversationId: string, userIds: string[], addedBy: string) {
    const conversation = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type === 'direct') throw new ForbiddenException('Cannot add participants to a direct conversation');

    const isParticipant = conversation.participants.some((p) => p.userId === addedBy);
    if (!isParticipant) throw new ForbiddenException('You are not a participant of this conversation');

    const existingUserIds = conversation.participants.map((p) => p.userId);
    const newUserIds = userIds.filter((id) => !existingUserIds.includes(id));
    if (newUserIds.length === 0) return conversation;

    // Check which users are active vs invited (not yet on platform)
    // We allow adding invited users — they'll see the conversation when they accept the invite
    const newParticipants = newUserIds.map((userId) => ({
      userId,
      role: 'member',
      memberStatus: 'active', // Default to active; caller can specify 'invited' for pending users
      joinedAt: new Date(),
      lastReadAt: new Date(),
      muted: false,
    }));

    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $push: { participants: { $each: newParticipants } } },
      { new: true },
    );
    await this.invalidateConversationCache(conversationId, [...existingUserIds, ...newUserIds]);
    return updated;
  }

  async removeParticipant(conversationId: string, userId: string, removedBy: string) {
    const conversation = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type === 'direct') throw new ForbiddenException('Cannot remove participants from a direct conversation');

    const remover = conversation.participants.find((p) => p.userId === removedBy);
    if (!remover) throw new ForbiddenException('You are not a participant');
    if (remover.role !== 'owner' && remover.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can remove participants');
    }

    const allUserIds = conversation.participants.map((p) => p.userId);
    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId, { $pull: { participants: { userId } } }, { new: true },
    );
    await this.invalidateConversationCache(conversationId, allUserIds);
    return updated;
  }

  async leaveConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participants.some((p) => p.userId === userId)) throw new ForbiddenException('Not a participant');
    if (conversation.type === 'direct') throw new ForbiddenException('Cannot leave a direct conversation');

    const allUserIds = conversation.participants.map((p) => p.userId);
    await this.conversationModel.findByIdAndUpdate(conversationId, { $pull: { participants: { userId } } });
    await this.invalidateConversationCache(conversationId, allUserIds);
    return { message: 'Left conversation successfully' };
  }

  async pinConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    const participant = conversation.participants.find(p => p.userId === userId || p.userId?.toString() === userId);
    if (!participant) throw new ForbiddenException('Not a participant');
    (participant as any).isPinned = !(participant as any).isPinned;
    await conversation.save();
    return { success: true, data: { isPinned: (participant as any).isPinned } };
  }

  async muteConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, isDeleted: false, 'participants.userId': userId,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const participant = conversation.participants.find((p) => p.userId === userId);
    const newMuted = !participant.muted;
    await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.userId': userId },
      { $set: { 'participants.$.muted': newMuted } },
    );
    return { muted: newMuted };
  }

  async getOrCreateSelfConversation(userId: string, organizationId: string) {
    let self = await this.conversationModel.findOne({
      organizationId,
      type: 'self',
      'participants.userId': userId,
      $expr: { $eq: [{ $size: '$participants' }, 1] },
    });

    if (!self) {
      self = new this.conversationModel({
        organizationId,
        type: 'self',
        name: 'Notes to Self',
        participants: [{ userId, role: 'owner', joinedAt: new Date(), lastReadAt: new Date(), muted: false }],
        createdBy: userId,
      });
      await self.save();
      this.logger.log(`Self conversation created for ${userId}`);
    }

    return self;
  }

  async unarchiveConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participants.some(p => p.userId === userId)) throw new ForbiddenException('Not a participant');

    conversation.isArchived = false;
    await conversation.save();
    return conversation;
  }

  async convertToGroup(conversationId: string, newMemberIds: string[], groupName?: string, userId?: string) {
    const convo = await this.conversationModel.findById(conversationId);
    if (!convo || convo.isDeleted) throw new NotFoundException('Conversation not found');
    if (convo.type !== 'direct') throw new BadRequestException('Can only convert direct conversations to groups');
    if (userId && !convo.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('Not a participant');
    }

    const existingIds = convo.participants.map((p) => p.userId);
    convo.type = 'group';
    convo.name = groupName || 'Group';
    for (const id of newMemberIds) {
      if (!existingIds.includes(id)) {
        convo.participants.push({
          userId: id, role: 'member', joinedAt: new Date(), lastReadAt: new Date(), muted: false,
        } as any);
      }
    }
    await convo.save();
    return convo;
  }

  // E3 Item 6.2: Mark as unread — reset lastReadMessageId to before a specific message
  async markAsUnread(conversationId: string, userId: string, fromMessageId: string) {
    await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.userId': userId },
      { $set: { 'participants.$.lastReadMessageId': fromMessageId, 'participants.$.lastReadAt': new Date(0) } },
    );
    this.logger.log(`Conversation ${conversationId} marked as unread by ${userId} from message ${fromMessageId}`);
  }

  // E3 Item 6.7: Star/unstar conversation
  async starConversation(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    const participant = conversation.participants.find(p => p.userId === userId);
    if (!participant) throw new ForbiddenException('Not a participant');

    const isStarred = !(participant as any).isStarred;
    await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.userId': userId },
      { $set: { 'participants.$.isStarred': isStarred } },
    );
    return { isStarred };
  }

  /**
   * Add users who are invited (not yet on platform) to a conversation.
   * They get memberStatus: 'invited' — can't send messages, but will see history
   * when they accept the org invite and their status is activated.
   */
  async addInvitedParticipants(conversationId: string, userIds: string[], addedBy: string) {
    const conversation = await this.conversationModel.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type === 'direct') throw new ForbiddenException('Cannot add participants to a direct conversation');

    const isParticipant = conversation.participants.some((p) => p.userId === addedBy);
    if (!isParticipant) throw new ForbiddenException('You are not a participant');

    const existingUserIds = conversation.participants.map((p) => p.userId);
    const newUserIds = userIds.filter((id) => !existingUserIds.includes(id));
    if (newUserIds.length === 0) return conversation;

    const newParticipants = newUserIds.map((userId) => ({
      userId,
      role: 'member',
      memberStatus: 'invited', // Not yet active on the platform
      joinedAt: new Date(),
      lastReadAt: new Date(),
      muted: false,
    }));

    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $push: { participants: { $each: newParticipants } } },
      { new: true },
    );

    this.logger.log(`Added ${newUserIds.length} invited participants to conversation ${conversationId}`);
    return updated;
  }

  /**
   * Activate an invited user across all conversations they were pre-added to.
   * Called when the user accepts their org invite and logs in.
   */
  async activateInvitedUser(userId: string): Promise<number> {
    const result = await this.conversationModel.updateMany(
      { 'participants.userId': userId, 'participants.memberStatus': 'invited' },
      { $set: { 'participants.$.memberStatus': 'active' } },
    );

    const count = result.modifiedCount || 0;
    if (count > 0) {
      this.logger.log(`Activated invited user ${userId} in ${count} conversations`);
    }
    return count;
  }

  async markAsRead(conversationId: string, userId: string, messageId?: string) {
    const update: any = { $set: { 'participants.$.lastReadAt': new Date() } };
    if (messageId) {
      update.$set['participants.$.lastReadMessageId'] = messageId;
    }
    await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.userId': userId },
      update,
    );
  }

  async updateLastMessage(conversationId: string, message: any) {
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: {
        _id: message._id?.toString(),
        content: message.content?.substring(0, 100),
        senderId: message.senderId,
        senderName: message.senderName || null,
        type: message.type || 'text',
        sentAt: new Date(),
      },
      $inc: { messageCount: 1 },
    });

    // Invalidate conversation cache (conversation metadata changed)
    await this.cacheService.del(`conv:${conversationId}`);
    // Invalidate user conversation lists for all participants (they need updated lastMessage)
    await this.cacheService.invalidatePattern(`conv:user:*`);
  }
}
