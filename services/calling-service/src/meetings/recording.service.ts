import { Injectable, Logger, NotFoundException, ForbiddenException, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from './schemas/meeting.schema';
import { SfuService } from '../sfu/sfu.service';
import { RecordingPipelineBase } from '../common/recording-pipeline.base';

/**
 * Meeting Recording Service.
 *
 * Recording pipeline (inherited from RecordingPipelineBase):
 * 1. SFU PlainTransport for RTP egress of all participant streams
 * 2. ffmpeg reads RTP, encodes to MP4 (H.264 + AAC)
 * 3. On stop: gracefully terminate ffmpeg, upload to media-service
 * 4. Metadata saved to meeting record, notification sent to host
 */
@Injectable()
export class MeetingRecordingService extends RecordingPipelineBase implements OnModuleDestroy {
  protected readonly logger = new Logger(MeetingRecordingService.name);

  protected get entityLabel(): string { return 'meeting'; }
  protected get uploadType(): string { return 'meeting-recording'; }

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
    sfuService: SfuService,
  ) {
    super(sfuService);
  }

  async startRecording(meetingId: string, userId: string): Promise<IMeeting> {
    meetingId = this.sanitizeId(meetingId);
    const existingMeeting = await this.meetingModel.findOne({ meetingId, status: 'active' });
    if (!existingMeeting) throw new NotFoundException('Active meeting not found');

    // Check permissions
    const isHost = existingMeeting.hostId === userId || existingMeeting.coHostIds?.includes(userId);
    const allowParticipantStart = existingMeeting.settings?.recording?.allowParticipantStart;
    if (!isHost && !allowParticipantStart) {
      throw new ForbiddenException('Only host can start recording');
    }

    // Atomic check-and-set to prevent race conditions on concurrent startRecording
    const meeting = await this.meetingModel.findOneAndUpdate(
      { meetingId, status: 'active', isRecording: { $ne: true } },
      {
        $set: {
          isRecording: true,
          recordingStartedAt: new Date(),
        },
        $push: {
          recordings: {
            startedBy: userId,
            startedAt: new Date(),
          },
        },
      },
      { new: true },
    );

    if (!meeting) {
      // Recording was already started by another request — return current state
      return existingMeeting;
    }

    // Second guard: check in-memory map before spawning ffmpeg
    if (!this.activeRecordings.has(meetingId)) {
      await this.startRecordingPipeline(meetingId);
    }

    this.logger.log(`Meeting recording started: ${meetingId} by ${userId}`);
    return meeting;
  }

  async stopRecording(meetingId: string, userId: string): Promise<IMeeting> {
    meetingId = this.sanitizeId(meetingId);
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');

    if (!meeting.isRecording) return meeting;

    meeting.isRecording = false;

    // Update the latest recording entry
    const latestRecording = meeting.recordings[meeting.recordings.length - 1];
    if (latestRecording) {
      latestRecording.endedAt = new Date();
      if (latestRecording.startedAt) {
        latestRecording.duration = Math.floor(
          (latestRecording.endedAt.getTime() - new Date(latestRecording.startedAt).getTime()) / 1000,
        );
      }
    }

    await meeting.save();
    this.logger.log(`Meeting recording stopped: ${meetingId}. Duration: ${latestRecording?.duration}s`);

    // Stop ffmpeg and upload asynchronously
    this.stopAndUploadRecording(meetingId).then(fileId => {
      if (fileId) {
        this.meetingModel.updateOne(
          { meetingId, 'recordings.startedAt': { $ne: null } },
          {
            $set: {
              'recordings.$[last].fileId': fileId,
              'recordings.$[last].type': 'composite',
            },
          },
          {
            arrayFilters: [{ 'last.fileId': null, 'last.endedAt': { $ne: null } }],
          },
        ).catch(err => this.logger.error(`Failed to save recording fileId for meeting ${meetingId}: ${err.message}`));
        this.logger.log(`Recording uploaded for meeting ${meetingId}, fileId: ${fileId}`);
      }
    }).catch(err =>
      this.logger.error(`Failed to finalize recording for meeting ${meetingId}: ${err.message}`, err.stack),
    );

    return meeting;
  }

  async getRecordings(meetingId: string, userId: string): Promise<any[]> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');

    // Check access: participants + host
    const isParticipant = meeting.participantIds.includes(userId) || meeting.hostId === userId;
    if (!isParticipant) throw new ForbiddenException('Not a participant');

    return meeting.recordings;
  }
}
