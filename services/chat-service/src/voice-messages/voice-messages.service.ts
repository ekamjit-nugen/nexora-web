import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

/**
 * Voice Messages Service.
 * Handles press-and-hold audio recording sent as audio messages.
 * Audio file is uploaded to media-service, then a message of type 'audio' is created.
 */
@Injectable()
export class VoiceMessagesService {
  private readonly logger = new Logger(VoiceMessagesService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  async sendVoiceMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    audioUrl: string,
    duration: number,
    fileSize: number,
  ): Promise<IMessage> {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': senderId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const message = new this.messageModel({
      conversationId,
      senderId,
      senderName,
      content: `Voice message (${this.formatDuration(duration)})`,
      contentPlainText: 'Voice message',
      type: 'audio',
      fileUrl: audioUrl,
      fileName: 'voice-message.webm',
      fileSize,
      fileMimeType: 'audio/webm',
      readBy: [{ userId: senderId, readAt: new Date() }],
    });

    await message.save();

    // Update conversation lastMessage
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: {
        _id: message._id.toString(),
        content: `🎤 Voice message (${this.formatDuration(duration)})`,
        senderId,
        senderName,
        type: 'audio',
        sentAt: new Date(),
      },
      $inc: { messageCount: 1 },
    });

    this.logger.log(`Voice message sent in ${conversationId} by ${senderId} (${duration}s)`);
    return message;
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
