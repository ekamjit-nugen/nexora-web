import { Module, Global } from '@nestjs/common';

/**
 * Shared Queue Module — provides BullMQ connection for all services.
 *
 * Usage:
 * 1. Import QueueModule in app.module.ts
 * 2. Inject 'BULLMQ_CONNECTION' in processors
 * 3. Create Queue instances using the shared connection
 *
 * Requires: bullmq, ioredis installed
 * Env: REDIS_URI (default: redis://redis:6379)
 */
@Global()
@Module({
  providers: [
    {
      provide: 'BULLMQ_CONNECTION',
      useFactory: async () => {
        try {
          const IORedis = (await (Function('return import("ioredis")')())).default;
          const connection = new IORedis(process.env.REDIS_URI || 'redis://redis:6379', {
            maxRetriesPerRequest: null, // Required by BullMQ
            enableReadyCheck: false,
          });
          return connection;
        } catch {
          console.warn('BullMQ: Redis not available, queue features disabled');
          return null;
        }
      },
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        try {
          const IORedis = (await (Function('return import("ioredis")')())).default;
          return new IORedis(process.env.REDIS_URI || 'redis://redis:6379');
        } catch {
          console.warn('Redis client not available');
          return null;
        }
      },
    },
  ],
  exports: ['BULLMQ_CONNECTION', 'REDIS_CLIENT'],
})
export class QueueModule {}
