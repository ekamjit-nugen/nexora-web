/**
 * HR module — standalone bootstrap (the split lever).
 *
 * In the monolith, src/main.ts is the entrypoint and this file is unused.
 * On extraction:
 *   1. Build: `npx nest build`
 *   2. Run: `node dist/src/modules/hr/hr.bootstrap.js`
 *   3. Set env: HR_PORT, MONGODB_URI, JWT_SECRET (must match the auth
 *      service's secret so JWTs validate locally).
 *   4. Other modules' DI: change `useClass: HrPublicApiImpl` to
 *      `useClass: HrPublicApiHttpClient` with the new service URL.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HrModule } from './hr.module';
import { BootstrapModule } from '../../bootstrap/bootstrap.module';
import { ResponseInterceptor } from '../../bootstrap/common/interceptors/response.interceptor';
import { HttpExceptionFilterImpl } from '../../bootstrap/common/filters/http-exception.filter';

@Module({
  imports: [BootstrapModule, HrModule],
})
class HrStandaloneModule {}

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
  }
  const log = new Logger('HrStandalone');
  const app = await NestFactory.create(HrStandaloneModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilterImpl());
  app.setGlobalPrefix('api/v1');
  const port = Number(process.env.HR_PORT || process.env.PORT || 3010);
  await app.listen(port);
  log.log(`👥 HR (standalone) listening on http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap().catch((err) => { console.error(err); process.exit(1); });
}
