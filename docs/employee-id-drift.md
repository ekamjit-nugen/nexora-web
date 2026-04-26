# Employee ID Drift — current state & migration playbook

Tracked as issue **#19** in the HR/payroll follow-up tracker.

## Why this document exists

Nexora's services have historically leaked three distinct ID shapes into
fields all named `employeeId: string`. Code has been written assuming
"the employee id" — but which one depends on the collection. This doc
captures **what each collection actually stores** so engineers don't
re-discover this the hard way.

## The three ID shapes

| Shape | Where it's minted | Example |
|---|---|---|
| **HR `_id`** | `nexora_hr.employees._id` when HR admin creates/imports an employee | `69e636469294a37d959814f1` (24-hex ObjectId) |
| **Auth user `_id`** | `nexora_auth.users._id` when a user account is created (signup, invite-accept) | `69e63646157e5130fd429c7b` (24-hex ObjectId) |
| **Business id** | `nexora_hr.employees.employeeId` — human-readable | `NXR-0003` |

HR `_id` ↔ auth user `_id` are joined via `nexora_hr.employees.userId`.
A single employee can have one HR row, and usually (but not always) one
matching auth user.

## Current keying per collection

| Collection | Field `employeeId` stores | Why |
|---|---|---|
| `nexora_payroll.payrollentries` | **HR `_id`** | Written by `processPayrollRun` using `salary-structure.employeeId` |
| `nexora_payroll.payslips` | **HR `_id`** | Mirrors payroll-entry |
| `nexora_payroll.salarystructures` | **HR `_id`** | Admin creates with HR `_id` as FK |
| `nexora_payroll.onboardings` | **Business id** (NXR-0003) | `initiateOnboarding` DTO uses business id |
| `nexora_payroll.offboardings` | **Business id** (NXR-0003) | `initiateOffboarding` DTO uses business id |
| `nexora_payroll.expenseclaims` | **Auth user `_id`** | `createExpenseClaim` uses `req.user.userId` |
| `nexora_payroll.investmentdeclarations` | **Auth user `_id`** | `submitDeclaration` uses `req.user.userId` |
| `nexora_payroll.candidates` | *n/a* — uses own `_id` for candidate; hire converts via `convertedToEmployeeId` which is the **HR `_id`** (post-#17) | Different domain |
| `nexora_leave.leaves` | **Auth user `_id`** | `applyLeave` uses `req.user.userId` |
| `nexora_leave.leavebalances` | **Auth user `_id`** | `getMyBalance` keys off `req.user.userId` |
| `nexora_attendance.attendances` | **Auth user `_id`** | `checkIn` uses `userId` from JWT sub |

The pattern: employee-initiated self-service (leave, expense claim,
declaration, attendance) keys off the auth user; admin-initiated
payroll/HR data keys off HR `_id`. Offboarding/onboarding fall between
because admin picks via the business id dropdown.

## Impact of the drift

- Every cross-service lookup needs an identity join. We've written ~6
  ad-hoc helpers (`getEmployeeByUserIdentity`, `getEmployeeByX`, etc.).
- F&F (#13) had to resolve HR `_id` → auth user `_id` before calling
  leave-service for the balance.
- Statutory exports (#P1.1–P1.3) need an hr-service round-trip to
  populate PAN/UAN/ESI because payroll-entry only has HR `_id`.
- Multi-step flows can surface the wrong ID shape to the UI if the
  mapping is forgotten, causing "employee not found" errors.

## Canonical resolver (shipped, #P3.1)

`services/payroll-service/src/payroll/external-services.service.ts::canonicalizeEmployeeId`

```ts
const { hrId, authUserId, businessId, shape, employee } =
  await externalServices.canonicalizeEmployeeId(anyInput, orgId, token);
```

- Accepts any of the three shapes; detects which by pattern + probing.
- Returns all three resolved IDs plus the full HR record.
- Use this instead of building another ad-hoc helper.

Applied in:
- Statutory report aggregators (24Q, PF ECR, ESI) — hr-service fallback
  for PAN/UAN/ESI/name via `getEmployee` (which canonicalize wraps).

Should be adopted by any new cross-service flow.

## Full migration playbook (not yet executed)

Two options, both multi-day:

### Option A — canonicalize to HR `_id` everywhere

The clean target. Requires:

1. Add a new field alongside existing `employeeId` on every
   auth-user-keyed collection: `employeeHrId: string`.
2. Write a migration script that, for each record, reads `employeeId`
   (auth user id), looks up the HR row via `employees.userId`, and
   populates `employeeHrId`. Flag records where no HR row exists as
   orphaned.
3. Deploy schema + both-field write path: services write new + old
   fields in parallel. Reads prefer `employeeHrId` and fall back.
4. Monitor for N weeks. When read counts on old field drop to zero,
   remove the fallback.
5. Drop the old field.

Estimated effort: 3-5 engineer-days per service (service code + data
migration + monitoring + rollback plan). There are 4 services with
auth-user-keyed collections.

### Option B — live with the drift, document + standardize resolution

What we've done so far. Cheaper, but every cross-service lookup pays
a small runtime cost. This doc + `canonicalizeEmployeeId` is the extent.

## Recommendation

Option A is the right move before scaling past ~100 employees — the
resolution round-trips start showing up in p95 latency. For Nexora's
current scale, Option B + this doc is an acceptable hold.

When Option A is undertaken, **start with leave-service** — it has
the cleanest surface (2 collections, all auth-user-keyed, no admin
write path) and proves out the pattern with low blast radius. Use
the leave-service migration as the template for payroll + attendance.
