import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ThreadReplyDto {
  @IsString()
  content: string;
}

class ThreadQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

@Controller('chat/threads')
@UseGuards(JwtAuthGuard, FeatureGuard)
export class ThreadsController {
  constructor(private threadsService: ThreadsService) {}

  @Get(':messageId')
  async getThreadReplies(@Param('messageId') messageId: string, @Query() query: ThreadQueryDto, @Req() req) {
    const result = await this.threadsService.getThreadReplies(messageId, req.user.userId, query.page, query.limit);
    return { success: true, message: 'Thread replies retrieved', data: result };
  }

  @Post(':messageId/reply')
  @HttpCode(HttpStatus.CREATED)
  async replyToThread(@Param('messageId') messageId: string, @Body() dto: ThreadReplyDto, @Req() req) {
    const senderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
    const reply = await this.threadsService.replyToThread(messageId, req.user.userId, dto.content, senderName);
    return { success: true, message: 'Thread reply sent', data: reply };
  }

  @Post(':messageId/follow')
  @HttpCode(HttpStatus.OK)
  async followThread(@Param('messageId') messageId: string, @Req() req) {
    const result = await this.threadsService.followThread(messageId, req.user.userId);
    return { success: true, message: 'Thread followed', data: result };
  }

  @Delete(':messageId/follow')
  async unfollowThread(@Param('messageId') messageId: string, @Req() req) {
    const result = await this.threadsService.unfollowThread(messageId, req.user.userId);
    return { success: true, message: 'Thread unfollowed', data: result };
  }
}
