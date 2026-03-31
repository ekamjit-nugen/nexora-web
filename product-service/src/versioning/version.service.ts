import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProductVersion, IVersionHistory, IVersionSnapshot } from './version.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VersionService {
  constructor(
    @InjectModel('ProductVersion') private versionModel: Model<IProductVersion>,
    @InjectModel('VersionHistory') private historyModel: Model<IVersionHistory>,
  ) {}

  /**
   * Create version snapshot
   */
  async createVersion(
    productId: string,
    userId: string,
    versionData: {
      snapshotData: Record<string, any>;
      action: 'create' | 'update' | 'delete' | 'merge' | 'restore';
      changeDescription: string;
      tags?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<IProductVersion> {
    const versionId = uuidv4();

    // Get current version count
    const history = await this.historyModel.findOne({ productId });
    const versionNumber = (history?.totalVersions || 0) + 1;

    const version = new this.versionModel({
      productId,
      versionId,
      versionNumber,
      snapshotData: versionData.snapshotData,
      createdBy: userId,
      changedAt: new Date(),
      action: versionData.action,
      changeDescription: versionData.changeDescription,
      isPublished: false,
      tags: versionData.tags || [],
    });

    const savedVersion = await version.save();

    // Update history
    await this.updateHistory(productId, versionId, userId, versionData.action, versionData.snapshotData);

    return savedVersion;
  }

  /**
   * Update version history
   */
  private async updateHistory(
    productId: string,
    versionId: string,
    userId: string,
    action: string,
    changes: Record<string, any>,
  ): Promise<void> {
    let history = await this.historyModel.findOne({ productId });

    if (!history) {
      history = new this.historyModel({
        productId,
        totalVersions: 1,
        currentVersion: versionId,
        snapshots: [],
      });
    }

    const snapshot: IVersionSnapshot = {
      versionId,
      timestamp: new Date(),
      productId,
      userId,
      action: action as any,
      changes,
      changesSummary: `${action} by user ${userId}`,
      previousVersion: history.currentVersion,
      metadata: { createdAt: new Date() },
    };

    history.snapshots.push(snapshot);
    history.totalVersions += 1;
    history.currentVersion = versionId;

    await history.save();
  }

  /**
   * Get version by ID
   */
  async getVersion(versionId: string): Promise<IProductVersion> {
    const version = await this.versionModel.findOne({ versionId });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    return version;
  }

  /**
   * Get all versions for product
   */
  async getProductVersions(productId: string): Promise<IProductVersion[]> {
    return this.versionModel
      .find({ productId })
      .sort({ versionNumber: -1 })
      .exec();
  }

  /**
   * Get version at specific timestamp (time-travel)
   */
  async getVersionAtTime(productId: string, timestamp: Date): Promise<IProductVersion | null> {
    return this.versionModel
      .findOne({
        productId,
        createdAt: { $lte: timestamp },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Restore to specific version
   */
  async restoreToVersion(
    productId: string,
    versionId: string,
    userId: string,
  ): Promise<IProductVersion> {
    const targetVersion = await this.getVersion(versionId);

    if (targetVersion.productId !== productId) {
      throw new BadRequestException('Version does not belong to this product');
    }

    // Create new version with restored data
    return this.createVersion(
      productId,
      userId,
      {
        snapshotData: targetVersion.snapshotData,
        action: 'restore',
        changeDescription: `Restored to version ${targetVersion.versionNumber}`,
        metadata: { restoredFromVersion: versionId },
      },
    );
  }

  /**
   * Compare two versions
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<any> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);

    const changes = this.calculateDifferences(
      version1.snapshotData,
      version2.snapshotData,
    );

    return {
      version1: {
        versionId: version1.versionId,
        versionNumber: version1.versionNumber,
        createdAt: version1.createdAt,
      },
      version2: {
        versionId: version2.versionId,
        versionNumber: version2.versionNumber,
        createdAt: version2.createdAt,
      },
      differences: changes,
      summary: this.summarizeChanges(changes),
    };
  }

  /**
   * Calculate differences between two objects
   */
  private calculateDifferences(obj1: any, obj2: any): Record<string, any> {
    const differences: Record<string, any> = {
      added: {},
      removed: {},
      modified: {},
    };

    // Find added and modified
    for (const key in obj2) {
      if (!(key in obj1)) {
        differences.added[key] = obj2[key];
      } else if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        differences.modified[key] = {
          old: obj1[key],
          new: obj2[key],
        };
      }
    }

    // Find removed
    for (const key in obj1) {
      if (!(key in obj2)) {
        differences.removed[key] = obj1[key];
      }
    }

    return differences;
  }

  /**
   * Summarize changes
   */
  private summarizeChanges(changes: Record<string, any>): string {
    const addedCount = Object.keys(changes.added).length;
    const removedCount = Object.keys(changes.removed).length;
    const modifiedCount = Object.keys(changes.modified).length;

    return `Added: ${addedCount}, Removed: ${removedCount}, Modified: ${modifiedCount}`;
  }

  /**
   * Get version history
   */
  async getVersionHistory(productId: string): Promise<IVersionHistory | null> {
    return this.historyModel.findOne({ productId });
  }

  /**
   * Publish version
   */
  async publishVersion(versionId: string): Promise<IProductVersion> {
    const version = await this.getVersion(versionId);
    version.isPublished = true;
    return version.save();
  }

  /**
   * Tag version
   */
  async tagVersion(versionId: string, tag: string): Promise<IProductVersion> {
    const version = await this.getVersion(versionId);

    if (version.tags.includes(tag)) {
      throw new BadRequestException('Tag already exists');
    }

    version.tags.push(tag);
    return version.save();
  }

  /**
   * Get versions by tag
   */
  async getVersionsByTag(productId: string, tag: string): Promise<IProductVersion[]> {
    return this.versionModel.find({ productId, tags: tag }).exec();
  }

  /**
   * Get diff timeline
   */
  async getDiffTimeline(productId: string, limit: number = 10): Promise<any[]> {
    const versions = await this.versionModel
      .find({ productId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return versions.map((v, index) => ({
      versionNumber: v.versionNumber,
      versionId: v.versionId,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      action: v.action,
      changeDescription: v.changeDescription,
      summary: `Version ${v.versionNumber} - ${v.action}`,
    }));
  }

  /**
   * Prune old versions
   */
  async pruneOldVersions(productId: string, keepCount: number = 50): Promise<number> {
    const versions = await this.versionModel
      .find({ productId })
      .sort({ versionNumber: -1 })
      .exec();

    if (versions.length <= keepCount) {
      return 0;
    }

    const versionsToDelete = versions.slice(keepCount);
    const deleteCount = versionsToDelete.length;

    for (const version of versionsToDelete) {
      await this.versionModel.deleteOne({ _id: version._id });
    }

    return deleteCount;
  }
}
