import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { VoiceMessagesService } from './voice-messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsNumber } from 'class-validator';

class SendVoiceMessageDto {
  @IsString() conversationId: string;
  @IsString() audioUrl: string;
  @IsNumber() duration: number;
  @IsNumber() fileSize: number;
}

@Controller('chat/voice')
@UseGuards(JwtAuthGuard)
export class VoiceMessagesController {
  constructor(private voiceService: VoiceMessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendVoiceMessage(@Body() dto: SendVoiceMessageDto, @Req() req) {
    const senderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
    const message = await this.voiceService.sendVoiceMessage(
      dto.conversationId, req.user.userId, senderName, dto.audioUrl, dto.duration, dto.fileSize,
    );
    return { success: true, message: 'Voice message sent', data: message };
  }
}
