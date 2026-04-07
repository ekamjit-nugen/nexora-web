import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraChatService');
  // L-008: Use appropriate log levels based on environment
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug'],
  });

  // RL-006: Trust first proxy so rate limiting uses real client IP from X-Forwarded-For
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100,http://localhost:3005')
      .split(',').map(o => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN', 'X-Organization-Id'],
  });
  // Socket.IO WebSocket CORS is handled by the MessagesGateway decorator
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

  const port = process.env.CHAT_SERVICE_PORT || 3002;
  await app.listen(port);
  logger.log(`Chat Service running on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Chat Service:', error);
  process.exit(1);
});
