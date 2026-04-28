import {
  Body, Controller, Delete, ForbiddenException, Get, Logger,
  Param, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../bootstrap/auth/jwt-auth.guard';
import { ChatbotService } from './chatbot.service';
import { OllamaClient } from './ollama.client';

/**
 * Chatbot HTTP API. ALL routes are JWT-guarded; tenant scope comes
 * from `request.user.organizationId` (set by JwtAuthGuard) and is
 * never accepted from the client.
 *
 * Routes:
 *   GET  /api/v1/chatbot/health                — model + endpoint
 *   GET  /api/v1/chatbot/conversations         — list mine
 *   GET  /api/v1/chatbot/conversations/:id     — load one (own only)
 *   POST /api/v1/chatbot/ask                   — buffered Q&A
 *   POST /api/v1/chatbot/stream                — SSE token-by-token
 *   DELETE /api/v1/chatbot/conversations/:id   — soft delete
 */
@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  private readonly log = new Logger(ChatbotController.name);

  constructor(
    private readonly chatbot: ChatbotService,
    private readonly ollama: OllamaClient,
  ) {}

  @Get('health')
  health() {
    return { ok: true, ...this.ollama.health() };
  }

  @Get('conversations')
  async list(@Req() req: any, @Query('limit') limit?: string) {
    return this.chatbot.listConversations(
      req.user.organizationId,
      req.user.userId,
      limit ? Number(limit) : 20,
    );
  }

  @Get('conversations/:id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.chatbot.getConversation(
      req.user.organizationId,
      req.user.userId,
      id,
    );
  }

  @Delete('conversations/:id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.chatbot.deleteConversation(
      req.user.organizationId,
      req.user.userId,
      id,
    );
  }

  @Post('ask')
  async ask(
    @Req() req: any,
    @Body() body: { message: string; conversationId?: string },
  ) {
    if (!body?.message?.trim()) {
      return { error: 'message is required' };
    }
    return this.chatbot.ask(
      req.user.organizationId,
      req.user.userId,
      this.userContext(req),
      body.message.trim(),
      body.conversationId,
    );
  }

  /**
   * SSE streaming endpoint — preferred by the frontend chat widget for
   * the typewriter effect.
   *
   * Wire format: lines of `data: {"chunk":"...", "conversationId":"..."}\n\n`
   * Final event: `data: {"done":true, "conversationId":"..."}\n\n`
   */
  @Post('stream')
  async stream(
    @Req() req: any,
    @Body() body: { message: string; conversationId?: string },
    @Res() res: Response,
  ) {
    if (!body?.message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const it = this.chatbot.askStream(
        req.user.organizationId,
        req.user.userId,
        this.userContext(req),
        body.message.trim(),
        body.conversationId,
      );
      for await (const evt of it) {
        send(evt);
        if (evt.done) break;
      }
    } catch (err: any) {
      this.log.error(`stream error: ${err.message}`);
      send({ error: err.message || 'stream failed' });
    } finally {
      res.end();
    }
  }

  private userContext(req: any) {
    return {
      firstName: req.user.firstName,
      orgName: undefined as string | undefined, // resolved by frontend if needed
      orgRole: req.user.orgRole || (req.user.roles?.[0] ?? undefined),
    };
  }
}
