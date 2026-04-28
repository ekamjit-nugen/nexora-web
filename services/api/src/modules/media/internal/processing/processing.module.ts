import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImageProcessor } from './image.processor';
import { VideoProcessor } from './video.processor';
import { DocumentProcessor } from './document.processor';
import { S3UploadHelper } from './s3-upload.helper';
import { MediaFileSchema } from '../schemas/media-file.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'MediaFile', schema: MediaFileSchema },
    ], "nexora_media"),
  ],
  providers: [ImageProcessor, VideoProcessor, DocumentProcessor, S3UploadHelper],
  exports: [ImageProcessor, VideoProcessor, DocumentProcessor, S3UploadHelper],
})
export class ProcessingModule {}
