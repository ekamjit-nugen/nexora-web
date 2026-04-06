import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICall } from '../schemas/call.schema';

/**
 * Voicemail Service.
 * When a call is missed, the caller can optionally leave a voice message.
 * The voicemail is stored as an audio file and linked to the missed call record.
 *
 * Flow:
 * 1. Call rings for 30s with no answer → status: 'missed'
 * 2. System offers caller to record a voicemail
 * 3. Caller records audio via browser MediaRecorder
 * 4. Audio uploaded to media-service
 * 5. Voicemail metadata saved to call record
 * 6. Notification sent to missed recipient
 */
@Injectable()
export class VoicemailService {
  private readonly logger = new Logger(VoicemailService.name);

  constructor(
    @InjectModel('Call') private callModel: Model<ICall>,
  ) {}

  async leaveVoicemail(callId: string, senderId: string, audioUrl: string, duration: number): Promise<ICall> {
    const call = await this.callModel.findOne({ callId, status: 'missed' });
    if (!call) throw new NotFoundException('Missed call not found');

    // Store voicemail in call metadata
    (call.metadata as any).voicemail = {
      audioUrl,
      duration,
      leftBy: senderId,
      leftAt: new Date(),
      listened: false,
    };

    await call.save();
    this.logger.log(`Voicemail left on call ${callId} by ${senderId} (${duration}s)`);

    // In production: send push notification to missed recipient
    // notificationService.sendToUser({ type: 'voicemail', userId: recipientId, ... })

    return call;
  }

  async getVoicemails(userId: string, organizationId: string): Promise<any[]> {
    const calls = await this.callModel.find({
      organizationId,
      status: 'missed',
      participantIds: userId,
      'metadata.voicemail': { $exists: true },
    }).sort({ createdAt: -1 }).limit(50).lean();

    return calls.map(call => ({
      callId: call.callId,
      from: call.initiatorId,
      voicemail: (call.metadata as any).voicemail,
      createdAt: call.createdAt,
    }));
  }

  async markAsListened(callId: string, userId: string): Promise<void> {
    const call = await this.callModel.findOne({ callId, participantIds: userId });
    if (!call || !(call.metadata as any)?.voicemail) throw new NotFoundException('Voicemail not found');

    (call.metadata as any).voicemail.listened = true;
    (call.metadata as any).voicemail.listenedAt = new Date();
    await call.save();
  }

  async deleteVoicemail(callId: string, userId: string): Promise<void> {
    const call = await this.callModel.findOne({ callId, participantIds: userId });
    if (!call) throw new NotFoundException('Call not found');

    (call.metadata as any).voicemail = undefined;
    await call.save();
    this.logger.log(`Voicemail deleted from call ${callId}`);
  }
}
