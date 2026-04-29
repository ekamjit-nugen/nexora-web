import {
  BadRequestException, Body, Controller, Delete, Get, Logger,
  Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, Roles } from '../../../bootstrap/auth/jwt-auth.guard';
import { StorageService } from './storage.service';

/**
 * Storage HTTP API.
 *
 *   GET    /api/v1/storage/quota              quota + usage for current org
 *   GET    /api/v1/storage/files              list files (folder, page)
 *   POST   /api/v1/storage/files              multipart upload (passthrough)
 *   POST   /api/v1/storage/files/presigned    request a direct-upload URL
 *   POST   /api/v1/storage/files/:id/finalize re-stat after direct upload
 *   GET    /api/v1/storage/files/:id/download return a pre-signed GET URL
 *   DELETE /api/v1/storage/files/:id          delete (soft + s3 hard)
 *
 *   PUT    /api/v1/storage/quota              admin-only quota set
 */
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  private readonly log = new Logger(StorageController.name);

  constructor(private readonly storage: StorageService) {}

  @Get('quota')
  async getQuota(@Req() req: any) {
    return this.storage.getQuota(req.user.organizationId);
  }

  @Roles('admin', 'super_admin')
  @Post('quota')
  async setQuota(@Req() req: any, @Body() body: { quotaGb: number }) {
    if (typeof body?.quotaGb !== 'number') {
      throw new BadRequestException('quotaGb required');
    }
    await this.storage.setQuotaGb(req.user.organizationId, body.quotaGb);
    return { ok: true };
  }

  @Get('files')
  async list(
    @Req() req: any,
    @Query('folderPath') folderPath?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storage.listFiles(
      req.user.organizationId,
      folderPath || '/',
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post('files')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body() body: { folderPath?: string; tags?: string },
  ) {
    if (!file) throw new BadRequestException('file is required');
    const tags = body?.tags
      ? body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    return this.storage.uploadFile({
      organizationId: req.user.organizationId,
      userId: req.user.userId,
      userDisplayName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' '),
      name: file.originalname,
      folderPath: body?.folderPath,
      contentType: file.mimetype,
      body: file.buffer,
      tags,
    });
  }

  @Post('files/presigned')
  async presigned(
    @Req() req: any,
    @Body() body: {
      name: string; sizeBytes: number; contentType?: string;
      folderPath?: string; tags?: string[];
    },
  ) {
    return this.storage.getPresignedUpload({
      organizationId: req.user.organizationId,
      userId: req.user.userId,
      userDisplayName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' '),
      name: body.name,
      sizeBytes: body.sizeBytes,
      contentType: body.contentType,
      folderPath: body.folderPath,
      tags: body.tags,
    });
  }

  @Post('files/:id/finalize')
  async finalize(@Req() req: any, @Param('id') id: string) {
    return this.storage.finalizeUpload(req.user.organizationId, id);
  }

  @Get('files/:id/download')
  async download(@Req() req: any, @Param('id') id: string) {
    return this.storage.getDownloadUrl(req.user.organizationId, id);
  }

  @Delete('files/:id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.storage.deleteFile(req.user.organizationId, id);
    return { deleted: true };
  }
}
