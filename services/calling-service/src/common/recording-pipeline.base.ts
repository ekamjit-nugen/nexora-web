import { Logger, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { SfuService } from '../sfu/sfu.service';

// Import fluent-ffmpeg conditionally to allow graceful fallback
let ffmpeg: any = null;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch {
  // fluent-ffmpeg not available — recording will be disabled
}

export interface ActiveRecording {
  ffmpegProcess: any;
  transport: any;
  filePath: string;
  sdpPath: string;
  entityId: string;
  startedAt: Date;
}

const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:3052';
const RECORDING_TMP_DIR = '/tmp';

/**
 * Offset from the audio RTP port to the video RTP port in the SDP file.
 * By convention, mediasoup allocates consecutive even ports for each media kind,
 * so video is typically at audioPort + 2.
 */
const VIDEO_PORT_OFFSET = 2;

/**
 * Shared recording pipeline logic used by both CallRecordingService and MeetingRecordingService.
 * Handles ffmpeg process management, SDP generation, file upload, and cleanup.
 */
export abstract class RecordingPipelineBase implements OnModuleDestroy {
  protected abstract readonly logger: Logger;
  protected activeRecordings = new Map<string, ActiveRecording>();

  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

  constructor(protected readonly sfuService: SfuService) {}

  /** Label for log messages (e.g. 'call' or 'meeting') */
  protected abstract get entityLabel(): string;

  /** Upload type identifier for media-service (e.g. 'call-recording' or 'meeting-recording') */
  protected abstract get uploadType(): string;

  /**
   * Validate that an ID is safe for use in file paths.
   */
  protected sanitizeId(id: string): string {
    if (!id || !RecordingPipelineBase.ID_PATTERN.test(id)) {
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
    for (const [entityId, recording] of this.activeRecordings) {
      this.logger.log(`Killing ffmpeg process for ${this.entityLabel} ${entityId}`);
      killPromises.push(this.stopFfmpegProcess(recording.ffmpegProcess));
      if (recording.transport && typeof recording.transport.close === 'function') {
        try { recording.transport.close(); } catch {}
      }
    }
    await Promise.allSettled(killPromises);
    this.activeRecordings.clear();
  }

  /**
   * Start the ffmpeg recording pipeline via SFU PlainTransport.
   */
  protected async startRecordingPipeline(entityId: string): Promise<void> {
    if (!ffmpeg) {
      this.logger.warn('fluent-ffmpeg not available — recording pipeline disabled');
      return;
    }

    if (!this.sfuService.isAvailable()) {
      this.logger.warn(`SFU not available for ${this.entityLabel} ${entityId} — skipping recording pipeline`);
      return;
    }

    const room = this.sfuService.getRoom(entityId);
    if (!room) {
      this.logger.warn(`No SFU room found for ${this.entityLabel} ${entityId} — skipping recording pipeline`);
      return;
    }

    try {
      const transport = await this.sfuService.createPlainTransport(entityId);
      const { port } = transport.tuple;

      const timestamp = Date.now();
      const filePath = path.join(RECORDING_TMP_DIR, `recording-${entityId}-${timestamp}.mp4`);

      const sdpContent = this.buildSdp(port);
      const sdpPath = path.join(RECORDING_TMP_DIR, `recording-${entityId}-${timestamp}.sdp`);
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
          this.logger.log(`ffmpeg started for ${this.entityLabel} ${entityId}: ${cmdLine}`);
        })
        .on('error', (err: Error) => {
          if (!err.message.includes('SIGINT') && !err.message.includes('SIGKILL')) {
            this.logger.error(`ffmpeg error for ${this.entityLabel} ${entityId}: ${err.message}`);
          }
          this.safeUnlink(sdpPath);
        })
        .on('end', () => {
          this.logger.log(`ffmpeg finished writing for ${this.entityLabel} ${entityId}: ${filePath}`);
          this.safeUnlink(sdpPath);
        });

      ffmpegProcess.run();

      this.activeRecordings.set(entityId, {
        ffmpegProcess,
        transport,
        filePath,
        sdpPath,
        entityId,
        startedAt: new Date(),
      });

      this.logger.log(`Recording pipeline started for ${this.entityLabel} ${entityId} on RTP port ${port}`);
    } catch (err) {
      this.logger.error(`Failed to start recording pipeline for ${this.entityLabel} ${entityId}: ${err.message}`, err.stack);
    }
  }

  /**
   * Stop the ffmpeg process, upload the file, and return the fileId.
   */
  protected async stopAndUploadRecording(entityId: string): Promise<string | null> {
    const recording = this.activeRecordings.get(entityId);
    if (!recording) {
      this.logger.warn(`No active recording pipeline for ${this.entityLabel} ${entityId}`);
      return null;
    }

    this.activeRecordings.delete(entityId);

    try {
      await this.stopFfmpegProcess(recording.ffmpegProcess);

      if (recording.transport && typeof recording.transport.close === 'function') {
        recording.transport.close();
      }

      if (!fs.existsSync(recording.filePath)) {
        this.logger.warn(`Recording file not found for ${this.entityLabel} ${entityId}: ${recording.filePath}`);
        return null;
      }

      const stats = fs.statSync(recording.filePath);
      if (stats.size === 0) {
        this.logger.warn(`Recording file is empty for ${this.entityLabel} ${entityId}: ${recording.filePath}`);
        this.safeUnlink(recording.filePath);
        return null;
      }

      this.logger.log(`Recording file for ${this.entityLabel} ${entityId}: ${recording.filePath} (${stats.size} bytes)`);

      const fileId = await this.uploadToMediaService(recording.filePath, entityId);
      return fileId;
    } catch (err) {
      this.logger.error(`Error finalizing recording for ${this.entityLabel} ${entityId}: ${err.message}`, err.stack);
      return null;
    } finally {
      this.safeUnlink(recording.filePath);
      this.safeUnlink(recording.sdpPath);
    }
  }

  /**
   * Send SIGINT to ffmpeg and wait for it to finish writing.
   */
  protected stopFfmpegProcess(ffmpegProcess: any): Promise<void> {
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
  protected uploadToMediaService(filePath: string, entityId: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const url = new URL('/api/v1/media/upload', MEDIA_SERVICE_URL);
        const boundary = `----NexoraRecording${Date.now()}`;
        const fileName = path.basename(filePath);

        const fileStream = fs.createReadStream(filePath);

        const headerPart = Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
          `Content-Type: video/mp4\r\n\r\n`,
        );

        const metadataPart = Buffer.from(
          `\r\n--${boundary}\r\n` +
          `Content-Disposition: form-data; name="type"\r\n\r\n` +
          `${this.uploadType}` +
          `\r\n--${boundary}\r\n` +
          `Content-Disposition: form-data; name="entityId"\r\n\r\n` +
          `${entityId}` +
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
  protected buildSdp(rtpPort: number): string {
    return [
      'v=0',
      'o=- 0 0 IN IP4 127.0.0.1',
      `s=Nexora ${this.entityLabel.charAt(0).toUpperCase() + this.entityLabel.slice(1)} Recording`,
      'c=IN IP4 127.0.0.1',
      't=0 0',
      `m=audio ${rtpPort} RTP/AVP 111`,
      'a=rtpmap:111 opus/48000/2',
      'a=fmtp:111 minptime=10;useinbandfec=1',
      `m=video ${rtpPort + VIDEO_PORT_OFFSET} RTP/AVP 96`,
      'a=rtpmap:96 VP8/90000',
      '',
    ].join('\r\n');
  }

  /**
   * Safely delete a file, ignoring errors if it doesn't exist.
   */
  protected safeUnlink(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
