import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AttendanceModule } from './attendance.module';
import { BootstrapModule } from '../../bootstrap/bootstrap.module';
import { ResponseInterceptor } from '../../bootstrap/common/interceptors/response.interceptor';
import { HttpExceptionFilterImpl } from '../../bootstrap/common/filters/http-exception.filter';

@Module({ imports: [BootstrapModule, AttendanceModule] })
class AttendanceStandaloneModule {}

async function bootstrap() {
  if (!process.env.JWT_SECRET) { console.error('FATAL: JWT_SECRET'); process.exit(1); }
  const log = new Logger('AttendanceStandalone');
  const app = await NestFactory.create(AttendanceStandaloneModule);
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser()); app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilterImpl());
  app.setGlobalPrefix('api/v1');
  const port = Number(process.env.ATTENDANCE_PORT || process.env.PORT || 3011);
  await app.listen(port);
  log.log(`⏰ Attendance (standalone) listening on http://localhost:${port}`);
}
if (require.main === module) bootstrap().catch((e) => { console.error(e); process.exit(1); });
