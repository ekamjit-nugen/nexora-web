import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraCallingService');
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

  const port = process.env.CALLING_SERVICE_PORT || 3051;
  await app.listen(port);

  logger.log(`🎯 Calling Service running on http://localhost:${port}`);
  logger.log(`📞 WebSocket Gateway: ws://localhost:${port}/calls`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Calling Service:', error);
  process.exit(1);
});
