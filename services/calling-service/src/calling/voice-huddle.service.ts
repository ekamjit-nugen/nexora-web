import { Injectable, Logger } from '@nestjs/common';

export interface HuddleParticipant {
  userId: string;
  joinedAt: Date;
  muted: boolean;
}

export interface HuddleState {
  conversationId: string;
  active: boolean;
  startedBy: string;
  startedAt: Date;
  participants: HuddleParticipant[];
}

@Injectable()
export class VoiceHuddleService {
  private readonly logger = new Logger(VoiceHuddleService.name);

  // In-memory huddle state: conversationId -> HuddleState
  private huddles = new Map<string, HuddleState>();

  getHuddle(conversationId: string): HuddleState | null {
    return this.huddles.get(conversationId) || null;
  }

  startHuddle(conversationId: string, userId: string): HuddleState {
    const existing = this.huddles.get(conversationId);
    if (existing && existing.active && existing.participants.length > 0) {
      // Huddle already active — just return current state
      this.logger.warn(`Huddle already active for conversation ${conversationId}`);
      return existing;
    }

    const huddle: HuddleState = {
      conversationId,
      active: true,
      startedBy: userId,
      startedAt: new Date(),
      participants: [
        { userId, joinedAt: new Date(), muted: false },
      ],
    };

    this.huddles.set(conversationId, huddle);
    this.logger.log(`Huddle started in ${conversationId} by ${userId}`);
    return huddle;
  }

  joinHuddle(conversationId: string, userId: string): HuddleState | null {
    const huddle = this.huddles.get(conversationId);
    if (!huddle || !huddle.active) {
      this.logger.warn(`No active huddle in conversation ${conversationId}`);
      return null;
    }

    // Don't add duplicate participant
    const alreadyIn = huddle.participants.some(p => p.userId === userId);
    if (!alreadyIn) {
      huddle.participants.push({ userId, joinedAt: new Date(), muted: false });
    }

    this.logger.log(`User ${userId} joined huddle in ${conversationId}`);
    return huddle;
  }

  leaveHuddle(conversationId: string, userId: string): HuddleState | null {
    const huddle = this.huddles.get(conversationId);
    if (!huddle) return null;

    huddle.participants = huddle.participants.filter(p => p.userId !== userId);
    this.logger.log(`User ${userId} left huddle in ${conversationId}, ${huddle.participants.length} remaining`);

    if (huddle.participants.length === 0) {
      huddle.active = false;
      this.huddles.delete(conversationId);
      this.logger.log(`Huddle ended in ${conversationId} — no participants left`);
    }

    return huddle;
  }

  toggleMute(conversationId: string, userId: string, muted: boolean): HuddleState | null {
    const huddle = this.huddles.get(conversationId);
    if (!huddle) return null;

    const participant = huddle.participants.find(p => p.userId === userId);
    if (participant) {
      participant.muted = muted;
    }

    return huddle;
  }
}
