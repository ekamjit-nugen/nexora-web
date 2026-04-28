import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaskPublicApi, TaskSummary } from './task-public-api';
import { TASK_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class TaskPublicApiImpl implements TaskPublicApi {
  constructor(
    @InjectModel('Task', TASK_DB) private readonly taskModel: Model<any>,
  ) {}

  async countOpenTasksForProject(organizationId: string, projectId: string): Promise<number> {
    return this.taskModel.countDocuments({
      organizationId,
      projectId,
      status: { $nin: ['done', 'cancelled'] },
      isDeleted: { $ne: true },
    });
  }

  async getTaskById(organizationId: string, taskId: string): Promise<TaskSummary | null> {
    const t: any = await this.taskModel.findOne({
      _id: taskId,
      organizationId,
      isDeleted: { $ne: true },
    }).lean();
    if (!t) return null;
    return {
      _id: String(t._id),
      organizationId: String(t.organizationId),
      title: t.title,
      status: t.status,
      assigneeId: t.assigneeId ? String(t.assigneeId) : null,
      projectId: t.projectId ? String(t.projectId) : null,
      dueDate: t.dueDate || null,
    };
  }
}
