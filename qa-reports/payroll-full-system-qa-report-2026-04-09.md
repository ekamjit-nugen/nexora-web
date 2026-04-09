# Nexora Payroll System — Final QA Report (All Phases)

**Auditor:** Vegeta, QA Sentinel
**Date:** 2026-04-09
**Scope:** Phase 1-3 backend + Phase 2 frontend + full architecture

---

## Executive Summary

| Audit Stream | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-------------|----------|------|--------|-----|-------|
| Phase 3 Backend | 5 | 8 | 7 | 3 | 23 |
| Phase 2 Frontend | 1 | 7 | 8 | 4 | 20 |
| Architecture | 0 | 0 | 3 | 3 | 6 |
| **Total** | **6** | **15** | **18** | **10** | **49** |

### Architecture Scorecard
- 84 endpoints, 100% with JWT auth
- 77% with RBAC (18 intentionally open for self-service)
- 94% DTO validation coverage
- 12/12 schemas registered
- 0 route conflicts
- **BLOCKING: 1 page crashes on load, 5 raw body params, 1 missing @Roles**

---

## CRITICAL (6)

| ID | Module | Description |
|----|--------|-------------|
| OFF-01 | Frontend | Offboarding page calls non-existent `getOffboardings()` — crashes on load |
| LOAN-01 | Loans | Race condition on loanNumber generation (concurrent 500 errors) |
| LOAN-02 | Loans | Self-approval of loans allowed (fraud vector) |
| RECRUIT-01 | Recruitment | Offers created without pipeline stage validation |
| RECRUIT-02 | Recruitment | Convert-to-employee allows non-accepted offers |
| RECRUIT-03 | Recruitment | Interview feedback endpoint has no @Roles guard |

## HIGH (15)

| ID | Module | Description |
|----|--------|-------------|
| LOAN-03 | Loans | No check for overlapping active loans |
| LOAN-04 | Loans | GET /loans/:id has no ownership check |
| ANALYTICS-01 | Analytics | Multiple `as any` casts suppress type checking |
| ANALYTICS-02 | Analytics | generateSnapshot returns mostly hollow data |
| ANALYTICS-03 | Analytics | Annualized attrition rate formula is wrong |
| RECRUIT-04 | Recruitment | Interviews scheduled for rejected/withdrawn candidates |
| RECRUIT-05 | Recruitment | Unique index conflicts with soft-delete on candidates |
| EXP-01 | Expenses | Negative expense amounts accepted |
| ONB-01 | Onboarding | No role gate — any user sees all records via URL |
| ONB-02 | Onboarding | Data exposure if backend doesn't enforce roles |
| OFF-02 | Offboarding | formatCurrency inconsistent with other pages |
| OFF-03 | Offboarding | Initiate modal has no in-handler validation |
| OFF-04 | Offboarding | Stale selectedRecord after clearance actions |
| OFF-05 | Offboarding | HR users locked out by mismatched role guards |
| ARCH-01 | Architecture | 5 raw @Body() params bypass class-validator |

---

## Prioritized Fix Plan

### P0 — Must fix before any deployment
1. OFF-01: Fix `getOffboardings()` → `getAllOffboardings()` (1 line)
2. RECRUIT-03: Add @Roles to interview-feedback endpoint (1 line)
3. LOAN-02: Add self-approval check in approveLoan
4. RECRUIT-02: Remove 'sent' from allowed statuses in convertToEmployee
5. RECRUIT-01: Validate pipeline stage before offer creation
6. LOAN-01: Catch E11000 on loan number + retry

### P1 — Before production launch
7. Create 5 missing DTO classes for raw body params
8. Add role guard to onboarding + offboarding pages
9. Fix offboarding stale state + role mismatch
10. Add negative amount validation on expenses
11. Fix attrition rate formula
12. Add overlapping loan check
13. Fix candidate soft-delete unique index

### P2 — Post-launch
14. Split payroll.service.ts (3,904 lines) into 7 domain services
15. Add pagination to all list pages
16. Fill analytics snapshot with real department/attendance data
17. Remove `as any` casts in analytics methods
