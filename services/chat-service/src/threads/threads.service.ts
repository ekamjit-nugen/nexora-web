import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class ThreadsService {
  private readonly logger = new Logger(ThreadsService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  async replyToThread(rootMessageId: string, senderId: string, content: string, senderName?: string) {
    const rootMessage = await this.messageModel.findById(rootMessageId);
    if (!rootMessage) throw new NotFoundException('Root message not found');

    const conversation = await this.conversationModel.findOne({
      _id: rootMessage.conversationId, 'participants.userId': senderId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const contentPlainText = content ? content.replace(/[*_~`#>\[\]()!|]/g, '').trim() : '';

    const reply = new this.messageModel({
      conversationId: rootMessage.conversationId,
      threadId: rootMessageId,
      senderId,
      senderName: senderName || null,
      content,
      contentPlainText,
      type: 'text',
      readBy: [{ userId: senderId, readAt: new Date() }],
    });
    await reply.save();

    // Update root message threadInfo
    const threadInfo = rootMessage.threadInfo || {
      replyCount: 0, participantIds: [], lastReplyAt: null, lastReplyBy: null, followers: [],
    };
    threadInfo.replyCount += 1;
    threadInfo.lastReplyAt = new Date();
    threadInfo.lastReplyBy = senderId;
    if (!threadInfo.participantIds.includes(senderId)) {
      threadInfo.participantIds.push(senderId);
    }
    // Auto-follow the thread
    if (!threadInfo.followers.includes(senderId)) {
      threadInfo.followers.push(senderId);
    }

    await this.messageModel.findByIdAndUpdate(rootMessageId, { threadInfo });

    this.logger.log(`Thread reply in ${rootMessage.conversationId} by ${senderId}`);
    return reply;
  }

  async getThreadReplies(rootMessageId: string, userId: string, page: number = 1, limit: number = 50) {
    const rootMessage = await this.messageModel.findById(rootMessageId);
    if (!rootMessage) throw new NotFoundException('Root message not found');

    const conversation = await this.conversationModel.findOne({
      _id: rootMessage.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.messageModel.find({ threadId: rootMessageId, isDeleted: false })
        .sort({ createdAt: 1 }).skip(skip).limit(limit),
      this.messageModel.countDocuments({ threadId: rootMessageId, isDeleted: false }),
    ]);

    return {
      rootMessage,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async followThread(rootMessageId: string, userId: string) {
    const rootMessage = await this.messageModel.findById(rootMessageId);
    if (!rootMessage) throw new NotFoundException('Root message not found');

    if (!rootMessage.threadInfo) {
      rootMessage.threadInfo = { replyCount: 0, participantIds: [], followers: [userId] } as any;
    } else if (!rootMessage.threadInfo.followers.includes(userId)) {
      rootMessage.threadInfo.followers.push(userId);
    }
    await rootMessage.save();
    return { following: true };
  }

  async unfollowThread(rootMessageId: string, userId: string) {
    const rootMessage = await this.messageModel.findById(rootMessageId);
    if (!rootMessage) throw new NotFoundException('Root message not found');

    if (rootMessage.threadInfo) {
      rootMessage.threadInfo.followers = rootMessage.threadInfo.followers.filter(id => id !== userId);
      await rootMessage.save();
    }
    return { following: false };
  }
}
