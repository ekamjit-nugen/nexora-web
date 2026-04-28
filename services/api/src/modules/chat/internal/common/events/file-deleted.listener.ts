import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * Listens for `media:file-deleted` events from media-service via Redis pub/sub.
 * Updates the referencing message to show "File was removed".
 */
@Injectable()
export class FileDeletedListener implements OnModuleInit {
  private readonly logger = new Logger(FileDeletedListener.name);

  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: any,
    @InjectModel('Message', 'nexora_chat') private readonly messageModel: Model<any>,
  ) {}

  async onModuleInit() {
    if (!this.redis) return;

    try {
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe('media:file-deleted');

      subscriber.on('message', async (channel: string, message: string) => {
        if (channel !== 'media:file-deleted') return;

        try {
          const data = JSON.parse(message);
          await this.handleFileDeleted(data);
        } catch (err) {
          this.logger.error(`Failed to process media:file-deleted: ${err.message}`);
        }
      });

      this.logger.log('File deleted listener subscribed');
    } catch (err) {
      this.logger.warn(`File deleted listener failed: ${err.message}`);
    }
  }

  private async handleFileDeleted(data: { fileId: string; messageId?: string }) {
    if (!data.messageId) return;

    await this.messageModel.findByIdAndUpdate(data.messageId, {
      $set: {
        fileUrl: null,
        fileName: '(File removed)',
        content: 'This file has been removed',
      },
    });

    this.logger.log(`Message ${data.messageId} updated after file deletion`);
  }
}
