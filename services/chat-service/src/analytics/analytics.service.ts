import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * E3 7.2: Conversation Insights Dashboard.
 * Provides aggregate analytics for team communication patterns.
 * Privacy: no individual message content, no private DM analytics. Only aggregate metrics.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<any>,
    @InjectModel('Conversation') private conversationModel: Model<any>,
  ) {}

  async getOrgInsights(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const from = dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateRange?.to || new Date();

    const orgConvos = await this.conversationModel.find({
      organizationId, isDeleted: false,
    }).select('_id type channelType name').lean();
    const convoIds = orgConvos.map(c => c._id.toString());

    // Message volume
    const messageVolume = await this.messageModel.aggregate([
      { $match: { conversationId: { $in: convoIds }, createdAt: { $gte: from, $lte: to }, isDeleted: false } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Message count by type
    const messagesByType = await this.messageModel.aggregate([
      { $match: { conversationId: { $in: convoIds }, createdAt: { $gte: from, $lte: to }, isDeleted: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    // Most active channels
    const channelConvoIds = orgConvos.filter(c => c.type === 'channel').map(c => c._id.toString());
    const activeChannels = await this.messageModel.aggregate([
      { $match: { conversationId: { $in: channelConvoIds }, createdAt: { $gte: from, $lte: to }, isDeleted: false } },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Peak activity hours
    const peakHours = await this.messageModel.aggregate([
      { $match: { conversationId: { $in: convoIds }, createdAt: { $gte: from, $lte: to }, isDeleted: false } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Thread engagement
    const totalMessages = await this.messageModel.countDocuments({
      conversationId: { $in: convoIds }, createdAt: { $gte: from, $lte: to }, isDeleted: false,
    });
    const threadMessages = await this.messageModel.countDocuments({
      conversationId: { $in: convoIds }, createdAt: { $gte: from, $lte: to }, isDeleted: false,
      threadId: { $ne: null },
    });

    // Unique active users
    const activeUsers = await this.messageModel.distinct('senderId', {
      conversationId: { $in: convoIds }, createdAt: { $gte: from, $lte: to }, isDeleted: false,
    });

    const channelNameMap = new Map(orgConvos.map(c => [c._id.toString(), (c as any).name]));

    return {
      period: { from, to },
      overview: {
        totalMessages,
        totalConversations: orgConvos.length,
        activeUsers: activeUsers.length,
        threadEngagementRate: totalMessages > 0 ? Math.round((threadMessages / totalMessages) * 100) : 0,
      },
      messageVolume,
      messagesByType: messagesByType.map(m => ({ type: m._id, count: m.count })),
      activeChannels: activeChannels.map(c => ({
        conversationId: c._id,
        name: channelNameMap.get(c._id) || c._id,
        messageCount: c.count,
      })),
      peakHours: peakHours.map(h => ({ hour: h._id, count: h.count })),
    };
  }
}
