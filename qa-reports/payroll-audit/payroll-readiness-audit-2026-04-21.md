# Payroll Module — Readiness Audit

**Date:** 2026-04-21
**Environment:** `localhost:3000` (frontend), `localhost:3005` (API gateway), docker-compose stack
**Tenants exercised:** Acme Corp (Alex owner + Sam developer + Jamie invited), Globex Inc (Blair owner + Taylor + Morgan + Sam cross-org)
**Scope:** Is the payroll module ready to ship?

---

## Verdict

**NOT READY.** Payroll has a functional end-to-end skeleton but **two ship-blockers prevent any employee from being processed**, and several flows are missing the admin-facing half of the UI.

Good news: core math is correct (`gross=95000, deductions=6713, net=88287` computes cleanly), role-based access control is solid, and tenant isolation holds. The problems are all implementation gaps, not architectural.

---

## Ship-blocker findings

### P-9 — PayrollEntry schema rejects `null` for `paymentDetails.mode` → every employee skipped

**Severity:** P0 / ship-blocker
**Where:** `services/payroll-service/src/payroll/payroll.service.ts` (process-payroll path)
**Repro:** Create salary structure → initiate payroll run → POST `/payroll-runs/:id/process`
**Log evidence:**
```
[PayrollCalculationService] Computing payroll for employee 69e6364…, period 4/2026
[PayrollCalculationService] Payroll computed: gross=95000, deductions=6713, net=88287
[PayrollService] ERROR Failed to process payroll for employee 69e6364…:
  PayrollEntry validation failed: paymentDetails.mode: `null` is not a
  valid enum value for path `paymentDetails.mode`.
[PayrollService] Payroll run PR-2026-04-001 processing completed: 0 processed, 1 skipped
```
Calculation succeeds, then persistence fails Mongoose validation because the employee has no `paymentDetails.mode` set (bank/cash/cheque). There is no UI to set this per-employee and no default in the service. Net effect: **every employee is silently skipped**, the run ends in `review` status with zero entries, and the admin sees no error.

**Fix shape:** (a) Set `paymentDetails.mode` enum default to `bank_transfer` in the PayrollEntry schema, OR (b) pull from HR employee `bankDetails` (which already has fields), OR (c) let the processor surface the failure to the audit trail and UI instead of silently skipping.

---

### P-10 — Service-to-service auth returns 401 (payroll → hr / auth / attendance)

**Severity:** P0 / ship-blocker (for accurate payouts)
**Log evidence from the same run:**
```
[ExternalServicesService] WARN External call failed: 
  http://hr-service:3010/api/v1/employees/69e6338a… → 401
[ExternalServicesService] WARN External call failed: 
  http://auth-service:3001/api/v1/settings/payroll → 401
[PayrollService] WARN Could not load org payroll config … using defaults
[ExternalServicesService] WARN External call failed:
  http://attendance-service:3011/api/v1/attendance?employeeId=…&month=4&year=2026 → 401
[PayrollService] WARN No attendance data for employee …, using defaults
```
Payroll silently **falls back to hard-coded defaults** when its cross-service calls are rejected. That means:
- **Org payroll config** (PF rate, TDS slabs, working days/month) uses defaults, not the tenant's own setup.
- **Attendance** is assumed full; Loss-of-Pay deductions are never computed.
- **HR metadata** lookups degrade to `null`.

The result is a payroll that compiles but is **silently wrong**. Either fix the service-to-service auth (synthesize a temp JWT with proper org context, like we did for `HrSyncService.provisionEmployee` when fixing Bug #3), or make the fallback a hard failure — never ship inaccurate numbers under "defaults".

---

## Critical bugs (below P0 but block normal use)

### P-1 — Salary Structure page shows employee view only; no admin CRUD UI

- Route: `/payroll/salary`
- Header says "View your salary breakdown and simulate CTC". Only buttons: **Simulate CTC** (a calculator).
- Page calls `GET /salary-structures/<currentEmployeeId>` and renders a single-employee view.
- Admin has **no way to create or edit a salary structure for any employee** from the UI. The backend endpoint (`POST /salary-structures`) works fine when called directly (verified via API), so this is purely a missing frontend.

### P-6 — No list endpoint for salary structures

- `GET /salary-structures` → **404 Not Found**. Only `GET /salary-structures/:employeeId` exists.
- Even if the UI were added, the admin would need a list API to drive it. Add `GET /salary-structures` (org-scoped, role-gated to admin/hr).

### P-8 — Maker-checker deadlocks single-admin orgs

- `payroll.service.ts:439` blocks the creator from approving the structure:
  ```ts
  if (structure.createdBy === userId) {
    throw new ForbiddenException('Cannot approve your own salary structure. A different administrator must approve.');
  }
  ```
- Acme (and most small orgs) have exactly one admin. Alex cannot approve what Alex submitted → deadlock. No bypass exists.
- **Options:** (a) allow the `owner` role to bypass the check, (b) relax to self-approval when the org has < 2 admins, (c) auto-create a default second admin on org setup.

### P-3 — Payroll runs list response shape double-wrapped (`data.data`)

- Expected: `{ success, data: [...runs], pagination: {...} }`
- Actual:   `{ success, data: { data: [...runs], pagination: {...} } }`
- Frontend reads `response.data` as the array → **always "No payroll runs yet"** even when runs exist.
- Either the service layer or the controller is wrapping the result one extra level. Fix the controller to return `{ data: rows, pagination }` flat, or update the frontend parser. The inconsistency across services (e.g. `/employees` returns a different shape again) should be normalised.

### P-2 — UI never reflects that a run was created

- Direct consequence of P-3. Admin clicks "Initiate Run", sees the success toast, but the list stays empty and the stat cards stay at `0/0/0/0`. Looks like nothing happened.

### P-4 — Run can be initiated with zero approved salary structures

- There is no precondition check. Admin initiates → run created in `draft` → process → 0 employees processed. No warning prior to initiating that the run will be empty.
- **Fix:** precondition gate on `POST /payroll-runs` — refuse if no active salary structures exist in the org, with a clear message. Or surface a warning banner on `/payroll`.

### UX-P1 — 4 duplicate "Payroll run initiated successfully" toasts

- Each POST triggers four toasts. Likely cause: React strict-mode double-render + a dual dispatcher (auth-context + page). Same class of bug as the duplicate `OTP sent` we fixed in login earlier.
- **Fix:** single dispatch in the handler, guard against re-fire on effect re-run.

### P-5 — Stale payroll run for unknown org in DB

- Before any test, DB contained `PR-2026-04-001` for `organizationId: 69cd57d4e5cfe0586341e769` — doesn't correspond to any current org (Acme / Globex / Nugen / Alpha / Beta duplicates all have different IDs).
- Looks like seed/test pollution from an earlier run that didn't clean up. Minor but worth a baseline cleanup before release.

---

## What passes

### Tenant isolation (payroll) — **PASS**

- Blair (Globex owner) hits `GET /payroll-runs` → 0 runs (correct, Globex has none).
- Blair hits `GET /payroll-runs` with `x-organization-id: <acme>` spoofed → **still 0 runs**. Header correctly ignored; JWT org is authoritative.
- Blair tries `GET /salary-structures/<sam-acme-hr-id>` → **404 Not Found** (scoped query, no existence leak).
- Matches the behaviour we verified in the auth-module audit — same guard pattern.

### Role enforcement — **PASS**

- Sam (developer, Acme) tries `POST /payroll-runs` → **403 Insufficient permissions**.
- Sam tries `POST /salary-structures` to give himself a ₹10M raise → **403 Insufficient permissions**.
- `@Roles('admin'|'super_admin'|'hr')` decorators are honoured correctly.

### Core calculation — **PASS**

- `PayrollCalculationService` produced `gross=95000, deductions=6713, net=88287` from Sam's 12 LPA structure (50k basic + 25k HRA + 20k special = 95k gross; 6k PF + 200 PT = 6.2k stated + small computed diff = 6.7k). Math is sound.

### Sub-module UI inventory

| Page | Layout | Status |
|---|---|---|
| `/payroll` (Runs) | Admin list + tabs + stat cards | Good shell, broken by P-2/P-3 |
| `/payroll/salary` | Employee self-view only | **Broken (P-1)** |
| `/payroll/declarations` | Self-service; admin review view missing | Gap |
| `/payroll/loans` | My Loans / All Loans tabs | Good |
| `/payroll/expenses` | My Claims / Pending Approval / All Claims | Good |
| `/payroll/statutory-reports` | Admin tabs (Form 16/PF ECR/ESI/TDS) + employee "My Tax Documents" | Good design |
| `/payroll/payslips` | "My Payslips" (self-service only; admin generates from run detail) | Acceptable |
| `/payroll/onboarding` | 200 OK (not deep-tested) | TBD |
| `/payroll/offboarding` | 200 OK (not deep-tested) | TBD |
| `/payroll/analytics` | 200 OK (not deep-tested) | TBD |

---

## Unrelated collateral findings (logged while probing)

- `GET /api/v1/leaves/balance` returns **500 Internal Server Error** for Alex (seen twice in network log). Out of scope for payroll but worth a follow-up.
- `GET /api/v1/policies` returns **504 Gateway Timeout** repeatedly. Policy-service is likely down or crashed.
- `calculationMethod must be one of the following values: ` (empty list) — class-validator rendering quirk for the salary-component enum; cosmetic.

---

## Recommended fix order

1. **P-9** — set a default for `paymentDetails.mode` (single-line schema fix). Unblocks every process run.
2. **P-10** — restore service-to-service auth OR convert silent defaults into hard errors. Without this, correctness can't be trusted.
3. **P-3** — normalise list response shape; fix `/payroll-runs` list flow. Without this, the admin UI is dead.
4. **P-8** — add owner-bypass on maker-checker so single-admin orgs aren't deadlocked.
5. **P-1 / P-6** — build the admin Salary Structure list + create UI; add `GET /salary-structures`.
6. **P-4** — precondition check on run initiation.
7. **UX-P1** — deduplicate the 4x toast.
8. **P-5** — one-time DB cleanup of orphaned run.

Rerun this audit end-to-end after each of the first three fixes — they're in the critical path for literally running payroll for a single employee. Everything else is polish.

---

## Artifacts

- Backend map / recon → Explore agent output (this session)
- DB state after last test: `nexora_payroll.salarystructures = 1 (Sam)`, `nexora_payroll.payrollruns = 1 (Acme, status=review, 0 processed, 1 skipped)`
- Service logs snippet preserved in this report (P-9, P-10 root-cause evidence)
