# Nexora — Projects, Boards & Tasks: Complete Feature Reference

> **Version:** 2.0
> **Platform:** Nexora by Nugen IT Services
> **Stack:** React.js, Node.js, MongoDB, Tailwind CSS, AWS
> **Last Updated:** March 2026

---

## Table of Contents

1. [Projects](#1-projects)
2. [Project Templates (12 Templates)](#2-project-templates-12-templates)
3. [Template Application Engine](#3-template-application-engine)
4. [Boards](#4-boards)
5. [Tasks](#5-tasks)
6. [Sprints](#6-sprints)
7. [Timesheets](#7-timesheets)
8. [API Endpoints Summary](#8-api-endpoints-summary)
9. [Database Schemas](#9-database-schemas)
10. [Frontend Pages & Components](#10-frontend-pages--components)

---

## 1. Projects

### 1.1 Core Fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| projectName | string | Yes | — | Max 150 chars. Text-indexed for search. |
| projectKey | string | Auto | — | Auto-generated unique 2-5 char uppercase key from project name (e.g., "WEB", "MOB", "ECMR"). Used as prefix for all task IDs: WEB-001, WEB-002, etc. |
| description | string | No | — | Supports markdown. Text-indexed. Max 5000 chars. |
| category | enum | No | other | `web_app`, `mobile_app`, `api_development`, `cloud_migration`, `devops`, `staff_augmentation`, `consulting`, `ecommerce`, `data_analytics`, `other` |
| status | enum | No | planning | `planning`, `active`, `on_hold`, `completed`, `cancelled` |
| priority | enum | No | medium | `critical`, `high`, `medium`, `low` |
| startDate | date | No | — | Expected start |
| endDate | date | No | — | Expected end |
| actualStartDate | date | No | — | Set when status changes to `active` |
| actualEndDate | date | No | — | Set on archive or completion |
| departmentId | ObjectId | No | — | ref: Department |
| clientId | ObjectId | No | — | ref: Client |
| tags | string[] | No | [] | Max 20 tags. Text-indexed. |
| healthScore | number | — | 100 | Auto-calculated (0-100). See Health Score Engine. |
| progressPercentage | number | — | 0 | Auto-calculated: (done tasks / total tasks) x 100 |
| templateRef | ObjectId | No | — | ref: Template. Which template created this project. |
| templateVersion | number | No | — | Version of the template that was applied. |
| isDeleted | boolean | — | false | Soft-delete flag |
| deletedAt | date | — | — | Set on soft delete |
| createdBy | ObjectId | — | JWT user | ref: User |
| organizationId | ObjectId | — | JWT org | Multi-tenant scoping |

### 1.2 Budget

| Field | Type | Default | Notes |
|---|---|---|---|
| budget.amount | number | 0 | Total budget |
| budget.currency | string | USD | ISO 4217 code |
| budget.billingType | enum | fixed | `fixed`, `time_and_material`, `retainer`, `internal` |
| budget.hourlyRate | number | — | Required when billingType = time_and_material |
| budget.retainerAmount | number | — | Monthly retainer amount |
| budget.spent | number | 0 | Running total. Updated via API or timesheet sync. |

**Budget Health Colors:**
- Green: spent < 70% of amount
- Amber: spent between 70-90% of amount
- Red: spent > 90% of amount

### 1.3 Project Settings

| Field | Type | Default | Notes |
|---|---|---|---|
| settings.boardType | enum | kanban | `scrum`, `kanban`, `custom` |
| settings.sprintDuration | number | 14 | Days per sprint (1-90). Only relevant for scrum. |
| settings.estimationUnit | enum | hours | `hours`, `story_points` |
| settings.defaultView | enum | board | `board`, `list`, `timeline`, `calendar` |
| settings.enableTimeTracking | boolean | true | |
| settings.enableSubtasks | boolean | true | |
| settings.enableEpics | boolean | false | |
| settings.enableSprints | boolean | false | Auto-set to true when boardType = scrum |
| settings.enableReleases | boolean | false | |
| settings.clientPortalEnabled | boolean | false | |

### 1.4 Team Members

```javascript
team: [{
  userId:               ObjectId,   // ref: User — required
  role:                 String,     // enum: 'admin', 'manager', 'member', 'viewer'
  projectRole:          String,     // e.g., 'Frontend Developer', 'QA Lead', 'Scrum Master'
  allocationPercentage: Number,     // 0-100, default 100, 5% increments in UI
  assignedAt:           Date,       // default: now
  skills:               [String]    // tags for matching, e.g., ['react', 'node', 'aws']
}]
```

- Duplicate userId prevented (409 Conflict)
- Add/remove logged as activity
- Team members auto-assigned from template team definitions

**Project-Level Roles & Permissions:**

| Permission | admin | manager | member | viewer |
|---|---|---|---|---|
| Edit project settings | Yes | Yes | No | No |
| Manage team | Yes | Yes | No | No |
| Create / edit boards | Yes | Yes | Yes | No |
| Create / edit tasks | Yes | Yes | Yes | No |
| Move tasks on board | Yes | Yes | Yes | No |
| Manage sprints | Yes | Yes | No | No |
| Manage automations | Yes | Yes | No | No |
| Delete project | Yes | No | No | No |
| View everything | Yes | Yes | Yes | Yes |

### 1.5 Milestones

```javascript
milestones: [{
  _id:            ObjectId,    // auto-generated
  name:           String,      // required, max 120 chars
  description:    String,      // max 500 chars
  targetDate:     Date,        // required
  completedDate:  Date,        // set on completion
  status:         String,      // enum: 'pending', 'in_progress', 'completed', 'missed'
  phase:          String,      // e.g., 'Discovery', 'Development', 'Testing', 'Launch'
  deliverables:   [String],    // what is delivered at this milestone
  dependencies:   [ObjectId],  // other milestone _ids that must complete before this one
  ownerId:        ObjectId,    // ref: User — person responsible
  linkedTaskIds:  [ObjectId],  // tasks associated with this milestone
  order:          Number       // display order
}]
```

- Status changes logged as activity
- Overdue milestones deduct from health score
- Auto-created from templates with calculated dates (startDate + offsetDays)

### 1.6 Risks

```javascript
risks: [{
  _id:          ObjectId,
  description:  String,       // required, max 500 chars
  probability:  String,       // enum: 'low', 'medium', 'high'
  impact:       String,       // enum: 'low', 'medium', 'high'
  mitigation:   String,       // mitigation plan
  ownerId:      ObjectId,     // ref: User
  status:       String,       // enum: 'open', 'mitigated', 'occurred', 'closed'
  category:     String,       // 'technical', 'resource', 'schedule', 'budget', 'scope', 'external'
  createdAt:    Date
}]
```

### 1.7 Labels

Project-scoped labels that tasks reference by key.

```javascript
labels: [{
  name:  String,   // e.g., "Bug", "Feature"
  key:   String,   // auto-slug: "bug", "feature"
  color: String    // hex color
}]
```

### 1.8 Activity Log

```javascript
activities: [{
  action:      String,    // 'created', 'updated', 'status_changed', 'member_added',
                          // 'member_removed', 'milestone_updated', 'risk_added',
                          // 'template_applied', 'archived', 'duplicated'
  description: String,    // human-readable, e.g., "Varun changed status from planning to active"
  userId:      ObjectId,  // who performed the action
  metadata:    Mixed,     // action-specific data (e.g., { from: 'planning', to: 'active' })
  createdAt:   Date
}]
```

Max 50 entries. Auto-trims oldest when limit reached.

### 1.9 Project Status Flow

```
               +---- on_hold <----+
               |                   |
planning --- active --- completed
    |                       ^
    +--- cancelled ---------+ (admin override)
```

**Transition Rules:**

| From | To | Condition |
|---|---|---|
| planning | active | At least 1 team member assigned. Sets actualStartDate. |
| planning | cancelled | No condition. Logs cancellation reason. |
| active | on_hold | Logs reason as activity. |
| active | completed | All milestones must be completed or marked as missed. Sets actualEndDate. |
| on_hold | active | No condition. Logs resume activity. |
| on_hold | cancelled | No condition. |
| cancelled | planning | Admin override only. Resets progress. |

### 1.10 Health Score Engine

Starts at 100. Deductions are cumulative, final score clamped to 0-100.

| Factor | Max Deduction | Trigger |
|---|---|---|
| **Milestone Health** | -35 | |
| Overdue milestones | -30 | Percentage of overdue/total milestones |
| Missed milestones | -5 each | Status = missed (uncapped) |
| **Budget Health** | -25 | |
| Over budget | -25 | spent/budget > 1.0 |
| Near budget | -15 | spent/budget > 0.9 |
| High burn rate | -5 | spent/budget > 0.75 |
| **Schedule Health** | -30 | |
| Project overdue | -20 | endDate < now, status != completed |
| Behind schedule | -10 | Time > 50% elapsed but progress < half of time progress |
| **Risk Health** | -15 | |
| High-risk items | -5 each (max -15) | Open + high impact or high probability |
| **Blocked Tasks** | -5 | |
| Too many blocked | -5 | > 20% of tasks are blocked |

**Health Score Display:**

| Score Range | Color | Label |
|---|---|---|
| 80-100 | Green (#22C55E) | Healthy |
| 60-79 | Yellow (#F59E0B) | At Risk |
| 40-59 | Orange (#F97316) | Needs Attention |
| 0-39 | Red (#EF4444) | Critical |

Recalculated on: milestone update, budget update, task status change, risk change, and via daily cron job.

### 1.11 Dashboard Aggregation

`GET /projects/:id/dashboard` returns:

```json
{
  "project": { /* full project object */ },
  "milestones": {
    "total": 7, "completed": 2, "inProgress": 1, "pending": 3,
    "missed": 0, "overdue": 1, "completionRate": 28.6,
    "nextMilestone": {
      "name": "Sprint 2 Complete", "targetDate": "2026-04-29",
      "daysRemaining": 4,
      "owner": { "name": "Rahul Kumar", "projectRole": "Sr. Frontend Developer" }
    }
  },
  "budget": {
    "total": 45000, "spent": 12500, "remaining": 32500,
    "currency": "USD", "utilizationRate": 27.8,
    "burnRate": 3125, "projectedTotal": 50000, "healthColor": "green"
  },
  "tasks": {
    "total": 42,
    "byStatus": { "backlog": 12, "todo": 8, "in_progress": 10, "in_review": 5, "blocked": 2, "done": 5 },
    "overdue": 3, "completedThisWeek": 4, "averageCycleTime": 3.2
  },
  "risks": { "total": 5, "open": 3, "mitigated": 1, "occurred": 0, "closed": 1, "highImpactOpen": 2 },
  "team": {
    "size": 6, "unassignedSlots": 2,
    "topContributors": [{ "name": "Rahul Kumar", "tasksCompleted": 8, "hoursLogged": 62 }]
  },
  "sprint": { "current": { "name": "Sprint 2", "progress": 45, "daysRemaining": 6 }, "velocity": [12, 15, 13] },
  "activities": [ /* last 10 */ ],
  "healthScore": 78,
  "progressPercentage": 22
}
```

### 1.12 Special Operations

- **Duplicate Project** (`POST /projects/:id/duplicate`): Copies description, category, client, priority, department, budget (resets spent to 0), team (all members), milestones (resets to pending, recalculates dates from today), settings, tags, labels, risks (resets to open). Resets: status -> planning, healthScore -> 100, progressPercentage -> 0, projectKey -> new, activities -> empty.
- **Archive Project** (`PUT /projects/:id/archive`): Sets status=completed, actualEndDate=now. Board and tasks remain accessible in read-only mode.
- **Soft Delete** (`DELETE /projects/:id`): Sets isDeleted=true, deletedAt=now. Recoverable by super admin within 30 days.
- **Save as Template** (`POST /templates/from-project/:id`): Extracts project structure into a reusable template — settings, labels, team -> team slots, milestones -> milestoneDefs with offsetDays, risks, board columns, tasks (capped at 100). Saved as tier=personal, status=draft.

### 1.13 AI Integration

- AI Prompt Panel on project list and detail pages
- Generate milestones from project description
- Milestones auto-created with calculated target dates

---

## 2. Project Templates (12 Templates)

### 2.1 Template System Overview

When a template is applied, the system creates the complete project in a single atomic MongoDB transaction:

1. **Project Created** — Name, description, category, priority, budget, settings, projectKey auto-generated
2. **Team Structure Created** — Team role slots defined; users assigned to matching slots; unassigned slots shown as "Needs Assignment"
3. **Milestones Auto-Created** — Each date = startDate + offsetDays; descriptions, deliverables, phase labels, dependencies set
4. **Labels Created** — Project-scoped label set based on template category
5. **Default Board Created** — Columns, WIP limits, swimlane config from template
6. **Starter Tasks Created** — Backlog items, checklists, subtasks (if template includes them)
7. **Risks Pre-Populated** — Common risks for the project type
8. **Activity Log Entry** — "Project created from template: [name] v[version]"
9. **Template Usage Counter Incremented**

### 2.2 Template Variables

Every template defines variables the user fills in before applying. Interpolated using `{{variableName}}` syntax.

**Standard Variables (all templates):**

| Variable | Label | Type | Required | Default |
|---|---|---|---|---|
| `projectName` | Project Name | text | Yes | — |
| `clientName` | Client Name | text | No | — |
| `startDate` | Start Date | date | Yes | today |
| `projectLead` | Project Lead | user | Yes | — |
| `team` | Team Members | user-multi | No | [] |
| `budget` | Estimated Budget | number | No | 0 |
| `currency` | Currency | select | No | USD |

Templates can define additional variables specific to their type (e.g., `sprintDuration`, `targetPlatform`, `cloudProvider`).

### 2.3 Team Slot System

Templates define **team slots** — required project roles with recommended allocation and skills.

```javascript
teamSlots: [{
  projectRole:     String,     // "Frontend Developer", "QA Lead"
  role:            String,     // platform role: 'admin', 'manager', 'member', 'viewer'
  count:           Number,     // how many people needed (e.g., 3 developers)
  allocation:      Number,     // default allocation %
  requiredSkills:  [String],   // ['react', 'typescript']
  isRequired:      Boolean,    // must be filled before project can go active
  description:     String      // "Responsible for all UI components"
}]
```

- Template wizard shows team slots as a form section
- User can assign existing org members to each slot
- Unassigned required slots show as warnings on project dashboard
- Skill tags help with auto-suggestion (system suggests members whose skills match)

### 2.4 Milestone Auto-Generation

Milestones defined in templates with `offsetDays` relative to startDate:

```javascript
milestoneDefs: [{
  name:         String,
  description:  String,
  phase:        String,          // 'Discovery', 'Development', 'QA', 'Launch'
  offsetDays:   Number,          // days from startDate
  deliverables: [String],
  ownerRole:    String,          // maps to a teamSlot projectRole
  dependencies: [Number],        // indexes of dependent milestones
  order:        Number
}]
```

**Date Calculation:** `milestone.targetDate = project.startDate + milestone.offsetDays`

### 2.5 Template Definitions

---

#### Template 1: Scrum Software Project

> Full agile setup with sprint planning, backlog grooming, and velocity tracking.

| Property | Value |
|---|---|
| Category | web_app |
| Board | Scrum |
| Sprint Duration | 14 days (configurable: 7/14/21/28) |
| Estimation | Story Points |
| Billing | Time & Material |

**Team Slots (8):** Scrum Master (50%), Product Owner (50%), Sr. Frontend Dev (100%), Sr. Backend Dev (100%), Frontend Dev (100%), Backend Dev (100%), QA Engineer (100%), DevOps Engineer (50%)

**Milestones (7):** Project Kickoff (day 0) -> Sprint 1 Foundation (day 14) -> Sprint 2 Core Features (day 28) -> Sprint 3 Advanced Features (day 42) -> QA & Regression (day 52) -> UAT & Client Review (day 60) -> Production Deployment (day 68)

**Pre-Created Risks (3):** Scope creep (high/high), Key developer unavailability (med/high), Third-party API delays (med/med)

**Labels:** Bug, Feature, Improvement, Tech Debt, Documentation, Urgent, Quick Win

**Board Columns:** To Do -> In Development (WIP 4) -> Code Review (WIP 2) -> QA Testing (WIP 2) -> Done

---

#### Template 2: Kanban Web Application

> Continuous-flow development with WIP limits and cycle time optimization.

| Property | Value |
|---|---|
| Category | web_app |
| Board | Kanban |
| Estimation | Hours |
| Billing | Time & Material |

**Team Slots (7):** Tech Lead (100%), UI/UX Designer (100%), Frontend Dev x2 (100%), Backend Dev (100%), QA Engineer (100%), DevOps Engineer (50%)

**Milestones (6):** Discovery & Wireframes (day 10) -> Design Handoff (day 21) -> Core Development (day 50) -> Feature Complete (day 70) -> QA Sign-Off (day 82) -> Launch & Monitoring (day 90)

**Pre-Created Risks (3):** Design iterations exceeding timeline (med/med), Browser compatibility (med/med), Mobile performance degradation (low/high)

**Labels:** Bug, Feature, Improvement, UI/UX, Performance, Accessibility, SEO

**Board Columns:** Backlog -> In Progress (WIP 4) -> In Review (WIP 3) -> Done -> Archived

---

#### Template 3: Mobile App (Cross-Platform)

> Cross-platform mobile app with platform-specific milestones and app store submission tracking.

| Property | Value |
|---|---|
| Category | mobile_app |
| Board | Scrum (14-day sprints) |
| Estimation | Story Points |
| Billing | Fixed |
| Priority | High |

**Extra Variables:** `targetPlatforms` (iOS/Android/Both), `framework` (React Native/Flutter)

**Team Slots (9):** Project Manager (50%), Mobile Lead (100%), Mobile Dev x2 (100%), Backend Dev (100%), UI/UX Designer (100%), QA Engineer - Mobile (100%), DevOps/Release Eng (50%)

**Milestones (8):** Discovery & Architecture (day 7) -> UI/UX Design (day 21) -> Core Navigation & Auth (day 35) -> Feature Complete (day 56) -> API Integration (day 63) -> QA & Device Testing (day 77) -> Beta Release - TestFlight/Internal Track (day 84) -> App Store Submission & Launch (day 91)

**Pre-Created Risks (4):** App store rejection (med/high), Performance on older devices (med/med), Platform-specific bugs diverging timelines (high/med), Push notification delivery failures (low/med)

**Labels:** Bug, Feature, iOS-Only, Android-Only, Performance, Crash, UI/UX, App Store

---

#### Template 4: REST API / Microservices

> Backend API development with emphasis on documentation, testing, and deployment pipeline.

| Property | Value |
|---|---|
| Category | api_development |
| Board | Kanban |
| Estimation | Hours |
| Billing | Time & Material |

**Team Slots (6):** Backend Lead (100%), Backend Dev x2 (100%), QA/API Tester (100%), DevOps Engineer (75%), Technical Writer (50%)

**Milestones (6):** API Design & Contract (day 7) -> Database & Infrastructure (day 14) -> Core Endpoints (day 35) -> Integration & Advanced (day 49) -> Testing & Performance (day 60) -> Production Deploy & Monitoring (day 68)

**Pre-Created Risks (3):** Breaking API changes (med/high), Database performance bottlenecks (med/high), Security vulnerabilities in auth (low/critical)

**Labels:** Bug, Feature, Performance, Security, Documentation, Breaking Change, Deprecation

---

#### Template 5: Cloud Migration

> Structured migration with assessment, pilot, migration, and validation phases.

| Property | Value |
|---|---|
| Category | cloud_migration |
| Board | Kanban |
| Estimation | Hours |
| Billing | Time & Material |
| Priority | High |

**Team Slots (7):** Cloud Architect (100%), Migration Lead (100%), DevOps Engineer x2 (100%), Database Engineer (100%), Security Engineer (75%), QA/Validation Eng (100%)

**Milestones (7):** Assessment & Inventory (day 10) -> Architecture & Strategy (day 21) -> Pilot Migration (day 35) -> Database Migration (day 49) -> Full Workload Migration (day 70) -> Security & Compliance Audit (day 80) -> Decommission & Handover (day 90)

**Pre-Created Risks (4):** Data loss during migration (low/critical), Unexpected cloud costs (high/med), Extended downtime during cutover (med/high), Compliance gaps (med/high)

**Labels:** Infrastructure, Security, Data, Networking, Monitoring, Cost, Compliance

---

#### Template 6: DevOps & CI/CD Setup

> Complete DevOps infrastructure — CI/CD pipelines, monitoring, alerting, IaC.

| Property | Value |
|---|---|
| Category | devops |
| Board | Kanban |
| Estimation | Hours |
| Billing | Time & Material |

**Team Slots (4):** DevOps Lead (100%), DevOps Engineer (100%), SRE/Monitoring Eng (75%), Security Engineer (50%)

**Milestones (5):** Audit & Planning (day 7) -> CI/CD Pipeline (day 21) -> Infrastructure as Code (day 35) -> Monitoring & Alerting (day 45) -> Documentation & Handover (day 55)

**Labels:** CI/CD, Infrastructure, Monitoring, Security, Automation, Documentation, Incident

---

#### Template 7: E-Commerce Platform

> Full e-commerce build with product catalog, cart, payments, and order management.

| Property | Value |
|---|---|
| Category | ecommerce |
| Board | Scrum (14-day sprints) |
| Estimation | Story Points |
| Billing | Fixed |
| Priority | High |

**Team Slots (10):** Project Manager (75%), Tech Lead (100%), UI/UX Designer (100%), Frontend Dev x2 (100%), Backend Dev x2 (100%), QA Engineer (100%), DevOps Engineer (50%)

**Milestones (8):** Discovery & UX Research (day 10) -> Design System & Key Pages (day 24) -> Product Catalog & Search (day 42) -> Cart, Checkout & Payments (day 56) -> User Accounts & Order Mgmt (day 70) -> QA & Payment Testing (day 84) -> Soft Launch Beta (day 95) -> Full Launch & Marketing (day 105)

**Pre-Created Risks (3):** Payment integration failures at scale (med/critical), Inventory sync issues (med/high), SEO ranking drop post-launch (med/med)

**Labels:** Bug, Feature, Payment, Catalog, Cart, Checkout, SEO, Performance, UX

---

#### Template 8: Staff Augmentation

> Resource management for dedicated teams and staff augmentation engagements.

| Property | Value |
|---|---|
| Category | staff_augmentation |
| Board | Kanban |
| Estimation | Hours |
| Billing | Retainer |

**Team Slots (4):** Delivery Manager (50%), HR Coordinator (50%), Technical Interviewer (25%), Team Lead - Augmented (100%)

**Milestones (6):** Requirement Gathering (day 3) -> Candidate Sourcing (day 10) -> Technical Assessment (day 17) -> Client Interviews & Selection (day 24) -> Onboarding & Ramp-Up (day 35) -> Steady State & First Review (day 65)

**Labels:** Urgent, On Track, At Risk, Interview Scheduled, Offer Sent, Onboarding, Active

---

#### Template 9: MVP / Rapid Prototype

> Fast-paced MVP with 7-day sprints, user validation loops, and lean principles.

| Property | Value |
|---|---|
| Category | web_app |
| Board | Scrum (7-day sprints) |
| Estimation | Story Points |
| Billing | Fixed |
| Priority | High |

**Team Slots (5):** Product Lead (100%), Full-Stack Dev x2 (100%), UI Designer (75%), QA Tester (50%)

**Milestones (6):** Problem Validation (day 3) -> Design Sprint (day 7) -> Sprint 1 Core Loop (day 14) -> Sprint 2 Supporting Features (day 21) -> User Testing & Iteration (day 28) -> Demo-Ready MVP (day 35)

**Labels:** Must-Have, Nice-to-Have, Validated, Invalidated, Pivot, User Feedback, Blocked

---

#### Template 10: Data & Analytics Platform

> Data pipeline and analytics dashboard with ETL, warehouse, and visualization layers.

| Property | Value |
|---|---|
| Category | data_analytics |
| Board | Kanban |
| Estimation | Hours |
| Billing | Time & Material |

**Team Slots (6):** Data Architect (100%), Data Engineer x2 (100%), BI/Visualization Dev (100%), Backend Dev (75%), QA/Data Validator (50%)

**Milestones (6):** Data Audit & Requirements (day 10) -> Data Model & Pipeline Design (day 21) -> ETL Pipelines Built (day 42) -> Dashboard & Reports (day 56) -> Data Validation & QA (day 65) -> Go-Live & Training (day 75)

**Labels:** Pipeline, Dashboard, Data Quality, Schema, ETL, KPI, Bug, Enhancement

---

#### Template 11: Consulting / Strategy Engagement

> Client consulting with discovery, analysis, recommendations, and implementation phases.

| Property | Value |
|---|---|
| Category | consulting |
| Board | Kanban |
| Estimation | Hours |
| Billing | Time & Material |

**Team Slots (4):** Engagement Lead (75%), Business Analyst (100%), Solutions Architect (75%), Researcher/Analyst (100%)

**Milestones (5):** Discovery & Stakeholder Interviews (day 10) -> Analysis & Benchmarking (day 25) -> Recommendations Presentation (day 38) -> Roadmap & Implementation Plan (day 48) -> Client Handover & Closeout (day 56)

**Labels:** Research, Analysis, Deliverable, Client Review, Internal Review, Blocked, Follow-Up

---

#### Template 12: Bug Bash / QA Sprint

> Focused quality assurance — bug triage, regression testing, and fix validation cycles.

| Property | Value |
|---|---|
| Category | web_app |
| Board | Kanban |
| Estimation | Hours |
| Billing | Internal |
| Priority | High |

**Team Slots (6):** QA Lead (100%), QA Engineer x2 (100%), Automation Tester (100%), Developer - Fix x2 (100%)

**Milestones (5):** Test Plan & Environment (day 2) -> Exploratory & Regression Testing (day 7) -> Bug Triage & Prioritization (day 9) -> Fix & Verify Cycle (day 16) -> Sign-Off & Report (day 19)

**Labels:** Critical, High, Medium, Low, Regression, Fixed, Verified, Won't Fix, Cannot Reproduce

---

## 3. Template Application Engine

### 3.1 Frontend Wizard (4 Steps)

**Step 1 — Choose Template**: Grid of 12 template cards with icons and ratings. Option to start blank.

**Step 2 — Project Details**: Project name, client name, start date, budget, currency, template-specific variables (e.g., sprint duration, target platform).

**Step 3 — Assign Team**: Template team slots shown as a form. User assigns org members to each slot. Required slots marked with star. Skill tags shown. Unassigned roles can be filled later.

**Step 4 — Review & Create**: Full preview showing project key, template name, date range, budget, team (filled/unfilled slots), milestones timeline, risks count, board columns, labels. "Create Project" button.

### 3.2 Template Engine (Backend)

- Single atomic MongoDB transaction for entire creation
- Variable interpolation via `{{variableName}}` syntax (recursive walk)
- User overrides applied on top of template defaults
- `projectKey` auto-generated: 2-5 char uppercase from name, uniqueness checked per org
- Milestone dates calculated: `startDate + offsetDays`
- Milestone at offsetDays=0 auto-set to `in_progress`
- Project endDate auto-set to last milestone's targetDate if not specified
- Template usage counter incremented on each apply

---

## 4. Boards

### 4.1 Board Templates (4 Built-In)

| Template | Columns | WIP Limits |
|---|---|---|
| **Scrum** | Backlog, Sprint Backlog, In Progress, In Review, Testing, Done | 0, 0, 5, 3, 3, 0 |
| **Kanban** | To Do, In Progress, In Review, Done, Archived | 0, 5, 3, 0, 0 |
| **Bug Tracker** | New, Triaged, In Progress, Fixed, Verified, Closed | 0, 0, 5, 0, 0, 0 |
| **Custom** | To Do, Doing, Done | 0, 0, 0 |

Additional frontend template cards: Design Sprint, Marketing Pipeline, DevOps Pipeline, Support Desk.

### 4.2 Board Properties

| Field | Type | Default |
|---|---|---|
| name | string (required) | — |
| projectId | string (required) | — |
| organizationId | string | JWT org |
| type | enum | — (scrum, kanban, bug_tracker, custom) |
| swimlaneBy | enum | none (none, assignee, priority, type) |
| isDefault | boolean | false |
| isDeleted | boolean | false |
| createdBy | string | JWT user |

### 4.3 Column Management

**Column Properties:**

| Field | Type | Notes |
|---|---|---|
| id | UUID | Auto-generated |
| name | string | Display name |
| order | number | 0-indexed position |
| wipLimit | number | 0 = unlimited |
| statusMapping | string[] | Task statuses mapped to this column |
| color | hex string | Visual header color |

**10 Predefined Column Colors:**
`#94A3B8`, `#3B82F6`, `#F59E0B`, `#8B5CF6`, `#10B981`, `#EF4444`, `#EC4899`, `#06B6D4`, `#F97316`, `#6366F1`

**Operations:**
- Add column (with optional `afterColumnId` for positioning)
- Update column (name, WIP limit, color, statusMapping)
- Delete column (cannot delete last column; tasks moved to first available column)
- Reorder columns (pass array of columnIds in new order)

### 4.4 Drag & Drop

- Native HTML5 drag/drop implementation
- Visual feedback: dashed border highlight on drop zone
- Task status auto-updated based on target column's `statusMapping[0]`
- WIP limit enforced before move (drop fails with toast notification if at limit)
- Backend validation via `POST /boards/:id/tasks/move`

### 4.5 Task Cards on Board

Each card displays:
- Task type indicator (colored dot)
- Priority indicator (5-dot scale)
- Title (clickable to open detail drawer)
- Progress bar (teal gradient)
- Due date (formatted as "Mon DD", red if overdue)
- Assignee initials avatar
- Story points badge (if set)

### 4.6 Task Detail Drawer

Right-hand side panel showing:
- Task title with progress bar
- Properties grid: type, priority, status, assignee, due date, story points, estimated hours
- Full description
- Labels/tags
- Comments section with reply capability
- Parent task (clickable)
- Child/subtasks hierarchy
- Attachment UI (prepared)

### 4.7 Column Header

- Column name
- WIP limit indicator (e.g., "3/5")
- Three-dot menu: Rename, Set WIP Limit, Change Color, Delete

---

## 5. Tasks

### 5.1 Task Properties

| Field | Type | Required | Default |
|---|---|---|---|
| title | string | Yes | — |
| projectId | string | Yes | — |
| description | string | No | — |
| type | enum | No | task |
| status | enum | No | backlog |
| priority | enum | No | medium |
| assigneeId | string | No | — |
| reporterId | string | — | JWT user |
| parentTaskId | string | No | — (for subtasks) |
| dueDate | date | No | — |
| storyPoints | number | No | — |
| estimatedHours | number | No | — |
| loggedHours | number | — | 0 (auto-incremented) |
| labels | string[] | No | [] |
| boardId | string | No | — |
| columnId | string | No | — |
| sprintId | string | No | — |
| organizationId | string | — | JWT org |
| isDeleted | boolean | — | false |
| createdBy | string | — | JWT user |

**Task Types (7):** `epic`, `story`, `task`, `sub_task`, `bug`, `improvement`, `spike`

**Task Statuses (7):** `backlog`, `todo`, `in_progress`, `in_review`, `blocked`, `done`, `cancelled`

**Priority Levels (5):** `critical`, `high`, `medium`, `low`, `trivial`

### 5.2 Task Filtering

| Filter | Type | Notes |
|---|---|---|
| projectId | string | Filter by project |
| assigneeId | string | Filter by assignee |
| status | enum | Single status value |
| priority | enum | Single priority value |
| type | enum | Single type value |
| search | string | Full-text on title, description, labels |
| page | number | Default: 1 |
| limit | number | Default: 20, max: 100 |
| sort | string | Default: `-createdAt`, prefix `-` for desc |

### 5.3 Comments

- `POST /tasks/:id/comments` with `{ content }` body
- Stored as array subdocument on task
- Fields: userId, content, createdAt
- Immutable (no edit/delete)
- Comment count displayed on task cards

### 5.4 Time Tracking

- `POST /tasks/:id/time-entries` with `{ hours, description, date }`
- Hours: 0.1 - 24 range
- Each entry appended to `timeEntries` array
- `loggedHours` auto-incremented
- Frontend display: `loggedHours / estimatedHours` (e.g., "2.5h / 8h")
- Used by timesheet auto-population

### 5.5 Task Statistics

`GET /tasks/stats?projectId=xyz` returns:
- `total` — Total task count
- `byStatus` — Object with counts per status
- `overdue` — Count of tasks past due date and not done

**Frontend stat cards:** Total Tasks, In Progress, In Review, Overdue

### 5.6 Color Coding

**Type Colors:**

| Type | Color |
|---|---|
| task | Blue |
| bug | Red |
| story | Violet |
| epic | Indigo |
| improvement | Cyan |

**Priority Colors:**

| Priority | Color |
|---|---|
| critical | Red |
| high | Orange |
| medium | Blue |
| low | Gray |
| trivial | Light Gray |

**Status Colors:**

| Status | Color |
|---|---|
| backlog | Gray |
| todo | Slate |
| in_progress | Blue |
| in_review | Purple |
| blocked | Red |
| done | Emerald |
| cancelled | Red |

---

## 7. Timesheets

### 7.1 Timesheet Properties

| Field | Type | Required | Default |
|---|---|---|---|
| employeeId | string | — | JWT user |
| period | enum | Yes | — (daily, weekly, monthly) |
| startDate | date | Yes | — |
| endDate | date | Yes | — |
| entries | array | No | [] |
| totalHours | number | — | Sum of entries |
| expectedHours | number | — | From policy |
| status | enum | — | draft |
| submittedAt | date | — | — |
| reviewedBy | string | — | — |
| reviewedAt | date | — | — |
| reviewComment | string | — | — |
| organizationId | string | — | JWT org |

### 7.2 Timesheet Entry Fields

| Field | Type | Required |
|---|---|---|
| date | date | Yes |
| taskId | string | No |
| projectId | string | No |
| projectName | string | No |
| taskTitle | string | No |
| hours | number (0-24) | Yes |
| description | string | No |
| category | enum | No |

**Categories (9):** `development`, `design`, `meeting`, `review`, `testing`, `documentation`, `admin`, `training`, `other`

### 7.3 Timesheet Workflow

```
draft → submitted → approved (final)
                  → rejected → draft (re-editable)
                  → revision_requested → draft (re-editable)
```

- **Draft**: User can edit entries and delete timesheet
- **Submitted**: Locked for review, cannot edit
- **Approved**: Final state, immutable
- **Rejected**: Reverts to draft for user to fix
- **Revision Requested**: User can edit and resubmit

### 7.4 Auto-Population

`POST /timesheets/auto-populate` with `{ startDate, endDate }`:

1. Pulls all task `timeEntries` matching user + date range
2. Pulls attendance clock-in/clock-out data from attendance-service
3. Creates timesheet entries from both sources
4. Attendance entries categorized as `admin` with title "Clock-in / Clock-out"

### 7.5 Expected Hours Calculation

Based on active work policy's `maxWorkingHoursPerWeek`:
- **Daily**: maxHours / 5
- **Weekly**: maxHours
- **Monthly**: maxHours × 4.33

### 7.6 Admin Review

- `PUT /timesheets/:id/review` with `{ status, reviewComment }`
- Admin can approve, reject, or request revision
- Admin can only review, not create timesheets
- `GET /timesheets/pending` lists all submitted timesheets awaiting review

---

## 6. Sprints

### 6.1 Sprint Properties

| Field | Type | Required | Default |
|---|---|---|---|
| name | string | Yes | — |
| boardId | string | Yes | — |
| projectId | string | Yes | — |
| goal | string | No | — |
| startDate | date | No | — |
| endDate | date | No | — |
| status | enum | — | planning |
| taskIds | string[] | — | [] |
| velocity | number | — | 0 (calculated on completion) |
| organizationId | string | — | JWT org |
| createdBy | string | — | JWT user |

**Sprint Statuses:** `planning`, `active`, `completed`

### 6.2 Sprint Workflow

1. Create sprint in `planning` status
2. Add tasks to sprint (`POST /sprints/:id/tasks`)
3. Start sprint (`POST /sprints/:id/start`) → status becomes `active`
   - Only one active sprint per board at a time
4. Complete sprint (`POST /sprints/:id/complete`)
   - Calculates velocity from completed tasks' story points
   - Incomplete tasks moved to backlog or next planning sprint
   - Status becomes `completed`

### 6.3 Sprint UI

- Active sprint header: sprint name, dates, progress
- "Start Sprint" button (only when status = planning)
- "Complete Sprint" button (only when status = active)
- "New Sprint" button for creating additional sprints
- Create modal: name, goal, start/end dates
- Completion modal: confirmation with incomplete task handling options

---

## 8. API Endpoints Summary

### Projects (`/api/v1/projects`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/projects` | Create project |
| GET | `/projects` | List projects (paginated, filtered) |
| GET | `/projects/my` | Get user's projects |
| GET | `/projects/stats` | Project statistics |
| GET | `/projects/:id` | Get single project |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Soft-delete project |
| POST | `/projects/:id/team` | Add team member |
| PUT | `/projects/:id/team/:userId` | Update member role/allocation |
| DELETE | `/projects/:id/team/:userId` | Remove team member |
| POST | `/projects/:id/milestones` | Add milestone |
| PUT | `/projects/:id/milestones/:msId` | Update milestone |
| DELETE | `/projects/:id/milestones/:msId` | Delete milestone |
| POST | `/projects/:id/risks` | Add risk |
| PUT | `/projects/:id/risks/:riskId` | Update risk |
| DELETE | `/projects/:id/risks/:riskId` | Remove risk |
| GET | `/projects/:id/activities` | Get activity log |
| GET | `/projects/:id/dashboard` | Aggregated dashboard |
| POST | `/projects/:id/duplicate` | Duplicate project |
| PUT | `/projects/:id/archive` | Archive project |
| PUT | `/projects/:id/budget` | Update budget spent |
| POST | `/templates/from-project/:id` | Save project as template |

### Templates (`/api/v1/templates`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/templates?templateType=project` | List project templates |
| GET | `/templates/:id` | Get template detail |
| POST | `/templates/:id/apply` | Apply template (creates project) |
| POST | `/templates/:id/preview` | Preview what will be created |

### Query Parameters for GET /projects

| Param | Type | Example |
|---|---|---|
| status | enum | `?status=active` |
| priority | enum | `?priority=high` |
| category | enum | `?category=web_app` |
| search | string | `?search=ecommerce` (full-text) |
| clientId | ObjectId | `?clientId=abc123` |
| departmentId | ObjectId | `?departmentId=xyz` |
| createdBy | ObjectId | `?createdBy=user1` |
| startDateFrom | date | `?startDateFrom=2026-01-01` |
| startDateTo | date | `?startDateTo=2026-06-30` |
| healthScoreMin | number | `?healthScoreMin=60` |
| sort | string | `?sort=-createdAt` (prefix `-` = desc) |
| page | number | `?page=1` (default: 1) |
| limit | number | `?limit=20` (default: 20, max: 100) |

### Boards (`/api/v1/boards`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/boards` | Create board |
| GET | `/boards/templates` | Get board templates |
| POST | `/boards/from-template` | Create from template |
| GET | `/boards/project/:projectId` | Get boards by project |
| GET | `/boards/:id` | Get board detail |
| PUT | `/boards/:id` | Update board |
| DELETE | `/boards/:id` | Delete board |
| POST | `/boards/:id/columns` | Add column |
| PUT | `/boards/:id/columns/reorder` | Reorder columns |
| PUT | `/boards/:id/columns/:columnId` | Update column |
| DELETE | `/boards/:id/columns/:columnId` | Delete column |
| POST | `/boards/:id/tasks/move` | Move task between columns |

### Tasks (`/api/v1/tasks`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/tasks` | Create task |
| GET | `/tasks` | List tasks (paginated, filtered) |
| GET | `/tasks/my` | Get user's assigned tasks |
| GET | `/tasks/stats` | Task statistics |
| GET | `/tasks/:id` | Get single task |
| PUT | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Soft-delete task |
| PUT | `/tasks/:id/status` | Update task status |
| POST | `/tasks/:id/comments` | Add comment |
| POST | `/tasks/:id/time-entries` | Log time entry |

### Sprints (`/api/v1/sprints`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sprints` | Create sprint |
| GET | `/sprints/board/:boardId` | Get sprints by board |
| GET | `/sprints/board/:boardId/active` | Get active sprint |
| GET | `/sprints/:id` | Get sprint detail |
| PUT | `/sprints/:id` | Update sprint |
| POST | `/sprints/:id/start` | Start sprint |
| POST | `/sprints/:id/complete` | Complete sprint |
| POST | `/sprints/:id/tasks` | Add tasks to sprint |
| DELETE | `/sprints/:id/tasks/:taskId` | Remove task from sprint |

### Timesheets (`/api/v1/timesheets`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/timesheets` | Create timesheet |
| GET | `/timesheets` | List all timesheets (admin) |
| GET | `/timesheets/my` | Get user's timesheets |
| GET | `/timesheets/pending` | Get pending review timesheets |
| GET | `/timesheets/stats` | Timesheet statistics |
| GET | `/timesheets/:id` | Get single timesheet |
| PUT | `/timesheets/:id` | Update timesheet |
| DELETE | `/timesheets/:id` | Delete timesheet (draft/revision only) |
| POST | `/timesheets/:id/submit` | Submit for review |
| PUT | `/timesheets/:id/review` | Admin review (approve/reject) |
| POST | `/timesheets/auto-populate` | Auto-populate from tasks & attendance |

---

## 9. Database Schemas

### Project Collection (`projects`)

**Indexes:**
- Text: `projectName`, `description`, `tags`
- Compound: `{ isDeleted: 1, status: 1 }`
- Single: `team.userId`, `createdBy`, `departmentId`, `priority`, `category`, `clientId`, `organizationId`

### Task Collection (`tasks`)

**Indexes:**
- Compound: `projectId + status`, `assigneeId + status`, `boardId + columnId`
- Single: `dueDate`, `isDeleted`
- Text: `title`, `description`, `labels`

### Board Collection (`boards`)

**Indexes:**
- Single: `name`, `projectId`, `organizationId`

### Sprint Collection (`sprints`)

**Indexes:**
- Single: `name`, `boardId`, `projectId`

### Timesheet Collection (`timesheets`)

**Indexes:**
- Compound: `employeeId + startDate + endDate`
- Single: `status`, `isDeleted`

---

## 10. Frontend Pages & Components

| Route | Page | Key Features |
|---|---|---|
| `/projects` | Project List | Stats cards, search, filter (status/priority/category), grid/list views, sorting, template picker, create modal, AI milestone generation |
| `/projects/[id]` | Project Detail | 6 tabs: Overview, Tasks, Team, Risks, Timesheets, Activity. Header actions: Edit, Duplicate, Archive, AI Assistant |
| `/boards` | Board View | Project selector, board list, Kanban columns, drag & drop, task cards, column management, sprint controls, task detail drawer, create from template |
| `/tasks` | Task List | Stats cards (total/in-progress/in-review/overdue), status & priority filters, task cards with type/priority/status badges, assignee avatars, due dates, time tracking display |
| `/timesheets` | Timesheet Management | Auto-populate, manual entry, submit/review workflow, period selection, project filter, status filter, admin review (approve/reject) |

---

## 11. Permissions & Access

- All entities scoped by `organizationId` from JWT
- All endpoints protected by `JwtAuthGuard`
- Projects filterable by team membership (`/projects/my`)
- Tasks filterable by assignee (`/tasks/my`)
- Timesheet review restricted to admin/HR roles
- Admin can review but not create timesheets
- Soft deletes throughout (isDeleted flag, filtered in list queries)
- Audit trail via `createdBy`/`updatedBy` fields

---

## 12. Not Yet Implemented

- Swimlane visualization (backend structure exists, UI not built)
- Advanced board filters (priority, assignee, type on board view)
- Board sharing & permissions
- Velocity charts & sprint reports/burndown
- Custom fields on tasks
- Bulk task operations
- Board template customization UI
- Webhook integrations for boards
