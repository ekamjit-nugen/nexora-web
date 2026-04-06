import { Injectable, Logger } from '@nestjs/common';

/**
 * E3 7.1: AI Smart Replies.
 * Generates 2-3 short reply suggestions based on incoming message context.
 * Only for DMs and small groups (not channels).
 */
@Injectable()
export class SmartRepliesService {
  private readonly logger = new Logger(SmartRepliesService.name);
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:7/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  async generateReplies(messageContent: string, conversationType: string): Promise<string[]> {
    // Only generate for DMs and small groups
    if (conversationType === 'channel') return [];
    if (!messageContent?.trim()) return [];

    try {
      const axios = (await (Function('return import("axios")')())).default;
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are a smart reply suggestion engine for a workplace chat.
Given the incoming message, suggest exactly 3 short, professional reply options.
Return ONLY a JSON array of 3 strings, each under 50 characters.
Example: ["Sure, I'll take a look", "Let me check and get back to you", "Thanks for letting me know"]`,
          },
          { role: 'user', content: `Message: "${messageContent}"` },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }, { timeout: 10000 });

      const text = res.data?.choices?.[0]?.message?.content?.trim() || '[]';
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const replies = JSON.parse(cleaned);
      return Array.isArray(replies) ? replies.slice(0, 3) : [];
    } catch (err) {
      this.logger.debug(`Smart replies generation failed: ${err.message}`);
      return [];
    }
  }
}
