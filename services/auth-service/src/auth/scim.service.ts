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
import { IUser } from './schemas/user.schema';

@Injectable()
export class ScimService {
  private readonly logger = new Logger(ScimService.name);

  constructor(@InjectModel('User') private userModel: Model<IUser>) {}

  // Validate SCIM token: format is "scim_<orgId>_<secret>".
  // In production this should verify `<secret>` against a hashed value stored
  // on the organization (e.g. Organization.scimTokenHash). For now we accept
  // any token with the correct prefix structure and use the embedded orgId to
  // scope operations. A master token (SCIM_MASTER_TOKEN) is explicitly rejected
  // here because it carries no org context.
  private async validateToken(token: string): Promise<string> {
    const expectedToken = process.env.SCIM_MASTER_TOKEN;
    if (expectedToken && token === expectedToken) {
      throw new UnauthorizedException('SCIM master token requires org context');
    }
    if (!token.startsWith('scim_')) {
      throw new UnauthorizedException('Invalid SCIM token format');
    }
    const parts = token.split('_');
    if (parts.length < 3) {
      throw new UnauthorizedException('Invalid SCIM token format');
    }
    const orgId = parts[1];
    if (!orgId) {
      throw new UnauthorizedException('Invalid SCIM token format');
    }
    // TODO: verify parts.slice(2).join('_') against Organization.scimTokenHash
    return orgId;
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
  ) {
    const orgId = await this.validateToken(token);
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

  async getUser(token: string, id: string) {
    const orgId = await this.validateToken(token);
    const user = await this.userModel
      .findOne({ _id: id, organizations: orgId })
      .lean();
    if (!user) return null;
    return this.toScimUser(user);
  }

  async createUser(token: string, body: any) {
    const orgId = await this.validateToken(token);

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
      // If user exists but is not yet a member of this org, add them. This
      // matches typical SCIM provisioning semantics where an identity provider
      // attaches an existing identity to a new tenant.
      if (!(existing.organizations || []).includes(orgId)) {
        existing.organizations = [...(existing.organizations || []), orgId];
        await existing.save();
        this.logger.log(`SCIM: Attached existing user ${email} to org ${orgId}`);
        return this.toScimUser(existing.toObject());
      }
      throw new ConflictException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User already exists',
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

  async replaceUser(token: string, id: string, body: any) {
    const orgId = await this.validateToken(token);
    const user = await this.userModel.findOne({ _id: id, organizations: orgId });
    if (!user) {
      throw new NotFoundException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    if (body.userName) {
      (user as any).email = String(body.userName).toLowerCase();
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

  async patchUser(token: string, id: string, body: any) {
    const orgId = await this.validateToken(token);
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
          (user as any).email = String(value).toLowerCase();
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
            (user as any).email = String(value.userName).toLowerCase();
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

  async deleteUser(token: string, id: string) {
    const orgId = await this.validateToken(token);
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
