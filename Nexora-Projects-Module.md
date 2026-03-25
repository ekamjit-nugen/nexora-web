# Nexora — Projects Module: Complete Feature Specification

> **Version:** 2.0  
> **Platform:** Nexora by Nugen IT Services  
> **Stack:** React.js · Node.js · MongoDB · Tailwind CSS · AWS  
> **Last Updated:** March 2026

---

## Table of Contents

1. [Project Data Model](#1-project-data-model)
2. [Project Templates — Overview](#2-project-templates--overview)
3. [Template Definitions (12 Templates)](#3-template-definitions-12-templates)
4. [Template Application Engine](#4-template-application-engine)
5. [Project Workflow & Status Management](#5-project-workflow--status-management)
6. [Health Score Engine](#6-health-score-engine)
7. [Project Dashboard & Analytics](#7-project-dashboard--analytics)
8. [Project Operations](#8-project-operations)
9. [API Endpoints](#9-api-endpoints)
10. [Database Schema & Indexes](#10-database-schema--indexes)
11. [Frontend Pages & Components](#11-frontend-pages--components)

---

## 1. Project Data Model

### 1.1 Core Fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| projectName | string | Yes | — | Max 150 chars. Text-indexed for search. |
| projectKey | string | Auto | — | Auto-generated unique 2-5 char uppercase key derived from project name (e.g., "WEB", "MOB", "ECMR"). Used as prefix for all task IDs in this project: WEB-001, WEB-002, etc. |
| description | string | No | — | Supports markdown. Text-indexed for search. Max 5000 chars. |
| category | enum | No | other | `web_app`, `mobile_app`, `api_development`, `cloud_migration`, `devops`, `staff_augmentation`, `consulting`, `ecommerce`, `data_analytics`, `other` |
| status | enum | No | planning | `planning`, `active`, `on_hold`, `completed`, `cancelled` |
| priority | enum | No | medium | `critical`, `high`, `medium`, `low` |
| startDate | date | No | — | Expected start |
| endDate | date | No | — | Expected end |
| actualStartDate | date | No | — | Set when project status changes to `active` |
| actualEndDate | date | No | — | Set on archive or completion |
| departmentId | ObjectId | No | — | ref: Department |
| clientId | ObjectId | No | — | ref: Client |
| tags | string[] | No | [] | Max 20 tags. Text-indexed. |
| healthScore | number | — | 100 | Auto-calculated (0-100). See Section 6. |
| progressPercentage | number | — | 0 | Auto-calculated: (done tasks / total tasks) × 100 |
| templateRef | ObjectId | No | — | ref: Template. Which template created this project. |
| templateVersion | number | No | — | Version of the template that was applied. |
| isDeleted | boolean | — | false | Soft-delete flag |
| deletedAt | date | — | — | Set on soft delete |
| createdBy | ObjectId | — | JWT user | ref: User |
| organizationId | ObjectId | — | JWT org | Multi-tenant scoping |
| createdAt | date | — | auto | Mongoose timestamp |
| updatedAt | date | — | auto | Mongoose timestamp |

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
- 🟢 Green: spent < 70% of amount
- 🟡 Amber: spent between 70-90% of amount
- 🔴 Red: spent > 90% of amount

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
- Team members auto-assigned from template team definitions (see Section 4)

**Project-Level Roles & Permissions:**

| Permission | admin | manager | member | viewer |
|---|---|---|---|---|
| Edit project settings | ✓ | ✓ | ✗ | ✗ |
| Manage team | ✓ | ✓ | ✗ | ✗ |
| Create / edit boards | ✓ | ✓ | ✓ | ✗ |
| Create / edit tasks | ✓ | ✓ | ✓ | ✗ |
| Move tasks on board | ✓ | ✓ | ✓ | ✗ |
| Manage sprints | ✓ | ✓ | ✗ | ✗ |
| Manage automations | ✓ | ✓ | ✗ | ✗ |
| Delete project | ✓ | ✗ | ✗ | ✗ |
| View everything | ✓ | ✓ | ✓ | ✓ |

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

- Milestone status changes logged as activity
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

---

## 2. Project Templates — Overview

### 2.1 What Happens When a Template is Applied

When a user selects a template and fills in the required variables, the system creates the complete project in a single atomic MongoDB transaction:

```
Template Applied
│
├── 1. Project Created
│       → Name, description, category, priority, budget, settings
│       → projectKey auto-generated
│
├── 2. Team Structure Created
│       → Team role slots defined with projectRole and required skills
│       → If user selects team members during setup, they are assigned to matching slots
│       → Unassigned slots shown as "Needs Assignment" on project dashboard
│
├── 3. Milestones Auto-Created
│       → Each milestone date = project startDate + offsetDays
│       → Descriptions, deliverables, phase labels, and dependencies all set
│       → Linked to team role owners (e.g., milestone owner = "QA Lead")
│
├── 4. Labels Created
│       → Project-scoped label set based on template category
│
├── 5. Default Board Created
│       → Columns, WIP limits, swimlane config from template
│
├── 6. Starter Tasks Created (if template includes them)
│       → Backlog items, checklists, subtasks
│
├── 7. Risks Pre-Populated (if template includes them)
│       → Common risks for the project type
│
├── 8. Activity Log Entry
│       → "Project created from template: Scrum Software Project v1"
│
└── 9. Template Usage Counter Incremented
```

### 2.2 Template Variables

Every template defines a set of variables that the user fills in before applying. These are interpolated into the project using `{{variableName}}` syntax.

**Standard Variables (available in all templates):**

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

Templates define **team slots** — required project roles with recommended allocation and skills. During project creation, the user maps real team members to these slots.

```javascript
teamSlots: [{
  projectRole:     String,     // "Frontend Developer", "QA Lead"
  role:            String,     // platform role: 'admin', 'manager', 'member', 'viewer'
  count:           Number,     // how many people needed in this role (e.g., 3 developers)
  allocation:      Number,     // default allocation % (e.g., 100)
  requiredSkills:  [String],   // ['react', 'typescript']
  isRequired:      Boolean,    // must be filled before project can go active
  description:     String      // "Responsible for all UI components and client-side logic"
}]
```

**UI Behavior:**
- Template wizard shows team slots as a form section
- User can assign existing org members to each slot
- Unassigned required slots show as warnings on the project dashboard
- Skill tags help with auto-suggestion (system suggests members whose skill tags match)

### 2.4 Milestone Auto-Generation

Milestones are defined in templates with `offsetDays` relative to the project's `startDate`. The engine calculates concrete dates at creation time.

```javascript
milestoneDefs: [{
  name:         String,
  description:  String,
  phase:        String,          // 'Discovery', 'Development', 'QA', 'Launch'
  offsetDays:   Number,          // days from startDate
  deliverables: [String],
  ownerRole:    String,          // maps to a teamSlot projectRole
  dependencies: [Number],        // indexes of milestones this depends on
  order:        Number
}]
```

**Date Calculation:**
```
milestone.targetDate = project.startDate + milestone.offsetDays (business days or calendar days based on org settings)
```

If `startDate` is April 1, 2026 and `offsetDays` is 14, then `targetDate` = April 15, 2026.

---

## 3. Template Definitions (12 Templates)

---

### Template 1: Scrum Software Project

> Full agile setup for software teams following Scrum with sprint planning, backlog grooming, and velocity tracking.

**Quick Config:**

| Property | Value |
|---|---|
| Category | web_app |
| Board Type | Scrum |
| Sprint Duration | 14 days (configurable: 7/14/21/28) |
| Estimation | Story Points |
| Billing | Time & Material |
| Priority | Medium |

**Template Variables:**

| Variable | Type | Required | Default |
|---|---|---|---|
| projectName | text | Yes | — |
| projectLead | user | Yes | — |
| startDate | date | Yes | today |
| sprintDuration | select (7/14/21/28 days) | No | 14 |
| team | user-multi | No | [] |
| budget | number | No | 0 |
| repoUrl | url | No | — |

**Team Slots (8 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Scrum Master | manager | 1 | 50% | agile, scrum, jira | Yes |
| 2 | Product Owner | manager | 1 | 50% | product-management, stakeholder-mgmt | Yes |
| 3 | Sr. Frontend Developer | member | 1 | 100% | react, typescript, tailwind | Yes |
| 4 | Sr. Backend Developer | member | 1 | 100% | node, mongodb, rest-api | Yes |
| 5 | Frontend Developer | member | 1 | 100% | react, javascript, css | No |
| 6 | Backend Developer | member | 1 | 100% | node, express, mongodb | No |
| 7 | QA Engineer | member | 1 | 100% | testing, automation, selenium | Yes |
| 8 | DevOps Engineer | member | 1 | 50% | aws, docker, ci-cd | No |

**Auto-Created Milestones (7):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dependencies |
|---|---|---|---|---|---|---|
| 1 | Project Kickoff & Setup | Discovery | 0 | Repository created, CI/CD configured, development environment ready, team onboarded | Scrum Master | — |
| 2 | Sprint 1 Complete — Foundation | Development | 14 | Auth module, database schema, API scaffolding, frontend skeleton | Sr. Backend Developer | #1 |
| 3 | Sprint 2 Complete — Core Features | Development | 28 | Core CRUD operations, primary UI screens, API integration | Sr. Frontend Developer | #2 |
| 4 | Sprint 3 Complete — Advanced Features | Development | 42 | Search, filtering, notifications, role-based access | Sr. Backend Developer | #3 |
| 5 | QA & Regression Testing | Testing | 52 | All test cases executed, bug fixes completed, performance benchmarks met | QA Engineer | #4 |
| 6 | UAT & Client Review | Testing | 60 | Client sign-off, feedback incorporated, final polish | Product Owner | #5 |
| 7 | Production Deployment & Handover | Launch | 68 | Production deployment, monitoring configured, documentation delivered, team handover | DevOps Engineer | #6 |

**Pre-Created Risks (3):**

| Risk | Probability | Impact | Mitigation | Category |
|---|---|---|---|---|
| Scope creep from unclear requirements | high | high | Define and freeze scope in Sprint 0. Change requests go through Product Owner approval. | scope |
| Key developer unavailability mid-sprint | medium | high | Cross-train team members. Maintain updated documentation for all modules. | resource |
| Third-party API integration delays | medium | medium | Build mock services for development. Have fallback plan for each external dependency. | technical |

**Labels:** Bug, Feature, Improvement, Tech Debt, Documentation, Urgent, Quick Win

**Default Board — Sprint Board (5 columns):**

| Column | Status Mapping | WIP Limit | Color |
|---|---|---|---|
| To Do | todo | 0 | #64748B |
| In Development | in_progress | 4 | #F59E0B |
| Code Review | in_review | 2 | #8B5CF6 |
| QA Testing | in_review | 2 | #F97316 |
| Done | done | 0 | #22C55E |

---

### Template 2: Kanban Web Application

> Continuous-flow development for web applications using Kanban methodology with WIP limits and cycle time optimization.

**Quick Config:**

| Property | Value |
|---|---|
| Category | web_app |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Time & Material |
| Priority | Medium |

**Template Variables:**

| Variable | Type | Required | Default |
|---|---|---|---|
| projectName | text | Yes | — |
| projectLead | user | Yes | — |
| startDate | date | Yes | today |
| team | user-multi | No | [] |
| budget | number | No | 0 |
| targetLaunchDate | date | No | startDate + 90 |

**Team Slots (7 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Tech Lead | manager | 1 | 100% | architecture, react, node, leadership | Yes |
| 2 | UI/UX Designer | member | 1 | 100% | figma, ux-research, prototyping | Yes |
| 3 | Frontend Developer | member | 2 | 100% | react, next-js, tailwind, typescript | Yes |
| 4 | Backend Developer | member | 1 | 100% | node, express, mongodb, rest-api | Yes |
| 5 | QA Engineer | member | 1 | 100% | manual-testing, automation, cypress | Yes |
| 6 | DevOps Engineer | member | 1 | 50% | aws, docker, nginx, ci-cd | No |

**Auto-Created Milestones (6):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Discovery & Wireframes | Discovery | 10 | User research findings, information architecture, wireframes for all key pages, design system tokens | UI/UX Designer | — |
| 2 | Design Handoff | Design | 21 | High-fidelity mockups, interactive prototype, responsive breakpoints, asset export | UI/UX Designer | #1 |
| 3 | Core Development Complete | Development | 50 | All primary pages functional, API endpoints built, database populated, basic auth working | Tech Lead | #2 |
| 4 | Feature Complete | Development | 70 | All features implemented, third-party integrations done, admin panel ready | Tech Lead | #3 |
| 5 | QA Sign-Off | Testing | 82 | All critical/high bugs fixed, cross-browser tested (Chrome, Firefox, Safari, Edge), performance audit passed (Lighthouse > 90), accessibility audit passed (WCAG 2.1 AA) | QA Engineer | #4 |
| 6 | Launch & Monitoring | Launch | 90 | Production deployed, SSL configured, CDN enabled, uptime monitoring active, error tracking (Sentry) configured, client walkthrough completed | DevOps Engineer | #5 |

**Pre-Created Risks (3):**

| Risk | Probability | Impact | Mitigation | Category |
|---|---|---|---|---|
| Design iterations exceeding timeline | medium | medium | Limit design revisions to 2 rounds per page. Parallel dev on approved sections. | schedule |
| Browser compatibility issues | medium | medium | Define browser matrix upfront. Test weekly across all targets. | technical |
| Performance degradation on mobile | low | high | Mobile-first development. Lighthouse audits every sprint. Performance budget defined in Sprint 0. | technical |

**Labels:** Bug, Feature, Improvement, UI/UX, Performance, Accessibility, SEO

**Default Board (5 columns):**

| Column | Status Mapping | WIP Limit | Color |
|---|---|---|---|
| Backlog | backlog | 0 | #94A3B8 |
| In Progress | in_progress | 4 | #3B82F6 |
| In Review | in_review | 3 | #8B5CF6 |
| Done | done | 0 | #22C55E |
| Archived | done | 0 | #64748B |

---

### Template 3: Mobile App (Cross-Platform)

> Cross-platform mobile application development with platform-specific milestones and app store submission tracking.

**Quick Config:**

| Property | Value |
|---|---|
| Category | mobile_app |
| Board Type | Scrum |
| Sprint Duration | 14 days |
| Estimation | Story Points |
| Billing | Fixed |
| Priority | High |

**Template Variables:**

| Variable | Type | Required | Default |
|---|---|---|---|
| projectName | text | Yes | — |
| projectLead | user | Yes | — |
| startDate | date | Yes | today |
| targetPlatforms | multi-select (iOS, Android, Both) | Yes | Both |
| framework | select (React Native, Flutter) | No | React Native |
| team | user-multi | No | [] |
| budget | number | No | 0 |

**Team Slots (9 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Project Manager | manager | 1 | 50% | mobile-projects, agile, client-communication | Yes |
| 2 | Mobile Lead | manager | 1 | 100% | react-native, ios, android, architecture | Yes |
| 3 | Mobile Developer | member | 2 | 100% | react-native, javascript, typescript | Yes |
| 4 | Backend Developer | member | 1 | 100% | node, rest-api, mongodb, push-notifications | Yes |
| 5 | UI/UX Designer | member | 1 | 100% | mobile-ui, figma, ios-hig, material-design | Yes |
| 6 | QA Engineer (Mobile) | member | 1 | 100% | mobile-testing, appium, device-farm | Yes |
| 7 | DevOps / Release Eng. | member | 1 | 50% | fastlane, code-signing, ci-cd, app-store | No |

**Auto-Created Milestones (8):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Discovery & Architecture | Discovery | 7 | App architecture doc, navigation flow diagram, API contract, tech stack finalized, dev environment setup (simulators + physical devices) | Mobile Lead | — |
| 2 | UI/UX Design Complete | Design | 21 | All screen designs (iOS + Android variants), interaction specs, micro-animation specs, icon set, splash screen, app icon | UI/UX Designer | #1 |
| 3 | Core Navigation & Auth | Development | 35 | App shell, navigation structure, login/signup, social auth, push notification setup, deep linking | Mobile Lead | #2 |
| 4 | Feature Complete | Development | 56 | All screens implemented, offline mode (if applicable), camera/GPS/sensor integration, state management | Mobile Developer | #3 |
| 5 | API Integration Complete | Development | 63 | All endpoints connected, error handling, retry logic, caching layer, optimistic updates | Backend Developer | #4 |
| 6 | QA & Device Testing | Testing | 77 | Tested on 10+ device matrix (various screen sizes, OS versions), crash-free rate > 99.5%, memory/battery profiling passed | QA Engineer (Mobile) | #5 |
| 7 | Beta Release (TestFlight / Internal Track) | Pre-Launch | 84 | Beta build distributed, stakeholder feedback collected, critical fixes applied, analytics SDK verified | DevOps / Release Eng. | #6 |
| 8 | App Store Submission & Launch | Launch | 91 | App Store / Play Store submission, store listing assets (screenshots, description, keywords), release notes, monitoring dashboard live | Project Manager | #7 |

**Pre-Created Risks (4):**

| Risk | Probability | Impact | Mitigation | Category |
|---|---|---|---|---|
| App store rejection | medium | high | Follow Apple/Google guidelines strictly. Submit early for review. Have contingency timeline. | external |
| Performance issues on older devices | medium | medium | Define min OS version. Test on low-end devices weekly. Set performance budgets. | technical |
| Platform-specific bugs diverging timelines | high | medium | Shared codebase priority. Platform-specific code isolated in clearly marked modules. | technical |
| Push notification delivery failures | low | medium | Implement fallback (in-app inbox). Test across carriers and network conditions. | technical |

**Labels:** Bug, Feature, iOS-Only, Android-Only, Performance, Crash, UI/UX, App Store

---

### Template 4: REST API / Microservices

> Backend API development with emphasis on documentation, testing, and deployment pipeline.

**Quick Config:**

| Property | Value |
|---|---|
| Category | api_development |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Time & Material |
| Priority | Medium |

**Team Slots (6 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Backend Lead | manager | 1 | 100% | node, system-design, rest-api, graphql | Yes |
| 2 | Backend Developer | member | 2 | 100% | node, express, mongodb, redis | Yes |
| 3 | QA / API Tester | member | 1 | 100% | postman, api-testing, performance-testing | Yes |
| 4 | DevOps Engineer | member | 1 | 75% | docker, kubernetes, aws, ci-cd | Yes |
| 5 | Technical Writer | member | 1 | 50% | api-docs, swagger, technical-writing | No |

**Auto-Created Milestones (6):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | API Design & Contract | Discovery | 7 | OpenAPI/Swagger spec finalized, endpoint list, request/response schemas, auth strategy (JWT/OAuth/API keys), rate limiting policy, error code catalog | Backend Lead | — |
| 2 | Database & Infrastructure | Setup | 14 | MongoDB schemas with indexes, Redis cache setup, Docker compose for local dev, staging environment provisioned, CI pipeline (lint + test) | DevOps Engineer | #1 |
| 3 | Core Endpoints Complete | Development | 35 | All CRUD endpoints, authentication middleware, input validation (Joi/Zod), error handling, pagination, sorting, filtering | Backend Lead | #2 |
| 4 | Integration & Advanced | Development | 49 | Webhooks, background jobs (Bull/Agenda), file upload (S3), email/SMS integration, search (text index / Elasticsearch), WebSocket events | Backend Developer | #3 |
| 5 | Testing & Performance | Testing | 60 | Unit tests (>80% coverage), integration tests, load testing (k6/Artillery — 1000 req/s target), security audit (OWASP top 10), API documentation complete on Swagger UI | QA / API Tester | #4 |
| 6 | Production Deploy & Monitoring | Launch | 68 | Production deployment, health check endpoints, logging (Winston/Pino → CloudWatch), APM (New Relic/Datadog), alerting rules, runbook documented | DevOps Engineer | #5 |

**Pre-Created Risks (3):**

| Risk | Probability | Impact | Mitigation | Category |
|---|---|---|---|---|
| Breaking API changes affecting consumers | medium | high | Version all endpoints (v1/v2). Deprecation policy with 30-day notice. Contract testing. | technical |
| Database performance bottlenecks | medium | high | Index planning upfront. Query profiling in staging. Read replicas for heavy queries. | technical |
| Security vulnerabilities in auth layer | low | critical | Follow OWASP guidelines. Regular dependency audits (npm audit). Penetration testing before launch. | technical |

**Labels:** Bug, Feature, Performance, Security, Documentation, Breaking Change, Deprecation

---

### Template 5: Cloud Migration

> Structured cloud migration project with assessment, pilot, migration, and validation phases.

**Quick Config:**

| Property | Value |
|---|---|
| Category | cloud_migration |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Time & Material |
| Priority | High |

**Team Slots (7 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Cloud Architect | manager | 1 | 100% | aws, azure, cloud-architecture, networking | Yes |
| 2 | Migration Lead | manager | 1 | 100% | cloud-migration, infra-as-code, terraform | Yes |
| 3 | DevOps Engineer | member | 2 | 100% | docker, kubernetes, ci-cd, monitoring | Yes |
| 4 | Database Engineer | member | 1 | 100% | database-migration, dms, replication | Yes |
| 5 | Security Engineer | member | 1 | 75% | cloud-security, iam, compliance, encryption | Yes |
| 6 | QA / Validation Eng. | member | 1 | 100% | performance-testing, smoke-testing, validation | No |

**Auto-Created Milestones (7):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Assessment & Inventory | Discovery | 10 | Full infrastructure inventory, application dependency map, data classification, cost projection (on-prem vs cloud), migration readiness score | Cloud Architect | — |
| 2 | Architecture & Strategy | Planning | 21 | Target cloud architecture diagram, migration strategy per workload (rehost/replatform/refactor), network topology, security baseline, IaC templates | Cloud Architect | #1 |
| 3 | Pilot Migration (1-2 workloads) | Migration | 35 | Pilot applications migrated, performance baseline vs on-prem, rollback tested successfully, monitoring configured | Migration Lead | #2 |
| 4 | Database Migration | Migration | 49 | All databases migrated with zero data loss, replication verified, connection strings updated, backup strategy configured | Database Engineer | #3 |
| 5 | Full Workload Migration | Migration | 70 | All applications migrated, DNS cutover plan executed, load balancer configured, SSL certificates transferred | DevOps Engineer | #4 |
| 6 | Security & Compliance Audit | Validation | 80 | IAM policies reviewed, encryption at rest/transit verified, compliance checks passed (SOC2/GDPR if applicable), penetration test passed | Security Engineer | #5 |
| 7 | Decommission & Handover | Closure | 90 | On-prem hardware decommissioned (or planned), cost optimization review, team training on cloud operations, runbooks and DR plan documented | Cloud Architect | #6 |

**Pre-Created Risks (4):**

| Risk | Probability | Impact | Mitigation | Category |
|---|---|---|---|---|
| Data loss during migration | low | critical | Full backups before every migration batch. Test restores. DMS with CDC for zero-downtime migration. | technical |
| Unexpected cloud costs | high | medium | Set billing alerts. Right-size instances. Use reserved/spot instances where possible. Weekly cost reviews. | budget |
| Extended downtime during cutover | medium | high | Blue-green deployment for cutover. Practice cutover in staging. Define maximum acceptable downtime window. | schedule |
| Compliance gaps in cloud environment | medium | high | Engage security team from day 1. Continuous compliance scanning (AWS Config / Azure Policy). | external |

**Labels:** Infrastructure, Security, Data, Networking, Monitoring, Cost, Compliance

---

### Template 6: DevOps & CI/CD Setup

> Setting up complete DevOps infrastructure — CI/CD pipelines, monitoring, alerting, and infrastructure as code.

**Quick Config:**

| Property | Value |
|---|---|
| Category | devops |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Time & Material |
| Priority | Medium |

**Team Slots (4 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | DevOps Lead | manager | 1 | 100% | aws, terraform, docker, kubernetes, ci-cd | Yes |
| 2 | DevOps Engineer | member | 1 | 100% | docker, github-actions, jenkins, ansible | Yes |
| 3 | SRE / Monitoring Eng. | member | 1 | 75% | prometheus, grafana, elk, alerting | Yes |
| 4 | Security Engineer | member | 1 | 50% | devsecops, vault, scanning, compliance | No |

**Auto-Created Milestones (5):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Audit & Planning | Discovery | 7 | Current infra audit, tool selection matrix, architecture proposal, cost estimate, timeline | DevOps Lead | — |
| 2 | CI/CD Pipeline | Setup | 21 | Build pipeline (lint → test → build → artifact), deploy pipeline (staging → production), branch protection, automated testing gates, Docker registry configured | DevOps Engineer | #1 |
| 3 | Infrastructure as Code | Setup | 35 | Terraform/Pulumi modules for all environments, VPC/networking, auto-scaling groups, secrets management (Vault/SSM), environment parity (dev = staging ≈ prod) | DevOps Lead | #2 |
| 4 | Monitoring & Alerting | Operations | 45 | Prometheus + Grafana dashboards (CPU, memory, latency, error rate, custom metrics), ELK stack for logs, PagerDuty/Slack alerting, SLA dashboard | SRE / Monitoring Eng. | #3 |
| 5 | Documentation & Handover | Closure | 55 | Runbooks for all services, disaster recovery plan, on-call rotation setup, team training sessions (2+), architecture decision records | DevOps Lead | #4 |

**Labels:** CI/CD, Infrastructure, Monitoring, Security, Automation, Documentation, Incident

---

### Template 7: E-Commerce Platform

> Full e-commerce build with product catalog, cart, payments, and order management.

**Quick Config:**

| Property | Value |
|---|---|
| Category | ecommerce |
| Board Type | Scrum |
| Sprint Duration | 14 days |
| Estimation | Story Points |
| Billing | Fixed |
| Priority | High |

**Team Slots (10 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Project Manager | manager | 1 | 75% | ecommerce, agile, client-communication | Yes |
| 2 | Tech Lead | manager | 1 | 100% | full-stack, payments, system-design | Yes |
| 3 | UI/UX Designer | member | 1 | 100% | ecommerce-ux, figma, conversion-optimization | Yes |
| 4 | Frontend Developer | member | 2 | 100% | react, next-js, tailwind, seo | Yes |
| 5 | Backend Developer | member | 2 | 100% | node, mongodb, stripe, order-management | Yes |
| 6 | QA Engineer | member | 1 | 100% | ecommerce-testing, payment-testing, selenium | Yes |
| 7 | DevOps Engineer | member | 1 | 50% | aws, cdn, scaling, ci-cd | No |

**Auto-Created Milestones (8):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Discovery & UX Research | Discovery | 10 | Competitor analysis, user personas, purchase flow wireframes, sitemap, SEO keyword research | UI/UX Designer | — |
| 2 | Design System & Key Pages | Design | 24 | Homepage, PLP, PDP, cart, checkout designs, mobile responsive variants, component library | UI/UX Designer | #1 |
| 3 | Product Catalog & Search | Development | 42 | Product CRUD, categories, attributes, image management, search (full-text + filters), inventory tracking | Backend Developer | #2 |
| 4 | Cart, Checkout & Payments | Development | 56 | Shopping cart (persistent), multi-step checkout, Stripe/Razorpay integration, order creation, email confirmations | Tech Lead | #3 |
| 5 | User Accounts & Order Mgmt | Development | 70 | Registration, login, order history, wishlists, address book, admin order management panel | Frontend Developer | #4 |
| 6 | QA & Payment Testing | Testing | 84 | Full regression, payment gateway sandbox testing (success, failure, refund), load testing (500 concurrent users), security audit (PCI compliance check) | QA Engineer | #5 |
| 7 | Soft Launch (Beta) | Pre-Launch | 95 | Limited traffic launch, real payment processing verified, analytics configured (GA4, heatmaps), customer support flow tested | Project Manager | #6 |
| 8 | Full Launch & Marketing | Launch | 105 | DNS switched, CDN warming, SEO verification (robots.txt, sitemap.xml, structured data), social media integration, go-live checklist completed | Project Manager | #7 |

**Pre-Created Risks (3):**

| Risk | Probability | Impact | Mitigation | Category |
|---|---|---|---|---|
| Payment integration failures at scale | medium | critical | Use well-tested SDK (Stripe). Load test payment flow. Have a manual order fallback. | technical |
| Inventory sync issues | medium | high | Real-time inventory with optimistic locking. Periodic reconciliation job. | technical |
| SEO ranking drop post-launch | medium | medium | 301 redirects for all old URLs. Pre-launch SEO audit. Google Search Console monitoring. | external |

**Labels:** Bug, Feature, Payment, Catalog, Cart, Checkout, SEO, Performance, UX

---

### Template 8: Staff Augmentation

> Resource management project for dedicated teams and staff augmentation engagements.

**Quick Config:**

| Property | Value |
|---|---|
| Category | staff_augmentation |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Retainer |
| Priority | Medium |

**Team Slots (4 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Delivery Manager | manager | 1 | 50% | account-management, staffing, client-communication | Yes |
| 2 | HR Coordinator | member | 1 | 50% | recruitment, screening, onboarding | Yes |
| 3 | Technical Interviewer | member | 1 | 25% | technical-assessment, coding-evaluation | Yes |
| 4 | Team Lead (Augmented) | member | 1 | 100% | domain-expertise, reporting, mentoring | No |

**Auto-Created Milestones (6):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Requirement Gathering | Discovery | 3 | Job descriptions finalized, required skills matrix, team size confirmed, expected start dates, reporting structure defined | Delivery Manager | — |
| 2 | Candidate Sourcing | Sourcing | 10 | Candidate shortlist (3-5 per role), resume screening complete, initial HR calls done | HR Coordinator | #1 |
| 3 | Technical Assessment | Assessment | 17 | Technical interviews completed, coding assessments scored, candidate ranking finalized, client interview slots booked | Technical Interviewer | #2 |
| 4 | Client Interviews & Selection | Selection | 24 | Client interviews done, final selections made, offer letters sent, joining dates confirmed | Delivery Manager | #3 |
| 5 | Onboarding & Ramp-Up | Onboarding | 35 | Hardware/access provisioned, client codebase access, team introductions, onboarding checklist completed, first week plan shared | HR Coordinator | #4 |
| 6 | Steady State & First Review | Active | 65 | 30-day performance review, client feedback collected, billing confirmed, any replacement needs identified | Delivery Manager | #5 |

**Labels:** Urgent, On Track, At Risk, Interview Scheduled, Offer Sent, Onboarding, Active

---

### Template 9: MVP / Rapid Prototype

> Fast-paced MVP development with 7-day sprints, user validation loops, and lean principles.

**Quick Config:**

| Property | Value |
|---|---|
| Category | web_app |
| Board Type | Scrum |
| Sprint Duration | 7 days |
| Estimation | Story Points |
| Billing | Fixed |
| Priority | High |

**Team Slots (5 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Product Lead | manager | 1 | 100% | product-thinking, lean, user-research | Yes |
| 2 | Full-Stack Developer | member | 2 | 100% | react, node, mongodb, rapid-prototyping | Yes |
| 3 | UI Designer | member | 1 | 75% | rapid-wireframing, figma, minimal-design | Yes |
| 4 | QA Tester | member | 1 | 50% | smoke-testing, exploratory-testing | No |

**Auto-Created Milestones (6):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Problem Validation | Discovery | 3 | Problem statement doc, 5+ user interviews conducted, key assumptions listed, hypothesis defined | Product Lead | — |
| 2 | Design Sprint | Design | 7 | Lo-fi wireframes for core flow, clickable prototype, 3 user tests on prototype | UI Designer | #1 |
| 3 | Sprint 1 — Core Loop | Development | 14 | Core value proposition working end-to-end, single most important user journey functional | Full-Stack Developer | #2 |
| 4 | Sprint 2 — Supporting Features | Development | 21 | Auth, 2-3 secondary features, basic admin view, error handling | Full-Stack Developer | #3 |
| 5 | User Testing & Iteration | Validation | 28 | 10+ real users tested, feedback synthesized, top 5 fixes applied, analytics (Mixpanel/Amplitude) integrated | Product Lead | #4 |
| 6 | Demo-Ready MVP | Launch | 35 | Deployed to production, demo script prepared, pitch deck updated with real product screenshots, investor/stakeholder presentation ready | Product Lead | #5 |

**Labels:** Must-Have, Nice-to-Have, Validated, Invalidated, Pivot, User Feedback, Blocked

---

### Template 10: Data & Analytics Platform

> Data pipeline and analytics dashboard development with ETL, warehouse, and visualization layers.

**Quick Config:**

| Property | Value |
|---|---|
| Category | data_analytics |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Time & Material |
| Priority | Medium |

**Team Slots (6 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Data Architect | manager | 1 | 100% | data-modeling, warehouse, etl-pipelines | Yes |
| 2 | Data Engineer | member | 2 | 100% | python, airflow, spark, sql | Yes |
| 3 | BI / Visualization Dev | member | 1 | 100% | powerbi, tableau, d3, dashboard-design | Yes |
| 4 | Backend Developer | member | 1 | 75% | node, rest-api, data-integration | No |
| 5 | QA / Data Validator | member | 1 | 50% | data-quality, sql, reconciliation | Yes |

**Auto-Created Milestones (6):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Data Audit & Requirements | Discovery | 10 | Data source inventory, current data flow mapping, KPI definitions, stakeholder interviews, data quality assessment | Data Architect | — |
| 2 | Data Model & Pipeline Design | Design | 21 | Star/snowflake schema, ETL pipeline architecture, data dictionary, source-to-target mapping, SLA for data freshness | Data Architect | #1 |
| 3 | ETL Pipelines Built | Development | 42 | All extraction jobs running, transformation logic implemented, load to warehouse verified, scheduling (Airflow DAGs), error handling and retry logic | Data Engineer | #2 |
| 4 | Dashboard & Reports | Development | 56 | Executive dashboard, operational dashboards (3-5), self-service query interface, automated report generation (PDF/email) | BI / Visualization Dev | #3 |
| 5 | Data Validation & QA | Testing | 65 | Data reconciliation (source vs warehouse), accuracy checks on all KPIs, edge case handling, data freshness SLA verified | QA / Data Validator | #4 |
| 6 | Go-Live & Training | Launch | 75 | Production data pipeline running, stakeholder training sessions (2+), documentation (data dictionary, runbooks), monitoring alerts for pipeline failures | Data Architect | #5 |

**Labels:** Pipeline, Dashboard, Data Quality, Schema, ETL, KPI, Bug, Enhancement

---

### Template 11: Consulting / Strategy Engagement

> Client consulting projects with discovery, analysis, recommendations, and implementation phases.

**Quick Config:**

| Property | Value |
|---|---|
| Category | consulting |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Time & Material |
| Priority | Medium |

**Team Slots (4 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | Engagement Lead | manager | 1 | 75% | consulting, stakeholder-management, strategy | Yes |
| 2 | Business Analyst | member | 1 | 100% | requirements, process-mapping, documentation | Yes |
| 3 | Solutions Architect | member | 1 | 75% | system-design, technology-evaluation, roadmap | Yes |
| 4 | Researcher / Analyst | member | 1 | 100% | market-research, data-analysis, benchmarking | No |

**Auto-Created Milestones (5):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Discovery & Stakeholder Interviews | Discovery | 10 | Stakeholder interview notes (5-10 interviews), current-state process maps, pain point catalog, opportunity areas identified | Business Analyst | — |
| 2 | Analysis & Benchmarking | Analysis | 25 | Competitive benchmarking report, technology landscape analysis, gap analysis (current vs desired state), data-backed insights | Researcher / Analyst | #1 |
| 3 | Recommendations Presentation | Strategy | 38 | Recommendations deck (executive summary + detailed), build vs buy analysis, technology selection matrix, ROI projections, risk assessment | Engagement Lead | #2 |
| 4 | Roadmap & Implementation Plan | Planning | 48 | Phased implementation roadmap (3/6/12 month), resource plan, budget estimate, KPI framework, governance model | Solutions Architect | #3 |
| 5 | Client Handover & Closeout | Closure | 56 | Final deliverable package, knowledge transfer sessions (2+), transition plan, engagement retrospective, follow-up proposal (if applicable) | Engagement Lead | #4 |

**Labels:** Research, Analysis, Deliverable, Client Review, Internal Review, Blocked, Follow-Up

---

### Template 12: Bug Bash / QA Sprint

> Focused quality assurance effort — bug triage, regression testing, and fix validation cycles.

**Quick Config:**

| Property | Value |
|---|---|
| Category | web_app |
| Board Type | Kanban |
| Estimation | Hours |
| Billing | Internal |
| Priority | High |

**Team Slots (6 people):**

| # | Project Role | Platform Role | Count | Allocation | Required Skills | Required |
|---|---|---|---|---|---|---|
| 1 | QA Lead | manager | 1 | 100% | test-strategy, bug-triage, regression | Yes |
| 2 | QA Engineer | member | 2 | 100% | manual-testing, exploratory-testing, test-cases | Yes |
| 3 | Automation Tester | member | 1 | 100% | cypress, selenium, api-testing, jest | No |
| 4 | Developer (Fix) | member | 2 | 100% | debugging, hotfixes, code-review | Yes |

**Auto-Created Milestones (5):**

| # | Milestone | Phase | Offset Days | Deliverables | Owner Role | Dep. |
|---|---|---|---|---|---|---|
| 1 | Test Plan & Environment | Setup | 2 | Test plan document, test case inventory, test environment configured, test data prepared, bug report template standardized | QA Lead | — |
| 2 | Exploratory & Regression Testing | Testing | 7 | Full regression executed, exploratory testing sessions (each tester 4h+), all bugs logged with severity/priority, repro steps documented | QA Engineer | #1 |
| 3 | Bug Triage & Prioritization | Triage | 9 | All bugs triaged (Critical/High/Medium/Low), fix assignments made, won't-fix list approved by stakeholders, fix timeline committed | QA Lead | #2 |
| 4 | Fix & Verify Cycle | Fixing | 16 | All critical and high bugs fixed, fix verification passed, regression on fixed areas passed, no new critical bugs introduced | Developer (Fix) | #3 |
| 5 | Sign-Off & Report | Closure | 19 | QA sign-off document, remaining known issues list (with risk assessment), test execution report (pass/fail metrics), automation coverage report | QA Lead | #4 |

**Labels:** Critical, High, Medium, Low, Regression, Fixed, Verified, Won't Fix, Cannot Reproduce

---

## 4. Template Application Engine

### 4.1 Core Service — `templateEngine.js`

```javascript
class TemplateEngine {

  /**
   * Apply a project template. Creates project + team + milestones + board + tasks
   * in a single atomic transaction.
   */
  static async applyProjectTemplate(templateId, variables, overrides, userId, orgId) {
    const template = await Template.findById(templateId);
    if (!template || template.templateType !== 'project') {
      throw new AppError('Invalid project template', 400);
    }
    if (template.status !== 'published') {
      throw new AppError('Template is not published', 400);
    }

    // Step 1: Interpolate variables into the entire payload
    const payload = this.interpolate(template.payload, variables);

    // Step 2: Apply any user overrides
    this._applyOverrides(payload, overrides);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── Step 3: Create the Project ──
      const projectKey = await this._generateProjectKey(variables.projectName, orgId);

      const [project] = await Project.create([{
        projectName:    variables.projectName,
        projectKey,
        description:    payload.description || template.description,
        category:       payload.category,
        status:         'planning',
        priority:       payload.priority || 'medium',
        startDate:      variables.startDate ? new Date(variables.startDate) : new Date(),
        endDate:        payload.endDate || null,
        clientId:       variables.clientId || null,
        organizationId: orgId,
        createdBy:      userId,
        templateRef:    templateId,
        templateVersion: template.version,
        settings:       payload.settings,
        labels:         payload.labels || [],
        budget: {
          amount:      variables.budget || 0,
          currency:    variables.currency || 'USD',
          billingType: payload.billing || 'fixed',
          hourlyRate:  payload.hourlyRate || null,
          retainerAmount: payload.retainerAmount || null,
          spent:       0,
        },
        activities: [{
          action:      'created',
          description: `Project created from template: ${template.name} v${template.version}`,
          userId,
          metadata:    { templateId, templateVersion: template.version },
          createdAt:   new Date(),
        }]
      }], { session });

      const projectId = project._id;
      const startDate = project.startDate;

      // ── Step 4: Create Team Members ──
      const teamMembers = [];
      const teamUserMap = {};  // projectRole → userId mapping

      // Map template team slots to actual users
      if (payload.teamSlots && variables.team) {
        const assignedUsers = Array.isArray(variables.team) ? variables.team : [variables.team];
        let userIndex = 0;

        for (const slot of payload.teamSlots) {
          for (let i = 0; i < slot.count; i++) {
            const userId_assigned = assignedUsers[userIndex] || null;
            if (userId_assigned) {
              teamMembers.push({
                userId:               userId_assigned,
                role:                 slot.role,
                projectRole:          slot.projectRole,
                allocationPercentage: slot.allocation || 100,
                skills:               slot.requiredSkills || [],
                assignedAt:           new Date(),
              });
              teamUserMap[slot.projectRole] = userId_assigned;
              userIndex++;
            }
          }
        }
      }

      // Always add the project lead
      if (variables.projectLead) {
        const leadExists = teamMembers.some(m => m.userId.toString() === variables.projectLead.toString());
        if (!leadExists) {
          teamMembers.push({
            userId:               variables.projectLead,
            role:                 'admin',
            projectRole:          'Project Lead',
            allocationPercentage: 100,
            assignedAt:           new Date(),
          });
        }
        teamUserMap['Project Lead'] = variables.projectLead;
      }

      if (teamMembers.length > 0) {
        await Project.findByIdAndUpdate(projectId, {
          $set: { team: teamMembers }
        }, { session });
      }

      // ── Step 5: Create Milestones ──
      const milestones = [];
      if (payload.milestoneDefs) {
        for (const mDef of payload.milestoneDefs) {
          const targetDate = new Date(startDate);
          targetDate.setDate(targetDate.getDate() + mDef.offsetDays);

          milestones.push({
            _id:           new mongoose.Types.ObjectId(),
            name:          mDef.name,
            description:   mDef.description,
            phase:         mDef.phase,
            targetDate,
            status:        mDef.offsetDays === 0 ? 'in_progress' : 'pending',
            deliverables:  mDef.deliverables || [],
            ownerId:       teamUserMap[mDef.ownerRole] || variables.projectLead || null,
            dependencies:  (mDef.dependencies || []).map(idx => milestones[idx - 1]?._id).filter(Boolean),
            order:         mDef.order,
          });
        }

        await Project.findByIdAndUpdate(projectId, {
          $set: { milestones }
        }, { session });

        // Set project endDate to last milestone's targetDate if not already set
        const lastMilestone = milestones[milestones.length - 1];
        if (lastMilestone && !project.endDate) {
          await Project.findByIdAndUpdate(projectId, {
            $set: { endDate: lastMilestone.targetDate }
          }, { session });
        }
      }

      // ── Step 6: Create Risks ──
      if (payload.risks && payload.risks.length > 0) {
        const risks = payload.risks.map(r => ({
          _id:         new mongoose.Types.ObjectId(),
          description: r.description,
          probability: r.probability,
          impact:      r.impact,
          mitigation:  r.mitigation,
          category:    r.category || 'technical',
          status:      'open',
          createdAt:   new Date(),
        }));

        await Project.findByIdAndUpdate(projectId, {
          $set: { risks }
        }, { session });
      }

      // ── Step 7: Create Default Board ──
      let boardId = null;
      if (payload.defaultBoard) {
        const boardDef = payload.defaultBoard;
        const [board] = await Board.create([{
          name:           boardDef.name || `${variables.projectName} Board`,
          projectId,
          organizationId: orgId,
          type:           payload.settings.boardType || 'kanban',
          columns:        boardDef.columns.map((col, idx) => ({
            id:            new mongoose.Types.ObjectId().toString(),
            name:          col.name,
            order:         idx,
            wipLimit:      col.wipLimit || 0,
            statusMapping: [col.statusMapping],
            color:         col.color,
          })),
          swimlaneBy:     boardDef.swimlaneBy || 'none',
          isDefault:      true,
          createdBy:      userId,
        }], { session });

        boardId = board._id;
      }

      // ── Step 8: Create Starter Tasks (if any) ──
      const tasks = [];
      if (payload.starterTasks && payload.starterTasks.length > 0) {
        for (const taskDef of payload.starterTasks) {
          const [task] = await Task.create([{
            title:          taskDef.title,
            projectId,
            description:    taskDef.description || '',
            type:           taskDef.type || 'task',
            status:         'backlog',
            priority:       taskDef.priority || 'medium',
            labels:         taskDef.labels || [],
            boardId:        boardId,
            organizationId: orgId,
            createdBy:      userId,
          }], { session });
          tasks.push(task);
        }
      }

      // ── Step 9: Increment Template Usage ──
      await Template.findByIdAndUpdate(templateId, {
        $inc:  { usageCount: 1 },
        $set:  { lastUsedAt: new Date() },
      }, { session });

      await session.commitTransaction();

      return {
        project: {
          id:         project._id,
          projectKey: project.projectKey,
          name:       project.projectName,
        },
        team:       teamMembers.length,
        milestones: milestones.length,
        risks:      (payload.risks || []).length,
        board:      boardId ? { id: boardId } : null,
        tasks:      tasks.length,
        template: {
          id:      templateId,
          name:    template.name,
          version: template.version,
        }
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Recursively interpolate {{variable}} placeholders in any object/string.
   */
  static interpolate(template, variables) {
    const clone = JSON.parse(JSON.stringify(template));
    return this._walk(clone, variables);
  }

  static _walk(obj, vars) {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const value = path.split('.').reduce((o, k) => o?.[k], vars);
        return value !== undefined ? String(value) : match;
      });
    }
    if (Array.isArray(obj)) return obj.map(item => this._walk(item, vars));
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) obj[key] = this._walk(obj[key], vars);
    }
    return obj;
  }

  static _applyOverrides(payload, overrides = {}) {
    for (const [path, value] of Object.entries(overrides)) {
      const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
      let obj = payload;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
        if (!obj) break;
      }
      if (obj) obj[keys[keys.length - 1]] = value;
    }
  }

  static async _generateProjectKey(name, orgId) {
    const words = name.replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/);
    let key;
    if (words.length >= 2) {
      key = words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
    } else {
      key = words[0].substring(0, 4).toUpperCase();
    }

    // Ensure uniqueness within org
    let candidate = key;
    let suffix = 1;
    while (await Project.exists({ projectKey: candidate, organizationId: orgId })) {
      candidate = `${key}${suffix}`;
      suffix++;
    }
    return candidate;
  }
}

module.exports = TemplateEngine;
```

### 4.2 Apply Flow — Frontend Wizard (4 Steps)

```
┌───────────────────────────────────────────────────────────────┐
│  STEP 1 / 4 — Choose Template                                │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 🚀       │  │ 🌐       │  │ 📱       │  │ 🔌       │    │
│  │ Scrum    │  │ Kanban   │  │ Mobile   │  │ REST API │    │
│  │ Software │  │ Web App  │  │ App      │  │          │    │
│  │ ★4.8     │  │ ★4.6     │  │ ★4.7     │  │ ★4.5     │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ ☁️       │  │ ⚙️       │  │ 🛒       │  │ 👥       │    │
│  │ Cloud    │  │ DevOps   │  │ E-Comm   │  │ Staff    │    │
│  │ Migration│  │ Setup    │  │ Platform │  │ Aug.     │    │
│  │ ★4.4     │  │ ★4.3     │  │ ★4.6     │  │ ★4.2     │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ ⚡       │  │ 📊       │  │ 💼       │  │ 🐛       │    │
│  │ MVP /    │  │ Data &   │  │ Consult. │  │ Bug Bash │    │
│  │ Prototype│  │ Analytics│  │ Engage.  │  │ / QA     │    │
│  │ ★4.5     │  │ ★4.3     │  │ ★4.1     │  │ ★4.4     │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                               │
│  [Blank Project — Start from scratch]                        │
│                                          [Next →]            │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  STEP 2 / 4 — Project Details                                │
│                                                               │
│  Project Name *           [_________________________]        │
│  Client Name              [_________________________]        │
│  Start Date *             [📅 April 1, 2026]                │
│  Estimated Budget         [_________] [USD ▾]                │
│                                                               │
│  Sprint Duration          ○ 1 week  ● 2 weeks               │
│                           ○ 3 weeks ○ 4 weeks               │
│                                                               │
│                          [← Back]  [Next →]                  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  STEP 3 / 4 — Assign Team                                    │
│                                                               │
│  This template needs the following roles:                     │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ★ Scrum Master (required)         [🔍 Select Person ▾]│  │
│  │   50% allocation · agile, scrum                        │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ★ Product Owner (required)        [🔍 Select Person ▾]│  │
│  │   50% allocation · product-management                  │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ★ Sr. Frontend Developer (req.)   [🔍 Select Person ▾]│  │
│  │   100% allocation · react, typescript, tailwind        │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ★ Sr. Backend Developer (req.)    [🔍 Select Person ▾]│  │
│  │   100% allocation · node, mongodb                      │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │   Frontend Developer              [🔍 Select Person ▾]│  │
│  │   100% allocation · react, javascript                  │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │   Backend Developer               [🔍 Select Person ▾]│  │
│  │   100% allocation · node, express                      │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ★ QA Engineer (required)          [🔍 Select Person ▾]│  │
│  │   100% allocation · testing, automation                │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │   DevOps Engineer                 [🔍 Select Person ▾]│  │
│  │   50% allocation · aws, docker, ci-cd                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  💡 Unassigned roles can be filled later from Project Team.   │
│                                                               │
│                          [← Back]  [Next →]                  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  STEP 4 / 4 — Review & Create                                │
│                                                               │
│  📁 E-Commerce Rewrite (Key: ECO)                            │
│  │  Template: Scrum Software Project v1                      │
│  │  Start: April 1, 2026 → Estimated End: June 7, 2026      │
│  │  Budget: $45,000 USD (Time & Material)                    │
│  │                                                            │
│  ├── 👥 Team (6 of 8 slots filled)                           │
│  │   ├── Varun Singh — Scrum Master (50%)                    │
│  │   ├── Priya Sharma — Product Owner (50%)                  │
│  │   ├── Rahul Kumar — Sr. Frontend Developer (100%)         │
│  │   ├── Amit Verma — Sr. Backend Developer (100%)           │
│  │   ├── Neha Gupta — QA Engineer (100%)                     │
│  │   └── ⚠ 3 slots unassigned (Frontend Dev, Backend Dev,   │
│  │         DevOps Eng.)                                       │
│  │                                                            │
│  ├── 🏁 Milestones (7)                                       │
│  │   ├── Apr 01 — Project Kickoff & Setup                    │
│  │   ├── Apr 15 — Sprint 1 Complete — Foundation             │
│  │   ├── Apr 29 — Sprint 2 Complete — Core Features          │
│  │   ├── May 13 — Sprint 3 Complete — Advanced Features      │
│  │   ├── May 23 — QA & Regression Testing                    │
│  │   ├── May 31 — UAT & Client Review                        │
│  │   └── Jun 07 — Production Deployment & Handover           │
│  │                                                            │
│  ├── ⚠️ Risks (3 pre-identified)                             │
│  │   ├── Scope creep (High/High)                             │
│  │   ├── Developer unavailability (Med/High)                 │
│  │   └── Third-party API delays (Med/Med)                    │
│  │                                                            │
│  ├── 📋 Sprint Board (5 columns)                             │
│  │   └── To Do → In Dev → Code Review → QA → Done           │
│  │                                                            │
│  └── 🏷 Labels (7)                                           │
│       └── Bug, Feature, Improvement, Tech Debt, Docs, ...    │
│                                                               │
│                          [← Back]  [🚀 Create Project]      │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Project Workflow & Status Management

### 5.1 Project Status Flow

```
               ┌──── on_hold ◄────┐
               │                   │
planning ─── active ─── completed
    │                       ▲
    └─── cancelled ─────────┘ (admin override)
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

### 5.2 Task Status ↔ Project Progress

`progressPercentage` is auto-calculated:

```
progressPercentage = (tasks with isDone status / total non-deleted tasks) × 100
```

Recalculated on every task status change within the project.

---

## 6. Health Score Engine

### 6.1 Scoring Algorithm

Starts at 100. Deductions are cumulative but the final score is clamped to 0-100.

```javascript
function calculateHealthScore(project) {
  let score = 100;
  const now = new Date();

  // ── Milestone Health (max -35) ──
  const milestones = project.milestones || [];
  const totalMs = milestones.length;
  if (totalMs > 0) {
    const overdue = milestones.filter(m =>
      m.status !== 'completed' && m.targetDate < now
    ).length;
    const missed = milestones.filter(m => m.status === 'missed').length;

    score -= Math.round((overdue / totalMs) * 30);  // up to -30
    score -= missed * 5;                              // -5 each, uncapped
  }

  // ── Budget Health (max -25) ──
  if (project.budget.amount > 0) {
    const utilization = project.budget.spent / project.budget.amount;
    if (utilization > 1.0)       score -= 25;
    else if (utilization > 0.9)  score -= 15;
    else if (utilization > 0.75) score -= 5;
  }

  // ── Schedule Health (max -30) ──
  if (project.endDate && project.status !== 'completed') {
    if (project.endDate < now) {
      score -= 20;  // project overdue
    } else {
      const totalDuration = project.endDate - project.startDate;
      const elapsed = now - project.startDate;
      const timeProgress = elapsed / totalDuration;
      const taskProgress = project.progressPercentage / 100;

      if (timeProgress > 0.5 && taskProgress < timeProgress * 0.5) {
        score -= 10;  // significantly behind
      }
    }
  }

  // ── Risk Health (max -15) ──
  const openHighRisks = (project.risks || []).filter(r =>
    r.status === 'open' && (r.impact === 'high' || r.probability === 'high')
  ).length;
  score -= Math.min(openHighRisks * 5, 15);

  // ── Blocked Tasks (max -5) ──
  // (Requires task stats — passed in or queried)
  // if (blockedPercentage > 0.2) score -= 5;

  return Math.max(0, Math.min(100, score));
}
```

### 6.2 Health Score Display

| Score Range | Color | Label | Icon |
|---|---|---|---|
| 80-100 | Green (#22C55E) | Healthy | ✅ |
| 60-79 | Yellow (#F59E0B) | At Risk | ⚠️ |
| 40-59 | Orange (#F97316) | Needs Attention | 🔶 |
| 0-39 | Red (#EF4444) | Critical | 🔴 |

Recalculated on: milestone update, budget update, task status change, risk change, and via daily cron job.

---

## 7. Project Dashboard & Analytics

### 7.1 Dashboard API

`GET /projects/:id/dashboard` returns:

```json
{
  "project": { /* full project object */ },

  "milestones": {
    "total": 7,
    "completed": 2,
    "inProgress": 1,
    "pending": 3,
    "missed": 0,
    "overdue": 1,
    "completionRate": 28.6,
    "nextMilestone": {
      "name": "Sprint 2 Complete — Core Features",
      "targetDate": "2026-04-29",
      "daysRemaining": 4,
      "owner": { "name": "Rahul Kumar", "projectRole": "Sr. Frontend Developer" }
    }
  },

  "budget": {
    "total": 45000,
    "spent": 12500,
    "remaining": 32500,
    "currency": "USD",
    "utilizationRate": 27.8,
    "burnRate": 3125,
    "projectedTotal": 50000,
    "healthColor": "green"
  },

  "tasks": {
    "total": 42,
    "byStatus": {
      "backlog": 12, "todo": 8, "in_progress": 10,
      "in_review": 5, "blocked": 2, "done": 5, "cancelled": 0
    },
    "overdue": 3,
    "completedThisWeek": 4,
    "averageCycleTime": 3.2
  },

  "risks": {
    "total": 5,
    "open": 3,
    "mitigated": 1,
    "occurred": 0,
    "closed": 1,
    "highImpactOpen": 2
  },

  "team": {
    "size": 6,
    "unassignedSlots": 2,
    "topContributors": [
      { "name": "Rahul Kumar", "tasksCompleted": 8, "hoursLogged": 62 }
    ]
  },

  "sprint": {
    "current": { "name": "Sprint 2", "progress": 45, "daysRemaining": 6 },
    "velocity": [12, 15, 13]
  },

  "activities": [ /* last 10 */ ],

  "healthScore": 78,
  "progressPercentage": 22
}
```

---

## 8. Project Operations

### 8.1 Duplicate Project

`POST /projects/:id/duplicate`

Copies: description, category, clientId, priority, departmentId, budget (resets spent to 0), team (all members), milestones (resets to pending, recalculates dates from today), settings, tags, labels, risks (resets to open).

Resets: status → planning, healthScore → 100, progressPercentage → 0, projectKey → new, activities → empty, actualStartDate/endDate → null.

### 8.2 Archive Project

`PUT /projects/:id/archive`

Sets status = completed, actualEndDate = now. Logs "archived" activity. Board and tasks remain accessible in read-only mode.

### 8.3 Soft Delete

`DELETE /projects/:id`

Sets isDeleted = true, deletedAt = now. Filtered from all list queries. Recoverable by super admin within 30 days.

### 8.4 Save as Template

`POST /templates/from-project/:projectId`

Extracts the entire project structure into a reusable template:

- Settings, labels, billing type
- Team structure → converted to team slots (users stripped, roles kept)
- Milestones → converted to milestoneDefs with offsetDays (calculated from startDate)
- Risks → kept as-is (descriptions, mitigation plans)
- Board → columns, WIP limits, swimlane config
- Tasks (capped at 100) → title, description, type, priority, checklists, labels (user-specific data stripped)

Saved as tier = 'personal', status = 'draft'. User can then edit, add variables, and publish.

---

## 9. API Endpoints

### Projects CRUD

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/projects` | Create project (direct or from template) |
| GET | `/api/v1/projects` | List projects (paginated, filtered) |
| GET | `/api/v1/projects/my` | Get user's projects (team membership) |
| GET | `/api/v1/projects/stats` | Aggregate project statistics |
| GET | `/api/v1/projects/:id` | Get single project |
| PUT | `/api/v1/projects/:id` | Update project |
| DELETE | `/api/v1/projects/:id` | Soft-delete project |

### Project Sub-Resources

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/projects/:id/team` | Add team member |
| DELETE | `/api/v1/projects/:id/team/:userId` | Remove team member |
| PUT | `/api/v1/projects/:id/team/:userId` | Update member role/allocation |
| POST | `/api/v1/projects/:id/milestones` | Add milestone |
| PUT | `/api/v1/projects/:id/milestones/:msId` | Update milestone |
| DELETE | `/api/v1/projects/:id/milestones/:msId` | Delete milestone |
| POST | `/api/v1/projects/:id/risks` | Add risk |
| PUT | `/api/v1/projects/:id/risks/:riskId` | Update risk |
| DELETE | `/api/v1/projects/:id/risks/:riskId` | Remove risk |
| GET | `/api/v1/projects/:id/activities` | Get activity log |
| GET | `/api/v1/projects/:id/dashboard` | Aggregated dashboard |

### Project Actions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/projects/:id/duplicate` | Duplicate project |
| PUT | `/api/v1/projects/:id/archive` | Archive (set completed) |
| PUT | `/api/v1/projects/:id/budget` | Update budget spent |
| POST | `/api/v1/templates/from-project/:id` | Save project as template |

### Template Endpoints (Project-Related)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/templates?templateType=project` | List project templates |
| GET | `/api/v1/templates/:id` | Get template detail |
| POST | `/api/v1/templates/:id/apply` | Apply template → creates project |
| POST | `/api/v1/templates/:id/preview` | Preview what will be created |

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

---

## 10. Database Schema & Indexes

### Project Collection Schema

```javascript
const ProjectSchema = new mongoose.Schema({
  projectName:      { type: String, required: true, maxlength: 150 },
  projectKey:       { type: String, required: true, uppercase: true, maxlength: 6 },
  description:      { type: String, maxlength: 5000 },
  category:         { type: String, enum: ['web_app','mobile_app','api_development','cloud_migration','devops','staff_augmentation','consulting','ecommerce','data_analytics','other'] },
  status:           { type: String, enum: ['planning','active','on_hold','completed','cancelled'], default: 'planning' },
  priority:         { type: String, enum: ['critical','high','medium','low'], default: 'medium' },
  startDate:        Date,
  endDate:          Date,
  actualStartDate:  Date,
  actualEndDate:    Date,
  departmentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  clientId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  tags:             { type: [String], default: [] },
  healthScore:      { type: Number, default: 100, min: 0, max: 100 },
  progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
  templateRef:      { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  templateVersion:  Number,

  budget: {
    amount:          { type: Number, default: 0 },
    currency:        { type: String, default: 'USD' },
    billingType:     { type: String, enum: ['fixed','time_and_material','retainer','internal'], default: 'fixed' },
    hourlyRate:      Number,
    retainerAmount:  Number,
    spent:           { type: Number, default: 0 },
  },

  settings: {
    boardType:            { type: String, enum: ['scrum','kanban','custom'], default: 'kanban' },
    sprintDuration:       { type: Number, default: 14, min: 1, max: 90 },
    estimationUnit:       { type: String, enum: ['hours','story_points'], default: 'hours' },
    defaultView:          { type: String, enum: ['board','list','timeline','calendar'], default: 'board' },
    enableTimeTracking:   { type: Boolean, default: true },
    enableSubtasks:       { type: Boolean, default: true },
    enableEpics:          { type: Boolean, default: false },
    enableSprints:        { type: Boolean, default: false },
    enableReleases:       { type: Boolean, default: false },
    clientPortalEnabled:  { type: Boolean, default: false },
  },

  team:        [TeamMemberSchema],
  milestones:  [MilestoneSchema],
  risks:       [RiskSchema],
  labels:      [LabelSchema],
  activities:  [ActivitySchema],

  isDeleted:      { type: Boolean, default: false },
  deletedAt:      Date,
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });
```

### Indexes

```javascript
// Full-text search
ProjectSchema.index({ projectName: 'text', description: 'text', tags: 'text' });

// Listing queries
ProjectSchema.index({ organizationId: 1, isDeleted: 1, status: 1 });
ProjectSchema.index({ organizationId: 1, category: 1 });

// Filtering
ProjectSchema.index({ priority: 1 });
ProjectSchema.index({ 'team.userId': 1 });
ProjectSchema.index({ clientId: 1 });
ProjectSchema.index({ departmentId: 1 });
ProjectSchema.index({ createdBy: 1 });

// Uniqueness
ProjectSchema.index({ projectKey: 1, organizationId: 1 }, { unique: true });
```

---

## 11. Frontend Pages & Components

### 11.1 Routes

| Route | Page | Key Features |
|---|---|---|
| `/projects` | Project List | Stat cards (total, active, on hold, overdue), search bar, filters (status, priority, category, client), grid/list toggle, sort dropdown, "New Project" button (opens template picker), each card shows health badge + progress bar + team avatars |
| `/projects/new` | Template Picker → 4-Step Wizard | Template grid (12 templates), variable form, team assignment, review & create |
| `/projects/:id` | Project Detail | Tabs: Overview, Tasks, Team, Milestones, Risks, Timesheets, Activity. Header: status badge, health score, progress bar, Edit/Duplicate/Archive/Save as Template buttons |
| `/projects/:id/settings` | Project Settings | General, Workflow (status editor), Labels, Integrations |

### 11.2 Component Tree

```
src/features/projects/
├── pages/
│   ├── ProjectListPage.jsx
│   ├── ProjectCreateWizard.jsx       ← 4-step template application wizard
│   ├── ProjectDetailPage.jsx
│   └── ProjectSettingsPage.jsx
│
├── components/
│   ├── list/
│   │   ├── ProjectCard.jsx           Card with health badge, progress, team avatars
│   │   ├── ProjectListTable.jsx      Table view alternative
│   │   ├── ProjectStatsBar.jsx       Stat cards: total, active, on hold, overdue
│   │   ├── ProjectFilterPanel.jsx    Status, priority, category, client filters
│   │   └── ProjectSortDropdown.jsx
│   │
│   ├── create/
│   │   ├── TemplatePicker.jsx        Grid of 12 template cards
│   │   ├── TemplateCard.jsx          Icon, name, description, rating
│   │   ├── ProjectDetailsForm.jsx    Step 2: name, dates, budget
│   │   ├── TeamAssignmentForm.jsx    Step 3: team slot → user mapping
│   │   ├── TeamSlotRow.jsx           Single slot with user picker
│   │   ├── ProjectReviewPanel.jsx    Step 4: tree view of everything
│   │   └── CreateConfirmModal.jsx
│   │
│   ├── detail/
│   │   ├── ProjectHeader.jsx         Name, key, status, health, progress
│   │   ├── ProjectOverviewTab.jsx    Dashboard summary
│   │   ├── ProjectTasksTab.jsx       Task list + stats
│   │   ├── ProjectTeamTab.jsx        Team members with roles, allocation
│   │   ├── ProjectMilestonesTab.jsx  Timeline view of milestones
│   │   ├── ProjectRisksTab.jsx       Risk register table
│   │   ├── ProjectTimesheetsTab.jsx  Linked timesheets
│   │   └── ProjectActivityTab.jsx    Activity feed
│   │
│   ├── shared/
│   │   ├── HealthScoreBadge.jsx      Color-coded health indicator
│   │   ├── BudgetUtilization.jsx     Budget bar with color coding
│   │   ├── MilestoneTimeline.jsx     Horizontal timeline visualization
│   │   ├── ProgressBar.jsx           Animated progress bar
│   │   ├── TeamAvatarStack.jsx       Overlapping avatar circles
│   │   └── ActivityFeedItem.jsx      Single activity entry
│   │
│   └── ai/
│       └── AIMilestoneGenerator.jsx  AI-powered milestone generation panel
│
├── hooks/
│   ├── useProjects.js                List/filter/paginate
│   ├── useProject.js                 Single project detail
│   ├── useProjectDashboard.js        Dashboard aggregation
│   ├── useProjectMutations.js        Create/update/delete/duplicate/archive
│   └── useTemplateApply.js           Template apply wizard state
│
└── utils/
    ├── healthScoreColors.js          Score → color/label mapping
    ├── projectKeyGenerator.js        Client-side key preview
    └── milestoneCalculator.js        Date calculations for preview
```

---

*This document serves as the single source of truth for Nexora's Projects module. It is designed for direct developer handoff — each section maps to implementation tasks with no ambiguity.*
