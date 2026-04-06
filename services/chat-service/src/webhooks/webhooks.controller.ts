import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get('webhooks')
  @Roles('admin', 'owner')
  async getWebhooks(@Req() req) {
    const webhooks = await this.webhooksService.getWebhooks(req.user.organizationId || 'default');
    return { success: true, data: webhooks };
  }

  @Post('webhooks/incoming')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createIncomingWebhook(@Body() body: { conversationId: string; name: string; avatarUrl?: string }, @Req() req) {
    const webhook = await this.webhooksService.createIncomingWebhook(
      req.user.organizationId || 'default', body.conversationId, body.name, req.user.userId, body.avatarUrl,
    );
    return { success: true, message: 'Incoming webhook created', data: webhook };
  }

  @Post('webhooks/outgoing')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createOutgoingWebhook(@Body() body: { conversationId: string; name: string; targetUrl: string; events: string[] }, @Req() req) {
    const webhook = await this.webhooksService.createOutgoingWebhook(
      req.user.organizationId || 'default', body.conversationId, body.name, body.targetUrl, body.events, req.user.userId,
    );
    return { success: true, message: 'Outgoing webhook created', data: webhook };
  }

  @Delete('webhooks/:id')
  @Roles('admin', 'owner')
  async deleteWebhook(@Param('id') id: string) {
    await this.webhooksService.deleteWebhook(id);
    return { success: true, message: 'Webhook deleted' };
  }

  @Post('webhooks/:id/toggle')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async toggleWebhook(@Param('id') id: string) {
    const webhook = await this.webhooksService.toggleWebhook(id);
    return { success: true, data: webhook };
  }
}

/**
 * Public incoming webhook endpoint — no JWT auth but requires HMAC signature.
 * External services POST to /hooks/{webhookId} with X-Nexora-Signature header.
 */
@Controller('hooks')
export class IncomingWebhookController {
  constructor(private webhooksService: WebhooksService) {}

  @Post(':webhookId')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Param('webhookId') webhookId: string,
    @Body() body: { text: string; username?: string; icon_url?: string },
    @Req() req: any,
  ) {
    // Validate HMAC signature if provided
    const signature = req.headers['x-nexora-signature'];
    if (signature) {
      const isValid = await this.webhooksService.verifyIncomingSignature(webhookId, JSON.stringify(body), signature);
      if (!isValid) {
        throw new HttpException('Invalid webhook signature', 401);
      }
    }

    const message = await this.webhooksService.processIncomingWebhook(webhookId, body);
    return { success: true, message: 'Message posted', data: { messageId: message._id } };
  }
}
