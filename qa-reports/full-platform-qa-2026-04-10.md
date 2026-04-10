# Nexora Platform QA Audit — P0-P3 Full Review

**Auditor:** Vegeta, QA Sentinel
**Date:** 2026-04-10
**Scope:** All backend services + frontend pages from this session

## Summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 9 |
| **HIGH** | 22 |
| **MEDIUM** | 26 |
| **LOW** | 16 |
| **Total** | **73** |

---

## Top 4 Ship-Blockers (fix first)

### 1. SCIM accepts ANY forged token → cross-tenant takeover
**File**: `services/auth-service/src/auth/scim.service.ts:25-43`
Any attacker can forge `scim_<victim-orgId>_anything` and get full CRUD over the victim's user directory. The `validateToken` method has a `TODO` comment where the HMAC verification should be. Combined with `createUser` creating pre-verified accounts, this is a **directory poisoning vector**.

**Fix**: Wire `scimTokenHash` verification on Organization model, use timingSafeEqual.

### 2. Bank payout idempotency race → real money lost twice
**File**: `services/payroll-service/src/payroll/bank-payout.service.ts:216-305`
Between `findOne({idempotencyKey})` and `tx.save()`, concurrent calls can both pass the check, both fire real Razorpay payouts, then the second save fails. **Money is paid twice, recorded once.** Failed payouts can also never be retried via `initiateBulkPayout`.

**Fix**: Use `findOneAndUpdate` with `upsert` for atomic idempotency reservation. Separate retry path.

### 3. Razorpay returns `mock_<timestamp>` when credentials missing
**File**: `services/payroll-service/src/payroll/bank-payout.service.ts:57-60`
If production env vars are misconfigured, service silently writes fake transaction IDs. **Finance sees "processed" without any real payment.** Six-figure production landmine.

**Fix**: Throw `ServiceUnavailableException` on missing config in production.

### 4. Task automation `set_field` = admin → god mode
**File**: `services/task-service/src/task/task.service.ts:1964-1973`
```typescript
setOp[params.field] = params.value;  // UNVALIDATED
```
A manager can create an automation rule with `params.field: 'organizationId'` and move tasks across tenants, or `field: '__proto__.admin'` for prototype pollution.

**Fix**: Whitelist allowed field paths regex `/^(customFields\.\w+|labels|description)$/`.

---

## CRITICAL findings (9)

| ID | Area | Description |
|----|------|-------------|
| S-C01 | SCIM | Token validation has `TODO` — accepts any forged token |
| S-C02 | SCIM | createUser attaches existing identities to forged org |
| S-C03 | Webhooks | No SSRF guard — can call internal services (IMDS, mongo, etc.) |
| S-C04 | SCIM | PATCH allows email takeover without re-verification |
| S-C05 | API Keys | bcrypt DoS: every request iterates all prefix collisions |
| S-C06 | SCIM | SCIM_MASTER_TOKEN timing leak |
| S-C07 | Kudos | No ArrayMaxSize on toUserIds — 10k-element DoS |
| S-C08 | Bank Payouts | Idempotency race = double payment |
| S-C09 | Bank Payouts | Failed payouts block retry forever |
| S-C10 | Bank Payouts | Placeholder 'XXXX' bank details masking config errors |
| S-C11 | Bank Payouts | Mock transactions written as success in production |
| S-C12 | AI Parsing | No MaxLength on resumeText — 10MB spam → AI cost explosion |
| S-C13 | GDPR | Export only covers auth — HR/chat/payroll not included. EU non-compliance |
| S-C14 | Automation | set_field writes arbitrary field paths — privilege escalation |
| S-C15 | Automation | No infinite loop detection in rules engine |
| S-C16 | Automation | Phishing via attacker-controlled notification content |

## HIGH findings (22 — top business logic bugs)

| ID | Description |
|----|-------------|
| B-H01 | finalizeReview doesn't check cycle status |
| B-H02 | Review submits ignore cycle deadlines |
| B-H03 | Any user can submit "peer review" on anyone (career sabotage) |
| B-H04 | Any manager can submit manager-review on any employee |
| B-H05 | rateGoal has zero authorization — anyone can rate |
| B-H06 | createGoal lets any user create goals on behalf of anyone |
| B-H07 | goalCheckIn/updateGoal has no ownership check |
| B-H08 | listAnnouncements ignores targetAudience — everyone sees everything |
| B-H10 | startReviewCycle uses salary-structure distinct — misses new joiners |
| B-H11 | submitQuiz has no max-attempts — brute-force-able |
| B-H12 | issueCertificate race — two concurrent completions = duplicate cert number |
| B-H13 | verifyCertificate uses Math.random (not crypto) |
| B-H14 | Anonymous surveys allow ballot-stuffing |
| B-H16 | Attrition salary gap compares intern to CEO (garbage input) |
| B-H17 | Attrition fallback `medianSalary = 1` creates huge false scores |
| B-H18 | Chat analytics may not match conversationId type (string vs ObjectId) |
| B-H22 | Bank file CSV exports FULL account numbers (PCI/RBI risk) |

---

## Prioritized Fix Plan

### P0 — Must fix before any production deploy
1. **S-C01/04** SCIM: implement HMAC token verification (2h)
2. **S-C14** Automation: whitelist `set_field` paths (30m)
3. **S-C11** Razorpay: throw on missing config in prod (15m)
4. **S-C08/09** Bank payout: atomic upsert + retry path (3h)
5. **B-H03-07** Review/goal authorization checks (3h)
6. **S-C03** Webhook SSRF: block RFC1918/loopback (2h)

**Total P0 effort: ~11 hours**

### P1 — Within 24 hours
7. Add ArrayMaxSize + IsMongoId on bulk DTOs (1h)
8. Add MaxLength to resume/announcement/kudos text (1h)
9. GDPR: either remove claim or wire cross-service export (8h)
10. Review cycle deadlines + phase enforcement (1h)
11. Announcement audience filtering (30m)
12. Quiz attempt capping (30m)
13. Certificate atomic counter (1h)
14. Replace Math.random with crypto.randomInt (5m)
15. Bank file endpoint hardening (30m)

**Total P1 effort: ~13 hours**

### P2 — Within the week
16. API key HMAC replacement + batched updates (2h)
17. Automation loop protection (2h)
18. Anonymous survey dedup (2h)
19. Attrition model fixes (role segmentation, join date, null on missing) (3h)
20. Incremental eNPS (2h)
21. Rule action parallelization (30m)
22. Form 16 fail-loud (30m)
23. Frontend modal replacements (2h)
24. Remove `any` casts (4h)

**Total P2 effort: ~18 hours**

---

## Architecture Insights

### What's structurally strong
- 100% JWT auth coverage (no endpoint missing guards)
- Org scoping enforced at service layer (mostly)
- Soft delete pattern consistent
- Audit trails on state transitions

### What's structurally weak
- **Cross-service authorization**: HR roles aren't verified in payroll service (defense-in-depth missing)
- **Untyped Mongoose models**: Many `any` casts hiding schema drift
- **No global rate limiting**: Per-endpoint throttling missing on expensive operations
- **No transaction boundaries**: Multi-document updates not atomic
- **Unbounded arrays**: Schemas allow arrays to grow without limit (16MB BSON risk)

### God Class Problem
`payroll.service.ts` is now ~7,230 lines covering 15 bounded contexts. This blocks parallel development and makes changes risky. Needs urgent split into domain services.
