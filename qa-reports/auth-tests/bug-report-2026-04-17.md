# Auth QA — Bug Report

**Date:** 2026-04-17
**Executed by:** QA run against `auth-flows-and-test-cases.md`
**Environment:** API Gateway `localhost:3005`, MailHog `localhost:8025`, MongoDB container
**Scope:** All 10 phases, 2 orgs × 10 members, multi-org user (Bob), segregation, edge cases
**Raw results:** `/tmp/auth-qa/run.log`, `/tmp/auth-qa/results.json`

---

## Headline numbers

| Phase | Description | Pass / Total |
|---|---|---|
| P1 | Alpha owner onboarding | 13 / 16 (2 false-negatives, see test-plan-nits) |
| P2 | Invite 9 Alpha members | 19 / 19 |
| P3 | Alpha directory pre-accept | 1 / 3 (counts wrong due to **Bug #1**) |
| P4 | Accept 9 Alpha invitations | 45 / 45 |
| P5 | Alpha directory post-accept | 3 / 4 |
| P6 | Beta + Bob cross-org | 44 / 47 |
| P7 | Org segregation | 1 / 5 (**Bug #1**) |
| P8 | Multi-org Bob | All pass on re-run; original failures were rate-limit timing (**Bug #2**) |
| P9 | Re-login | 2 / 2 |
| P10 | Edge cases | 6 / 9 |

**Total: 6 real bugs filed; 1 P0, 2 P1, 1 P2, 3 P3.**

---

## Bug #1 — P0: Null-org JWT dumps every employee across all tenants

**Severity:** **P0 — Blocker / Security**
**Reproducible:** 100%
**Affected endpoint:** `GET /api/v1/employees`

### Steps to reproduce
1. Sign up any email (no domain restriction) → `POST /api/v1/auth/send-otp`.
2. Retrieve OTP.
3. `POST /api/v1/auth/verify-otp` → receive `accessToken`. JWT payload at this stage is:
   ```json
   { "sub":"<uid>", "email":"attacker@...", "organizationId": null, "setupStage":"otp_verified", ... }
   ```
4. Before creating any organization, call:
   ```
   GET /api/v1/employees?limit=100
   Authorization: Bearer <accessToken>
   ```
5. Response `200 OK` with **all 78 employees across every organization**, including the 58 Nugen IT Services production-like employees:
   ```json
   byOrg = {
     "69e270fda29cafd9ce3c4952": 1,   // Alpha Corp duplicate
     "69e270f5a29cafd9ce3c47ba": 9,   // Beta Labs
     "69e270f0a29cafd9ce3c4631": 10,  // Alpha Corp
     "6600000000000000000000a0": 58   // Nugen IT Services
   }
   ```

PII exposed per record: `email`, `firstName`, `lastName`, `phone`, `dateOfBirth`, `gender`, `departmentId`, `designationId`, `teamId`, `reportingManagerId`, `organizationId`, `userId`, `employeeId`.

### Why it's critical
- Any anonymous person can sign up (OTP-only, no domain/invite gating for the sign-up itself) and immediately exfiltrate every employee directory in the system.
- The `x-organization-id` request header is **not validated against JWT memberships** (a further concern, but moot here because the endpoint already ignores scoping when JWT has no org).
- Breaks P0 of the severity definition in the test plan: *"data leak across orgs"*.

### Expected behaviour
- If JWT has `organizationId: null`, `/api/v1/employees` must return `401/403` (or an empty list scoped to `organizations[]` on the user record — which is empty for a fresh user).
- Additionally, when JWT's `organizationId` is set, the service must **reject** any `x-organization-id` header that does not match (or verify the user has an active membership in that org). Currently the header is silently ignored, which is fine for this bug, but a defence-in-depth gap regardless.

### Suggested fix location
`services/hr-service` list-employees handler — require a non-null `req.user.organizationId` (or `req.scope.organizationId` derived from verified membership) and filter by it; 401 otherwise.

---

## Bug #2 — P1: Input validation missing — malformed auth requests return HTTP 500

**Severity:** P1 — Critical (stability, bad UX, possible info-leak vector, telemetry correlation broken)
**Reproducible:** 100%
**Affected endpoints:**
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`

### Evidence
```
POST /send-otp  body: {}                → 500 INTERNAL_ERROR
POST /send-otp  body: (none)            → 500 INTERNAL_ERROR
POST /send-otp  body: {"email":"not-an-email"} → 500 INTERNAL_ERROR
POST /send-otp  body: {"email": null}   → 500 INTERNAL_ERROR
POST /send-otp  body: {"email": 12345}  → 500 INTERNAL_ERROR
POST /verify-otp body: {}               → 500 INTERNAL_ERROR
```

All return the same generic payload:
```json
{ "success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"},
  "meta":{"timestamp":"…","requestId":"unknown"} }
```

### Expected
`400 Bad Request` with per-field validation detail (DTO / class-validator should already cover this). `create-org` does reject `{}` with `400` — so validators exist, they're just not wired up on the OTP routes.

### Secondary issue: `requestId: "unknown"`
Error responses carry `requestId: "unknown"` rather than the normal UUID, breaking trace correlation between gateway logs and service logs for failed requests.

---

## Bug #3 — P1: Cross-org invite acceptance doesn't create HR employee record

**Severity:** P1 — Critical (data inconsistency, directory drift)
**Reproducible:** 100%
**Affected flow:** Phase 6 — existing user (Bob) accepting invite to a second org

### Steps to reproduce
1. Bob (`dev1.alpha@test.nexora.io`) already fully onboarded in Alpha Corp, `setupStage=complete`, HR employee record exists in Alpha.
2. Beta owner invites Bob → `orgmembership` row created (status=`pending`, role=`developer`).
3. Bob accepts via `POST /api/v1/auth/invites/<token>/accept` → `200 OK`, membership flips to `active`.

### Observation
DB state after acceptance:
```
nexora_auth.orgmemberships  → 10 active rows for Beta Labs (including Bob)  ✓
nexora_hr.employees         → 9 docs for Beta Labs (Bob is MISSING)         ✗
```
```
Beta HR employees:
  owner.beta@test.nexora.io
  dev1.beta@test.nexora.io
  …
  intern2.beta@test.nexora.io
  (9 total — no dev1.alpha / Bob)
```
Consequence: Bob can log into Beta (switch-org works, JWT carries Beta org), but when he opens the Beta directory he sees **9 colleagues including himself missing**, and he does not appear in `/employees?status=active` for Beta at all. The test plan's TC-6.2 DB-verify fails:
> "Bob has employee record in BOTH orgs, both status: 'active'"

### Expected
Accept-invite flow must upsert an HR employee record in the target org when the user doesn't already have one. Net-new invites already do this (TC-2.3 passes); the existing-user path misses it.

### Suggested fix location
`services/auth-service` invite-accept handler — after membership flip, always call into HR service to upsert `{ userId, organizationId }` employee doc. The code-path that creates employees on net-new invites (`status: "invited"`) should be extended to the existing-user branch.

---

## Bug #4 — P2: Verify-OTP route logic ignores pending invites for existing active users

**Severity:** P2 — Major (wrong onboarding route, but recoverable)
**Reproducible:** 100%
**Affected endpoint:** `POST /api/v1/auth/verify-otp`

### Steps to reproduce
1. Bob is `active` in Alpha (`setupStage=complete`, 1 active membership).
2. Beta invites Bob → Bob has **1 active + 1 pending** membership.
3. Bob does OTP login.
4. Response:
   ```json
   { "route": "/dashboard", "routeReason": "single_active_org" }
   ```

### Expected (per TC-4.4 / TC-6.2.4)
```json
{ "route": "/auth/accept-invite", "routeReason": "pending_invite" }
```
Because Bob has a pending invite he needs to decide on, the frontend would otherwise silently drop him into the Alpha dashboard and he'd never know a Beta invite exists.

### Fix note
Route resolver should prefer `pending_invite` over `single_active_org` / `multi_org` when at least one pending membership exists.

---

## Bug #5 — P3: User enumeration via `verify-otp` response codes

**Severity:** P3 — Minor (information disclosure)
**Reproducible:** 100%
**Affected endpoint:** `POST /api/v1/auth/verify-otp`

### Evidence
Sending user A's OTP with user B's email (user B not in DB):
```
POST /verify-otp body: { "email":"other@test.nexora.io","otp":"441832" }
→ 404 { "error": { "code":"USER_NOT_FOUND","message":"User not found" } }
```
An attacker can enumerate which emails exist by diffing `404 USER_NOT_FOUND` vs `401 INVALID_OTP`. Combined with the lack of rate limiting across emails, this is a cheap account-enumeration oracle.

### Expected
Return a single generic `401 INVALID_OTP` (or `400`) regardless of whether the email exists.

---

## Bug #6 — P3: Duplicate organisation names silently allowed

**Severity:** P3 — Minor (policy ambiguity — document or reject)
**Reproducible:** 100%
**Affected endpoint:** `POST /api/v1/auth/organizations`

### Evidence
After a fresh user runs through OTP, creating an org with `name: "Alpha Corp"` (already exists) returns `201 Created`. DB now has:
```
69e270f0a29cafd9ce3c4631  Alpha Corp
69e270fda29cafd9ce3c4952  Alpha Corp    ← duplicate
```
Test plan TC-10.4 explicitly calls this out: *"Either 409 (conflict) or 201 (allows duplicates — document which)"*. Currently undocumented. If duplicates are by-design (multi-tenant with tenant-scoped identity), close this as wontfix and document; otherwise add a unique index + 409 path.

---

## Additional observations (not filed as bugs, worth knowing)

### A. OTP cooldown UX
- `send-otp` enforces a per-email cooldown of ~1s and returns `429 { code: "OTP_COOLDOWN", message: "Please wait 1 seconds before requesting a new OTP." }`.
- No `Retry-After` header is set.
- Message grammar ("1 seconds") is a minor polish item.
- In sequential testing the runner triggered cooldown several times even when pacing at 200-400 ms; a legitimate user double-clicking "Resend" will hit this.
- No global per-email rate limit beyond the 1s cooldown was observed across 10 rapid requests — at ~60/min sustained, the OTP endpoint is still a realistic brute-force surface. Consider a sliding-window cap (e.g. 5 requests / 10 min / email + per-IP cap).

### B. `x-organization-id` header is ignored
When JWT has an `organizationId`, the service trusts the JWT and **ignores** any `x-organization-id` header value (including garbage like `ffffffffffffffffffffffff`). This is actually safer than trusting the header, but it means:
- Any per-request org-switching UX that relies on the header will silently no-op. Frontend should only rely on `POST /api/v1/auth/switch-org` + new token.
- Document the contract so future work doesn't accidentally start honouring the header unsafely.

### C. Test plan nits (not backend bugs)
Two test cases in the plan are mis-specified and should be corrected:
- **TC-1.3** expects `isNewUser: true` on verify-otp. Because `send-otp` already creates the user row (so OTP can be stored and rate-limited per email), the user exists by the time `verify-otp` runs. Current API returns `isNewUser: false`, which is internally consistent. Either change the API to compute `isNewUser` from `setupStage === 'otp_verified' && organizations.length === 0` (recommended), or update the test to expect `false`.
- **TC-6.0.7 / TC-1.7** re-login failures in my run were caused by the OTP cooldown (Bug #2's sibling). Re-running with ≥1.5 s spacing consistently returns `route: "/dashboard", routeReason: "active_user"`. The flow itself works.

---

## Priority-ordered fix list

1. **Bug #1 — P0**: Require verified org scope on `/employees` (null-org JWT must not list anyone). Ship first, it's a tenant isolation failure.
2. **Bug #2 — P1**: Wire DTO validation onto `/auth/send-otp` and `/auth/verify-otp`; ensure `requestId` is populated on error paths.
3. **Bug #3 — P1**: Extend accept-invite to upsert HR employee doc for existing users joining a new org.
4. **Bug #4 — P2**: Prefer `pending_invite` routing over `single_active_org` / `multi_org`.
5. **Bug #5 — P3**: Collapse 404/401 on verify-otp into a single 401.
6. **Bug #6 — P3**: Document or enforce duplicate-org-name policy.

---

## Appendix: full results

| File | Purpose |
|---|---|
| `/tmp/auth-qa/runner.mjs` | Phase 1-10 harness |
| `/tmp/auth-qa/run.log` | Full test output |
| `/tmp/auth-qa/results.json` | Machine-readable pass/fail ledger |
| `/tmp/auth-qa/probe4.mjs` | Null-org JWT leak reproducer (Bug #1) |
| `/tmp/auth-qa/probe6.mjs` | Input-validation reproducers (Bugs #2, #5) |
| `/tmp/auth-qa/probe7.mjs` | Multi-org Bob reproducer (Bug #3 evidence) |

---

# Addendum — UI QA via preview (`frontend` at localhost:3000)

After the API-level run, the web UI was driven end-to-end against the same backend to confirm user-visible behaviour. Frontend pointed at `http://localhost:3005` via `frontend/.env.local`.

## Summary of UI flows exercised

| # | Flow | Result |
|---|---|---|
| U-1 | Existing-user login (`lead.alpha`) → OTP → `/dashboard` | ✅ Works. Dashboard greets "Good evening, Diana!", shows Alpha Corp, Team Members = 10. |
| U-2 | New user sign-up (`ui.newuser@…`) → OTP → `/auth/setup-organization` | ✅ Routes correctly; 3-step wizard (Organization → Profile → Team) rendered. |
| U-3 | Invite accept flow (unauthenticated click on invite URL) | ✅ `/auth/accept-invite?token=…` saves `postLoginRedirect` in localStorage, bounces to `/login`, and after OTP returns to the invite screen. "Accept & Join" → `/dashboard`. Team Members goes from 10 → 11. |
| U-4 | Invalid-OTP toast | ✅ Backend 400 `INVALID_OTP` surfaces as a Sonner toast "Invalid OTP. Please try again." |
| U-5 | Invalid email format | ✅ Blocked client-side by `<input type="email">` — no backend call, so the 500-on-malformed-email backend bug (Bug #2) isn't triggered through this UI path. |
| U-6 | Multi-org login (Bob) → `/auth/select-organization` | ✅ Shows Alpha Corp + Beta Labs cards, click routes to `/dashboard` with Beta in JWT. |
| U-7 | In-app org switcher in sidebar | ✅ Dropdown with both orgs and "Create New Organization" option; click switches JWT.organizationId and reloads dashboard. |

## UI-specific findings

### UI-1 (maps to Bug #1, confirmed via browser) — P0

**`/directory` is reachable by a freshly-OTP-verified user who has not created an org.** Tested in the actual UI — no DevTools required, just typing the URL in the address bar after stopping at the "Create Your Organization" wizard.

Reproduction:
1. Land on `/login`, enter a brand-new email, receive OTP, verify.
2. Frontend routes to `/auth/setup-organization` (correct per backend route resolver).
3. Without touching the wizard, change URL to `/directory`.
4. Page renders **Employee Directory — Total Employees: 78**, with cards for every user across Alpha Corp, Beta Labs, and Nugen IT Services (the production-like tenant with 58 staff). First visible cards include "Sara Intern", "Raj Intern", "Quinn Designer", "Priya Admin", "Omar HR", "Nora Lead" — all from Beta, not the attacker's non-existent org.

Two aggravating factors specific to the UI:
- The setup-organization wizard renders as a modal **over the full authenticated-user chrome**. The sidebar (Directory, My Work, Projects, Tasks, Attendance, …) is painted and clickable behind the modal dimming. Any accidental click outside the modal navigates into the leaked data.
- The sidebar user tile shows "Pending User" because no profile exists yet — meaning the attacker's own identity is barely reified in the UI, while they can browse everyone else's.

Screenshots saved as part of the QA run — first-page directory content verified manually in the preview browser.

### UI-2 (maps to Bug #3) — P1

**Bob Builder logged into Beta Labs and the Beta directory shows 9 employees, missing himself.**

Steps:
1. Log in as `dev1.alpha@test.nexora.io` (Bob, multi-org).
2. `/auth/select-organization` → click Beta Labs.
3. Navigate to `/directory` — header reads "Total Employees: 9 / Active: 9".
4. Scroll — no "Bob Builder" card. Sidebar lower-left still says "Bob Builder / User", the user who is logged in and browsing this directory.

For comparison, switching to Alpha Corp via the in-app switcher shows "Team Members: 11" on the dashboard (10 original + UI Invitee from U-3), and Bob appears there correctly.

Root cause same as Bug #3: accept-invite for an existing user doesn't upsert an HR employee record in the target org.

### UI-3 (new) — P3

**Dashboard widget repeatedly fires failing requests without surfacing or backing off.**
Every `/dashboard` load produces three identical `GET /api/v1/announcements?limit=5&sort=-createdAt → 400 Bad Request`. No toast, no error UI — but the widget is also empty/stuck in whatever default state. Either:
- the `sort=-createdAt` syntax is not accepted by the announcements service and the frontend should drop it, or
- the endpoint's validator is too strict and should accept Mongo-style `-` prefix sort.
Either way, 3× duplicate calls per dashboard paint is wasteful and needs dedup/caching.

### UI-4 (new) — P3

**Onboarding wizard renders behind-app chrome.** The "Create Your Organization" modal is overlaid on top of the full authenticated dashboard chrome (sidebar nav, searchbox, user tile). Given UI-1 / Bug #1, this directly invites the user (or attacker) to click the exposed nav items and reach leaked data. Fix: render the onboarding wizard as a bare page (like `/login`) rather than as a modal on `/dashboard`.

### UI-5 (new) — P3

**No user-visible error for invalid email format, but no API error either.** The native `<input type="email">` blocks submit silently for malformed addresses. That's fine for typos, but it means the backend's 500-on-malformed-email (Bug #2) is never reproducible through the UI — which is good for users but dangerous if any part of the stack ever takes input from elsewhere (mobile app, copy-paste with trailing whitespace, API directly). The backend must still be fixed.

## What the UI does well

- Sonner toast used consistently for error and success — Bug #4's bad route was still benign because the user ends on dashboard, not stuck on an error screen.
- JWT management via `localStorage.accessToken` is straightforward and inspectable; no `httpOnly` cookie shenanigans to debug.
- `postLoginRedirect` round-trip for invite-from-email-while-logged-out is clean and survives OTP.
- In-app org switcher dropdown includes both orgs and a "Create New Organization" affordance — nicer UX than having to log out to switch.

## Updated priority list after UI QA

1. **Bug #1 / UI-1 — P0**: Require verified org scope on `/employees` + block `/directory` and other org-scoped routes for null-org users on the frontend. Short-term: also guard with a route guard on the client so `/directory` 302s back to `/auth/setup-organization` when JWT.organizationId is null.
2. **Bug #3 / UI-2 — P1**: Upsert HR employee on cross-org invite accept.
3. **UI-4 — P3**: Render onboarding wizard as a standalone page, not a modal atop dashboard chrome.
4. **UI-3 — P3**: Fix or dedupe the `announcements?sort=-createdAt` 400 loop.
5. Everything else from the original list unchanged.
