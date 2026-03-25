import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-saml';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  private readonly logger = new Logger(SamlStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      entryPoint: configService.get<string>('SAML_ENTRY_POINT'),
      issuer: configService.get<string>('SAML_ISSUER') || 'nexora-saml',
      cert: configService.get<string>('SAML_CERT') || 'placeholder-cert-configure-for-production',
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    });
  }

  /**
   * Verify SAML response
   */
  async validate(profile: any): Promise<any> {
    this.logger.debug(`SAML callback for user: ${profile.email}`);

    try {
      const { user, tokens } = await this.authService.handleOAuthCallback(
        'saml',
        {
          id: profile.nameID,
          email: profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
          given_name: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || 'User',
          family_name: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '',
        },
      );

      return { user, tokens };
    } catch (error: any) {
      this.logger.error(`SAML validation error: ${error?.message || String(error)}`);
      throw error;
    }
  }
}

/*
 * When: User initiates SAML SSO login
 * if: SAML response is valid and signed
 * then: extract user information and create or update user in database
 */
