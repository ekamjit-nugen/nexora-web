import { Controller, Get, Put, Body, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsOptional, IsArray } from 'class-validator';

class SetStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  customEmoji?: string;

  @IsOptional()
  @IsString()
  customText?: string;
}

class BatchPresenceDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

@Controller('chat/presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private presenceService: PresenceService) {}

  @Put('status')
  @HttpCode(HttpStatus.OK)
  async setStatus(@Body() dto: SetStatusDto, @Req() req) {
    const result = await this.presenceService.setStatus(
      req.user.userId, req.user.organizationId || 'default',
      dto.status, dto.customEmoji, dto.customText,
    );
    return { success: true, message: 'Status updated', data: result };
  }

  @Get('batch')
  async getPresenceBatch(@Query() query: BatchPresenceDto, @Req() req) {
    const userIds = Array.isArray(query.userIds) ? query.userIds : [query.userIds];
    const result = await this.presenceService.getPresenceBatch(userIds, req.user.organizationId || 'default');
    return { success: true, data: result };
  }

  @Get('dnd')
  async getDndSchedule(@Req() req) {
    const presence = await this.presenceService.getPresence(req.user.userId, req.user.organizationId || 'default');
    return { success: true, data: (presence as any)?.dndSchedule || { enabled: false } };
  }

  @Put('dnd')
  @HttpCode(HttpStatus.OK)
  async updateDndSchedule(@Body() body: any, @Req() req) {
    const result = await this.presenceService.updateDndSchedule(
      req.user.userId, req.user.organizationId || 'default', body,
    );
    return { success: true, message: 'DND schedule updated', data: result };
  }

  @Put('ooo')
  @HttpCode(HttpStatus.OK)
  async updateOoo(@Body() body: any, @Req() req) {
    const result = await this.presenceService.updateOoo(
      req.user.userId, req.user.organizationId || 'default', body,
    );
    return { success: true, message: 'OOO status updated', data: result };
  }
}
