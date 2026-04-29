import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin client for the Ollama HTTP API.
 *
 * Endpoint defaults to a self-hosted Ollama running qwen2.5-coder:7b.
 * Override via OLLAMA_URL / OLLAMA_MODEL env vars for staging or
 * to swap models without code changes.
 *
 * Two methods:
 *   - chat(messages):     buffered request, full response when done
 *   - chatStream(messages, onToken): streams tokens via async iterator,
 *                                    used by the SSE controller route
 */

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatResponse {
  message: OllamaMessage;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

@Injectable()
export class OllamaClient {
  private readonly log = new Logger(OllamaClient.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(cfg: ConfigService) {
    this.baseUrl = cfg.get<string>('OLLAMA_URL') || 'http://216.48.177.40:11434';
    this.model = cfg.get<string>('OLLAMA_MODEL') || 'qwen2.5-coder:7b';
    this.timeoutMs = Number(cfg.get<string>('OLLAMA_TIMEOUT_MS') || 60_000);
  }

  /**
   * Sampling options.
   * temperature 0.85 — slightly above default so Nexie's openers and
   *   emoji picks don't feel canned across turns, but low enough to
   *   keep factual answers stable.
   * top_p 0.9 — standard nucleus filter.
   * repeat_penalty 1.1 — gently discourages repeated phrasing within
   *   a conversation (e.g. starting every reply with "Sure!").
   */
  private samplingOptions() {
    return {
      temperature: 0.85,
      top_p: 0.9,
      repeat_penalty: 1.1,
    };
  }

  /** Buffered (non-streaming) chat completion. */
  async chat(messages: OllamaMessage[]): Promise<OllamaChatResponse> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: this.samplingOptions(),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as OllamaChatResponse;
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Streaming chat — yields token chunks as they arrive from Ollama.
   * Each yielded value is a partial assistant message string. The
   * caller assembles them by concatenation, AND can forward each
   * chunk to the client as an SSE event for live typing UX.
   */
  async *chatStream(messages: OllamaMessage[]): AsyncGenerator<string, void, void> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: this.samplingOptions(),
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.text();
        throw new Error(`Ollama stream ${res.status}: ${body.slice(0, 200)}`);
      }
      // Ollama streams newline-delimited JSON objects.
      const decoder = new TextDecoder();
      const reader = (res.body as any).getReader
        ? (res.body as any).getReader()
        : null;
      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              const piece = obj?.message?.content;
              if (piece) yield piece;
            } catch {
              // skip malformed line
            }
          }
        }
      } else {
        // Node stream fallback — undici returns a Readable in newer Node.
        for await (const chunk of res.body as any) {
          const text = decoder.decode(chunk, { stream: true });
          for (const line of text.split('\n')) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              const piece = obj?.message?.content;
              if (piece) yield piece;
            } catch {
              // skip
            }
          }
        }
      }
    } finally {
      clearTimeout(t);
    }
  }

  health(): { url: string; model: string } {
    return { url: this.baseUrl, model: this.model };
  }
}
