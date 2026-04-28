import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

/**
 * BullMQ processor for outgoing webhook delivery.
 * Each outgoing webhook event becomes a job with 3 retries + exponential backoff.
 */
@Injectable()
export class WebhookDeliveryProcessor implements OnModuleInit {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);
  private queue: any = null;

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly webhooksService: WebhooksService,
  ) {}

  async onModuleInit() {
    if (!this.connection) return;

    try {
      const { Queue, Worker } = await (Function('return import("bullmq")')());

      this.queue = new Queue('webhook-delivery', { connection: this.connection });
      new Worker('webhook-delivery', async (job) => {
        const { organizationId, conversationId, event, data } = job.data;
        await this.webhooksService.fireOutgoingWebhooks(organizationId, conversationId, event, data);
      }, {
        connection: this.connection,
        concurrency: 5,
      });

      this.logger.log('Webhook delivery processor started');
    } catch (err) {
      this.logger.warn(`Webhook processor not available: ${err.message}`);
    }
  }

  async enqueue(organizationId: string, conversationId: string, event: string, data: any) {
    if (!this.queue) return;
    await this.queue.add('deliver', { organizationId, conversationId, event, data }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }
}
