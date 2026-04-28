import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { MediaFileSchema } from '../schemas/media-file.schema';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'MediaFile', schema: MediaFileSchema },
    ], "nexora_media"),
    UploadModule,
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
