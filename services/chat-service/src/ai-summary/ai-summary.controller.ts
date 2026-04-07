import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AiSummaryService } from './ai-summary.service';
import { SmartRepliesService } from './smart-replies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('chat/ai')
@UseGuards(JwtAuthGuard)
export class AiSummaryController {
  constructor(
    private aiSummaryService: AiSummaryService,
    private smartRepliesService: SmartRepliesService,
  ) {}

  @Get('conversations/:id/summary')
  async summarizeConversation(@Param('id') id: string, @Query('count') count: string, @Req() req) {
    const summary = await this.aiSummaryService.summarizeConversation(id, req.user.userId, parseInt(count || '50'));
    return { success: true, data: { summary } };
  }

  @Get('threads/:messageId/summary')
  async summarizeThread(@Param('messageId') messageId: string, @Req() req) {
    const summary = await this.aiSummaryService.summarizeThread(messageId, req.user.userId);
    return { success: true, data: { summary } };
  }

  @Get('conversations/:id/action-items')
  async getActionItems(@Param('id') id: string, @Req() req) {
    const items = await this.aiSummaryService.generateActionItems(id, req.user.userId);
    return { success: true, data: { actionItems: items } };
  }

  @Get('smart-replies/:conversationId')
  async getSmartReplies(@Param('conversationId') conversationId: string, @Req() req) {
    const replies = await this.smartRepliesService.generateSmartReplies(conversationId, req.user.userId);
    return { success: true, data: { replies } };
  }
}
