import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NexoraPayrollService');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [];
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true, // restrict in production via CORS_ORIGINS env
    credentials: true,
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

  const port = process.env.PAYROLL_SERVICE_PORT || 3014;
  await app.listen(port);
  logger.log(`Payroll Service running on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Payroll Service:', error);
  process.exit(1);
});
