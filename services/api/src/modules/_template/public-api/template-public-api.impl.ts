import { Injectable } from '@nestjs/common';
import { TemplatePublicApi } from './template-public-api';

/**
 * In-process implementation. Replace this with HTTP / gRPC client when
 * the module is extracted to its own service — and the binding in
 * `<name>.module.ts` swaps from `useClass: TemplatePublicApiImpl` to
 * `useClass: TemplatePublicApiHttpClient`. Nothing else changes.
 */
@Injectable()
export class TemplatePublicApiImpl implements TemplatePublicApi {
  // Implement the interface methods here. Most of the time this is
  // a thin wrapper that forwards to internal services injected via DI:
  //
  //   constructor(private readonly internal: SomeInternalService) {}
  //   async doSomething(input) { return this.internal.compute(input); }
}
