import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * E3 7.2: Conversation Insights Dashboard.
 * Provides aggregate analytics for team communication patterns.
 * Privacy: no individual message content, no private DM analytics. Only aggregate metrics.
 *
 * NOTE: Messages are NOT tagged with organizationId directly. Scoping happens via
 * the Conversation collection, which carries organizationId. All aggregations first
 * resolve the set of conversationIds belonging to the org and then filter the
 * Message collection by `conversationId: { $in: convoIds }`.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<any>,
    @InjectModel('Conversation') private conversationModel: Model<any>,
  ) {}

  // ─── Internal helpers ───────────────────────────────────────────────────

  private resolveRange(dateRange?: { from?: Date; to?: Date }): { from: Date; to: Date } {
    const to = dateRange?.to ? new Date(dateRange.to) : new Date();
    const from = dateRange?.from
      ? new Date(dateRange.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  private async getOrgConversations(
    organizationId: string,
  ): Promise<Array<{ id: string; type: string; name: string; memberCount: number }>> {
    const convos = await this.conversationModel
      .find({ organizationId, isDeleted: false })
      .select('_id type channelType name participants')
      .lean();

    return convos.map((c: any) => ({
      id: c._id.toString(),
      type: c.type,
      name: c.name || '',
      memberCount: Array.isArray(c.participants) ? c.participants.length : 0,
    }));
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Overview KPIs for the organization over the given date range.
   */
  async getOverview(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<{
    totalMessages: number;
    activeUsers: number;
    totalConversations: number;
    totalChannels: number;
    threadEngagementRate: number;
  }> {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const convoIds = convos.map((c) => c.id);
      const totalChannels = convos.filter((c) => c.type === 'channel').length;

      if (convoIds.length === 0) {
        return {
          totalMessages: 0,
          activeUsers: 0,
          totalConversations: 0,
          totalChannels: 0,
          threadEngagementRate: 0,
        };
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [totalMessages, threadMessages, activeUsersList] = await Promise.all([
        this.messageModel.countDocuments({
          conversationId: { $in: convoIds },
          createdAt: { $gte: from, $lte: to },
          isDeleted: false,
        }),
        this.messageModel.countDocuments({
          conversationId: { $in: convoIds },
          createdAt: { $gte: from, $lte: to },
          isDeleted: false,
          threadId: { $ne: null },
        }),
        this.messageModel.distinct('senderId', {
          conversationId: { $in: convoIds },
          createdAt: { $gte: sevenDaysAgo, $lte: to },
          isDeleted: false,
        }),
      ]);

      const threadEngagementRate =
        totalMessages > 0 ? Math.round((threadMessages / totalMessages) * 10000) / 10000 : 0;

      return {
        totalMessages,
        activeUsers: activeUsersList.length,
        totalConversations: convos.length,
        totalChannels,
        threadEngagementRate,
      };
    } catch (err) {
      this.logger.error(`getOverview failed: ${(err as Error).message}`);
      return {
        totalMessages: 0,
        activeUsers: 0,
        totalConversations: 0,
        totalChannels: 0,
        threadEngagementRate: 0,
      };
    }
  }

  /**
   * Message volume bucketed by day / week / month.
   */
  async getMessageVolume(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
    granularity: 'day' | 'week' | 'month' = 'day',
  ): Promise<Array<{ date: string; count: number }>> {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length === 0) return [];

      const format =
        granularity === 'month' ? '%Y-%m' : granularity === 'week' ? '%G-W%V' : '%Y-%m-%d';

      const rows = await this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: convoIds },
            createdAt: { $gte: from, $lte: to },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format, date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]);

      return rows as Array<{ date: string; count: number }>;
    } catch (err) {
      this.logger.error(`getMessageVolume failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Message counts grouped by message type (text, file, image, video, poll, ...).
   */
  async getMessagesByType(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<Array<{ type: string; count: number }>> {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length === 0) return [];

      const rows = await this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: convoIds },
            createdAt: { $gte: from, $lte: to },
            isDeleted: false,
          },
        },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, type: '$_id', count: 1 } },
      ]);

      return rows as Array<{ type: string; count: number }>;
    } catch (err) {
      this.logger.error(`getMessagesByType failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Top N channels by message count.
   */
  async getActiveChannels(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
    limit = 10,
  ): Promise<
    Array<{
      conversationId: string;
      conversationName: string;
      messageCount: number;
      memberCount: number;
    }>
  > {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const channelConvos = convos.filter((c) => c.type === 'channel');
      const channelIds = channelConvos.map((c) => c.id);
      if (channelIds.length === 0) return [];

      const rows = await this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: channelIds },
            createdAt: { $gte: from, $lte: to },
            isDeleted: false,
          },
        },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: Math.max(1, Math.min(limit, 100)) },
      ]);

      const metaMap = new Map(channelConvos.map((c) => [c.id, c]));
      return rows.map((r: any) => {
        const meta = metaMap.get(r._id);
        return {
          conversationId: r._id,
          conversationName: meta?.name || r._id,
          messageCount: r.count,
          memberCount: meta?.memberCount || 0,
        };
      });
    } catch (err) {
      this.logger.error(`getActiveChannels failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Top N users by message count. Also includes reactions received on their
   * messages (count of reaction entries across reactions array users).
   */
  async getTopUsers(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
    limit = 10,
  ): Promise<Array<{ userId: string; messageCount: number; reactionCount: number }>> {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length === 0) return [];

      const cappedLimit = Math.max(1, Math.min(limit, 100));

      const rows = await this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: convoIds },
            createdAt: { $gte: from, $lte: to },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$senderId',
            messageCount: { $sum: 1 },
            reactionCount: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ['$reactions', []] },
                  initialValue: 0,
                  in: { $add: ['$$value', { $ifNull: ['$$this.count', 0] }] },
                },
              },
            },
          },
        },
        { $sort: { messageCount: -1 } },
        { $limit: cappedLimit },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            messageCount: 1,
            reactionCount: 1,
          },
        },
      ]);

      return rows as Array<{ userId: string; messageCount: number; reactionCount: number }>;
    } catch (err) {
      this.logger.error(`getTopUsers failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Message counts bucketed by hour-of-day (0-23).
   */
  async getPeakHours(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<Array<{ hour: number; count: number }>> {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length === 0) {
        return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
      }

      const rows = await this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: convoIds },
            createdAt: { $gte: from, $lte: to },
            isDeleted: false,
          },
        },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const countsByHour = new Map<number, number>(rows.map((r: any) => [r._id, r.count]));
      return Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: countsByHour.get(h) || 0,
      }));
    } catch (err) {
      this.logger.error(`getPeakHours failed: ${(err as Error).message}`);
      return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    }
  }

  /**
   * Top reactions used in the org over the given date range.
   */
  async getReactionStats(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<Array<{ emoji: string; count: number }>> {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length === 0) return [];

      const rows = await this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: convoIds },
            createdAt: { $gte: from, $lte: to },
            isDeleted: false,
            reactions: { $exists: true, $ne: [] },
          },
        },
        { $unwind: '$reactions' },
        {
          $group: {
            _id: '$reactions.emoji',
            count: { $sum: { $ifNull: ['$reactions.count', 0] } },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 25 },
        { $project: { _id: 0, emoji: '$_id', count: 1 } },
      ]);

      return rows as Array<{ emoji: string; count: number }>;
    } catch (err) {
      this.logger.error(`getReactionStats failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Average and median "time to first response" in threads.
   * Methodology: For each thread root created in the range, compute the delta
   * between the root's createdAt and the earliest reply's createdAt (if any).
   * Times are returned in seconds.
   */
  async getResponseTimeMetrics(
    organizationId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<{ avgResponseTime: number; medianResponseTime: number }> {
    try {
      const { from, to } = this.resolveRange(dateRange);
      const convos = await this.getOrgConversations(organizationId);
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length === 0) return { avgResponseTime: 0, medianResponseTime: 0 };

      const rows = await this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: convoIds },
            createdAt: { $gte: from, $lte: to },
            isDeleted: false,
            threadId: { $eq: null },
            'threadInfo.replyCount': { $gt: 0 },
          },
        },
        { $project: { _id: 1, createdAt: 1 } },
        {
          $lookup: {
            from: 'messages',
            let: { rootId: { $toString: '$_id' } },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$threadId', '$$rootId'] },
                  isDeleted: false,
                },
              },
              { $sort: { createdAt: 1 } },
              { $limit: 1 },
              { $project: { _id: 0, createdAt: 1 } },
            ],
            as: 'firstReply',
          },
        },
        { $match: { 'firstReply.0': { $exists: true } } },
        {
          $project: {
            responseSeconds: {
              $divide: [
                {
                  $subtract: [
                    { $arrayElemAt: ['$firstReply.createdAt', 0] },
                    '$createdAt',
                  ],
                },
                1000,
              ],
            },
          },
        },
        { $match: { responseSeconds: { $gte: 0 } } },
      ]);

      const values: number[] = rows
        .map((r: any) => Number(r.responseSeconds))
        .filter((n: number) => Number.isFinite(n));

      if (values.length === 0) return { avgResponseTime: 0, medianResponseTime: 0 };

      const sum = values.reduce((acc, v) => acc + v, 0);
      const avgResponseTime = Math.round((sum / values.length) * 100) / 100;

      const sorted = values.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianResponseTime =
        sorted.length % 2 === 0
          ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
          : Math.round(sorted[mid] * 100) / 100;

      return { avgResponseTime, medianResponseTime };
    } catch (err) {
      this.logger.error(`getResponseTimeMetrics failed: ${(err as Error).message}`);
      return { avgResponseTime: 0, medianResponseTime: 0 };
    }
  }

  // ─── Legacy bundled insights endpoint (preserved for backwards compat) ──

  async getOrgInsights(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const { from, to } = this.resolveRange(dateRange);

    const orgConvos = await this.conversationModel
      .find({ organizationId, isDeleted: false })
      .select('_id type channelType name')
      .lean();
    const convoIds = orgConvos.map((c: any) => c._id.toString());

    const messageVolume = await this.messageModel.aggregate([
      {
        $match: {
          conversationId: { $in: convoIds },
          createdAt: { $gte: from, $lte: to },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const messagesByType = await this.messageModel.aggregate([
      {
        $match: {
          conversationId: { $in: convoIds },
          createdAt: { $gte: from, $lte: to },
          isDeleted: false,
        },
      },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const channelConvoIds = orgConvos
      .filter((c: any) => c.type === 'channel')
      .map((c: any) => c._id.toString());
    const activeChannels = await this.messageModel.aggregate([
      {
        $match: {
          conversationId: { $in: channelConvoIds },
          createdAt: { $gte: from, $lte: to },
          isDeleted: false,
        },
      },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const peakHours = await this.messageModel.aggregate([
      {
        $match: {
          conversationId: { $in: convoIds },
          createdAt: { $gte: from, $lte: to },
          isDeleted: false,
        },
      },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const totalMessages = await this.messageModel.countDocuments({
      conversationId: { $in: convoIds },
      createdAt: { $gte: from, $lte: to },
      isDeleted: false,
    });
    const threadMessages = await this.messageModel.countDocuments({
      conversationId: { $in: convoIds },
      createdAt: { $gte: from, $lte: to },
      isDeleted: false,
      threadId: { $ne: null },
    });

    const activeUsers = await this.messageModel.distinct('senderId', {
      conversationId: { $in: convoIds },
      createdAt: { $gte: from, $lte: to },
      isDeleted: false,
    });

    const channelNameMap = new Map(
      orgConvos.map((c: any) => [c._id.toString(), c.name]),
    );

    return {
      period: { from, to },
      overview: {
        totalMessages,
        totalConversations: orgConvos.length,
        activeUsers: activeUsers.length,
        threadEngagementRate:
          totalMessages > 0 ? Math.round((threadMessages / totalMessages) * 100) : 0,
      },
      messageVolume,
      messagesByType: messagesByType.map((m: any) => ({ type: m._id, count: m.count })),
      activeChannels: activeChannels.map((c: any) => ({
        conversationId: c._id,
        name: channelNameMap.get(c._id) || c._id,
        messageCount: c.count,
      })),
      peakHours: peakHours.map((h: any) => ({ hour: h._id, count: h.count })),
    };
  }
}
