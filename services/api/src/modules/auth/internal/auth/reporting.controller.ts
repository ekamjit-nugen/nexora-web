import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Res,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ReportingService } from './reporting.service';
import { CurrentUser } from './decorators/current-user.decorator';

interface ReportFilter {
  type: 'organizations' | 'users' | 'analytics' | 'audit-logs';
  startDate?: Date;
  endDate?: Date;
  organizationId?: string;
  status?: string;
  fields?: string[];
}

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  // ── Generate Reports ──

  @Post('generate')
  @HttpCode(200)
  async generateReport(
    @Body()
    body: {
      type: 'organizations' | 'users' | 'analytics' | 'audit-logs';
      format: 'pdf' | 'excel' | 'csv';
      startDate?: string;
      endDate?: string;
      organizationId?: string;
      status?: string;
      fields?: string[];
    },
    @Res() res: Response,
  ) {
    const filter: ReportFilter = {
      type: body.type,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      organizationId: body.organizationId,
      status: body.status,
      fields: body.fields,
    };

    const buffer = await this.reportingService.generateReport(filter, body.format);

    const mimeTypes = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
    };

    const extensions = { pdf: 'pdf', excel: 'xlsx', csv: 'csv' };

    res.setHeader('Content-Type', mimeTypes[body.format]);
    res.setHeader('Content-Disposition', `attachment; filename="report.${extensions[body.format]}"`);
    res.send(buffer);
  }

  // ── Report Templates ──

  @Post('templates')
  async createTemplate(
    @Body()
    body: {
      name: string;
      description: string;
      type: string;
      format: 'pdf' | 'excel' | 'csv';
      startDate?: string;
      endDate?: string;
      organizationId?: string;
      status?: string;
      fields?: string[];
    },
  ) {
    const filter: ReportFilter = {
      type: body.type as any,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      organizationId: body.organizationId,
      status: body.status,
      fields: body.fields,
    };

    const template = await this.reportingService.createTemplate(body.name, body.description, filter, body.format);

    return {
      success: true,
      message: 'Template created successfully',
      data: template,
    };
  }

  @Get('templates')
  async getTemplates() {
    const templates = await this.reportingService.getTemplates();

    return {
      success: true,
      message: 'Templates retrieved successfully',
      data: templates,
    };
  }

  @Get('templates/:templateId')
  async getTemplate(@Param('templateId') templateId: string) {
    const template = await this.reportingService.getTemplate(templateId);

    return {
      success: true,
      message: 'Template retrieved successfully',
      data: template,
    };
  }

  @Put('templates/:templateId')
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() body: any,
  ) {
    const updated = await this.reportingService.updateTemplate(templateId, body);

    return {
      success: true,
      message: 'Template updated successfully',
      data: updated,
    };
  }

  @Delete('templates/:templateId')
  @HttpCode(200)
  async deleteTemplate(@Param('templateId') templateId: string) {
    await this.reportingService.deleteTemplate(templateId);

    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }

  // ── Scheduled Reports ──

  @Post('schedule')
  async scheduleReport(
    @Body()
    body: {
      templateId: string;
      recipients: string[];
      schedule: 'daily' | 'weekly' | 'monthly';
    },
  ) {
    const scheduledReport = await this.reportingService.scheduleReport(
      body.templateId,
      body.recipients,
      body.schedule,
    );

    return {
      success: true,
      message: 'Report scheduled successfully',
      data: scheduledReport,
    };
  }

  @Get('scheduled')
  async getScheduledReports() {
    const reports = await this.reportingService.getScheduledReports();

    return {
      success: true,
      message: 'Scheduled reports retrieved successfully',
      data: reports,
    };
  }

  @Put('scheduled/:reportId')
  async updateScheduledReport(
    @Param('reportId') reportId: string,
    @Body() body: any,
  ) {
    const updated = await this.reportingService.updateScheduledReport(reportId, body);

    return {
      success: true,
      message: 'Scheduled report updated successfully',
      data: updated,
    };
  }

  @Delete('scheduled/:reportId')
  @HttpCode(200)
  async deleteScheduledReport(@Param('reportId') reportId: string) {
    await this.reportingService.deleteScheduledReport(reportId);

    return {
      success: true,
      message: 'Scheduled report deleted successfully',
    };
  }

  @Post('scheduled/:reportId/execute')
  @HttpCode(200)
  async executeScheduledReport(
    @Param('reportId') reportId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportingService.executeScheduledReport(reportId);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="report.pdf"`);
    res.send(buffer);
  }
}
