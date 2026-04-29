import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CustomEmojiService } from './custom-emoji.service';
import { JwtAuthGuard } from '../chat/guards/jwt-auth.guard';

import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
@Controller('chat/emoji')
@UseGuards(JwtAuthGuard, FeatureGuard)
export class CustomEmojiController {
  private readonly logger = new Logger(CustomEmojiController.name);

  constructor(private customEmojiService: CustomEmojiService) {}

  @Get()
  async list(@Req() req) {
    const organizationId = req.user.organizationId;
    const emojis = await this.customEmojiService.list(organizationId);
    return { success: true, message: 'Custom emoji retrieved', data: emojis };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: { name: string; url: string }, @Req() req) {
    const emoji = await this.customEmojiService.create(
      body.name,
      body.url,
      req.user.organizationId,
      req.user.userId,
    );
    return { success: true, message: 'Custom emoji created', data: emoji };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req) {
    const result = await this.customEmojiService.delete(
      id,
      req.user.userId,
      req.user.organizationId,
      req.user.roles || [],
    );
    return { success: true, ...result };
  }
}
