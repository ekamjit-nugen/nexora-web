import {
  Controller, Post, Get, Body, Query, UseGuards, Req, HttpCode, HttpStatus,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    // Extract user info from JWT only — never trust headers
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;
    if (!userId) throw new BadRequestException('Authentication required');
    if (!organizationId) throw new BadRequestException('Organization context required');

    const mediaFile = await this.uploadService.uploadFile(
      file, organizationId, userId, dto.conversationId, dto.messageId, dto.accessLevel,
    );

    return {
      success: true,
      message: 'File uploaded successfully',
      data: {
        _id: mediaFile._id,
        originalName: mediaFile.originalName,
        mimeType: mediaFile.mimeType,
        size: mediaFile.size,
        storageUrl: mediaFile.storageUrl,
        storageKey: mediaFile.storageKey,
        processing: mediaFile.processing,
      },
    };
  }

  @Post('upload/presigned')
  @HttpCode(HttpStatus.OK)
  async getPresignedUploadUrl(
    @Body() body: { fileName: string; contentType: string },
    @Req() req: any,
  ) {
    const organizationId = req.user?.organizationId || req.headers['x-organization-id'] || 'default';
    const result = await this.uploadService.getPresignedUploadUrl(
      organizationId, body.fileName, body.contentType,
    );
    return { success: true, data: result };
  }
}
