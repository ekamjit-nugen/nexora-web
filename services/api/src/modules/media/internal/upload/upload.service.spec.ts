import { BadRequestException } from '@nestjs/common';

// We need to test UploadService which has constructor-time S3 validation,
// so we set env vars before importing
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_ACCESS_KEY = 'test-access';
process.env.S3_SECRET_KEY = 'test-secret';

// Mock S3Client before importing UploadService
const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((params: any) => params),
  GetObjectCommand: jest.fn().mockImplementation((params: any) => params),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url/test'),
}));

import { UploadService } from './upload.service';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function buildMockMediaFileModel() {
  const mockInstance = {
    _id: { toString: () => 'file-id-123' },
    organizationId: 'org-1',
    save: jest.fn().mockResolvedValue(undefined),
    processing: { status: 'pending' },
    storageKey: 'org-1/uuid.jpg',
    originalName: 'photo.jpg',
    mimeType: 'image/jpeg',
  };

  const model: any = jest.fn().mockImplementation(() => mockInstance);
  model.findByIdAndUpdate = jest.fn().mockResolvedValue(mockInstance);
  model.findById = jest.fn().mockResolvedValue(mockInstance);
  model._mockInstance = mockInstance;

  return model;
}

function buildMockImageProcessor() {
  return { processImage: jest.fn().mockResolvedValue(undefined) } as any;
}

function buildMockVideoProcessor() {
  return { processVideo: jest.fn().mockResolvedValue(undefined) } as any;
}

function buildMockDocumentProcessor() {
  return { processDocument: jest.fn().mockResolvedValue(undefined) } as any;
}

function createMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UploadService', () => {
  let service: UploadService;
  let mediaFileModel: any;
  let imageProcessor: any;
  let videoProcessor: any;
  let documentProcessor: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mediaFileModel = buildMockMediaFileModel();
    imageProcessor = buildMockImageProcessor();
    videoProcessor = buildMockVideoProcessor();
    documentProcessor = buildMockDocumentProcessor();
    service = new UploadService(mediaFileModel, imageProcessor, videoProcessor, documentProcessor);
  });

  // ── detectMimeType ────────────────────────────────────────────────────────

  describe('detectMimeType', () => {
    // Access private method via any cast
    let detect: (buffer: Buffer, filename: string) => string | null;

    beforeEach(() => {
      detect = (service as any).detectMimeType.bind(service);
    });

    it('should detect JPEG files', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      expect(detect(buf, 'test.jpg')).toBe('image/jpeg');
    });

    it('should detect PNG files', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(detect(buf, 'test.png')).toBe('image/png');
    });

    it('should detect GIF files', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      expect(detect(buf, 'test.gif')).toBe('image/gif');
    });

    it('should detect PDF files', () => {
      const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      expect(detect(buf, 'test.pdf')).toBe('application/pdf');
    });

    it('should throw BadRequestException for PE executables', () => {
      const buf = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      expect(() => detect(buf, 'malware.jpg')).toThrow(BadRequestException);
    });

    it('should return null for unknown file types', () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      expect(detect(buf, 'unknown.bin')).toBeNull();
    });

    it('should return null for buffer shorter than 8 bytes', () => {
      const buf = Buffer.from([0xFF, 0xD8]);
      expect(detect(buf, 'short.dat')).toBeNull();
    });

    it('should return null for empty buffer', () => {
      expect(detect(Buffer.alloc(0), 'empty.dat')).toBeNull();
    });
  });

  // ── blocked extensions ────────────────────────────────────────────────────

  describe('blocked extensions', () => {
    it('should reject .exe files', async () => {
      const file = createMulterFile({ originalname: 'payload.exe', mimetype: 'application/octet-stream' });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).rejects.toThrow(BadRequestException);
    });

    it('should reject .bat files', async () => {
      const file = createMulterFile({ originalname: 'script.bat', mimetype: 'application/bat' });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).rejects.toThrow(BadRequestException);
    });

    it('should reject .html files', async () => {
      const file = createMulterFile({ originalname: 'page.html', mimetype: 'text/html' });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).rejects.toThrow(BadRequestException);
    });

    it('should reject .svg files', async () => {
      const file = createMulterFile({ originalname: 'image.svg', mimetype: 'image/svg+xml' });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).rejects.toThrow(BadRequestException);
    });

    it('should allow .jpg files', async () => {
      mockS3Send.mockResolvedValue({});
      const file = createMulterFile({ originalname: 'photo.jpg' });
      // Should not throw for extension check (may proceed to upload)
      await expect(service.uploadFile(file, 'org-1', 'user-a')).resolves.toBeDefined();
    });

    it('should allow .pdf files', async () => {
      mockS3Send.mockResolvedValue({});
      const file = createMulterFile({
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]),
      });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).resolves.toBeDefined();
    });
  });

  // ── file size limits ──────────────────────────────────────────────────────

  describe('file size limits', () => {
    it('should reject images exceeding 25MB', async () => {
      const file = createMulterFile({
        originalname: 'huge.jpg',
        mimetype: 'image/jpeg',
        size: 26 * 1024 * 1024,
      });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).rejects.toThrow(/25MB/);
    });

    it('should allow images under 25MB', async () => {
      mockS3Send.mockResolvedValue({});
      const file = createMulterFile({
        originalname: 'normal.jpg',
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024,
      });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).resolves.toBeDefined();
    });

    it('should reject videos exceeding 100MB', async () => {
      const file = createMulterFile({
        originalname: 'huge.mp4',
        mimetype: 'video/mp4',
        size: 101 * 1024 * 1024,
        buffer: Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70]),
      });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).rejects.toThrow(/100MB/);
    });

    it('should reject audio exceeding 50MB', async () => {
      const file = createMulterFile({
        originalname: 'huge.mp3',
        mimetype: 'audio/mpeg',
        size: 51 * 1024 * 1024,
        buffer: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]), // unknown magic
      });
      await expect(service.uploadFile(file, 'org-1', 'user-a')).rejects.toThrow(/50MB/);
    });
  });

  // ── sanitized originalName ────────────────────────────────────────────────

  describe('sanitized originalName', () => {
    it('should strip control characters from original filename in S3 metadata', async () => {
      mockS3Send.mockResolvedValue({});
      const file = createMulterFile({
        originalname: "photo\x00\x01\x1F.jpg",
      });

      await service.uploadFile(file, 'org-1', 'user-a');

      // Verify the PutObjectCommand was called with sanitized metadata
      const putCall = mockS3Send.mock.calls[0][0];
      expect(putCall.Metadata['original-name']).toBe('photo.jpg');
      expect(putCall.Metadata['original-name']).not.toMatch(/[\x00-\x1F\x7F]/);
    });
  });

  // ── S3 ContentType uses detected MIME ─────────────────────────────────────

  describe('S3 ContentType', () => {
    it('should use detected MIME type instead of user-supplied Content-Type', async () => {
      mockS3Send.mockResolvedValue({});
      const file = createMulterFile({
        originalname: 'photo.jpg',
        mimetype: 'application/octet-stream', // User-supplied wrong type
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]),
      });

      await service.uploadFile(file, 'org-1', 'user-a');

      const putCall = mockS3Send.mock.calls[0][0];
      expect(putCall.ContentType).toBe('image/jpeg');
    });

    it('should fall back to user-supplied MIME when magic bytes unknown', async () => {
      mockS3Send.mockResolvedValue({});
      const file = createMulterFile({
        originalname: 'data.csv',
        mimetype: 'text/csv',
        size: 1024,
        buffer: Buffer.from([0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48]), // "ABCDEFGH"
      });

      await service.uploadFile(file, 'org-1', 'user-a');

      const putCall = mockS3Send.mock.calls[0][0];
      expect(putCall.ContentType).toBe('text/csv');
    });
  });

  // ── triggerProcessing ─────────────────────────────────────────────────────

  describe('triggerProcessing', () => {
    // Access private method
    let triggerProcessing: (fileId: string, category: string) => Promise<void>;

    beforeEach(() => {
      triggerProcessing = (service as any).triggerProcessing.bind(service);
    });

    it('should mark status as "processing" then "complete" for "other" category', async () => {
      mediaFileModel.findById.mockResolvedValue(null); // no file found for image/video/doc
      mediaFileModel.findByIdAndUpdate.mockResolvedValue({});

      await triggerProcessing('file-id-123', 'other');

      // First call sets processing, second sets complete
      expect(mediaFileModel.findByIdAndUpdate).toHaveBeenCalledWith('file-id-123', {
        'processing.status': 'processing',
      });
      expect(mediaFileModel.findByIdAndUpdate).toHaveBeenCalledWith('file-id-123', {
        'processing.status': 'complete',
        scanStatus: 'not_scanned',
      });
    });

    it('should mark status as "failed" when processing throws', async () => {
      const mediaFile = {
        _id: { toString: () => 'file-id-123' },
        storageKey: 'org-1/uuid.jpg',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        processing: { status: 'processing' },
      };
      mediaFileModel.findById.mockResolvedValue(mediaFile);
      mediaFileModel.findByIdAndUpdate.mockResolvedValue({});

      // Mock S3 GetObject to return a readable stream
      mockS3Send.mockResolvedValue({
        Body: (async function* () { yield Buffer.from([0xFF, 0xD8, 0xFF]); })(),
      });

      imageProcessor.processImage.mockRejectedValue(new Error('Sharp failed'));

      await triggerProcessing('file-id-123', 'image');

      expect(mediaFileModel.findByIdAndUpdate).toHaveBeenCalledWith('file-id-123', {
        'processing.status': 'failed',
        'processing.error': 'Sharp failed',
      });
    });

    it('should skip processing for images larger than 30MB', async () => {
      const mediaFile = {
        _id: { toString: () => 'file-id-123' },
        storageKey: 'org-1/uuid.jpg',
        originalName: 'huge.jpg',
        mimeType: 'image/jpeg',
        processing: { status: 'processing' },
      };
      mediaFileModel.findById.mockResolvedValue(mediaFile);
      mediaFileModel.findByIdAndUpdate.mockResolvedValue({});

      // Return a large buffer (> 30MB)
      const bigBuf = Buffer.alloc(31 * 1024 * 1024);
      mockS3Send.mockResolvedValue({
        Body: (async function* () { yield bigBuf; })(),
      });

      await triggerProcessing('file-id-123', 'image');

      // Should mark as complete (not call imageProcessor)
      expect(imageProcessor.processImage).not.toHaveBeenCalled();
      expect(mediaFileModel.findByIdAndUpdate).toHaveBeenCalledWith('file-id-123', {
        'processing.status': 'complete',
        'processing.error': 'Image too large for processing',
      });
    });
  });
});
