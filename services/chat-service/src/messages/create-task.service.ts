import { Injectable, Logger, NotFoundException, ForbiddenException, Inject, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from './schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

/**
 * E3 Item 7.7: Create Task from Chat Message.
 *
 * Creates a task in Nexora's Task service from any chat message.
 * Posts a system message confirming task creation.
 *
 * Flow:
 * 1. User hovers message → clicks "Create Task"
 * 2. Modal: title (pre-filled), assignee, project, due date, priority
 * 3. POST /chat/messages/:id/create-task
 * 4. Service calls task-service via Redis pub/sub or HTTP
 * 5. System message posted: "✅ Task created: {title} — assigned to @{user}"
 */
@Injectable()
export class CreateTaskService {
  private readonly logger = new Logger(CreateTaskService.name);
  private readonly taskServiceUrl = process.env.TASK_SERVICE_URL || 'http://task-service:3021';

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {}

  async createTaskFromMessage(
    messageId: string,
    userId: string,
    taskData: {
      title: string;
      assigneeId?: string;
      projectId?: string;
      dueDate?: string;
      priority?: string;
    },
    authToken: string,
  ): Promise<{ taskId?: string; systemMessage: any }> {
    const message = await this.messageModel.findOne({ _id: messageId, isDeleted: false });
    if (!message) throw new NotFoundException('Message not found');

    const conversation = await this.conversationModel.findOne({
      _id: message.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant');

    // Create task via task-service
    // M-008: Currently forwards user JWT to task-service. This should ideally use
    // service-to-service auth (e.g., a shared secret or internal JWT) to avoid
    // coupling the user's token scope to inter-service calls. Acceptable for now.
    let taskId: string | null = null;
    try {
      const res = await fetch(`${this.taskServiceUrl}/api/v1/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: taskData.title,
          description: `Created from chat message:\n\n> ${message.content?.substring(0, 500)}\n\n— ${message.senderName || 'Unknown'} in ${conversation.name || 'Direct Message'}`,
          assigneeId: taskData.assigneeId,
          projectId: taskData.projectId,
          dueDate: taskData.dueDate,
          priority: taskData.priority || 'medium',
          metadata: {
            sourceType: 'chat_message',
            sourceMessageId: messageId,
            sourceConversationId: message.conversationId,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        taskId = data.data?._id;
      }
    } catch (err) {
      this.logger.warn(`Task creation via HTTP failed: ${err.message}. Trying Redis pub/sub.`);

      // Fallback: publish event for task-service to pick up
      if (this.redis) {
        await this.redis.publish('task:create-from-chat', JSON.stringify({
          title: taskData.title,
          description: message.content?.substring(0, 500),
          assigneeId: taskData.assigneeId,
          projectId: taskData.projectId,
          dueDate: taskData.dueDate,
          priority: taskData.priority || 'medium',
          sourceMessageId: messageId,
          sourceConversationId: message.conversationId,
          createdBy: userId,
        }));
      }
    }

    // Post system message in the conversation
    const assigneeName = taskData.assigneeId ? `@${taskData.assigneeId}` : 'unassigned';
    const systemMessage = new this.messageModel({
      conversationId: message.conversationId,
      senderId: 'system',
      senderName: 'Nexora',
      content: `✅ Task created: **${taskData.title}** — assigned to ${assigneeName}${taskId ? ` ([View Task](/tasks/${taskId}))` : ''}`,
      contentPlainText: `Task created: ${taskData.title}`,
      type: 'system',
      readBy: [],
    });
    await systemMessage.save();

    this.logger.log(`Task created from message ${messageId} by ${userId}${taskId ? `: task ${taskId}` : ''}`);
    return { taskId, systemMessage };
  }
}
