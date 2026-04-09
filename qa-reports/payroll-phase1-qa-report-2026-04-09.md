# Payroll Service Phase 1 — QA Audit Report

**Auditor:** Vegeta, QA Sentinel
**Date:** 2026-04-09
**Target:** `services/payroll-service/` + `frontend/src/app/payroll/`

---

## Executive Summary

Phase 1 payroll service has **69 findings** across backend and frontend:

| Area | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| Backend | 9 | 10 | 12 | 11 | 42 |
| Frontend | 1 | 8 | 13 | 5 | 27 |
| **Total** | **10** | **18** | **25** | **16** | **69** |

**The service is NOT safe for production.** Top blockers:
1. No RBAC — any user can process/approve payroll
2. Optional orgId = cross-tenant data breach
3. Hardcoded JWT secret fallback
4. No ownership checks on payslips/declarations
5. Self-approval allowed on salary structures

---

## CRITICAL FINDINGS (10)

### Backend (9)
- **PAY-001**: CORS wide open (`origin: true`)
- **PAY-002**: Hardcoded JWT secret fallback
- **PAY-003**: Zero RBAC on ALL endpoints — any employee can run payroll
- **PAY-004**: orgId is optional — null orgId skips all tenant filters
- **PAY-005**: JWT guard allows null organizationId
- **PAY-006**: Self-approval on salary structures (no segregation of duties)
- **PAY-007**: Race condition on payroll run initiation (check-then-create)
- **PAY-008**: No ownership check on payslip reads
- **PAY-009**: No ownership check on declaration reads

### Frontend (1)
- **FE-PAY-001**: "View" button navigates to `/payroll/${id}` — route does not exist (404)

---

## HIGH FINDINGS (18)

### Backend (10)
- **PAY-010**: No rate limiting on financial endpoints
- **PAY-011**: Hardcoded statutory config (PF/ESI/PT rates not from org config)
- **PAY-012**: Mock attendance data (22 days, 0 LOP) — every payslip is wrong
- **PAY-013**: Payslip employee snapshot is placeholder ("Employee", "N/A", "XXXX")
- **PAY-014**: YTD totals all zeros on payslips
- **PAY-015**: updateDeclaration doesn't reset status to submitted
- **PAY-016**: holdEntry has no guard on run status
- **PAY-017**: releaseEntry has no guard on run status
- **PAY-018**: Old tax regime slab verification needed
- **PAY-019**: Unique index prevents re-running after cancellation

### Frontend (8)
- **FE-PAY-002**: No role check — any user can access /payroll via URL (**FIXED**)
- **FE-PAY-003**: No duplicate-run guard in modal
- **FE-NAV-001**: PAYROLL section gated to managers (employees can't see payslips) (**FIXED**)
- **FE-SLIP-001**: Download button is dead stub
- **FE-SAL-001**: Active/Pending/Draft tabs non-functional
- **FE-SAL-002**: CTC simulator potential double-conversion bug
- **FE-DECL-001**: Edit button is dead stub
- **FE-DECL-002**: No statutory limit validation (80C max 1.5L not enforced)
- **FE-XCUT-001**: Zero role-based access on any payroll page

---

## Fixes Already Applied (4)
- **FE-NAV-001** FIXED: Payroll section-level minRole removed, added only to Payroll Runs
- **FE-PAY-002** FIXED: Role guard added to payroll runs page
- **FE-PAY-004** FIXED: formatCurrency uses minimumFractionDigits: 2 consistently
- **FE-PAY-005** FIXED: formatCurrency handles NaN/undefined inputs

---

## Prioritized Action Plan

### P0 — Must fix before any deployment
1. Add RBAC guard (Roles decorator) on all admin endpoints
2. Reject null organizationId in JWT guard
3. Remove hardcoded JWT secret fallback (throw on missing)
4. Add ownership checks on payslip/declaration reads
5. Prevent self-approval on salary structures
6. Fix unique index to exclude cancelled runs

### P1 — Must fix before production
7. Integrate real attendance data (replace mock)
8. Integrate real employee data for payslip snapshots
9. Calculate YTD totals from historical payslips
10. Add rate limiting on financial endpoints
11. Restrict CORS origins
12. Create /payroll/[id] detail page
13. Fix hold/release to require review status

### P2 — Fix before scale
14. Load statutory config from org settings (not hardcoded)
15. Wire salary structure tabs to actual filtering
16. Implement payslip PDF download
17. Add statutory limit validation on declarations
18. Log skipped employees with error details
