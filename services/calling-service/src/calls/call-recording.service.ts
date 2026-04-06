import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICall } from './schemas/call.schema';
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
  callId: string;
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
 * Call Recording Service.
 *
 * Recording pipeline:
 * 1. Create a PlainTransport on the SFU router for RTP egress
 * 2. Spawn ffmpeg to read RTP from the PlainTransport port
 * 3. Encode to MP4 (H.264 + AAC) in a temp file
 * 4. On stop: gracefully terminate ffmpeg, upload to media-service, update call record
 */
@Injectable()
export class CallRecordingService implements OnModuleDestroy {
  private readonly logger = new Logger(CallRecordingService.name);
  private activeRecordings = new Map<string, ActiveRecording>();

  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

  constructor(
    @InjectModel('Call') private callModel: Model<ICall>,
    private readonly sfuService: SfuService,
  ) {}

  /**
   * Validate that an ID is safe for use in file paths.
   * Prevents path traversal attacks via crafted callId values.
   */
  private sanitizeId(id: string): string {
    if (!id || !CallRecordingService.ID_PATTERN.test(id)) {
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
    for (const [callId, recording] of this.activeRecordings) {
      this.logger.log(`Killing ffmpeg process for call ${callId}`);
      killPromises.push(this.stopFfmpegProcess(recording.ffmpegProcess));
      if (recording.transport && typeof recording.transport.close === 'function') {
        try { recording.transport.close(); } catch {}
      }
    }
    await Promise.allSettled(killPromises);
    this.activeRecordings.clear();
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
    this.stopRecordingPipeline(callId, call).catch(err =>
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

  /**
   * Start the ffmpeg recording pipeline via SFU PlainTransport.
   */
  private async startRecordingPipeline(callId: string): Promise<void> {
    if (!ffmpeg) {
      this.logger.warn('fluent-ffmpeg not available — recording pipeline disabled');
      return;
    }

    if (!this.sfuService.isAvailable()) {
      this.logger.warn(`SFU not available for call ${callId} — skipping recording pipeline`);
      return;
    }

    const room = this.sfuService.getRoom(callId);
    if (!room) {
      this.logger.warn(`No SFU room found for call ${callId} — skipping recording pipeline`);
      return;
    }

    try {
      const transport = await this.sfuService.createPlainTransport(callId);
      const { port } = transport.tuple;

      const timestamp = Date.now();
      const filePath = path.join(RECORDING_TMP_DIR, `recording-${callId}-${timestamp}.mp4`);

      // Build SDP content for ffmpeg input
      const sdpContent = this.buildSdp(port);
      const sdpPath = path.join(RECORDING_TMP_DIR, `recording-${callId}-${timestamp}.sdp`);
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
          this.logger.log(`ffmpeg started for call ${callId}: ${cmdLine}`);
        })
        .on('error', (err: Error) => {
          // SIGINT causes an "error" event — only log if it's unexpected
          if (!err.message.includes('SIGINT') && !err.message.includes('SIGKILL')) {
            this.logger.error(`ffmpeg error for call ${callId}: ${err.message}`);
          }
          // Clean up SDP file
          this.safeUnlink(sdpPath);
        })
        .on('end', () => {
          this.logger.log(`ffmpeg finished writing for call ${callId}: ${filePath}`);
          this.safeUnlink(sdpPath);
        });

      ffmpegProcess.run();

      this.activeRecordings.set(callId, {
        ffmpegProcess,
        transport,
        filePath,
        sdpPath,
        callId,
        startedAt: new Date(),
      });

      this.logger.log(`Recording pipeline started for call ${callId} on RTP port ${port}`);
    } catch (err) {
      this.logger.error(`Failed to start recording pipeline for call ${callId}: ${err.message}`, err.stack);
    }
  }

  /**
   * Stop the ffmpeg process, upload the file, and update the call record.
   */
  private async stopRecordingPipeline(callId: string, call: ICall): Promise<void> {
    const recording = this.activeRecordings.get(callId);
    if (!recording) {
      this.logger.warn(`No active recording pipeline for call ${callId}`);
      return;
    }

    this.activeRecordings.delete(callId);

    try {
      // Gracefully stop ffmpeg with SIGINT
      await this.stopFfmpegProcess(recording.ffmpegProcess);

      // Close the PlainTransport
      if (recording.transport && typeof recording.transport.close === 'function') {
        recording.transport.close();
      }

      // Verify the output file exists and has content
      if (!fs.existsSync(recording.filePath)) {
        this.logger.warn(`Recording file not found for call ${callId}: ${recording.filePath}`);
        return;
      }

      const stats = fs.statSync(recording.filePath);
      if (stats.size === 0) {
        this.logger.warn(`Recording file is empty for call ${callId}: ${recording.filePath}`);
        this.safeUnlink(recording.filePath);
        return;
      }

      this.logger.log(`Recording file for call ${callId}: ${recording.filePath} (${stats.size} bytes)`);

      // Upload to media-service
      const fileId = await this.uploadToMediaService(recording.filePath, callId);

      if (fileId) {
        await this.callModel.updateOne(
          { callId },
          { $set: { 'recording.fileId': fileId } },
        );
        this.logger.log(`Recording uploaded for call ${callId}, fileId: ${fileId}`);
      }
    } catch (err) {
      this.logger.error(`Error finalizing recording for call ${callId}: ${err.message}`, err.stack);
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
  private uploadToMediaService(filePath: string, callId: string): Promise<string | null> {
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
          `call-recording` +
          `\r\n--${boundary}\r\n` +
          `Content-Disposition: form-data; name="callId"\r\n\r\n` +
          `${callId}` +
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
      's=Nexora Call Recording',
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
