import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { RecurrenceService } from './recurrence.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard, Roles } from './guards/roles.guard';
import {
  CreateTaskDto, UpdateTaskDto, AddCommentDto,
  LogTimeDto, TaskQueryDto, UpdateStatusDto, BulkUpdateDto,
  SetRecurrenceDto,
} from './dto/index';
import {
  CreateTimesheetDto, UpdateTimesheetDto,
  ReviewTimesheetDto, TimesheetQueryDto,
} from './dto/timesheet.dto';

@Controller('tasks')
export class TaskController {
  private readonly logger = new Logger(TaskController.name);

  constructor(
    private taskService: TaskService,
    private recurrenceService: RecurrenceService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() dto: CreateTaskDto, @Req() req) {
    const task = await this.taskService.createTask(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Task created successfully', data: task };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getTasks(@Query() query: TaskQueryDto, @Req() req) {
    const result = await this.taskService.getTasks(query, req.user?.organizationId);
    return { success: true, message: 'Tasks retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMyTasks(@Query() query: TaskQueryDto, @Req() req) {
    const result = await this.taskService.getMyTasks(req.user.userId, query, req.user?.organizationId);
    return { success: true, message: 'My tasks retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Query('projectId') projectId: string, @Req() req) {
    const stats = await this.taskService.getStats(projectId, req.user?.organizationId);
    return { success: true, message: 'Task stats retrieved', data: stats };
  }

  @Get('stats/project/:projectId')
  @UseGuards(JwtAuthGuard)
  async getProjectTaskStats(@Param('projectId') projectId: string, @Req() req) {
    const stats = await this.taskService.getProjectTaskStats(projectId, req.user?.organizationId);
    return { success: true, message: 'Project task stats retrieved', data: stats };
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  async getAnalytics(@Query('projectId') projectId: string, @Req() req) {
    const data = await this.taskService.getProjectAnalytics(projectId, req.user?.organizationId);
    return { success: true, message: 'Analytics retrieved', data };
  }

  @Get('recurring')
  @UseGuards(JwtAuthGuard)
  async getRecurringTasks(@Query('projectId') projectId: string, @Req() req) {
    const data = await this.recurrenceService.getRecurringTasks(projectId, req.user?.organizationId);
    return { success: true, message: 'Recurring tasks retrieved', data };
  }

  @Get(':id/children')
  @UseGuards(JwtAuthGuard)
  async getChildTasks(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const children = await this.taskService.getChildTasks(id, orgId);
    return { success: true, message: 'Child tasks retrieved', data: children };
  }

  @Put('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async bulkUpdate(@Body() dto: BulkUpdateDto, @Req() req) {
    const result = await this.taskService.bulkUpdate(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Tasks updated', data: result };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTask(@Param('id') id: string, @Req() req) {
    const task = await this.taskService.getTaskById(id, req.user?.organizationId);
    return { success: true, message: 'Task retrieved', data: task };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateTask(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req) {
    const task = await this.taskService.updateTask(id, dto, req.user.userId, req.user?.organizationId, req.user?.orgRole);
    return { success: true, message: 'Task updated successfully', data: task };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async deleteTask(@Param('id') id: string, @Req() req) {
    const result = await this.taskService.deleteTask(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req) {
    const task = await this.taskService.updateStatus(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Task status updated successfully', data: task };
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async addComment(@Param('id') id: string, @Body() dto: AddCommentDto, @Req() req) {
    const task = await this.taskService.addComment(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Comment added successfully', data: task };
  }

  @Put(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async updateComment(@Param('id') id: string, @Param('commentId') commentId: string, @Body() body: { content: string }, @Req() req) {
    const task = await this.taskService.updateComment(id, commentId, body.content, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Comment updated', data: task };
  }

  @Delete(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Param('id') id: string, @Param('commentId') commentId: string, @Req() req) {
    const task = await this.taskService.deleteComment(id, commentId, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Comment deleted', data: task };
  }

  @Post(':id/comments/:commentId/reactions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleReaction(@Param('id') id: string, @Param('commentId') commentId: string, @Body() body: { emoji: string }, @Req() req) {
    const task = await this.taskService.toggleReaction(id, commentId, body.emoji, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Reaction toggled', data: task };
  }

  @Post(':id/time-entries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async logTime(@Param('id') id: string, @Body() dto: LogTimeDto, @Req() req) {
    const task = await this.taskService.logTime(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Time logged successfully', data: task };
  }

  @Post(':id/dependencies')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addDependency(@Param('id') id: string, @Body() body: { itemId: string; type: string }, @Req() req) {
    const task = await this.taskService.addDependency(id, body.itemId, body.type, req.user?.organizationId);
    return { success: true, message: 'Dependency added', data: task };
  }

  @Delete(':id/dependencies/:depItemId')
  @UseGuards(JwtAuthGuard)
  async removeDependency(@Param('id') id: string, @Param('depItemId') depItemId: string, @Req() req) {
    const task = await this.taskService.removeDependency(id, depItemId, req.user?.organizationId);
    return { success: true, message: 'Dependency removed', data: task };
  }

  @Get('activity/:projectId')
  @UseGuards(JwtAuthGuard)
  async getProjectActivity(
    @Param('projectId') projectId: string,
    @Query('limit') limit: string,
    @Req() req,
  ) {
    const data = await this.taskService.getProjectActivity(projectId, parseInt(limit) || 50, req.user?.organizationId);
    return { success: true, message: 'Activity retrieved', data };
  }

  @Post(':id/flag')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleFlag(@Param('id') id: string, @Req() req) {
    const task = await this.taskService.toggleFlag(id, req.user?.organizationId);
    return { success: true, message: 'Flag toggled', data: task };
  }

  @Post(':id/watch')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleWatch(@Param('id') id: string, @Req() req) {
    const task = await this.taskService.toggleWatch(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Watch toggled', data: task };
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleVote(@Param('id') id: string, @Req() req) {
    const task = await this.taskService.toggleVote(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Vote toggled', data: task };
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async duplicateTask(@Param('id') id: string, @Req() req) {
    const task = await this.taskService.duplicateTask(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Task duplicated', data: task };
  }

  @Post(':id/recurrence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async setRecurrence(@Param('id') id: string, @Body() dto: SetRecurrenceDto, @Req() req) {
    const task = await this.recurrenceService.setRecurrence(id, dto, req.user?.organizationId);
    return { success: true, message: 'Recurrence set successfully', data: task };
  }

  @Delete(':id/recurrence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  async stopRecurrence(@Param('id') id: string, @Req() req) {
    const task = await this.recurrenceService.stopRecurrence(id, req.user?.organizationId);
    return { success: true, message: 'Recurrence stopped', data: task };
  }

  @Get(':id/recurrence/instances')
  @UseGuards(JwtAuthGuard)
  async getRecurringInstances(@Param('id') id: string, @Req() req) {
    const data = await this.recurrenceService.getRecurringInstances(id, req.user?.organizationId);
    return { success: true, message: 'Recurring instances retrieved', data };
  }
}

// ── Timesheet Controller ──

@Controller('timesheets')
export class TimesheetController {
  constructor(private taskService: TaskService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTimesheetDto, @Req() req) {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const ts = await this.taskService.createTimesheet(dto, req.user.userId, token, req.user?.organizationId);
    return { success: true, message: 'Timesheet created', data: ts };
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyTimesheets(@Query() query: TimesheetQueryDto, @Req() req) {
    const result = await this.taskService.getMyTimesheets(req.user.userId, query, req.user?.organizationId);
    return { success: true, message: 'Timesheets retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async getPending(@Query() query: TimesheetQueryDto, @Req() req) {
    const result = await this.taskService.getPendingTimesheets(query, req.user?.organizationId);
    return { success: true, message: 'Pending timesheets retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req) {
    const stats = await this.taskService.getTimesheetStats(req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Timesheet stats retrieved', data: stats };
  }

  @Post('auto-populate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async autoPopulate(@Body() body: { startDate: string; endDate: string }, @Req() req) {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const entries = await this.taskService.autoPopulateTimesheet(req.user.userId, body.startDate, body.endDate, token, req.user?.organizationId);
    return { success: true, message: 'Time entries populated', data: entries };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTimesheet(@Param('id') id: string, @Req() req) {
    const ts = await this.taskService.getTimesheetById(id, req.user?.organizationId);
    return { success: true, message: 'Timesheet retrieved', data: ts };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateTimesheetDto, @Req() req) {
    const ts = await this.taskService.updateTimesheet(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Timesheet updated', data: ts };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteTimesheet(@Param('id') id: string, @Req() req) {
    const result = await this.taskService.deleteTimesheet(id, req.user.userId, req.user?.organizationId);
    return { success: true, ...result };
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id') id: string, @Req() req) {
    const ts = await this.taskService.submitTimesheet(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Timesheet submitted', data: ts };
  }

  @Put(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'owner')
  async review(@Param('id') id: string, @Body() dto: ReviewTimesheetDto, @Req() req) {
    const ts = await this.taskService.reviewTimesheet(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Timesheet reviewed', data: ts };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async getAll(@Query() query: TimesheetQueryDto, @Req() req) {
    const result = await this.taskService.getAllTimesheets(query, req.user?.organizationId);
    return { success: true, message: 'All timesheets retrieved', data: result.data, pagination: result.pagination };
  }
}
