import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraKnowledgeService');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'debug'] });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.enableCors({ origin: true, credentials: true });
  app.use(helmet());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.setGlobalPrefix('api/v1');

  const port = process.env.KNOWLEDGE_SERVICE_PORT || 3032;
  await app.listen(port);
  logger.log(`Knowledge Service running on http://localhost:${port}`);
}

bootstrap().catch((error) => { console.error('Failed to start Knowledge Service:', error); process.exit(1); });
