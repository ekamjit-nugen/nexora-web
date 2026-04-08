import {
  Controller, Get,
  Param, Query, UseGuards,
  Logger,
} from '@nestjs/common';
import { TaskReportingService } from './reporting.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('tasks/reports')
@UseGuards(JwtAuthGuard)
export class TaskReportingController {
  private readonly logger = new Logger(TaskReportingController.name);

  constructor(private reportingService: TaskReportingService) {}

  @Get(':projectId/velocity')
  async getVelocity(@Param('projectId') projectId: string) {
    const data = await this.reportingService.getVelocityData(projectId);
    return { success: true, message: 'Velocity data retrieved', data };
  }

  @Get(':projectId/cumulative-flow')
  async getCumulativeFlow(
    @Param('projectId') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    const data = await this.reportingService.getCumulativeFlowData(projectId, fromDate, toDate);
    return { success: true, message: 'Cumulative flow data retrieved', data };
  }

  @Get(':projectId/cycle-time')
  async getCycleTime(@Param('projectId') projectId: string) {
    const data = await this.reportingService.getCycleTimeData(projectId);
    return { success: true, message: 'Cycle time data retrieved', data };
  }

  @Get(':projectId/burndown/:sprintId')
  async getBurndown(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ) {
    const data = await this.reportingService.getBurndownData(projectId, sprintId);
    return { success: true, message: 'Burndown data retrieved', data };
  }

  @Get(':projectId/workload')
  async getWorkload(@Param('projectId') projectId: string) {
    const data = await this.reportingService.getTeamWorkloadData(projectId);
    return { success: true, message: 'Team workload data retrieved', data };
  }

  @Get(':projectId/epic-progress')
  async getEpicProgress(@Param('projectId') projectId: string) {
    const data = await this.reportingService.getEpicProgressData(projectId);
    return { success: true, message: 'Epic progress data retrieved', data };
  }

  @Get(':projectId/overview')
  async getOverview(@Param('projectId') projectId: string) {
    const data = await this.reportingService.getOverviewStats(projectId);
    return { success: true, message: 'Overview stats retrieved', data };
  }
}
