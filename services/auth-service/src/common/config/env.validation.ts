/**
 * Environment variable validation schema.
 * Requires `joi` package — install with: npm install joi
 * Wire in app.module.ts via ConfigModule.forRoot({ validationSchema })
 *
 * Not wired yet — will be enabled after Joi is added to dependencies.
 */

export const ENV_DEFAULTS = {
  PORT: 3001,
  JWT_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',
  NODE_ENV: 'development',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  SMTP_FROM: 'noreply@nexora.io',
  FRONTEND_URL: 'http://localhost:3003',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:3003',
  OTP_MAX_REQUESTS_PER_HOUR: 5,
  OTP_MAX_ATTEMPTS: 5,
  OTP_LOCKOUT_MINUTES: 15,
  OTP_EXPIRY_MINUTES: 10,
  OTP_RESEND_COOLDOWN_SECONDS: 30,
  INVITE_EXPIRY_DAYS: 7,
} as const;

export const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
] as const;

/**
 * Validate that required env vars are present at startup.
 * Call this from main.ts before app.listen().
 */
export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
