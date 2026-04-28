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
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ReportingService } from './services/reporting.service';
import { TimeTrackingService } from './services/time-tracking.service';
import { ClientFeedbackService } from './services/client-feedback.service';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateTimeLogDto,
  UpdateTimeLogDto,
  TimesheetQueryDto,
  SubmitTimesheetDto,
  ApproveTimesheetDto,
  RejectTimesheetDto,
  SubmitClientFeedbackDto,
  UpdateFeedbackStatusDto,
  LinkFeedbackToTaskDto,
  ClientFeedbackQueryDto,
  ReportQueryDto,
} from './dto/wave4.dto';

// ── REPORTING ENDPOINTS ──

@Controller('projects/:projectId/reports')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  private readonly logger = new Logger(ReportingController.name);

  constructor(private reportingService: ReportingService) {}

  @Get('budget')
  async getBudgetUtilization(@Param('projectId') projectId: string) {
    const data = await this.reportingService.getBudgetUtilization(projectId);

    return {
      success: true,
      message: 'Budget utilization data retrieved',
      data,
    };
  }

  @Get('velocity/export')
  async exportVelocityReport(
    @Param('projectId') projectId: string,
    @Query() query: ReportQueryDto,
  ) {
    const data = await this.reportingService.getVelocityReportForExport(projectId);

    return {
      success: true,
      message: 'Velocity report export ready',
      data,
      format: query.format || 'json',
    };
  }

  @Get('billing/export')
  async exportBillingReport(
    @Param('projectId') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const data = await this.reportingService.getBillingReportForExport(
      projectId,
      fromDate,
      toDate,
    );

    return {
      success: true,
      message: 'Billing report export ready',
      data,
      format: format || 'json',
    };
  }
}

// ── TIME TRACKING ENDPOINTS ──

@Controller('projects/:projectId/time-logs')
@UseGuards(JwtAuthGuard)
export class TimeTrackingController {
  private readonly logger = new Logger(TimeTrackingController.name);

  constructor(private timeTrackingService: TimeTrackingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async logTime(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTimeLogDto,
    @Req() req,
  ) {
    const timeLog = await this.timeTrackingService.logTime(
      projectId,
      dto.taskId,
      req.user.userId,
      {
        taskId: dto.taskId,
        duration: dto.duration,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : new Date(),
        billable: dto.billable,
        rate: dto.rate,
      },
    );

    return {
      success: true,
      message: 'Time logged successfully',
      data: timeLog,
    };
  }

  @Get('task/:taskId')
  async getTaskTimeLogs(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    const timeLogs = await this.timeTrackingService.getTaskTimeLogs(projectId, taskId);

    return {
      success: true,
      message: 'Task time logs retrieved',
      data: timeLogs,
    };
  }

  @Get('user/:userId')
  async getUserTimeLogs(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Would need to add this method to service
    return {
      success: true,
      message: 'User time logs retrieved',
      data: [],
    };
  }

  @Put(':logId')
  async updateTimeLog(
    @Param('projectId') projectId: string,
    @Param('logId') logId: string,
    @Body() dto: UpdateTimeLogDto,
  ) {
    const updateData = {
      ...dto,
      ...(dto.date && { date: new Date(dto.date) }),
    };
    const timeLog = await this.timeTrackingService.updateTimeLog(projectId, logId, updateData as any);

    return {
      success: true,
      message: 'Time log updated',
      data: timeLog,
    };
  }

  @Delete(':logId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTimeLog(
    @Param('projectId') projectId: string,
    @Param('logId') logId: string,
  ) {
    await this.timeTrackingService.deleteTimeLog(projectId, logId);

    return {
      success: true,
      message: 'Time log deleted',
    };
  }
}

// ── TIMESHEET ENDPOINTS ──

@Controller('projects/:projectId/timesheets')
@UseGuards(JwtAuthGuard)
export class TimesheetController {
  private readonly logger = new Logger(TimesheetController.name);

  constructor(private timeTrackingService: TimeTrackingService) {}

  @Get(':userId')
  async getTimesheet(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Query('weekStart') weekStart: string,
  ) {
    const timesheet = await this.timeTrackingService.getWeeklyTimesheet(
      projectId,
      userId,
      new Date(weekStart),
    );

    return {
      success: true,
      message: 'Timesheet retrieved',
      data: timesheet,
    };
  }

  @Post(':userId/submit')
  @HttpCode(HttpStatus.OK)
  async submitTimesheet(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: SubmitTimesheetDto,
  ) {
    const timesheet = await this.timeTrackingService.submitTimesheet(
      projectId,
      userId,
      new Date(dto.weekStart),
    );

    return {
      success: true,
      message: 'Timesheet submitted for approval',
      data: timesheet,
    };
  }

  @Post(':userId/approve')
  @HttpCode(HttpStatus.OK)
  async approveTimesheet(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: ApproveTimesheetDto,
    @Req() req,
  ) {
    const timesheet = await this.timeTrackingService.approveTimesheet(
      projectId,
      userId,
      new Date(dto.weekStart),
      req.user.userId,
    );

    return {
      success: true,
      message: 'Timesheet approved',
      data: timesheet,
    };
  }

  @Post(':userId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectTimesheet(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: RejectTimesheetDto,
  ) {
    const timesheet = await this.timeTrackingService.rejectTimesheet(
      projectId,
      userId,
      new Date(dto.weekStart),
      dto.reason || 'No reason provided',
    );

    return {
      success: true,
      message: 'Timesheet rejected',
      data: timesheet,
    };
  }
}

// ── BILLING ENDPOINTS ──

@Controller('projects/:projectId/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private timeTrackingService: TimeTrackingService) {}

  @Get('user/:userId')
  async getUserBilling(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const billing = await this.timeTrackingService.getUserBillingData(
      projectId,
      userId,
      fromDate,
      toDate,
    );

    return {
      success: true,
      message: 'User billing data retrieved',
      data: billing,
    };
  }

  @Get('project')
  async getProjectBilling(
    @Param('projectId') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const billing = await this.timeTrackingService.getProjectBillingData(
      projectId,
      fromDate,
      toDate,
    );

    return {
      success: true,
      message: 'Project billing data retrieved',
      data: billing,
    };
  }
}

// ── CLIENT FEEDBACK ENDPOINTS ──

@Controller('client-portal/:projectId/feedback')
export class ClientFeedbackController {
  private readonly logger = new Logger(ClientFeedbackController.name);

  constructor(private clientFeedbackService: ClientFeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Param('projectId') projectId: string,
    @Body() dto: SubmitClientFeedbackDto,
  ) {
    const feedback = await this.clientFeedbackService.submitFeedback(projectId, dto);

    return {
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback,
    };
  }

  @Get()
  async getProjectFeedback(
    @Param('projectId') projectId: string,
    @Query() query: ClientFeedbackQueryDto,
  ) {
    const result = await this.clientFeedbackService.getProjectFeedback(projectId, {
      status: query.status,
      priority: query.priority,
      type: query.type,
      limit: query.limit,
      skip: query.skip,
    });

    return {
      success: true,
      message: 'Project feedback retrieved',
      data: result.feedback,
      total: result.total,
    };
  }

  @Get(':feedbackId')
  async getFeedback(
    @Param('projectId') projectId: string,
    @Param('feedbackId') feedbackId: string,
  ) {
    const feedback = await this.clientFeedbackService.getFeedback(projectId, feedbackId);

    return {
      success: true,
      message: 'Feedback retrieved',
      data: feedback,
    };
  }

  @Put(':feedbackId/status')
  async updateFeedbackStatus(
    @Param('projectId') projectId: string,
    @Param('feedbackId') feedbackId: string,
    @Body() dto: UpdateFeedbackStatusDto,
  ) {
    const feedback = await this.clientFeedbackService.updateFeedbackStatus(
      projectId,
      feedbackId,
      dto.status,
    );

    return {
      success: true,
      message: 'Feedback status updated',
      data: feedback,
    };
  }

  @Put(':feedbackId/link-task')
  async linkFeedbackToTask(
    @Param('projectId') projectId: string,
    @Param('feedbackId') feedbackId: string,
    @Body() dto: LinkFeedbackToTaskDto,
  ) {
    const feedback = await this.clientFeedbackService.linkFeedbackToTask(
      projectId,
      feedbackId,
      dto.taskKey,
    );

    return {
      success: true,
      message: 'Feedback linked to task',
      data: feedback,
    };
  }

  @Delete(':feedbackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeedback(
    @Param('projectId') projectId: string,
    @Param('feedbackId') feedbackId: string,
  ) {
    await this.clientFeedbackService.deleteFeedback(projectId, feedbackId);

    return {
      success: true,
      message: 'Feedback deleted',
    };
  }

  @Get('client/:clientId')
  async getClientFeedback(
    @Param('projectId') projectId: string,
    @Param('clientId') clientId: string,
    @Query() query: ClientFeedbackQueryDto,
  ) {
    const result = await this.clientFeedbackService.getClientFeedback(projectId, clientId, {
      status: query.status,
      limit: query.limit,
      skip: query.skip,
    });

    return {
      success: true,
      message: 'Client feedback retrieved',
      data: result.feedback,
      total: result.total,
    };
  }

  @Get('stats')
  async getFeedbackStats(@Param('projectId') projectId: string) {
    const stats = await this.clientFeedbackService.getFeedbackStats(projectId);

    return {
      success: true,
      message: 'Feedback statistics retrieved',
      data: stats,
    };
  }
}

// ── CLIENT PORTAL ENDPOINTS ──

@Controller('projects/:projectId/client-portal')
export class ClientPortalController {
  private readonly logger = new Logger(ClientPortalController.name);

  constructor(
    private projectService: ProjectService,
    private clientFeedbackService: ClientFeedbackService,
  ) {}

  @Get()
  async getClientPortalData(@Param('projectId') projectId: string) {
    const data = await this.projectService.getClientPortalData(projectId);

    return {
      success: true,
      message: 'Client portal data retrieved',
      data,
    };
  }

  @Get('feedback')
  async getPortalFeedback(
    @Param('projectId') projectId: string,
    @Query() query: ClientFeedbackQueryDto,
  ) {
    const result = await this.clientFeedbackService.getProjectFeedback(projectId, {
      status: query.status,
      priority: query.priority,
      type: query.type,
      limit: query.limit,
      skip: query.skip,
    });

    return {
      success: true,
      message: 'Portal feedback retrieved',
      data: result.feedback,
      total: result.total,
    };
  }

  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitPortalFeedback(
    @Param('projectId') projectId: string,
    @Body() dto: SubmitClientFeedbackDto,
  ) {
    const feedback = await this.clientFeedbackService.submitFeedback(projectId, dto);

    return {
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback,
    };
  }

  @Put('toggle')
  @UseGuards(JwtAuthGuard)
  async toggleClientPortal(
    @Param('projectId') projectId: string,
    @Body() body: { enabled: boolean },
    @Req() req,
  ) {
    const project = await this.projectService.toggleClientPortal(
      projectId,
      body.enabled,
      req.user.userId,
      req.user.organizationId,
    );

    return {
      success: true,
      message: `Client portal ${body.enabled ? 'enabled' : 'disabled'}`,
      data: project,
    };
  }
}
