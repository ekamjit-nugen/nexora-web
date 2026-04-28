import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ISession } from '../schemas/session.schema';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel('Session', 'nexora_auth') private sessionModel: Model<ISession>,
  ) {}

  async getSessions(userId: string): Promise<ISession[]> {
    return this.sessionModel.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).sort({ lastUsedAt: -1 });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionModel.findOne({
      _id: sessionId,
      userId,
    });
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    session.isRevoked = true;
    await session.save();
  }

  async revokeAllSessions(userId: string, exceptFamily?: string): Promise<void> {
    const filter: any = { userId, isRevoked: false };
    if (exceptFamily) {
      filter.refreshTokenFamily = { $ne: exceptFamily };
    }
    await this.sessionModel.updateMany(filter, { $set: { isRevoked: true } });
  }
}
