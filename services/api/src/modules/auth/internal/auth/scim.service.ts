import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { IUser } from './schemas/user.schema';

@Injectable()
export class ScimService {
  private readonly logger = new Logger(ScimService.name);

  constructor(
    @InjectModel('User', 'nexora_auth') private userModel: Model<IUser>,
    @InjectModel('Organization', 'nexora_auth') private orgModel: Model<any>,
  ) {}

  /**
   * Validate SCIM token with HMAC verification against per-org stored hash.
   * Token format: "scim_<orgId>_<secret>"
   *
   * SECURITY: The secret portion is verified against `organization.scimTokenHash`
   * using crypto.timingSafeEqual. Organizations must have `scimEnabled: true`
   * and a provisioned token hash before SCIM requests are accepted.
   *
   * Master token (SCIM_MASTER_TOKEN) is only permitted in development and
   * requires an explicit X-SCIM-Org-Id header to be set — never usable in prod.
   */
  private async validateToken(token: string, requestedOrgId?: string): Promise<string> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('SCIM token required');
    }

    // Reject master token in production
    const masterToken = process.env.SCIM_MASTER_TOKEN;
    if (masterToken && token === masterToken) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Master token not permitted in production');
      }
      if (!requestedOrgId) {
        throw new UnauthorizedException('Master token requires X-SCIM-Org-Id header');
      }
      this.logger.warn(`[SCIM] Master token used for org ${requestedOrgId} (dev only)`);
      return requestedOrgId;
    }

    if (!token.startsWith('scim_')) {
      throw new UnauthorizedException('Invalid SCIM token format');
    }
    const parts = token.split('_');
    if (parts.length < 3) {
      throw new UnauthorizedException('Invalid SCIM token format');
    }
    const orgId = parts[1];
    const secret = parts.slice(2).join('_');
    if (!orgId || !secret || secret.length < 16) {
      throw new UnauthorizedException('Invalid SCIM token format');
    }

    // Verify against stored token hash on the organization
    const org = await this.orgModel.findById(orgId).select('+scimTokenHash scimEnabled isDeleted').lean();
    if (!org || (org as any).isDeleted) {
      // Use same timing as hash compare to prevent org-existence enumeration
      await this.timingSafePlaceholder();
      throw new UnauthorizedException('Invalid SCIM credentials');
    }
    if (!(org as any).scimEnabled) {
      throw new UnauthorizedException('SCIM provisioning is not enabled for this organization');
    }
    const storedHash = (org as any).scimTokenHash;
    if (!storedHash) {
      throw new UnauthorizedException('SCIM token not configured for this organization');
    }

    // Constant-time comparison of sha256(secret) against storedHash
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    const providedBuf = Buffer.from(secretHash, 'hex');
    if (storedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(storedBuf, providedBuf)) {
      throw new UnauthorizedException('Invalid SCIM credentials');
    }

    return orgId;
  }

  // Constant-time placeholder to avoid org-existence timing oracle
  private async timingSafePlaceholder(): Promise<void> {
    const a = Buffer.from('0'.repeat(64), 'hex');
    const b = Buffer.from('1'.repeat(64), 'hex');
    try { crypto.timingSafeEqual(a, b); } catch { /* ignore */ }
  }

  private toScimUser(user: any) {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user._id.toString(),
      userName: user.email,
      active: user.isActive !== false,
      name: {
        givenName: firstName,
        familyName: lastName,
      },
      emails: [{ value: user.email, primary: true, type: 'work' }],
      displayName: `${firstName} ${lastName}`.trim() || user.email,
      meta: {
        resourceType: 'User',
        created: user.createdAt,
        lastModified: user.updatedAt,
        location: `/scim/v2/Users/${user._id}`,
      },
    };
  }

  async listUsers(
    token: string,
    params: { startIndex: number; count: number; filter?: string },
    requestedOrgId?: string,
  ) {
    const orgId = await this.validateToken(token, requestedOrgId);
    // User schema stores organizations as a string array of org IDs.
    const filter: Record<string, unknown> = { organizations: orgId };

    // Parse SCIM filter: supports `userName eq "email"` and `active eq true`.
    if (params.filter) {
      const userNameMatch = params.filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if (userNameMatch) {
        filter.email = userNameMatch[1].toLowerCase();
      }
      const activeMatch = params.filter.match(/active\s+eq\s+(true|false)/i);
      if (activeMatch) {
        filter.isActive = activeMatch[1].toLowerCase() === 'true';
      }
    }

    const total = await this.userModel.countDocuments(filter);
    const users = await this.userModel
      .find(filter)
      .skip(Math.max(0, params.startIndex - 1))
      .limit(Math.min(params.count, 200))
      .lean();

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex: params.startIndex,
      itemsPerPage: users.length,
      Resources: users.map((u) => this.toScimUser(u)),
    };
  }

  async getUser(token: string, id: string, requestedOrgId?: string) {
    const orgId = await this.validateToken(token, requestedOrgId);
    const user = await this.userModel
      .findOne({ _id: id, organizations: orgId })
      .lean();
    if (!user) return null;
    return this.toScimUser(user);
  }

  async createUser(token: string, body: any, requestedOrgId?: string) {
    const orgId = await this.validateToken(token, requestedOrgId);

    if (!body?.userName) {
      throw new BadRequestException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'userName is required',
        status: '400',
      });
    }

    const email = String(body.userName).toLowerCase();
    const existing = await this.userModel.findOne({ email });
    if (existing) {
      const alreadyMember = (existing.organizations || []).includes(orgId);
      if (alreadyMember) {
        throw new ConflictException({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          detail: 'User already exists',
          status: '409',
        });
      }

      // SECURITY: An existing identity (member of another org) must NOT be
      // silently pulled into this org via SCIM. An attacker who controls an
      // IdP mapping could otherwise gain access to arbitrary users' data by
      // provisioning `ceo@bigcorp.com` in their own org. Return 409 so the
      // IdP surfaces the collision to a human admin who can explicitly
      // invite via the normal flow.
      throw new ConflictException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail:
          'A user with this email already exists in another organization. Cross-organization attachment via SCIM is not permitted — invite the user through the regular org invitation flow.',
        status: '409',
      });
    }

    // firstName/lastName are required on the schema; fall back to local-part
    // of the email so provisioning cannot fail on sparse SCIM payloads.
    const localPart = email.split('@')[0] || 'user';
    const firstName = body.name?.givenName || localPart;
    const lastName = body.name?.familyName || localPart;

    const user = new this.userModel({
      email,
      firstName,
      lastName,
      isActive: body.active !== false,
      organizations: [orgId],
      isEmailVerified: true, // SCIM-provisioned users are pre-verified
      setupStage: 'invited',
    });

    await user.save();
    this.logger.log(`SCIM: Created user ${email} in org ${orgId}`);
    return this.toScimUser(user.toObject());
  }

  async replaceUser(token: string, id: string, body: any, requestedOrgId?: string) {
    const orgId = await this.validateToken(token, requestedOrgId);
    const user = await this.userModel.findOne({ _id: id, organizations: orgId });
    if (!user) {
      throw new NotFoundException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    // SECURITY: email (userName) changes via SCIM are rejected. Changing the
    // primary identifier without re-verification is an account-takeover vector
    // — a compromised IdP or misconfigured attribute mapping could silently
    // remap a user to an attacker-controlled address. Create a new SCIM user
    // instead and deactivate the old one.
    if (body.userName && String(body.userName).toLowerCase() !== String((user as any).email || '').toLowerCase()) {
      throw new BadRequestException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'userName (email) cannot be changed via SCIM. Create a new user instead.',
        status: '400',
      });
    }
    if (body.name?.givenName !== undefined) {
      (user as any).firstName = body.name.givenName;
    }
    if (body.name?.familyName !== undefined) {
      (user as any).lastName = body.name.familyName;
    }
    if (body.active !== undefined) {
      (user as any).isActive = !!body.active;
    }

    await user.save();
    return this.toScimUser(user.toObject());
  }

  async patchUser(token: string, id: string, body: any, requestedOrgId?: string) {
    const orgId = await this.validateToken(token, requestedOrgId);
    const user = await this.userModel.findOne({ _id: id, organizations: orgId });
    if (!user) {
      throw new NotFoundException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    // SCIM PATCH operations: { Operations: [{ op, path, value }] }
    if (body?.Operations && Array.isArray(body.Operations)) {
      for (const op of body.Operations) {
        const path = op.path as string | undefined;
        const value = op.value;
        const operation = String(op.op || '').toLowerCase();

        if (operation !== 'replace' && operation !== 'add') {
          // `remove` and unknown ops are intentionally ignored for core
          // attributes — deactivation is handled via active=false.
          continue;
        }

        if (path === 'active') {
          (user as any).isActive = typeof value === 'boolean' ? value : value === 'true';
          continue;
        }
        if (path === 'userName') {
          // SECURITY: See replaceUser — email changes are not permitted via SCIM.
          const incoming = String(value || '').toLowerCase();
          if (incoming !== String((user as any).email || '').toLowerCase()) {
            throw new BadRequestException({
              schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
              detail: 'userName (email) cannot be changed via SCIM. Create a new user instead.',
              status: '400',
            });
          }
          continue;
        }
        if (path === 'name.givenName') {
          (user as any).firstName = value;
          continue;
        }
        if (path === 'name.familyName') {
          (user as any).lastName = value;
          continue;
        }

        // No path: value is a partial resource object.
        if (!path && value && typeof value === 'object') {
          if ('active' in value) {
            (user as any).isActive = !!value.active;
          }
          if ('userName' in value && value.userName) {
            // SECURITY: See replaceUser — SCIM may not mutate primary identifier.
            const incoming = String(value.userName).toLowerCase();
            if (incoming !== String((user as any).email || '').toLowerCase()) {
              throw new BadRequestException({
                schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
                detail: 'userName (email) cannot be changed via SCIM. Create a new user instead.',
                status: '400',
              });
            }
          }
          if (value.name && typeof value.name === 'object') {
            if (value.name.givenName !== undefined) {
              (user as any).firstName = value.name.givenName;
            }
            if (value.name.familyName !== undefined) {
              (user as any).lastName = value.name.familyName;
            }
          }
        }
      }
    }

    await user.save();
    return this.toScimUser(user.toObject());
  }

  async deleteUser(token: string, id: string, requestedOrgId?: string) {
    const orgId = await this.validateToken(token, requestedOrgId);
    const user = await this.userModel.findOne({ _id: id, organizations: orgId });
    if (!user) {
      throw new NotFoundException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    // SCIM delete = deactivate (soft delete for audit/compliance).
    (user as any).isActive = false;
    await user.save();
    this.logger.log(`SCIM: Deactivated user ${id} in org ${orgId}`);
  }
}
