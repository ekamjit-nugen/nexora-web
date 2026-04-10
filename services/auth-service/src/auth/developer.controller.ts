import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyService } from './api-key.service';
import { WebhookEndpointService } from './webhook-endpoint.service';

@Controller('developer')
export class DeveloperController {
  private readonly logger = new Logger(DeveloperController.name);

  constructor(
    private apiKeyService: ApiKeyService,
    private webhookEndpointService: WebhookEndpointService,
  ) {}

  // ── API Keys ──

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async createApiKey(@Body() dto: { name: string; scopes: string[]; expiresAt?: string }, @Req() req: any) {
    const result = await this.apiKeyService.createApiKey(
      { name: dto.name, scopes: dto.scopes, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
      req.user.userId,
      req.user.organizationId,
    );
    return {
      success: true,
      message: 'API key created. Copy it now — you will not see it again.',
      data: result,
    };
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async listApiKeys(@Req() req: any) {
    const keys = await this.apiKeyService.listApiKeys(req.user.organizationId);
    return { success: true, data: keys };
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  async revokeApiKey(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    await this.apiKeyService.revokeApiKey(id, body?.reason, req.user.userId, req.user.organizationId);
    return { success: true, message: 'API key revoked' };
  }

  // ── Webhooks ──

  @Post('webhooks')
  @UseGuards(JwtAuthGuard)
  async createWebhook(@Body() dto: { name: string; url: string; events: string[] }, @Req() req: any) {
    const endpoint = await this.webhookEndpointService.createEndpoint(dto, req.user.userId, req.user.organizationId);
    return { success: true, message: 'Webhook endpoint created', data: endpoint };
  }

  @Get('webhooks')
  @UseGuards(JwtAuthGuard)
  async listWebhooks(@Req() req: any) {
    const endpoints = await this.webhookEndpointService.listEndpoints(req.user.organizationId);
    return { success: true, data: endpoints };
  }

  @Delete('webhooks/:id')
  @UseGuards(JwtAuthGuard)
  async deleteWebhook(@Param('id') id: string, @Req() req: any) {
    await this.webhookEndpointService.deleteEndpoint(id, req.user.organizationId);
    return { success: true, message: 'Webhook endpoint deleted' };
  }

  // ── Integrations (Marketplace) ──

  @Get('integrations/available')
  @UseGuards(JwtAuthGuard)
  async listAvailableIntegrations() {
    // Static catalog of supported integrations
    return {
      success: true,
      data: [
        { id: 'slack', name: 'Slack', category: 'communication', description: 'Send notifications to Slack channels', logo: '/integrations/slack.svg', status: 'available' },
        { id: 'google_calendar', name: 'Google Calendar', category: 'productivity', description: 'Sync meetings with Google Calendar', logo: '/integrations/gcal.svg', status: 'available' },
        { id: 'microsoft_teams', name: 'Microsoft Teams', category: 'communication', description: 'Team chat integration', logo: '/integrations/teams.svg', status: 'available' },
        { id: 'github', name: 'GitHub', category: 'development', description: 'Link commits to tasks', logo: '/integrations/github.svg', status: 'available' },
        { id: 'jira', name: 'Jira', category: 'project_management', description: 'Two-way sync with Jira', logo: '/integrations/jira.svg', status: 'coming_soon' },
        { id: 'zapier', name: 'Zapier', category: 'automation', description: '6000+ app integrations', logo: '/integrations/zapier.svg', status: 'available' },
        { id: 'razorpay', name: 'Razorpay', category: 'payments', description: 'Payout processing for salaries', logo: '/integrations/razorpay.svg', status: 'available' },
        { id: 'twilio', name: 'Twilio', category: 'communication', description: 'SMS and voice notifications', logo: '/integrations/twilio.svg', status: 'coming_soon' },
        { id: 'sendgrid', name: 'SendGrid', category: 'communication', description: 'Transactional email', logo: '/integrations/sendgrid.svg', status: 'coming_soon' },
      ],
    };
  }
}
