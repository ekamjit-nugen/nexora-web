import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraHelpdeskService');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'debug'] });
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.enableCors({ origin: true, credentials: true });
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.setGlobalPrefix('api/v1');
  const port = process.env.HELPDESK_SERVICE_PORT || 3033;
  await app.listen(port);
  logger.log(`Helpdesk Service running on http://localhost:${port}`);
}
bootstrap().catch((error) => { console.error('Failed to start Helpdesk Service:', error); process.exit(1); });
