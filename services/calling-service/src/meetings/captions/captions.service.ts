import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from '../schemas/meeting.schema';

/**
 * Live Captions Service.
 *
 * Phase 1 — Post-meeting transcript:
 *   After meeting ends, audio recording is processed by speech-to-text
 *   (Whisper API or similar). Transcript saved to meeting record.
 *
 * Phase 2 — Live captions:
 *   Real-time STT displayed as subtitles during the meeting.
 *   Uses browser Web Speech API or a streaming STT cloud service.
 *   Per-user toggle: "Turn on captions".
 *
 * This service manages caption state and transcript processing.
 */
@Injectable()
export class CaptionsService {
  private readonly logger = new Logger(CaptionsService.name);

  // Track which meetings have live captions enabled
  private activeCaptions = new Map<string, Set<string>>(); // meetingId -> Set<userId>

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
  ) {}

  enableCaptions(meetingId: string, userId: string): void {
    if (!this.activeCaptions.has(meetingId)) {
      this.activeCaptions.set(meetingId, new Set());
    }
    this.activeCaptions.get(meetingId)!.add(userId);
    this.logger.log(`Captions enabled for user ${userId} in meeting ${meetingId}`);
  }

  disableCaptions(meetingId: string, userId: string): void {
    this.activeCaptions.get(meetingId)?.delete(userId);
  }

  isCaptionsEnabled(meetingId: string, userId: string): boolean {
    return this.activeCaptions.get(meetingId)?.has(userId) || false;
  }

  getCaptionUsers(meetingId: string): string[] {
    return Array.from(this.activeCaptions.get(meetingId) || []);
  }

  /**
   * Process a caption segment from Web Speech API.
   * Broadcasts to all users who have captions enabled.
   */
  processCaptionSegment(meetingId: string, speakerId: string, speakerName: string, text: string, isFinal: boolean): CaptionSegment {
    return {
      meetingId,
      speakerId,
      speakerName,
      text,
      isFinal,
      timestamp: new Date(),
    };
  }

  /**
   * Generate post-meeting transcript from audio recording.
   * Calls an external STT service (Whisper, Google STT, etc.).
   */
  async generateTranscriptFromRecording(meetingId: string, audioUrl: string): Promise<void> {
    this.logger.log(`Generating transcript for meeting ${meetingId} from ${audioUrl}`);

    // Stub: In production, this would:
    // 1. Download audio from audioUrl
    // 2. Send to Whisper API / Google Cloud Speech-to-Text
    // 3. Parse segments with speaker diarization
    // 4. Save to meeting.transcript[]

    // For now, just log
    this.logger.debug('Transcript generation: stub — implement with Whisper API');
  }

  cleanupMeeting(meetingId: string): void {
    this.activeCaptions.delete(meetingId);
  }
}

export interface CaptionSegment {
  meetingId: string;
  speakerId: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  timestamp: Date;
}
