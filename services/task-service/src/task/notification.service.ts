import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { INotification } from './schemas/notification.schema';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('Notification') private notificationModel: Model<INotification>,
  ) {}

  async createNotification(data: {
    organizationId?: string;
    userId: string;
    taskId: string;
    projectId: string;
    type: 'mention' | 'assignment' | 'status_change' | 'comment' | 'due_date';
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
}
