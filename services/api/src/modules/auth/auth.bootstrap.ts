/**
 * Auth module — standalone bootstrap.
 *
 * THIS IS THE SPLIT LEVER. In the monolith, src/main.ts is the entry-
 * point and this file is unused. The day you decide to extract auth to
 * its own microservice:
 *
 *   1. Build it: `npx nest build`
 *   2. Run it: `node dist/src/modules/auth/auth.bootstrap.js`
 *      (or set Dockerfile CMD to that path)
 *   3. Set env vars: AUTH_PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRY,
 *      and any auth-specific OAuth/SAML credentials.
 *   4. Update OTHER modules to swap the AUTH_PUBLIC_API binding from
 *      `useClass: AuthPublicApiImpl` to an HTTP-client implementation
 *      pointing at this new service.
 *
 * Tested in CI alongside the monolith so it's always known to boot.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AuthModule } from './auth.module';
import { BootstrapModule } from '../../bootstrap/bootstrap.module';
import { ResponseInterceptor } from '../../bootstrap/common/interceptors/response.interceptor';
import { HttpExceptionFilterImpl } from '../../bootstrap/common/filters/http-exception.filter';

@Module({
  imports: [BootstrapModule, AuthModule],
})
class AuthStandaloneModule {}

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
  }

  const log = new Logger('AuthStandalone');
  const app = await NestFactory.create(AuthStandaloneModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilterImpl());
  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.AUTH_PORT || process.env.PORT || 3001);
  await app.listen(port);
  log.log(`🔐 Auth (standalone) listening on http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Failed to start Auth standalone:', err);
    process.exit(1);
  });
}
