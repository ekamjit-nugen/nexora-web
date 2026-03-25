import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraChatService');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug'],
  });

  app.enableCors({ origin: true, credentials: true });
  // Socket.IO WebSocket CORS is handled by the ChatGateway decorator
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
