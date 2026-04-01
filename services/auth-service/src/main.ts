import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Exiting.');
    process.exit(1);
  }

  const logger = new Logger('NexoraAuthService');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug'],
  });

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Cookie parser (Wave 1.1: httpOnly cookie auth)
  app.use(cookieParser());

  // Security middleware
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API version prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.AUTH_SERVICE_PORT || 3001;
  await app.listen(port);
  logger.log(`🔐 Auth Service running on http://localhost:${port}`);
  logger.log(`📊 Health check: http://localhost:${port}/health`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Auth Service:', error);
  process.exit(1);
});

/*
 * When: Service initialization
 * if: Node environment is set and port is available
 * then: Service starts and listens on configured port
 */
