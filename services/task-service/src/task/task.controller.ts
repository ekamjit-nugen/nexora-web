import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateTaskDto, UpdateTaskDto, AddCommentDto,
  LogTimeDto, TaskQueryDto, UpdateStatusDto,
} from './dto/index';
import {
  CreateTimesheetDto, UpdateTimesheetDto,
  ReviewTimesheetDto, TimesheetQueryDto,
} from './dto/timesheet.dto';

@Controller('tasks')
export class TaskController {
  private readonly logger = new Logger(TaskController.name);

  constructor(private taskService: TaskService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() dto: CreateTaskDto, @Req() req) {
    const task = await this.taskService.createTask(dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Task created successfully', data: task };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getTasks(@Query() query: TaskQueryDto, @Req() req) {
    const result = await this.taskService.getTasks(query, req.user?.organizationId);
    return { success: true, message: 'Tasks retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
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

  @Get(':id/children')
  @UseGuards(JwtAuthGuard)
  async getChildTasks(@Param('id') id: string, @Req() req) {
    const orgId = req.user?.organizationId;
    const children = await this.taskService.getChildTasks(id, orgId);
    return { success: true, message: 'Child tasks retrieved', data: children };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTask(@Param('id') id: string, @Req() req) {
    const task = await this.taskService.getTaskById(id, req.user?.organizationId);
    return { success: true, message: 'Task retrieved', data: task };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateTask(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req) {
    const task = await this.taskService.updateTask(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Task updated successfully', data: task };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteTask(@Param('id') id: string, @Req() req) {
    const result = await this.taskService.deleteTask(id, req.user?.organizationId);
    return { success: true, ...result };
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req) {
    const task = await this.taskService.updateStatus(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Task status updated successfully', data: task };
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addComment(@Param('id') id: string, @Body() dto: AddCommentDto, @Req() req) {
    const task = await this.taskService.addComment(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Comment added successfully', data: task };
  }

  @Post(':id/time-entries')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async logTime(@Param('id') id: string, @Body() dto: LogTimeDto, @Req() req) {
    const task = await this.taskService.logTime(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Time logged successfully', data: task };
  }
}

// ── Timesheet Controller ──

@Controller('timesheets')
export class TimesheetController {
  constructor(private taskService: TaskService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id') id: string, @Req() req) {
    const ts = await this.taskService.submitTimesheet(id, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Timesheet submitted', data: ts };
  }

  @Put(':id/review')
  @UseGuards(JwtAuthGuard)
  async review(@Param('id') id: string, @Body() dto: ReviewTimesheetDto, @Req() req) {
    const ts = await this.taskService.reviewTimesheet(id, dto, req.user.userId, req.user?.organizationId);
    return { success: true, message: 'Timesheet reviewed', data: ts };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAll(@Query() query: TimesheetQueryDto, @Req() req) {
    const result = await this.taskService.getAllTimesheets(query, req.user?.organizationId);
    return { success: true, message: 'All timesheets retrieved', data: result.data, pagination: result.pagination };
  }
}
