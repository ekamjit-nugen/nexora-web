import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

/**
 * AI Summarization Service.
 * Integrates with Nexora's AI service (or direct LLM) to generate:
 * - Conversation summaries (recent N messages)
 * - Meeting notes (from transcript)
 * - Thread summaries
 */
@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);
  private readonly aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:3080';
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:7/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  async summarizeConversation(conversationId: string, userId: string, messageCount: number = 50): Promise<string> {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const messages = await this.messageModel.find({
      conversationId, isDeleted: false, type: { $in: ['text', 'forwarded'] },
    }).sort({ createdAt: -1 }).limit(messageCount).lean();

    if (messages.length === 0) return 'No messages to summarize.';

    const transcript = messages.reverse().map(m =>
      `${m.senderName || m.senderId}: ${m.contentPlainText || m.content}`
    ).join('\n');

    return this.callLLM(
      `Summarize this conversation concisely. Focus on key decisions, action items, and important topics discussed. Keep it under 200 words.`,
      transcript,
    );
  }

  async summarizeThread(rootMessageId: string, userId: string): Promise<string> {
    const rootMessage = await this.messageModel.findById(rootMessageId);
    if (!rootMessage) throw new NotFoundException('Message not found');

    const conversation = await this.conversationModel.findOne({
      _id: rootMessage.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const replies = await this.messageModel.find({
      threadId: rootMessageId, isDeleted: false,
    }).sort({ createdAt: 1 }).limit(100).lean();

    const allMessages = [rootMessage, ...replies];
    const transcript = allMessages.map(m =>
      `${(m as any).senderName || m.senderId}: ${(m as any).contentPlainText || m.content}`
    ).join('\n');

    return this.callLLM(
      `Summarize this thread discussion concisely. Highlight the main topic, key points, and any conclusions reached. Keep it under 150 words.`,
      transcript,
    );
  }

  async generateActionItems(conversationId: string, userId: string): Promise<string[]> {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const messages = await this.messageModel.find({
      conversationId, isDeleted: false, type: { $in: ['text', 'forwarded'] },
    }).sort({ createdAt: -1 }).limit(50).lean();

    if (messages.length === 0) return [];

    const transcript = messages.reverse().map(m =>
      `${m.senderName || m.senderId}: ${m.contentPlainText || m.content}`
    ).join('\n');

    const result = await this.callLLM(
      `Extract action items from this conversation. Return only a JSON array of strings, each being one action item. If no action items found, return [].`,
      transcript,
    );

    try {
      const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return [result];
    }
  }

  private async callLLM(systemPrompt: string, userContent: string): Promise<string> {
    try {
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }, { timeout: 60000 });

      return res.data?.choices?.[0]?.message?.content?.trim() || 'Unable to generate summary.';
    } catch (err) {
      this.logger.warn(`LLM call failed: ${err.message}`);
      return 'AI summarization temporarily unavailable.';
    }
  }
}
