import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * E3 10.3: AI Conversation Catchup — "What did I miss?"
 * Summarizes all messages since user's last read position.
 * More targeted than general AI summary — specifically covers the user's unread gap.
 */
@Injectable()
export class ConversationCatchupService {
  private readonly logger = new Logger(ConversationCatchupService.name);
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:7/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  constructor(
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<any>,
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<any>,
  ) {}

  async getCatchup(conversationId: string, userId: string): Promise<{ summary: string; messageCount: number; since: Date }> {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    const participant = conversation.participants.find((p: any) => p.userId === userId);
    const lastReadAt = participant?.lastReadAt || new Date(0);

    // Get unread messages
    const unreadMessages = await this.messageModel.find({
      conversationId,
      createdAt: { $gt: lastReadAt },
      senderId: { $ne: userId },
      isDeleted: false,
      type: { $in: ['text', 'forwarded', 'poll'] },
    }).sort({ createdAt: 1 }).limit(100).lean();

    if (unreadMessages.length === 0) {
      return { summary: "You're all caught up! No new messages.", messageCount: 0, since: lastReadAt };
    }

    const transcript = unreadMessages.map((m: any) =>
      `${m.senderName || 'Unknown'}: ${m.contentPlainText || m.content || '[media]'}`
    ).join('\n');

    try {
      const axios = (await (Function('return import("axios")')())).default;
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are a chat catchup assistant. The user has been away and needs to know what happened.
Summarize the messages they missed in a brief, casual format. Mention who said what.
Keep it under 200 words. Use present tense ("Dave reports...", "Alice suggests...").
If there are action items or decisions that affect the user, highlight them.`,
          },
          {
            role: 'user',
            content: `I missed ${unreadMessages.length} messages. Here's what was said:\n\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }, { timeout: 30000 });

      const summary = res.data?.choices?.[0]?.message?.content?.trim() || 'Unable to generate catchup.';
      return { summary, messageCount: unreadMessages.length, since: lastReadAt };
    } catch (err) {
      this.logger.warn(`Catchup generation failed: ${err.message}`);
      return {
        summary: `You missed ${unreadMessages.length} messages since ${lastReadAt.toLocaleString()}.`,
        messageCount: unreadMessages.length,
        since: lastReadAt,
      };
    }
  }
}
