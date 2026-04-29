import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import { IsString, IsDateString } from 'class-validator';

class ScheduleMessageDto {
  @IsString() conversationId: string;
  @IsString() content: string;
  @IsDateString() scheduledAt: string;
}

@Controller('chat/scheduled')
@UseGuards(JwtAuthGuard, FeatureGuard)
export class ScheduledMessagesController {
  constructor(private scheduledService: ScheduledMessagesService) {}

  @Get()
  async getScheduledMessages(@Req() req) {
    const messages = await this.scheduledService.getScheduledMessages(req.user.userId);
    return { success: true, data: messages };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async scheduleMessage(@Body() dto: ScheduleMessageDto, @Req() req) {
    const senderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
    const message = await this.scheduledService.scheduleMessage(
      dto.conversationId, req.user.userId, dto.content, new Date(dto.scheduledAt), senderName,
    );
    return { success: true, message: 'Message scheduled', data: message };
  }

  @Delete(':id')
  async cancelScheduledMessage(@Param('id') id: string, @Req() req) {
    await this.scheduledService.cancelScheduledMessage(id, req.user.userId);
    return { success: true, message: 'Scheduled message cancelled' };
  }
}
