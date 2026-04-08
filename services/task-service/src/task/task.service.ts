import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITask } from './schemas/task.schema';
import { IBoard } from './schemas/board.schema';
import { ICounter } from './schemas/counter.schema';
import { ITimesheet } from './schemas/timesheet.schema';
import { IActivity } from './schemas/activity.schema';
import { ISprint } from './schemas/sprint.schema';
import { NotificationService, extractMentions } from './notification.service';
import {
  CreateTaskDto, UpdateTaskDto, AddCommentDto,
  LogTimeDto, TaskQueryDto, UpdateStatusDto, BulkUpdateDto,
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
    @InjectModel('Board') private boardModel: Model<IBoard>,
    @InjectModel('Counter') private counterModel: Model<ICounter>,
    @InjectModel('Timesheet') private timesheetModel: Model<ITimesheet>,
    @InjectModel('Activity') private activityModel: Model<IActivity>,
    @InjectModel('Sprint') private sprintModel: Model<ISprint>,
    private notificationService: NotificationService,
  ) {}

  private async getNextTaskKey(projectId: string, projectKey: string): Promise<string> {
    const prefix = projectKey || projectId.slice(-4).toUpperCase();
    const counter = await this.counterModel.findByIdAndUpdate(
      `taskseq_${projectId}`,
      { $inc: { sequence: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return `${prefix}-${counter.sequence}`;
  }

  async createTask(dto: CreateTaskDto, userId: string, orgId?: string) {
    // Auto-generate task key atomically to prevent duplicates
    const taskKey = await this.getNextTaskKey(dto.projectId, dto.projectKey);

    const { projectKey: _pk, ...taskData } = dto as any;
    const task = new this.taskModel({
      ...taskData,
      taskKey,
      reporterId: userId,
      createdBy: userId,
      ...(orgId && { organizationId: orgId }),
    });
    await task.save();
    this.logger.log(`Task created: ${task.taskKey || task._id} - ${dto.title}`);
    await this.logActivity({
      projectId: task.projectId,
      organizationId: orgId,
      taskId: task._id.toString(),
      action: 'task.created',
      actorId: userId,
      entityType: 'task',
      entityTitle: task.title,
      details: { type: task.type, priority: task.priority, status: task.status },
    }).catch(() => {});

    // Notification: assignment on creation
    if (task.assigneeId && task.assigneeId !== userId) {
      const actor = { userId, userName: userId, userEmail: userId };
      this.notificationService.createAssignmentNotification({
        organizationId: orgId,
        userId: task.assigneeId,
        taskId: task._id.toString(),
        projectId: task.projectId,
        taskKey: task.taskKey,
        taskTitle: task.title,
        actor,
      }).catch((e) => this.logger.error(`Failed to create assignment notification: ${e.message}`));
    }

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
    if (query.sprintId) filter.sprintId = query.sprintId;
    if (query.boardId) filter.boardId = query.boardId;
    if (query.columnId) filter.columnId = query.columnId;
    if (query.parentTaskId) filter.parentTaskId = query.parentTaskId;
    if (query.labels) filter.labels = { $in: query.labels.split(',') };
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

  async updateTask(id: string, dto: UpdateTaskDto, userId: string, orgId?: string, orgRole?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');

    // Ownership check: members can only edit tasks they created or are assigned to
    if (orgRole && !['admin', 'owner', 'manager'].includes(orgRole)) {
      if (task.createdBy !== userId && task.assigneeId !== userId) {
        throw new ForbiddenException('You can only edit tasks you created or are assigned to');
      }
    }

    const updatePayload: any = { ...dto, updatedBy: userId };

    // Sync columnId when status changes via general update
    if (dto.status && dto.status !== task.status && task.boardId && !dto.columnId) {
      const board = await this.boardModel.findById(task.boardId);
      if (board) {
        const matchingColumn = board.columns.find(
          col => col.statusMapping && col.statusMapping.includes(dto.status),
        );
        if (matchingColumn) {
          updatePayload.columnId = matchingColumn.id;
        }
      }
    }

    const previousAssignee = task.assigneeId;
    const previousStatus = task.status;

    const updated = await this.taskModel.findOneAndUpdate(
      filter,
      updatePayload,
      { new: true },
    );
    if (!updated) throw new NotFoundException('Task not found');
    this.logger.log(`Task updated: ${updated._id}`);
    await this.logActivity({
      projectId: updated.projectId,
      organizationId: orgId,
      taskId: updated._id.toString(),
      action: dto.status ? 'task.status_changed' : 'task.updated',
      actorId: userId,
      entityType: 'task',
      entityTitle: updated.title,
      details: { ...(dto.status ? { from: task.status, to: dto.status } : {}), ...Object.keys(dto).reduce((a, k) => ({ ...a, [k]: (dto as any)[k] }), {}) },
    }).catch(() => {});

    // Notification triggers (fire-and-forget)
    const actor = { userId, userName: userId, userEmail: userId };
    try {
      // Assignment change notification
      if (dto.assigneeId && dto.assigneeId !== previousAssignee) {
        await this.notificationService.createAssignmentNotification({
          organizationId: orgId,
          userId: dto.assigneeId,
          taskId: updated._id.toString(),
          projectId: updated.projectId,
          taskKey: updated.taskKey,
          taskTitle: updated.title,
          actor,
        });
      }

      // Status change notification — notify assignee + watchers
      if (dto.status && dto.status !== previousStatus) {
        if (updated.assigneeId) {
          await this.notificationService.createStatusChangeNotification({
            organizationId: orgId,
            userId: updated.assigneeId,
            taskId: updated._id.toString(),
            projectId: updated.projectId,
            taskKey: updated.taskKey,
            taskTitle: updated.title,
            fromStatus: previousStatus,
            toStatus: dto.status,
            actor,
          });
        }
        // Notify watchers
        if (updated.watchers?.length) {
          const alreadyNotified = new Set([userId, updated.assigneeId].filter(Boolean));
          const watcherIds = updated.watchers.filter((w) => !alreadyNotified.has(w));
          if (watcherIds.length) {
            await this.notificationService.notifyWatchers({
              organizationId: orgId,
              watchers: watcherIds,
              taskId: updated._id.toString(),
              projectId: updated.projectId,
              taskKey: updated.taskKey,
              taskTitle: updated.title,
              type: 'status_change',
              title: `${updated.taskKey || updated.title} status changed`,
              message: `Status changed from ${previousStatus} to ${dto.status}`,
              actor,
            });
          }
        }
      }
    } catch (e) {
      this.logger.error(`Failed to send update notifications: ${e.message}`);
    }

    return updated;
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

    const actor = { userId, userName: userId, userEmail: userId };
    const alreadyNotified = new Set<string>([userId]);

    // Create mention notifications — combine explicit + auto-detected mentions
    try {
      const autoMentionedIds = extractMentions(dto.content);
      const explicitIds = dto.mentionedUserIds || [];
      const allMentionIds = [...new Set([...explicitIds, ...autoMentionedIds])];
      if (allMentionIds.length > 0) {
        await this.notificationService.createMentionNotification({
          organizationId: orgId,
          mentionedUserIds: allMentionIds,
          taskId: task._id.toString(),
          projectId: task.projectId,
          taskKey: task.taskKey,
          taskTitle: task.title,
          actor,
        });
        allMentionIds.forEach((id) => alreadyNotified.add(id));
      }
    } catch (error) {
      this.logger.error(`Failed to create mention notifications: ${error.message}`);
    }

    // Comment notification: notify assignee + watchers (excluding already-mentioned users)
    try {
      const commentRecipients: string[] = [];
      if (task.assigneeId && !alreadyNotified.has(task.assigneeId)) {
        commentRecipients.push(task.assigneeId);
        alreadyNotified.add(task.assigneeId);
      }
      if (task.watchers?.length) {
        for (const w of task.watchers) {
          if (!alreadyNotified.has(w)) {
            commentRecipients.push(w);
            alreadyNotified.add(w);
          }
        }
      }
      // Also notify the reporter if different
      if (task.reporterId && !alreadyNotified.has(task.reporterId)) {
        commentRecipients.push(task.reporterId);
      }
      if (commentRecipients.length > 0) {
        await this.notificationService.createCommentNotification({
          organizationId: orgId,
          recipientIds: commentRecipients,
          taskId: task._id.toString(),
          projectId: task.projectId,
          taskKey: task.taskKey,
          taskTitle: task.title,
          actor,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create comment notifications: ${error.message}`);
    }

    // Activity log for comment
    await this.logActivity({
      projectId: task.projectId,
      organizationId: orgId,
      taskId: task._id.toString(),
      action: 'task.comment_added',
      actorId: userId,
      entityType: 'task',
      entityTitle: task.title,
      details: { commentPreview: dto.content.substring(0, 100) },
    }).catch(() => {});

    return task;
  }

  async updateComment(taskId: string, commentId: string, content: string, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    const comment = task.comments.find(c => c._id?.toString() === commentId);
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new Error('Can only edit your own comments');
    comment.content = content;
    comment.updatedAt = new Date();
    comment.isEdited = true;
    return task.save();
  }

  async deleteComment(taskId: string, commentId: string, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    const comment = task.comments.find(c => c._id?.toString() === commentId);
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new Error('Can only delete your own comments');
    task.comments = task.comments.filter(c => c._id?.toString() !== commentId) as any;
    return task.save();
  }

  async toggleReaction(taskId: string, commentId: string, emoji: string, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    const comment = task.comments.find(c => c._id?.toString() === commentId);
    if (!comment) throw new NotFoundException('Comment not found');
    if (!comment.reactions) comment.reactions = [];
    const existing = comment.reactions.find(r => r.emoji === emoji);
    if (existing) {
      const idx = existing.userIds.indexOf(userId);
      if (idx > -1) {
        existing.userIds.splice(idx, 1);
        if (existing.userIds.length === 0) {
          comment.reactions = comment.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        existing.userIds.push(userId);
      }
    } else {
      comment.reactions.push({ emoji, userIds: [userId] });
    }
    return task.save();
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
            category: dto.category || 'development',
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

  async getMyWork(userId: string, orgId?: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const baseFilter: any = { assigneeId: userId, isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, trivial: 4 };
    const sortByPriority = (a: any, b: any) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);

    // Fetch all non-done assigned tasks + recently completed in parallel
    const [activeTasks, recentlyCompletedRaw] = await Promise.all([
      this.taskModel.find({
        ...baseFilter,
        status: { $nin: ['done', 'cancelled'] },
      }).lean(),
      this.taskModel.find({
        ...baseFilter,
        status: 'done',
        completedAt: { $gte: sevenDaysAgo },
      }).sort({ completedAt: -1 }).limit(10).lean(),
    ]);

    // Categorize active tasks
    const overdue: any[] = [];
    const dueToday: any[] = [];
    const inProgress: any[] = [];
    const blocked: any[] = [];
    const readyToStart: any[] = [];
    const upcomingThisSprint: any[] = [];

    // Collect all dependency itemIds for blocked_by resolution
    const allDepIds = new Set<string>();
    for (const task of activeTasks) {
      if (task.dependencies?.length) {
        for (const dep of task.dependencies) {
          if (dep.type === 'blocked_by') allDepIds.add(dep.itemId);
        }
      }
    }

    // Fetch blocking dependency statuses in bulk
    let depStatusMap: Record<string, string> = {};
    if (allDepIds.size > 0) {
      const depTasks = await this.taskModel.find(
        { _id: { $in: Array.from(allDepIds) }, isDeleted: false },
        { _id: 1, status: 1 },
      ).lean();
      depStatusMap = depTasks.reduce((m, t) => {
        m[t._id.toString()] = t.status;
        return m;
      }, {} as Record<string, string>);
    }

    // Find active sprint IDs for this user's tasks
    const sprintIds = [...new Set(activeTasks.filter(t => t.sprintId).map(t => t.sprintId))];
    let activeSprintIds = new Set<string>();
    if (sprintIds.length > 0) {
      const activeSprints = await this.sprintModel.find(
        { _id: { $in: sprintIds }, status: 'active' },
        { _id: 1 },
      ).lean();
      activeSprintIds = new Set(activeSprints.map(s => s._id.toString()));
    }

    for (const task of activeTasks) {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;

      // Overdue: past due, not done
      if (dueDate && dueDate < startOfDay) {
        overdue.push(task);
        continue;
      }

      // Due today
      if (dueDate && dueDate >= startOfDay && dueDate <= endOfDay) {
        dueToday.push(task);
        continue;
      }

      // Blocked
      if (task.status === 'blocked') {
        blocked.push(task);
        continue;
      }

      // In Progress
      if (task.status === 'in_progress' || task.status === 'in_review') {
        inProgress.push(task);
        continue;
      }

      // Ready to start: status=todo, all blocked_by dependencies resolved (done/cancelled)
      if (task.status === 'todo') {
        const blockedByDeps = (task.dependencies || []).filter(d => d.type === 'blocked_by');
        const allResolved = blockedByDeps.length === 0 || blockedByDeps.every(d => {
          const depStatus = depStatusMap[d.itemId];
          return depStatus === 'done' || depStatus === 'cancelled';
        });
        if (allResolved) {
          readyToStart.push(task);
          continue;
        }
      }

      // Upcoming this sprint: in an active sprint, not started yet
      if (task.sprintId && activeSprintIds.has(task.sprintId) && ['backlog', 'todo'].includes(task.status)) {
        upcomingThisSprint.push(task);
        continue;
      }
    }

    // Sort each group by priority
    overdue.sort(sortByPriority);
    dueToday.sort(sortByPriority);
    inProgress.sort(sortByPriority);
    readyToStart.sort(sortByPriority);
    blocked.sort(sortByPriority);
    upcomingThisSprint.sort(sortByPriority);

    return {
      overdue,
      dueToday,
      inProgress,
      readyToStart,
      blocked,
      upcomingThisSprint,
      recentlyCompleted: recentlyCompletedRaw,
    };
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

  async getProjectTaskStats(projectId: string, orgId?: string) {
    const baseFilter: any = { projectId, isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;
    const [total, completed, overdue] = await Promise.all([
      this.taskModel.countDocuments(baseFilter),
      this.taskModel.countDocuments({ ...baseFilter, status: 'done' }),
      this.taskModel.countDocuments({
        ...baseFilter,
        status: { $nin: ['done', 'cancelled'] },
        dueDate: { $lt: new Date() },
      }),
    ]);
    return {
      total,
      completed,
      overdue,
      progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  async toggleFlag(taskId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    task.isFlagged = !task.isFlagged;
    return task.save();
  }

  async toggleWatch(taskId: string, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    if (!task.watchers) task.watchers = [];
    const idx = task.watchers.indexOf(userId);
    if (idx > -1) task.watchers.splice(idx, 1);
    else task.watchers.push(userId);
    return task.save();
  }

  async toggleVote(taskId: string, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');
    if (!task.votes) task.votes = [];
    const idx = task.votes.indexOf(userId);
    if (idx > -1) task.votes.splice(idx, 1);
    else task.votes.push(userId);
    return task.save();
  }

  async duplicateTask(taskId: string, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const original = await this.taskModel.findOne(filter).lean();
    if (!original) throw new NotFoundException('Task not found');

    const { _id, taskKey, createdAt, updatedAt, statusHistory, timeEntries, comments, attachments, completedAt, ...taskData } = original as any;
    const newKey = await this.getNextTaskKey(taskData.projectId, taskData.projectKey || '');

    const duplicate = new this.taskModel({
      ...taskData,
      taskKey: newKey,
      title: `${taskData.title} (Copy)`,
      status: 'backlog',
      sprintId: null,
      columnId: null,
      loggedHours: 0,
      isFlagged: false,
      votes: [],
      watchers: [],
      dependencies: [],
      statusHistory: [],
      timeEntries: [],
      comments: [],
      attachments: [],
      createdBy: userId,
      reporterId: userId,
      ...(orgId && { organizationId: orgId }),
    });

    return duplicate.save();
  }

  async bulkUpdate(dto: BulkUpdateDto, userId: string, orgId?: string) {
    const { taskIds, addLabels, removeLabels, ...updates } = dto;

    const setOps: any = { updatedBy: userId };
    if (updates.assigneeId !== undefined) setOps.assigneeId = updates.assigneeId;
    if (updates.priority) setOps.priority = updates.priority;
    if (updates.status) setOps.status = updates.status;
    if (updates.sprintId !== undefined) setOps.sprintId = updates.sprintId;

    const updateQuery: any = {};
    if (Object.keys(setOps).length > 0) updateQuery.$set = setOps;
    if (addLabels?.length) updateQuery.$addToSet = { labels: { $each: addLabels } };
    if (removeLabels?.length) updateQuery.$pull = { labels: { $in: removeLabels } };

    const baseFilter: any = { _id: { $in: taskIds }, isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;

    const result = await this.taskModel.updateMany(baseFilter, updateQuery);
    return { modifiedCount: result.modifiedCount };
  }

  async updateStatus(taskId: string, dto: UpdateStatusDto, userId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const existingTask = await this.taskModel.findOne(filter);
    if (!existingTask) throw new NotFoundException('Task not found');

    const setOps: any = { status: dto.status, updatedBy: userId };

    // Sync columnId with the new status via board's statusMapping
    if (existingTask.boardId) {
      const board = await this.boardModel.findById(existingTask.boardId);
      if (board) {
        const matchingColumn = board.columns.find(
          col => col.statusMapping && col.statusMapping.includes(dto.status),
        );
        if (matchingColumn) {
          setOps.columnId = matchingColumn.id;
        }
      }
    }

    if (dto.status === 'done' && existingTask.status !== 'done') {
      setOps.completedAt = new Date();
      setOps.resolution = dto.resolution || 'done';
    } else if (dto.status !== 'done' && existingTask.status === 'done') {
      setOps.completedAt = null;
      setOps.resolution = null;
    }

    if (dto.status !== existingTask.status) {
      const task = await this.taskModel.findOneAndUpdate(
        filter,
        {
          $set: setOps,
          $push: { statusHistory: { status: dto.status, changedAt: new Date(), changedBy: userId } },
        },
        { new: true },
      );
      if (!task) throw new NotFoundException('Task not found');
      this.logger.log(`Task ${taskId} status changed to ${dto.status}`);

      // Notification + activity for status change
      const actor = { userId, userName: userId, userEmail: userId };
      try {
        // Notify assignee
        if (task.assigneeId) {
          await this.notificationService.createStatusChangeNotification({
            organizationId: orgId,
            userId: task.assigneeId,
            taskId: task._id.toString(),
            projectId: task.projectId,
            taskKey: task.taskKey,
            taskTitle: task.title,
            fromStatus: existingTask.status,
            toStatus: dto.status,
            actor,
          });
        }
        // Notify watchers (excluding assignee and actor)
        if (task.watchers?.length) {
          const skip = new Set([userId, task.assigneeId].filter(Boolean));
          const watcherIds = task.watchers.filter((w) => !skip.has(w));
          if (watcherIds.length) {
            await this.notificationService.notifyWatchers({
              organizationId: orgId,
              watchers: watcherIds,
              taskId: task._id.toString(),
              projectId: task.projectId,
              taskKey: task.taskKey,
              taskTitle: task.title,
              type: 'status_change',
              title: `${task.taskKey || task.title} status changed to ${dto.status}`,
              message: `Status changed from ${existingTask.status} to ${dto.status}`,
              actor,
            });
          }
        }
      } catch (e) {
        this.logger.error(`Failed to send status change notifications: ${e.message}`);
      }

      await this.logActivity({
        projectId: task.projectId,
        organizationId: orgId,
        taskId: task._id.toString(),
        action: 'task.status_changed',
        actorId: userId,
        entityType: 'task',
        entityTitle: task.title,
        details: { from: existingTask.status, to: dto.status },
      }).catch(() => {});

      return task;
    }

    const task = await this.taskModel.findOneAndUpdate(filter, { $set: setOps }, { new: true });
    if (!task) throw new NotFoundException('Task not found');
    this.logger.log(`Task ${taskId} status updated: ${dto.status}`);
    return task;
  }

  async getChildTasks(taskId: string, orgId?: string) {
    const filter: any = { parentTaskId: taskId };
    if (orgId) filter.organizationId = orgId;
    return this.taskModel.find(filter).sort({ type: 1, createdAt: 1 });
  }

  // ── Timesheet Methods ──

  async createTimesheet(dto: CreateTimesheetDto, userId: string, authToken?: string, orgId?: string) {
    const periodType = dto.period.type || 'weekly';
    const startDate = new Date(dto.period.startDate);
    const endDate = new Date(dto.period.endDate);

    // Auto-populate entries from task time logs + attendance
    const autoEntries = await this.autoPopulateTimesheet(userId, dto.period.startDate, dto.period.endDate, authToken, orgId);
    const entries = autoEntries.length > 0 ? autoEntries : (dto.entries || []);

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

    // Fetch max working hours per week from active work policy (default 40)
    const maxHoursPerWeek = await this.getMaxWorkingHoursPerWeek(authToken);

    // Calculate expected hours based on period type
    let expectedHours: number;
    if (periodType === 'daily') {
      expectedHours = maxHoursPerWeek / 5;
    } else if (periodType === 'weekly') {
      expectedHours = maxHoursPerWeek;
    } else {
      // monthly: average weeks per month
      expectedHours = maxHoursPerWeek * 4.33;
    }
    expectedHours = parseFloat(expectedHours.toFixed(2));

    const timesheet = new this.timesheetModel({
      userId,
      period: { startDate, endDate, type: periodType },
      entries,
      totalHours,
      expectedHours,
      ...(orgId && { organizationId: orgId }),
    });
    await timesheet.save();
    this.logger.log(`Timesheet created: ${timesheet._id} for ${userId} with ${entries.length} auto-populated entries`);
    return timesheet;
  }

  async getMyTimesheets(userId: string, query: TimesheetQueryDto, orgId?: string) {
    const { status, page = 1, limit = 20 } = query;
    const filter: any = { userId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.timesheetModel.find(filter).sort({ 'period.startDate': -1 }).skip(skip).limit(limit),
      this.timesheetModel.countDocuments(filter),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getAllTimesheets(query: TimesheetQueryDto, orgId?: string) {
    const { status, page = 1, limit = 20 } = query;
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.timesheetModel.find(filter).sort({ 'period.startDate': -1 }).skip(skip).limit(limit),
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
      throw new ForbiddenException('Can only edit draft or revision-requested timesheets');
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
    const filter: any = { _id: id, userId, isDeleted: false, status: { $in: ['draft', 'revision_requested'] } };
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
    const filter: any = { _id: id, userId, isDeleted: false, status: { $in: ['draft', 'revision_requested'] } };
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
    if (userId) filter.userId = userId;

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

  async addDependency(taskId: string, itemId: string, type: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');

    // Prevent self-dependency
    if (taskId === itemId) throw new Error('Cannot add dependency to self');

    // Check not already exists
    const exists = (task.dependencies || []).some((d: any) => d.itemId === itemId && d.type === type);
    if (!exists) {
      if (!task.dependencies) task.dependencies = [];
      (task.dependencies as any[]).push({ itemId, type });
      await task.save();
    }
    return task;
  }

  async removeDependency(taskId: string, depItemId: string, orgId?: string) {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');

    task.dependencies = (task.dependencies || []).filter((d: any) => d.itemId !== depItemId) as any;
    await task.save();
    return task;
  }

  async logActivity(data: {
    projectId: string;
    organizationId?: string;
    boardId?: string;
    taskId?: string;
    sprintId?: string;
    action: string;
    actorId: string;
    actorName?: string;
    entityType: string;
    entityTitle?: string;
    details?: Record<string, any>;
  }) {
    try {
      await this.activityModel.create(data);
    } catch (e) {
      this.logger.warn('Failed to log activity: ' + e.message);
    }
  }

  async getProjectActivity(projectId: string, limit = 50, organizationId?: string) {
    const filter: any = { projectId };
    if (organizationId) filter.organizationId = organizationId;
    return this.activityModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getProjectAnalytics(projectId: string, orgId?: string) {
    const filter: any = { projectId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const allTasks = await this.taskModel.find(filter).lean();

    // Velocity by sprint (last 6 sprints) - compute from tasks with sprintId
    const sprintMap = new Map<string, { total: number; completed: number }>();
    for (const t of allTasks) {
      if (!t.sprintId) continue;
      const entry = sprintMap.get(t.sprintId) || { total: 0, completed: 0 };
      entry.total += (t.storyPoints || 0);
      if (t.status === 'done') entry.completed += (t.storyPoints || 0);
      sprintMap.set(t.sprintId, entry);
    }
    const velocityData = Array.from(sprintMap.entries()).slice(-6).map(([sprintId, data]) => ({
      sprintId,
      planned: data.total,
      completed: data.completed,
    }));

    // Status distribution (cumulative flow)
    const statusCounts: Record<string, number> = {};
    for (const t of allTasks) {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    }

    // Type distribution
    const typeCounts: Record<string, number> = {};
    for (const t of allTasks) {
      typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
    }

    // Priority distribution
    const priorityCounts: Record<string, number> = {};
    for (const t of allTasks) {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    }

    // Assignee workload
    const assigneeMap = new Map<string, { total: number; done: number; inProgress: number; points: number }>();
    for (const t of allTasks) {
      if (!t.assigneeId) continue;
      const entry = assigneeMap.get(t.assigneeId) || { total: 0, done: 0, inProgress: 0, points: 0 };
      entry.total++;
      entry.points += (t.storyPoints || 0);
      if (t.status === 'done') entry.done++;
      if (t.status === 'in_progress') entry.inProgress++;
      assigneeMap.set(t.assigneeId, entry);
    }
    const workloadData = Array.from(assigneeMap.entries()).map(([assigneeId, data]) => ({
      assigneeId,
      ...data,
    }));

    // Bug trend - bugs created over time (by week)
    const bugTasks = allTasks.filter(t => t.type === 'bug');

    // Completion over time
    const doneTasks = allTasks.filter(t => t.status === 'done');

    return {
      totalTasks: allTasks.length,
      statusDistribution: statusCounts,
      typeDistribution: typeCounts,
      priorityDistribution: priorityCounts,
      velocityData,
      workloadData,
      bugCount: bugTasks.length,
      doneCount: doneTasks.length,
      totalPoints: allTasks.reduce((s, t) => s + (t.storyPoints || 0), 0),
      completedPoints: doneTasks.reduce((s, t) => s + (t.storyPoints || 0), 0),
    };
  }

  // ── Export ──

  async getTasksForExport(query: {
    projectId?: string;
    status?: string;
    type?: string;
    assigneeId?: string;
    sprintId?: string;
  }, orgId?: string): Promise<ITask[]> {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (query.projectId) filter.projectId = query.projectId;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.assigneeId) filter.assigneeId = query.assigneeId;
    if (query.sprintId) filter.sprintId = query.sprintId;
    return this.taskModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  tasksToCSV(tasks: ITask[]): string {
    const headers = ['Key', 'Title', 'Description', 'Type', 'Status', 'Priority', 'Assignee', 'Story Points', 'Due Date', 'Sprint', 'Labels', 'Created', 'Updated'];
    const escapeCSV = (val: string | null | undefined): string => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const rows = tasks.map(t => [
      escapeCSV(t.taskKey),
      escapeCSV(t.title),
      escapeCSV(t.description),
      escapeCSV(t.type),
      escapeCSV(t.status),
      escapeCSV(t.priority),
      escapeCSV(t.assigneeId),
      t.storyPoints != null ? String(t.storyPoints) : '',
      t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '',
      escapeCSV(t.sprintId),
      escapeCSV((t.labels || []).join(', ')),
      t.createdAt ? new Date(t.createdAt).toISOString() : '',
      t.updatedAt ? new Date(t.updatedAt).toISOString() : '',
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  getImportTemplate(): string {
    return 'Title,Description,Type,Status,Priority,Assignee,Story Points,Due Date,Sprint,Labels\n';
  }

  // ── Import ──

  private static readonly COLUMN_MAP: Record<string, string> = {
    'title': 'title',
    'summary': 'title',
    'description': 'description',
    'type': 'type',
    'issue type': 'type',
    'issuetype': 'type',
    'status': 'status',
    'priority': 'priority',
    'assignee': 'assigneeId',
    'story points': 'storyPoints',
    'story_points': 'storyPoints',
    'storypoints': 'storyPoints',
    'due date': 'dueDate',
    'due_date': 'dueDate',
    'duedate': 'dueDate',
    'sprint': 'sprintId',
    'labels': 'labels',
    'label': 'labels',
  };

  private static readonly TYPE_MAP: Record<string, string> = {
    'story': 'story',
    'bug': 'bug',
    'task': 'task',
    'epic': 'epic',
    'sub-task': 'sub_task',
    'subtask': 'sub_task',
    'sub_task': 'sub_task',
    'improvement': 'improvement',
    'spike': 'spike',
  };

  private static readonly PRIORITY_MAP: Record<string, string> = {
    'highest': 'critical',
    'critical': 'critical',
    'blocker': 'critical',
    'high': 'high',
    'major': 'high',
    'medium': 'medium',
    'normal': 'medium',
    'low': 'low',
    'minor': 'low',
    'lowest': 'trivial',
    'trivial': 'trivial',
  };

  private static readonly STATUS_MAP: Record<string, string> = {
    'backlog': 'backlog',
    'to do': 'todo',
    'todo': 'todo',
    'open': 'todo',
    'new': 'todo',
    'in progress': 'in_progress',
    'in_progress': 'in_progress',
    'in development': 'in_progress',
    'in review': 'in_review',
    'in_review': 'in_review',
    'code review': 'in_review',
    'blocked': 'blocked',
    'done': 'done',
    'closed': 'done',
    'resolved': 'done',
    'complete': 'done',
    'completed': 'done',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'won\'t do': 'cancelled',
    'wontfix': 'cancelled',
  };

  parseCSV(csvContent: string): { headers: string[]; rows: string[][] } {
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < csvContent.length; i++) {
      const ch = csvContent[i];
      if (ch === '"') {
        if (inQuotes && csvContent[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (current.trim()) lines.push(current);
        current = '';
        if (ch === '\r' && csvContent[i + 1] === '\n') i++;
      } else {
        current += ch;
      }
    }
    if (current.trim()) lines.push(current);

    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const fields: string[] = [];
      let field = '';
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (q && line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            q = !q;
          }
        } else if (ch === ',' && !q) {
          fields.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      }
      fields.push(field.trim());
      return fields;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(l => parseLine(l));
    return { headers, rows };
  }

  detectJiraFormat(headers: string[]): boolean {
    const lower = headers.map(h => h.toLowerCase().trim());
    const jiraIndicators = ['summary', 'issue type', 'issue key', 'issue id', 'reporter'];
    return jiraIndicators.filter(j => lower.includes(j)).length >= 2;
  }

  async importTasks(
    csvContent: string,
    projectId: string,
    userId: string,
    orgId?: string,
    projectKey?: string,
  ): Promise<{ total: number; created: number; failed: number; errors: Array<{ row: number; reason: string }> }> {
    const { headers, rows } = this.parseCSV(csvContent);
    if (headers.length === 0 || rows.length === 0) {
      return { total: 0, created: 0, failed: 0, errors: [{ row: 0, reason: 'CSV file is empty or has no data rows' }] };
    }

    // Build column mapping
    const columnMapping: Array<{ csvIndex: number; field: string }> = [];
    for (let i = 0; i < headers.length; i++) {
      const normalized = headers[i].toLowerCase().trim();
      const field = TaskService.COLUMN_MAP[normalized];
      if (field) {
        columnMapping.push({ csvIndex: i, field });
      }
    }

    const errors: Array<{ row: number; reason: string }> = [];
    let created = 0;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      try {
        const taskData: any = { projectId };

        for (const { csvIndex, field } of columnMapping) {
          const val = row[csvIndex] || '';
          if (!val) continue;

          switch (field) {
            case 'title':
              taskData.title = val;
              break;
            case 'description':
              taskData.description = val;
              break;
            case 'type': {
              const mapped = TaskService.TYPE_MAP[val.toLowerCase().trim()];
              if (mapped) taskData.type = mapped;
              break;
            }
            case 'status': {
              const mapped = TaskService.STATUS_MAP[val.toLowerCase().trim()];
              if (mapped) taskData.status = mapped;
              break;
            }
            case 'priority': {
              const mapped = TaskService.PRIORITY_MAP[val.toLowerCase().trim()];
              if (mapped) taskData.priority = mapped;
              break;
            }
            case 'assigneeId':
              taskData.assigneeId = val;
              break;
            case 'storyPoints': {
              const pts = parseFloat(val);
              if (!isNaN(pts)) taskData.storyPoints = pts;
              break;
            }
            case 'dueDate':
              taskData.dueDate = val;
              break;
            case 'sprintId':
              taskData.sprintId = val;
              break;
            case 'labels':
              taskData.labels = val.split(',').map(l => l.trim()).filter(Boolean);
              break;
          }
        }

        if (!taskData.title) {
          errors.push({ row: r + 2, reason: 'Missing required field: title' });
          continue;
        }

        const dto: CreateTaskDto = {
          title: taskData.title,
          projectId,
          description: taskData.description,
          type: taskData.type,
          status: taskData.status,
          priority: taskData.priority,
          assigneeId: taskData.assigneeId,
          storyPoints: taskData.storyPoints,
          dueDate: taskData.dueDate,
          labels: taskData.labels,
          sprintId: taskData.sprintId,
          projectKey: projectKey || undefined,
        };

        // Remove undefined values
        Object.keys(dto).forEach(k => {
          if ((dto as any)[k] === undefined) delete (dto as any)[k];
        });

        await this.createTask(dto, userId, orgId);
        created++;
      } catch (e) {
        errors.push({ row: r + 2, reason: e.message || 'Unknown error' });
      }
    }

    return { total: rows.length, created, failed: rows.length - created, errors };
  }
}
