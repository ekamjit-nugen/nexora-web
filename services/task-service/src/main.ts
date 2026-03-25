import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraTaskService');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug'],
  });

  app.enableCors({ origin: true, credentials: true });
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

  const port = process.env.TASK_SERVICE_PORT || 3021;
  await app.listen(port);
  logger.log(`Task Service running on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Task Service:', error);
  process.exit(1);
});
