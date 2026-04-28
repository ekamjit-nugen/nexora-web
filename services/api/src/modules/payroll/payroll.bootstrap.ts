/**
 * Payroll module — standalone bootstrap (the split lever).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { PayrollModule } from './payroll.module';
import { BootstrapModule } from '../../bootstrap/bootstrap.module';
import { ResponseInterceptor } from '../../bootstrap/common/interceptors/response.interceptor';
import { HttpExceptionFilterImpl } from '../../bootstrap/common/filters/http-exception.filter';

@Module({ imports: [BootstrapModule, PayrollModule] })
class PayrollStandaloneModule {}

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set.');
    process.exit(1);
  }
  const log = new Logger('PayrollStandalone');
  const app = await NestFactory.create(PayrollStandaloneModule);
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilterImpl());
  app.setGlobalPrefix('api/v1');
  const port = Number(process.env.PAYROLL_PORT || process.env.PORT || 3014);
  await app.listen(port);
  log.log(`💰 Payroll (standalone) listening on http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap().catch((err) => { console.error(err); process.exit(1); });
}
