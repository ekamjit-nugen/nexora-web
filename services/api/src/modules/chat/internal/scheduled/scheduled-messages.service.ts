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
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<IConversation>,
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
    const BATCH_SIZE = 100;
    let published = 0;
    let lastId: string | null = null;

    // M-012: Process in batches of 100 using cursor-based pagination
    while (true) {
      const query: any = {
        isScheduled: true,
        scheduledAt: { $lte: now },
        isDeleted: false,
      };
      if (lastId) {
        query._id = { $gt: lastId };
      }

      const batch = await this.messageModel
        .find(query)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE);

      if (batch.length === 0) break;

      for (const msg of batch) {
        // UC-024: Skip messages whose conversation has been deleted
        const conversation = await this.conversationModel.findOne({
          _id: msg.conversationId, isDeleted: false,
        });
        if (!conversation) {
          this.logger.warn(`Skipping scheduled message ${msg._id}: conversation ${msg.conversationId} deleted or not found`);
          msg.isDeleted = true;
          msg.deletedAt = new Date();
          await msg.save();
          lastId = msg._id.toString();
          continue;
        }

        msg.isScheduled = false;
        msg.readBy = [{ userId: msg.senderId, readAt: now } as any];
        await msg.save();

        // TODO XS-010: Emit the published message via WebSocket so participants see it in
        // real time. This requires injecting the ChatGateway (or publishing to Redis pub/sub
        // so the gateway picks it up). Without this, clients only see the message on next
        // poll or page refresh.

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
        lastId = msg._id.toString();
      }

      if (batch.length < BATCH_SIZE) break;
    }

    if (published > 0) {
      this.logger.log(`Published ${published} scheduled messages`);
    }
    return published;
  }
}
