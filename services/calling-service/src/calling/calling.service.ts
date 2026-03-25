import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICall } from './schemas/call.schema';
import { InitiateCallDto, AnswerCallDto, RejectCallDto, EndCallDto, CallHistoryQueryDto, CallType } from './dto/index';

@Injectable()
export class CallingService {
  private readonly logger = new Logger(CallingService.name);

  constructor(
    @InjectModel('Call') private callModel: Model<ICall>,
  ) {}

  async initiateCall(userId: string, organizationId: string, dto: InitiateCallDto) {
    const callId = `nxr-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const call = await this.callModel.create({
      organizationId,
      callId,
      initiatorId: userId,
      participantIds: [userId, dto.recipientId],
      type: dto.type,
      status: 'initiated',
      conversationId: dto.conversationId,
      participants: [
        {
          userId,
          joinedAt: new Date(),
          audioEnabled: true,
          videoEnabled: dto.type === CallType.VIDEO,
        },
      ],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Call initiated: ${callId} from ${userId} to ${dto.recipientId}`);
    return call;
  }

  async answerCall(callId: string, userId: string, audioEnabled: boolean = true, videoEnabled: boolean = false) {
    const call = await this.callModel.findOne({ callId });
    if (!call) {
      throw new NotFoundException(`Call ${callId} not found`);
    }

    if (!call.participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this call');
    }

    if (call.status !== 'initiated') {
      if (call.status === 'connected') {
        const alreadyParticipant = call.participants.some(p => p.userId === userId);
        if (!alreadyParticipant) {
          call.participants.push({
            userId,
            joinedAt: new Date(),
            audioEnabled,
            videoEnabled,
          });
          await call.save();
        }
        return call;
      }
      throw new BadRequestException(`Cannot answer call with status: ${call.status}`);
    }

    // Add participant and update status
    call.participants.push({
      userId,
      joinedAt: new Date(),
      audioEnabled,
      videoEnabled,
    });
    call.status = 'connected';
    call.startTime = new Date();
    await call.save();

    this.logger.log(`Call answered: ${callId} by ${userId}`);
    return call;
  }

  async rejectCall(callId: string, userId: string, reason?: string) {
    const call = await this.callModel.findOne({ callId });
    if (!call) {
      throw new NotFoundException(`Call ${callId} not found`);
    }

    if (!call.participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this call');
    }

    if (call.status !== 'initiated') {
      throw new BadRequestException(`Cannot reject call with status: ${call.status}`);
    }

    call.status = 'rejected';
    call.rejectionReason = reason;
    call.endTime = new Date();
    await call.save();

    this.logger.log(`Call rejected: ${callId} by ${userId}, reason: ${reason}`);
    return call;
  }

  async endCall(callId: string, userId: string) {
    const call = await this.callModel.findOne({ callId });
    if (!call) {
      throw new NotFoundException(`Call ${callId} not found`);
    }

    if (!call.participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this call');
    }

    if (call.status === 'ended' || call.status === 'rejected' || call.status === 'missed') {
      return call;
    }

    // Calculate duration
    const endTime = new Date();
    call.endTime = endTime;
    call.status = call.status === 'connected' ? 'ended' : 'missed';
    if (call.startTime) {
      call.duration = Math.floor((endTime.getTime() - call.startTime.getTime()) / 1000);
    }

    // Mark participant as left
    const participant = call.participants.find(p => p.userId === userId);
    if (participant) {
      participant.leftAt = endTime;
    }

    await call.save();

    this.logger.log(`Call ended: ${callId} by ${userId}, duration: ${call.duration}s`);
    return call;
  }

  async getCallHistory(userId: string, organizationId: string, query: CallHistoryQueryDto) {
    const limit = Math.min(query.limit || 20, 100);
    const page = Math.max(query.page || 1, 1);
    const skip = (page - 1) * limit;

    const filter: any = {
      organizationId,
      participantIds: userId,
    };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.type) {
      filter.type = query.type;
    }

    const [calls, total] = await Promise.all([
      this.callModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.callModel.countDocuments(filter),
    ]);

    return {
      calls,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCallDetails(callId: string, userId: string) {
    const call = await this.callModel.findOne({ callId });
    if (!call) {
      throw new NotFoundException(`Call ${callId} not found`);
    }

    if (!call.participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this call');
    }

    return call;
  }

  async getMissedCalls(userId: string, organizationId: string, limit: number = 10) {
    const missedCalls = await this.callModel
      .find({
        organizationId,
        participantIds: userId,
        status: 'missed',
        initiatorId: { $ne: userId }, // Don't count calls initiated by the user
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return missedCalls;
  }

  async getCallStats(userId: string, organizationId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const filter = { organizationId, participantIds: userId, createdAt: { $gte: todayStart } };

    const [totalToday, completedToday, missedToday, durationAgg] = await Promise.all([
      this.callModel.countDocuments(filter),
      this.callModel.countDocuments({ ...filter, status: { $in: ['completed', 'ended'] } }),
      this.callModel.countDocuments({ ...filter, status: 'missed', initiatorId: { $ne: userId } }),
      this.callModel.aggregate([
        { $match: { ...filter, duration: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$duration' } } },
      ]),
    ]);

    return {
      totalToday,
      completedToday,
      missedToday,
      avgDuration: Math.round(durationAgg[0]?.avg || 0),
    };
  }

  async updateCallNotes(callId: string, userId: string, notes: string) {
    const call = await this.callModel.findById(callId);
    if (!call) {
      throw new NotFoundException(`Call not found`);
    }
    if (!call.participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this call');
    }
    call.notes = notes;
    await call.save();
    return call;
  }

  async updateCallMetrics(callId: string, metrics: { callQuality?: string; bitrate?: number; frameRate?: number; packetLoss?: number }) {
    const call = await this.callModel.findOne({ callId });
    if (!call) {
      throw new NotFoundException(`Call ${callId} not found`);
    }

    Object.assign(call.metadata, metrics);
    await call.save();
    return call;
  }
}
