import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IMediaFile } from '../schemas/media-file.schema';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ImageProcessor } from '../processing/image.processor';
import { VideoProcessor } from '../processing/video.processor';
import { DocumentProcessor } from '../processing/document.processor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pipeline } from 'stream/promises';

// File size limits by category
const SIZE_LIMITS: Record<string, number> = {
  image: 25 * 1024 * 1024,    // 25 MB
  video: 100 * 1024 * 1024,   // 100 MB
  audio: 50 * 1024 * 1024,    // 50 MB
  document: 50 * 1024 * 1024, // 50 MB
  code: 10 * 1024 * 1024,     // 10 MB
  archive: 100 * 1024 * 1024, // 100 MB
  other: 100 * 1024 * 1024,   // 100 MB
};

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) return 'document';
  if (mimeType.startsWith('text/') || mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml')) return 'code';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z')) return 'archive';
  return 'other';
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  // Common file signatures (magic bytes)
  private readonly MAGIC_BYTES: Array<{ bytes: number[]; mime: string }> = [
    { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg' },
    { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png' },
    { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
    { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF...WEBP
    { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
    { bytes: [0x50, 0x4B, 0x03, 0x04], mime: 'application/zip' }, // Also docx/xlsx/pptx
    { bytes: [0x1A, 0x45, 0xDF, 0xA3], mime: 'video/webm' },
    { bytes: [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], mime: 'video/mp4' },
    { bytes: [0x4D, 0x5A], mime: 'application/x-executable' }, // PE/EXE - BLOCKED
  ];

  constructor(
    @InjectModel('MediaFile') private mediaFileModel: Model<IMediaFile>,
    @Inject(forwardRef(() => ImageProcessor)) private readonly imageProcessor: ImageProcessor,
    @Inject(forwardRef(() => VideoProcessor)) private readonly videoProcessor: VideoProcessor,
    @Inject(forwardRef(() => DocumentProcessor)) private readonly documentProcessor: DocumentProcessor,
  ) {
    // MS-009: Throw on missing S3 config — consistent with s3-upload.helper.ts
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;

    if (!endpoint) throw new Error('S3_ENDPOINT not configured');
    if (!bucket) throw new Error('S3_BUCKET not configured');
    if (!accessKey) throw new Error('S3_ACCESS_KEY not configured');
    if (!secretKey) throw new Error('S3_SECRET_KEY not configured');

    this.endpoint = endpoint;
    this.bucket = bucket;

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Detect MIME type from file magic bytes.
   * Returns null if no known signature matches (falls back to Content-Type).
   */
  private detectMimeType(buffer: Buffer, filename: string): string | null {
    if (!buffer || buffer.length < 8) return null;

    for (const sig of this.MAGIC_BYTES) {
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[i] !== sig.bytes[i]) { match = false; break; }
      }
      if (match) {
        // Block executables disguised as other types
        if (sig.mime === 'application/x-executable') {
          throw new BadRequestException('Executable files are not allowed');
        }
        return sig.mime;
      }
    }

    return null;
  }

  async uploadFile(
    file: Express.Multer.File,
    organizationId: string,
    uploadedBy: string,
    conversationId?: string,
    messageId?: string,
    accessLevel: string = 'conversation',
  ): Promise<IMediaFile> {
    // Validate MIME type via magic bytes, not just Content-Type header
    const detectedMime = this.detectMimeType(file.buffer, file.originalname);
    const effectiveMime = detectedMime || file.mimetype;
    const category = getFileCategory(effectiveMime);
    const sizeLimit = SIZE_LIMITS[category];

    // Block dangerous file types
    const blockedExtensions = ['.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.js', '.wsh', '.ps1', '.html', '.htm', '.svg', '.xml'];
    const fileExt = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
    if (blockedExtensions.includes(fileExt)) {
      throw new BadRequestException(`File type ${fileExt} is not allowed`);
    }

    if (file.size > sizeLimit) {
      throw new BadRequestException(`File size exceeds ${Math.floor(sizeLimit / (1024 * 1024))}MB limit for ${category} files`);
    }

    // Derive file extension from detected MIME type when possible, falling back to user input
    const MIME_TO_EXT: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/webm': 'webm',
      'application/pdf': 'pdf',
    };
    const ext = MIME_TO_EXT[detectedMime] || file.originalname.split('.').pop() || 'bin';

    // Generate unique storage key
    const storageKey = `${organizationId}/${uuidv4()}.${ext}`;

    // Upload to S3/MinIO
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: effectiveMime,
        Metadata: {
          'original-name': file.originalname.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 255),
          'uploaded-by': uploadedBy,
        },
      }));
    } catch (err) {
      this.logger.error(`S3 upload failed: ${err.message}`);
      throw new BadRequestException('File upload failed');
    }

    // Create media file record
    const mediaFile = new this.mediaFileModel({
      organizationId,
      uploadedBy,
      conversationId: conversationId || null,
      messageId: messageId || null,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageKey,
      storageUrl: `${this.endpoint}/${this.bucket}/${storageKey}`,
      processing: { status: 'pending' },
      accessLevel,
      scanStatus: 'pending',
    });

    await mediaFile.save();
    this.logger.log(`File uploaded: ${file.originalname} (${storageKey}) by ${uploadedBy}`);

    // Trigger async processing (non-blocking)
    // TODO MS-008: If triggerProcessing fails early (e.g. before setting status to 'processing'),
    // files can get stuck in 'pending' forever. Consider a periodic job that resets or retries
    // files stuck in 'pending'/'processing' status for more than N minutes.
    this.triggerProcessing(mediaFile._id.toString(), category).catch(err => {
      this.logger.warn(`Processing trigger failed for ${mediaFile._id}: ${err.message}`);
    });

    return mediaFile;
  }

  async getPresignedUploadUrl(organizationId: string, fileName: string, contentType: string): Promise<{ uploadUrl: string; storageKey: string }> {
    const ext = fileName.split('.').pop() || 'bin';
    const storageKey = `${organizationId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { uploadUrl, storageKey };
  }

  async getPresignedDownloadUrl(storageKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  private async triggerProcessing(fileId: string, category: string): Promise<void> {
    // Mark as processing
    await this.mediaFileModel.findByIdAndUpdate(fileId, {
      'processing.status': 'processing',
    });

    try {
      const mediaFile = await this.mediaFileModel.findById(fileId);
      if (!mediaFile) {
        this.logger.error(`Media file ${fileId} not found for processing`);
        return;
      }

      if (category === 'image') {
        // Fetch the original file from S3 for image processing
        const getCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: mediaFile.storageKey,
        });
        const response = await this.s3Client.send(getCommand);
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Size guard: skip processing for images larger than 30MB to prevent excessive memory usage
        if (buffer.length > 30 * 1024 * 1024) {
          this.logger.warn(`Image too large for processing (${buffer.length} bytes), skipping: ${fileId}`);
          await this.mediaFileModel.findByIdAndUpdate(fileId, {
            'processing.status': 'complete',
            'processing.error': 'Image too large for processing',
          });
          return;
        }

        await this.imageProcessor.processImage(fileId, buffer, mediaFile.storageKey);
      } else if (category === 'video') {
        // Video processing requires a file on disk — stream from S3 directly to temp file
        // to avoid loading the entire video into memory (prevents 100MB+ heap usage)
        const getCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: mediaFile.storageKey,
        });
        const response = await this.s3Client.send(getCommand);

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-upload-'));
        const ext = mediaFile.originalName.split('.').pop() || 'mp4';
        const tmpFile = path.join(tmpDir, `input.${ext}`);

        try {
          const writeStream = fs.createWriteStream(tmpFile);
          await pipeline(response.Body as any, writeStream);
          await this.videoProcessor.processVideo(fileId, tmpFile, mediaFile.storageKey);
        } finally {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {
            this.logger.warn(`Failed to clean up temp dir: ${tmpDir}`);
          }
        }
      } else if (category === 'document') {
        // MS-005: Process documents (PDF page count, preview generation)
        const getCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: mediaFile.storageKey,
        });
        const response = await this.s3Client.send(getCommand);

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-doc-'));
        const ext = mediaFile.originalName.split('.').pop() || 'pdf';
        const tmpFile = path.join(tmpDir, `input.${ext}`);

        try {
          const writeStream = fs.createWriteStream(tmpFile);
          await pipeline(response.Body as any, writeStream);
          await this.documentProcessor.processDocument(fileId, tmpFile, mediaFile.mimeType, mediaFile.storageKey);
        } finally {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {
            this.logger.warn(`Failed to clean up temp dir: ${tmpDir}`);
          }
        }
      } else {
        // No processing needed for other file types — mark as complete
        await this.mediaFileModel.findByIdAndUpdate(fileId, {
          'processing.status': 'complete',
          scanStatus: 'not_scanned',
        });
      }

      // Update scan status for processed files
      if (category === 'image' || category === 'video' || category === 'document') {
        const updated = await this.mediaFileModel.findById(fileId);
        if (updated && updated.processing.status === 'complete') {
          await this.mediaFileModel.findByIdAndUpdate(fileId, {
            scanStatus: 'not_scanned',
          });
        }
      }
    } catch (err) {
      this.logger.error(`Processing failed for ${fileId}: ${err.message}`);
      await this.mediaFileModel.findByIdAndUpdate(fileId, {
        'processing.status': 'failed',
        'processing.error': err.message,
      });
    }
  }
}
