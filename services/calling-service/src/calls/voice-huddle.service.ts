import { Injectable, Logger, NotFoundException } from '@nestjs/common';

/**
 * E3 7.8: Voice Huddles — always-on audio channels.
 * Like Discord voice channels: persistent audio rooms linked to channels.
 * Users can drop in/out without scheduling.
 *
 * Implementation: Uses SFU rooms that persist as long as at least one user is in them.
 * Huddle state tracked in memory (or Redis for multi-instance).
 */

interface HuddleState {
  channelId: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  startedAt: Date;
  sfuRoomId: string;
}

@Injectable()
export class VoiceHuddleService {
  private readonly logger = new Logger(VoiceHuddleService.name);
  private huddles = new Map<string, HuddleState>();

  startHuddle(channelId: string, userId: string, userName: string): HuddleState {
    if (this.huddles.has(channelId)) {
      return this.joinHuddle(channelId, userId, userName);
    }

    const sfuRoomId = `huddle:${channelId}`;
    const state: HuddleState = {
      channelId,
      participantIds: [userId],
      participantNames: { [userId]: userName },
      startedAt: new Date(),
      sfuRoomId,
    };
    this.huddles.set(channelId, state);
    this.logger.log(`Huddle started in channel ${channelId} by ${userName}`);
    return state;
  }

  joinHuddle(channelId: string, userId: string, userName: string): HuddleState {
    const huddle = this.huddles.get(channelId);
    if (!huddle) throw new NotFoundException('No active huddle in this channel');

    if (!huddle.participantIds.includes(userId)) {
      huddle.participantIds.push(userId);
      huddle.participantNames[userId] = userName;
    }
    this.logger.log(`${userName} joined huddle in channel ${channelId}`);
    return huddle;
  }

  leaveHuddle(channelId: string, userId: string): HuddleState | null {
    const huddle = this.huddles.get(channelId);
    if (!huddle) return null;

    huddle.participantIds = huddle.participantIds.filter(id => id !== userId);
    delete huddle.participantNames[userId];

    if (huddle.participantIds.length === 0) {
      this.huddles.delete(channelId);
      this.logger.log(`Huddle ended in channel ${channelId} (last participant left)`);
      return null;
    }

    return huddle;
  }

  getHuddle(channelId: string): HuddleState | null {
    return this.huddles.get(channelId) || null;
  }

  getActiveHuddles(channelIds: string[]): Array<{ channelId: string; participantCount: number; participantNames: string[] }> {
    return channelIds
      .filter(id => this.huddles.has(id))
      .map(id => {
        const h = this.huddles.get(id)!;
        return {
          channelId: id,
          participantCount: h.participantIds.length,
          participantNames: Object.values(h.participantNames),
        };
      });
  }
}
