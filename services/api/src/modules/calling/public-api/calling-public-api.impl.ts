import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallingPublicApi, CallSummary } from './calling-public-api';
import { CALLING_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class CallingPublicApiImpl implements CallingPublicApi {
  constructor(
    @InjectModel('Call', CALLING_DB) private readonly callModel: Model<any>,
  ) {}

  async getCallById(organizationId: string, callId: string): Promise<CallSummary | null> {
    const c: any = await this.callModel.findOne({
      _id: callId,
      organizationId,
      isDeleted: { $ne: true },
    }).lean();
    if (!c) return null;
    return {
      _id: String(c._id),
      organizationId: String(c.organizationId),
      fromUserId: String(c.fromUserId || ''),
      toUserId: String(c.toUserId || ''),
      type: c.type || 'voice',
      startedAt: c.startedAt,
      endedAt: c.endedAt || null,
      durationSeconds: Number(c.durationSeconds || 0),
    };
  }
}
