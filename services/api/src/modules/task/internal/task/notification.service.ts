import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { INotification } from './schemas/notification.schema';

export type NotificationType = 'mention' | 'assignment' | 'status_change' | 'comment' | 'due_date' | 'overdue' | 'sprint';

/**
 * Extract @mentioned user IDs from text content.
 * Supports:
 *   - Rich mention: @[Display Name](userId)
 *   - Simple ObjectId mention: @64a1b2c3d4e5f6a7b8c9d0e1
 */
export function extractMentions(text: string): string[] {
  const ids = new Set<string>();
  // Rich mention pattern: @[name](userId)
  const richRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = richRegex.exec(text)) !== null) {
    ids.add(match[2]);
  }
  // Simple ObjectId pattern: @64a1b2c3...
  const simpleRegex = /@([a-f0-9]{24})\b/g;
  while ((match = simpleRegex.exec(text)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('Notification', 'nexora_tasks') private notificationModel: Model<INotification>,
  ) {}

  async createNotification(data: {
    organizationId?: string;
    userId: string;
    taskId: string;
    projectId: string;
    type: NotificationType;
    actor: { userId: string; userName: string; userEmail: string };
    title: string;
    message: string;
    taskKey?: string;
    actionUrl?: string;
  }): Promise<INotification> {
    const notification = new this.notificationModel(data);
    await notification.save();
    this.logger.log(
      `Notification created: ${data.type} for user ${data.userId} on task ${data.taskId}`,
    );
    return notification;
  }

  async getUserNotifications(
    userId: string,
    orgId?: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<{ data: INotification[]; total: number; unread: number }> {
    const filter: any = { userId };
    if (orgId) filter.organizationId = orgId;

    const [data, total, unread] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({ ...filter, read: false }),
    ]);

    return { data, total, unread };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
    orgId?: string,
  ): Promise<INotification | null> {
    const filter: any = { _id: notificationId, userId };
    if (orgId) filter.organizationId = orgId;

    return this.notificationModel.findOneAndUpdate(
      filter,
      { read: true, readAt: new Date() },
      { new: true },
    );
  }

  async markAllAsRead(userId: string, orgId?: string): Promise<any> {
    const filter: any = { userId, read: false };
    if (orgId) filter.organizationId = orgId;

    return this.notificationModel.updateMany(
      filter,
      { read: true, readAt: new Date() },
    );
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
    orgId?: string,
  ): Promise<any> {
    const filter: any = { _id: notificationId, userId };
    if (orgId) filter.organizationId = orgId;

    return this.notificationModel.deleteOne(filter);
  }

  async createMentionNotification(data: {
    organizationId?: string;
    mentionedUserIds: string[];
    taskId: string;
    projectId: string;
    taskKey?: string;
    taskTitle: string;
    actor: { userId: string; userName: string; userEmail: string };
  }): Promise<INotification[]> {
    const notifications = await Promise.all(
      data.mentionedUserIds
        .filter((id) => id !== data.actor.userId) // Don't notify self
        .map((userId) =>
          this.createNotification({
            organizationId: data.organizationId,
            userId,
            taskId: data.taskId,
            projectId: data.projectId,
            type: 'mention',
            actor: data.actor,
            title: `${data.actor.userName} mentioned you`,
            message: `You were mentioned in a comment on ${data.taskKey || data.taskTitle}`,
            taskKey: data.taskKey,
            actionUrl: `/projects/${data.projectId}/items/${data.taskId}`,
          }),
        ),
    );
    return notifications;
  }

  async createAssignmentNotification(data: {
    organizationId?: string;
    userId: string;
    taskId: string;
    projectId: string;
    taskKey?: string;
    taskTitle: string;
    actor: { userId: string; userName: string; userEmail: string };
  }): Promise<INotification> {
    if (data.userId === data.actor.userId) return null; // Don't notify self
    return this.createNotification({
      organizationId: data.organizationId,
      userId: data.userId,
      taskId: data.taskId,
      projectId: data.projectId,
      type: 'assignment',
      actor: data.actor,
      title: `${data.actor.userName} assigned you to ${data.taskKey || data.taskTitle}`,
      message: `You have been assigned to ${data.taskKey || data.taskTitle}`,
      taskKey: data.taskKey,
      actionUrl: `/projects/${data.projectId}/items/${data.taskId}`,
    });
  }

  async createStatusChangeNotification(data: {
    organizationId?: string;
    userId: string;
    taskId: string;
    projectId: string;
    taskKey?: string;
    taskTitle: string;
    fromStatus: string;
    toStatus: string;
    actor: { userId: string; userName: string; userEmail: string };
  }): Promise<INotification | null> {
    if (data.userId === data.actor.userId) return null;
    return this.createNotification({
      organizationId: data.organizationId,
      userId: data.userId,
      taskId: data.taskId,
      projectId: data.projectId,
      type: 'status_change',
      actor: data.actor,
      title: `${data.actor.userName} changed status of ${data.taskKey || data.taskTitle}`,
      message: `Status changed from ${data.fromStatus} to ${data.toStatus}`,
      taskKey: data.taskKey,
      actionUrl: `/projects/${data.projectId}/items/${data.taskId}`,
    });
  }

  async createCommentNotification(data: {
    organizationId?: string;
    recipientIds: string[];
    taskId: string;
    projectId: string;
    taskKey?: string;
    taskTitle: string;
    actor: { userId: string; userName: string; userEmail: string };
  }): Promise<INotification[]> {
    const notifications = await Promise.all(
      data.recipientIds
        .filter((id) => id !== data.actor.userId)
        .map((userId) =>
          this.createNotification({
            organizationId: data.organizationId,
            userId,
            taskId: data.taskId,
            projectId: data.projectId,
            type: 'comment',
            actor: data.actor,
            title: `${data.actor.userName} commented on ${data.taskKey || data.taskTitle}`,
            message: `New comment on ${data.taskKey || data.taskTitle}`,
            taskKey: data.taskKey,
            actionUrl: `/projects/${data.projectId}/items/${data.taskId}`,
          }),
        ),
    );
    return notifications;
  }

  async createDueDateNotification(data: {
    organizationId?: string;
    userId: string;
    taskId: string;
    projectId: string;
    taskKey?: string;
    taskTitle: string;
    dueLabel: string; // e.g. "tomorrow", "today"
  }): Promise<INotification> {
    const systemActor = { userId: 'system', userName: 'Nexora', userEmail: 'system@nexora.app' };
    return this.createNotification({
      organizationId: data.organizationId,
      userId: data.userId,
      taskId: data.taskId,
      projectId: data.projectId,
      type: 'due_date',
      actor: systemActor,
      title: `${data.taskKey || data.taskTitle} is due ${data.dueLabel}`,
      message: `Task "${data.taskTitle}" is due ${data.dueLabel}. Make sure it's on track.`,
      taskKey: data.taskKey,
      actionUrl: `/projects/${data.projectId}/items/${data.taskId}`,
    });
  }

  async createOverdueNotification(data: {
    organizationId?: string;
    userId: string;
    taskId: string;
    projectId: string;
    taskKey?: string;
    taskTitle: string;
    daysOverdue: number;
  }): Promise<INotification> {
    const systemActor = { userId: 'system', userName: 'Nexora', userEmail: 'system@nexora.app' };
    return this.createNotification({
      organizationId: data.organizationId,
      userId: data.userId,
      taskId: data.taskId,
      projectId: data.projectId,
      type: 'overdue',
      actor: systemActor,
      title: `${data.taskKey || data.taskTitle} is overdue`,
      message: `Task "${data.taskTitle}" is overdue by ${data.daysOverdue} day${data.daysOverdue === 1 ? '' : 's'}.`,
      taskKey: data.taskKey,
      actionUrl: `/projects/${data.projectId}/items/${data.taskId}`,
    });
  }

  async createSprintNotification(data: {
    organizationId?: string;
    recipientIds: string[];
    projectId: string;
    sprintName: string;
    event: 'started' | 'completed';
    details?: string;
    actor: { userId: string; userName: string; userEmail: string };
  }): Promise<INotification[]> {
    const notifications = await Promise.all(
      data.recipientIds
        .filter((id) => id !== data.actor.userId)
        .map((userId) =>
          this.createNotification({
            organizationId: data.organizationId,
            userId,
            taskId: '', // sprint notifications don't have a specific taskId
            projectId: data.projectId,
            type: 'sprint',
            actor: data.actor,
            title: `Sprint "${data.sprintName}" ${data.event}`,
            message: data.details || `Sprint "${data.sprintName}" has been ${data.event}.`,
            actionUrl: `/projects/${data.projectId}`,
          }),
        ),
    );
    return notifications;
  }

  /**
   * Notify watchers of a task (excluding the actor).
   */
  async notifyWatchers(data: {
    organizationId?: string;
    watchers: string[];
    taskId: string;
    projectId: string;
    taskKey?: string;
    taskTitle: string;
    type: NotificationType;
    title: string;
    message: string;
    actor: { userId: string; userName: string; userEmail: string };
  }): Promise<INotification[]> {
    const notifications = await Promise.all(
      (data.watchers || [])
        .filter((id) => id !== data.actor.userId)
        .map((userId) =>
          this.createNotification({
            organizationId: data.organizationId,
            userId,
            taskId: data.taskId,
            projectId: data.projectId,
            type: data.type,
            actor: data.actor,
            title: data.title,
            message: data.message,
            taskKey: data.taskKey,
            actionUrl: `/projects/${data.projectId}/items/${data.taskId}`,
          }),
        ),
    );
    return notifications;
  }
}
