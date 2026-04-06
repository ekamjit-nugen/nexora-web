import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

const MAX_PINS_PER_CONVERSATION = 50;

@Injectable()
export class PinsService {
  private readonly logger = new Logger(PinsService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  async pinMessage(messageId: string, userId: string): Promise<IMessage> {
    const message = await this.messageModel.findOne({ _id: messageId, isDeleted: false });
    if (!message) throw new NotFoundException('Message not found');

    const conversation = await this.conversationModel.findOne({
      _id: message.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    // Check pin limit
    const pinCount = await this.messageModel.countDocuments({
      conversationId: message.conversationId, isPinned: true, isDeleted: false,
    });
    if (pinCount >= MAX_PINS_PER_CONVERSATION) {
      throw new BadRequestException(`Maximum ${MAX_PINS_PER_CONVERSATION} pinned messages per conversation`);
    }

    message.isPinned = true;
    message.pinnedBy = userId;
    message.pinnedAt = new Date();
    await message.save();

    this.logger.log(`Message ${messageId} pinned by ${userId}`);
    return message;
  }

  async unpinMessage(messageId: string, userId: string): Promise<IMessage> {
    const message = await this.messageModel.findOne({ _id: messageId, isDeleted: false });
    if (!message) throw new NotFoundException('Message not found');

    const conversation = await this.conversationModel.findOne({
      _id: message.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    message.isPinned = false;
    message.pinnedBy = undefined;
    message.pinnedAt = undefined;
    await message.save();

    this.logger.log(`Message ${messageId} unpinned by ${userId}`);
    return message;
  }

  async getPinnedMessages(conversationId: string, userId: string): Promise<IMessage[]> {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    return this.messageModel
      .find({ conversationId, isPinned: true, isDeleted: false })
      .sort({ pinnedAt: -1 })
      .lean();
  }
}
