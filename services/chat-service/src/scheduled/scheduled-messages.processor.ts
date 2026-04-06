import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ScheduledMessagesService } from './scheduled-messages.service';

/**
 * BullMQ processor for scheduled messages.
 * Creates a repeatable job that checks for due messages every 30 seconds.
 *
 * Requires BullMQ + Redis connection from QueueModule.
 */
@Injectable()
export class ScheduledMessagesProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScheduledMessagesProcessor.name);
  private queue: any = null;
  private worker: any = null;

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly scheduledService: ScheduledMessagesService,
  ) {}

  async onModuleInit() {
    if (!this.connection) {
      this.logger.warn('Redis not available — scheduled message processing disabled');
      return;
    }

    try {
      const { Queue, Worker } = await (Function('return import("bullmq")')());

      this.queue = new Queue('scheduled-messages', { connection: this.connection });
      this.worker = new Worker('scheduled-messages', async () => {
        const published = await this.scheduledService.publishDueMessages();
        if (published > 0) {
          this.logger.log(`Published ${published} scheduled messages`);
        }
      }, {
        connection: this.connection,
        concurrency: 1,
      });

      this.worker.on('failed', (job: any, err: any) => {
        this.logger.error(`Scheduled message job failed: ${err.message}`);
      });

      // Add repeatable job: check every 30 seconds
      await this.queue.add('check-due', {}, {
        repeat: { every: 30000 },
        removeOnComplete: 10,
        removeOnFail: 50,
      });

      this.logger.log('Scheduled messages processor started (every 30s)');
    } catch (err) {
      this.logger.warn(`BullMQ not available: ${err.message}`);
    }
  }
}
