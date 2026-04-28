import { Controller, Post, Get, Body, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller()
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private aiService: AiService) {}

  // ── Chat (non-streaming) ──
  @Post('ai/chat')
  @UseGuards(JwtAuthGuard)
  async chat(@Body() body: { messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number }) {
    const res = await this.aiService.chat(body.messages as any, { temperature: body.temperature, maxTokens: body.maxTokens });
    return { success: true, message: 'AI response generated', data: { text: res.text, usage: res.usage } };
  }

  // ── Chat (streaming via SSE) ──
  @Post('ai/chat/stream')
  @UseGuards(JwtAuthGuard)
  async chatStream(
    @Body() body: { messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.aiService.chatStream(body.messages as any, { temperature: body.temperature, maxTokens: body.maxTokens })) {
        if (chunk.startsWith('THINKING:')) {
          res.write(`data: ${JSON.stringify({ type: 'thinking', text: chunk.slice(9) })}\n\n`);
        } else if (chunk.startsWith('CONTENT:')) {
          res.write(`data: ${JSON.stringify({ type: 'content', text: chunk.slice(8) })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`);
        }
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
    res.end();
  }

  // ── Project: Generate Description ──
  @Post('ai/project/description')
  @UseGuards(JwtAuthGuard)
  async generateDescription(@Body() body: { projectName: string; category: string; context?: string }) {
    const description = await this.aiService.generateProjectDescription(body.projectName, body.category, body.context);
    return { success: true, message: 'Description generated', data: { description } };
  }

  // ── Project: Generate Milestones ──
  @Post('ai/project/milestones')
  @UseGuards(JwtAuthGuard)
  async generateMilestones(@Body() body: { projectName: string; category: string; description?: string }) {
    const milestones = await this.aiService.generateMilestones(body.projectName, body.category, body.description);
    return { success: true, message: 'Milestones generated', data: { milestones } };
  }

  // ── Project: Generate Board Tasks ──
  @Post('ai/project/board')
  @UseGuards(JwtAuthGuard)
  async generateBoard(@Body() body: { projectName: string; category: string; milestones: string[]; boardType: string }) {
    const tasks = await this.aiService.generateBoardTasks(body.projectName, body.category, body.milestones, body.boardType);
    return { success: true, message: 'Board tasks generated', data: { tasks } };
  }

  // ── Text: Improve ──
  @Post('ai/text/improve')
  @UseGuards(JwtAuthGuard)
  async improveText(@Body() body: { text: string; instruction: string }) {
    const improved = await this.aiService.improveText(body.text, body.instruction);
    return { success: true, message: 'Text improved', data: { text: improved } };
  }

  // ── Text: Summarize ──
  @Post('ai/text/summarize')
  @UseGuards(JwtAuthGuard)
  async summarize(@Body() body: { text: string; maxLength?: number }) {
    const summary = await this.aiService.summarize(body.text, body.maxLength);
    return { success: true, message: 'Text summarized', data: { text: summary } };
  }

  // ── Project: Generate Full Project Plan ──
  @Post('ai/project/plan')
  @UseGuards(JwtAuthGuard)
  async generateProjectPlan(@Body() body: { projectName: string; category: string; description?: string }) {
    const plan = await this.aiService.generateProjectPlan(body.projectName, body.category, body.description);
    return { success: true, message: 'Project plan generated', data: plan };
  }

  // ── Onboarding: Generate Organization Structure ──
  @Post('ai/onboarding/structure')
  @UseGuards(JwtAuthGuard)
  async generateOnboardingStructure(@Body() body: { orgName: string; industry: string; size: string }) {
    const structure = await this.aiService.generateOnboardingStructure(body.orgName, body.industry, body.size);
    return { success: true, message: 'Onboarding structure generated', data: structure };
  }

  // ── Health: LLM status ──
  @Get('ai/status')
  async llmStatus() {
    const status = await this.aiService.checkLLMHealth();
    return { success: true, message: 'AI status', data: status };
  }
}
