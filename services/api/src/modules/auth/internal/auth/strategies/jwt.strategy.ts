import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || (() => { throw new Error('FATAL: JWT_SECRET not configured'); })(),
    });
  }

  /**
   * Validate JWT payload
   */
  async validate(payload: any) {
    this.logger.debug(`Validating JWT for user: ${payload.email}`);

    // Validate payload structure
    if (!this.authService.validateJwtPayload(payload)) {
      this.logger.warn(`Invalid JWT payload: ${JSON.stringify(payload)}`);
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: payload.roles,
      orgRole: payload.orgRole || null,
      organizationId: payload.organizationId || null,
      isPlatformAdmin: payload.isPlatformAdmin || false,
      family: payload.family || null,
    };
  }
}

/*
 * When: JWT token is presented in Authorization header
 * if: token is valid and not expired
 * then: extract payload and validate user credentials
 */
