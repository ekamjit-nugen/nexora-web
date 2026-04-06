import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from './schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class ForwardingService {
  private readonly logger = new Logger(ForwardingService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  async forwardMessage(messageId: string, targetConversationId: string, userId: string, senderName?: string): Promise<IMessage> {
    const original = await this.messageModel.findOne({ _id: messageId, isDeleted: false });
    if (!original) throw new NotFoundException('Message not found');

    // Verify user is participant in source conversation
    const sourceConvo = await this.conversationModel.findOne({
      _id: original.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!sourceConvo) throw new ForbiddenException('Not a participant of the source conversation');

    // Verify user is participant in target conversation
    const targetConvo = await this.conversationModel.findOne({
      _id: targetConversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!targetConvo) throw new ForbiddenException('Not a participant of the target conversation');

    // Create forwarded message
    const forwarded = new this.messageModel({
      conversationId: targetConversationId,
      senderId: userId,
      senderName: senderName || null,
      content: original.content,
      contentPlainText: original.contentPlainText,
      type: 'forwarded',
      forwardedFrom: {
        messageId: original._id.toString(),
        conversationId: original.conversationId,
        conversationName: sourceConvo.name || null,
        senderId: original.senderId,
        senderName: original.senderName || null,
      },
      // Carry over attachments (by reference, not copied)
      attachments: original.attachments,
      fileUrl: original.fileUrl,
      fileName: original.fileName,
      fileSize: original.fileSize,
      fileMimeType: original.fileMimeType,
      readBy: [{ userId, readAt: new Date() }],
    });

    await forwarded.save();

    // Update target conversation lastMessage
    await this.conversationModel.findByIdAndUpdate(targetConversationId, {
      lastMessage: {
        _id: forwarded._id.toString(),
        content: `Forwarded: ${(original.content || '').substring(0, 80)}`,
        senderId: userId,
        senderName: senderName || null,
        type: 'forwarded',
        sentAt: new Date(),
      },
      $inc: { messageCount: 1 },
    });

    this.logger.log(`Message ${messageId} forwarded to ${targetConversationId} by ${userId}`);
    return forwarded;
  }
}
