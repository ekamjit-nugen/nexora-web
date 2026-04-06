import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImageProcessor } from './image.processor';
import { VideoProcessor } from './video.processor';
import { S3UploadHelper } from './s3-upload.helper';
import { MediaFileSchema } from '../schemas/media-file.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'MediaFile', schema: MediaFileSchema },
    ]),
  ],
  providers: [ImageProcessor, VideoProcessor, S3UploadHelper],
  exports: [ImageProcessor, VideoProcessor, S3UploadHelper],
})
export class ProcessingModule {}
