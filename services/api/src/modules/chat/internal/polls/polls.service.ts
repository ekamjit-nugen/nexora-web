import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<IConversation>,
  ) {}

  async createPoll(
    conversationId: string,
    senderId: string,
    senderName: string,
    question: string,
    options: string[],
    settings?: { multipleChoice?: boolean; anonymous?: boolean; expiresAt?: string; allowAddOptions?: boolean },
  ): Promise<IMessage> {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': senderId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    if (options.length < 2) throw new BadRequestException('Poll must have at least 2 options');
    if (options.length > 10) throw new BadRequestException('Poll can have at most 10 options');

    const message = new this.messageModel({
      conversationId,
      senderId,
      senderName,
      content: question,
      contentPlainText: question,
      type: 'poll',
      poll: {
        question,
        options: options.map(text => ({ id: uuidv4().split('-')[0], text, votes: [] })),
        settings: {
          multipleChoice: settings?.multipleChoice || false,
          anonymous: settings?.anonymous || false,
          expiresAt: settings?.expiresAt ? new Date(settings.expiresAt) : null,
          allowAddOptions: settings?.allowAddOptions || false,
        },
        closedAt: null,
      },
      readBy: [{ userId: senderId, readAt: new Date() }],
    });

    await message.save();

    // Update conversation lastMessage
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: {
        _id: message._id.toString(),
        content: `Poll: ${question}`,
        senderId,
        senderName,
        type: 'poll',
        sentAt: new Date(),
      },
      $inc: { messageCount: 1 },
    });

    this.logger.log(`Poll created in ${conversationId} by ${senderId}`);
    return message;
  }

  async vote(messageId: string, optionId: string, userId: string): Promise<IMessage> {
    const message = await this.messageModel.findOne({ _id: messageId, type: 'poll', isDeleted: false });
    if (!message || !message.poll) throw new NotFoundException('Poll not found');

    if (message.poll.closedAt) throw new BadRequestException('Poll is closed');
    if (message.poll.settings?.expiresAt && new Date() > message.poll.settings.expiresAt) {
      throw new BadRequestException('Poll has expired');
    }

    const option = message.poll.options.find(o => o.id === optionId);
    if (!option) throw new NotFoundException('Option not found');

    // Remove existing vote(s) if not multiple choice
    if (!message.poll.settings?.multipleChoice) {
      for (const opt of message.poll.options) {
        opt.votes = opt.votes.filter(v => v !== userId);
      }
    }

    // Toggle vote
    if (option.votes.includes(userId)) {
      option.votes = option.votes.filter(v => v !== userId);
    } else {
      option.votes.push(userId);
    }

    await message.save();
    return message;
  }

  async closePoll(messageId: string, userId: string): Promise<IMessage> {
    const message = await this.messageModel.findOne({ _id: messageId, type: 'poll', isDeleted: false });
    if (!message || !message.poll) throw new NotFoundException('Poll not found');
    if (message.senderId !== userId) throw new ForbiddenException('Only the poll creator can close it');

    message.poll.closedAt = new Date();
    await message.save();
    this.logger.log(`Poll ${messageId} closed by ${userId}`);
    return message;
  }

  async addOption(messageId: string, userId: string, text: string): Promise<IMessage> {
    const message = await this.messageModel.findOne({ _id: messageId, type: 'poll', isDeleted: false });
    if (!message || !message.poll) throw new NotFoundException('Poll not found');
    if (!message.poll.settings?.allowAddOptions) throw new ForbiddenException('Adding options is not allowed');
    if (message.poll.closedAt) throw new BadRequestException('Poll is closed');
    if (message.poll.options.length >= 10) throw new BadRequestException('Maximum 10 options');

    message.poll.options.push({ id: uuidv4().split('-')[0], text, votes: [] } as any);
    await message.save();
    return message;
  }
}
