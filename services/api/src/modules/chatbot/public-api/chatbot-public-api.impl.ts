import { Injectable } from '@nestjs/common';
import { ChatbotPublicApi } from './chatbot-public-api';
import { OllamaClient } from '../internal/ollama.client';

@Injectable()
export class ChatbotPublicApiImpl implements ChatbotPublicApi {
  constructor(private readonly ollama: OllamaClient) {}

  async isHealthy(): Promise<boolean> {
    try {
      const h = this.ollama.health();
      // Light probe — model list endpoint is faster than a full chat call.
      const res = await fetch(`${h.url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
