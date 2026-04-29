import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IConversation } from './schemas/conversation.schema';
import { OllamaClient, OllamaMessage } from './ollama.client';
import { NEXORA_KNOWLEDGE } from '../knowledge/nexora-knowledge';
import { CHATBOT_DB } from '../../../bootstrap/database/database.tokens';
import { TenantContextService } from './tenant-context.service';
import { IntentEnrichmentService } from './intent-enrichment.service';

/**
 * Multi-tenant chatbot service.
 *
 * THE TENANT-ISOLATION ALGORITHM (do not bypass):
 *
 *   1. Every public method takes (organizationId, userId) as required
 *      args. They come from the JWT in the controller and CANNOT be
 *      provided by the client.
 *
 *   2. Every Mongo query for conversations filters by both
 *      `organizationId` and `userId`. There is no "load conversation by
 *      id" path that doesn't also enforce the org match — see
 *      `loadConversation`.
 *
 *   3. The system prompt is constructed PER REQUEST and includes
 *      ONLY the user's own organization context. We never paste
 *      another tenant's data into the prompt because we never read
 *      another tenant's data.
 *
 *   4. The LLM does not have direct DB access (no function-calling).
 *      Anything the LLM "knows" about a specific tenant comes from
 *      the system prompt's safe block we constructed.
 *
 *   5. Conversations from one org NEVER appear when listing another
 *      org's conversations. Even if a user knows the conversation id,
 *      the load query 404s if their org doesn't match.
 */
@Injectable()
export class ChatbotService {
  private readonly log = new Logger(ChatbotService.name);

  constructor(
    @InjectModel('Conversation', CHATBOT_DB)
    private readonly conversationModel: Model<IConversation>,
    private readonly ollama: OllamaClient,
    private readonly tenantContext: TenantContextService,
    private readonly intentEnrichment: IntentEnrichmentService,
  ) {}

  /** List conversations for the current user — strictly tenant scoped. */
  async listConversations(organizationId: string, userId: string, limit = 20) {
    return this.conversationModel
      .find({ organizationId, userId, isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit, 100))
      .lean();
  }

  /** Get one conversation. 404 if it doesn't belong to this user+org. */
  async getConversation(
    organizationId: string,
    userId: string,
    conversationId: string,
  ) {
    const c = await this.conversationModel
      .findOne({
        _id: conversationId,
        organizationId,
        userId,
        isDeleted: false,
      })
      .lean();
    if (!c) {
      // Deliberately 404 (not 403) so we don't reveal that the id
      // exists in another tenant.
      throw new NotFoundException('Conversation not found');
    }
    return c;
  }

  /** Soft-delete a conversation. */
  async deleteConversation(
    organizationId: string,
    userId: string,
    conversationId: string,
  ) {
    const r = await this.conversationModel.updateOne(
      { _id: conversationId, organizationId, userId, isDeleted: false },
      { $set: { isDeleted: true } },
    );
    if (r.matchedCount === 0) {
      throw new NotFoundException('Conversation not found');
    }
    return { deleted: true };
  }

  /**
   * Ask a question. Buffered version — full response returned at end.
   * Use this from automation / non-UI callers. The streaming path is
   * `askStream(...)` below, called from the SSE controller route.
   */
  async ask(
    organizationId: string,
    userId: string,
    userContext: { firstName?: string; orgName?: string; orgRole?: string; isPlatformAdmin?: boolean },
    message: string,
    conversationId?: string,
  ): Promise<{ conversationId: string; reply: string }> {
    const t0 = Date.now();
    const conv = await this.loadOrCreateConversation(organizationId, userId, conversationId);
    const [snapshot, intentBlock] = await Promise.all([
      this.tenantContext
        .fetch(organizationId, userId, userContext.orgRole || 'member', !!userContext.isPlatformAdmin)
        .catch(() => null),
      this.intentEnrichment
        .detectAndFetch(message, organizationId, userId, userContext.orgRole || 'member')
        .catch(() => null),
    ]);
    const messages = this.buildPrompt(conv, userContext, message, snapshot, intentBlock);

    let reply = '';
    try {
      const res = await this.ollama.chat(messages);
      reply = res.message?.content || '(no response)';
    } catch (err: any) {
      this.log.error(`Ollama call failed: ${err.message}`);
      throw err;
    }

    const latencyMs = Date.now() - t0;
    conv.messages.push({ role: 'user', content: message, createdAt: new Date() });
    conv.messages.push({
      role: 'assistant',
      content: reply,
      createdAt: new Date(),
      latencyMs,
    });

    // Auto-title from first user message if still default
    if (conv.title === 'New conversation' && conv.messages.length <= 3) {
      conv.title = message.slice(0, 60);
    }
    await conv.save();
    return { conversationId: String(conv._id), reply };
  }

  /**
   * Streaming variant — yields token chunks. The full assembled reply
   * is persisted at end-of-stream. Caller is responsible for forwarding
   * each chunk down the SSE channel.
   */
  async *askStream(
    organizationId: string,
    userId: string,
    userContext: { firstName?: string; orgName?: string; orgRole?: string; isPlatformAdmin?: boolean },
    message: string,
    conversationId?: string,
  ): AsyncGenerator<{ chunk?: string; done?: boolean; conversationId: string }, void, void> {
    const t0 = Date.now();
    const conv = await this.loadOrCreateConversation(organizationId, userId, conversationId);
    const [snapshot, intentBlock] = await Promise.all([
      this.tenantContext
        .fetch(organizationId, userId, userContext.orgRole || 'member', !!userContext.isPlatformAdmin)
        .catch(() => null),
      this.intentEnrichment
        .detectAndFetch(message, organizationId, userId, userContext.orgRole || 'member')
        .catch(() => null),
    ]);
    const messages = this.buildPrompt(conv, userContext, message, snapshot, intentBlock);

    let assembled = '';
    try {
      for await (const chunk of this.ollama.chatStream(messages)) {
        assembled += chunk;
        yield { chunk, conversationId: String(conv._id) };
      }
    } catch (err: any) {
      this.log.error(`Ollama stream failed: ${err.message}`);
      yield {
        chunk: `\n\n_Sorry, I had trouble reaching the language model: ${err.message}._`,
        conversationId: String(conv._id),
      };
      assembled +=
        '\n\n_Sorry, I had trouble reaching the language model._';
    }

    const latencyMs = Date.now() - t0;
    conv.messages.push({ role: 'user', content: message, createdAt: new Date() });
    conv.messages.push({
      role: 'assistant',
      content: assembled || '(empty response)',
      createdAt: new Date(),
      latencyMs,
    });
    if (conv.title === 'New conversation' && conv.messages.length <= 3) {
      conv.title = message.slice(0, 60);
    }
    await conv.save();
    yield { done: true, conversationId: String(conv._id) };
  }

  // ─── private helpers ─────────────────────────────────────────────

  private async loadOrCreateConversation(
    organizationId: string,
    userId: string,
    conversationId?: string,
  ): Promise<IConversation> {
    if (conversationId) {
      const existing = await this.conversationModel.findOne({
        _id: conversationId,
        organizationId,
        userId,
        isDeleted: false,
      });
      if (existing) return existing;
      // If the id is from another tenant or was deleted, silently
      // start a new conversation rather than leaking 404.
    }
    return new this.conversationModel({
      organizationId,
      userId,
      title: 'New conversation',
      messages: [],
    });
  }

  private buildPrompt(
    conv: IConversation,
    userContext: { firstName?: string; orgName?: string; orgRole?: string; isPlatformAdmin?: boolean },
    newMessage: string,
    snapshot?: any,
    intentBlock?: string | null,
  ): OllamaMessage[] {
    // System prompt = persona + workflow knowledge + LIVE tenant snapshot
    // + (when relevant) live data block fetched on intent.
    // No other tenant's data ever appears here because every query is
    // filtered by the caller's organizationId server-side.
    const fallbackCtx = [
      userContext.firstName ? `User's first name: ${userContext.firstName}` : '',
      userContext.orgName ? `User's organization: ${userContext.orgName}` : '',
      userContext.orgRole ? `User's role: ${userContext.orgRole}` : '',
    ].filter(Boolean).join('\n');

    // Prefer the live snapshot block when available (richer + accurate
    // numbers); fall back to the JWT-only context for the rare case
    // where the tenant-context query fails.
    const tenantBlock = snapshot
      ? this.tenantContext.toPromptBlock(snapshot)
      : '## Current user context\n' + fallbackCtx;

    const systemContent = [
      NEXORA_KNOWLEDGE,
      tenantBlock,
      intentBlock || '', // empty string is fine — appended cleanly when present
    ].filter(Boolean).join('\n\n');

    const system: OllamaMessage = {
      role: 'system',
      content: systemContent,
    };

    // Trim long history to keep prompt size reasonable. Take last 12
    // turns (6 user + 6 assistant) — enough for short context, prevents
    // runaway token consumption.
    const recent = conv.messages.slice(-12).map(
      (m): OllamaMessage => ({ role: m.role as any, content: m.content }),
    );

    return [system, ...recent, { role: 'user', content: newMessage }];
  }
}
