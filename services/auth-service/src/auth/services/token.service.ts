import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { IUser } from '../schemas/user.schema';
import { IOrgMembership } from '../schemas/org-membership.schema';
import { ISession } from '../schemas/session.schema';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectModel('User') private userModel: Model<IUser>,
    @InjectModel('OrgMembership') private orgMembershipModel: Model<IOrgMembership>,
    @InjectModel('Session') private sessionModel: Model<ISession>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateTokens(user: IUser, orgId?: string): Promise<AuthTokens> {
    const resolvedOrgId = orgId || user.defaultOrganizationId || null;

    let orgRole = 'member';
    if (resolvedOrgId) {
      const membership = await this.orgMembershipModel.findOne({
        userId: user._id.toString(),
        organizationId: resolvedOrgId,
        status: 'active',
      });
      if (membership) {
        orgRole = membership.role;
      }
    }

    const tokenFamily = uuidv4();
    const payload: any = {
      sub: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      organizationId: resolvedOrgId,
      orgRole,
      setupStage: user.setupStage,
      isPlatformAdmin: user.isPlatformAdmin || false,
      family: tokenFamily,
    };

    const jwtExpiry = this.configService.get<string>('JWT_EXPIRY') || '15m';
    const accessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiry });
    const refreshToken = this.jwtService.sign(
      { sub: user._id, family: tokenFamily },
      { expiresIn: '7d' },
    );

    // Create session record
    try {
      await this.sessionModel.create({
        userId: user._id.toString(),
        refreshTokenFamily: tokenFamily,
        deviceInfo: 'Unknown',
        ipAddress: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    } catch (err) {
      this.logger.warn(`Failed to create session: ${err.message || err}`);
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(jwtExpiry),
    };
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; // default 15m
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }

  async generateTokensWithOrg(userId: string, orgId: string): Promise<AuthTokens> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return this.generateTokens(user, orgId);
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    this.logger.debug('Token refresh attempt');

    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userModel.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
      }

      // Check session validity
      if (payload.family) {
        const session = await this.sessionModel.findOne({
          refreshTokenFamily: payload.family,
          isRevoked: false,
        });

        if (!session) {
          // Possible token reuse attack — revoke all sessions for this family
          this.logger.warn(`Refresh token reuse detected for user ${user._id}`);
          throw new HttpException('Session has been revoked', HttpStatus.UNAUTHORIZED);
        }

        // Rotate: revoke old session, create new one
        session.isRevoked = true;
        await session.save();
      }

      return this.generateTokens(user, payload.organizationId || user.defaultOrganizationId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
  }

  generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  validateCsrfToken(cookieToken: string, headerToken: string): boolean {
    if (!cookieToken || !headerToken) return false;
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken),
    );
  }
}
