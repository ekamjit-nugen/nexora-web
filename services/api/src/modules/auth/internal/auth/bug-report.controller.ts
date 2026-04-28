import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { BugReportService } from './bug-report.service';

// ─────────────────────────────────────────────────────────────────────────────
// /bug-reports — user-facing routes (any authenticated user can submit and
//                 list their own).
// /platform/bug-reports — super-admin only routes for triage.
// ─────────────────────────────────────────────────────────────────────────────

@Controller()
@UseGuards(JwtAuthGuard)
export class BugReportController {
  constructor(private readonly bugReportService: BugReportService) {}

  // ── User submits a bug ─────────────────────────────────────────────
  @Post('bug-reports')
  @HttpCode(HttpStatus.CREATED)
  async submit(@Body() body: any, @Req() req: any) {
    const title = (body?.title || '').toString().trim();
    const description = (body?.description || '').toString().trim();
    if (title.length < 3) {
      throw new BadRequestException('Title must be at least 3 characters');
    }
    if (description.length < 10) {
      throw new BadRequestException('Please describe the issue (at least 10 characters)');
    }
    const allowedCategory = ['bug', 'feature', 'feedback', 'security', 'data'];
    const allowedSeverity = ['low', 'medium', 'high', 'critical'];
    const category = allowedCategory.includes(body?.category) ? body.category : 'bug';
    const severity = allowedSeverity.includes(body?.severity) ? body.severity : 'medium';

    const report = await this.bugReportService.create(
      req.user.userId,
      req.user.organizationId || null,
      {
        title,
        description,
        category,
        severity,
        area: body?.area ? String(body.area).trim().slice(0, 200) : undefined,
        appVersion: body?.appVersion ? String(body.appVersion).slice(0, 64) : undefined,
        platform: body?.platform,
        // Cap user-agent length so a malicious / weird UA can't bloat
        // the document.
        userAgent: body?.userAgent ? String(body.userAgent).slice(0, 500) : undefined,
        url: body?.url ? String(body.url).slice(0, 500) : undefined,
      },
    );
    return {
      success: true,
      message: 'Thanks — your report has been sent to the Nexora team.',
      data: { _id: report._id, status: report.status, createdAt: report.createdAt },
    };
  }

  // ── User views their own submitted reports ─────────────────────────
  @Get('bug-reports/mine')
  async mine(@Req() req: any) {
    const data = await this.bugReportService.listMine(req.user.userId);
    return { success: true, data };
  }

  // ── Super-admin: list all reports for triage ──────────────────────
  @Get('platform/bug-reports')
  async list(@Query() query: any, @Req() req: any) {
    if (!req.user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    const result = await this.bugReportService.list({
      status: query.status,
      severity: query.severity,
      category: query.category,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 30,
    });
    return { success: true, data: result.data, pagination: result.pagination };
  }

  // ── Super-admin: stats for dashboard widget ───────────────────────
  @Get('platform/bug-reports/stats')
  async stats(@Req() req: any) {
    if (!req.user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    const data = await this.bugReportService.stats();
    return { success: true, data };
  }

  // ── Super-admin: detail ───────────────────────────────────────────
  @Get('platform/bug-reports/:id')
  async detail(@Param('id') id: string, @Req() req: any) {
    if (!req.user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    const data = await this.bugReportService.getById(id);
    return { success: true, data };
  }

  // ── Super-admin: triage update ────────────────────────────────────
  @Put('platform/bug-reports/:id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!req.user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    const data = await this.bugReportService.updateStatus(
      id,
      req.user.userId,
      req.user.email || 'platform-admin',
      {
        status: body?.status,
        resolution: body?.resolution,
        note: body?.note,
      },
    );
    return { success: true, message: 'Report updated', data };
  }
}
