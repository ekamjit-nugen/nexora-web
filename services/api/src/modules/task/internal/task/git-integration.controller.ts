import {
  Controller, Get, Post, Delete,
  Body, Param, Query, Req, Res,
  UseGuards, HttpCode, HttpStatus,
  Logger, Headers, RawBodyRequest,
  BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GitIntegrationService } from './git-integration.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard, Roles } from './guards/roles.guard';

// ── Webhook Controller (no auth — validated by signature) ──

@Controller('integrations/webhooks')
export class GitWebhookController {
  private readonly logger = new Logger(GitWebhookController.name);

  constructor(private gitService: GitIntegrationService) {}

  @Post('github/:orgId')
  @HttpCode(HttpStatus.OK)
  async handleGitHubWebhook(
    @Param('orgId') orgId: string,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Verify webhook signature
    const secret = await this.gitService.getWebhookSecret(orgId, 'github');
    if (!secret) {
      throw new BadRequestException('GitHub integration not configured for this organization');
    }

    // Get raw body for signature verification
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    if (!this.gitService.verifyGitHubSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`GitHub webhook received: event=${event}, org=${orgId}`);

    let result: any = { linkedCount: 0 };

    switch (event) {
      case 'push':
        result = await this.gitService.processGitHubPush(body, orgId);
        break;
      case 'pull_request':
        result = await this.gitService.processGitHubPullRequest(body, orgId);
        break;
      case 'ping':
        return { success: true, message: 'Webhook connected successfully' };
      default:
        this.logger.debug(`Unhandled GitHub event: ${event}`);
    }

    return {
      success: true,
      message: `Processed ${event} event`,
      data: result,
    };
  }

  @Post('gitlab/:orgId')
  @HttpCode(HttpStatus.OK)
  async handleGitLabWebhook(
    @Param('orgId') orgId: string,
    @Headers('x-gitlab-token') token: string,
    @Headers('x-gitlab-event') event: string,
    @Body() body: any,
  ) {
    // Verify webhook token
    const secret = await this.gitService.getWebhookSecret(orgId, 'gitlab');
    if (!secret) {
      throw new BadRequestException('GitLab integration not configured for this organization');
    }

    if (!this.gitService.verifyGitLabToken(token, secret)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    this.logger.log(`GitLab webhook received: event=${event}, org=${orgId}`);

    let result: any = { linkedCount: 0 };
    const objectKind = body.object_kind || event;

    switch (objectKind) {
      case 'push':
      case 'Push Hook':
        result = await this.gitService.processGitLabPush(body, orgId);
        break;
      case 'merge_request':
      case 'Merge Request Hook':
        result = await this.gitService.processGitLabMergeRequest(body, orgId);
        break;
      default:
        this.logger.debug(`Unhandled GitLab event: ${objectKind}`);
    }

    return {
      success: true,
      message: `Processed ${objectKind} event`,
      data: result,
    };
  }
}

// ── Integration Settings Controller (JWT-protected) ──

@Controller('integrations/git')
export class GitIntegrationController {
  private readonly logger = new Logger(GitIntegrationController.name);

  constructor(private gitService: GitIntegrationService) {}

  @Post('setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async setupGitIntegration(
    @Body() body: {
      provider: 'github' | 'gitlab' | 'bitbucket';
      autoTransition?: boolean;
      autoTransitionTarget?: string;
    },
    @Req() req: any,
  ) {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context required');
    }

    const config = await this.gitService.setupGitConfig(orgId, body.provider, {
      autoTransition: body.autoTransition,
      autoTransitionTarget: body.autoTransitionTarget,
    });

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3004';
    const webhookUrl = `${baseUrl}/api/v1/integrations/webhooks/${body.provider}/${orgId}`;

    return {
      success: true,
      message: 'Git integration configured',
      data: {
        provider: config.provider,
        webhookUrl,
        webhookSecret: config.webhookSecret,
        isActive: config.isActive,
        autoTransition: config.autoTransition,
        autoTransitionTarget: config.autoTransitionTarget,
        createdAt: config.createdAt,
      },
    };
  }

  @Get('config')
  @UseGuards(JwtAuthGuard)
  async getGitConfig(@Req() req: any) {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context required');
    }

    const configs = await this.gitService.getGitConfig(orgId);
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3004';

    const data = configs.map((c: any) => ({
      provider: c.provider,
      webhookUrl: `${baseUrl}/api/v1/integrations/webhooks/${c.provider}/${orgId}`,
      webhookSecret: c.webhookSecret,
      isActive: c.isActive,
      autoTransition: c.autoTransition,
      autoTransitionTarget: c.autoTransitionTarget,
      lastWebhookAt: c.lastWebhookAt,
      createdAt: c.createdAt,
    }));

    return {
      success: true,
      message: 'Git integration config retrieved',
      data,
    };
  }

  @Delete('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  async removeGitConfig(
    @Query('provider') provider: string,
    @Req() req: any,
  ) {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context required');
    }

    await this.gitService.removeGitConfig(orgId, provider);

    return {
      success: true,
      message: 'Git integration removed',
    };
  }
}

// ── Task Git Links Controller (JWT-protected) ──

@Controller('tasks')
export class TaskGitLinksController {
  constructor(private gitService: GitIntegrationService) {}

  @Get(':id/git-links')
  @UseGuards(JwtAuthGuard)
  async getGitLinks(@Param('id') id: string) {
    const links = await this.gitService.getGitLinks(id);
    return {
      success: true,
      message: 'Git links retrieved',
      data: links,
    };
  }
}
