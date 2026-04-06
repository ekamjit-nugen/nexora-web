import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('chat/sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private syncService: SyncService) {}

  /**
   * GET /chat/sync?since=ISO_TIMESTAMP
   * Returns all changes since the given timestamp for offline/reconnect sync.
   */
  @Get()
  async getSyncDelta(@Query('since') since: string, @Req() req) {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000); // default: last 24h
    const delta = await this.syncService.getSyncDelta(req.user.userId, sinceDate);
    return { success: true, data: delta };
  }
}
