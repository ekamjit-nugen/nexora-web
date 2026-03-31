import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITimeLog } from '../schemas/time-log.schema';

export interface TimeLogInput {
  taskId: string;
  duration: number; // in minutes
  description?: string;
  date: Date;
  billable?: boolean;
  rate?: number;
}

export interface TimesheetData {
  userId: string;
  weekStart: Date;
  tasks: Array<{
    id: string;
    key: string;
    title: string;
    logsByDay: { [day: string]: number };
    weekTotal: number;
  }>;
  dailyTotals: { [day: string]: number };
  submitted: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

@Injectable()
export class TimeTrackingService {
  constructor(
    @InjectModel('TimeLog') private timeLogModel: Model<ITimeLog>,
  ) {}

  // ── Task-Level Time Logging ──

  async logTime(
    projectId: string,
    taskId: string,
    userId: string,
    input: TimeLogInput,
  ): Promise<ITimeLog> {
    if (input.duration < 1) {
      throw new BadRequestException('Duration must be at least 1 minute');
    }

    const timeLog = new this.timeLogModel({
      projectId,
      taskId,
      userId,
      duration: input.duration,
      description: input.description || '',
      date: input.date || new Date(),
      billable: input.billable !== false,
      rate: input.rate,
    });

    await timeLog.save();
    return timeLog;
  }

  async getTaskTimeLogs(projectId: string, taskId: string): Promise<ITimeLog[]> {
    return this.timeLogModel
      .find({
        projectId,
        taskId,
      })
      .sort({ date: -1 })
      .exec();
  }

  async getTotalTimeLogged(projectId: string, taskId: string): Promise<number> {
    const logs = await this.timeLogModel
      .find({
        projectId,
        taskId,
      })
      .exec();

    return logs.reduce((sum, log) => sum + log.duration, 0);
  }

  async updateTimeLog(
    projectId: string,
    logId: string,
    input: Partial<TimeLogInput>,
  ): Promise<ITimeLog> {
    const timeLog = await this.timeLogModel.findOne({
      _id: logId,
      projectId,
    });

    if (!timeLog) {
      throw new NotFoundException('Time log not found');
    }

    if (input.duration) {
      if (input.duration < 1) {
        throw new BadRequestException('Duration must be at least 1 minute');
      }
      timeLog.duration = input.duration;
    }

    if (input.description !== undefined) timeLog.description = input.description;
    if (input.date) timeLog.date = input.date;
    if (input.billable !== undefined) timeLog.billable = input.billable;
    if (input.rate) timeLog.rate = input.rate;

    await timeLog.save();
    return timeLog;
  }

  async deleteTimeLog(projectId: string, logId: string): Promise<void> {
    const result = await this.timeLogModel.deleteOne({
      _id: logId,
      projectId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Time log not found');
    }
  }

  // ── Weekly Timesheet ──

  async getWeeklyTimesheet(
    projectId: string,
    userId: string,
    weekStart: Date,
  ): Promise<TimesheetData> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const timeLogs = await this.timeLogModel
      .find({
        projectId,
        userId,
        date: { $gte: weekStart, $lte: weekEnd },
      })
      .exec();

    // Group by task
    const taskMap: { [taskId: string]: any } = {};
    const dailyTotals: { [day: string]: number } = {};

    timeLogs.forEach((log) => {
      const dateStr = log.date.toISOString().split('T')[0];

      if (!taskMap[log.taskId]) {
        taskMap[log.taskId] = {
          id: log.taskId,
          key: `TASK-${log.taskId.slice(-4)}`,
          title: 'Task',
          logsByDay: {},
          weekTotal: 0,
        };
      }

      if (!taskMap[log.taskId].logsByDay[dateStr]) {
        taskMap[log.taskId].logsByDay[dateStr] = 0;
      }

      taskMap[log.taskId].logsByDay[dateStr] += log.duration / 60;
      taskMap[log.taskId].weekTotal += log.duration / 60;

      if (!dailyTotals[dateStr]) {
        dailyTotals[dateStr] = 0;
      }
      dailyTotals[dateStr] += log.duration / 60;
    });

    const totalHours = Object.values(dailyTotals).reduce(
      (sum: number, hours: number) => sum + hours,
      0,
    );

    return {
      userId,
      weekStart,
      tasks: Object.values(taskMap),
      dailyTotals: Object.fromEntries(
        Object.entries(dailyTotals).map(([day, hours]) => [
          day,
          Math.round(hours * 10) / 10,
        ]),
      ),
      submitted: false,
    };
  }

  async submitTimesheet(
    projectId: string,
    userId: string,
    weekStart: Date,
  ): Promise<TimesheetData> {
    const timesheet = await this.getWeeklyTimesheet(projectId, userId, weekStart);

    return {
      ...timesheet,
      submitted: true,
      approvalStatus: 'pending',
      submittedAt: new Date(),
    };
  }

  async approveTimesheet(
    projectId: string,
    userId: string,
    weekStart: Date,
    approvedBy: string,
  ): Promise<TimesheetData> {
    const timesheet = await this.getWeeklyTimesheet(projectId, userId, weekStart);

    return {
      ...timesheet,
      submitted: true,
      approvalStatus: 'approved',
      submittedAt: new Date(),
      approvedBy,
      approvedAt: new Date(),
    };
  }

  async rejectTimesheet(
    projectId: string,
    userId: string,
    weekStart: Date,
    reason: string,
  ): Promise<TimesheetData> {
    const timesheet = await this.getWeeklyTimesheet(projectId, userId, weekStart);

    return {
      ...timesheet,
      submitted: true,
      approvalStatus: 'rejected',
      submittedAt: new Date(),
      rejectionReason: reason,
    };
  }

  // ── Billing Reports ──

  async getUserBillingData(
    projectId: string,
    userId: string,
    fromDate: Date,
    toDate: Date,
  ) {
    const timeLogs = await this.timeLogModel
      .find({
        projectId,
        userId,
        date: { $gte: fromDate, $lte: toDate },
      })
      .exec();

    const totalMinutes = timeLogs.reduce((sum, log) => sum + log.duration, 0);
    const totalHours = totalMinutes / 60;
    const billableMinutes = timeLogs
      .filter((log) => log.billable)
      .reduce((sum, log) => sum + log.duration, 0);
    const billableHours = billableMinutes / 60;
    const totalCost = timeLogs.reduce((sum, log) => sum + (log.duration / 60) * (log.rate || 50), 0);

    return {
      userId,
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
      logCount: timeLogs.length,
    };
  }

  async getProjectBillingData(
    projectId: string,
    fromDate: Date,
    toDate: Date,
  ) {
    const timeLogs = await this.timeLogModel
      .find({
        projectId,
        date: { $gte: fromDate, $lte: toDate },
      })
      .exec();

    const totalMinutes = timeLogs.reduce((sum, log) => sum + log.duration, 0);
    const totalHours = totalMinutes / 60;
    const billableMinutes = timeLogs
      .filter((log) => log.billable)
      .reduce((sum, log) => sum + log.duration, 0);
    const billableHours = billableMinutes / 60;
    const totalCost = timeLogs.reduce((sum, log) => sum + (log.duration / 60) * (log.rate || 50), 0);

    // Group by user
    const byUser: { [userId: string]: any } = {};
    timeLogs.forEach((log) => {
      if (!byUser[log.userId]) {
        byUser[log.userId] = {
          userId: log.userId,
          hours: 0,
          cost: 0,
        };
      }
      byUser[log.userId].hours += log.duration / 60;
      byUser[log.userId].cost += (log.duration / 60) * (log.rate || 50);
    });

    return {
      projectId,
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
      byUser: Object.values(byUser).map((u) => ({
        ...u,
        hours: Math.round(u.hours * 10) / 10,
        cost: Math.round(u.cost * 100) / 100,
      })),
    };
  }
}
