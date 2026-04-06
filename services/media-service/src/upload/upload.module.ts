import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { MediaFileSchema } from '../schemas/media-file.schema';
import { ProcessingModule } from '../processing/processing.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'MediaFile', schema: MediaFileSchema },
    ]),
    ProcessingModule,
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
