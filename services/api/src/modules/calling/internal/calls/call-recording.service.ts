import { Injectable, Logger, NotFoundException, ForbiddenException, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICall } from './schemas/call.schema';
import { SfuService } from '../sfu/sfu.service';
import { RecordingPipelineBase } from '../common/recording-pipeline.base';

/**
 * Call Recording Service.
 *
 * Recording pipeline (inherited from RecordingPipelineBase):
 * 1. Create a PlainTransport on the SFU router for RTP egress
 * 2. Spawn ffmpeg to read RTP from the PlainTransport port
 * 3. Encode to MP4 (H.264 + AAC) in a temp file
 * 4. On stop: gracefully terminate ffmpeg, upload to media-service, update call record
 */
@Injectable()
export class CallRecordingService extends RecordingPipelineBase implements OnModuleDestroy {
  protected readonly logger = new Logger(CallRecordingService.name);

  protected get entityLabel(): string { return 'call'; }
  protected get uploadType(): string { return 'call-recording'; }

  constructor(
    @InjectModel('Call', 'nexora_calling') private callModel: Model<ICall>,
    sfuService: SfuService,
  ) {
    super(sfuService);
  }

  async startRecording(callId: string, userId: string): Promise<ICall> {
    callId = this.sanitizeId(callId);

    // First verify the user is a participant
    const existingCall = await this.callModel.findOne({ callId, status: 'connected' });
    if (!existingCall) throw new NotFoundException('Active call not found');

    if (!existingCall.participantIds.includes(userId)) {
      throw new ForbiddenException('Not a participant');
    }

    // Atomic check-and-set to prevent race conditions on concurrent startRecording
    const call = await this.callModel.findOneAndUpdate(
      { callId, status: 'connected', 'recording.enabled': { $ne: true } },
      {
        $set: {
          'recording.enabled': true,
          'recording.startedBy': userId,
          'recording.startedAt': new Date(),
          'recording.endedAt': null,
          'recording.fileId': null,
          'recording.duration': null,
        },
      },
      { new: true },
    );

    if (!call) {
      // Recording was already started by another request — return current state
      return existingCall;
    }

    // Second guard: check in-memory map before spawning ffmpeg
    if (!this.activeRecordings.has(callId)) {
      await this.startRecordingPipeline(callId);
    }

    this.logger.log(`Recording started on call ${callId} by ${userId}`);
    return call;
  }

  async stopRecording(callId: string, userId: string): Promise<ICall> {
    callId = this.sanitizeId(callId);
    const call = await this.callModel.findOne({ callId });
    if (!call) throw new NotFoundException('Call not found');

    // Permission check: only participants or the user who started recording can stop it
    const isParticipant = call.participantIds?.includes(userId);
    const isRecordingStarter = call.recording?.startedBy === userId;
    if (!isParticipant && !isRecordingStarter) {
      throw new ForbiddenException('Not authorized to stop recording');
    }

    if (!call.recording?.enabled) {
      return call; // Not recording
    }

    call.recording.enabled = false;
    call.recording.endedAt = new Date();
    if (call.recording.startedAt) {
      call.recording.duration = Math.floor(
        (call.recording.endedAt.getTime() - call.recording.startedAt.getTime()) / 1000,
      );
    }

    await call.save();
    this.logger.log(`Recording stopped on call ${callId}. Duration: ${call.recording.duration}s`);

    // Stop ffmpeg and upload asynchronously
    this.stopAndUploadRecording(callId).then(fileId => {
      if (fileId) {
        this.callModel.updateOne(
          { callId },
          { $set: { 'recording.fileId': fileId } },
        ).catch(err => this.logger.error(`Failed to save recording fileId for call ${callId}: ${err.message}`));
        this.logger.log(`Recording uploaded for call ${callId}, fileId: ${fileId}`);
      }
    }).catch(err =>
      this.logger.error(`Failed to finalize recording for call ${callId}: ${err.message}`, err.stack),
    );

    return call;
  }

  async getRecordingStatus(callId: string): Promise<{ recording: boolean; startedAt?: Date; startedBy?: string }> {
    const call = await this.callModel.findOne({ callId });
    if (!call) throw new NotFoundException('Call not found');

    return {
      recording: call.recording?.enabled || false,
      startedAt: call.recording?.startedAt || undefined,
      startedBy: call.recording?.startedBy || undefined,
    };
  }
}
