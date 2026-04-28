import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-microsoft';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(
  Strategy,
  'microsoft',
) {
  private readonly logger = new Logger(MicrosoftStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('MICROSOFT_CLIENT_ID'),
      clientSecret: configService.get<string>('MICROSOFT_CLIENT_SECRET'),
      callbackURL: configService.get<string>('MICROSOFT_CALLBACK_URL') || '/api/v1/auth/oauth/microsoft/callback',
      scope: ['profile', 'email'],
      tenant: 'common',
    });
  }

  /**
   * Verify Microsoft OAuth token
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    this.logger.debug(`Microsoft OAuth callback for user: ${profile.email}`);

    try {
      const { user, tokens } = await this.authService.handleOAuthCallback(
        'microsoft',
        {
          id: profile.id,
          email: profile.emails[0].value,
          given_name: profile.displayName.split(' ')[0],
          family_name: profile.displayName.split(' ')[1] || '',
        },
      );

      done(null, { user, tokens, accessToken });
    } catch (error) {
      this.logger.error(`Microsoft OAuth error: ${error.message}`);
      done(error);
    }
  }
}

/*
 * When: User initiates Microsoft OAuth login
 * if: Microsoft OAuth credentials are valid
 * then: create or update user in database and return tokens
 */
