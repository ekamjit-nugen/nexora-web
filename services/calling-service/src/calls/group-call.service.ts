import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ICall } from './schemas/call.schema';

@Injectable()
export class GroupCallService {
  private readonly logger = new Logger(GroupCallService.name);

  constructor(
    @InjectModel('Call') private callModel: Model<ICall>,
  ) {}

  async initiateGroupCall(initiatorId: string, participantIds: string[], type: string, organizationId: string, initiatorName?: string) {
    const callId = uuidv4().split('-')[0];
    const allParticipantIds = Array.from(new Set([initiatorId, ...participantIds]));

    const call = new this.callModel({
      organizationId,
      callId,
      initiatorId,
      participantIds: allParticipantIds,
      type,
      mode: 'group',
      status: 'initiated',
      startTime: new Date(),
      participants: [{
        userId: initiatorId,
        name: initiatorName || null,
        status: 'connected',
        joinedAt: new Date(),
        audioEnabled: true,
        videoEnabled: type === 'video',
      }],
    });

    await call.save();
    this.logger.log(`Group call initiated: ${callId} by ${initiatorId} with ${participantIds.length} participants`);
    return call;
  }

  async joinGroupCall(callId: string, userId: string, userName?: string) {
    const call = await this.callModel.findOne({ callId, status: { $in: ['initiated', 'ringing', 'connecting', 'connected'] } });
    if (!call) throw new NotFoundException('Call not found or already ended');

    if (!call.participantIds.includes(userId)) {
      call.participantIds.push(userId);
    }

    const existingParticipant = call.participants.find(p => p.userId === userId);
    if (!existingParticipant) {
      call.participants.push({
        userId,
        name: userName || null,
        status: 'connected',
        joinedAt: new Date(),
        audioEnabled: true,
        videoEnabled: call.type === 'video',
      } as any);
    } else {
      existingParticipant.status = 'connected';
      existingParticipant.joinedAt = new Date();
      existingParticipant.leftAt = undefined;
    }

    // Transition to connected if 2+ participants are connected
    const connectedCount = call.participants.filter(p => p.status === 'connected').length;
    if (connectedCount >= 2 && call.status !== 'connected') {
      call.status = 'connected';
      call.connectedAt = new Date();
    }

    await call.save();
    this.logger.log(`User ${userId} joined group call ${callId}`);
    return call;
  }

  async leaveGroupCall(callId: string, userId: string) {
    const call = await this.callModel.findOne({ callId });
    if (!call) throw new NotFoundException('Call not found');

    const participant = call.participants.find(p => p.userId === userId);
    if (participant) {
      participant.leftAt = new Date();
      participant.status = 'left';
    }

    // Check if any participants still connected
    const stillConnected = call.participants.filter(p => p.status === 'connected');
    if (stillConnected.length <= 1) {
      // End the call if 1 or 0 participants remain
      call.status = 'ended';
      call.endTime = new Date();
      call.endedBy = userId;
      call.endReason = 'user_ended';
      if (call.connectedAt) {
        call.duration = Math.floor((call.endTime.getTime() - call.connectedAt.getTime()) / 1000);
      }
      // Mark remaining participant as left
      for (const p of stillConnected) {
        if (p.userId !== userId) {
          p.leftAt = new Date();
          p.status = 'left';
        }
      }
    }

    await call.save();
    this.logger.log(`User ${userId} left group call ${callId}. Still connected: ${stillConnected.length - 1}`);
    return call;
  }

  async addParticipant(callId: string, userId: string) {
    const call = await this.callModel.findOne({ callId, status: { $in: ['initiated', 'ringing', 'connecting', 'connected'] } });
    if (!call) throw new NotFoundException('Call not found or already ended');

    if (!call.participantIds.includes(userId)) {
      call.participantIds.push(userId);
      await call.save();
    }

    return call;
  }
}
