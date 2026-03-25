import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraAIService');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({ origin: true, credentials: true });
  app.use(helmet());
  app.setGlobalPrefix('api/v1');

  const port = process.env.AI_SERVICE_PORT || 3080;
  await app.listen(port);
  logger.log(`AI Service running on http://localhost:${port}`);
  logger.log(`LLM endpoint: ${process.env.LLM_BASE_URL || 'http://host.docker.internal:7/v1'}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start AI Service:', error);
  process.exit(1);
});
