import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraPolicyService');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug'],
  });

  app.enableCors({ origin: true, credentials: true });
  app.use(helmet());

  // `enableImplicitConversion: true` is removed because it coerced
  // `"false"` query-string → boolean `true` (non-empty string is truthy),
  // which made `?isTemplate=false` silently exclude everything. DTOs use
  // explicit `@Type(() => Number)` for numeric fields and `@Transform`
  // for booleans, so nothing structurally depends on implicit coercion.
  // Regression caught by the attendance-service PolicyClient, which had
  // to filter client-side as a workaround.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = process.env.POLICY_SERVICE_PORT || 3013;
  await app.listen(port);
  logger.log(`Policy Service running on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Policy Service:', error);
  process.exit(1);
});
