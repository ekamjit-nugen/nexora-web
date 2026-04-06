import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';

@Controller('chat/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get()
  @Roles('manager', 'admin', 'owner')
  async getInsights(@Query('from') from: string, @Query('to') to: string, @Req() req) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const insights = await this.analyticsService.getOrgInsights(req.user.organizationId || 'default', dateRange);
    return { success: true, data: insights };
  }
}
