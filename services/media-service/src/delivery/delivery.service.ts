import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMediaFile } from '../schemas/media-file.schema';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectModel('MediaFile') private mediaFileModel: Model<IMediaFile>,
    private uploadService: UploadService,
  ) {}

  async getFile(fileId: string): Promise<IMediaFile> {
    const file = await this.mediaFileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async getFilesByConversation(conversationId: string, page: number = 1, limit: number = 50, mimeFilter?: string) {
    const query: any = { conversationId, isDeleted: false };
    if (mimeFilter) {
      // MS-004: Escape regex metacharacters to prevent ReDoS / injection
      const escaped = mimeFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.mimeType = { $regex: `^${escaped}` };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.mediaFileModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.mediaFileModel.countDocuments(query),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    const file = await this.getFile(fileId);
    return this.uploadService.getPresignedDownloadUrl(file.storageKey);
  }

  async getPreviewUrl(fileId: string): Promise<string | null> {
    const file = await this.getFile(fileId);
    if (!file.processing?.preview?.storageKey) return null;
    return this.uploadService.getPresignedDownloadUrl(file.processing.preview.storageKey);
  }

  async getThumbnailUrl(fileId: string): Promise<string | null> {
    const file = await this.getFile(fileId);
    if (!file.processing?.thumbnail?.storageKey) return null;
    return this.uploadService.getPresignedDownloadUrl(file.processing.thumbnail.storageKey);
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFile(fileId);
    if (file.uploadedBy !== userId) throw new NotFoundException('Not authorized');
    await this.mediaFileModel.findByIdAndUpdate(fileId, { isDeleted: true });
    this.logger.log(`File soft-deleted: ${fileId} by ${userId}`);
  }
}
