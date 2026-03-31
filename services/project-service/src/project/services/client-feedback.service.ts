import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IClientFeedback } from '../schemas/client-feedback.schema';

export interface ClientFeedbackInput {
  clientId: string;
  clientName: string;
  clientEmail: string;
  type: 'bug' | 'feature' | 'question' | 'general';
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  attachments?: Array<{
    url: string;
    name: string;
    type: string;
    size: number;
  }>;
}

@Injectable()
export class ClientFeedbackService {
  constructor(
    @InjectModel('ClientFeedback')
    private clientFeedbackModel: Model<IClientFeedback>,
  ) {}

  // ── Feedback Submission ──

  async submitFeedback(
    projectId: string,
    input: ClientFeedbackInput,
  ): Promise<IClientFeedback> {
    if (!input.title || !input.description) {
      throw new BadRequestException('Title and description are required');
    }

    const feedback = new this.clientFeedbackModel({
      projectId,
      clientId: input.clientId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      type: input.type,
      title: input.title,
      description: input.description,
      priority: input.priority || 'medium',
      attachments: input.attachments || [],
      status: 'new',
    });

    await feedback.save();
    return feedback;
  }

  async getFeedback(projectId: string, feedbackId: string): Promise<IClientFeedback> {
    const feedback = await this.clientFeedbackModel.findOne({
      _id: feedbackId,
      projectId,
    });

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return feedback;
  }

  async getProjectFeedback(
    projectId: string,
    filters?: {
      status?: string;
      priority?: string;
      type?: string;
      limit?: number;
      skip?: number;
    },
  ): Promise<{
    total: number;
    feedback: IClientFeedback[];
  }> {
    const query: any = { projectId };

    if (filters?.status) query.status = filters.status;
    if (filters?.priority) query.priority = filters.priority;
    if (filters?.type) query.type = filters.type;

    const total = await this.clientFeedbackModel.countDocuments(query);
    const feedback = await this.clientFeedbackModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 20)
      .skip(filters?.skip || 0)
      .exec();

    return { total, feedback };
  }

  async getClientFeedback(
    projectId: string,
    clientId: string,
    filters?: {
      status?: string;
      limit?: number;
      skip?: number;
    },
  ): Promise<{
    total: number;
    feedback: IClientFeedback[];
  }> {
    const query: any = { projectId, clientId };

    if (filters?.status) query.status = filters.status;

    const total = await this.clientFeedbackModel.countDocuments(query);
    const feedback = await this.clientFeedbackModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 20)
      .skip(filters?.skip || 0)
      .exec();

    return { total, feedback };
  }

  // ── Feedback Management ──

  async updateFeedbackStatus(
    projectId: string,
    feedbackId: string,
    status: 'new' | 'reviewed' | 'in_progress' | 'completed' | 'closed',
  ): Promise<IClientFeedback> {
    const feedback = await this.clientFeedbackModel.findOneAndUpdate(
      { _id: feedbackId, projectId },
      { status },
      { new: true },
    );

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return feedback;
  }

  async linkFeedbackToTask(
    projectId: string,
    feedbackId: string,
    taskKey: string,
  ): Promise<IClientFeedback> {
    const feedback = await this.clientFeedbackModel.findOneAndUpdate(
      { _id: feedbackId, projectId },
      { taskKey },
      { new: true },
    );

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return feedback;
  }

  async deleteFeedback(projectId: string, feedbackId: string): Promise<void> {
    const result = await this.clientFeedbackModel.deleteOne({
      _id: feedbackId,
      projectId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Feedback not found');
    }
  }

  // ── Analytics ──

  async getFeedbackStats(projectId: string) {
    const total = await this.clientFeedbackModel.countDocuments({ projectId });

    const byType = await this.clientFeedbackModel.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const byStatus = await this.clientFeedbackModel.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byPriority = await this.clientFeedbackModel.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    return {
      total,
      byType: Object.fromEntries(byType.map((item) => [item._id, item.count])),
      byStatus: Object.fromEntries(byStatus.map((item) => [item._id, item.count])),
      byPriority: Object.fromEntries(
        byPriority.map((item) => [item._id, item.count]),
      ),
    };
  }

  async getRecentFeedback(projectId: string, limit: number = 5) {
    return this.clientFeedbackModel
      .find({ projectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
