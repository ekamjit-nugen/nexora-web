# Nexora Platform — Complete Feature Audit Report

**Auditor:** Senior Product & Engineering Audit
**Date:** 2026-03-31
**Scope:** All modules, all roles, end-to-end flows
**Version:** 1.0

---

## Table of Contents

1. [Feature Categorization](#1-feature-categorization)
2. [Role Definitions & Permissions Matrix](#2-role-definitions--permissions-matrix)
3. [Detailed User Flows](#3-detailed-user-flows)
4. [Audit Findings & Recommendations](#4-audit-findings--recommendations)
5. [Completeness Scores by Category](#5-completeness-scores)

---

## 1. Feature Categorization

### Category 1 — User Management & Authentication

| Feature | Status |
|---|---|
| Email/password registration | ✅ Working |
| OTP-based login | ✅ Working |
| JWT access + refresh tokens | ✅ Working |
| Multi-factor authentication (TOTP) | ✅ Working |
| Multi-organization membership | ✅ Working |
| Organization switching | ✅ Working |
| Password change | ✅ Working |
| Session management (revoke sessions) | ✅ Working |
| Social login (Google/Microsoft OAuth) | ⚠️ Backend exists, frontend not confirmed |
| SAML SSO | ⚠️ Backend stub only |
| Invite members via email link | ✅ Working |
| Password reset via email | ⚠️ Not confirmed end-to-end |
| Account lockout (rate limiting) | ✅ Working (5 attempts, 30-min lock) |

### Category 2 — Organization & HR Administration

| Feature | Status |
|---|---|
| Organization onboarding wizard | ✅ Working |
| Organization settings (name, logo, timezone, fiscal year) | ✅ Working |
| Department hierarchy (parent-child) | ✅ Working |
| Department head assignment | ✅ Working |
| Cost center codes per department | ✅ Working |
| Designations / job titles | ✅ Working |
| Custom roles with granular permissions | ✅ Working |
| Employee directory (search, filter) | ✅ Working |
| Employee profile (bio, phone, timezone, avatar) | ✅ Working |
| Org chart visualization | ⚠️ Page exists, tree rendering incomplete |
| Team management | ✅ Working |
| Member invite / remove / role change | ✅ Working |

### Category 3 — Time Tracking & Attendance

| Feature | Status |
|---|---|
| Real-time clock in / clock out | ✅ Working |
| Live elapsed timer on frontend | ✅ Working |
| Manual attendance entry (with reason) | ✅ Working |
| Attendance approval queue (manager/admin) | ✅ Working |
| Attendance history (monthly view) | ✅ Working |
| Attendance stats (Present/Late/Absent/WFH) | ✅ Working |
| Work type tracking (Office/WFH/Field/Travel) | ✅ Working |
| Policy-based working hours enforcement | ✅ Working |
| Holiday calendar management | ❌ Not implemented |
| Shift scheduling | ❌ Not implemented |
| GPS / location tracking | ❌ Not implemented |
| Biometric integration hooks | ❌ Not implemented |
| Overtime auto-calculation | ⚠️ Not confirmed |

### Category 4 — Leave Management

| Feature | Status |
|---|---|
| Leave application (9 leave types) | ✅ Working |
| Leave balance per type | ✅ Working |
| Leave approval / rejection by manager | ✅ Working |
| Leave cancellation (pre-approval) | ✅ Working |
| Leave history (all statuses) | ✅ Working |
| Duration auto-calculation (excludes weekends) | ✅ Working |
| Half-day leave | ⚠️ Not confirmed in UI |
| Public holiday exclusion from leave days | ⚠️ Partial (requires holiday calendar) |
| Team leave calendar view | ❌ Not implemented |
| Leave carry-forward at year-end | ❌ Not implemented |
| Leave encashment | ❌ Not implemented |
| LOP auto-deduction when balance is zero | ⚠️ Not confirmed |

### Category 5 — Timesheets

| Feature | Status |
|---|---|
| Task-level time logging (hours + description) | ✅ Working |
| Total logged vs estimated comparison | ✅ Working |
| Weekly timesheet grid (aggregated view) | ⚠️ Backend exists, UI partial |
| Timesheet submission and review workflow | ⚠️ Backend exists, frontend partial |
| Timesheet lock after approval | ⚠️ Backend exists, not confirmed UI |
| Project-wise time allocation view | ❌ Not confirmed wired |
| CSV / Excel timesheet export | ❌ Not implemented |

### Category 6 — Project Management

| Feature | Status |
|---|---|
| Project CRUD (6-step creation wizard) | ✅ Working |
| Multiple methodologies (Scrum/Kanban/Waterfall/etc.) | ✅ Working |
| Project categories (web/mobile/api/etc.) | ✅ Working |
| Team member management with project roles | ✅ Working |
| Milestone tracking (CRUD, dates, status) | ✅ Working |
| Risk management (severity, impact, mitigation) | ✅ Working |
| Budget tracking (breakdown + burn rate) | ✅ Working |
| Project health score (0–100) | ✅ Working |
| Kanban board with drag-and-drop columns | ✅ Working |
| Custom board column configuration | ⚠️ UI exists, persistence not confirmed |
| Sprint CRUD (create/start/complete) | ✅ Working (backend), ⚠️ UI partial |
| Sprint burndown chart | ✅ Backend, ❌ Frontend not confirmed |
| Sprint velocity tracking | ✅ Backend |
| Project duplication | ✅ Backend only |
| Activity log per project | ✅ Working (last 50 entries) |

### Category 7 — Task Management

| Feature | Status |
|---|---|
| Task CRUD (all types: Epic/Story/Task/Bug/Sub-task/etc.) | ✅ Working |
| Task status lifecycle (Backlog → Done) | ✅ Working |
| Task priority (Low/Medium/High/Critical) | ✅ Working |
| Task assignment (assignee + reporter) | ✅ Working |
| Story points and estimated hours | ✅ Working |
| Subtask hierarchy (parent-child) | ✅ Working |
| Task comments (create/edit/delete) | ✅ Working |
| Time logging per task | ✅ Working |
| Task dependencies (blocked_by/blocks/related/etc.) | ✅ Working |
| Activity/history log per task | ✅ Working |
| Bulk task updates | ✅ Working |
| @mention in comments | ❌ Not implemented |
| Task templates | ❌ Not implemented |
| Recurring tasks | ❌ Not implemented |
| Notification on task assignment | ⚠️ Not confirmed |
| Atomic task key generation (e.g. PROJ-42) | ✅ Working |

### Category 8 — Chat & Messaging

| Feature | Status |
|---|---|
| Real-time direct messages (WebSocket) | ✅ Working |
| Group chats | ✅ Working |
| Channels (admin-created) | ✅ Working |
| Message edit and delete | ✅ Working |
| Message reactions (emoji) | ✅ Backend, ⚠️ Frontend not confirmed |
| Read receipts and unread count | ✅ Backend, ⚠️ Frontend not confirmed |
| Typing indicators | ✅ Working |
| Participant management (add/remove) | ✅ Working |
| Message search | ✅ Working |
| Pinned messages per conversation | ✅ Backend |
| Muted conversations | ✅ Backend |
| File/image attachments | ⚠️ Backend supports it, frontend unclear |
| Message threads / reply-to | ❌ Not implemented |
| Content moderation | ✅ Backend (async flagging) |
| Push notifications when unfocused | ❌ Not implemented |

### Category 9 — Calling

| Feature | Status |
|---|---|
| Initiate audio/video call | ✅ Working |
| Incoming call notification (WebSocket) | ✅ Working |
| Answer / reject call | ✅ Working |
| End call with duration calculation | ✅ Working |
| Call history with filters | ✅ Working |
| Missed calls tracking | ✅ Working |
| Call notes (editable post-call) | ✅ Working |
| Call stats (today's summary) | ✅ Working |
| WebRTC ICE server configuration (STUN/TURN) | ✅ Working |
| Call quality metrics (bitrate, packet loss) | ✅ Backend |
| Group/conference calls | ⚠️ Not confirmed |
| Screen sharing | ❌ Not implemented |
| Call recording | ❌ Not implemented |
| Push notification for incoming calls | ❌ Not implemented |

### Category 10 — Clients & Invoices

| Feature | Status |
|---|---|
| Client CRUD with industry and status | ✅ Working |
| Contact person management (multiple per client) | ✅ Working |
| Project-client linking | ✅ Working |
| Client dashboard (stats, linked projects) | ✅ Working |
| Invoice CRUD with line items | ✅ Working |
| Multiple invoice templates (5 layouts) | ✅ Working |
| Multi-currency support (USD/EUR/GBP/INR) | ✅ Working |
| Tax per line item + discount | ✅ Working |
| Invoice send via email | ✅ Working |
| Mark as paid (manual) | ✅ Working |
| Invoice status flow (Draft → Paid/Overdue) | ✅ Working |
| Recurring invoices | ✅ Working |
| PDF generation/download | ❌ Not confirmed implemented |
| Payment gateway integration (Stripe) | ❌ Not implemented |
| Client portal (external access) | ❌ Not implemented |
| Partial payment recording | ⚠️ Status exists, flow unclear |
| Expense tracking | ❌ Not implemented |

### Category 11 — Policies

| Feature | Status |
|---|---|
| Policy CRUD (11 categories) | ✅ Working |
| Rule builder per category | ✅ Working |
| Applicability scoping (all / dept / individual) | ✅ Working |
| Policy templates (create + reuse) | ✅ Working |
| Policy linked to attendance/leave enforcement | ✅ Working |
| Policy version history | ❌ Not implemented |
| Employee acknowledgment flow | ❌ Not implemented |
| Policy expiry / effective date ranges | ❌ Not implemented |

### Category 12 — Reporting & Analytics

| Feature | Status |
|---|---|
| Platform-level analytics (platform admin) | ⚠️ Partial (some mocked data) |
| Task analytics and stats | ✅ Working |
| Project statistics | ✅ Working |
| Call stats (daily summary) | ✅ Working |
| Attendance stats | ✅ Working |
| Attendance summary report | ❌ No export/report endpoint |
| Leave summary report | ❌ No export/report endpoint |
| Project time report | ❌ Not implemented |
| Employee utilization report | ❌ Not implemented |
| Invoice/billing report | ❌ Not implemented |
| CSV/Excel/PDF export | ❌ Not implemented |
| Report scheduling + email delivery | ❌ Not implemented |
| Reports page | ❌ Stub only |

### Category 13 — Notifications & Alerts

| Feature | Status |
|---|---|
| Notification preferences (stored) | ✅ Working |
| In-app notification delivery | ❌ Not wired |
| Email notifications | ⚠️ Invoice email confirmed; others unclear |
| Push notifications (browser) | ❌ Not implemented |
| @mention notifications | ❌ Not implemented |
| Task assignment notification | ⚠️ Not confirmed |
| Leave approval/rejection notification | ⚠️ Not confirmed |
| Attendance rejection notification | ⚠️ Not confirmed |

### Category 14 — AI Chat

| Feature | Status |
|---|---|
| Multi-turn AI conversation | ✅ Working |
| Conversation history persistence | ✅ Working |
| New conversation creation | ✅ Working |
| Platform context for AI (tasks, attendance) | ❌ Not implemented |
| Tool use / function calling | ❌ Not implemented |
| File upload for AI analysis | ❌ Not implemented |
| Model selection for users | ❌ Not exposed |
| Rate limiting on AI calls | ⚠️ Not confirmed |

### Category 15 — Security & Compliance

| Feature | Status |
|---|---|
| JWT with access + refresh token lifecycle | ✅ Working |
| MFA (TOTP) setup and enforcement | ✅ Working |
| Password strength enforcement | ✅ Working |
| Account lockout after failed attempts | ✅ Working |
| Active session management + revoke | ✅ Working |
| Org-scoped data isolation | ✅ Working |
| Audit logs (platform-wide) | ✅ Working |
| Audit log export | ❌ Not implemented |
| httpOnly cookie token storage | ❌ localStorage used (XSS risk) |
| RBAC enforcement on all backend routes | ⚠️ Inconsistent across services |
| RBAC enforcement on all frontend routes | ⚠️ Sidebar uses hard-coded minRole |
| GDPR data export | ❌ Not implemented |
| Data encryption at rest | ⚠️ Not confirmed |
| CORS configuration | ✅ Managed at API gateway |

### Category 16 — Platform Administration

| Feature | Status |
|---|---|
| List and filter all organizations | ✅ Working |
| Organization detail view | ✅ Working |
| Suspend / activate organization | ✅ Working |
| Cross-org user listing and detail | ✅ Working |
| Platform-wide audit logs | ✅ Working |
| Platform analytics dashboard | ⚠️ Partial (some mocked) |
| Feature flag management per org (UI) | ❌ Flags in DB, no admin UI |
| Bulk operations on organizations | ❌ Not implemented |
| Platform announcements | ❌ Not implemented |
| Plan management (upgrade/downgrade) | ❌ Not implemented |
| Billing / Stripe integration | ❌ Stub only |

---

## 2. Role Definitions & Permissions Matrix

### Role Hierarchy

```
platform_admin
  └── admin (org owner)
        └── manager
              └── member
                    └── viewer (read-only)
```

### Master Permissions Matrix

| Capability | viewer | member | manager | admin | platform_admin |
|---|:---:|:---:|:---:|:---:|:---:|
| **AUTH & PROFILE** | | | | | |
| Login / Register | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own profile | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit own profile | ✗ | ✓ | ✓ | ✓ | ✓ |
| Change own password | ✗ | ✓ | ✓ | ✓ | ✓ |
| Enable/disable MFA | ✗ | ✓ | ✓ | ✓ | ✓ |
| Invite users to org | ✗ | ✗ | ✗ | ✓ | ✓ |
| Change member roles | ✗ | ✗ | ✗ | ✓ | ✓ |
| Remove members | ✗ | ✗ | ✗ | ✓ | ✓ |
| **ATTENDANCE** | | | | | |
| View own attendance | ✓ | ✓ | ✓ | ✓ | ✗ |
| Clock in / clock out | ✗ | ✓ | ✓ | ✓ | ✗ |
| Submit manual entry | ✗ | ✓ | ✓ | ✓ | ✗ |
| View team attendance | ✗ | ✗ | ✓ | ✓ | ✗ |
| Approve / reject attendance | ✗ | ✗ | ✓ | ✓ | ✗ |
| View all org attendance | ✗ | ✗ | ✗ | ✓ | ✗ |
| **LEAVES** | | | | | |
| View own leave balance | ✓ | ✓ | ✓ | ✓ | ✗ |
| Apply for leave | ✗ | ✓ | ✓ | ✓ | ✗ |
| Cancel own leave | ✗ | ✓ | ✓ | ✓ | ✗ |
| View team leave requests | ✗ | ✗ | ✓ | ✓ | ✗ |
| Approve / reject leave | ✗ | ✗ | ✓ | ✓ | ✗ |
| View all org leaves | ✗ | ✗ | ✗ | ✓ | ✗ |
| **TASKS** | | | | | |
| View assigned tasks | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create tasks | ✗ | ✓ | ✓ | ✓ | ✗ |
| Edit own tasks | ✗ | ✓ | ✓ | ✓ | ✗ |
| Edit any task | ✗ | ✗ | ✓ | ✓ | ✗ |
| Delete tasks | ✗ | ✗ | ✓ | ✓ | ✗ |
| Log time on tasks | ✗ | ✓ | ✓ | ✓ | ✗ |
| Add / edit comments | ✗ | ✓ | ✓ | ✓ | ✗ |
| Bulk update tasks | ✗ | ✗ | ✓ | ✓ | ✗ |
| View all org tasks | ✗ | ✗ | ✓ | ✓ | ✗ |
| **PROJECTS** | | | | | |
| View assigned projects | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create projects | ✗ | ✗ | ✓ | ✓ | ✗ |
| Edit project details | ✗ | ✗ | ✓ | ✓ | ✗ |
| Manage project team | ✗ | ✗ | ✓ | ✓ | ✗ |
| Add milestones / risks | ✗ | ✗ | ✓ | ✓ | ✗ |
| Delete projects | ✗ | ✗ | ✗ | ✓ | ✗ |
| Manage sprints | ✗ | ✗ | ✓ | ✓ | ✗ |
| View all org projects | ✗ | ✗ | ✓ | ✓ | ✗ |
| **HR ADMIN** | | | | | |
| View employee directory | ✓ | ✓ | ✓ | ✓ | ✗ |
| View employee profiles | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit employee profiles | ✗ | ✗ | ✗ | ✓ | ✗ |
| Create departments | ✗ | ✗ | ✗ | ✓ | ✗ |
| Edit / delete departments | ✗ | ✗ | ✗ | ✓ | ✗ |
| Create designations | ✗ | ✗ | ✗ | ✓ | ✗ |
| Create / edit custom roles | ✗ | ✗ | ✗ | ✓ | ✗ |
| **POLICIES** | | | | | |
| View applicable policies | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create / edit policies | ✗ | ✗ | ✗ | ✓ | ✗ |
| Delete policies | ✗ | ✗ | ✗ | ✓ | ✗ |
| Create policy templates | ✗ | ✗ | ✗ | ✓ | ✗ |
| **CLIENTS & INVOICES** | | | | | |
| View clients | ✗ | ✗ | ✓ | ✓ | ✗ |
| Create / edit clients | ✗ | ✗ | ✓ | ✓ | ✗ |
| Delete clients | ✗ | ✗ | ✗ | ✓ | ✗ |
| Create / edit invoices | ✗ | ✗ | ✓ | ✓ | ✗ |
| Send invoice to client | ✗ | ✗ | ✓ | ✓ | ✗ |
| Mark invoice as paid | ✗ | ✗ | ✓ | ✓ | ✗ |
| Delete invoices | ✗ | ✗ | ✗ | ✓ | ✗ |
| **COMMUNICATION** | | | | | |
| Send / receive direct messages | ✗ | ✓ | ✓ | ✓ | ✗ |
| Create group chats | ✗ | ✓ | ✓ | ✓ | ✗ |
| Create channels | ✗ | ✗ | ✗ | ✓ | ✗ |
| Make / receive calls | ✗ | ✓ | ✓ | ✓ | ✗ |
| View own call history | ✗ | ✓ | ✓ | ✓ | ✗ |
| View all call history | ✗ | ✗ | ✓ | ✓ | ✗ |
| **SETTINGS** | | | | | |
| Edit own profile settings | ✗ | ✓ | ✓ | ✓ | ✓ |
| Edit org settings | ✗ | ✗ | ✗ | ✓ | ✗ |
| Manage billing | ✗ | ✗ | ✗ | ✓ | ✗ |
| View security settings | ✗ | ✓ | ✓ | ✓ | ✓ |
| Enforce MFA org-wide | ✗ | ✗ | ✗ | ✓ | ✗ |
| **PLATFORM ADMIN** | | | | | |
| View all organizations | ✗ | ✗ | ✗ | ✗ | ✓ |
| Suspend / activate orgs | ✗ | ✗ | ✗ | ✗ | ✓ |
| View all platform users | ✗ | ✗ | ✗ | ✗ | ✓ |
| View platform audit logs | ✗ | ✗ | ✗ | ✗ | ✓ |
| View platform analytics | ✗ | ✗ | ✗ | ✗ | ✓ |
| Manage feature flags per org | ✗ | ✗ | ✗ | ✗ | ✓ |

---

## 3. Detailed User Flows

### 3.1 Feature: User Registration & Organization Onboarding

**Roles Involved:** Any new user (becomes admin if first in org)

**Standard Flow:**

1. User navigates to `/register`. Enters name, email, password (minimum: 8 chars, uppercase, lowercase, number, special char enforced client-side and server-side).
2. On submit → `POST /auth/register`. Server creates a pending user record and triggers OTP email.
3. User is redirected to an OTP verification screen. Enters 6-digit OTP received by email → `POST /auth/verify-otp`.
4. On success: JWT access token + refresh token issued. User is redirected to `/complete-profile` if name/password not yet set.
5. After profile completion → `POST /auth/complete-profile`. User is now active.
6. System checks: does this user belong to an existing organization?
   - **Yes (invited):** User is redirected to `/select-org` if multiple orgs, else directly to `/dashboard`.
   - **No (new org):** User is redirected to `/onboarding` wizard.
7. Onboarding wizard (3 steps):
   - Step 1: Enter organization name, size, industry.
   - Step 2: Invite initial team members (optional, skippable).
   - Step 3: Basic settings (timezone, fiscal year start).
8. Submit → creates org, assigns registering user as admin. Redirects to `/dashboard`.

**Edge Cases:**

- OTP expires (5 attempts, then lockout): User must restart registration or request a new OTP.
- User tries to register with an email already in use: Server returns 409; UI shows "Email already registered" error.
- User abandons onboarding mid-flow: State is preserved; next login resumes onboarding if org is still incomplete.

---

### 3.2 Feature: Login, MFA & Session Management

**Roles Involved:** All roles

**Flow:**

1. User navigates to `/login`. Enters email and password → `POST /auth/login`.
2. Failed attempt: Server increments attempt counter. After 5 failures within a session window, account is locked for 30 minutes; user sees lockout message with countdown.
3. Successful (no MFA): Server returns access token + refresh token. Tokens stored in localStorage. User redirected to `/dashboard` (or `/platform` for platform_admin).
4. Successful (MFA enabled): Server returns a `mfa_required` flag and a temporary session token. User is redirected to `/login/mfa`.
5. User opens authenticator app, reads 6-digit TOTP code, enters it in the MFA screen → `POST /auth/verify-otp`.
6. On success: Full JWT issued. User redirected to their default route.
7. Multi-org user: `/select-org` screen shows all their organizations with role badges. User clicks one → `POST /auth/organizations/switch` → JWT reissued with new `organizationId` and `orgRole`.
8. Token refresh: Axios interceptor detects a 401 response → automatically calls `POST /auth/refresh` with the stored refresh token → on success, retries the original request transparently. On refresh failure, redirects to `/login`.
9. Logout: `POST /auth/logout` → server invalidates refresh token → localStorage cleared → redirect to `/login`.
10. Session management: User navigates to `/settings/security` → sees list of active sessions with device/IP/browser info → can revoke any individual session.

**Edge Cases:**

- Refresh token expired (after 7 days of inactivity): User sees login page on next visit; stored data cleared.
- User opens app in two tabs: Both tabs share the same token; a logout in one tab will cause the other to receive a 401 on next request and redirect.

---

### 3.3 Feature: Attendance — Clock In / Clock Out

**Roles Involved:** Member, Manager, Admin

**Flow:**

1. Member navigates to `/attendance`. The page loads today's attendance card showing "Not Checked In" with a live digital clock.
2. Member selects work type (Office / WFH / Field / Travel) if prompted (policy-driven).
3. Member clicks Check In → `POST /attendance/check-in`. Server records timestamp, IP address, user ID, organization ID, and work type.
4. Frontend updates immediately: The check-in time is displayed. A live elapsed timer begins (showing "Checked in for 2h 14m" in real time).
5. Member works through the day. If they accidentally close the browser, the timer state is recovered from `GET /attendance/today` on next page load.
6. At end of day, member clicks Check Out → `POST /attendance/check-out`. Server calculates total working hours; applies policy rules (is minimum hours met? Is the employee late?).
7. Frontend shows final summary: Check-in time, check-out time, total hours, status badge (Present / Late / WFH / etc.).
8. Manager view: Manager navigates to `/attendance` → sees the same page but with an additional **Approvals** tab showing the pending approval queue for their team.

**Edge Cases:**

- Double check-in: User already checked in today; Check In button is disabled; server returns 409 if called directly.
- Missing check-out: User forgets to check out. Record stays open. Admin/manager can submit a manual entry to correct it.
- Network failure during check-in: The API call fails. Frontend shows error toast. User retries. Server is idempotent for the same-day check-in.

---

### 3.4 Feature: Attendance — Manual Entry & Approval

**Roles Involved:** Member (submits), Manager/Admin (approves)

**Flow:**

1. Member navigates to `/attendance` → clicks **Manual Entry**.
2. Form opens: date picker, check-in time, check-out time, reason (required text field), work type selector.
3. Member submits → `POST /attendance/manual-entry`. Entry is saved with status `pending`.
4. Entry appears in member's attendance history with a "Pending" badge.
5. Manager navigates to `/attendance` → opens **Approvals** tab. Sees the pending entry: employee name, date, times claimed, reason provided.
6. Manager reviews and chooses:
   - **Approve** → `PUT /attendance/:id/approve` with `{ status: 'approved' }`. Entry moves to approved status and is counted in attendance stats.
   - **Reject** → `PUT /attendance/:id/approve` with `{ status: 'rejected', rejectionReason: '...' }`. Employee's history entry updates to "Rejected" with the reason shown.
7. ⚠️ Notification gap: Employee is not currently notified of the outcome — see §4.

**Edge Cases:**

- Submitting a manual entry for a date that already has an approved record: Server should reject with a conflict error. Behavior not confirmed.
- Manager rejects without providing a reason: The `rejectionReason` field should be required on rejection — not confirmed enforced.

---

### 3.5 Feature: Leave Management — Application & Approval

**Roles Involved:** Member (applies), Manager/Admin (approves)

**Flow:**

1. Member navigates to `/leaves`. Leave Balance cards display current balance for each type (e.g., Casual: 8/12, Sick: 3/10, WFH: 24/52).
2. Member clicks **Apply Leave**.
3. Form: leave type dropdown, start date, end date (calendar picker). Duration auto-calculates (e.g., "3 working days" — weekends excluded based on policy). Reason field (required). Optional contact number during leave. Optional attachment (for Sick leave).
4. Member submits → `POST /leaves`. Entry created with status `pending`.
5. Entry appears in **My Leaves** tab with "Pending" badge.
6. Member can cancel before approval → `PUT /leaves/:id/cancel` (only allowed when status is `pending`).
7. Manager navigates to `/leaves` → **Team Leaves** tab. Sees pending requests with employee name, leave type, dates, duration, reason.
8. Manager approves → `PUT /leaves/:id/approve` with `{ status: 'approved' }`. Leave balance is deducted automatically for the relevant type.
9. Manager rejects → `PUT /leaves/:id/approve` with `{ status: 'rejected', rejectionReason: '...' }`. Leave balance is not affected.

**Edge Cases:**

- Employee applies for leave that exceeds their balance: Server should block with a "Insufficient balance" error. Not confirmed enforced.
- Overlapping leave request: Employee applies twice for overlapping dates. Server should detect and reject. Not confirmed.
- Leave applied for a public holiday: Currently no holiday calendar — the holiday counts as a leave day, which is incorrect behavior.
- Year-end carry-forward: When the fiscal year rolls over, existing balances are not automatically carried forward or reset. **This is a critical gap.**

---

### 3.6 Feature: Timesheet — Task-Level Time Logging

**Roles Involved:** Member, Manager, Admin

**Flow:**

1. Member is working on a task. They navigate to a task detail page (via `/tasks` or `/projects/[id]/items/[itemId]`).
2. They click the **Time Log** tab within the task detail view.
3. The time log panel shows all previously logged entries with columns: Date, Hours, Description, Logged By.
4. Member clicks **Log Time**. A modal appears with: date picker (defaults to today), hours input, and a description/note field.
5. Member enters details → `POST /tasks/:id/time`. Entry is saved.
6. The panel updates to show the new entry. Total logged hours recalculates (e.g., "6.5h logged / 8h estimated").
7. Timesheet aggregated view: Member navigates to `/timesheets`. The page shows a weekly grid (Mon–Sun) with all projects and tasks as rows and days as columns showing hours per day. ⚠️ This aggregated UI is partially implemented.
8. Member reviews the week's timesheet and clicks **Submit for Review** → `POST /timesheets` or updates timesheet status to `submitted`.
9. Manager/Admin navigates to timesheets review → sees submitted timesheets → can approve or reject → `PUT /timesheets/:id/review`.
10. Once approved, timesheet entries are locked — no further edits to time logs for that period.

**Edge Cases:**

- Logging more hours than the estimated value: System should warn but not block. Behavior not confirmed.
- Logging time for a task on a past date: Allowed, but should be flagged in reporting.
- Timesheet not submitted by deadline: No automated reminder is currently wired.
- User closes browser with an active timer running: Timer state is not persisted across sessions — time logged must be entered manually.

---

### 3.7 Feature: Project Creation (6-Step Wizard)

**Roles Involved:** Manager, Admin

**Flow:**

1. Manager navigates to `/projects` → clicks **New Project** → redirected to `/projects/new`.
2. **Step 1 — Project Details:** Name (required), description, category (web/mobile/api/devops/design/data/internal/other), methodology (Scrum/Kanban/Scrumban/Waterfall/XP/Lean/SAFe/Custom), priority (low/medium/high/critical), status (defaults to "planning"), start date, end date.
3. **Step 2 — Board Setup:** Default columns shown (Backlog, To Do, In Progress, In Review, Done). Manager can add custom columns (e.g., "QA Testing"), reorder them, or remove defaults. ⚠️ Column persistence not fully confirmed.
4. **Step 3 — Client:** Optional. Search and link an existing client from the system.
5. **Step 4 — Team:** Search for org members by name. Add them with a project-specific role (Developer/Designer/QA/DevOps/PM/Analyst/Stakeholder) and allocation percentage.
6. **Step 5 — Budget:** Set total budget, currency, and a breakdown by category (development/design/QA/management/other).
7. **Step 6 — Tags:** Add free-form searchable tags to the project.
8. Manager clicks **Create Project** → `POST /projects`. Server generates a unique project key (e.g., WEB-1), creates the default board, saves all configuration.
9. Manager is redirected to `/projects/[id]` — the new project detail page.

**Edge Cases:**

- Required field (project name) missing: Form validation blocks submission.
- Wizard abandonment mid-step: Current state is held in component state only — refreshing the page loses progress. (No draft save.)
- Duplicate project name: Server does not enforce uniqueness — same name projects are allowed.

---

### 3.8 Feature: Sprint Management

**Roles Involved:** Manager, Admin

**Flow:**

1. Manager navigates to `/projects/[id]` → switches to the **Board** view or navigates to `/projects/[id]/sprints/[sprintId]`.
2. Clicks **Create Sprint** → form: sprint name, goal, start date, end date → `POST /sprints`.
3. Sprint is created with status `planned`. It appears in the sprint backlog.
4. Manager drags tasks from the Backlog column into the sprint, or uses the sprint selector on task detail to assign tasks to this sprint.
5. Manager clicks **Start Sprint** → `POST /sprints/:id/start`. Sprint status becomes `active`. Only one sprint can be active per project at a time.
6. During the sprint, the board shows tasks in their columns. Team members move tasks by dragging columns (status update → `PUT /tasks/:id`).
7. Burndown data is recorded automatically by a nightly cron job (midnight) — tracking remaining story points vs ideal.
8. At sprint end, manager clicks **Complete Sprint** → `POST /sprints/:id/complete`. Server:
   - Calculates velocity (sum of story points for tasks in Done).
   - Moves incomplete tasks to the backlog or next sprint (based on manager selection).
   - Records sprint summary: velocity, carry-over points, burn rate.
9. Sprint is archived. Historical sprint data is available for velocity tracking.

**Edge Cases:**

- Starting a sprint when another is already active: Server blocks; error shown.
- Sprint end date passes without completion: Sprint stays active; no auto-completion.
- Tasks with no story points: Velocity calculation still runs, counting only tasks with point values.

---

### 3.9 Feature: Task Creation & Full Lifecycle

**Roles Involved:** Member (create/update own), Manager/Admin (full control)

**Flow:**

1. User navigates to `/tasks` → clicks **New Task**. A modal opens.
2. Fields:
   - Title (required)
   - Type: Epic / Story / Task / Bug / Sub-task / Improvement / Spike
   - Status: Backlog / To Do / In Progress / In Review / Blocked / Done / Cancelled
   - Priority: Low / Medium / High / Critical
   - Project (optional — links task to a project and board)
   - Sprint (optional — assign to an active sprint)
   - Assignee (search org members)
   - Reporter (defaults to current user)
   - Dates: Start date, due date
   - Effort: Estimated hours, story points
   - Labels / Components / Tags
3. Submit → `POST /tasks`. Server generates a unique task key (e.g., PROJ-42) atomically using a counter schema. Task is created and appears in the relevant board column based on status.
4. Full task detail (click task → `/projects/[id]/items/[itemId]`):
   - All fields are editable inline.
   - **Comments tab:** Add comment, edit own comment, delete own comment. All users with access can see comments.
   - **Time Log tab:** Log hours (see §3.6).
   - **Dependencies tab:** Add a dependency — search for another task → select type (`blocked_by` / `blocks` / `related` / `duplicates` / `duplicated_by` / `clones` / `cloned_by`) → `PUT /tasks/:id`.
   - **Activity tab:** Chronological history of all field changes, comments, status transitions.
   - **Subtasks panel:** Click **Add Subtask** → creates a child task → `POST /tasks/:id/subtasks`. Subtask inherits the project; parent-child relationship is stored.
5. Status update via board drag-and-drop: User drags task card to a different column → `PUT /tasks/:id` with new status. Board updates optimistically; server confirms.
6. Bulk update: Manager selects multiple tasks → bulk action bar appears → change status/priority/assignee for all → `PUT /tasks/bulk`.

**Edge Cases:**

- Creating an Epic and linking Stories: Epic is created as a regular task with type `Epic`. Stories are created with a `parent` field pointing to the epic's ID.
- Task with Blocked status: System tracks it; no automated unblocking notification when the blocking task is resolved.
- Assigning task to user not in the project team: Allowed at org level; no project membership check enforced.
- Task due date passes without completion: Status remains as-is; no auto-transition to Overdue. Overdue filtering is available in list view.

---

### 3.10 Feature: Chat — Direct Messages, Groups & Channels

**Roles Involved:** Member, Manager, Admin (channels: Admin only to create)

**Flow — Direct Message:**

1. Member navigates to `/chat`. Left panel shows existing conversations.
2. Clicks **New Message** → search modal for org members by name → select a user → `POST /chat/conversations/direct`.
3. If a conversation already exists with that user, the existing one is opened (no duplicate created).
4. Member types a message and sends → `POST /chat/messages`. Message is delivered in real-time via WebSocket (`message:new` event) to the recipient.
5. Recipient sees the message appear instantly. Unread count badge updates on their conversation list.
6. Member can edit their own message (within configurable time window) → `PUT /chat/messages/:id`. Edit propagates via `message:edited` WebSocket event.
7. Member can delete their own message → `DELETE /chat/messages/:id`. Deletion propagates via `message:deleted` event.
8. Admin can moderate (hard-delete) any message regardless of ownership.

**Flow — Group Chat:**

1. Member clicks **New Group** → selects multiple org members → enters a group name → `POST /chat/conversations/group`.
2. Group appears in the conversation list for all participants.
3. Admin of the group can add participants → `POST /chat/conversations/:id/participants`, or remove them → `DELETE /chat/conversations/:id/participants/:userId`.

**Flow — Channel:**

1. Admin navigates to chat → clicks **New Channel** → enters channel name, description → `POST /chat/conversations/channel`.
2. Channel is visible to all org members. Members click **Join** to participate.
3. Only Admin can delete channels.

**Typing Indicators:** When member starts typing → WebSocket emits `user:typing` event → all participants in the conversation see "Name is typing..." indicator.

**Edge Cases:**

- Network disconnect mid-conversation: WebSocket reconnects automatically on restore. Messages sent during disconnect are queued and delivered on reconnect.
- Large group (50+ members): WebSocket broadcast performance not benchmarked. Potential scalability concern.
- Content moderation trigger: Message content is asynchronously scanned post-send. Flagged messages are marked internally. ⚠️ There is no blocking — the message is delivered and then flagged. No UI for reviewing flagged messages is confirmed on the frontend.

---

### 3.11 Feature: Calling — Initiate, Answer, End

**Roles Involved:** Member, Manager, Admin

**Flow:**

1. Member navigates to `/calls` → views call history (status, duration, participants, notes).
2. Clicks **New Call** → searches for a user or selects from contacts.
3. Selects call type (audio / video) and initiates → `POST /calls`. Calling service creates a call record with status `Initiated`.
4. Calling service emits `call:incoming` WebSocket event to the recipient with caller info and call ID.
5. Recipient sees incoming call modal anywhere in the app (WebSocket event is global). Can:
   - **Answer** → `POST /calls/:callId/answer` with media preferences (audio-only / video). Status → `Answered`. `call:answered` event sent to caller.
   - **Reject** → `POST /calls/:callId/reject` with optional reason. Status → `Declined`. `call:rejected` event sent to caller.
6. WebRTC signaling (once answered):
   - Caller sends `webrtc:offer` (SDP offer) via WebSocket to calling gateway.
   - Recipient sends `webrtc:answer` (SDP answer) back.
   - Both sides exchange `webrtc:ice-candidate` events for NAT traversal (using STUN/TURN servers configured in ENV).
   - Browser `RTCPeerConnection` is established. Audio/video flows peer-to-peer.
7. During call: call duration timer runs on frontend.
8. Either party clicks **End Call** → `POST /calls/:callId/end`. Server records end timestamp, calculates duration, status → `Ended`. `call:ended` event broadcast to all participants.
9. Call appears in history. User can click on the call → **Edit Notes** → `PUT /calls/:callId/notes`.

**Edge Cases:**

- Recipient is offline (WebSocket not connected): `call:incoming` event is never delivered. Call status stays `Ringing`. Caller eventually ends the call → status → `Missed`. Missed call appears in recipient's history on next login.
- Call drops mid-conversation (network failure): WebRTC connection closes; ICE restart may recover automatically depending on network. If not, both parties see the call dropped. No auto-reconnect is implemented.
- Browser tab closed during a call: WebSocket disconnects; call is orphaned in `Answered` state. A cleanup job (not confirmed) would need to mark it as ended after a timeout.

---

### 3.12 Feature: Client & Invoice Management

**Roles Involved:** Manager, Admin

**Flow — Create Client:**

1. Manager navigates to `/clients` → clicks **New Client**.
2. Form: company name, industry, status (active/inactive/prospect), billing address. Contact persons section: add multiple contacts with name, email, phone, designation, primary contact toggle.
3. Submit → `POST /clients`. Client record created.
4. In client detail page: **Projects** tab allows linking an existing project → `POST /clients/:id/projects`.

**Flow — Create & Send Invoice:**

1. Manager navigates to `/invoices` → clicks **New Invoice**.
2. Fields: client (required), linked project (optional), invoice number (auto-generated by server), issue date, due date, currency (USD/EUR/GBP/INR), template layout (standard/modern/minimal/professional/creative).
3. Line items: Add rows with description, quantity, unit rate, tax %. Totals auto-calculate: subtotal, tax amount, discount %, total due.
4. Optional: toggle **Recurring** → set interval (weekly/monthly/quarterly/yearly) and end date.
5. Manager saves as Draft → `POST /invoices`. Status: `Draft`.
6. Manager reviews and clicks **Send Invoice** → `POST /invoices/:id/send`. Server dispatches email to the primary client contact. Status: `Sent`.
7. Client pays. Manager records payment: **Mark as Paid** → `PUT /invoices/:id/mark-paid`. Status: `Paid`.
8. If due date passes without payment: Status automatically becomes `Overdue` (server-side date check at query time or cron job — behavior not confirmed).
9. Manager can cancel invoice → Status: `Cancelled`.

**Edge Cases:**

- Sending invoice without a client email: Server should return an error if no primary contact email exists. Handling not confirmed.
- PDF download: No server-side PDF generation confirmed. ❌ Critical gap — clients and managers cannot download a formatted invoice.
- Partial payment: The status `Partially Paid` exists but the UI flow for recording partial payments is unclear.

---

### 3.13 Feature: Policy Management

**Roles Involved:** Admin

**Flow:**

1. Admin navigates to `/policies`.
2. Policies are listed grouped by category (Working Hours, Leave, WFH, Overtime, etc.).
3. Admin clicks **New Policy** → selects a category.
4. Rule builder renders fields relevant to the category:
   - **Working Hours:** Min daily hours, break duration, flex hours toggle, grace period.
   - **Leave Policy:** Quota per leave type, carry-forward limit, requires attachment toggle.
   - **WFH Policy:** Max WFH days per week, approval required toggle.
   - **Overtime:** Multiplier, max monthly OT hours.
5. Admin sets **Applicability:** All employees / specific departments / specific individuals.
6. Admin saves → `POST /policies`. Policy is active immediately for the scoped employees.
7. Template flow: Admin clicks **Save as Template** on an existing policy → `POST /policies/templates`. Template is stored.
8. For a new policy: Admin clicks **Use Template** → selects a template → fields are pre-populated → `POST /policies/from-template`.

**Edge Cases:**

- Conflicting policies (two leave policies applied to the same employee): No conflict detection implemented. The last applied policy wins — behavior not confirmed.
- Policy changes mid-year: Changes take effect immediately; retroactive recalculation of leave balances is not implemented.
- Employee acknowledgment: Employees are not notified when a policy is created or modified. ❌ Gap.

---

### 3.14 Feature: Roles & Permissions Configuration

**Roles Involved:** Admin

**Flow:**

1. Admin navigates to `/roles`.
2. Existing roles are listed with their permission counts.
3. Admin clicks **New Role** → enters role name and description.
4. Permission matrix builder: Toggle permissions across sections:
   - Dashboard: View
   - People: View, Create, Edit, Delete, Export, Assign
   - Time & Attendance: View, Approve, Export
   - Finance: View, Create, Edit, Delete, Export
   - System: Manage Settings, Manage Roles, Manage Policies
5. Admin saves → `POST /roles`.
6. Edit existing role: `PUT /roles/:id`. Changes take effect for all users with that role immediately.
7. Delete role: `DELETE /roles/:id`. Only possible if no users are currently assigned this role (enforcement not confirmed).
8. Assign role to a user: Admin navigates to `/settings/members` → selects a member → changes their role dropdown → `PUT /organizations/members/:userId`.

> **Critical Gap:** Custom role permissions created here are stored in the database, but the frontend sidebar visibility is controlled by hard-coded `minRole` checks (e.g., `minRole="manager"`), not by the dynamic custom role permissions. This means a custom role with `Finance: View` permission will **not** gain access to the Clients/Invoices section unless the hard-coded check is also satisfied.

---

### 3.15 Feature: AI Chat Assistant

**Roles Involved:** All org users

**Flow:**

1. User navigates to `/ai-chat`.
2. Page loads with conversation history from previous sessions retrieved via `GET /ai/conversations`.
3. User types a question or command in the input box (e.g., "Summarize the tasks overdue in the Alpha project").
4. Message submitted → `POST /ai/chat`. AI service processes the request. Response is streamed or returned in full.
5. Response appears in the conversation. The exchange is persisted.
6. User can continue the conversation multi-turn — context is maintained within the session.
7. User clicks **New Chat** → creates a fresh conversation; old conversation remains in history.

> **Critical Gap:** The AI service does not have access to any platform data (tasks, attendance records, leave balances, projects). It cannot answer questions like "What tasks are due today?" or "Who is on leave this week?" because no tool-use / function-calling integration has been built. The AI operates as a generic assistant only.

---

### 3.16 Feature: Platform Admin — Organization & User Management

**Roles Involved:** Platform Admin only

**Flow:**

1. Platform admin logs in → automatically redirected to `/platform`.
2. Dashboard shows: total organizations count, total users count, new orgs this month, new users this month, orgs by plan (Starter/Professional/Enterprise), orgs by status (active/suspended/trial).
3. Navigate to `/platform/organizations` → paginated list of all orgs (20/page). Search by name, filter by status.
4. Click an org → `/platform/organizations/[id]`. View: org name, plan, member count, feature flags enabled, creation date.
5. **Suspend org:** Click Suspend → `POST /platform/organizations/:id/suspend`. All users in that org lose access immediately (JWT validation should check org suspended status).
6. **Activate org:** Click Activate → `POST /platform/organizations/:id/activate`. Access restored.
7. Navigate to `/platform/users` → cross-org user listing. Search and filter.
8. Click a user → `/platform/users/[id]`. View: profile, all org memberships with roles, last login timestamp.
9. Navigate to `/platform/audit-logs` → full audit log: action, target type, target ID, performed by user, IP address, timestamp. Filter by action type, date range, org.
10. Navigate to `/platform/analytics` → platform-wide metrics. ⚠️ Some metrics are mocked and not derived from real aggregated data.

---

## 4. Audit Findings & Recommendations

### 4.1 Critical Security Issues

| # | Finding | Risk | Recommendation |
|---|---|---|---|
| S-1 | JWT tokens stored in localStorage | **HIGH** — XSS attack can steal tokens and impersonate users | Migrate to httpOnly cookies with `SameSite=Strict`. Requires frontend and auth-service changes. |
| S-2 | Hardcoded OTP `000000` in `auth.service.ts` (line 617) | **HIGH** — Any attacker can bypass OTP verification in dev/staging environments if not removed before prod | Add ENV guard: only allow if `NODE_ENV === 'development'`. Alert on startup if present in production. |
| S-3 | RBAC not enforced consistently across all services | **HIGH** — A member can call manager-only endpoints directly if they know the route | All service endpoints must apply `@Roles()` guards. Conduct an endpoint-by-endpoint audit per service. |
| S-4 | Custom role permissions not enforced on frontend routes | **MEDIUM** — Users can navigate to pages they lack permission for via direct URL | Replace hard-coded `minRole` sidebar checks with dynamic permission evaluation from JWT payload. |
| S-5 | No rate limiting on API endpoints beyond login | **MEDIUM** — API endpoints are open to brute-force or scraping | Apply rate limiting at the API gateway level for all services, per-org and per-user. |
| S-6 | Chat content moderation is non-blocking (async) | **LOW** — Harmful content is delivered before flagging | For high-severity content (e.g., explicit material), implement a synchronous pre-send check. |

### 4.2 Critical Feature Gaps (Production Blockers)

| # | Gap | Impact | Priority |
|---|---|---|---|
| G-1 | Dashboard shows no real aggregated data | Users see empty stats on the first page they land on | P0 |
| G-2 | PDF invoice download not implemented | Clients cannot receive a formatted invoice document | P0 |
| G-3 | Password reset via email not confirmed end-to-end | Users who forget passwords may be permanently locked out | P0 |
| G-4 | Reports page is a stub | No reporting functionality at all | P0 |
| G-5 | Billing/payments not integrated (Stripe stub) | Cannot onboard paying customers | P0 |
| G-6 | Notification delivery not wired | Preferences saved but no notifications are ever sent (in-app or email) | P1 |
| G-7 | Org chart visualization incomplete | Company hierarchy not visible — a core HR feature | P1 |
| G-8 | Timesheet aggregated weekly view not wired to API | Time tracking as a standalone workflow is broken | P1 |
| G-9 | Leave carry-forward at year-end not implemented | All leave balances go stale; requires manual DB intervention annually | P1 |
| G-10 | Holiday calendar management missing | Leave duration calculations are incorrect on public holidays | P1 |
| G-11 | AI chat has no platform data context | AI assistant provides no value for platform-specific queries | P2 |
| G-12 | WebRTC browser implementation not confirmed | Audio/video calls may not transmit media despite signaling working | P1 |
| G-13 | Sprint board drag-and-drop between sprint/backlog not confirmed | Core Scrum workflow is blocked | P1 |
| G-14 | Feature flag management has no admin UI | Platform admin cannot manage org capabilities without DB access | P2 |

### 4.3 UX & Usability Issues

| # | Issue | Recommendation |
|---|---|---|
| U-1 | No draft saving for 6-step project creation wizard | Auto-save wizard state to localStorage after each step |
| U-2 | Error handling is inconsistent (some pages show generic alerts, others show nothing) | Implement a centralized toast/notification system with consistent error messaging |
| U-3 | No optimistic UI updates — all mutations wait for API response | Add optimistic updates for task status changes (board drag-and-drop) for perceived performance |
| U-4 | No request deduplication for concurrent identical requests | Add a request deduplication layer in the Axios client |
| U-5 | @mention in tasks/chat not implemented | Users cannot tag colleagues in comments — a major collaboration gap |
| U-6 | Unread message count badges in chat not confirmed functional | Re-verify and implement badge counters in sidebar conversation list |
| U-7 | No "forgot password" flow clearly visible | Add a prominent "Forgot password?" link on the login page and wire the email flow end-to-end |
| U-8 | Chat file attachments UI unclear | The backend supports files; confirm and implement the upload UI with drag-and-drop support |

### 4.4 Performance & Scalability Concerns

| # | Concern | Recommendation |
|---|---|---|
| P-1 | WebSocket broadcasts to large groups (50+ members) have no benchmarking | Load test WebSocket channels with 100+ concurrent users; consider a message broker (Redis Pub/Sub) for scale |
| P-2 | Project activity log capped at 50 entries — older entries are silently dropped | Archive older entries to a separate collection rather than deleting; surface older history via pagination |
| P-3 | No caching layer on frequently read data (attendance stats, org members list) | Add Redis caching for expensive aggregate queries with short TTLs |
| P-4 | Nightly burndown cron job runs for ALL active sprints simultaneously | Use a distributed queue (Bull/BullMQ) rather than a single cron job to prevent large-scale contention |
| P-5 | localStorage-based token storage degrades with many orgs (tokens for each org stored separately) | Multi-org token management should be centralized and bounded |

### 4.5 Enhancement Opportunities (Post-MVP)

| Priority | Enhancement | Category |
|---|---|---|
| HIGH | Burndown chart / velocity chart visualization on frontend | Projects |
| HIGH | Team leave calendar (who is on leave, when) | Leaves |
| HIGH | Report generation with CSV/PDF export (attendance, leave, tasks) | Reports |
| HIGH | @mention in tasks and chat with in-app notification | Tasks / Chat |
| MEDIUM | Push notifications (browser and mobile) | Notifications |
| MEDIUM | Google OAuth / social login | Auth |
| MEDIUM | Emoji reactions in chat | Chat |
| MEDIUM | Message threads (reply-to) | Chat |
| MEDIUM | Task templates for recurring work | Tasks |
| MEDIUM | Payment gateway integration (Stripe) | Invoices |
| MEDIUM | Client portal for invoice viewing and payment | Invoices |
| MEDIUM | Expense management (link to projects/clients) | Finance |
| MEDIUM | Kanban WIP (Work In Progress) limits | Projects |
| LOW | SSO (SAML / OIDC) for enterprise customers | Auth |
| LOW | GDPR data export | Compliance |
| LOW | Webhook system for external integrations | Platform |
| LOW | Shift scheduling for field/factory workers | Attendance |
| LOW | Mobile app (React Native) | Platform |

---

## 5. Completeness Scores

| Category | Score | Rationale |
|---|:---:|---|
| User Management & Authentication | 7.5/10 | Core flows solid; social login partial, password reset unconfirmed, SSO not done |
| Organization & HR Administration | 8.0/10 | Department, roles, designations all working; org chart visualization incomplete |
| Time Tracking & Attendance | 7.0/10 | Clock in/out and approvals excellent; no holiday calendar, no shift support, no GPS |
| Leave Management | 7.0/10 | Application and approval flows work well; carry-forward, half-day, team calendar all missing |
| Timesheets | 5.0/10 | Backend is built; frontend aggregated view and lock workflow are only partially wired |
| Project Management | 8.5/10 | One of the strongest areas; sprint board drag-and-drop and burndown chart frontend are incomplete |
| Task Management | 8.5/10 | Comprehensive; @mentions, templates, and recurring tasks are the main gaps |
| Chat & Messaging | 7.0/10 | Real-time infrastructure solid; file attachments, threads, and push notifications missing |
| Calling | 7.5/10 | Signaling infrastructure complete; WebRTC media layer not confirmed; no recording or screen share |
| Clients & Invoices | 7.0/10 | Full lifecycle works; PDF generation, payment gateway, and client portal are critical gaps |
| Policies | 6.5/10 | CRUD and templates work; acknowledgment, versioning, and effective dates not implemented |
| Reporting & Analytics | 2.0/10 | The weakest area by far — reports page is a stub with no export, no generation, no scheduling |
| Notifications & Alerts | 2.5/10 | Preferences stored but delivery not wired; effectively non-functional for users |
| AI Chat | 4.0/10 | Conversation works generically; no platform context or tool-use integration |
| Security & Compliance | 6.0/10 | Good fundamentals; localStorage token storage and inconsistent RBAC are significant risks |
| Platform Administration | 7.5/10 | Organization and user management complete; feature flag UI and billing plan management missing |
| **Overall Platform** | **6.5/10** | A mature, well-architected platform with strong core workflows. The main gaps are in cross-cutting concerns: notifications, reporting, and consistent security enforcement. |

---

## Summary: Top 5 Things to Fix Before Launch

1. **Wire the notifications system** — preferences are saved but nothing is ever delivered. Users have no feedback on approvals, assignments, or messages when not actively in the app.
2. **Implement PDF invoice generation** — the invoice module is otherwise complete, but without a downloadable PDF, it cannot be used professionally.
3. **Enforce RBAC consistently across all service endpoints** — a security audit of each microservice's routes is required to confirm all endpoints have the correct `@Roles()` guards.
4. **Build the Reports module** — attendance, leave, task, and utilization reports are essential for any HR or PM platform.
5. **Replace localStorage with httpOnly cookies for JWT storage** to eliminate the XSS token theft risk.
