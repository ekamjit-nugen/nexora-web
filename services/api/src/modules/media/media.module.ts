import { Module } from '@nestjs/common';
import { UploadModule } from './internal/upload/upload.module';
import { ProcessingModule } from './internal/processing/processing.module';
import { DeliveryModule } from './internal/delivery/delivery.module';

/**
 * MediaModule wrapper.
 *
 * Three sub-modules: upload (S3 multipart), processing (sharp /
 * ffprobe for thumbnails / metadata), delivery (signed URLs).
 * All inner forFeature calls patched to MEDIA_DB.
 */
@Module({
  imports: [UploadModule, ProcessingModule, DeliveryModule],
})
export class MediaModule {}
