import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AssetPreviewService } from '../services/asset-preview.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UploadAssetDto, AssetPreviewResponseDto } from '../dto/wave4.dto';

@Controller('projects/:projectId/assets')
@UseGuards(JwtAuthGuard)
export class AssetPreviewController {
  private readonly logger = new Logger(AssetPreviewController.name);

  constructor(private assetPreviewService: AssetPreviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async uploadAsset(
    @Param('projectId') projectId: string,
    @Body() dto: UploadAssetDto,
    @Req() req,
  ) {
    const asset = await this.assetPreviewService.uploadAsset(
      projectId,
      req.user.userId,
      {
        taskId: dto.taskId,
        url: dto.url,
        name: dto.name,
        type: dto.type,
        size: dto.size,
        thumbnailUrl: dto.thumbnailUrl,
        width: dto.width,
        height: dto.height,
        format: dto.format,
        duration: dto.duration,
      },
    );

    return {
      success: true,
      message: 'Asset uploaded successfully',
      data: asset,
    };
  }

  @Get('task/:taskId')
  async getTaskAssets(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const result = await this.assetPreviewService.getTaskAssets(projectId, taskId, {
      type,
      limit: limit ? parseInt(limit) : 50,
      skip: skip ? parseInt(skip) : 0,
    });

    return {
      success: true,
      message: 'Task assets retrieved',
      data: result.assets,
      total: result.total,
    };
  }

  @Get()
  async getProjectAssets(
    @Param('projectId') projectId: string,
    @Query('type') type?: string,
    @Query('uploadedBy') uploadedBy?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const result = await this.assetPreviewService.getProjectAssets(projectId, {
      type,
      uploadedBy,
      limit: limit ? parseInt(limit) : 100,
      skip: skip ? parseInt(skip) : 0,
    });

    return {
      success: true,
      message: 'Project assets retrieved',
      data: result.assets,
      total: result.total,
    };
  }

  @Get(':assetId')
  async getAsset(
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
  ) {
    const asset = await this.assetPreviewService.getAsset(projectId, assetId);

    return {
      success: true,
      message: 'Asset retrieved',
      data: asset,
    };
  }

  @Put(':assetId')
  async updateAsset(
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
    @Body() dto: Partial<UploadAssetDto>,
  ) {
    const asset = await this.assetPreviewService.updateAsset(projectId, assetId, dto);

    return {
      success: true,
      message: 'Asset updated',
      data: asset,
    };
  }

  @Delete(':assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAsset(
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
  ) {
    await this.assetPreviewService.deleteAsset(projectId, assetId);

    return {
      success: true,
      message: 'Asset deleted',
    };
  }

  @Delete('task/:taskId')
  @HttpCode(HttpStatus.OK)
  async deleteTaskAssets(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    const count = await this.assetPreviewService.deleteTaskAssets(projectId, taskId);

    return {
      success: true,
      message: 'Task assets deleted',
      deletedCount: count,
    };
  }

  @Get('stats')
  async getAssetStats(@Param('projectId') projectId: string) {
    const stats = await this.assetPreviewService.getAssetStats(projectId);

    return {
      success: true,
      message: 'Asset statistics retrieved',
      data: stats,
    };
  }

  @Get('recent')
  async getRecentAssets(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
  ) {
    const assets = await this.assetPreviewService.getRecentAssets(
      projectId,
      limit ? parseInt(limit) : 10,
    );

    return {
      success: true,
      message: 'Recent assets retrieved',
      data: assets,
    };
  }
}
