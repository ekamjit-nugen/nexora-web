# Nexora Project Management — Jira-Style Simulation & Audit

**Simulated Organization:** TechForge Solutions Pvt. Ltd.
**Team Size:** 20 members
**Methodology:** Scrum + Kanban Hybrid
**Simulation Date:** 2026-03-31
**Auditor:** Jira Architect & Agile Coach Simulation

---

## Table of Contents

1. [Organization & Team Setup](#1-organization--team-setup)
2. [Permissions Matrix](#2-permissions-matrix)
3. [Simulations](#3-simulations)
   - [Simulation 1 — User Invitation](#simulation-1-admin-invites-users)
   - [Simulation 2 — Project Creation](#simulation-2-project-creation--mobile-banking-app)
   - [Simulation 3 — Epic & Story Creation](#simulation-3-epic--story-creation--mba-project)
   - [Simulation 4 — Sprint Creation & Management](#simulation-4-sprint-creation--management)
   - [Simulation 5 — Board Interactions](#simulation-5-board-interactions-kanbanscrum-board)
   - [Simulation 6 — Task Comments & Collaboration](#simulation-6-task-comment--collaboration)
   - [Simulation 7 — Sprint Completion](#simulation-7-sprint-completion)
   - [Simulation 8 — Viewer Role Access Test](#simulation-8-viewer-role-access-test)
   - [Simulation 9 — Reporting](#simulation-9-reporting)
4. [Comprehensive Audit](#4-comprehensive-audit)
5. [Prioritized Recommendations](#5-prioritized-recommendations)
6. [Adoption Readiness Score](#6-adoption-readiness-score)

---

## 1. Organization & Team Setup

### 20-Member Team Roster

| # | Name | System Role | Functional Role |
|---|---|---|---|
| 1 | **Arjun Mehta** | `admin` | Org Owner / CTO |
| 2 | **Priya Nair** | `manager` | Engineering Manager / Scrum Master |
| 3 | **Rahul Sharma** | `manager` | Project Manager — Mobile Banking |
| 4 | **Divya Krishnan** | `member` | Tech Lead — Backend |
| 5 | **Siddharth Rao** | `member` | Senior Developer — Backend |
| 6 | **Neha Gupta** | `member` | Senior Developer — Frontend |
| 7 | **Karan Verma** | `member` | Developer — Backend |
| 8 | **Ananya Singh** | `member` | Developer — Frontend |
| 9 | **Rohit Patel** | `member` | Developer — Backend |
| 10 | **Meera Iyer** | `member` | Developer — Mobile |
| 11 | **Aryan Joshi** | `member` | QA Engineer — Manual |
| 12 | **Shreya Desai** | `member` | QA Engineer — Automation |
| 13 | **Varun Kapoor** | `member` | DevOps Engineer |
| 14 | **Pooja Menon** | `member` | UX/UI Designer |
| 15 | **Tanvi Shah** | `member` | UX Designer |
| 16 | **Nikhil Bansal** | `member` | Business Analyst |
| 17 | **Riya Agarwal** | `member` | Business Analyst |
| 18 | **Vikram Tiwari** | `viewer` | Client Stakeholder — BankCorp |
| 19 | **Sunita Reddy** | `viewer` | Client Stakeholder — PayFast Ltd. |
| 20 | **Mohan Das** | `viewer` | Read-Only Auditor / Compliance |

### Projects Created

| Project | Key | Methodology | Lead |
|---|---|---|---|
| Mobile Banking App | MBA | Scrum | Rahul Sharma |
| Website Maintenance | WBM | Kanban | Priya Nair |
| Payment Gateway Integration | PGI | Hybrid | Divya Krishnan |

---

## 2. Permissions Matrix

### Nexora Role Hierarchy

```
platform_admin
  └── admin (org owner)
        └── manager
              └── member
                    └── viewer (read-only)
```

### Nexora Actual vs Jira Expected

| Capability | viewer | member | manager | admin | Jira Equivalent |
|---|:---:|:---:|:---:|:---:|---|
| Create project | ✗ | ✗ | ✓ | ✓ | Project Admin |
| Delete project | ✗ | ✗ | ✗ | ✓ | Project Admin |
| Create tasks | ✗ | ✓ | ✓ | ✓ | Any logged-in user |
| Edit own tasks | ✗ | ✓ | ✓ | ✓ | Issue creator / assignee |
| Edit any task | ✗ | ✗ | ✓ | ✓ | Project role-gated |
| Delete tasks | ✗ | ✗ | ✓ | ✓ | Project Admin |
| Manage sprints | ✗ | ✗ | ✓ | ✓ | Scrum Master / PM |
| Bulk update tasks | ✗ | ✗ | ✓ | ✓ | Members in Jira |
| Invite members | ✗ | ✗ | ✗ | ✓ | Org Admin |
| Create channels | ✗ | ✗ | ✗ | ✓ | Workspace Admin |
| Make/receive calls | ✗ | ✓ | ✓ | ✓ | N/A (no Jira equiv.) |

> **Critical Gap:** Nexora uses 4 flat org-level roles. Jira has **project-level roles** that are separate from org roles — a `member` can be "Project Admin" on one project and "Developer" on another. Nexora has no per-project role assignment, which is a critical architectural gap for a multi-project organization.

---

## 3. Simulations

---

### Simulation 1: Admin Invites Users

**Actor:** Arjun Mehta — `admin`
**Current System State:** Fresh organization, no members yet.

#### Steps Performed

1. Arjun logs in → navigates to **Settings → Members**
2. Clicks **"Invite Member"**
3. Sees fields:
   - `Email` (required)
   - `Role` dropdown: viewer / member / manager / admin
4. Invites each member one at a time

#### Screen Output

```
✅ Invitation sent to: priya.nair@techforge.io
   Role: manager
   Status: Pending acceptance

✅ Invitation sent to: rahul.sharma@techforge.io
   Role: manager
   Status: Pending acceptance

✅ Invitation sent to: divya.krishnan@techforge.io
   Role: member
   Status: Pending acceptance

[... repeated 17 more times]
```

#### Industry Standard Check

| Field | Nexora | Jira | Status |
|---|---|---|---|
| Email field | ✅ | ✅ | Match |
| Role selection (4 flat roles) | ✅ | ✅ (org + project roles) | Partial |
| Department assignment at invite | ❌ | ✅ | Missing |
| Job title at invite | ❌ | ✅ | Missing |
| Bulk invite via CSV | ❌ | ✅ | Missing |
| Invite expiry timer | ⚠️ Not confirmed | ✅ | Unconfirmed |
| Custom welcome message | ❌ | ✅ | Missing |
| Invite status tracking | ✅ | ✅ | Match |

**Gap Identified:** No bulk CSV invite. Onboarding a 20-member org requires 20 separate invite actions — significant UX friction. No department or job title can be pre-assigned at invite time.

---

### Simulation 2: Project Creation — "Mobile Banking App"

**Actor:** Rahul Sharma — `manager`
**Current System State:** Organization set up, 20 members invited.

#### Steps Performed

1. Navigates to **Projects → New Project**
2. Nexora presents a **6-step creation wizard**

#### Screen Output — Wizard Steps

```
Step 1: Basic Info
  Name*:        Mobile Banking App
  Key*:         MBA  (auto-generated, editable)
  Category:     Mobile
  Description:  Retail mobile banking app for BankCorp client

Step 2: Methodology
  Type:         Scrum ← selected

Step 3: Team Members
  Added:        Divya Krishnan, Siddharth Rao, Neha Gupta,
                Karan Verma, Ananya Singh, Aryan Joshi,
                Pooja Menon, Nikhil Bansal

Step 4: Milestones
  M1: Alpha Release       — 2026-04-30
  M2: Beta Launch         — 2026-05-31
  M3: Production Release  — 2026-06-30

Step 5: Risks
  R1: Third-party KYC API delays — High severity, High impact
      Mitigation: Maintain fallback manual KYC process

Step 6: Budget
  Total:   ₹45,00,000
  Dev:     ₹30,00,000
  QA:      ₹8,00,000
  Design:  ₹7,00,000
```

```
✅ Project Created Successfully
   Project Key:    MBA
   Health Score:   100 / 100
   Board:          MBA Scrum Board (auto-created)
   Backlog:        0 items
```

**Remaining Projects Created (abbreviated):**

```
✅ Website Maintenance (WBM) — Kanban
   Team: Ananya Singh, Tanvi Shah, Varun Kapoor, Riya Agarwal, Shreya Desai

✅ Payment Gateway Integration (PGI) — Hybrid
   Team: Rohit Patel, Meera Iyer, Siddharth Rao, Aryan Joshi, Shreya Desai, Varun Kapoor
```

#### Industry Standard Check

| Field | Nexora | Jira | Status |
|---|---|---|---|
| Project name + key | ✅ | ✅ | Match |
| Methodology selection | ✅ | ✅ | Match |
| Project category | ✅ | ✅ | Match |
| Project lead / owner | ⚠️ Unclear | ✅ | Unconfirmed |
| Project visibility (public/private) | ❌ | ✅ | **Missing — Critical** |
| Components / modules | ❌ | ✅ | Missing |
| Fix Version / Release tracking | ❌ | ✅ | Missing |
| Issue type scheme (configurable) | ❌ | ✅ | Missing |
| Workflow scheme (per project) | ❌ | ✅ | Missing |
| Per-project role assignment | ❌ | ✅ | **Missing — Critical** |
| Project template selection | ⚠️ Methodology only | ✅ | Partial |
| Project duplication | ✅ Backend / ❌ UI | ✅ | Partial |

**Gap Identified:** No project visibility control — all projects appear accessible to all members. No components, fix versions, or per-project workflow customization.

---

### Simulation 3: Epic & Story Creation — MBA Project

**Actor:** Nikhil Bansal — `member` (Business Analyst)
**Current System State:** MBA project created, 8 members on team, empty backlog.

#### Steps Performed

1. Navigates to **Projects → MBA → Backlog**
2. Clicks **"Create Task"**
3. Fills in Epic details

#### Screen Output — Epic Creation

```
Type*:             Epic
Title*:            User Authentication & KYC
Description:       Handle full auth lifecycle including OTP login,
                   biometric fallback, and KYC document upload
Assignee:          Divya Krishnan
Priority:          High
Story Points:      40
Estimated Hours:   80
Status:            Backlog (default)
Due Date:          2026-04-15
Labels:            [authentication, kyc]
Dependencies:      none

✅ Task Created: MBA-1
   Type: Epic | Key: MBA-1 (atomic counter confirmed)
```

#### Screen Output — Stories & Tasks Created Under MBA

```
MBA-2 | Story   | "As a user, I can register with mobile number"
  Parent:    MBA-1 (Epic)
  Assignee:  Meera Iyer
  Priority:  High | Points: 5 | Hours: 10
  Sprint:    (unassigned — backlog)

MBA-3 | Story   | "As a user, I can login with OTP"
  Assignee:  Meera Iyer | Points: 3 | Priority: High

MBA-4 | Bug     | "OTP resend not working on iOS 17"
  Assignee:  Aryan Joshi | Priority: Critical

MBA-5 | Task    | "Set up Firebase push notification service"
  Assignee:  Varun Kapoor | Points: 2 | Priority: Medium

MBA-6 | Sub-task | "Write unit tests for OTP service"
  Parent:    MBA-3
  Assignee:  Shreya Desai | Points: 1

MBA-7 | Story   | "As a user, I can upload KYC documents"
  Assignee:  Rohit Patel | Points: 8 | Priority: High

MBA-8 | Task    | "Integrate third-party KYC verification API"
  Assignee:  Siddharth Rao | Points: 5 | Priority: High
```

#### Industry Standard Check

| Field | Nexora | Jira | Status |
|---|---|---|---|
| Issue types (Epic/Story/Task/Bug/Sub-task) | ✅ | ✅ | Match |
| Title / Summary | ✅ | ✅ | Match |
| Description (rich text) | ✅ | ✅ | Match |
| Assignee | ✅ | ✅ | Match |
| Reporter (separate field) | ⚠️ Not confirmed | ✅ | **Missing** |
| Priority | ✅ | ✅ | Match |
| Story Points | ✅ | ✅ | Match |
| Estimated Hours | ✅ | ✅ | Match |
| Sprint assignment | ✅ | ✅ | Match |
| Epic Link (parent) | ✅ via parent field | ✅ | Match |
| Fix Version / Release | ❌ | ✅ | Missing |
| Components | ❌ | ✅ | Missing |
| Labels | ✅ | ✅ | Match |
| Environment (for bugs) | ❌ | ✅ | **Missing** |
| Steps to Reproduce (for bugs) | ❌ | ✅ | **Missing** |
| Acceptance Criteria | ❌ | ✅ | **Missing** |
| Custom fields | ❌ | ✅ | **Missing — Critical** |
| Attachments | ✅ | ✅ | Match |
| Linked issues (blocked_by/blocks/related) | ✅ | ✅ | Match |
| @mention in description | ❌ | ✅ | Missing |
| Clone issue | ❌ | ✅ | Missing |
| Watch issue / subscribers | ❌ | ✅ | Missing |
| Atomic key generation (PROJ-42) | ✅ | ✅ | Match |

**Gap Identified:** No `Reporter` field. No `Environment` or `Steps to Reproduce` for bugs. No `Acceptance Criteria`. No `Fix Version`. No custom fields — critical gap for any production Jira replacement.

---

### Simulation 4: Sprint Creation & Management

**Actor:** Priya Nair — `manager` (Scrum Master)
**Current System State:** MBA backlog has 7 items (MBA-2 through MBA-8).

#### Steps Performed — Sprint 1

1. Navigates to **MBA → Sprints → Create Sprint**
2. Fills in sprint details
3. Assigns backlog items
4. Starts sprint

#### Screen Output — Sprint 1 Creation

```
Sprint Name*:  MBA Sprint 1
Goal:          "Complete user auth flow and OTP login"
Start Date*:   2026-04-01
End Date*:     2026-04-14
Duration:      14 days (2 weeks)

✅ Sprint Created: MBA Sprint 1
   Status: PLANNED | Items: 0
```

```
Items assigned to Sprint 1:
  MBA-2  (Story,    5 pts)  — Meera Iyer
  MBA-3  (Story,    3 pts)  — Meera Iyer
  MBA-5  (Task,     2 pts)  — Varun Kapoor
  MBA-6  (Sub-task, 1 pt)   — Shreya Desai
  ─────────────────────────────────────
  Total: 4 items | 11 story points
```

```
Priya clicks "Start Sprint"

✅ MBA Sprint 1 — ACTIVE
   Start: 2026-04-01 | End: 2026-04-14
   Sprint Goal: "Complete user auth flow and OTP login"
   Team Velocity Target: 11 pts
```

#### Steps Performed — Sprint 2 (Created in parallel)

```
✅ MBA Sprint 2 — PLANNED
   Start: 2026-04-15 | End: 2026-04-28
   Goal: "KYC integration and document upload"
   Items: MBA-4, MBA-7, MBA-8 (14 pts backlog-assigned)
```

#### Industry Standard Check

| Feature | Nexora | Jira | Status |
|---|---|---|---|
| Sprint CRUD | ✅ | ✅ | Match |
| Sprint goal | ✅ | ✅ | Match |
| Start / end dates | ✅ | ✅ | Match |
| Assign items from backlog | ✅ | ✅ | Match |
| Start sprint confirmation dialog | ⚠️ Not confirmed | ✅ | Unconfirmed |
| Incomplete items warning at sprint close | ❌ | ✅ | **Missing — Critical** |
| Move incomplete items to next sprint/backlog | ❌ | ✅ | **Missing — Critical** |
| Sprint capacity planning (hours) | ❌ | ✅ | Missing |
| Burndown chart (frontend) | ❌ | ✅ | **Missing** |
| Velocity chart (frontend) | ❌ | ✅ | **Missing** |
| Sprint review / retro notes | ❌ | ✅ | Missing |
| Multiple active sprints simultaneously | ❌ Not confirmed | ✅ | Unconfirmed |
| Sprint report after close | ⚠️ Backend only | ✅ | Partial |

**Gap Identified:** Sprint completion flow for incomplete items is undefined in the UI — items risk becoming unreachable orphans. Burndown and velocity charts exist in backend but are not rendered on the frontend.

---

### Simulation 5: Board Interactions (Kanban/Scrum Board)

**Actor:** Karan Verma — `member` (Developer)
**Current System State:** MBA Sprint 1 active. Board has 4 items in "To Do".

#### Steps Performed

1. Karan navigates to **MBA → Board**
2. Drags MBA-2 from "To Do" → "In Progress"
3. Opens MBA-2, logs time

#### Screen Output — Board State After Actions

```
MBA Scrum Board — Sprint 1 Active
──────────────────────────────────────────────────────────
BACKLOG  │ TO DO     │ IN PROGRESS │ IN REVIEW  │ DONE
─────────┼───────────┼─────────────┼────────────┼─────────
         │ MBA-3 ●   │ MBA-2 ✦     │            │
         │ MBA-5     │             │            │
         │ MBA-6     │             │            │
──────────────────────────────────────────────────────────
● = High priority   ✦ = In progress (Karan Verma)

✅ Status updated: MBA-2 → In Progress
   Activity logged: "Karan Verma moved MBA-2 to In Progress at 09:15 AM"
```

```
Time Log on MBA-2:
  Hours: 3.5
  Description: "Implemented OTP registration endpoint"

✅ Time logged: 3.5h on MBA-2
   Total logged: 3.5h / 10h estimated (35%)
```

#### Industry Standard Check

| Feature | Nexora | Jira | Status |
|---|---|---|---|
| Drag-and-drop columns | ✅ | ✅ | Match |
| Column WIP limits | ❌ | ✅ | **Missing — Critical (Kanban)** |
| Swimlanes (by assignee / epic) | ❌ | ✅ | Missing |
| Card color coding by priority | ❌ Not confirmed | ✅ | Unconfirmed |
| Quick edit on card (inline) | ❌ | ✅ | Missing |
| Inline assignee change on card | ❌ | ✅ | Missing |
| Board filters (assignee, label, sprint) | ❌ Not confirmed | ✅ | **Missing** |
| Epic progress panel on board | ❌ | ✅ | Missing |
| Flag / impediment marker on card | ❌ | ✅ | Missing |
| Custom column config persistence | ⚠️ Not confirmed | ✅ | Unconfirmed |
| Board zoom / density settings | ❌ | ✅ | Missing |

**Gap Identified:** No WIP limits (fundamental to Kanban), no swimlanes, no board-level filters. At 20 members working across 3 projects, the board will be visually cluttered and unusable without these features.

---

### Simulation 6: Task Comment & Collaboration

**Actor:** Aryan Joshi — `member` (QA Engineer)
**Current System State:** MBA-4 bug open and unassigned to sprint.

#### Steps Performed

1. Aryan opens **MBA-4** (Bug: "OTP resend not working on iOS 17")
2. Adds a detailed comment
3. Attempts to @mention a teammate

#### Screen Output — Comment Added

```
Comment by Aryan Joshi — 2026-03-31 10:42 AM

"Reproduced on iPhone 14, iOS 17.2.
Steps to reproduce:
  1. Open app and register a new account
  2. Enter mobile number and request OTP
  3. Wait 60 seconds for OTP to expire
  4. Tap 'Resend OTP' button
  → Nothing happens. No network request sent. No error shown.
Expected: New OTP sent and toast confirmation shown
Environment: iOS 17.2, iPhone 14 Pro, App v1.0.3-beta"

✅ Comment added to MBA-4
```

#### @Mention Attempt

```
Aryan types "@Meera" in comment box
→ ❌ No autocomplete dropdown appears
→ ❌ No user list suggestion shown
→ Comment saved as plain text "@Meera please check this on your device"
→ ❌ No notification sent to Meera Iyer
```

#### Industry Standard Check

| Feature | Nexora | Jira | Status |
|---|---|---|---|
| Add comment | ✅ | ✅ | Match |
| Edit own comment | ✅ | ✅ | Match |
| Delete own comment | ✅ | ✅ | Match |
| @mention with notification | ❌ | ✅ | **Missing — Critical** |
| Rich text / markdown in comments | ⚠️ Not confirmed | ✅ | Unconfirmed |
| Attach screenshot to comment | ⚠️ Not confirmed | ✅ | Unconfirmed |
| Comment notification to assignee | ⚠️ Not confirmed | ✅ | Unconfirmed |
| Internal / private comments | ❌ | ✅ | Missing |
| Comment reactions (emoji) | ❌ | ✅ | Missing |
| Link issue in comment | ❌ | ✅ | Missing |
| Comment thread / reply-to | ❌ | ✅ | Missing |

**Gap Identified:** @mention is entirely non-functional. In a 20-person team, this is a critical daily-use feature. Comments cannot trigger notifications, making async task collaboration nearly impossible.

---

### Simulation 7: Sprint Completion

**Actor:** Priya Nair — `manager`
**Current System State:** Sprint 1 end date reached (2026-04-14). 4 items in sprint.

#### Sprint 1 Final State

```
MBA-2  | Registration flow       | ✅ Done
MBA-3  | OTP login               | ✅ Done
MBA-5  | Firebase setup          | ✅ Done
MBA-6  | Unit tests for OTP      | ⚠️ In Progress (incomplete)
```

#### Expected Jira Behavior

```
Priya clicks "Complete Sprint" →

Modal:
  ┌─────────────────────────────────────────────┐
  │  Complete Sprint: MBA Sprint 1               │
  │  3 issues were completed.                    │
  │  1 issue is incomplete.                      │
  │                                              │
  │  Where should incomplete issues go?          │
  │  ○ Backlog                                   │
  │  ● MBA Sprint 2 (next sprint — recommended) │
  │                                              │
  │  [Complete Sprint]  [Cancel]                 │
  └─────────────────────────────────────────────┘
```

#### Nexora Actual Behavior

```
⚠️ Sprint completion UI partially implemented
   No incomplete-item destination modal confirmed
   Backend: Sprint marked as COMPLETED
   MBA-6 fate: UNKNOWN — possible orphan task
```

```
Sprint 1 Completed:
  ✅ Velocity: 9 story points completed / 11 planned (82%)
  ✅ Backend sprint report generated
  ❌ Burndown chart: not rendered on frontend
  ❌ Velocity trend chart: not rendered on frontend
  ❌ Sprint review notes: not available
```

**Gap Identified:** Sprint close flow for incomplete items is a data integrity risk. Tasks may become stranded with no sprint assignment and no visibility in backlog. This must be resolved before production use.

---

### Simulation 8: Viewer Role Access Test

**Actor:** Vikram Tiwari — `viewer` (Client Stakeholder — BankCorp)
**Current System State:** MBA project active with Sprint 1 completed.

#### Scenario A — View Project Tasks

```
Vikram navigates to Projects → MBA → Board
✅ Can view tasks assigned to him → Allowed (spec confirmed)
⚠️ Can view ALL project tasks → Unclear (spec: "view assigned only")
```

#### Scenario B — Attempt to Create a Task

```
Vikram sees board view
Q: Is "Create Task" button visible?
  ⚠️ Risk: Frontend RBAC inconsistency flagged in Feature Audit
     "sidebar uses hard-coded minRole" — button may render for viewer
  Expected: Button hidden or disabled with tooltip "Insufficient permissions"
  Backend: Would return 403 if called
  Frontend: NOT CONFIRMED to be hidden
```

#### Scenario C — Attempt to Add Comment

```
Vikram opens task MBA-7
Q: Is "Add Comment" input visible?
  ⚠️ Same frontend RBAC risk applies
  Expected: Comment box hidden for viewer role
  Actual: Unconfirmed
```

#### Scenario D — Attempt to Access Settings

```
Vikram navigates to /settings
  Expected: Redirect to dashboard or 403 page
  route-guard.tsx exists but full coverage is unconfirmed
```

**Gap Identified:** Frontend RBAC is inconsistently enforced per your Feature Audit. The `route-guard.tsx` component exists but coverage across all pages is not confirmed. A `viewer` potentially sees action buttons they cannot use — this creates confusion and a potential trust/security issue with client stakeholders.

---

### Simulation 9: Reporting

**Actor:** Rahul Sharma — `manager`
**Current System State:** MBA Sprint 1 completed. Sprint 2 active.

#### Steps Performed

1. Rahul navigates to **MBA → Reports**

#### Screen Output

```
Available Reports in Nexora (MBA Project):

  [Backend data exists, frontend rendering status varies]

  Burndown Chart ............. ⚠️ Data exists / Frontend NOT confirmed
  Velocity Chart ............. ✅ Backend / ❌ Frontend not rendering
  Sprint Report .............. ⚠️ Partial

  NOT AVAILABLE:
  ❌ Cumulative Flow Diagram
  ❌ Control Chart (cycle time)
  ❌ Epic Progress Report
  ❌ Release Burnup Chart
  ❌ Time in Status Report
  ❌ Team Workload / Utilization Report
  ❌ CSV / PDF Export for any report
  ❌ Report scheduling or email delivery
```

```
Rahul attempts to export velocity data as CSV:
→ ❌ No export button present
→ ❌ No download option anywhere in reports
```

#### Industry Standard Check

| Report | Nexora | Jira | Status |
|---|---|---|---|
| Sprint burndown | ⚠️ Backend only | ✅ | Partial |
| Velocity chart | ⚠️ Backend only | ✅ | Partial |
| Cumulative flow diagram | ❌ | ✅ | Missing |
| Control chart / cycle time | ❌ | ✅ | Missing |
| Epic progress | ❌ | ✅ | Missing |
| Release burnup | ❌ | ✅ | Missing |
| CSV / PDF export | ❌ | ✅ | **Missing** |
| Report scheduling | ❌ | ✅ | Missing |
| Time tracking / workload reports | ❌ | ✅ | **Missing** |

**Gap Identified:** The entire reporting layer is a stub. Managers and stakeholders have no visual sprint progress and cannot export any data. This is a P0 gap for any PM-level adoption.

---

## 4. Comprehensive Audit

### 4A. Critical Gaps — P0 (Blockers for Production Adoption)

| # | Gap | Area | Impact |
|---|---|---|---|
| 1 | No per-project role assignment | Permissions | `member` is `member` across all projects — no project-specific Lead/Developer/Viewer designation |
| 2 | Sprint completion incomplete-item flow | Sprints | Items may become orphaned on sprint close; data integrity risk |
| 3 | Frontend RBAC inconsistency | Security | Viewers/members may see action buttons they cannot use; trust and security risk |
| 4 | JWT stored in localStorage (XSS risk) | Security | Critical vulnerability — tokens accessible to injected scripts |
| 5 | Burndown / velocity charts not on frontend | Reporting | Sprint planning is blind — PM has no visual progress indicator |
| 6 | No WIP limits on Kanban board | Board | Core Kanban principle missing; "Website Maintenance" project is unmanageable |
| 7 | @mention not implemented | Collaboration | Team of 20 cannot effectively collaborate on tasks asynchronously |

### 4B. High-Priority Gaps — P1 (Needed Within 2 Sprints)

| # | Gap | Area | Impact |
|---|---|---|---|
| 8 | No Reporter field on tasks | Task fields | Accountability and audit trail broken |
| 9 | No Environment / Steps to Reproduce on bugs | Task fields | QA workflow incomplete; bugs lack context |
| 10 | No Acceptance Criteria field | Task fields | BA → Dev handoff undocumented |
| 11 | No Fix Version / Release field | Task fields | Release management impossible |
| 12 | No Components / modules | Task fields | Cannot filter or group by feature area |
| 13 | No board-level filters (assignee, label, sprint) | Board | Board unusable at 20-person scale |
| 14 | No swimlanes | Board | No per-person workload visibility on board |
| 15 | No issue cloning | Task actions | Major daily-use feature missing |
| 16 | No task templates | Task actions | Recurring task types require re-entering all fields |
| 17 | No bulk CSV invite | User mgmt | Painful 20-invite-one-by-one onboarding |
| 18 | No project visibility control (public/private) | Projects | All projects visible to all org members |

### 4C. Medium-Priority Gaps — P2

| # | Gap | Area | Impact |
|---|---|---|---|
| 19 | No custom fields per project | Task fields | Cannot capture client-specific or project-specific data |
| 20 | No sprint review / retro notes | Sprints | Agile ceremonies are undocumented |
| 21 | No parallel active sprints | Sprints | Multi-team projects impossible to manage correctly |
| 22 | No sprint capacity planning (team hours) | Sprints | Sprint load is guesswork — no over/under-commitment detection |
| 23 | No issue watching / subscribers | Collaboration | Can't follow progress on a task without being the assignee |
| 24 | No workflow customization per project | Workflow | All projects forced to share the same column states |
| 25 | No inline card editing on board | Board | Forces full task-detail open for every minor field change |
| 26 | No blocked / impediment flag on cards | Board | No visual escalation path for blocked work |
| 27 | Reports page is a stub | Reporting | Managers operating without any data visualization |
| 28 | No CSV / PDF export anywhere | Reporting | No management reporting to clients or leadership |

### 4D. Usability Friction Points

| # | Friction Point | Severity |
|---|---|---|
| 1 | 6-step project creation wizard — too heavy for quick project setup | Medium |
| 2 | Single-invite-at-a-time for members — 20 separate actions for onboarding | High |
| 3 | Board custom column config does not persist across refreshes | High |
| 4 | Org-chart tree rendering incomplete — new hires can't visualize company structure | Low |
| 5 | Timesheet UI partial — time is logged on tasks but weekly submission flow is incomplete | Medium |
| 6 | No start-sprint confirmation dialog — accidental sprint starts possible | Medium |
| 7 | No issue count / point count displayed in backlog header | Low |

### 4E. Edge Cases & Failure Scenarios

| Scenario | Expected Behavior | Nexora Actual | Risk |
|---|---|---|---|
| `member` edits another member's task | 403 Forbidden | Backend blocks; frontend may not hide button | Medium |
| `viewer` clicks "Create Task" | Button hidden + 403 if called | Button visibility unconfirmed | High |
| Sprint closed with 0 items done | Velocity = 0, graceful completion | No confirmed error handling | Medium |
| Sub-task created with no parent | Should warn or block | Likely allowed — orphan sub-task possible | Low |
| Task assigned to user not in project | Should validate team membership | No project-member validation at task level confirmed | Medium |
| Duplicate project key attempted | Should return validation error | Project key uniqueness validation unconfirmed | High |
| Sprint with no items started | Should warn | No confirmation dialog confirmed | Low |
| Bulk update with 0 items selected | Should show validation | Unconfirmed | Low |

---

## 5. Prioritized Recommendations

### Immediate — Before Any Production Launch

1. **Security:** Move JWT tokens from `localStorage` to `httpOnly` cookies (eliminates XSS attack surface)
2. **Security:** Implement consistent frontend RBAC route guards across all pages — audit every page against the permissions matrix
3. **Sprints:** Build sprint completion modal with incomplete-item destination (backlog or next sprint)
4. **Reporting:** Wire burndown and velocity chart components to backend data on the frontend
5. **Tasks:** Add `Reporter` field to all task types

### Sprint 1 — Core Usability

6. Implement @mention in comments with in-app notification
7. Add board filters: assignee, label, sprint, issue type, priority
8. Add swimlanes to board view (by assignee and by epic)
9. Add WIP limit configuration to Kanban boards
10. Add `Environment`, `Steps to Reproduce`, and `Acceptance Criteria` fields to task form

### Sprint 2 — Full Adoption Readiness

11. Implement per-project role assignment (separate from org-level role)
12. Add issue cloning
13. Add project visibility control (public / private / restricted)
14. Add `Fix Version`, `Components`, and `Release` fields to tasks
15. Build bulk CSV member invite

### Sprint 3 — Completeness

16. Custom fields per project (text, number, date, dropdown, user picker)
17. Sprint capacity planning with team hours
18. Sprint review and retrospective notes
19. Parallel active sprints support
20. CSV / PDF export for reports and timesheets

---

## 6. Adoption Readiness Score

| Category | Score | Key Gaps |
|---|---|---|
| Core task management | 6.5 / 10 | Missing reporter, acceptance criteria, custom fields |
| Sprint management | 5.5 / 10 | Frontend UI for sprint close and burndown incomplete |
| Board experience | 5.0 / 10 | No filters, WIP limits, swimlanes, or inline edit |
| Collaboration | 4.0 / 10 | No @mentions; notification delivery unconfirmed |
| Permissions / Security | 5.0 / 10 | XSS risk (localStorage); frontend RBAC inconsistent |
| Reporting | 2.0 / 10 | Stub only; no exports; charts not rendered on frontend |
| Project setup | 6.0 / 10 | Good wizard; missing visibility, components, versions |
| User management | 6.0 / 10 | Works; no bulk invite, no per-project roles |

### Overall Adoption Readiness: **5.0 / 10**

---

### Verdict

> Nexora's project management module has a **solid backend architecture** and covers essential CRUD operations for tasks, sprints, and projects. The atomic key generation, dependency linking, activity logs, and budget/milestone tracking provide a good foundation.
>
> However, it is **not yet production-ready** for a 20-member IT organization adopting it as a Jira replacement. The frontend is partially implemented in several critical areas (burndown charts, sprint close flow, board filters), the security posture has a confirmed XSS vulnerability, and the collaboration layer (@mentions, notifications) is largely unimplemented.
>
> With **2–3 focused development sprints** targeting the P0 and P1 gaps listed above, the platform could realistically reach a **7.5–8.0 / 10** adoption readiness score and serve as a credible Jira alternative for a small-to-medium IT organization.

---

*Generated by Jira Architecture Simulation — Nexora Platform v1.0 — 2026-03-31*
