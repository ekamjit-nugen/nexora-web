import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITask } from './schemas/task.schema';
import { ITimesheet } from './schemas/timesheet.schema';
import {
  CreateTaskDto, UpdateTaskDto, AddCommentDto,
  LogTimeDto, TaskQueryDto, UpdateStatusDto,
} from './dto/index';
import {
  CreateTimesheetDto, UpdateTimesheetDto,
  ReviewTimesheetDto, TimesheetQueryDto,
} from './dto/timesheet.dto';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectModel('Task') private taskModel: Model<ITask>,
    @InjectModel('Timesheet') private timesheetModel: Model<ITimesheet>,
  ) {}

  async createTask(dto: CreateTaskDto, userId: string, orgId?: string) {
    const task = new this.taskModel({
      ...dto,
      reporterId: userId,
      createdBy: userId,
      ...(orgId && { organizationId: orgId }),
    });
    await task.save();
    this.logger.log(`Task created: ${task._id} - ${dto.title}`);
    return task;
  }

  async getTasks(query: TaskQueryDto, orgId?: string) {
    const { projectId, assigneeId, status, priority, type, search, page = 1, limit = 20, sort = '-createdAt' } = query;

    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (projectId) filter.projectId = projectId;
    if (assigneeId) filter.assigneeId = assigneeId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { labels: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortObj = sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

    const [data, total] = await Promise.all([
      this.taskModel.find(filter).sort(sortObj as any).skip(skip).limit(limit),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getTaskById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto, userId: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOneAndUpdate(
      filter,
      { ...dto, updatedBy: userId },
      { new: true },
    );
    if (!task) throw new NotFoundException('Task not found');
    this.logger.log(`Task updated: ${task._id}`);
    return task;
  }

  async deleteTask(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOneAndUpdate(
      filter,
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );
    if (!task) throw new NotFoundException('Task not found');
    this.logger.log(`Task soft-deleted: ${task._id}`);
    return { message: 'Task deleted successfully' };
  }

  async addComment(taskId: string, dto: AddCommentDto, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOneAndUpdate(
      filter,
      {
        $push: {
          comments: {
            userId,
            content: dto.content,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );
    if (!task) throw new NotFoundException('Task not found');
    this.logger.log(`Comment added to task: ${task._id}`);
    return task;
  }

  async logTime(taskId: string, dto: LogTimeDto, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');

    const updatedTask = await this.taskModel.findOneAndUpdate(
      { _id: taskId },
      {
        $push: {
          timeEntries: {
            userId,
            hours: dto.hours,
            description: dto.description || '',
            date: new Date(dto.date),
            createdAt: new Date(),
          },
        },
        $inc: { loggedHours: dto.hours },
      },
      { new: true },
    );

    this.logger.log(`Time logged on task ${taskId}: ${dto.hours}h by ${userId}`);
    return updatedTask;
  }

  async getMyTasks(userId: string, query: TaskQueryDto, orgId?: string) {
    return this.getTasks({ ...query, assigneeId: userId }, orgId);
  }

  async getTasksByProject(projectId: string, query: TaskQueryDto, orgId?: string) {
    return this.getTasks({ ...query, projectId }, orgId);
  }

  async getStats(projectId?: string, orgId?: string) {
    const baseFilter: any = { isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;
    if (projectId) baseFilter.projectId = projectId;

    const [total, byStatus, overdue] = await Promise.all([
      this.taskModel.countDocuments(baseFilter),
      this.taskModel.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.taskModel.countDocuments({
        ...baseFilter,
        dueDate: { $lt: new Date() },
        status: { $nin: ['done', 'cancelled'] },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    byStatus.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    return { total, byStatus: statusCounts, overdue };
  }

  async updateStatus(taskId: string, dto: UpdateStatusDto, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOneAndUpdate(
      filter,
      { status: dto.status, updatedBy: userId },
      { new: true },
    );
    if (!task) throw new NotFoundException('Task not found');
    this.logger.log(`Task ${taskId} status changed to ${dto.status}`);
    return task;
  }

  // ── Timesheet Methods ──

  async createTimesheet(dto: CreateTimesheetDto, userId: string, authToken?: string, orgId?: string) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    // Auto-populate entries from task time logs + attendance
    const autoEntries = await this.autoPopulateTimesheet(userId, dto.startDate, dto.endDate, authToken, orgId);
    const entries = autoEntries.length > 0 ? autoEntries : (dto.entries || []);

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

    // Fetch max working hours per week from active work policy (default 40)
    const maxHoursPerWeek = await this.getMaxWorkingHoursPerWeek(authToken);

    // Calculate expected hours based on period type
    let expectedHours: number;
    if (dto.period === 'daily') {
      expectedHours = maxHoursPerWeek / 5;
    } else if (dto.period === 'weekly') {
      expectedHours = maxHoursPerWeek;
    } else {
      // monthly: average weeks per month
      expectedHours = maxHoursPerWeek * 4.33;
    }
    expectedHours = parseFloat(expectedHours.toFixed(2));

    const timesheet = new this.timesheetModel({
      employeeId: userId,
      period: dto.period,
      startDate: start,
      endDate: end,
      entries,
      totalHours,
      expectedHours,
      createdBy: userId,
      ...(orgId && { organizationId: orgId }),
    });
    await timesheet.save();
    this.logger.log(`Timesheet created: ${timesheet._id} for ${userId} with ${entries.length} auto-populated entries`);
    return timesheet;
  }

  async getMyTimesheets(userId: string, query: TimesheetQueryDto, orgId?: string) {
    const { status, period, page = 1, limit = 20 } = query;
    const filter: any = { employeeId: userId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;
    if (period) filter.period = period;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.timesheetModel.find(filter).sort({ startDate: -1 }).skip(skip).limit(limit),
      this.timesheetModel.countDocuments(filter),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getAllTimesheets(query: TimesheetQueryDto, orgId?: string) {
    const { status, period, page = 1, limit = 20 } = query;
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;
    if (period) filter.period = period;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.timesheetModel.find(filter).sort({ startDate: -1 }).skip(skip).limit(limit),
      this.timesheetModel.countDocuments(filter),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getTimesheetById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const ts = await this.timesheetModel.findOne(filter);
    if (!ts) throw new NotFoundException('Timesheet not found');
    return ts;
  }

  async updateTimesheet(id: string, dto: UpdateTimesheetDto, userId: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const ts = await this.timesheetModel.findOne(filter);
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (!['draft', 'revision_requested'].includes(ts.status)) {
      throw new NotFoundException('Can only edit draft or revision-requested timesheets');
    }

    if (dto.entries) {
      ts.entries = dto.entries as any;
      ts.totalHours = dto.entries.reduce((sum, e) => sum + e.hours, 0);
    }
    if (dto.expectedHours !== undefined) ts.expectedHours = dto.expectedHours;
    await ts.save();
    this.logger.log(`Timesheet updated: ${id}`);
    return ts;
  }

  async deleteTimesheet(id: string, userId: string, orgId?: string) {
    const filter: any = { _id: id, employeeId: userId, isDeleted: false, status: { $in: ['draft', 'revision_requested'] } };
    if (orgId) filter.organizationId = orgId;
    const ts = await this.timesheetModel.findOneAndUpdate(
      filter,
      { isDeleted: true },
      { new: true },
    );
    if (!ts) throw new NotFoundException('Timesheet not found or cannot be deleted (only draft/revision timesheets can be deleted)');
    this.logger.log(`Timesheet deleted: ${id}`);
    return { message: 'Timesheet deleted successfully' };
  }

  async submitTimesheet(id: string, userId: string, orgId?: string) {
    const filter: any = { _id: id, employeeId: userId, isDeleted: false, status: { $in: ['draft', 'revision_requested'] } };
    if (orgId) filter.organizationId = orgId;
    const ts = await this.timesheetModel.findOneAndUpdate(
      filter,
      { status: 'submitted', submittedAt: new Date() },
      { new: true },
    );
    if (!ts) throw new NotFoundException('Timesheet not found or cannot be submitted');
    this.logger.log(`Timesheet submitted: ${id}`);
    return ts;
  }

  async reviewTimesheet(id: string, dto: ReviewTimesheetDto, reviewerId: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false, status: 'submitted' };
    if (orgId) filter.organizationId = orgId;
    const ts = await this.timesheetModel.findOneAndUpdate(
      filter,
      { status: dto.status, reviewedBy: reviewerId, reviewedAt: new Date(), reviewComment: dto.reviewComment || '' },
      { new: true },
    );
    if (!ts) throw new NotFoundException('Timesheet not found or not in submitted state');
    this.logger.log(`Timesheet ${id} reviewed: ${dto.status}`);
    return ts;
  }

  async getPendingTimesheets(query: TimesheetQueryDto, orgId?: string) {
    return this.getAllTimesheets({ ...query, status: 'submitted' }, orgId);
  }

  private async getMaxWorkingHoursPerWeek(authToken?: string): Promise<number> {
    const DEFAULT_HOURS = 40;
    try {
      const attendanceUrl = process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3011';
      const axios = require('axios');
      const headers: any = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await axios.get(`${attendanceUrl}/api/v1/policies`, {
        headers,
        timeout: 5000,
      });
      const allPolicies = res.data?.data || [];
      // Find the first active, non-template work_timing policy
      const workPolicy = allPolicies.find(
        (p: any) => !p.isTemplate && p.isActive && (p.type === 'work_timing' || p.category === 'work_policy'),
      );
      if (workPolicy) {
        // Prefer explicit maxWorkingHoursPerWeek, fallback to minWorkingHours * 5
        if (workPolicy.maxWorkingHoursPerWeek) {
          return workPolicy.maxWorkingHoursPerWeek;
        }
        if (workPolicy.workTiming?.minWorkingHours) {
          return workPolicy.workTiming.minWorkingHours * 5;
        }
      }
      return DEFAULT_HOURS;
    } catch (err) {
      this.logger.warn(`Could not fetch work policy, defaulting to ${DEFAULT_HOURS}h/week: ${err.message || err}`);
      return DEFAULT_HOURS;
    }
  }

  async autoPopulateTimesheet(userId: string, startDate: string, endDate: string, authToken?: string, orgId?: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const entries: any[] = [];

    // 1. Pull from task time entries
    const taskFilter: any = {
      isDeleted: false,
      'timeEntries.userId': userId,
      'timeEntries.date': { $gte: start, $lte: end },
    };
    if (orgId) taskFilter.organizationId = orgId;
    const tasks = await this.taskModel.find(taskFilter);

    for (const task of tasks) {
      for (const entry of (task as any).timeEntries || []) {
        const entryDate = new Date(entry.date);
        if (entry.userId === userId && entryDate >= start && entryDate <= end) {
          entries.push({
            date: entry.date,
            taskId: task._id.toString(),
            projectId: (task as any).projectId || '',
            projectName: '',
            taskTitle: (task as any).title || '',
            hours: entry.hours,
            description: entry.description || '',
            category: 'development',
          });
        }
      }
    }

    // 2. Pull from attendance records (clock-in/out)
    try {
      const attendanceUrl = process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3011';
      const axios = require('axios');
      const headers: any = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await axios.get(`${attendanceUrl}/api/v1/attendance`, {
        params: { startDate, endDate, employeeId: userId, limit: 100 },
        headers,
        timeout: 5000,
      });
      const records = res.data?.data || [];
      for (const record of records) {
        if (record.checkInTime && record.checkOutTime && record.totalWorkingHours > 0) {
          entries.push({
            date: record.date || record.checkInTime,
            taskId: '',
            projectId: '',
            projectName: '',
            taskTitle: 'Clock-in / Clock-out',
            hours: Math.round(record.totalWorkingHours * 100) / 100,
            description: `Checked in: ${new Date(record.checkInTime).toLocaleTimeString()} - Checked out: ${new Date(record.checkOutTime).toLocaleTimeString()}`,
            category: 'admin',
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch attendance for timesheet auto-populate: ${err.message || err}`);
    }

    return entries;
  }

  async getTimesheetStats(userId?: string, orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (userId) filter.employeeId = userId;

    const [total, byStatus] = await Promise.all([
      this.timesheetModel.countDocuments(filter),
      this.timesheetModel.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 }, totalHours: { $sum: '$totalHours' } } },
      ]),
    ]);

    const statusCounts: Record<string, number> = {};
    let totalHours = 0;
    byStatus.forEach((item) => {
      statusCounts[item._id] = item.count;
      totalHours += item.totalHours;
    });

    return { total, byStatus: statusCounts, totalHours };
  }
}
