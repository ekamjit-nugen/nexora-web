import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ScimService } from './scim.service';

// SCIM 2.0 endpoints (RFC 7644) for enterprise user provisioning
// (Okta, Azure AD, OneLogin, etc.).
//
// NOTE: Due to the service's global API prefix, these endpoints resolve at
// `/api/v1/scim/v2/...`. Most SCIM clients expect `/scim/v2/...` directly at
// the root — proper SCIM base-path exposure would require gateway/proxy
// rewrite rules, which is out of scope for this PR. Document the actual
// client-facing URL when provisioning credentials to customers.
//
// Authentication uses a SCIM-specific Bearer token (format
// `scim_<orgId>_<secret>`), separate from the normal user JWT flow.

@Controller('scim/v2')
export class ScimController {
  private readonly logger = new Logger(ScimController.name);

  constructor(private scimService: ScimService) {}

  private extractScimToken(req: Request): string {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing SCIM bearer token');
    }
    return auth.substring(7);
  }

  // `X-SCIM-Org-Id` is only consulted when the dev-only master token is used.
  // Under normal Bearer tokens the org ID is derived from the token itself.
  private extractRequestedOrgId(req: Request): string | undefined {
    const raw = req.headers['x-scim-org-id'];
    if (!raw) return undefined;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  // Service Provider Config (SCIM discovery)
  @Get('ServiceProviderConfig')
  getServiceProviderConfig(@Res() res: Response) {
    return res.status(200).json({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://docs.nexora.io/scim',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: true },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication via OAuth 2.0 Bearer Token',
          specUri: 'https://tools.ietf.org/html/rfc6750',
          documentationUri: 'https://docs.nexora.io/scim/auth',
        },
      ],
      meta: {
        location: '/scim/v2/ServiceProviderConfig',
        resourceType: 'ServiceProviderConfig',
      },
    });
  }

  @Get('ResourceTypes')
  getResourceTypes(@Res() res: Response) {
    return res.status(200).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 2,
      Resources: [
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'User',
          name: 'User',
          endpoint: '/Users',
          description: 'User Account',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
          meta: { location: '/scim/v2/ResourceTypes/User', resourceType: 'ResourceType' },
        },
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'Group',
          name: 'Group',
          endpoint: '/Groups',
          description: 'Group',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
          meta: { location: '/scim/v2/ResourceTypes/Group', resourceType: 'ResourceType' },
        },
      ],
    });
  }

  @Get('Schemas')
  getSchemas(@Res() res: Response) {
    return res.status(200).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 2,
      Resources: [
        { id: 'urn:ietf:params:scim:schemas:core:2.0:User', name: 'User' },
        { id: 'urn:ietf:params:scim:schemas:core:2.0:Group', name: 'Group' },
      ],
    });
  }

  // ── Users ──
  @Get('Users')
  async listUsers(@Query() query: any, @Req() req: Request, @Res() res: Response) {
    const token = this.extractScimToken(req);
    const orgIdHint = this.extractRequestedOrgId(req);
    const startIndex = parseInt(query.startIndex || '1', 10);
    const count = parseInt(query.count || '100', 10);
    const filter = query.filter as string | undefined;
    const result = await this.scimService.listUsers(token, { startIndex, count, filter }, orgIdHint);
    return res.status(200).json(result);
  }

  @Get('Users/:id')
  async getUser(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const token = this.extractScimToken(req);
    const orgIdHint = this.extractRequestedOrgId(req);
    const user = await this.scimService.getUser(token, id, orgIdHint);
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }
    return res.status(200).json(user);
  }

  @Post('Users')
  async createUser(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const token = this.extractScimToken(req);
    const orgIdHint = this.extractRequestedOrgId(req);
    const user = await this.scimService.createUser(token, body, orgIdHint);
    return res.status(201).json(user);
  }

  @Put('Users/:id')
  async replaceUser(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const token = this.extractScimToken(req);
    const orgIdHint = this.extractRequestedOrgId(req);
    const user = await this.scimService.replaceUser(token, id, body, orgIdHint);
    return res.status(200).json(user);
  }

  @Patch('Users/:id')
  async patchUser(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const token = this.extractScimToken(req);
    const orgIdHint = this.extractRequestedOrgId(req);
    const user = await this.scimService.patchUser(token, id, body, orgIdHint);
    return res.status(200).json(user);
  }

  @Delete('Users/:id')
  async deleteUser(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const token = this.extractScimToken(req);
    const orgIdHint = this.extractRequestedOrgId(req);
    await this.scimService.deleteUser(token, id, orgIdHint);
    return res.status(204).send();
  }
}
