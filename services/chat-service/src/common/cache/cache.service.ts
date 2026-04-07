import { Injectable, Inject, Logger, Optional } from '@nestjs/common';

/**
 * Redis caching layer for the chat service.
 * Wraps Redis GET/SET/DEL with JSON serialization.
 * Falls back gracefully to no-op if Redis is unavailable.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {
    if (this.redis) {
      this.logger.log('CacheService initialized with Redis');
    } else {
      this.logger.warn('CacheService running without Redis — caching disabled');
    }
  }

  /**
   * Get a cached value by key. Returns null if not found or Redis unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.error(`Cache GET error for key "${key}": ${err.message}`);
      return null;
    }
  }

  /**
   * Set a cached value. Optionally specify TTL in seconds.
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.redis) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (err) {
      this.logger.error(`Cache SET error for key "${key}": ${err.message}`);
    }
  }

  /**
   * Delete a cached key.
   */
  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.error(`Cache DEL error for key "${key}": ${err.message}`);
    }
  }

  /**
   * Invalidate all keys matching a pattern using SCAN + DEL.
   * Pattern uses Redis glob-style matching (e.g., "conv:user:*").
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.error(`Cache invalidatePattern error for "${pattern}": ${err.message}`);
    }
  }
}
