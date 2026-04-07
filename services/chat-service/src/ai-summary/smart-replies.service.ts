import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

/**
 * E3 7.1: AI Smart Replies.
 * Generates 3 short reply suggestions based on recent conversation context.
 * Only for DMs and small groups (not channels).
 */
@Injectable()
export class SmartRepliesService {
  private readonly logger = new Logger(SmartRepliesService.name);
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:7/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  /**
   * Generate smart reply suggestions for a conversation.
   * Fetches the last 10 messages and asks the LLM for 3 short suggestions.
   */
  async generateSmartReplies(conversationId: string, userId: string): Promise<string[]> {
    // Verify user is a participant
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      'participants.userId': userId,
      isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    // Only generate for DMs and small groups, not channels
    if (conversation.type === 'channel') return [];

    // Fetch last 10 messages
    const messages = await this.messageModel.find({
      conversationId,
      isDeleted: false,
      type: { $in: ['text', 'forwarded'] },
    }).sort({ createdAt: -1 }).limit(10).lean();

    if (messages.length === 0) return [];

    // Don't suggest replies if the last message is from the current user
    if (messages[0].senderId === userId) return [];

    // Build conversation transcript (oldest first)
    const transcript = messages.reverse().map(m =>
      `${m.senderName || m.senderId}: ${m.contentPlainText || m.content}`
    ).join('\n');

    try {
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are a smart reply suggestion engine for a workplace chat.
Given this conversation, suggest exactly 3 short, professional reply options that the user might want to send.
Each reply must be under 50 characters.
Return ONLY a JSON array of 3 strings.
Example: ["Sure, I'll take a look", "Let me check and get back to you", "Thanks for letting me know"]`,
          },
          { role: 'user', content: `Conversation:\n${transcript}` },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }, { timeout: 10000 });

      const text = res.data?.choices?.[0]?.message?.content?.trim() || '[]';
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const replies = JSON.parse(cleaned);
      return Array.isArray(replies) ? replies.slice(0, 3).map((r: any) => String(r).slice(0, 50)) : [];
    } catch (err) {
      this.logger.debug(`Smart replies generation failed: ${err.message}`);
      return [];
    }
  }
}
