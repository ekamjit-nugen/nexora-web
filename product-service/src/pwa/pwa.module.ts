import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PWAService } from './pwa.service';
import { PWAController } from './pwa.controller';
import {
  PWAConfigSchema,
  OfflineStoreSchema,
  ServiceWorkerCacheSchema,
} from './pwa.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PWAConfig', schema: PWAConfigSchema },
      { name: 'OfflineStore', schema: OfflineStoreSchema },
      { name: 'ServiceWorkerCache', schema: ServiceWorkerCacheSchema },
    ]),
  ],
  providers: [PWAService],
  controllers: [PWAController],
  exports: [PWAService],
})
export class PWAModule {}
