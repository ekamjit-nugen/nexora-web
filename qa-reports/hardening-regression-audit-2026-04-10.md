# Nexora Hardening Regression Audit

**Auditor:** Vegeta, QA Sentinel
**Date:** 2026-04-10
**Target commits:** `0041894`, `a4110d1`, `eba3ae2`
**Scope:** Re-audit of the 25 security/business-logic fixes landed today against the specific files touched.

## Executive Summary

| Severity | Count | Notes |
|----|---|----|
| **CRITICAL** | 4 | Two feature-bricking regressions, one bypass, one double-fire race |
| **HIGH** | 7 | Real bypasses and incomplete fixes |
| **MEDIUM** | 8 | Gaps, timing oracles, stale semantics |
| **LOW / INFO** | 6 | Hardening nits |
| **Total** | **25** |  |

**Headline:** The fixes mostly hold. But **two are entirely broken** — SCIM and peer reviews — because the service logic gates on schema fields/endpoints that were never wired up. Fix those before calling the hardening batch done. The rest are real-but-narrower regressions, mostly around SSRF edge cases, timing oracles, and unvalidated schema paths.

TypeScript builds are clean for all three services. No new `void asyncFn()` silencing. 16 new `as any` casts introduced, most unavoidable (`Model<any>` injection), but several mask real bugs (see S-BH03).

---

## CRITICAL (4)

### S-BH04 — submitPeerReview is unreachable (feature bricked)
**File:** `services/payroll-service/src/payroll/payroll.service.ts:5544`
**Confirmed.** The peer-review authorization fix gates on `review.assignedPeerReviewerIds.includes(userId)`. The schema field was added, defaults to `[]`, and **no endpoint or service method was added to populate it**. I grep'd the entire auth/payroll tree: no `assignPeerReviewers`, no setter, not a single write site. Every peer review submission will 403 forever.

**Repro:**
```bash
POST /payroll/reviews/:id/peer-review  # → 403 "You are not assigned as a peer reviewer"
# No way to fix from the product UI because the endpoint doesn't exist.
```

**Fix:** Add `assignPeerReviewers(reviewId, reviewerIds[], userId, orgId)` with cycle-admin auth, plus a controller route `PATCH /payroll/reviews/:id/peer-reviewers`. Also backfill: for existing reviews in active cycles, populate the roster from cycle config (or mark everyone on the team as eligible — with an admin opt-in). Migration for in-flight reviews required before this can ship.

---

### S-BH16 — SCIM feature unreachable (no token provisioning endpoint)
**File:** `services/auth-service/src/auth/scim.service.ts:72`, `services/auth-service/src/auth/schemas/organization.schema.ts:434-435`
**Confirmed.** `validateToken` requires `org.scimEnabled === true` AND `org.scimTokenHash` to be set. Defaults are `false` / `null`. There is **no controller or service method that sets either field** — not in `organization.service.ts`, not in `settings.controller.ts`, not in `scim.controller.ts`, not anywhere under `auth-service/src/`. Every SCIM request will 401 with "SCIM provisioning is not enabled" for all orgs, forever.

**Repro:**
```bash
POST /scim/v2/Users   # → 401
# No UI or API path to enable SCIM or issue a token.
```

**Fix:** Add `OrganizationService.enableScim(orgId, userId)` that flips `scimEnabled=true`, generates a 32-byte random secret, stores `sha256(secret)` as `scimTokenHash`, and returns `scim_<orgId>_<secret>` ONCE. Also add `disableScim()` and `rotateScimToken()`. Gate behind owner/admin RBAC and audit-log the issue events.

---

### S-BH01 — Bank payout failed-reclaim race (double-fire bypass)
**File:** `services/payroll-service/src/payroll/bank-payout.service.ts:264-324`
**Confirmed.** The atomic reservation via `findOneAndUpdate({idempotencyKey}, {$setOnInsert}, {upsert: true})` IS atomic for the initial insert. But when an existing doc is already in status `failed`, the flow drops into a **non-atomic check-then-save**:

```typescript
if (reservation.status === 'failed') {
  reservation.status = 'pending';
  reservation.retryCount = (reservation.retryCount || 0) + 1;
  await reservation.save();   // ← race window
}
// ... then later: await this.provider.initiatePayout(payoutReq)
```

Two concurrent bulk calls both observe `status='failed'`, both set `status='pending'`, both save, **both call Razorpay with the SAME `idempotencyKey`**. Razorpay's idempotency header will deduplicate the second call, but **only if the first call is already in Razorpay's cache**. Under sub-second concurrency on the same bank account, both requests can reach Razorpay before the first is cached → real double-fire.

**Repro:** Trigger `initiateBulkPayout` twice in rapid succession for a run with a previously-failed entry (e.g., via a hung frontend retry). Both reach `provider.initiatePayout` in parallel.

**Fix:** Make the failed-reclaim step atomic too:
```typescript
const claimed = await this.bankTransactionModel.findOneAndUpdate(
  { idempotencyKey, status: 'failed' },
  { $set: { status: 'pending', failureReason: null, failedAt: null },
    $inc: { retryCount: 1 },
    $push: { auditTrail: {...} } },
  { new: true },
);
if (!claimed) continue; // another caller already claimed it
```

---

### S-BH08 — Certificate-number TOCTOU race (the "fix" didn't fix it)
**File:** `services/payroll-service/src/payroll/payroll.service.ts:7191-7233`
**Confirmed.** `generateCertificateNumber` probes `certificateModel.exists({certificateNumber: candidate})` and returns the candidate STRING. The actual `cert.save()` happens later in `issueCertificate` at line 7296. Between the probe and the save, a concurrent completion can claim the same number:

```
Caller A: probe("CERT-2026-000042") → free → return "CERT-2026-000042"
Caller B: probe("CERT-2026-000042") → free → return "CERT-2026-000042"
Caller A: cert.save(...042)  → OK
Caller B: cert.save(...042)  → E11000 duplicate key → 500 error
```

The retry loop only retries the probe, not the actual insert. MongoDB's unique index protects the DB (no duplicates), but the losing caller crashes mid-quiz-submit, leaves enrollment in `completed` status with no certificate, and reports 500 to the learner.

**Fix:** Put `generateCertificateNumber` + `cert.save()` in a single retry loop that catches `E11000` on `cert.save()` and retries the whole sequence. Or use a dedicated `Counter` collection:
```typescript
const counter = await this.counterModel.findOneAndUpdate(
  { _id: `cert:${orgId}:${year}` },
  { $inc: { seq: 1 } },
  { upsert: true, new: true, setDefaultsOnInsert: true },
);
const certNumber = `CERT-${year}-${String(counter.seq).padStart(6, '0')}`;
// No probe, no race, single atomic increment.
```

---

## HIGH (7)

### S-BH02 — Bulk reclaim reuses Razorpay idempotency key, gets stale result
**File:** `services/payroll-service/src/payroll/bank-payout.service.ts:341`
**High Confidence.** When bulk reclaim fires on a previously-failed entry, it passes the **original** `idempotencyKey` to Razorpay (line 341 uses `idempotencyKey` from line 231, which is `${payrollRunId}_${entry.employeeId}` — no retry suffix). Razorpay's idempotency cache returns the SAME failed result, so retries via bulk are no-ops for 24h. Only the `retryPayout` manual path uses a fresh `_r<n>` suffix (line 483). The two paths are inconsistent.

**Fix:** Bulk reclaim should mint a `_r<retryCount>` suffix like `retryPayout` does.

### S-BH03 — Review phase deadlines read non-existent schema fields
**File:** `services/payroll-service/src/payroll/payroll.service.ts:5565-5568` and `:5641-5644`
**Confirmed.** The deadline fix reads `(cycle as any).phases?.peerReview?.endDate || (cycle as any).phaseDeadlines?.peerReview || cycle.endDate`. Neither `phases` nor `phaseDeadlines` exist on `ReviewCycleSchema` — the real fields are top-level `peerReviewDeadline` and `managerReviewDeadline` (grep `review-cycle.schema.ts:45,89`). The `as any` casts hide the typo. The deadline check silently collapses to `cycle.endDate`, so "peer review phase has ended" never fires until the cycle itself ends.

**Fix:** Replace with `cycle.peerReviewDeadline || cycle.endDate` (and similarly for manager). Strip the `as any`.

### S-BH10 — DNS rebinding bypass in webhook SSRF guard
**File:** `services/auth-service/src/auth/webhook-endpoint.service.ts:70,169`
**Confirmed.** `assertSafeWebhookUrl` resolves the hostname via `dns.lookup` at dial time, but then `fetch(endpoint.url, ...)` **does its own DNS lookup** internally. An attacker controlling a DNS server can return a public IP for the first lookup (passes the guard) and the internal `169.254.169.254` for the second. Classic DNS rebinding.

**Repro:** Attacker registers `evil.example.com` with a zone that returns `1.2.3.4` on first query and `169.254.169.254` on second query. POST that URL as a webhook. Trigger any event. The delivery fetches AWS IMDS and the response body (with IAM credentials) is recorded in `endpoint.lastError` (if it fails) or forwarded to Razorpay (no, wait — but it can be correlated by timing).

**Fix:** Resolve the hostname once, then call `fetch` against the **IP** with a `Host:` header set to the original hostname. Or use a custom `Agent` that pre-resolves and pins. The `undici` library supports `lookup` hook for this.

### S-BH11 — IPv6 loopback bypass via expanded form
**File:** `services/auth-service/src/auth/webhook-endpoint.service.ts:100`
**Confirmed.** The check compares `normalized === '::' || normalized === '::1'`. But `net.isIPv6` accepts `0:0:0:0:0:0:0:1` (expanded form) as valid IPv6. `dns.lookup('0:0:0:0:0:0:0:1')` returns the expanded string verbatim. None of the prefix checks (`fe80:`, `fc`, `fd`, `ff`) match. Returns false → SSRF passes.

**Repro:** POST `http://[0:0:0:0:0:0:0:1]:8080/admin` as a webhook URL. Passes validation, hits localhost.

**Fix:** Canonicalize IPv6 addresses before comparison. E.g., `const canonical = new URL('http://[' + address + ']/').hostname;` or parse into a Buffer and compare bytes. Safer: check if the first 15 bytes are zero and the last byte is 1.

### S-BH12 — IPv4-mapped IPv6 hex form bypass
**File:** `services/auth-service/src/auth/webhook-endpoint.service.ts:104`
**Confirmed.** The regex `^::ffff:([0-9.]+)$` only catches the dotted-decimal form `::ffff:127.0.0.1`. It does not catch the hex form `::ffff:7f00:1` (equivalent to `::ffff:127.0.0.1`), `::127.0.0.1` (deprecated IPv4-compatible IPv6), or `::7f00:1`. All of these route to loopback.

**Fix:** Parse IPv6 into bytes, check if bytes 10-11 are `0xff 0xff` and bytes 12-15 are a private IPv4 range. Or simpler: reject ALL IPv6 addresses with leading zeros (no legitimate webhook uses `::ffff:` or `::<IPv4>`).

### S-BH06 — Anonymous survey HMAC secret has two bad fallbacks
**File:** `services/payroll-service/src/payroll/payroll.service.ts:6341-6342`
**Confirmed.**
```typescript
const anonymousSecret =
  process.env.SURVEY_ANONYMOUS_SECRET || process.env.JWT_SECRET || 'nexora-survey-fallback';
```
Two problems:
1. The hardcoded fallback `'nexora-survey-fallback'` is in the public git history. If a deployment forgets to set both env vars, the HMAC is computable by anyone with the source.
2. Reusing `JWT_SECRET` as the survey HMAC key is cross-purpose key reuse. Rotating `JWT_SECRET` (after a token leak) invalidates every anonymous survey dedupe hash, causing ballot-stuffing to silently become possible again until the next submission cycle.

**Fix:** Require `SURVEY_ANONYMOUS_SECRET` at startup via `@nestjs/config` validation schema. Fail fast if missing. Delete the JWT fallback and the hardcoded fallback entirely.

### G-BH05 — GDPR deletion request does not fan out to sibling services
**File:** `services/auth-service/src/auth/gdpr.service.ts:142-157`
**High Confidence.** `requestDeletion` flips flags on the auth-service User doc but never notifies hr/chat/payroll/task services. After the 30-day grace, whatever scheduled cleanup runs on auth-service only scrubs the auth User record. HR, chat messages, payroll entries, task comments are **retained indefinitely**. This is a GDPR Article 17 compliance gap — users who requested erasure still have their PII in sibling services.

**Fix:** Either (a) symmetric fan-out to `/internal/gdpr-delete` on every sibling service with `INTERNAL_SERVICE_TOKEN`, wrapping in a background job since deletions can be slow, or (b) publish a `gdpr.user.deletion_requested` event on a message bus. Document which services are wired up in a compliance report.

---

## MEDIUM (8)

### S-BH05 — SCIM `createUser` global email enumeration oracle
**File:** `services/auth-service/src/auth/scim.service.ts:179-201`
`findOne({ email })` runs WITHOUT an `organizations: orgId` filter (intentional — to detect cross-org attachment). But this creates a **cross-tenant enumeration oracle**: an attacker with a valid SCIM token for Org A can submit `POST /Users {userName: 'ceo@bigco.com'}` and learn from the 409 error whether that email exists anywhere on the platform. Repeat with a dictionary to map customer email addresses.

**Fix:** Return the same 409 error for both "exists in this org" and "exists in another org" cases — identical error body, identical timing (add a constant-time placeholder). Better: gate existence checks behind an admin-only settings flag.

### G-BH01 — Automation loop guard is dead code
**File:** `services/task-service/src/task/task.service.ts:1783-1855`
The per-chain `firedRules` Set and depth counter are correct in principle, but **never exercised at runtime**. Automation actions update tasks via direct `taskModel.updateOne()` calls (lines ~1830-2085), not via `this.updateTask()`. Since those direct writes don't re-fire `executeAutomationRules`, no chain ever forms. The loop guard defends against a code shape that doesn't exist. Harmless, but future refactors will have a false sense of safety.

**Fix:** Either (a) have automation actions call the service's own `updateTask` method (so audit trail + re-fire work), then the guard becomes load-bearing; or (b) document that automation chains are structurally impossible and remove the guard.

### G-BH06 — `listAnnouncements` hits hr-service on every request (DoS amp)
**File:** `services/payroll-service/src/payroll/payroll.service.ts:5779-5789`
Every call to `listAnnouncements` fetches the viewer's profile from hr-service to derive department/designation. No caching. A hostile user can hammer `/announcements` and amplify load onto hr-service 1:1.

**Fix:** Cache the viewer's `{department, designation}` in Redis with a 5-minute TTL keyed by `user:${userId}:profile`. Or cache in-process with an LRU.

### G-BH07 — `listAnnouncements` silently loses department visibility on hr-service failure
**File:** `services/payroll-service/src/payroll/payroll.service.ts:5785-5789`
If hr-service is down, `viewerDepartment`/`viewerDesignation` stay null, and the audience filter only includes `'all'` + explicit `employeeIds`. Users see fewer announcements than they should — a correctness regression rather than a leak, but confusing.

**Fix:** Fall back to a cached profile if available, or show a "announcements-may-be-incomplete" banner. Fail visible, not invisible.

### S-BH09 — API key validation timing oracle between new and legacy paths
**File:** `services/auth-service/src/auth/api-key.service.ts:98-146`
- Valid key (new): ~100ms (bcrypt)
- Invalid key, no lookup-hash match, no legacy-prefix match: ~5ms
- Invalid key, legacy-prefix match but bcrypt fails: ~100ms

An attacker hammering random `nx_live_<prefix>...` values can distinguish "prefix exists in legacy table" from "prefix doesn't exist" by response time. Since legacy prefixes are 15 chars (`nx_live_` + 7 random), brute-forcing the prefix space is feasible.

**Fix:** Always run bcrypt once — either on the real hash when the hash lookup succeeds, or on a dummy hash of equal cost. A constant `bcrypt.compare(fullKey, DUMMY_HASH)` in the miss path hides the oracle.

### G-BH02 — `validateApiKey` constant-time pre-check is dead code
**File:** `services/auth-service/src/auth/api-key.service.ts:107-114`
`findOne({keyLookupHash: lookupHash})` already matches exact hash. The subsequent `timingSafeEqual(storedLookup, providedLookup)` will always be true (or throw on length mismatch, which never happens with deterministic SHA-256 output). Harmless dead code, but misleading comment suggests it's load-bearing.

**Fix:** Delete lines 107-114. The bcrypt.compare at line 115 is the real verification.

### G-BH08 — SCIM PATCH doesn't validate new `name` field types or length
**File:** `services/auth-service/src/auth/scim.service.ts:302-309, 328-334`
`(user as any).firstName = value;` assigns whatever `value` is — object, array, 10MB string. No type coercion or length cap. A hostile SCIM client can push a 10MB `firstName`, or `{$ne: null}` operator-object (Mongoose strict mode should reject, but not guaranteed).

**Fix:** Coerce to string and cap at 100 chars. Mirror the same DTO guards that regular user mutations enforce.

### S-BH13 — GDPR fan-out leaks `INTERNAL_SERVICE_TOKEN` if env URL is hostile
**File:** `services/auth-service/src/auth/gdpr.service.ts:45-55`
`process.env.HR_SERVICE_URL` etc. are read at request time with no SSRF guard. An operator typo or compromised config map could redirect the fan-out to `http://evil.example.com/`, which would receive the `X-Internal-Token` header. The token is probably long-lived, so leaking it compromises all inter-service trust.

**Fix:** Validate service URLs at startup against an allowlist of expected hostnames / `.internal` suffixes. Or use the webhook-SSRF guard I audited above (once its own bypasses are fixed) on these URLs too.

---

## LOW / INFO (6)

### T-BH01 — Bank file CSV injection on user-controlled fields
**File:** `services/payroll-service/src/payroll/bank-payout.service.ts:589-594`
`csvEscape` catches `,"\r\n` but not the CSV formula-injection prefixes `=`, `+`, `-`, `@`. A malicious `accountHolder` starting with `=SUM(...)` executes as an Excel formula when the file is opened. Low severity because HR usually controls `accountHolder`, but some integrations let employees self-update.

**Fix:** Prepend a single quote `'` to any field that starts with one of these chars, OR reject such values at write time.

### T-BH02 — `Date.now()` in mock provider IDs is not unique under concurrency
**Files:** `bank-payout.service.ts:73` (mock), `:184` (manual)
Two concurrent mock payouts in the same millisecond share a `providerTransactionId`. Not a security issue; audit trail is misleading.

**Fix:** `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`.

### T-BH03 — `reservation.failedAt = null as any`
**File:** `bank-payout.service.ts:315`
Schema types `failedAt?: Date`, not `Date | null`. Setting to `null` with a cast may cause Mongoose type issues depending on strict mode. Safer: `reservation.failedAt = undefined;`.

### T-BH04 — `generateBankFile` audit log only goes to stdout
**File:** `bank-payout.service.ts:565-567`
The "unmasked export" audit entry is `logger.warn(...)`. In production, stdout log scrubbing could erase evidence. For compliance, write to the `auditLog` collection.

### T-BH05 — `generateVerificationCode` has no uniqueness index or collision retry
**File:** `payroll.service.ts:7235`, `certificate.schema.ts`
31^8 ≈ 8.5E11 codes is large, but for a 100k-cert org, birthday bound gives a collision at ~900k certs. No unique index on `verificationCode` means collisions just silently mis-verify.

**Fix:** Add `{verificationCode: 1}` unique index and retry on E11000. Or move to 10-char codes (31^10 ≈ 8E14).

### G-BH09 — Survey `stats` drift if response save fails mid-transaction
**File:** `payroll.service.ts:5667-5670` (manager review), `:6217-6220` (survey)
`reviewCycleModel.updateOne({$inc: stats})` runs before `review.save()` / `response.save()`. If the save fails, stats have already been incremented. Eventually consistent if the save retries succeed, but counters drift on real failures.

**Fix:** Move stats `$inc` into a post-save hook, or run inside a MongoDB transaction (requires replica set).

---

## What's clean

- **SCIM email-takeover block** (`replaceUser`/`patchUser`) — rejects changes correctly, both cased and case-insensitive. Trip test: `'ADMIN@example.com'` vs stored `'admin@example.com'` matches (allowed as no-op), `'admin2@example.com'` rejected.
- **Task automation `set_field` whitelist regex** — `customFields.__proto__` matches the charset but is caught by the secondary prototype-pollution check. `customFields.foo.bar` is rejected by the anchored single-segment regex. Type coercion on labels array is robust against nested objects.
- **SCIM `createUser` cross-org block** — correctly 409s for existing identities in other orgs.
- **Automation notification phishing** — URL stripping, control-char scrubbing, and length caps land as expected. `[Automation]` prefix is mandatory and can't be bypassed.
- **Razorpay production fail-closed in `initiatePayout`** — throws `ServiceUnavailableException` as claimed. (But see S-BH17 below on `getPayoutStatus`.)
- **Attrition peer-group segmentation** — null-returning branch + neutral-1.0 fallback is correct. Minor bias from including the target in their own peer group, but not a security issue.

---

## ADDITIONAL CRITICAL found outside the fix scope

### S-BH17 — `RazorpayProvider.getPayoutStatus` still returns phantom `'processed'` in prod
**File:** `services/payroll-service/src/payroll/bank-payout.service.ts:151-153`
```typescript
async getPayoutStatus(providerTransactionId: string): Promise<PayoutResult> {
  if (!this.keyId || !this.keySecret) {
    return { success: true, status: 'processed', providerTransactionId };
  }
```
The S-C11 fix covered `initiatePayout`'s mock mode but **forgot `getPayoutStatus`**. If Razorpay is misconfigured in prod and an operator calls `syncPayoutStatus` to reconcile, this returns `'processed'` for every transaction unconditionally. The caller writes `tx.status = 'processed'` and marks `tx.processedAt = new Date()`. Finance sees phantom "paid" rows all over again — the exact bug the S-C11 fix was supposed to kill.

**Fix:** Same treatment — throw `ServiceUnavailableException` when `NODE_ENV === 'production'` and any credential is missing.

### S-BH18 — `getAllGoals` has no caller-level authorization
**File:** `services/payroll-service/src/payroll/payroll.service.ts:4999-5018`
Pre-existing but exposed by the "goal authorization is important" theme of B-H03-07. `getAllGoals` filters only by `organizationId` + optional query params. Any logged-in org member can `GET /goals` and see the CEO's performance targets, salary-increase recommendations embedded in goals, etc. The `getMyGoals` path correctly filters by `employeeId: userId`, but the default list endpoint is wide open.

**Fix:** Return only goals where `employeeId === userId` OR the caller is the line manager of `employeeId`. Manager lookup is expensive per-row; consider precomputing a "my team's employee IDs" cache via `getDirectReports(userId)` at the start of the call and `$in` filtering.

---

## Security Scorecard

| Area | Before audit | After this audit |
|---|---|---|
| SCIM token forgery | ✅ fixed | ⚠️ fixed but **unreachable** (S-BH16) |
| SCIM email takeover | ✅ fixed | ✅ holds |
| SCIM cross-org enumeration | ❌ | ⚠️ **new oracle** (S-BH05) |
| Peer review sabotage | ✅ fixed | ❌ **feature bricked** (S-BH04) |
| Review phase deadlines | ✅ fixed | ⚠️ **reads wrong fields** (S-BH03) |
| Bank payout race | ✅ fixed | ❌ **failed-reclaim still races** (S-BH01) |
| Bank payout retry | ✅ fixed | ⚠️ **bulk reclaim reuses key** (S-BH02) |
| Razorpay mock in prod | ⚠️ half-fixed | ❌ **getPayoutStatus still fakes** (S-BH17) |
| Webhook SSRF | ✅ fixed | ⚠️ **DNS rebinding** (S-BH10) + **IPv6 bypasses** (S-BH11, S-BH12) |
| API key DoS | ✅ fixed | ⚠️ **timing oracle** (S-BH09) |
| Automation privilege escalation | ✅ fixed | ✅ holds |
| Automation loop guard | ✅ added | ℹ️ **dead code** (G-BH01) |
| Automation phishing | ✅ fixed | ✅ holds |
| Certificate race | ✅ fixed | ❌ **TOCTOU remains** (S-BH08) |
| Certificate CSPRNG | ✅ fixed | ✅ holds (minor: no uniqueness index) |
| Anonymous survey dedup | ✅ fixed | ⚠️ **JWT secret fallback + hardcoded literal** (S-BH06) |
| GDPR export | ✅ skeleton | ⚠️ **deletion still stops at auth** (G-BH05), **no service URL allowlist** (S-BH13) |
| Goal authorization | ✅ fixed (per-goal) | ❌ **`getAllGoals` still open** (S-BH18) |
| Attrition salary | ✅ fixed | ✅ holds |
| Bank file masking | ✅ fixed | ℹ️ **CSV formula injection** (T-BH01) |

---

## Prioritized Fix Plan

### P0 — Before this batch ships anywhere

1. **S-BH16** SCIM token provisioning endpoint (2h) — otherwise SCIM is literally unusable
2. **S-BH04** Peer-review assignment endpoint + backfill (2h) — otherwise peer reviews 403 forever
3. **S-BH17** Razorpay `getPayoutStatus` fail-closed in prod (15m) — same class as S-C11 which was meant to be killed
4. **S-BH01** Atomic failed-reclaim in bulk payout (1h) — double-fire regression
5. **S-BH08** Certificate race — wrap generateNumber + save in retry loop (1h)
6. **S-BH03** Phase deadline field names — one-line fix per call site (10m)
7. **S-BH18** `getAllGoals` scope filter (1h)

**P0 total: ~8 hours.**

### P1 — Within 24h

8. **S-BH10** Webhook DNS rebinding — pre-resolve + pin via custom agent (2h)
9. **S-BH11/S-BH12** IPv6 loopback / IPv4-mapped bypasses (1h)
10. **S-BH02** Bulk reclaim idempotency key suffix (30m)
11. **S-BH06** Survey HMAC secret validation + remove fallbacks (30m)
12. **G-BH05** GDPR deletion fan-out to sibling services (4h)
13. **S-BH05** SCIM global email enumeration — identical error + timing (30m)
14. **S-BH09** API key timing oracle — dummy bcrypt on miss (20m)
15. **S-BH13** GDPR service URL allowlist (1h)

**P1 total: ~10 hours.**

### P2 — This week

16. **T-BH01** CSV formula injection (15m)
17. **G-BH08** SCIM PATCH name/familyName validation (15m)
18. **T-BH05** Certificate verificationCode unique index (15m)
19. **G-BH06/G-BH07** listAnnouncements caching + fallback (1h)
20. **G-BH09** Stats drift on failed save (1h)
21. **T-BH03** `null as any` cleanup (5m)
22. **T-BH04** Persistent audit-log for unmasked bank file (30m)
23. **T-BH02** Unique mock provider IDs (5m)
24. **G-BH02** Delete dead timing-safe compare in API key (5m)
25. **G-BH01** Automation loop guard — document or remove (15m)

**P2 total: ~4 hours.**

---

## Test Generation Targets

Regression tests that MUST exist before this hardening is trusted:

1. **SCIM token verification** — test that random bytes with valid prefix but wrong secret 401s in constant time ± 2ms. Test that master token 401s in `NODE_ENV=production`.
2. **SCIM cross-org attach** — provision user in Org A, attempt SCIM create with same email in Org B, expect 409 with identical error text to in-org collision.
3. **Task set_field allowlist** — 50 hostile field paths: `__proto__`, `customFields.__proto__`, `constructor.prototype`, `organizationId`, `createdBy`, `customFields.$eq`, etc. All must be rejected, none reach the DB.
4. **Bank payout concurrent bulk** — fire two `initiateBulkPayout` calls in parallel on a run with a failed entry. Assert only ONE `provider.initiatePayout` call happens. (Currently fails per S-BH01.)
5. **Bank payout retry mints new key** — assert retryPayout passes a `_r<n>`-suffixed idempotencyKey.
6. **Webhook SSRF rebinding** — mock `dns.lookup` to return public on first call and private on second. Assert delivery fails. (Currently fails per S-BH10.)
7. **Webhook SSRF IPv6 variants** — parametrize over `::1`, `0:0:0:0:0:0:0:1`, `[::ffff:7f00:1]`, `[::127.0.0.1]`. All must 400. (Currently fails per S-BH11/S-BH12.)
8. **API key timing** — hammer 1000 random keys and 1000 valid-prefix-wrong-secret keys, assert response-time distributions overlap (KS statistic < 0.05).
9. **Certificate race** — simulate 10 concurrent `issueCertificate` calls, assert all 10 succeed with unique numbers, no 500s. (Currently fails per S-BH08.)
10. **Goal authorization** — employee A tries to `getAllGoals` and sees only their own + direct reports'. Try to update employee B's goal → 403.
11. **Peer review flow** — create review, assign reviewer X, submit as Y → 403. Submit as X → 200. Submit as X twice → 409. (Currently all 403 per S-BH04.)
12. **GDPR deletion fan-out** — mock sibling services, assert deletion request reaches all of them.
13. **Razorpay prod fail-closed** — set `NODE_ENV=production`, clear credentials, call `syncPayoutStatus`. Expect throw, not phantom 'processed'. (Currently fakes per S-BH17.)
14. **Survey anonymous dedup** — submit twice with same user, expect 409. Submit with different users, expect both succeed. Verify secret is NOT the JWT secret.

---

**This hardening batch is not done. Fix the seven P0s and I'll bless it.**

— Vegeta
