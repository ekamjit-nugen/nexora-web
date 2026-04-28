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
 * Phase 3 — Server-side transcription:
 *   Audio chunks sent from client to server, transcribed via Whisper API,
 *   and broadcast to all caption-enabled users.
 *
 * This service manages caption state and transcript processing.
 */
@Injectable()
export class CaptionsService {
  private readonly logger = new Logger(CaptionsService.name);
  private readonly whisperUrl = process.env.WHISPER_API_URL || null;
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:11434/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  // Track which meetings have live captions enabled
  private activeCaptions = new Map<string, Set<string>>(); // meetingId -> Set<userId>

  constructor(
    @InjectModel('Meeting', 'nexora_calling') private meetingModel: Model<IMeeting>,
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
   * Check if server-side transcription is available (Whisper API configured).
   */
  isServerTranscriptionAvailable(): boolean {
    return !!this.whisperUrl;
  }

  /**
   * Process a caption segment from Web Speech API (browser-side).
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
   * Transcribe an audio chunk using the Whisper API.
   * Falls back gracefully if no Whisper URL is configured.
   * @returns transcribed text or null if unavailable
   */
  async transcribeAudioChunk(audioBuffer: Buffer, language: string = 'en'): Promise<string | null> {
    if (!this.whisperUrl) {
      this.logger.debug('No Whisper API URL configured; server-side transcription unavailable.');
      return null;
    }

    try {
      // Use dynamic import for form-data to avoid bundling issues
      const FormData = (await (Function('return import("form-data")')())).default;
      const axios = (await (Function('return import("axios")')())).default;

      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'chunk.webm',
        contentType: 'audio/webm',
      });
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      formData.append('response_format', 'json');

      const res = await axios.post(`${this.whisperUrl}/v1/audio/transcriptions`, formData, {
        headers: formData.getHeaders(),
        timeout: 15000,
      });

      const text = res.data?.text?.trim() || null;
      return text;
    } catch (err) {
      this.logger.warn(`Whisper transcription failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Process a server-side transcribed audio chunk.
   * Transcribes the audio and stores the segment in the meeting's transcript.
   */
  async processAudioChunk(
    meetingId: string,
    speakerId: string,
    speakerName: string,
    audioBuffer: Buffer,
    language: string = 'en',
  ): Promise<CaptionSegment | null> {
    const transcribedText = await this.transcribeAudioChunk(audioBuffer, language);
    if (!transcribedText) return null;

    // Store in meeting transcript
    const segment = {
      speakerId,
      speakerName,
      text: transcribedText,
      timestamp: new Date(),
    };

    await this.meetingModel.findOneAndUpdate(
      { meetingId },
      { $push: { transcript: segment } },
    );

    return {
      meetingId,
      speakerId,
      speakerName,
      text: transcribedText,
      isFinal: true,
      timestamp: segment.timestamp,
    };
  }

  /**
   * Generate post-meeting transcript from audio recording.
   * Calls an external STT service (Whisper API or similar).
   */
  async generateTranscriptFromRecording(meetingId: string, audioUrl: string): Promise<void> {
    this.logger.log(`Generating transcript for meeting ${meetingId} from ${audioUrl}`);

    if (!this.whisperUrl) {
      this.logger.debug('Transcript generation: no Whisper API configured — skipping.');
      return;
    }

    try {
      const axios = (await (Function('return import("axios")')())).default;

      // Download the audio file
      const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 120000 });
      const audioBuffer = Buffer.from(audioRes.data);

      // Transcribe the full recording
      const transcribedText = await this.transcribeAudioChunk(audioBuffer);
      if (!transcribedText) return;

      // Save as a single transcript entry (diarization would require a more advanced API)
      await this.meetingModel.findOneAndUpdate(
        { meetingId },
        {
          $push: {
            transcript: {
              speakerId: 'system',
              speakerName: 'Recording',
              text: transcribedText,
              timestamp: new Date(),
            },
          },
        },
      );

      this.logger.log(`Transcript generated for meeting ${meetingId} (${transcribedText.length} chars)`);
    } catch (err) {
      this.logger.warn(`Transcript generation failed for meeting ${meetingId}: ${err.message}`);
    }
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
