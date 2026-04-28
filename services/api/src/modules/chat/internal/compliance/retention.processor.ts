import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RetentionService } from './retention.service';
import { IRetentionPolicy } from './schemas/retention-policy.schema';

/**
 * BullMQ processor for retention policy execution.
 * Runs daily at midnight to clean up expired messages.
 */
@Injectable()
export class RetentionProcessor implements OnModuleInit {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly retentionService: RetentionService,
    @InjectModel('RetentionPolicy', 'nexora_chat') private readonly policyModel: Model<IRetentionPolicy>,
  ) {}

  async onModuleInit() {
    if (!this.connection) return;

    try {
      const { Queue, Worker } = await (Function('return import("bullmq")')());

      const queue = new Queue('retention-cleanup', { connection: this.connection });
      new Worker('retention-cleanup', async () => {
        // Fetch all distinct organizations that have active retention policies
        const orgIds: string[] = await this.policyModel.distinct('organizationId', { isActive: true });

        if (orgIds.length === 0) {
          this.logger.log('Retention cleanup: no organizations with active policies, skipping');
          return;
        }

        for (const orgId of orgIds) {
          try {
            const result = await this.retentionService.executeRetention(orgId);
            this.logger.log(`Retention cleanup for org ${orgId}: ${result.deleted} messages deleted`);
          } catch (err) {
            this.logger.error(`Retention cleanup failed for org ${orgId}: ${err.message}`);
          }
        }
      }, {
        connection: this.connection,
        concurrency: 1,
      });

      // Daily cron at midnight UTC
      await queue.add('daily-cleanup', {}, {
        repeat: { pattern: '0 0 * * *' },
        removeOnComplete: 5,
        removeOnFail: 10,
      });

      this.logger.log('Retention processor started (daily at midnight)');
    } catch (err) {
      this.logger.warn(`Retention processor not available: ${err.message}`);
    }
  }
}
