import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ILegalHold } from './schemas/retention-policy.schema';

@Injectable()
export class LegalHoldService {
  private readonly logger = new Logger(LegalHoldService.name);

  constructor(
    @InjectModel('LegalHold') private legalHoldModel: Model<ILegalHold>,
  ) {}

  async createHold(organizationId: string, data: Partial<ILegalHold>, createdBy: string) {
    const hold = new this.legalHoldModel({ ...data, organizationId, createdBy, startedAt: new Date() });
    await hold.save();
    this.logger.log(`Legal hold created: ${hold.name} for org ${organizationId}`);
    return hold;
  }

  async getHolds(organizationId: string) {
    return this.legalHoldModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
  }

  async getActiveHolds(organizationId: string) {
    return this.legalHoldModel.find({ organizationId, isActive: true }).lean();
  }

  async releaseHold(holdId: string, releasedBy: string) {
    const hold = await this.legalHoldModel.findById(holdId);
    if (!hold) throw new NotFoundException('Legal hold not found');
    hold.isActive = false;
    hold.endedAt = new Date();
    await hold.save();
    this.logger.log(`Legal hold released: ${hold.name} by ${releasedBy}`);
    return hold;
  }

  /**
   * Check if a message/conversation is under legal hold.
   */
  async isUnderHold(organizationId: string, conversationId?: string, userId?: string): Promise<boolean> {
    const holds = await this.getActiveHolds(organizationId);
    for (const hold of holds) {
      if (hold.scope === 'org') return true;
      if (hold.scope === 'conversation' && conversationId && hold.targetConversationIds?.includes(conversationId)) return true;
      if (hold.scope === 'user' && userId && hold.targetUserIds?.includes(userId)) return true;
    }
    return false;
  }
}
