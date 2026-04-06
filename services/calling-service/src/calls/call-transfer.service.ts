import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICall } from './schemas/call.schema';

@Injectable()
export class CallTransferService {
  private readonly logger = new Logger(CallTransferService.name);

  constructor(
    @InjectModel('Call') private callModel: Model<ICall>,
  ) {}

  /**
   * Cold transfer: Disconnect the transferring user, ring the target.
   * A ↔ B connected → B transfers to C → A waits, B disconnects → C answers → A ↔ C
   */
  async coldTransfer(callId: string, transferringUserId: string, targetUserId: string): Promise<ICall> {
    const call = await this.callModel.findOne({ callId, status: 'connected' });
    if (!call) throw new NotFoundException('Active call not found');

    const isParticipant = call.participantIds.includes(transferringUserId);
    if (!isParticipant) throw new ForbiddenException('Not a participant in this call');

    // Add transfer record
    call.transferHistory.push({
      fromUserId: transferringUserId,
      toUserId: targetUserId,
      type: 'cold',
      timestamp: new Date(),
    } as any);

    // Add target to participant list
    if (!call.participantIds.includes(targetUserId)) {
      call.participantIds.push(targetUserId);
    }

    // Mark transferring user as left
    const transferrer = call.participants.find(p => p.userId === transferringUserId);
    if (transferrer) {
      transferrer.leftAt = new Date();
      transferrer.status = 'left';
    }

    call.status = 'ringing'; // Ring the new target
    await call.save();

    this.logger.log(`Cold transfer: ${transferringUserId} → ${targetUserId} on call ${callId}`);
    return call;
  }

  /**
   * Warm transfer: Put current call on hold, consult with target, then connect.
   * A ↔ B → B holds A, B calls C → B briefs C → B connects A ↔ C, B disconnects
   *
   * Implementation: Creates a consult state. The actual media routing
   * happens through the WebSocket gateway / SFU.
   */
  async warmTransferInitiate(callId: string, transferringUserId: string, targetUserId: string): Promise<{ call: ICall; consultCallId: string }> {
    const call = await this.callModel.findOne({ callId, status: 'connected' });
    if (!call) throw new NotFoundException('Active call not found');

    const isParticipant = call.participantIds.includes(transferringUserId);
    if (!isParticipant) throw new ForbiddenException('Not a participant in this call');

    // Record the transfer initiation
    call.transferHistory.push({
      fromUserId: transferringUserId,
      toUserId: targetUserId,
      type: 'warm',
      timestamp: new Date(),
    } as any);

    await call.save();

    // The consult call is handled by the regular call initiation flow
    // Return the original call with transfer metadata
    this.logger.log(`Warm transfer initiated: ${transferringUserId} consulting ${targetUserId} on call ${callId}`);
    return { call, consultCallId: `consult-${callId}` };
  }

  async warmTransferComplete(callId: string, transferringUserId: string): Promise<ICall> {
    const call = await this.callModel.findOne({ callId });
    if (!call) throw new NotFoundException('Call not found');

    // Mark transferring user as left
    const transferrer = call.participants.find(p => p.userId === transferringUserId);
    if (transferrer) {
      transferrer.leftAt = new Date();
      transferrer.status = 'left';
    }

    call.status = 'connected';
    await call.save();

    this.logger.log(`Warm transfer completed: ${transferringUserId} disconnected from call ${callId}`);
    return call;
  }

  async cancelTransfer(callId: string, transferringUserId: string): Promise<ICall> {
    const call = await this.callModel.findOne({ callId });
    if (!call) throw new NotFoundException('Call not found');

    // Remove the last transfer record if it matches
    if (call.transferHistory.length > 0) {
      const lastTransfer = call.transferHistory[call.transferHistory.length - 1];
      if (lastTransfer.fromUserId === transferringUserId) {
        call.transferHistory.pop();
      }
    }

    call.status = 'connected';
    await call.save();

    this.logger.log(`Transfer cancelled on call ${callId}`);
    return call;
  }
}
