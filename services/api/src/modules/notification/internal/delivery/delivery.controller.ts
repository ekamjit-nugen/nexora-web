import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';

@Controller('notifications')
@UseGuards(InternalServiceGuard)
export class DeliveryController {
  private readonly logger = new Logger(DeliveryController.name);

  constructor(private deliveryService: DeliveryService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendNotification(@Body() body: { userId: string; organizationId: string; type: string; title: string; body: string; data?: Record<string, string>; priority?: string }) {
    await this.deliveryService.deliver({
      userId: body.userId,
      organizationId: body.organizationId,
      type: body.type,
      title: body.title,
      body: body.body,
      data: body.data,
      priority: (body.priority as any) || 'normal',
    });
    return { success: true, message: 'Notification sent' };
  }

  @Post('send-bulk')
  @HttpCode(HttpStatus.OK)
  async sendBulkNotification(@Body() body: { userIds: string[]; organizationId: string; type: string; title: string; body: string; data?: Record<string, string> }) {
    await this.deliveryService.deliverToMany(body.userIds, {
      organizationId: body.organizationId,
      type: body.type,
      title: body.title,
      body: body.body,
      data: body.data,
    });
    return { success: true, message: 'Bulk notification sent' };
  }
}
