import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from './schemas/meeting.schema';
import { SfuService } from '../sfu/sfu.service';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

// Import fluent-ffmpeg conditionally to allow graceful fallback
let ffmpeg: any = null;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch {
  // fluent-ffmpeg not available — recording will be disabled
}

interface ActiveRecording {
  ffmpegProcess: any;
  transport: any;
  filePath: string;
  sdpPath: string;
  meetingId: string;
  startedAt: Date;
}

const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:3052';
const RECORDING_TMP_DIR = '/tmp';

/**
 * Offset from the audio RTP port to the video RTP port in the SDP file.
 * By convention, mediasoup allocates consecutive even ports for each media kind,
 * so video is typically at audioPort + 2. Adjust if your SFU uses a different layout.
 */
const VIDEO_PORT_OFFSET = 2;

/**
 * Meeting Recording Service.
 *
 * Recording pipeline:
 * 1. SFU PlainTransport for RTP egress of all participant streams
 * 2. ffmpeg reads RTP, encodes to MP4 (H.264 + AAC)
 * 3. On stop: gracefully terminate ffmpeg, upload to media-service
 * 4. Metadata saved to meeting record, notification sent to host
 */
@Injectable()
export class MeetingRecordingService implements OnModuleDestroy {
  private readonly logger = new Logger(MeetingRecordingService.name);
  private activeRecordings = new Map<string, ActiveRecording>();

  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
    private readonly sfuService: SfuService,
  ) {}

  /**
   * Validate that an ID is safe for use in file paths.
   * Prevents path traversal attacks via crafted meetingId values.
   */
  private sanitizeId(id: string): string {
    if (!id || !MeetingRecordingService.ID_PATTERN.test(id)) {
      throw new BadRequestException(`Invalid ID format: ${id}`);
    }
    return id;
  }

  /**
   * Kill all active ffmpeg processes on module destroy to prevent orphaned processes.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log(`Cleaning up ${this.activeRecordings.size} active recording(s)...`);
    const killPromises: Promise<void>[] = [];
    for (const [meetingId, recording] of this.activeRecordings) {
      this.logger.log(`Killing ffmpeg process for meeting ${meetingId}`);
      killPromises.push(this.stopFfmpegProcess(recording.ffmpegProcess));
      if (recording.transport && typeof recording.transport.close === 'function') {
        try { recording.transport.close(); } catch {}
      }
    }
    await Promise.allSettled(killPromises);
    this.activeRecordings.clear();
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
    this.stopRecordingPipeline(meetingId, meeting).catch(err =>
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

  /**
   * Start the ffmpeg recording pipeline via SFU PlainTransport.
   */
  private async startRecordingPipeline(meetingId: string): Promise<void> {
    if (!ffmpeg) {
      this.logger.warn('fluent-ffmpeg not available — recording pipeline disabled');
      return;
    }

    if (!this.sfuService.isAvailable()) {
      this.logger.warn(`SFU not available for meeting ${meetingId} — skipping recording pipeline`);
      return;
    }

    const room = this.sfuService.getRoom(meetingId);
    if (!room) {
      this.logger.warn(`No SFU room found for meeting ${meetingId} — skipping recording pipeline`);
      return;
    }

    try {
      const transport = await this.sfuService.createPlainTransport(meetingId);
      const { port } = transport.tuple;

      const timestamp = Date.now();
      const filePath = path.join(RECORDING_TMP_DIR, `recording-${meetingId}-${timestamp}.mp4`);

      // Build SDP content for ffmpeg input
      const sdpContent = this.buildSdp(port);
      const sdpPath = path.join(RECORDING_TMP_DIR, `recording-${meetingId}-${timestamp}.sdp`);
      fs.writeFileSync(sdpPath, sdpContent);

      const ffmpegProcess = ffmpeg(sdpPath)
        .inputOptions([
          '-protocol_whitelist', 'file,rtp,udp',
          '-analyzeduration', '5000000',
          '-probesize', '5000000',
        ])
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-t', '7200',
          '-fs', '2147483648',
          '-y',
        ])
        .output(filePath)
        .on('start', (cmdLine: string) => {
          this.logger.log(`ffmpeg started for meeting ${meetingId}: ${cmdLine}`);
        })
        .on('error', (err: Error) => {
          // SIGINT causes an "error" event — only log if it's unexpected
          if (!err.message.includes('SIGINT') && !err.message.includes('SIGKILL')) {
            this.logger.error(`ffmpeg error for meeting ${meetingId}: ${err.message}`);
          }
          this.safeUnlink(sdpPath);
        })
        .on('end', () => {
          this.logger.log(`ffmpeg finished writing for meeting ${meetingId}: ${filePath}`);
          this.safeUnlink(sdpPath);
        });

      ffmpegProcess.run();

      this.activeRecordings.set(meetingId, {
        ffmpegProcess,
        transport,
        filePath,
        sdpPath,
        meetingId,
        startedAt: new Date(),
      });

      this.logger.log(`Recording pipeline started for meeting ${meetingId} on RTP port ${port}`);
    } catch (err) {
      this.logger.error(`Failed to start recording pipeline for meeting ${meetingId}: ${err.message}`, err.stack);
    }
  }

  /**
   * Stop the ffmpeg process, upload the file, and update the meeting record.
   */
  private async stopRecordingPipeline(meetingId: string, meeting: IMeeting): Promise<void> {
    const recording = this.activeRecordings.get(meetingId);
    if (!recording) {
      this.logger.warn(`No active recording pipeline for meeting ${meetingId}`);
      return;
    }

    this.activeRecordings.delete(meetingId);

    try {
      // Gracefully stop ffmpeg with SIGINT
      await this.stopFfmpegProcess(recording.ffmpegProcess);

      // Close the PlainTransport
      if (recording.transport && typeof recording.transport.close === 'function') {
        recording.transport.close();
      }

      // Verify the output file exists and has content
      if (!fs.existsSync(recording.filePath)) {
        this.logger.warn(`Recording file not found for meeting ${meetingId}: ${recording.filePath}`);
        return;
      }

      const stats = fs.statSync(recording.filePath);
      if (stats.size === 0) {
        this.logger.warn(`Recording file is empty for meeting ${meetingId}: ${recording.filePath}`);
        this.safeUnlink(recording.filePath);
        return;
      }

      this.logger.log(`Recording file for meeting ${meetingId}: ${recording.filePath} (${stats.size} bytes)`);

      // Upload to media-service
      const fileId = await this.uploadToMediaService(recording.filePath, meetingId);

      if (fileId) {
        // Update the latest recording entry with the fileId
        await this.meetingModel.updateOne(
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
        );
        this.logger.log(`Recording uploaded for meeting ${meetingId}, fileId: ${fileId}`);
      }
    } catch (err) {
      this.logger.error(`Error finalizing recording for meeting ${meetingId}: ${err.message}`, err.stack);
    } finally {
      // Always clean up the temp file and SDP file
      this.safeUnlink(recording.filePath);
      this.safeUnlink(recording.sdpPath);
    }
  }

  /**
   * Send SIGINT to ffmpeg and wait for it to finish writing.
   */
  private stopFfmpegProcess(ffmpegProcess: any): Promise<void> {
    return new Promise((resolve) => {
      if (!ffmpegProcess) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.logger.warn('ffmpeg did not exit in time, sending SIGKILL');
        try { ffmpegProcess.kill('SIGKILL'); } catch {}
        resolve();
      }, 10000);

      ffmpegProcess.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });

      ffmpegProcess.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });

      // Send SIGINT to gracefully stop ffmpeg
      try {
        ffmpegProcess.kill('SIGINT');
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  /**
   * Upload the recording file to media-service via multipart POST.
   */
  private uploadToMediaService(filePath: string, meetingId: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const url = new URL('/api/v1/media/upload', MEDIA_SERVICE_URL);
        const boundary = `----NexoraRecording${Date.now()}`;
        const fileName = path.basename(filePath);

        const fileStream = fs.createReadStream(filePath);

        // Build multipart form data
        const headerPart = Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
          `Content-Type: video/mp4\r\n\r\n`,
        );

        const metadataPart = Buffer.from(
          `\r\n--${boundary}\r\n` +
          `Content-Disposition: form-data; name="type"\r\n\r\n` +
          `meeting-recording` +
          `\r\n--${boundary}\r\n` +
          `Content-Disposition: form-data; name="meetingId"\r\n\r\n` +
          `${meetingId}` +
          `\r\n--${boundary}--\r\n`,
        );

        const httpModule = url.protocol === 'https:' ? https : http;

        const req = httpModule.request(
          {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Transfer-Encoding': 'chunked',
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                try {
                  const parsed = JSON.parse(data);
                  resolve(parsed.fileId || parsed.id || null);
                } catch {
                  this.logger.error(`Failed to parse media-service response: ${data}`);
                  resolve(null);
                }
              } else {
                this.logger.error(`Media-service upload failed (${res.statusCode}): ${data}`);
                resolve(null);
              }
            });
          },
        );

        req.setTimeout(120000, () => {
          req.destroy(new Error('Upload to media-service timed out after 120s'));
        });

        req.on('error', (err: Error) => {
          this.logger.error(`Media-service upload request failed: ${err.message}`);
          resolve(null);
        });

        req.write(headerPart);
        fileStream.pipe(req, { end: false });
        fileStream.on('end', () => {
          req.end(metadataPart);
        });
        fileStream.on('error', (err: Error) => {
          this.logger.error(`Error reading recording file for upload: ${err.message}`);
          req.destroy();
          resolve(null);
        });
      } catch (err) {
        this.logger.error(`Upload setup failed: ${err.message}`);
        resolve(null);
      }
    });
  }

  /**
   * Build a minimal SDP file for ffmpeg to read RTP on the given port.
   */
  private buildSdp(rtpPort: number): string {
    return [
      'v=0',
      'o=- 0 0 IN IP4 127.0.0.1',
      's=Nexora Meeting Recording',
      'c=IN IP4 127.0.0.1',
      't=0 0',
      // Audio stream
      `m=audio ${rtpPort} RTP/AVP 111`,
      'a=rtpmap:111 opus/48000/2',
      'a=fmtp:111 minptime=10;useinbandfec=1',
      // Video stream (port = audio port + VIDEO_PORT_OFFSET, assumes consecutive even port allocation)
      `m=video ${rtpPort + VIDEO_PORT_OFFSET} RTP/AVP 96`,
      'a=rtpmap:96 VP8/90000',
      '',
    ].join('\r\n');
  }

  /**
   * Safely delete a file, ignoring errors if it doesn't exist.
   */
  private safeUnlink(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
