import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { VoiceMessagesService } from './voice-messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsNumber } from 'class-validator';

class SendVoiceMessageDto {
  @IsString() conversationId: string;
  @IsString() audioUrl: string;
  @IsNumber() duration: number;
  @IsNumber() fileSize: number;
}

class TranscribeVoiceMessageDto {
  @IsString() transcription: string;
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

  @Post(':messageId/transcribe')
  @HttpCode(HttpStatus.OK)
  async transcribeVoiceMessage(
    @Param('messageId') messageId: string,
    @Body() dto: TranscribeVoiceMessageDto,
    @Req() req,
  ) {
    const message = await this.voiceService.transcribeVoiceMessage(
      messageId, req.user.userId, dto.transcription,
    );
    return { success: true, message: 'Transcription saved', data: message };
  }

  @Get(':messageId/transcription')
  async getTranscription(@Param('messageId') messageId: string, @Req() req) {
    const transcription = await this.voiceService.getTranscription(messageId, req.user.userId);
    return { success: true, data: { transcription } };
  }
}
