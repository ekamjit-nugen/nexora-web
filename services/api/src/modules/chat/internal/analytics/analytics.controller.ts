import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';

@Controller('chat/analytics')
@UseGuards(JwtAuthGuard, FeatureGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  private parseDateRange(from?: string, to?: string): { from?: Date; to?: Date } | undefined {
    if (!from && !to) return undefined;
    const range: { from?: Date; to?: Date } = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) range.from = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) range.to = d;
    }
    return range;
  }

  private orgId(req: any): string {
    return req?.user?.organizationId || 'default';
  }

  /** Legacy bundled insights endpoint (used by the existing dashboard page) */
  @Get()
  @Roles('manager', 'admin', 'owner')
  async getInsights(@Query('from') from: string, @Query('to') to: string, @Req() req: any) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const insights = await this.analyticsService.getOrgInsights(this.orgId(req), dateRange);
    return { success: true, data: insights };
  }

  @Get('overview')
  @Roles('manager', 'admin', 'owner')
  async getOverview(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const data = await this.analyticsService.getOverview(
      this.orgId(req),
      this.parseDateRange(from, to),
    );
    return { success: true, data };
  }

  @Get('volume')
  @Roles('manager', 'admin', 'owner')
  async getVolume(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('granularity') granularity: string,
    @Req() req: any,
  ) {
    const g: 'day' | 'week' | 'month' =
      granularity === 'week' || granularity === 'month' ? granularity : 'day';
    const data = await this.analyticsService.getMessageVolume(
      this.orgId(req),
      this.parseDateRange(from, to),
      g,
    );
    return { success: true, data };
  }

  @Get('by-type')
  @Roles('manager', 'admin', 'owner')
  async getByType(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const data = await this.analyticsService.getMessagesByType(
      this.orgId(req),
      this.parseDateRange(from, to),
    );
    return { success: true, data };
  }

  @Get('channels')
  @Roles('manager', 'admin', 'owner')
  async getChannels(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const parsedLimit = Number.parseInt(limit, 10);
    const data = await this.analyticsService.getActiveChannels(
      this.orgId(req),
      this.parseDateRange(from, to),
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
    );
    return { success: true, data };
  }

  @Get('users')
  @Roles('manager', 'admin', 'owner')
  async getUsers(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const parsedLimit = Number.parseInt(limit, 10);
    const data = await this.analyticsService.getTopUsers(
      this.orgId(req),
      this.parseDateRange(from, to),
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
    );
    return { success: true, data };
  }

  @Get('peak-hours')
  @Roles('manager', 'admin', 'owner')
  async getPeakHours(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const data = await this.analyticsService.getPeakHours(
      this.orgId(req),
      this.parseDateRange(from, to),
    );
    return { success: true, data };
  }

  @Get('reactions')
  @Roles('manager', 'admin', 'owner')
  async getReactions(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const data = await this.analyticsService.getReactionStats(
      this.orgId(req),
      this.parseDateRange(from, to),
    );
    return { success: true, data };
  }

  @Get('response-time')
  @Roles('manager', 'admin', 'owner')
  async getResponseTime(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const data = await this.analyticsService.getResponseTimeMetrics(
      this.orgId(req),
      this.parseDateRange(from, to),
    );
    return { success: true, data };
  }
}
