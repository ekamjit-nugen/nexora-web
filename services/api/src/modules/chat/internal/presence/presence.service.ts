import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUserPresence } from './schemas/user-presence.schema';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'dnd' | 'in_meeting' | 'in_call' | 'presenting' | 'offline' | 'ooo';

export interface PresenceData {
  userId: string;
  status: PresenceStatus;
  customEmoji?: string;
  customText?: string;
  expiresAt?: string;
  lastActiveAt?: string;
}

/**
 * Presence Service — Redis primary + MongoDB persistence.
 *
 * Redis hash `presence:{orgId}` stores ephemeral status per user (10-min TTL).
 * MongoDB stores DND schedule, OOO config, and persists across Redis restarts.
 *
 * Heartbeat every 30s from client. 5 min no activity → auto-away. 10 min → offline (TTL expiry).
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    @InjectModel('UserPresence', 'nexora_chat') private presenceModel: Model<IUserPresence>,
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {}

  async setStatus(userId: string, organizationId: string, status: string, customEmoji?: string, customText?: string, expiresAt?: Date) {
    const presenceData: PresenceData = {
      userId,
      status: status as PresenceStatus,
      customEmoji: customEmoji || null,
      customText: customText || null,
      expiresAt: expiresAt?.toISOString() || null,
      lastActiveAt: new Date().toISOString(),
    };

    // Redis: primary store with 10-min TTL
    if (this.redis) {
      try {
        await this.redis.hset(`presence:${organizationId}`, userId, JSON.stringify(presenceData));
        await this.redis.expire(`presence:${organizationId}`, 600);
      } catch (err) {
        this.logger.warn(`Redis presence write failed: ${err.message}`);
      }
    }

    // MongoDB: persist for DND/OOO config and Redis restart recovery
    const update: any = {
      status,
      lastActiveAt: new Date(),
      lastHeartbeatAt: new Date(),
    };
    if (customEmoji !== undefined) update.customEmoji = customEmoji;
    if (customText !== undefined) update.customText = customText;
    if (expiresAt !== undefined) update.customStatusExpiresAt = expiresAt;

    return this.presenceModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: update },
      { upsert: true, new: true },
    );
  }

  async getPresence(userId: string, organizationId: string): Promise<PresenceData | null> {
    // Try Redis first (fast path)
    if (this.redis) {
      try {
        const raw = await this.redis.hget(`presence:${organizationId}`, userId);
        if (raw) return JSON.parse(raw);
      } catch { /* fall through to MongoDB */ }
    }

    // Fallback to MongoDB
    const doc = await this.presenceModel.findOne({ userId, organizationId }).lean();
    if (doc) {
      return {
        userId: doc.userId,
        status: (doc.status as PresenceStatus) || 'offline',
        customEmoji: doc.customEmoji,
        customText: doc.customText,
        lastActiveAt: doc.lastActiveAt?.toISOString(),
      };
    }
    return { userId, status: 'offline' };
  }

  async getPresenceBatch(userIds: string[], organizationId: string): Promise<PresenceData[]> {
    if (userIds.length === 0) return [];

    // Try Redis pipeline (fast path)
    if (this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        for (const id of userIds) {
          pipeline.hget(`presence:${organizationId}`, id);
        }
        const results = await pipeline.exec();

        return userIds.map((id, i) => {
          const [err, raw] = results[i] || [];
          if (err || !raw) return { userId: id, status: 'offline' as PresenceStatus };
          return { userId: id, ...JSON.parse(raw as string) };
        });
      } catch { /* fall through */ }
    }

    // Fallback to MongoDB
    const docs = await this.presenceModel.find({
      userId: { $in: userIds }, organizationId,
    }).lean();
    const docMap = new Map(docs.map(d => [d.userId, d]));

    return userIds.map(id => {
      const doc = docMap.get(id);
      return {
        userId: id,
        status: ((doc?.status as PresenceStatus) || 'offline'),
        customEmoji: doc?.customEmoji,
        customText: doc?.customText,
        lastActiveAt: doc?.lastActiveAt?.toISOString(),
      };
    });
  }

  async heartbeat(userId: string, organizationId: string) {
    if (this.redis) {
      try {
        const raw = await this.redis.hget(`presence:${organizationId}`, userId);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.status === 'away') data.status = 'online'; // Auto-restore from away
          data.lastActiveAt = new Date().toISOString();
          await this.redis.hset(`presence:${organizationId}`, userId, JSON.stringify(data));
          await this.redis.expire(`presence:${organizationId}`, 600);
        } else {
          await this.setStatus(userId, organizationId, 'online');
        }
      } catch (err) {
        this.logger.warn(`Redis heartbeat failed: ${err.message}`);
      }
    }

    // Update MongoDB lastHeartbeatAt
    await this.presenceModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: { lastHeartbeatAt: new Date(), lastActiveAt: new Date(), status: 'online' } },
      { upsert: true },
    );
  }

  async setOffline(userId: string, organizationId: string) {
    if (this.redis) {
      try {
        await this.redis.hdel(`presence:${organizationId}`, userId);
      } catch { /* non-critical */ }
    }
    await this.presenceModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: { status: 'offline' } },
    );
  }

  /**
   * Mark inactive users as away. Called periodically (every 60s).
   */
  async markInactiveUsersAway(organizationId: string): Promise<string[]> {
    const awayUsers: string[] = [];

    if (this.redis) {
      try {
        const allPresence = await this.redis.hgetall(`presence:${organizationId}`);
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;

        for (const [userId, raw] of Object.entries(allPresence)) {
          const data = JSON.parse(raw as string);
          if (data.status === 'online' && new Date(data.lastActiveAt).getTime() < fiveMinAgo) {
            data.status = 'away';
            await this.redis.hset(`presence:${organizationId}`, userId, JSON.stringify(data));
            awayUsers.push(userId);
          }
        }
      } catch (err) {
        this.logger.warn(`Auto-away check failed: ${err.message}`);
      }
    }

    return awayUsers;
  }

  async updateDndSchedule(userId: string, organizationId: string, dndSchedule: any) {
    return this.presenceModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: { dndSchedule } },
      { upsert: true, new: true },
    );
  }

  async updateOoo(userId: string, organizationId: string, ooo: any) {
    const status = ooo.enabled ? 'ooo' : 'online';
    await this.setStatus(userId, organizationId, status);
    return this.presenceModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: { ooo } },
      { upsert: true, new: true },
    );
  }
}
