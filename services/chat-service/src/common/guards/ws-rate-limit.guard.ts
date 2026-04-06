import { Injectable, CanActivate, ExecutionContext, Inject, Optional } from '@nestjs/common';

/**
 * WebSocket Rate Limit Guard.
 * Uses Redis to track event counts per user per event type.
 * If Redis is not available, passes through (no rate limiting).
 */

const LIMITS: Record<string, { max: number; windowSec: number }> = {
  'message:send': { max: 30, windowSec: 60 },       // 30 messages/min
  'message:reaction': { max: 20, windowSec: 60 },   // 20 reactions/min
  'typing:start': { max: 10, windowSec: 10 },        // 10 typing events/10s
  'poll:vote': { max: 10, windowSec: 60 },           // 10 votes/min
  'thread:reply': { max: 20, windowSec: 60 },        // 20 thread replies/min
  'presence:heartbeat': { max: 5, windowSec: 30 },   // 5 heartbeats/30s
};

@Injectable()
export class WsRateLimitGuard implements CanActivate {
  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.redis) return true; // No Redis = no rate limiting

    const client = context.switchToWs().getClient();
    const event = context.switchToWs().getPattern?.() as string;
    const userId = client.data?.userId || (client as any).__userId;

    if (!userId || !event) return true;

    const limit = LIMITS[event];
    if (!limit) return true;

    try {
      const key = `ws-rate:${userId}:${event}`;
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, limit.windowSec);
      }

      if (current > limit.max) {
        client.emit('error', { code: 'RATE_LIMITED', message: `Too many ${event} events. Please slow down.` });
        return false;
      }
    } catch {
      // Redis error — allow through
    }

    return true;
  }
}
