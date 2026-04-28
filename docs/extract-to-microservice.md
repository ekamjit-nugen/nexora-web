# Extract a module to a standalone microservice — runbook

The point of the modular monolith is that this runbook is short and
mechanical. If splitting a module is harder than what's described here,
the boundary contract has been violated somewhere — fix that first.

## When to split a module out

Don't split until at least one of these is true:

- One module's traffic genuinely needs independent horizontal scaling
  (e.g. notification dispatch under heavy fan-out, AI module with GPU).
- The module needs a different runtime (e.g. Python ML, Go for
  performance-critical paths).
- A separate team owns the module and their deploy cadence is
  incompatible with the rest of the codebase.
- Compliance / blast-radius requirement (e.g. payments must be deployed
  from a smaller, audited surface).
- The module's data needs to physically live on a separate cluster
  (e.g. EU residency for HR data).

If none of these apply, **stay in the monolith**. The cost of distributed
systems is higher than people admit.

## Pre-flight (before you even start)

Look at the module you want to split (`services/api/src/modules/<name>/`):

- [ ] Public API is stable. No method signature has changed in the
      last 30 days. Run `git log -p public-api/` — quiet history is good.
- [ ] All cross-module callers go through `<NAME>_PUBLIC_API` — never
      reach into `internal/` or `schemas/`. Run
      `grep -r "from '@modules/<name>/internal" src/` — should be empty.
- [ ] Domain events flow through EventBus, never direct method calls
      that bypass the bus.
- [ ] Module's Mongoose schemas use the named connection
      (`MongooseModule.forFeature([...], <NAME>_DB)`). Never the default.
- [ ] Module has integration tests that exercise the public API surface.
      These become the contract tests for the new service.
- [ ] Module's standalone bootstrap (`<name>.bootstrap.ts`) actually
      runs locally — try `npx ts-node src/modules/<name>/<name>.bootstrap.ts`.
      If it crashes, fix that BEFORE proceeding.

## The split — five mechanical steps

### Step 1 — Build the HTTP client implementation of the public API

Create `services/api/src/modules/<name>/public-api/<name>-public-api.http.ts`:

```ts
@Injectable()
export class <Name>PublicApiHttpClient implements <Name>PublicApi {
  constructor(private readonly http: HttpService, private readonly cfg: ConfigService) {}

  async someMethod(input: SomeInput): Promise<SomeOutput> {
    const url = this.cfg.get<string>('NEXORA_<NAME>_URL');
    const res = await firstValueFrom(this.http.post(`${url}/api/v1/internal/<endpoint>`, input));
    return res.data.data;
  }
}
```

Add the corresponding `internal/` HTTP route on the module that exposes
each public-API method as a real endpoint. The endpoint authenticates
with an internal-service JWT (separate from end-user JWT).

### Step 2 — Test the HTTP client AGAINST the in-process implementation

While still in the monolith, swap the binding behind a feature flag:

```ts
// app.module.ts
{
  provide: <NAME>_PUBLIC_API,
  useClass: process.env.<NAME>_REMOTE === 'true'
    ? <Name>PublicApiHttpClient
    : <Name>PublicApiImpl,
},
```

Set the flag in dev → run e2e tests against the monolith calling
itself over HTTP. If the suite passes, your contract is solid.

### Step 3 — Deploy the standalone microservice

Build a Docker image with `CMD ["node", "dist/src/modules/<name>/<name>.bootstrap.js"]`.
Same source code as the monolith — different entrypoint.

Deploy with its own:
- Dedicated env vars (DB URI, port, JWT secret, etc.)
- Health check route (`/api/v1/health` already in there)
- Scaling config (replicas, CPU/memory)

Verify it answers requests on its public-API endpoints.

### Step 4 — Cut callers over to the HTTP client

In the (still running) monolith deployment:

```bash
# set the env var
<NAME>_REMOTE=true
<NAME>_URL=http://<name>-service.internal:3000

# rolling-restart the monolith
```

The monolith now calls the new microservice for everything that used
to be in-process. The standalone microservice's data store is the same
Mongo cluster, so there's no data migration.

### Step 5 — Cleanup

After 7 days of clean operation:

- [ ] Remove `<Name>PublicApiImpl` from the monolith's `<name>.module.ts`
      providers (HTTP client is now the only impl).
- [ ] Remove the module's `internal/` and `schemas/` from the monolith
      build entirely — extract them to a new repo OR keep them in the
      monorepo but mark the module as "extracted" in a comment.
- [ ] Update CI: the new service gets its own deploy pipeline.

## What stays the same after a split

- Caller code (every module that consumed `<NAME>_PUBLIC_API`) — zero
  changes. The DI binding swap happens once in the monolith's module
  config; the calls themselves are identical.
- Domain event emitters and subscribers — `EventBus.publish()` still
  works; subscribers' `@OnEvent(...)` decorators still work. The bus
  implementation is what changes (in-process → Kafka / NATS), at the
  bootstrap layer, not in business code.
- Database schemas, mongoose models, queries — these were already
  module-private.
- Frontend / mobile — the API path stays at `/api/v1/...` (the gateway
  routes the right path to the right service).

## What changes (the real cost)

- Networking: now a real HTTP/gRPC hop. ~5–20ms latency tax per call.
  Worth it only when the benefits above outweigh.
- Failure modes: the new service can be partially down. Add timeouts
  + circuit breakers in the HTTP client. NestJS's `@nestjs/axios` +
  `HttpModule` with `axios-retry` is the usual combo.
- Observability: distributed tracing now matters. Set up OpenTelemetry
  before you split, not after.
- Deployment: now you have 2 deploys instead of 1. Make sure your CI
  is fine with that before splitting.

## Trigger conditions for "actually do this"

The pragmatic test: **does at least one of these conditions persist for
30 consecutive days?**

- One module's CPU or memory consistently > 70% while others are
  < 20% (asymmetric scaling need).
- The module's PRs are blocked behind unrelated PRs more than 2× per
  week (independent deploy cadence need).
- The module is a different language than Node (architectural need).
- A regulator / customer requirement explicitly demands isolation.

If none, the monolith is still the right answer.
