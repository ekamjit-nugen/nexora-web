import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMediaFile } from '../schemas/media-file.schema';
import { S3UploadHelper } from './s3-upload.helper';

/**
 * Image processor - creates thumbnails and previews.
 * Uses sharp for image processing.
 *
 * Produces:
 * - Thumbnail: 200px wide, JPEG, quality 80
 * - Preview: 800px wide, JPEG, quality 85
 * - Strips EXIF data for privacy
 */
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    @InjectModel('MediaFile') private mediaFileModel: Model<IMediaFile>,
    private readonly s3UploadHelper: S3UploadHelper,
  ) {}

  async processImage(fileId: string, buffer: Buffer, storageKey: string): Promise<void> {
    try {
      const sharp = (await import('sharp')).default;

      // Limit input pixels to prevent decompression bombs (16384x16384 = 268M pixels max)
      const sharpOptions = { limitInputPixels: 268435456 };

      // Get metadata
      const metadata = await sharp(buffer, sharpOptions).metadata();

      // Check dimensions to prevent decompression bombs
      if ((metadata.width && metadata.width > 16384) || (metadata.height && metadata.height > 16384)) {
        this.logger.warn(`Image dimensions too large (${metadata.width}x${metadata.height}), skipping processing: ${fileId}`);
        await this.mediaFileModel.findByIdAndUpdate(fileId, {
          'processing.status': 'complete',
          'processing.error': 'Image dimensions exceed safe limit (16384x16384)',
          'processing.metadata': {
            width: metadata.width,
            height: metadata.height,
            codec: metadata.format,
          },
        });
        return;
      }

      // Create thumbnail (200px width)
      const thumbnailBuffer = await sharp(buffer, sharpOptions)
        .resize(200, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Create preview (800px width)
      const previewBuffer = await sharp(buffer, sharpOptions)
        .resize(800, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const thumbnailKey = storageKey.replace(/\.[^.]+$/, '_thumb.jpg');
      const previewKey = storageKey.replace(/\.[^.]+$/, '_preview.jpg');

      // Upload thumbnail and preview to S3
      await Promise.all([
        this.s3UploadHelper.uploadBuffer(thumbnailKey, thumbnailBuffer, 'image/jpeg'),
        this.s3UploadHelper.uploadBuffer(previewKey, previewBuffer, 'image/jpeg'),
      ]);

      const thumbnailHeight = metadata.height
        ? Math.max(1, Math.round(200 * metadata.height / (metadata.width || 200)))
        : null;

      await this.mediaFileModel.findByIdAndUpdate(fileId, {
        'processing.status': 'complete',
        'processing.thumbnail': {
          storageKey: thumbnailKey,
          width: 200,
          height: thumbnailHeight,
        },
        'processing.preview': { storageKey: previewKey },
        'processing.metadata': {
          width: metadata.width,
          height: metadata.height,
          codec: metadata.format,
        },
      });

      this.logger.log(`Image processed: ${fileId} (${metadata.width}x${metadata.height})`);
    } catch (err) {
      this.logger.error(`Image processing failed for ${fileId}: ${err.message}`);
      await this.mediaFileModel.findByIdAndUpdate(fileId, {
        'processing.status': 'failed',
        'processing.error': err.message,
      });
    }
  }
}
