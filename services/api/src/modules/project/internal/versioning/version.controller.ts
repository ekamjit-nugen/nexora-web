import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { VersionService } from './version.service';

@Controller('api/v1/versions')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  /**
   * Create version snapshot
   */
  @Post()
  async createVersion(@Body() body: any) {
    return this.versionService.createVersion(
      body.productId,
      body.userId,
      {
        snapshotData: body.snapshotData,
        action: body.action,
        changeDescription: body.changeDescription,
        tags: body.tags,
        metadata: body.metadata,
      },
    );
  }

  /**
   * Get version
   */
  @Get(':versionId')
  async getVersion(@Param('versionId') versionId: string) {
    return this.versionService.getVersion(versionId);
  }

  /**
   * Get all product versions
   */
  @Get('product/:productId/all')
  async getProductVersions(@Param('productId') productId: string) {
    return this.versionService.getProductVersions(productId);
  }

  /**
   * Get version at specific time (time-travel)
   */
  @Get('product/:productId/at-time')
  async getVersionAtTime(
    @Param('productId') productId: string,
    @Query('timestamp') timestamp: string,
  ) {
    return this.versionService.getVersionAtTime(productId, new Date(timestamp));
  }

  /**
   * Restore to specific version
   */
  @Post(':versionId/restore')
  async restoreToVersion(
    @Param('versionId') versionId: string,
    @Body() body: any,
  ) {
    return this.versionService.restoreToVersion(
      body.productId,
      versionId,
      body.userId,
    );
  }

  /**
   * Compare two versions
   */
  @Get('compare')
  async compareVersions(
    @Query('versionId1') versionId1: string,
    @Query('versionId2') versionId2: string,
  ) {
    return this.versionService.compareVersions(versionId1, versionId2);
  }

  /**
   * Get version history
   */
  @Get('product/:productId/history')
  async getVersionHistory(@Param('productId') productId: string) {
    return this.versionService.getVersionHistory(productId);
  }

  /**
   * Publish version
   */
  @Post(':versionId/publish')
  async publishVersion(@Param('versionId') versionId: string) {
    return this.versionService.publishVersion(versionId);
  }

  /**
   * Tag version
   */
  @Post(':versionId/tags/:tag')
  async tagVersion(
    @Param('versionId') versionId: string,
    @Param('tag') tag: string,
  ) {
    return this.versionService.tagVersion(versionId, tag);
  }

  /**
   * Get versions by tag
   */
  @Get('product/:productId/tags/:tag')
  async getVersionsByTag(
    @Param('productId') productId: string,
    @Param('tag') tag: string,
  ) {
    return this.versionService.getVersionsByTag(productId, tag);
  }

  /**
   * Get diff timeline
   */
  @Get('product/:productId/timeline')
  async getDiffTimeline(
    @Param('productId') productId: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.versionService.getDiffTimeline(productId, limit);
  }

  /**
   * Prune old versions
   */
  @Delete('product/:productId/prune')
  async pruneOldVersions(
    @Param('productId') productId: string,
    @Query('keepCount') keepCount: number = 50,
  ) {
    const deletedCount = await this.versionService.pruneOldVersions(productId, keepCount);
    return { deletedCount, success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'versioning' };
  }
}
