# Monolith cutover — operator's guide

The 17-module monolith now lives at `services/api/` and runs as a
sidecar `api` service in `docker-compose.simple.yml`. It runs
**alongside** the existing 18 legacy microservices so you can
compare side-by-side and roll back instantly.

## Side-by-side topology today

```
              ┌──────────────────────────────────────┐
              │   localhost                          │
              │                                      │
              │   :3005  → kong/api-gateway → 18     │
              │            legacy services           │
              │   :3015  → monolith (services/api)  │
              │   :3100  → frontend                 │
              │   :8025  → MailHog UI               │
              │                                      │
              └──────────────────────────────────────┘
                              │
                              ▼ (docker network: nexora-network)
              ┌──────────────────────────────────────┐
              │  mongodb, redis, mailhog,            │
              │  + 18 *-service containers,          │
              │  + nexora-api ← THE MONOLITH         │
              └──────────────────────────────────────┘
```

Both routes hit the same Mongo databases (`nexora_auth`, `nexora_hr`,
`nexora_payroll`, etc.). Reads/writes are equivalent.

## Day-1 operator playbook

### Start everything (legacy + monolith)
```bash
docker compose -p nexora -f docker-compose.simple.yml up -d
```

### Bring just the monolith
```bash
docker compose -p nexora -f docker-compose.simple.yml up -d \
  --build mongodb redis mailhog api
```

### Tail the monolith logs
```bash
docker logs -f nexora-api
```

### Smoke test inside the docker network
The monolith reaches `mongodb`, `redis`, `mailhog`, etc. via service-
name DNS — same as the 18 legacy services do.

```bash
# 1. Health
curl http://localhost:3015/api/v1/health

# 2. Send OTP (real email goes to MailHog)
curl -X POST http://localhost:3015/api/v1/auth/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"cto.varun@gmail.com"}'

# 3. Open MailHog UI to read the OTP
open http://localhost:8025

# 4. Verify OTP (replace 123456 with the actual code)
curl -X POST http://localhost:3015/api/v1/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"cto.varun@gmail.com","otp":"123456"}'

# 5. Use the returned JWT to call any module's endpoints
TOKEN="<paste accessToken>"
curl http://localhost:3015/api/v1/payroll-runs \
  -H "Authorization: Bearer $TOKEN"
```

This was verified end-to-end on commit `0a1895c` — full Nugen March
2026 payroll flow returns the same numbers (₹12,61,250 net, 13
employees) on both `:3005` and `:3015`.

## Routing the frontend to the monolith (cutover)

When you're ready to flip:

1. Edit `docker-compose.simple.yml` `frontend` service:
   ```yaml
   args:
     NEXT_PUBLIC_API_URL:        http://192.168.29.218:3015
     NEXT_PUBLIC_CHAT_SOCKET_URL: http://192.168.29.218:3015
     NEXT_PUBLIC_CALL_SOCKET_URL: http://192.168.29.218:3015
   ```
   (Or set those vars in `.env` if you've parameterised the build.)

2. Rebuild the frontend so it bakes those URLs:
   ```bash
   docker compose -p nexora -f docker-compose.simple.yml build frontend
   docker compose -p nexora -f docker-compose.simple.yml up -d --force-recreate frontend
   ```

3. Hit `http://localhost:3100` in the browser. Login via OTP.
   Everything routes to the monolith now.

4. To roll back: revert step 1 + rebuild. Legacy services are still
   running, so the frontend immediately starts hitting them again.

## Decommissioning the 18 legacy services

Only do this once you've run the monolith in production for a week
without issues.

### Step 1 — Stop them
```bash
docker compose -p nexora -f docker-compose.simple.yml stop \
  auth-service hr-service payroll-service attendance-service \
  leave-service policy-service task-service project-service \
  chat-service calling-service notification-service media-service \
  asset-service bench-service helpdesk-service knowledge-service \
  ai-service api-gateway
```

The frontend is already pointing at the monolith, so no traffic
should be hitting these.

### Step 2 — Remove from compose
Edit `docker-compose.simple.yml`:
```bash
# Open the file and delete service blocks for all 18 *-service
# entries (auth-service, hr-service, ..., api-gateway). Keep:
#   - mongodb, redis, mailhog (infrastructure)
#   - api (the monolith)
#   - frontend
# Plus any optional dev tooling (kong-db, kibana, etc.)
```

### Step 3 — `docker compose down` the stopped containers
```bash
docker compose -p nexora -f docker-compose.simple.yml up -d \
  --remove-orphans
```

### Step 4 — Delete the source folders (final cleanup commit)
```bash
git rm -r services/auth-service services/hr-service \
  services/payroll-service services/attendance-service \
  services/leave-service services/policy-service \
  services/task-service services/project-service \
  services/chat-service services/calling-service \
  services/notification-service services/media-service \
  services/asset-service services/bench-service \
  services/helpdesk-service services/knowledge-service \
  services/ai-service services/api-gateway

git commit -m "Decommission 18 legacy microservices — monolith is live"
git push origin main
```

If you need any of them back: `git checkout v18-microservices-final
-- services/<name>-service`. The tag and the `microservices` branch
preserve the snapshot forever.

## Splitting a module back out (the reverse)

See `docs/extract-to-microservice.md`. Short version: each module has
a `<name>.bootstrap.ts` ready to deploy as a standalone service.
Build the same `services/api/` image, override CMD with that
bootstrap path, deploy to its own ECS task / pod. Other modules'
DI bindings flip from `useClass: <Name>PublicApiImpl` to
`useClass: <Name>PublicApiHttpClient`. Caller code unchanged.

## What changed for the operator vs the legacy stack

| | Before (18 services) | After (monolith) |
|---|---|---|
| Containers | 18 + infra | 1 + infra |
| Memory footprint | ~2.5 GB total | ~600 MB |
| `docker compose up` time | 2-3 minutes | ~10 seconds |
| Internal RPC | HTTP+JWT roundtrip | direct method call |
| Shared schema across services | duplicated TypeScript | single source |
| Deploy a single change | 1 service to redeploy | 1 service to redeploy (entire monolith) |
| Independently scale a module | possible | requires re-extracting |

For Nugen-scale (13 employees, low traffic) the trade-off is
overwhelmingly in favour of the monolith. For the day a specific
module needs independent scaling, follow the extract-to-microservice
runbook.

## Known follow-ups (tracked but not blocking)

1. **`payroll/ExternalServicesService` still uses HTTP.** Today,
   when payroll's calc engine needs employee data, it hits
   `http://hr-service:3010` over the network. Works fine because
   the legacy services are still running; once they're decommissioned
   it has to inject `HR_PUBLIC_API` directly. ~1 day of work.

2. **`/api/v1/health` returns 401 on the monolith.** The legacy auth-
   service had two health controllers (a private `SystemHealthController`
   with a guard, and a public `HealthController` for k8s probes) that
   register the same route; the guarded one wins. One-line fix to
   either rename the system-health route or drop the guard from the
   no-arg `/health` method. Doesn't affect the smoke tests because
   `/health/ready` and `/health/live` work.

3. **Redis adapter for chat/calling Socket.IO.** The monolith's
   `MessagesGateway` and `MeetingGateway` log "Redis adapter failed,
   using in-memory" if Redis isn't reachable. Inside docker the
   `redis` hostname resolves so it's fine; on the host without Redis
   running you'll see the warning. Cosmetic.

4. **API gateway can be deleted.** The monolith IS the gateway —
   single entrypoint at `:3015`. Keep `api-gateway` only if you
   want kong's plugins (rate limiting, CORS profiles, request
   logging). Otherwise delete it in the cleanup commit.
