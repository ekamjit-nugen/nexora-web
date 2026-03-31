import {
  Controller, Get, Put, Delete,
  Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private notificationService: NotificationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getNotifications(
    @Query('limit') limit: string,
    @Query('skip') skip: string,
    @Req() req,
  ) {
    const result = await this.notificationService.getUserNotifications(
      req.user.userId,
      req.user?.organizationId,
      parseInt(limit) || 50,
      parseInt(skip) || 0,
    );
    return {
      success: true,
      message: 'Notifications retrieved',
      data: result.data,
      total: result.total,
      unread: result.unread,
    };
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: string, @Req() req) {
    const notification = await this.notificationService.markAsRead(
      id,
      req.user.userId,
      req.user?.organizationId,
    );
    return {
      success: true,
      message: 'Notification marked as read',
      data: notification,
    };
  }

  @Put('read/all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Req() req) {
    await this.notificationService.markAllAsRead(
      req.user.userId,
      req.user?.organizationId,
    );
    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteNotification(@Param('id') id: string, @Req() req) {
    await this.notificationService.deleteNotification(
      id,
      req.user.userId,
      req.user?.organizationId,
    );
    return {
      success: true,
      message: 'Notification deleted',
    };
  }
}
