import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraMediaService');

  // CC-001: Validate required environment variables at startup
  const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  // CC-005: Standardize log levels — add 'debug' only in non-production
  const logLevels: ('error' | 'warn' | 'log' | 'debug')[] = ['error', 'warn', 'log'];
  if (process.env.NODE_ENV !== 'production') {
    logLevels.push('debug');
  }

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  });

  app.enableCors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100,http://localhost:3005')
      .split(',').map(o => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],
  });
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  // MS-012 / CC-004: Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = process.env.MEDIA_SERVICE_PORT || 3052;
  await app.listen(port);
  logger.log(`Media Service running on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Media Service:', error);
  process.exit(1);
});
