import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IRetentionPolicy } from './schemas/retention-policy.schema';
import { ILegalHold } from './schemas/retention-policy.schema';
import { IMessage } from '../messages/schemas/message.schema';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectModel('RetentionPolicy') private policyModel: Model<IRetentionPolicy>,
    @InjectModel('LegalHold') private legalHoldModel: Model<ILegalHold>,
    @InjectModel('Message') private messageModel: Model<IMessage>,
  ) {}

  async createPolicy(organizationId: string, data: Partial<IRetentionPolicy>, createdBy: string) {
    const policy = new this.policyModel({ ...data, organizationId, createdBy });
    await policy.save();
    this.logger.log(`Retention policy created: ${policy.name} (${policy.retentionDays} days)`);
    return policy;
  }

  async getPolicies(organizationId: string) {
    return this.policyModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
  }

  async updatePolicy(policyId: string, data: Partial<IRetentionPolicy>) {
    const policy = await this.policyModel.findByIdAndUpdate(policyId, data, { new: true });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  async deletePolicy(policyId: string) {
    await this.policyModel.findByIdAndDelete(policyId);
  }

  /**
   * Execute retention cleanup — delete messages older than retention period.
   * Respects legal holds: messages under hold are exempt.
   * Called by a cron job / BullMQ scheduled task.
   */
  async executeRetention(organizationId: string): Promise<{ deleted: number }> {
    const policies = await this.policyModel.find({ organizationId, isActive: true });
    const activeHolds = await this.legalHoldModel.find({ organizationId, isActive: true });

    // Build set of protected conversation/user IDs
    const protectedConvIds = new Set<string>();
    const protectedUserIds = new Set<string>();
    for (const hold of activeHolds) {
      if (hold.targetConversationIds) hold.targetConversationIds.forEach(id => protectedConvIds.add(id));
      if (hold.targetUserIds) hold.targetUserIds.forEach(id => protectedUserIds.add(id));
    }

    let totalDeleted = 0;

    for (const policy of policies) {
      if (policy.retentionDays === 0) continue; // Forever = no deletion

      const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
      const query: any = {
        createdAt: { $lt: cutoffDate },
        isDeleted: false,
      };

      // Scope filtering
      if (policy.scope === 'specific' && policy.conversationIds?.length) {
        query.conversationId = { $in: policy.conversationIds };
      }

      // Exclude legally held messages
      if (protectedConvIds.size > 0) {
        query.conversationId = { ...query.conversationId, $nin: Array.from(protectedConvIds) };
      }
      if (protectedUserIds.size > 0) {
        query.senderId = { $nin: Array.from(protectedUserIds) };
      }

      const result = await this.messageModel.updateMany(query, {
        $set: { isDeleted: true, deletedAt: new Date(), deletedBy: 'retention-policy' },
      });

      totalDeleted += result.modifiedCount;
    }

    this.logger.log(`Retention executed for org ${organizationId}: ${totalDeleted} messages deleted`);
    return { deleted: totalDeleted };
  }
}
