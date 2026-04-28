/**
 * Template public API — the ONLY surface other modules may import.
 *
 * Treat this file like a published package. Once a method appears here,
 * other modules will start depending on it; changes need to be backward-
 * compatible or coordinated.
 *
 * When this module is split out into its own microservice tomorrow,
 * THIS interface becomes the HTTP/gRPC contract. Method signatures,
 * argument shapes, and return shapes are the wire protocol.
 */

export interface TemplatePublicApi {
  // example —
  // doSomething(input: { foo: string }): Promise<{ result: string }>;
}

/**
 * DI token. Other modules consume this:
 *
 *   constructor(
 *     @Inject(TEMPLATE_PUBLIC_API)
 *     private readonly template: TemplatePublicApi,
 *   ) {}
 *
 * In monolith → bound to TemplatePublicApiImpl (in-process).
 * After split → bound to TemplatePublicApiHttpClient (axios behind same
 * interface). Caller code is identical.
 */
export const TEMPLATE_PUBLIC_API = Symbol('TEMPLATE_PUBLIC_API');
