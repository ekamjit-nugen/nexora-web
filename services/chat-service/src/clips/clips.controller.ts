import {
  Controller, Get, Post,
  Body, Param, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { ClipsService } from './clips.service';
import { JwtAuthGuard } from '../chat/guards/jwt-auth.guard';

@Controller('chat/clips')
@UseGuards(JwtAuthGuard)
export class ClipsController {
  private readonly logger = new Logger(ClipsController.name);

  constructor(private clipsService: ClipsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createClip(
    @Body() body: {
      conversationId: string;
      mediaUrl: string;
      duration: number;
      fileSize?: number;
      mimeType?: string;
    },
    @Req() req,
  ) {
    const clip = await this.clipsService.createClip({
      conversationId: body.conversationId,
      senderId: req.user.userId,
      senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
      organizationId: req.user.organizationId || '',
      mediaUrl: body.mediaUrl,
      duration: body.duration,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
    });
    return { success: true, message: 'Clip created', data: clip };
  }

  @Get(':id')
  async getClip(@Param('id') id: string) {
    const clip = await this.clipsService.getClip(id);
    return { success: true, message: 'Clip retrieved', data: clip };
  }

  @Get(':id/transcription')
  async getTranscription(@Param('id') id: string) {
    const transcription = await this.clipsService.getTranscription(id);
    return { success: true, message: 'Transcription retrieved', data: transcription };
  }
}
