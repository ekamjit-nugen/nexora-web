import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import {
  AuthPublicApi,
  OrganizationBusinessDetails,
  UserSummary,
  OrgSummary,
} from './auth-public-api';
import { IUser } from '../internal/auth/schemas/user.schema';
import { IOrganization } from '../internal/auth/schemas/organization.schema';
import { AUTH_DB } from '../../../bootstrap/database/database.tokens';

/**
 * In-process implementation of AuthPublicApi.
 *
 * Lives in the same Node process as its callers in the monolith — every
 * call is a direct method invocation (no serialisation, no network).
 *
 * When the auth module is extracted to its own service, swap the
 * binding in OTHER modules' DI from `useClass: AuthPublicApiImpl` to
 * `useClass: AuthPublicApiHttpClient`. THIS class doesn't move, but it
 * stops being instantiated by callers.
 *
 * Reads are kept slim — no business logic here. The job of this layer
 * is purely (a) project the module's internal data into stable DTOs
 * and (b) enforce that other modules can never see internals.
 */
@Injectable()
export class AuthPublicApiImpl implements AuthPublicApi {
  constructor(
    @InjectModel('User', AUTH_DB) private readonly userModel: Model<IUser>,
    @InjectModel('Organization', AUTH_DB) private readonly orgModel: Model<IOrganization>,
    private readonly jwt: JwtService,
  ) {}

  async getOrganizationBusiness(organizationId: string): Promise<OrganizationBusinessDetails | null> {
    const org: any = await this.orgModel.findOne({ _id: organizationId, isDeleted: false }).lean();
    if (!org) return null;
    const business = org.business || {};
    const addr = business.registeredAddress || {};
    const addressParts = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country]
      .filter(Boolean);
    return {
      organizationId: String(org._id),
      companyName: org.legalName || org.name || 'Organization',
      registeredAddress: addressParts.length > 0 ? addressParts.join(', ') : null,
      pan: business.pan || null,
      tan: business.tan || null,
      gstin: business.gstin || null,
      cin: business.cin || null,
      signingAuthority: business.signingAuthority
        ? {
            name: business.signingAuthority.name || '',
            designation: business.signingAuthority.designation || '',
          }
        : null,
      logo: org.branding?.logo || null,
    };
  }

  async getUserById(userId: string): Promise<UserSummary | null> {
    const u: any = await this.userModel.findById(userId).lean();
    if (!u) return null;
    return {
      userId: String(u._id),
      email: u.email,
      firstName: u.firstName || null,
      lastName: u.lastName || null,
      isPlatformAdmin: u.isPlatformAdmin === true,
      setupStage: u.setupStage || 'unknown',
    };
  }

  async getOrganizationById(organizationId: string): Promise<OrgSummary | null> {
    const org: any = await this.orgModel.findOne({ _id: organizationId, isDeleted: false }).lean();
    if (!org) return null;
    return {
      organizationId: String(org._id),
      name: org.name || '',
      type: org.type || null,
      size: org.size || null,
      country: org.country || null,
      isDeleted: org.isDeleted === true,
    };
  }

  async mintServiceToken(organizationId: string): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: 'service-account',
        email: 'service@nexora.internal',
        roles: ['service'],
        orgRole: null,
        organizationId,
        isPlatformAdmin: false,
      },
      { expiresIn: '5m' },
    );
  }
}
