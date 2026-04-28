import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './bootstrap/common/interceptors/response.interceptor';
import { HttpExceptionFilterImpl } from './bootstrap/common/filters/http-exception.filter';

/**
 * Single bootstrap for the Nexora monolith.
 *
 * Replaces 18 separate `services/<name>-service/src/main.ts` files.
 * Same security middleware (helmet, CORS, cookie parser), same global
 * prefix (`/api/v1`), same response envelope, same exception filter —
 * so the frontend's API contract is byte-identical.
 *
 * Per-module standalone bootstraps still exist at
 * `src/modules/<name>/<name>.bootstrap.ts` — those are the split levers.
 * They go unused in the monolith but stay tested and maintained, so the
 * day you want to extract a module they Just Work.
 */
async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
  }

  const log = new Logger('NexoraApi');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Critical: query strings (?limit=10&page=1) arrive as strings,
      // but DTOs declare those fields as `number` with @IsNumber().
      // Without enableImplicitConversion, every list endpoint with
      // pagination params 400s with "limit must be a number".
      // Matches the legacy hr/payroll/etc. service config exactly.
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilterImpl());

  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  log.log(`🚀 Nexora API monolith listening on http://localhost:${port}`);
  log.log(`📊 Health: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((err) => {
  console.error('Failed to start Nexora API:', err);
  process.exit(1);
});
