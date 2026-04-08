import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITask } from './schemas/task.schema';
import { NotificationService } from './notification.service';
import { TaskService } from './task.service';

@Injectable()
export class TaskCronService {
  private readonly logger = new Logger(TaskCronService.name);

  constructor(
    @InjectModel('Task') private taskModel: Model<ITask>,
    private notificationService: NotificationService,
    private taskService: TaskService,
  ) {}

  /**
   * Run daily at 9 AM — find tasks due tomorrow and notify assignees.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDueDateReminders() {
    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);

    try {
      const tasks = await this.taskModel.find({
        isDeleted: false,
        status: { $nin: ['done', 'cancelled'] },
        dueDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
        assigneeId: { $ne: null, $exists: true },
      });

      let count = 0;
      for (const task of tasks) {
        try {
          await this.notificationService.createDueDateNotification({
            organizationId: (task as any).organizationId,
            userId: task.assigneeId,
            taskId: task._id.toString(),
            projectId: task.projectId,
            taskKey: task.taskKey,
            taskTitle: task.title,
            dueLabel: 'tomorrow',
          });
          count++;
        } catch (e) {
          this.logger.error(`Failed to send due date reminder for task ${task._id}: ${e.message}`);
        }
      }

      if (count > 0) {
        this.logger.log(`Due date reminders sent for ${count} task(s) due tomorrow`);
      }
    } catch (e) {
      this.logger.error(`Due date reminder cron failed: ${e.message}`);
    }
  }

  /**
   * Run daily at 9 AM — find overdue tasks and notify assignees.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueNotifications() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    try {
      const tasks = await this.taskModel.find({
        isDeleted: false,
        status: { $nin: ['done', 'cancelled'] },
        dueDate: { $lt: todayStart },
        assigneeId: { $ne: null, $exists: true },
      });

      let count = 0;
      for (const task of tasks) {
        const dueDate = new Date(task.dueDate);
        const daysOverdue = Math.ceil((todayStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Only send for 1, 3, 7, 14 days overdue to avoid notification fatigue
        if (![1, 3, 7, 14].includes(daysOverdue)) continue;

        try {
          await this.notificationService.createOverdueNotification({
            organizationId: (task as any).organizationId,
            userId: task.assigneeId,
            taskId: task._id.toString(),
            projectId: task.projectId,
            taskKey: task.taskKey,
            taskTitle: task.title,
            daysOverdue,
          });
          count++;
        } catch (e) {
          this.logger.error(`Failed to send overdue notification for task ${task._id}: ${e.message}`);
        }
      }

      if (count > 0) {
        this.logger.log(`Overdue notifications sent for ${count} task(s)`);
      }
    } catch (e) {
      this.logger.error(`Overdue notification cron failed: ${e.message}`);
    }
  }

  /**
   * Run daily at midnight — expire delegations whose endDate has passed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireApprovalDelegations() {
    try {
      const count = await this.taskService.expireOldDelegations();
      if (count > 0) {
        this.logger.log(`Expired ${count} approval delegation(s)`);
      }
    } catch (e) {
      this.logger.error(`Delegation expiration cron failed: ${e.message}`);
    }
  }
}
