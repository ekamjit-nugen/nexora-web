import { Controller, Get, Delete, Param, Query, Req, HttpCode, HttpStatus, HttpException, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private deliveryService: DeliveryService) {}

  @Get('files/:id')
  async getFile(@Param('id') id: string) {
    const file = await this.deliveryService.getFile(id);
    return { success: true, data: file };
  }

  @Get('files/:id/download')
  async getDownloadUrl(@Param('id') id: string) {
    const url = await this.deliveryService.getDownloadUrl(id);
    return { success: true, data: { url } };
  }

  @Get('files/:id/preview')
  async getPreviewUrl(@Param('id') id: string) {
    const url = await this.deliveryService.getPreviewUrl(id);
    return { success: true, data: { url } };
  }

  @Get('files/:id/thumbnail')
  async getThumbnailUrl(@Param('id') id: string) {
    const url = await this.deliveryService.getThumbnailUrl(id);
    return { success: true, data: { url } };
  }

  @Get('conversations/:conversationId/files')
  async getFilesByConversation(
    @Param('conversationId') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const result = await this.deliveryService.getFilesByConversation(
      conversationId, parseInt(page || '1'), parseInt(limit || '50'), type,
    );
    return { success: true, data: result.data, pagination: result.pagination };
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.OK)
  async deleteFile(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId;
    if (!userId) throw new HttpException('Authentication required', 401);
    await this.deliveryService.deleteFile(id, userId);
    return { success: true, message: 'File deleted' };
  }
}
