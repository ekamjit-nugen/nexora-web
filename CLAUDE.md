# Nexora — Claude Context File

## What is this project?

Nexora is a unified enterprise IT operations platform (monorepo) replacing 10+ SaaS tools. Built with NestJS microservices backend, Next.js 14 frontend, MongoDB, Redis. Target: IT companies, agencies, engineering orgs (20-500 employees).

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4, shadcn/ui (standard v3 — NOT base-nova/v4) |
| Backend | NestJS 10, Node.js 20, TypeScript 5 |
| Database | MongoDB 7 (Mongoose 7 ODM), Redis 7 |
| Auth | Passport.js (JWT, Google OAuth, Microsoft OAuth, SAML), bcrypt, speakeasy (TOTP MFA) |
| Infra | Docker Compose (dev), Kubernetes (prod) |
| Monitoring | Prometheus, Grafana, ELK stack |

## Monorepo Structure

```
Nexora/
├── frontend/                     # Next.js 14 app (port 3100 on host, 3000 internal)
├── services/
│   ├── auth-service/             # COMPLETE — port 3010 on host (3001 internal)
│   ├── api-gateway/              # COMPLETE — port 3005
│   ├── hr-service/               # COMPLETE — port 3020 on host (3010 internal)
│   ├── attendance-service/       # COMPLETE — port 3011 (also handles policies & alerts)
│   ├── leave-service/            # COMPLETE — port 3012
│   ├── project-service/          # COMPLETE — port 3030 on host (3020 internal)
│   ├── task-service/             # COMPLETE — port 3031 on host (3021 internal, also handles timesheets)
│   ├── payroll-service/          # SCAFFOLDED
│   ├── board-service/            # SCAFFOLDED
│   └── ... (14 more scaffolded)
├── packages/types/               # Shared TypeScript types (150+ definitions)
├── packages/shared/              # Shared utilities
├── infrastructure/
│   ├── k8s/                      # Kubernetes manifests
│   ├── mongo-init.js             # Creates 24 collections with indexes
│   └── prometheus.yml / grafana / logstash
├── scripts/
│   ├── seed-users.sh             # 5 test users with roles (DEV_ONLY)
│   ├── seed-roles.sh             # 7 roles with permissions (DEV_ONLY)
│   └── seed-policies.sh          # 5 policy templates (DEV_ONLY)
├── docker-compose.yml            # Full stack (27 services)
├── docker-compose.simple.yml     # Dev stack (11 containers)
└── nexora-complete-prd.md        # Full PRD — consult for feature requirements
```

## Running the Project

```bash
# Start dev stack
docker compose -f docker-compose.simple.yml up -d

# Rebuild a specific service
docker compose -f docker-compose.simple.yml up -d --build <service-name>

# Seed data (run in order)
bash scripts/seed-users.sh        # 5 users
bash scripts/seed-roles.sh        # 7 roles with permission matrices
bash scripts/seed-policies.sh     # 5 policy templates
```

### Docker Services & Ports

| Service | Host Port | Internal Port |
|---|---|---|
| API Gateway | 3005 | 3005 |
| Auth Service | 3010 | 3001 |
| HR Service | 3020 | 3010 |
| Attendance Service | 3011 | 3011 |
| Leave Service | 3012 | 3012 |
| Project Service | 3030 | 3020 |
| Task Service | 3031 | 3021 |
| Frontend | 3100 | 3000 |
| MongoDB | 27017 | 27017 |
| Redis | 6379 | 6379 |
| MailHog | 8025 (UI), 1025 (SMTP) | same |

**Port 3001 is taken** by another project (atria-auth-service), so auth maps to **3010** on host.

### URLs

- Frontend: http://localhost:3100
- **API Gateway: http://localhost:3005** (single entry point for all APIs)
- MailHog UI: http://localhost:8025

## API Gateway — Central Routing

All frontend requests go through `localhost:3005`. The gateway proxies to backend services:

| Route Pattern | Target Service |
|---|---|
| `/api/v1/auth/*` | auth-service |
| `/api/v1/employees/*`, `/api/v1/departments/*`, `/api/v1/designations/*`, `/api/v1/teams/*` | hr-service |
| `/api/v1/attendance/*`, `/api/v1/shifts/*`, `/api/v1/policies/*`, `/api/v1/alerts/*` | attendance-service |
| `/api/v1/leaves/*`, `/api/v1/leave-policies/*` | leave-service |
| `/api/v1/projects/*` | project-service |
| `/api/v1/tasks/*`, `/api/v1/timesheets/*` | task-service |
| `/health` | gateway (aggregated health) |

**Adding a new service**: Edit `services/api-gateway/src/main.ts` -> add entries to the `ROUTES` array.

## Frontend — Pages

| Route | Protected | Description |
|---|---|---|
| `/login` | No | Split-panel login, email+password, OAuth buttons |
| `/register` | No | Registration with password strength meter |
| `/dashboard` | Yes | Stat cards, profile, quick actions |
| `/attendance` | Yes | Clock in/out, today status, history, admin tabs (all employees + approvals), manual entries |
| `/timesheets` | Yes | Auto-populated from attendance, project filter, status filter, admin review (approve/reject) |
| `/leaves` | Yes | Apply leave, policy-linked balance cards, admin/hr approve/reject |
| `/policies` | Yes (admin/hr) | Work timing, leave, WFH policy types; templates system; create/edit modal |
| `/projects` | Yes | Project list, create project |
| `/projects/[id]` | Yes | Detail page with Overview / Tasks / Team / Timesheets tabs |
| `/tasks` | Yes | Task list with filters, time logging, comments |
| `/directory` | Yes | Employee cards, search, edit/create modal (Add Employee: admin/hr only) |
| `/departments` | Yes (admin/hr) | CRUD departments |
| `/roles` | Yes (admin only) | Roles list, permissions matrix grid, create/edit modal |

### Sidebar Structure (src/components/sidebar.tsx)

Role-filtered navigation. Sections and items hidden if user lacks required roles.

| Section | Items | Role Restriction |
|---|---|---|
| MAIN | Dashboard, Chat, Calendar | All |
| WORK | Projects, Tasks, Boards | All |
| TIME & ATTENDANCE | Attendance, Timesheets, Leaves, Policies | Policies: admin/hr only |
| PEOPLE | Directory, Departments | Departments: admin/hr only |
| FINANCE | Invoices, Expenses, Clients | admin/hr/manager only |
| ADMIN | Roles | admin only |

### API Client (src/lib/api.ts)

Exports: `authApi`, `employeeApi`, `departmentApi`, `attendanceApi`, `leaveApi`, `projectApi`, `taskApi`, `timesheetApi`, `policyApi`, `alertApi`, `roleApi`. Base URL: `NEXT_PUBLIC_API_URL` or `http://localhost:3005`.

## Role-Based Access Control

### Seeded Roles (7 total, via seed-roles.sh)

| Role | Key Permissions |
|---|---|
| super_admin | Everything, system role, cannot be deleted |
| admin | Everything, customizable |
| hr | Full employees/attendance/leaves/policies/departments; view projects/tasks |
| manager | Full projects/tasks; view employees/attendance/leaves with assign |
| employee | Own attendance/leaves/tasks; view projects |
| developer | Employee + full task management & export |
| designer | Employee + full task management & export |

### Access Rules in Frontend

- **Sidebar**: Sections/items filtered by `roles` array on NavSection/NavItem
- `/policies` and `/roles`: Show "Access Denied" for unauthorized roles
- `/directory`: "Add Employee" button only for admin/hr
- `/attendance`: Admin sees all employees tab + approvals tab
- `/timesheets`: Admin can review (approve/reject) but cannot create timesheets
- `/leaves`: Admin/hr can approve/reject leave requests
- `/departments`: Only visible/accessible for admin/hr

## Policy System

Policies live in attendance-service (`nexora_attendance` DB). Three policy types with a templates system.

### Policy Types

| Type | Key Fields |
|---|---|
| `work_timing` | startTime, endTime, graceMinutes, minWorkingHours, breakMinutes, timezone |
| `leave` | leaveTypes[] (type, annualAllocation, accrualFrequency, accrualAmount, maxCarryForward, encashable, maxConsecutiveDays, requiresDocument, applicableTo, minServiceMonths), yearStart, halfDayAllowed |
| `wfh` | maxDaysPerMonth, requiresApproval, allowedDays[] |

All policies share: `maxWorkingHoursPerWeek`, alerts (lateArrival, earlyDeparture, missedClockIn, overtimeAlert), `isTemplate`, `templateName`, `applicableTo` (all/department/designation/specific), version.

### Seeded Templates (5, via seed-policies.sh)

1. **Standard 9-to-6** — work_timing, 8h/day, 40h/week, 15 min grace
2. **Flexible Hours** — work_timing, 6h min, 30h/week, 60 min grace
3. **Night Shift** — work_timing, 22:00-07:00
4. **Remote First** — wfh, 20 days/month, no approval needed
5. **Standard Leave Policy** — leave type, 9 leave categories (Casual 12, Sick 12, Earned 15, WFH 24, Maternity 182, Paternity 14, Bereavement 5, Comp-Off, LOP)

### Policy Connections

- **Attendance**: Duration progress bar uses minWorkingHours; overtime alerts from maxWorkingHoursPerWeek
- **Leaves**: Balance cards use leavePolicy.leaveTypes[].annualAllocation
- **Timesheets**: expectedHours derived from maxWorkingHoursPerWeek

## Timesheets

Timesheets are in task-service (routed via `/api/v1/timesheets/*`). Key behaviors:

- **Auto-populate**: `POST /timesheets/auto-populate` pulls attendance check-in/check-out data for a date range and generates timesheet entries
- **Project connection**: Entries linked to projects; project detail page has Timesheets tab
- **expectedHours**: Derived from policy's `maxWorkingHoursPerWeek`
- **Workflow**: Draft -> Submitted -> Approved/Rejected (admin reviews via `/timesheets/:id/review`)
- **Admin restriction**: Admin can only review, not create timesheets

## Auth Service

### Key Endpoints (prefix /api/v1)

POST `/auth/register`, POST `/auth/login`, POST `/auth/refresh`, GET `/auth/me`, POST `/auth/logout`, MFA setup/verify, OAuth (Google/Microsoft), SAML login/callback, GET `/auth/roles`, POST `/auth/roles`, PUT `/auth/roles/:id`, DELETE `/auth/roles/:id`, PUT `/auth/users/:userId/roles`, GET `/auth/users`, GET `/health`.

### Security Rules

- Passwords: min 8 chars, bcrypt (10 rounds)
- Account lockout: 5 failed attempts -> 30 min lock
- JWT access: 15 min, refresh: 7 days
- CORS: `origin: true` (dev only)

### Test Credentials

| Email | Password | Roles |
|---|---|---|
| admin@nexora.io | Admin@123456 | admin, super_admin (cannot clock in) |
| hr@nexora.io | Hr@123456 | hr |
| dev@nexora.io | Dev@123456 | employee, developer |
| designer@nexora.io | Design@123456 | employee, designer |
| manager@nexora.io | Manager@123456 | employee, manager |

## Backend Services — Quick Reference

### HR Service (port 3020 -> 3010, DB: nexora_hr)
CRUD: employees (auto NXR-XXXX ID), departments (unique code), designations (level 1-10), teams. Stats, org-chart endpoints.

### Attendance Service (port 3011, DB: nexora_attendance)
Clock in/out (multiple sessions/day), manual entries (require approval), shifts, policies CRUD, policy templates, alerts. Admin/super_admin cannot clock in.

### Leave Service (port 3012, DB: nexora_leave)
Apply/approve/cancel leaves, balance (by year), team-calendar, leave-policies CRUD, stats.

### Project Service (port 3030 -> 3020, DB: nexora_projects)
CRUD projects, team members, milestones. Filters, pagination, stats.

### Task Service (port 3031 -> 3021, DB: nexora_tasks)
CRUD tasks, status updates, comments, time entries, timesheets (auto-populate, submit, review).

## Coding Conventions

### Backend (NestJS)
- Module -> Controller -> Service pattern
- API prefix: `/api/v1`, health at `/api/v1/health`
- `class-validator` on DTOs, Mongoose schemas (not TypeORM)
- tsconfig: `strict: false`, `noImplicitAny: false`
- Dockerfile: multi-stage, entry `dist/main.js`

### Frontend (Next.js)
- App Router, `"use client"` on interactive pages
- Tailwind CSS v3 with HSL variables, primary `#2E86C1`
- No `@base-ui/react` — plain HTML + forwardRef + cn()
- Sonner for toasts, Font: Inter, `output: "standalone"`

### Database
- Connection: `mongodb://root:nexora_dev_password@mongodb:27017/<db>?authSource=admin`
- DBs: nexora_auth, nexora_hr, nexora_attendance, nexora_leave, nexora_projects, nexora_tasks

## Dev-Only Items (Remove Before Production)

| Item | File |
|---|---|
| Test credentials banner | `frontend/src/app/login/page.tsx` |
| Placeholder SAML cert | `services/auth-service/src/auth/strategies/saml.strategy.ts` |
| Hardcoded JWT secret | `docker-compose.simple.yml` |
| Mailhog SMTP | `docker-compose.simple.yml` |
| MongoDB root password | `docker-compose.simple.yml` |
| CORS `origin: true` | `services/auth-service/src/main.ts` |
| Relaxed tsconfig | `services/auth-service/tsconfig.json` |
| Seed scripts | `scripts/seed-users.sh`, `seed-roles.sh`, `seed-policies.sh` |

**Rule**: Wrap dev helpers with `/* DEV_ONLY */` ... `/* END DEV_ONLY */` and add to this table.

## Known Issues

1. Host port 3001 taken by atria-auth-service -> mapped to 3010
2. Shadcn components rewritten for Tailwind v3 (NOT v4)
3. SAML uses placeholder cert in dev
4. Mailhog ARM Mac warning (linux/amd64 image) — works via emulation
5. tsconfig strict mode disabled in auth-service

## Useful Commands

```bash
docker compose -f docker-compose.simple.yml up -d --build auth-service  # Rebuild service
docker compose -f docker-compose.simple.yml logs -f auth-service        # View logs
docker exec -it nexora-mongodb mongosh -u root -p nexora_dev_password   # MongoDB shell
docker compose -f docker-compose.simple.yml ps                          # Container status

# Test login
curl -X POST http://localhost:3005/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nexora.io","password":"Admin@123456"}'
```

## Recent Development — Multi-Tenancy & Onboarding (March 2026)

### Phase 1: Multi-Tenant Data Isolation (COMPLETE)
- Every service query now filters by `organizationId` from JWT
- Roles are org-scoped (same name allowed in different orgs)
- Token refresh preserves organizationId
- API Gateway forwards `X-Organization-Id` header
- Default roles seeded on org creation (admin, hr, manager, developer, designer, employee)
- All schemas have `organizationId` field with compound indexes

### Phase 2: Onboarding Wizard Enhancement (COMPLETE)
- 3-step new user flow: Profile → Organization → Team Setup
- Welcome splash screen with animations between steps
- "Setting up workspace" animated checklist before dashboard
- Auto-creates policies (work timing, leave, WFH) based on onboarding answers
- Auto-creates designations alongside departments
- Team setup: add HR, Manager, Developer, Designer, Sales, Finance with names + emails
- Invited users get fully active accounts (no profile step needed on login)
- Org name uniqueness validated

### Phase 3: Settings & Appearance (COMPLETE)
- Full settings section: Profile, Security, Appearance, Notifications, Organization, Members, Billing
- Comprehensive theming system: 11 color presets + custom, 10 fonts, 6 radius options, 5 font sizes
- Sidebar styles: Light, Dark, Colored (auto-switches in dark mode)
- Dark mode with full coverage (sidebar, cards, inputs, badges, hover states)
- Preferences stored in backend (User.preferences), not localStorage
- Theme resets to default on logout, loads per-user from backend on login
- Font family dynamically loaded from Google Fonts

### Phase 4: Auth Flow (COMPLETE)
- OTP-only auth (no passwords) — email → OTP (000000 in dev) → dashboard
- Login page handles both existing and new users inline (no redirect to /register)
- Invited users skip onboarding, go straight to dashboard
- Employee records created for all team members during onboarding
- Logged-in user filtered from Directory and Chat (only visible in Profile)
- Invitation system works for non-existent users (creates active account with names)

### Testing Infrastructure (COMPLETE)
- 133+ E2E test cases across 8 suites
- Test runner at `tests/runner.ts` — runs all suites in parallel
- Test dashboard UI at `/test-dashboard` — shows results, coverage, business insights
- Agent prompt files in `tests/agents/` for parallel test execution
- 86% pass rate, 13 business insights collected

### Key API Endpoints Added
| Endpoint | Method | Description |
|---|---|---|
| `/auth/me` | PUT | Update profile (name, avatar, phone) |
| `/auth/change-password` | POST | Change password |
| `/auth/mfa` | DELETE | Disable MFA |
| `/auth/preferences` | GET/PUT | User preferences (theme, etc.) |
| `/auth/organizations/:id/members/:memberId` | PUT/DELETE | Manage org members |
| `/auth/organizations/:id` | DELETE | Soft-delete organization |

### Frontend Pages Added
| Route | Description |
|---|---|
| `/settings/*` | Profile, Security, Appearance, Notifications, Organization, Members, Billing |
| `/test-dashboard` | Test results dashboard (no auth required) |

### Under Construction / Planned
- Policies system redesign (separate from attendance, templates)
- Projects/Boards/AI enhancement (Jira-like, templates, AI project generation)
- Roles & permissions full matrix UI
- Auto departments on onboarding
