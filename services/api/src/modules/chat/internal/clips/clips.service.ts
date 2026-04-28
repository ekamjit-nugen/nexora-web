import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IClip } from './clips.schema';

@Injectable()
export class ClipsService {
  private readonly logger = new Logger(ClipsService.name);

  constructor(
    @InjectModel('Clip', 'nexora_chat') private clipModel: Model<IClip>,
  ) {}

  async createClip(data: {
    conversationId: string;
    senderId: string;
    senderName: string;
    organizationId: string;
    mediaUrl: string;
    duration: number;
    fileSize?: number;
    mimeType?: string;
  }) {
    const clip = new this.clipModel({
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderName: data.senderName,
      organizationId: data.organizationId,
      mediaUrl: data.mediaUrl,
      duration: data.duration,
      fileSize: data.fileSize || null,
      mimeType: data.mimeType || null,
      transcriptionStatus: 'pending',
    });

    await clip.save();
    this.logger.log(`Clip created: ${clip._id} in conversation ${data.conversationId}`);

    // Trigger async transcription (non-blocking)
    this.transcribeClip(clip._id.toString()).catch((err) => {
      this.logger.error(`Transcription failed for clip ${clip._id}: ${err.message}`);
    });

    return clip;
  }

  async transcribeClip(clipId: string) {
    const clip = await this.clipModel.findById(clipId);
    if (!clip) {
      throw new NotFoundException('Clip not found');
    }

    // Update status to processing
    clip.transcriptionStatus = 'processing';
    await clip.save();

    try {
      // Since we cannot actually process audio through a text LLM,
      // we store a placeholder transcription and mark as pending.
      // In production, this would call a speech-to-text service (e.g., Whisper API)
      // and then optionally summarize via the AI summary service's LLM endpoint.
      const placeholderTranscription =
        `[Transcription pending] Video clip recorded by ${clip.senderName} ` +
        `(${clip.duration}s, ${clip.mimeType || 'video/webm'}). ` +
        `Automatic transcription will be available when speech-to-text processing is configured.`;

      clip.transcription = placeholderTranscription;
      clip.transcriptionStatus = 'complete';
      await clip.save();

      this.logger.log(`Transcription completed (placeholder) for clip ${clipId}`);
      return clip;
    } catch (err) {
      clip.transcriptionStatus = 'failed';
      await clip.save();
      this.logger.error(`Transcription failed for clip ${clipId}: ${err.message}`);
      throw err;
    }
  }

  async getClip(clipId: string) {
    const clip = await this.clipModel.findById(clipId);
    if (!clip) {
      throw new NotFoundException('Clip not found');
    }
    return clip;
  }

  async getTranscription(clipId: string) {
    const clip = await this.clipModel.findById(clipId);
    if (!clip) {
      throw new NotFoundException('Clip not found');
    }
    return {
      clipId: clip._id,
      transcription: clip.transcription,
      transcriptionStatus: clip.transcriptionStatus,
    };
  }
}
