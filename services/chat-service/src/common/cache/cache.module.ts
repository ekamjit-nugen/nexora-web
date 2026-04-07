import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global cache module. Provides CacheService backed by REDIS_CLIENT
 * from the QueueModule. Import once in AppModule.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
