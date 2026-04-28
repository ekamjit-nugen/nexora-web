# Monolith migration playbook

This is the step-by-step recipe an engineer follows to migrate one of
the 18 microservices from `services/<name>-service/` into a feature
module in the new monolith at `services/api/src/modules/<name>/`.

The playbook is the same for every module. We've already migrated the
auth module as the reference; copy that and follow these steps.

## Pre-flight

Before you start a module migration, make sure:

- [ ] The new `services/api/` skeleton builds (`npx nest build` succeeds).
- [ ] The reference `_template` module is present at
      `services/api/src/modules/_template/` for copy-paste.
- [ ] You've decided which database name this module owns. Check
      `services/api/src/bootstrap/database/database.tokens.ts` — the
      token must already be there. If not, add it.
- [ ] You know who calls this module today. Run
      `grep -r "<name>-service" services/ --include='*.ts'` to find every
      caller. Each one becomes a `public-api` consumer.

## Step 1 — Scaffold the module folder

Copy the template:

```bash
cp -r services/api/src/modules/_template services/api/src/modules/<name>
cd services/api/src/modules/<name>
# rename the files
mv _template.module.ts <name>.module.ts
mv _template.bootstrap.ts <name>.bootstrap.ts
mv public-api/template-public-api.ts public-api/<name>-public-api.ts
mv public-api/template-public-api.impl.ts public-api/<name>-public-api.impl.ts
```

Find/replace `Template` → `<Name>` (PascalCase) and `template` → `<name>`
(kebab-case) in the new files.

## Step 2 — Move the source files

```bash
# Move the existing service's domain code into the module's internal/ folder.
mkdir -p services/api/src/modules/<name>/internal
git mv services/<name>-service/src/<name>/* services/api/src/modules/<name>/internal/
# Schemas usually live next to the source; move them to the module root
# (NOT into internal/) so they're accessible to the module file but
# still off-limits to other modules.
git mv services/api/src/modules/<name>/internal/schemas services/api/src/modules/<name>/schemas || true
git mv services/api/src/modules/<name>/internal/dto services/api/src/modules/<name>/dto || true
```

## Step 3 — Convert the AppModule into a feature module

The old `services/<name>-service/src/app.module.ts` had:
- `ConfigModule.forRoot(...)` — DELETE (provided globally by BootstrapModule)
- `MongooseModule.forRootAsync(...)` — DELETE (provided globally)
- `JwtModule.registerAsync(...)` — DELETE (provided globally)
- `MongooseModule.forFeature([...])` — KEEP, but pass the named connection:
  ```ts
  MongooseModule.forFeature([
    { name: 'User', schema: UserSchema },
    // ... etc
  ], AUTH_DB)  // <-- second arg is the connection name
  ```
- Controllers, providers, exports — KEEP, paste into `<name>.module.ts`.

Rename the class: `AppModule` → `<Name>Module`.

Wire the public API binding in the providers list:

```ts
import { <NAME>_PUBLIC_API } from './public-api';
import { <Name>PublicApiImpl } from './public-api/<name>-public-api.impl';

@Module({
  // ...
  providers: [
    // ... existing providers from app.module.ts
    { provide: <NAME>_PUBLIC_API, useClass: <Name>PublicApiImpl },
  ],
  exports: [
    <NAME>_PUBLIC_API,  // so OTHER modules can import it
  ],
})
export class <Name>Module {}
```

## Step 4 — Implement the public API

Open `public-api/<name>-public-api.ts`. Add ONE method per cross-module
need you discovered in pre-flight. Keep this list small — every method
here is a future HTTP/gRPC endpoint when the module splits.

Example for `auth`:

```ts
export interface AuthPublicApi {
  validateToken(token: string): Promise<UserContext | null>;
  getUserById(id: string): Promise<{ id: string; email: string } | null>;
  // (this is what payroll-service currently calls via HTTP — replace
  //  the call site with `@Inject(AUTH_PUBLIC_API)` once this lands)
}
```

Implement in `public-api/<name>-public-api.impl.ts` by injecting the
internal services and forwarding:

```ts
@Injectable()
export class AuthPublicApiImpl implements AuthPublicApi {
  constructor(private readonly authService: AuthService) {}

  async validateToken(token: string) {
    return this.authService.verifyAndExpand(token);
  }
}
```

Re-export from `public-api/index.ts`:

```ts
export { AuthPublicApi, AUTH_PUBLIC_API } from './<name>-public-api';
```

## Step 5 — Replace cross-service HTTP calls in callers

Find the callers (you listed them in pre-flight). For each one:

```ts
// BEFORE: external-services.service.ts
const res = await axios.get(`${HR_URL}/employees/${id}`, { headers });
return res.data;

// AFTER: inject the public API
constructor(@Inject(HR_PUBLIC_API) private readonly hr: HrPublicApi) {}
return this.hr.getEmployeeById(id);
```

Update the caller's module to import `HrModule` (the imports array will
gain access to its exported `HR_PUBLIC_API` token).

## Step 6 — Replace event-emit-then-poll patterns with EventBus

If two modules used to communicate via "service A writes a row, service
B polls a table for new rows", convert to:

```ts
// In service A
await this.eventBus.publish(makeEvent(
  'a.thing.happened',
  orgId,
  thingId,
  { thingId, ... },
));

// In service B
@OnEvent('a.thing.happened')
async handle(event: DomainEvent<ThingHappenedPayload>) {
  // ...
}
```

Define the event shape under `modules/a/events/` and re-export the type
+ name constant from `public-api/index.ts`.

## Step 7 — Wire into app.module.ts

Add the new module to `services/api/src/app.module.ts`:

```ts
@Module({
  imports: [
    BootstrapModule,
    AuthModule,
    HrModule,        // <- new line
    // ...
  ],
})
export class AppModule {}
```

## Step 8 — Build and test

```bash
cd services/api
npx nest build      # must pass
npm run lint        # must pass — boundary rules enforce no internal/ reaches
npm test            # run the tests that came with the source
```

Boot the monolith locally:

```bash
JWT_SECRET=test-secret PORT=3000 MONGODB_URI=mongodb://localhost:27017 \
  node dist/main.js
```

Hit a few endpoints — same paths as before (the global `/api/v1` prefix
is preserved).

## Step 9 — Delete the legacy service

Once the new module passes smoke tests:

```bash
git rm -r services/<name>-service
# update docker-compose.simple.yml — remove the old service block
# update services/api-gateway routes (if it had service-specific paths)
```

## Step 10 — Commit

```bash
git add services/api/ docker-compose.simple.yml
git commit -m "Migrate <name> module into the monolith"
```

---

# Common gotchas

## "MongooseModule schema not registered"
You forgot the connection-name argument on `forFeature(...)`. Every
module-owned schema must use a named connection.

## "Cannot resolve dependencies of <Service>"
A service is injecting something that lived in another microservice's
DI scope. Move that dependency through the public API of the owning
module.

## "Circular dependency between modules"
Module A imports Module B, and B imports A. Solution: extract the
shared piece into one of `packages/shared` (if it's a value/util) or
into a dedicated `kernel` module both can depend on.

## "ESLint: no-restricted-imports"
You imported from another module's `internal/` or `schemas/`. That's
the boundary rule. Add the method you need to that module's public API
instead.

## "JWT_SECRET FATAL"
The monolith refuses to start without `JWT_SECRET` set. Set it in `.env`
or via the env block in docker-compose.

---

# When you've migrated all 18 modules

- [ ] All 18 entries in `app.module.ts`'s imports array
- [ ] `services/<name>-service/` folders all deleted (verify
      `ls services/ | grep -- '-service$'` returns nothing except
      `api-gateway`)
- [ ] `docker-compose.simple.yml` has one `api` service instead of 18
- [ ] `services/api-gateway` either removed (the monolith IS the gateway)
      or reconfigured to be a thin TLS terminator
- [ ] Frontend `.env` `NEXT_PUBLIC_API_URL` points at the monolith
- [ ] CI/CD pipeline replaced — one build, one image, one deploy

## Production cutover sequence (zero-downtime)

1. Deploy the monolith ALONGSIDE the existing 18 services on a new
   path/subdomain (e.g. `api-v2.nexora.io`).
2. Mirror frontend traffic — 1% → 5% → 25% → 50% → 100% via feature
   flag or load-balancer weight.
3. Watch error rates / latency. The monolith should be FASTER (no
   inter-service HTTP overhead).
4. Once 100% on the monolith for 7 days, decommission the legacy
   services and the API gateway.
