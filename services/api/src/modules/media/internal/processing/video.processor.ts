import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMediaFile } from '../schemas/media-file.schema';
import { S3UploadHelper } from './s3-upload.helper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Video Processor — creates thumbnails and extracts metadata.
 *
 * Uses fluent-ffmpeg for video processing:
 * - Extract thumbnail at 1-second mark
 * - Extract duration, resolution, codec
 *
 * Requires: fluent-ffmpeg, @ffprobe-installer/ffprobe as dependencies.
 */
@Injectable()
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    @InjectModel('MediaFile', 'nexora_media') private mediaFileModel: Model<IMediaFile>,
    private readonly s3UploadHelper: S3UploadHelper,
  ) {}

  async processVideo(fileId: string, filePath: string, storageKey: string): Promise<void> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-video-'));
    const thumbFilename = 'thumbnail.jpg';

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpeg = require('fluent-ffmpeg');

      // Set ffprobe path from the installed package
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
        ffmpeg.setFfprobePath(ffprobeInstaller.path);
      } catch {
        this.logger.warn('ffprobe installer not found, relying on system ffprobe');
      }

      // Extract metadata using ffprobe
      const metadata = await new Promise<any>((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
      const duration = parseFloat(metadata.format?.duration) || 0;
      const width = videoStream?.width || null;
      const height = videoStream?.height || null;
      const codec = videoStream?.codec_name || null;

      // Generate thumbnail at 1 second mark
      const thumbnailKey = storageKey.replace(/\.[^.]+$/, '_thumb.jpg');

      await new Promise<void>((resolve, reject) => {
        ffmpeg(filePath)
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err))
          .screenshots({
            timestamps: ['1'],
            filename: thumbFilename,
            folder: tmpDir,
            size: '320x240',
          });
      });

      // Read generated thumbnail and upload to S3
      const thumbPath = path.join(tmpDir, thumbFilename);
      if (fs.existsSync(thumbPath)) {
        const thumbnailBuffer = fs.readFileSync(thumbPath);
        await this.s3UploadHelper.uploadBuffer(thumbnailKey, thumbnailBuffer, 'image/jpeg');
      } else {
        this.logger.warn(`Thumbnail file not created for ${fileId}, skipping thumbnail upload`);
      }

      await this.mediaFileModel.findByIdAndUpdate(fileId, {
        'processing.status': 'complete',
        'processing.thumbnail': { storageKey: thumbnailKey, width: 320, height: 240 },
        'processing.metadata': { width, height, duration, codec },
      });

      this.logger.log(`Video processed: ${fileId} (${width}x${height}, ${Math.round(duration)}s, ${codec})`);
    } catch (err) {
      this.logger.error(`Video processing failed for ${fileId}: ${err.message}`);
      await this.mediaFileModel.findByIdAndUpdate(fileId, {
        'processing.status': 'failed',
        'processing.error': err.message,
      });
    } finally {
      // Clean up temp directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        this.logger.warn(`Failed to clean up temp dir: ${tmpDir}`);
      }
    }
  }
}
