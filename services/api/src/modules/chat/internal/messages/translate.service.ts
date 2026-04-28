import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from './schemas/message.schema';

/**
 * E3 6.5: Message Translation Service.
 * Translates messages to target language using LLM or external API.
 * Caches translations on the message document.
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:7/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  // M-009: Whitelist of supported target languages
  private readonly SUPPORTED_LANGS = [
    'en', 'hi', 'pa', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml',
    'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru',
  ];

  constructor(
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
  ) {}

  async translateMessage(messageId: string, targetLanguage: string): Promise<{ original: string; translated: string; language: string }> {
    // M-009: Validate target language against whitelist
    if (!this.SUPPORTED_LANGS.includes(targetLanguage)) {
      throw new BadRequestException(`Unsupported language: ${targetLanguage}. Supported: ${this.SUPPORTED_LANGS.join(', ')}`);
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    const content = message.contentPlainText || message.content || '';
    if (!content.trim()) throw new NotFoundException('No content to translate');

    // Check cache
    const cached = (message as any).translations?.[targetLanguage];
    if (cached) return { original: content, translated: cached, language: targetLanguage };

    // Translate via LLM
    const translated = await this.callTranslateApi(content, targetLanguage);

    // Cache on message document
    await this.messageModel.findByIdAndUpdate(messageId, {
      $set: { [`translations.${targetLanguage}`]: translated },
    });

    this.logger.log(`Translated message ${messageId} to ${targetLanguage}`);
    return { original: content, translated, language: targetLanguage };
  }

  private async callTranslateApi(text: string, targetLanguage: string): Promise<string> {
    try {
      // M-011: Use require instead of dynamic Function() eval
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const axios = require('axios');
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: false,
        messages: [
          { role: 'system', content: `Translate the following text to ${targetLanguage}. Return only the translated text, nothing else.` },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }, { timeout: 30000 });

      return res.data?.choices?.[0]?.message?.content?.trim() || text;
    } catch (err) {
      this.logger.warn(`Translation failed: ${err.message}`);
      return `[Translation unavailable for ${targetLanguage}]`;
    }
  }
}
