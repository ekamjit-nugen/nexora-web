import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAssetPreview } from '../schemas/asset-preview.schema';

export interface AssetInput {
  taskId: string;
  url: string;
  name: string;
  type: 'image' | 'video' | 'figma' | 'document' | 'other';
  size: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class AssetPreviewService {
  constructor(
    @InjectModel('AssetPreview', 'nexora_projects') private assetPreviewModel: Model<IAssetPreview>,
  ) {}

  // ── Asset Upload ──

  async uploadAsset(
    projectId: string,
    uploadedBy: string,
    input: AssetInput,
  ): Promise<IAssetPreview> {
    if (!input.url || !input.name) {
      throw new BadRequestException('URL and name are required');
    }

    const asset = new this.assetPreviewModel({
      projectId,
      taskId: input.taskId,
      uploadedBy,
      url: input.url,
      name: input.name,
      type: input.type,
      size: input.size,
      thumbnailUrl: input.thumbnailUrl,
      width: input.width,
      height: input.height,
      format: input.format,
      duration: input.duration,
      metadata: input.metadata || {},
    });

    await asset.save();
    return asset;
  }

  async getTaskAssets(
    projectId: string,
    taskId: string,
    filters?: {
      type?: string;
      limit?: number;
      skip?: number;
    },
  ): Promise<{
    total: number;
    assets: IAssetPreview[];
  }> {
    const query: any = { projectId, taskId };

    if (filters?.type) {
      query.type = filters.type;
    }

    const total = await this.assetPreviewModel.countDocuments(query);
    const assets = await this.assetPreviewModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 50)
      .skip(filters?.skip || 0)
      .exec();

    return { total, assets };
  }

  async getAsset(projectId: string, assetId: string): Promise<IAssetPreview> {
    const asset = await this.assetPreviewModel.findOne({
      _id: assetId,
      projectId,
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async getProjectAssets(
    projectId: string,
    filters?: {
      type?: string;
      uploadedBy?: string;
      limit?: number;
      skip?: number;
    },
  ): Promise<{
    total: number;
    assets: IAssetPreview[];
  }> {
    const query: any = { projectId };

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.uploadedBy) {
      query.uploadedBy = filters.uploadedBy;
    }

    const total = await this.assetPreviewModel.countDocuments(query);
    const assets = await this.assetPreviewModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 100)
      .skip(filters?.skip || 0)
      .exec();

    return { total, assets };
  }

  // ── Asset Management ──

  async updateAsset(
    projectId: string,
    assetId: string,
    updates: Partial<AssetInput>,
  ): Promise<IAssetPreview> {
    const asset = await this.assetPreviewModel.findOneAndUpdate(
      { _id: assetId, projectId },
      {
        $set: {
          name: updates.name,
          thumbnailUrl: updates.thumbnailUrl,
          width: updates.width,
          height: updates.height,
          format: updates.format,
          duration: updates.duration,
          metadata: updates.metadata,
        },
      },
      { new: true },
    );

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async deleteAsset(projectId: string, assetId: string): Promise<void> {
    const result = await this.assetPreviewModel.deleteOne({
      _id: assetId,
      projectId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Asset not found');
    }
  }

  async deleteTaskAssets(projectId: string, taskId: string): Promise<number> {
    const result = await this.assetPreviewModel.deleteMany({
      projectId,
      taskId,
    });

    return result.deletedCount;
  }

  // ── Asset Analytics ──

  async getAssetStats(projectId: string) {
    const total = await this.assetPreviewModel.countDocuments({ projectId });

    const byType = await this.assetPreviewModel.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const totalSize = await this.assetPreviewModel.aggregate([
      { $match: { projectId } },
      { $group: { _id: null, totalBytes: { $sum: '$size' } } },
    ]);

    const byUploader = await this.assetPreviewModel.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$uploadedBy', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return {
      total,
      byType: Object.fromEntries(byType.map((item) => [item._id, item.count])),
      totalSizeBytes: totalSize[0]?.totalBytes || 0,
      topUploaders: byUploader,
    };
  }

  async getRecentAssets(projectId: string, limit: number = 10) {
    return this.assetPreviewModel
      .find({ projectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // ── Thumbnail Generation Helper ──

  async processThumbnail(
    projectId: string,
    assetId: string,
    thumbnailUrl: string,
    width?: number,
    height?: number,
  ): Promise<IAssetPreview> {
    const asset = await this.assetPreviewModel.findOneAndUpdate(
      { _id: assetId, projectId },
      {
        $set: {
          thumbnailUrl,
          width,
          height,
        },
      },
      { new: true },
    );

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }
}
