/**
 * THE SPLIT LEVER.
 *
 * This file boots a Nest application that contains ONLY this module.
 * In the monolith, `services/api/src/main.ts` is the entrypoint and
 * this file is unused.
 *
 * The day you decide to extract this module to its own microservice:
 *
 *   1. Update the Dockerfile / Kubernetes manifest CMD:
 *        node dist/src/modules/<name>/<name>.bootstrap.js
 *   2. Set the per-module env vars (DB URI, port, etc).
 *   3. Update OTHER modules' DI: change the public-api token binding
 *      from `useClass: <Name>PublicApiImpl` to `useClass: <Name>PublicApiHttpClient`
 *      with the new service URL.
 *   4. Deploy.
 *
 * That's it. No code changes in any business-logic file.
 *
 * Pre-split checklist (the runbook in docs/extract-to-microservice.md
 * walks through each):
 *   [ ] Module's public API is stable (no recent breaking changes)
 *   [ ] Module's domain events are consumed via EventBus, not direct calls
 *   [ ] Module's DB connection is named (not the default connection)
 *   [ ] Module has integration tests that exercise the public API
 *   [ ] HTTP client implementation of the public API is built
 *   [ ] Caller modules' DI bindings updated and tested
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { TemplateModule } from './_template.module';
import { BootstrapModule } from '../../bootstrap/bootstrap.module';
import { ResponseInterceptor } from '../../bootstrap/common/interceptors/response.interceptor';
import { HttpExceptionFilterImpl } from '../../bootstrap/common/filters/http-exception.filter';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const log = new Logger('TemplateBootstrap');
  const app = await NestFactory.create({
    module: class StandaloneApp {},
    imports: [BootstrapModule, TemplateModule],
  } as any);

  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilterImpl());
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || process.env.TEMPLATE_PORT || 3099;
  await app.listen(port);
  log.log(`Template module standalone on http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Failed to start Template module standalone:', err);
    process.exit(1);
  });
}
