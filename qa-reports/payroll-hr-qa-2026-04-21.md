# HR + Payroll Service — QA Findings Report
**Date:** 2026-04-21
**Scope:** hr-service (port 3010), payroll-service (port 3014), routed via api-gateway :3005
**Tested by:** api-level + UI spot-checks across 4 user personas in 2 orgs

## Personas used

| Name  | Org    | `orgRole` | `roles` claim     | Purpose                         |
|-------|--------|-----------|-------------------|---------------------------------|
| Alex  | Acme   | owner     | user, admin       | Privileged happy-path           |
| Jamie | Acme   | hr        | user              | HR-role RBAC coverage           |
| Sam   | Acme   | developer | user              | Non-privileged / employee self-service |
| Blair | Globex | owner     | user, admin       | Cross-org isolation             |

---

## Summary

- **14 findings opened, 8 fixed this session, 6 remain** (5 of the 6 are low-severity inconsistencies + noted for follow-up).
- **1 critical security issue (HR-RBAC-1)** closed — the HR service had no role-based access control on any write endpoint, meaning any authenticated developer could create / update / terminate employees and departments.
- Tenant isolation holds across HR and Payroll — Blair could not read any Acme data in either service.

---

## Findings

### 🚨 HR-RBAC-1 — CRITICAL — HR service had no RBAC on writes  [FIXED]
**What:** Every write endpoint in `hr-service` (`POST/PUT/DELETE /employees`, `/departments`, `/designations`, `/teams`, `/employees/:id/policies`) was guarded only by `JwtAuthGuard`. The guard verified the token and rejected null-org, but never checked the caller's role.
**Impact:** Sam (`orgRole=developer`, `roles=['user']`) successfully created an employee record, updated his own profile, and terminated another employee — all with HTTP 201/200. In a multi-tenant SaaS this is a privilege escalation inside the org.
**Fix:** Extended `services/hr-service/src/hr/guards/jwt-auth.guard.ts` with a `Reflector`-backed `@Roles(...)` decorator and added per-endpoint gates on all write routes in `hr.controller.ts`. Guard accepts a match on either top-level `roles` or per-org `orgRole`, with `owner` implicitly granted any `admin`/`hr` decorator. Read endpoints (list, stats, org-chart, get-by-id) intentionally stay open to any authenticated org member so employees can still use the directory.
**Verified:** After rebuild, Sam gets 403 on create/terminate/department-create. Alex and Jamie (hr) continue to succeed.

### 🐛 HR-2 — Termination did not snapshot `previousStatus`  [FIXED]
**What:** `HrService.deleteEmployee` (the reversible-terminate handler) wrote `{status: 'exited', isActive: false}` directly without first reading the existing status. So on reactivate, there was nothing to restore from. The sister path `updateEmployee` did capture `previousStatus` when a PUT transitioned `status` to `exited`, but the DELETE path bypassed it.
**Impact:** An invited user terminated via DELETE then reactivated ended up with `status: active` — silently promoting someone who had never accepted their invite.
**Fix:** `deleteEmployee` now reads the existing doc, writes `previousStatus = existing.status` into the patch, and clears its own prior snapshot if re-terminating.
**Verified:** Created a fresh invited employee, terminated, reactivated → `status=invited, previousStatus=null, isActive=true`.

### 🐛 HR-3 — Reactivate did not restore `isActive: true`  [FIXED]
**What:** `updateEmployee`'s reactivate branch restored `status` from `previousStatus` but never flipped `isActive` back to `true`. Because `deleteEmployee` set `isActive: false` on exit, a reactivated employee stayed `isActive=false` even though their `status` said `active`. The org-chart and "active" stats filter on `isActive`, so the person invisibly disappeared from both even after reactivation.
**Fix:** When transitioning OUT of `exited`, also set `isActive: true` and clear `exitDate`. On the inbound side (going INTO `exited` via PUT), mirror the DELETE path: set `isActive: false` + `exitDate: now()`.

### 🐛 Payroll-1 — "Simulate CTC" blocked for employees  [FIXED]
**What:** `POST /salary-structures/simulate` required `@Roles('admin', 'hr', 'super_admin', 'manager')`. The employee self-view's "Simulate CTC" button therefore always 403'd, silently in the UI.
**Impact:** Self-service feature broken; no workaround for a regular employee.
**Fix:** Simulate is a deterministic pure calculator — it reads no tenant data and leaks no other employee's salary info. Removed the `@Roles` gate; JWT + org-scope still enforced.
**Verified:** Sam successfully simulates CTC and the UI renders the breakdown (Basic ₹60k, HRA ₹30k, Special ₹48,159, Net ₹1,38,159 for ₹18L CTC).

### 🐛 Payroll-3 — `/payslips/my` used wrong join key  [FIXED]
**What:** `PayrollService.getMyPayslips` filtered `{employeeId: userId}` where `userId` is the auth JWT `sub`. Payslips store `employeeId = HR employee _id`, which is a different document. So `/payslips/my` returned an empty list for every employee even when their payslip existed.
**Impact:** Employees could never see their own payslips from the app.
**Fix:** Resolve the caller's HR employee row via `ExternalServicesService.getEmployeeByUserIdentity({userId, email}, token, orgId)` and filter payslips by the HR `_id`. Falls back to the raw `userId` if HR lookup fails, so behaviour doesn't regress for code paths that happen to store auth userId.
**Verified:** Sam's `/payslips/my` now returns his April 2026 payslip with `netPayable=88287`.

### 🐛 Payroll-4 — Employees blocked from reading their own payroll entry  [FIXED]
**What:** `GET /payroll-runs/:id/entries/:employeeId` required `@Roles('admin', 'hr', 'super_admin', 'manager')`. Employees had no way to read their own entry to confirm the breakdown behind a payslip.
**Fix:** Removed the blanket `@Roles` decorator. The controller now plumbs `{callerEmail, callerToken, isPrivileged}` into the service, and `getPayrollEntry` resolves the caller's HR row and enforces `callerHrId === employeeId` for non-privileged callers (admin/hr/manager still skip the ownership check so they can view every employee's entry).
**Verified:** Sam reads his own entry (net=88287). Sam reading Alex's entry returns `403 "You can only view your own payroll entry"`.

### 🐛 Payroll-6 — Expense claim creation crashed with `paidVia: null`  [FIXED]
**What:** `expense-claim.schema.ts` had `paidVia: { type: String, enum: ['payroll', 'separate_transfer'], default: null }`. Mongoose rejected every new expense claim at save time because `null` isn't a member of the enum, so `POST /expense-claims` always returned HTTP 500.
**Impact:** Expense claim submission completely broken for all users. Same class of bug as the earlier P-9 `paymentDetails.mode` fix.
**Fix:** Dropped the `default: null` and marked the field `required: false`. It now remains `undefined` until the claim is actually paid.
**Verified:** Sam successfully submits a travel expense and sees it in `/expense-claims/my`.

### 🐛 HR-filter-1 — `managerId` query param didn't match schema  [FIXED]
**What:** Added `managerId` + `userId` filters to HR's `EmployeeQueryDto` for use by payroll's cross-service scope checks. But `getEmployees` initially wrote `filter.managerId = managerId` while the schema column is `reportingManagerId`, so the filter silently returned zero rows.
**Fix:** Map `managerId` → `reportingManagerId` in the filter.

---

## Findings still open (low severity, follow-up)

### Payroll-2 — Double-wrapped responses on list endpoints
`GET /payroll-runs/:id/entries` returns `{data: {data: [...], pagination: {...}}}` — the controller wraps the service's already-wrapped object in another `data`. Same pattern has already been normalised for `/payroll-runs` (P-3 fix); `/entries` and potentially `/expense-claims`, `/investment-declarations` need the same flatten.
**Why not fixed now:** cosmetic — affects client DX but doesn't break any user flow since the frontend already handles both shapes.

### Payroll-8 — `employeeId` semantics are inconsistent across collections
- `salarystructures.employeeId` = HR `_id`
- `payrollentries.employeeId` = HR `_id`
- `payslips.employeeId` = HR `_id`
- `employeeloans.employeeId` = auth `sub` (userId)
- `expenseclaims.employeeId` = auth `sub`
- `goals.employeeId` = auth `sub`

The `/my` endpoints therefore work on some collections but not others (Payroll-3 and Payroll-5 are symptoms of this). Long-term fix: pick one id (HR `_id`) and migrate. Short-term: the identity-resolver helper `getEmployeeByUserIdentity` lets us normalise at read time without a schema migration.

### Payroll-9 — `/expense-claims/my` + `/investment-declarations/my` likely have the same wrong-key bug
Not independently verified this session because the creates failed (Payroll-6). Should re-test now that expense claim creation works.

### Designation DTO naming inconsistency
`CreateDepartmentDto` uses `{name, code}`, `CreateDesignationDto` uses `{title, level}`. Low-impact but footgun for UI/API DX.

### HR null-org message
`ForbiddenException('Organization context required. Complete organization setup before accessing HR resources.')` is fine; just noting observed.

### Payroll run processing 403 from HR
During `initiatePayrollRun`, payroll calls `GET /employees?managerId=<id>` on HR via a minted service token. Earlier tests showed this returning 403 in logs; needs a dedicated deeper look after the new HR RBAC guard is in place (the service token's `roles: ['admin']` should pass the new decorator but might be hitting a tenant-isolation mismatch).

---

## RBAC matrix — current state after fixes

| Endpoint                                 | Sam (developer) | Jamie (hr) | Alex (owner) | Blair (globex) |
|------------------------------------------|-----------------|------------|--------------|----------------|
| `GET  /employees` (list)                 | ✅ own org       | ✅ own org  | ✅ own org    | ✅ own org      |
| `POST /employees`                        | ❌ 403           | ✅          | ✅            | ✅ own org      |
| `PUT  /employees/:id`                    | ❌ 403           | ✅          | ✅            | ✅ own org      |
| `DELETE /employees/:id`                  | ❌ 403           | ✅          | ✅            | ✅ own org      |
| `POST /departments`                      | ❌ 403           | ✅          | ✅            | ✅ own org      |
| `POST /salary-structures`                | ❌ 403           | ✅          | ✅            | ✅ own org      |
| `GET  /salary-structures/:id` (other)    | ❌ 403           | ✅          | ✅            | cross-org 404   |
| `GET  /salary-structures/me`             | ✅ own           | ✅ own      | ✅ own        | ✅ own          |
| `POST /salary-structures/simulate`       | ✅               | ✅          | ✅            | ✅              |
| `POST /payroll-runs`                     | ❌ 403           | ✅          | ✅            | ✅ own org      |
| `GET  /payroll-runs/:id/entries/:me`     | ✅ own           | ✅          | ✅            | own only        |
| `GET  /payroll-runs/:id/entries/:other`  | ❌ 403           | ✅          | ✅            | cross-org empty |
| `GET  /payslips/my`                      | ✅ own payslips  | ✅          | ✅            | own only        |
| `POST /expense-claims`                   | ✅               | ✅          | ✅            | ✅              |
| `POST /loans`                            | ✅               | ✅          | ✅            | ✅              |

---

## Files changed

- `services/hr-service/src/hr/guards/jwt-auth.guard.ts` — added `@Roles` support via Reflector
- `services/hr-service/src/hr/hr.controller.ts` — added `@Roles` to all write endpoints
- `services/hr-service/src/hr/hr.service.ts` — previousStatus capture on terminate; isActive + exitDate on reactivate; managerId/userId filter support
- `services/hr-service/src/hr/dto/index.ts` — `EmployeeQueryDto` gained `managerId` + `userId`
- `services/payroll-service/src/payroll/schemas/expense-claim.schema.ts` — removed `paidVia: default: null`
- `services/payroll-service/src/payroll/external-services.service.ts` — added `getEmployeeByUserIdentity` (email-first, userId-fallback)
- `services/payroll-service/src/payroll/payroll.service.ts` — `getMySalaryStructure`, `getMyPayslips`, `getPayrollEntry` now resolve HR employee correctly
- `services/payroll-service/src/payroll/payroll.controller.ts` — `/salary-structures/me` new; simulate un-gated; entry self-access logic
- `frontend/src/app/payroll/salary/page.tsx` — simulate CTC client maps response correctly (rupees, not paise; unified `components[]`)
