import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as DOMPurify from 'isomorphic-dompurify';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  async scheduleMessage(
    conversationId: string, senderId: string, content: string,
    scheduledAt: Date, senderName?: string,
  ): Promise<IMessage> {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': senderId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const sanitizedContent = content ? DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'i', 'u', 's', 'em', 'strong', 'a', 'code', 'pre', 'br', 'p', 'ul', 'ol', 'li', 'blockquote'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    }) : '';
    const contentPlainText = sanitizedContent ? sanitizedContent.replace(/<[^>]*>/g, '').replace(/[*_~`#>\[\]()!|]/g, '').trim() : '';

    const message = new this.messageModel({
      conversationId,
      senderId,
      senderName: senderName || null,
      content: sanitizedContent,
      contentPlainText,
      type: 'text',
      isScheduled: true,
      scheduledAt,
      readBy: [],
    });

    await message.save();
    this.logger.log(`Message scheduled for ${scheduledAt.toISOString()} in ${conversationId} by ${senderId}`);
    return message;
  }

  async getScheduledMessages(userId: string): Promise<IMessage[]> {
    return this.messageModel.find({
      senderId: userId,
      isScheduled: true,
      isDeleted: false,
      scheduledAt: { $gt: new Date() },
    }).sort({ scheduledAt: 1 }).lean() as any;
  }

  async cancelScheduledMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageModel.findOne({
      _id: messageId, senderId: userId, isScheduled: true, isDeleted: false,
    });
    if (!message) throw new NotFoundException('Scheduled message not found');

    await this.messageModel.findByIdAndUpdate(messageId, {
      isDeleted: true, deletedAt: new Date(), deletedBy: userId,
    });
    this.logger.log(`Scheduled message ${messageId} cancelled by ${userId}`);
  }

  /**
   * Publish due scheduled messages.
   * Called by a cron job / BullMQ scheduled task.
   */
  async publishDueMessages(): Promise<number> {
    const now = new Date();
    const dueMessages = await this.messageModel.find({
      isScheduled: true,
      scheduledAt: { $lte: now },
      isDeleted: false,
    });

    let published = 0;
    for (const msg of dueMessages) {
      msg.isScheduled = false;
      msg.readBy = [{ userId: msg.senderId, readAt: now } as any];
      await msg.save();

      // Update conversation lastMessage
      await this.conversationModel.findByIdAndUpdate(msg.conversationId, {
        lastMessage: {
          _id: msg._id.toString(),
          content: (msg.content || '').substring(0, 100),
          senderId: msg.senderId,
          senderName: msg.senderName || null,
          type: msg.type,
          sentAt: now,
        },
        $inc: { messageCount: 1 },
      });

      published++;
    }

    if (published > 0) {
      this.logger.log(`Published ${published} scheduled messages`);
    }
    return published;
  }
}
