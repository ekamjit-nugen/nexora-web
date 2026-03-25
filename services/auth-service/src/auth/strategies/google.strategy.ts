import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '/api/v1/auth/oauth/google/callback',
      scope: ['profile', 'email'],
    });
  }

  /**
   * Verify Google OAuth token
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    this.logger.debug(`Google OAuth callback for user: ${profile.email}`);

    try {
      const { user, tokens } = await this.authService.handleOAuthCallback(
        'google',
        {
          id: profile.id,
          email: profile.emails[0].value,
          given_name: profile.name.givenName,
          family_name: profile.name.familyName,
        },
      );

      done(null, { user, tokens, accessToken });
    } catch (error) {
      this.logger.error(`Google OAuth error: ${error.message}`);
      done(error);
    }
  }
}

/*
 * When: User initiates Google OAuth login
 * if: Google OAuth credentials are valid
 * then: create or update user in database and return tokens
 */
