# NEXORA — Complete Product Overview

**The Unified IT Operations Platform**

**Version:** 1.0 | **Date:** March 26, 2026 | **Organization:** Nugen IT Services | **Classification:** Product Overview

---

## 1. What is Nexora?

Nexora is a comprehensive, enterprise-grade IT operations platform designed to be the **single operating system for technology companies**. It replaces 10+ fragmented SaaS tools — Jira, Slack, Microsoft Teams, BambooHR, QuickBooks, Confluence, Greenhouse, PagerDuty, HubSpot, and more — with one unified platform purpose-built for IT services, digital agencies, and engineering organizations.

### Vision

> **"One platform. Every workflow. Every role. Every team."**

Nexora consolidates core operational workflows into a single platform with unified identity, real-time communication, AI-powered automation, and pixel-perfect design — purpose-built for IT companies managing distributed teams, client projects, and complex billing.

---

## 2. The Problem We Solve

Growing IT companies operate across 8–15 disconnected SaaS tools for HR, communication, project management, invoicing, recruitment, and documentation. This fragmentation leads to:

| Problem | Impact |
|---|---|
| **Data Silos** | Employee data in BambooHR can't inform project staffing in Jira |
| **Context Switching** | Developers lose 23 minutes per context switch (UCI research) |
| **Duplicated Effort** | Time logged in one tool must be re-entered for invoicing in another |
| **Security Gaps** | Offboarded employees still have access to 3 of 12 tools |
| **Spiraling Costs** | $150–300/employee/month across tool subscriptions |
| **Lost Knowledge** | Scattered across Slack threads, Confluence pages, and email chains |

**Nexora eliminates all of this with one login, one data layer, one bill.**

---

## 3. Target Market

| Segment | Size | Key Pain Points |
|---|---|---|
| **IT Services / Outsourcing** | 20–500 employees | Client billing, resource allocation, multi-timezone teams, compliance |
| **Digital Agencies** | 10–200 employees | Project profitability, time tracking, creative workflows, client visibility |
| **Startup Engineering Teams** | 5–50 employees | Lightweight but complete ops, rapid onboarding, budget constraints |
| **Managed Service Providers** | 50–300 employees | SLA tracking, ticket management, workforce scheduling, incident response |
| **Product Companies** | 20–200 employees | Sprint management, release planning, developer experience, code integration |
| **Consulting Firms** | 10–100 employees | Bench management, skill matching, utilization tracking, proposal generation |

---

## 4. Core Principles

1. **Unified by Design** — Every module shares the same user identity, notification system, and data layer. No imports, no syncs, no duplicates.
2. **Role-Aware** — The platform adapts its interface and capabilities based on the user's role. A developer sees sprint boards; HR sees leave queues; accounts sees invoices.
3. **AI-Native** — AI isn't bolted on. Every module has intelligence built in — from smart task assignment to natural language analytics.
4. **Pixel-Perfect** — Enterprise software shouldn't look like enterprise software. Nexora is designed with the polish of a consumer product and the depth of an enterprise tool.
5. **Privacy-First** — Sensitive HR and payroll data never leaves the organization's infrastructure. Hybrid AI architecture with local LLMs for sensitive operations.

---

## 5. Technology Stack

### 5.1 Core Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4, shadcn/ui | SSR, routing, type-safe UI components |
| **State Management** | Redux Toolkit, React Query (TanStack) | Global state + server state caching |
| **Animations** | Framer Motion | Page transitions, micro-interactions |
| **Rich Text** | Tiptap | Wiki, comments, descriptions editor |
| **Charts** | Recharts | Data visualization |
| **Drag & Drop** | React DnD Kit | Kanban boards, dashboards |
| **Backend** | NestJS 10, Node.js 20, TypeScript 5 | Enterprise-grade microservices framework |
| **Database** | MongoDB 7 (Mongoose 7 ODM) | Primary document store (replica set) |
| **Cache** | Redis 7 | Sessions, pub-sub, rate limiting, queues |
| **Search** | Elasticsearch 8 | Full-text search, log aggregation |
| **Real-Time** | Socket.IO 4 | Chat, presence, live notifications |
| **Job Queues** | BullMQ 5 | Background workers, cron, email |
| **Auth** | Passport.js (JWT, Google OAuth, Microsoft OAuth, SAML), bcrypt, speakeasy (TOTP MFA) | Multi-strategy authentication |
| **Media/VoIP** | WebRTC, LiveKit/Mediasoup, coturn | Voice/video calls, screen sharing |
| **Storage** | AWS S3 + CloudFront | Files, images, recordings, CDN |
| **AI/LLM** | Anthropic Claude API (cloud), Ollama + Qwen 2.5 7B (local), TensorFlow.js (client) | Hybrid AI architecture |
| **Email** | SendGrid + Nodemailer | Transactional email |
| **Push** | Firebase Cloud Messaging + Expo Push | Web & mobile push notifications |
| **Infra** | Docker Compose (dev), Kubernetes EKS/AKS (prod), Nginx | Container orchestration |
| **CI/CD** | GitHub Actions | Automated pipelines |
| **Monitoring** | Prometheus + Grafana, Sentry, ELK Stack | Metrics, errors, centralized logging |
| **Testing** | Jest, React Testing Library, Playwright, Supertest | Unit, component, E2E, API tests |

### 5.2 Architecture

Nexora follows a **microservices architecture** with 20+ independent services communicating via REST, gRPC, and Redis Pub/Sub, orchestrated behind a centralized API Gateway.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│   Web App (Next.js)  │  iOS (Expo)  │  Android  │  Portal   │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (Kong + Consul)                      │
│    TLS · Auth Routing · Rate Limiting · Load Balancing        │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│              MICROSERVICES CLUSTER                            │
│  Auth · HR · Attendance · Leave · Payroll · Project · Task   │
│  Board · CRM · Invoice · Expense · Document · Asset          │
│  Recruitment · Notification · Analytics · AI · Real-Time     │
│  File · Integration · DevOps                                 │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│              SHARED DATA LAYER                               │
│  MongoDB Replica · Redis Cluster · Elasticsearch · S3 CDN    │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│              DISTRIBUTED WORKERS (BullMQ)                     │
│  Email Worker · Payroll Worker · AI Worker (Ollama) · Sync   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Key Architecture Decisions

- **Multi-Tenant Data Isolation**: Every query filters by `organizationId` from JWT; org-scoped roles; compound indexes on all schemas
- **Inter-Service Communication**: Synchronous (REST/gRPC) + Asynchronous (Redis Pub/Sub, event streams)
- **Soft Delete Everywhere**: `isDeleted`, `deletedAt`, `deletedBy` on every document
- **Audit Trail**: `createdBy`, `updatedBy`, `createdAt`, `updatedAt` on every document
- **Schema Versioning**: `schemaVersion` field for forward-compatible migrations
- **API Standards**: RESTful, cursor + offset pagination, query param filtering, field selection, consistent response envelope

---

## 6. Complete Module Breakdown

Nexora consists of **25 modules** covering every operational workflow an IT company needs.

---

### Module 01 — Authentication & Onboarding

**Replaces:** Okta, Auth0, manual onboarding checklists

| Feature | Details |
|---|---|
| **Login** | Email+password, Google OAuth, Microsoft OAuth, SAML 2.0 SSO |
| **MFA** | TOTP (Google Authenticator), SMS OTP, Email OTP |
| **Security** | bcrypt hashing, account lockout (5 attempts / 30 min), JWT (15 min access / 7 day refresh), device fingerprinting |
| **Onboarding Wizard** | 3-step flow: Profile → Organization → Team Setup with animated transitions |
| **Team Invitations** | Invite team members by role (HR, Manager, Developer, etc.) — creates active accounts |
| **Offboarding** | Automated checklist: asset return, access revocation, final settlement, exit interview |
| **OTP Auth** | Passwordless email OTP login flow (dev: 000000) |

---

### Module 02 — Executive Dashboard

**Replaces:** Manual Excel reports, scattered analytics

Role-based dashboards that adapt to each user:

| Role | Key Widgets |
|---|---|
| **Admin/Super Admin** | Total employees, active projects, pending approvals, revenue, attendance live view, team utilization heatmap, AI daily digest |
| **HR** | Headcount, new joiners/exits, attendance summary, leave calendar, recruitment pipeline, onboarding progress, birthday/anniversary widget |
| **Developer/Designer** | My tasks, sprint burndown, PR review queue, attendance status, upcoming deadlines |
| **Sales** | Pipeline by stage, revenue forecast, activity summary, top deals, win/loss ratio |
| **Accounts** | Revenue, outstanding invoices, payroll status, expense summary, cash flow trend |

Dashboards are fully configurable: drag-and-drop widgets, resize, date range filters, auto-refresh, full-screen mode.

---

### Module 03 — Employee Directory & Org Management

**Replaces:** BambooHR, spreadsheet directories

| Feature | Details |
|---|---|
| **Directory** | Search by name, email, ID, department, skill, location; grid/list view with online status |
| **Org Chart** | Interactive hierarchical tree with expand/collapse, search-to-zoom |
| **Skill Matrix** | Employee × skill grid with proficiency levels for project staffing |
| **Departments** | CRUD with hierarchy, cost centers, budgets, headcount planning |
| **Designations** | Levels 1–10, IC and management tracks, salary bands |
| **Teams** | Within departments + cross-functional virtual teams |
| **Employee IDs** | Auto-generated (NXR-XXXX format) |

---

### Module 04 — Attendance & Shift Management

**Replaces:** Biometric-only systems, paper attendance

| Feature | Details |
|---|---|
| **One-Tap Check-In/Out** | Web + mobile; captures timestamp, IP, GPS, photo |
| **Multiple Sessions** | Support multiple check-in/out sessions per day |
| **Manual Entry** | Submit with reason category → manager/HR approval |
| **Regularization** | Correct times with before/after comparison → dual approval |
| **Shift Management** | Define shifts, assign individually/bulk, rotation patterns, shift swaps |
| **Live Dashboard** | Real-time grid of all employees with department/team filters |
| **Policies** | Working days, grace minutes, geofence, WiFi validation, auto-absent, comp-off rules |
| **Force Log** | Admin can check in/out on behalf of employees (audit logged) |
| **Overtime Tracking** | Auto-detected hours beyond shift; monthly accumulation |

---

### Module 05 — Leave Management

**Replaces:** Email-based leave requests, Excel tracking

| Feature | Details |
|---|---|
| **Leave Types** | 9 categories: Casual (12), Sick (12), Earned (15), WFH (24), Maternity (182), Paternity (14), Bereavement (5), Comp-Off, LOP |
| **Balance Cards** | Policy-linked real-time balance display |
| **Apply/Approve** | Apply with dates + reason → manager/HR approval flow |
| **Team Calendar** | Availability heatmap showing team leave overlap |
| **Accrual System** | Monthly/quarterly accrual, carry-forward rules, encashment |
| **Half-Day** | Half-day leave support with policy configuration |
| **Statistics** | Leave utilization by type, department comparison, trend analysis |

---

### Module 06 — Payroll & Compensation

**Replaces:** Keka, GreytHR, manual salary processing

| Feature | Details |
|---|---|
| **Salary Structure** | Basic + HRA + DA + special allowances + deductions |
| **Payroll Runs** | Monthly processing with attendance/leave integration |
| **Payslip Generation** | Professional PDF payslips with company branding |
| **Statutory Compliance** | PF, ESI, TDS, professional tax (India-focused) |
| **Reimbursements** | Integrated with expense module |
| **Bonus & Incentives** | Ad-hoc and scheduled bonus processing |
| **AI Anomaly Detection** | Local Qwen model flags unusual salary calculations |

---

### Module 07 — Project Management

**Replaces:** Asana, Monday.com (project-level tracking)

| Feature | Details |
|---|---|
| **Project CRUD** | Create with methodology, team, milestones, billing config |
| **Methodology Support** | Scrum, Kanban, Scrumban, SAFe, Waterfall, XP, Lean, Custom |
| **Team Management** | Add members with roles (Owner, Admin, Member, Viewer) |
| **Milestones** | Track progress against key deliverables |
| **Project Detail** | Tabs: Overview, Tasks, Team, Timesheets |
| **Billing Integration** | Hourly rates per member; auto-invoice from timesheets |
| **Statistics** | Budget vs actual, resource utilization, health scorecard |

---

### Module 08 — Advanced Board Maker (Jira Replacement)

**Replaces:** Jira, Linear, Trello

This is Nexora's flagship project delivery module:

| Feature | Details |
|---|---|
| **Work Item Hierarchy** | Epic → Story/Feature → Task/Bug → Subtask |
| **8 Methodology Templates** | Scrum, Kanban, Scrumban, SAFe, Waterfall, XP, Lean, Custom — each pre-configures columns, WIP limits, point scales, ceremonies |
| **Sprint Lifecycle** | Planning → Active → Review → Completed; burndown charts, velocity tracking |
| **Dependency Management** | Blocked By, Relates To, Duplicates, Is Child Of — DAG validation prevents circular refs |
| **Story Point Estimation** | Fibonacci or custom scales; `hoursPerPoint` ratio; velocity-based learning |
| **Multi-View Boards** | Kanban, list, table, timeline (Gantt), calendar views |
| **WIP Limits** | Per-column limits with visual warnings |
| **Automation Rules** | Trigger-action automation (e.g., auto-assign on status change) |
| **Critical Path Analysis** | Dependency-aware scheduling with topological sort |
| **AI Project Breakdown** | Natural language → epics/stories/tasks with estimates |
| **Duplicate Detection** | Embedding-based similarity check on issue creation |

---

### Module 09 — Task Management

**Replaces:** Todoist, personal task tools

| Feature | Details |
|---|---|
| **Task CRUD** | Title, description, assignee, priority, due date, tags, attachments |
| **Status Workflow** | Customizable status columns |
| **Time Logging** | Start/stop timer or manual entry per task |
| **Comments & Activity** | Threaded discussions, full audit trail |
| **Filters** | By status, priority, assignee, project, date range |
| **Sprint Assignment** | Link tasks to sprints for delivery tracking |
| **Bulk Actions** | Multi-select with floating action bar |

---

### Module 10 — Communication Hub (Chat, Voice & Video)

**Replaces:** Slack, Microsoft Teams, Zoom, Google Meet

| Feature | Details |
|---|---|
| **Messaging** | DMs, group DMs, public/private channels, project channels, announcements |
| **Rich Messages** | Formatting, file sharing, reactions, threads, @mentions, polls, voice messages |
| **Voice Calls** | 1:1 P2P (WebRTC) + group up to 50 (SFU) |
| **Video Calls** | HD video up to 25 participants; grid layout, speaker spotlight |
| **Screen Sharing** | Share screen/window/tab with audio |
| **Recording** | Consent-based recording stored in S3 |
| **Virtual Backgrounds** | Blur or image replacement (TensorFlow.js client-side) |
| **Meeting Rooms** | Persistent rooms for recurring standups |
| **Live Captions** | AI-powered real-time speech-to-text |
| **Noise Cancellation** | AI background noise suppression |
| **Nexora Bot** | AI assistant: answer from wiki, create tasks from messages, summarize threads |
| **Search** | Elasticsearch-powered full-text across all messages |
| **Presence** | Online/Away/DND/Offline with custom status and calendar sync |

---

### Module 11 — Client Management & CRM

**Replaces:** HubSpot, Pipedrive, Zoho CRM

| Feature | Details |
|---|---|
| **Client Management** | CRUD with multi-contact, communication history, categories, linked entities |
| **CRM Pipeline** | Kanban: New Lead → Contacted → Qualified → Proposal → Negotiation → Won/Lost |
| **Deal Tracking** | Value, probability, expected close date, salesperson assignment |
| **Proposal Builder** | Templates with scope, timeline, team, pricing; PDF export |
| **Revenue Forecasting** | Weighted pipeline by expected close month |
| **Client Portal** | Secure external login — project progress, invoices, deliverable review, file sharing, SLA dashboard |
| **White-Label Portal** | Client's logo and color scheme |

---

### Module 12 — Invoicing & Billing

**Replaces:** QuickBooks, Zoho Invoice, FreshBooks

| Feature | Details |
|---|---|
| **Invoice Creation** | Line items, taxes (GST/VAT), discounts, multi-currency (INR, USD, EUR, GBP, AUD, CAD, SGD) |
| **Auto-Numbering** | Sequential with configurable prefix (NX-INV-2026-001) |
| **Time-Based Billing** | Generate invoices from billable hours logged on projects |
| **Recurring Invoices** | Auto-generate on schedule with auto-send |
| **Tax Engine** | CGST, SGST, IGST, VAT, custom tax types |
| **E-Invoicing** | GST e-invoice with IRN (India compliance) |
| **Payment Tracking** | Partial/full payments, auto-reminders on overdue |
| **Credit Notes** | Issue credits against existing invoices |
| **Status Flow** | Draft → Sent → Partially Paid → Paid / Overdue / Cancelled |
| **Aging Reports** | 30/60/90/120+ day buckets by client |
| **Revenue Reports** | By client, project, month; MRR/ARR tracking |

---

### Module 13 — Recruitment & ATS

**Replaces:** Greenhouse, Lever, Workable

| Feature | Details |
|---|---|
| **Job Postings** | Title, department, requirements, salary range; career page widget |
| **Candidate Pipeline** | Kanban: Applied → Screening → Interview → Assessment → Offer → Hired/Rejected |
| **Resume Parsing (AI)** | Auto-extract name, skills, experience, education from PDF/DOCX |
| **Candidate Matching** | Embedding-based job-candidate matching score |
| **Interview Scheduling** | Auto-find slots from interviewer + candidate availability |
| **Scorecard System** | Configurable evaluation criteria per stage; weighted ratings |
| **Offer Management** | Generate from template → candidate review → accept/negotiate/decline |
| **Onboarding Handoff** | On acceptance: auto-create user → trigger onboarding → assign equipment |
| **Referral Program** | Track referrals → reward on successful hire |
| **Analytics** | Time-to-hire, cost-per-hire, source effectiveness, conversion rates |

---

### Module 14 — Knowledge Base & Wiki

**Replaces:** Confluence, Notion, Slite

| Feature | Details |
|---|---|
| **Spaces & Pages** | Hierarchical organization with unlimited nesting |
| **Rich Editor (Tiptap)** | Headings, lists, code blocks (50+ languages), tables, images, videos, Mermaid diagrams, callouts, @mentions, slash commands |
| **Templates** | Meeting notes, Decision log, Architecture doc, Runbook, RFC, Sprint retro |
| **Version History** | Full revision history with visual diff; restore any version |
| **Inline Comments** | Comment on selected text; threaded discussions; resolve/unresolve |
| **Cross-Linking** | `[[Page Name]]` syntax with auto-backlinks |
| **Import/Export** | Import from Confluence, Notion; export as PDF, Markdown, HTML |
| **AI Search** | Ask a question → get answer from wiki content |

---

### Module 15 — IT Asset Management

**Replaces:** Snipe-IT, AssetTiger

| Feature | Details |
|---|---|
| **Asset Registry** | Laptops, monitors, phones, servers, software — serial number, vendor, warranty, condition |
| **Assignment Tracking** | Issue to employee → track condition → process returns |
| **Software Licenses** | Per-seat/device/enterprise tracking; renewal alerts |
| **QR Codes** | Auto-generated for physical tagging; scan to view details |
| **Procurement Workflow** | Request → approve → procure → receive → assign |
| **Depreciation** | Auto-calculate (straight-line, declining balance) |
| **Audit** | Periodic verification checklist; flag missing assets |

---

### Module 16 — Expense Management

**Replaces:** Expensify, Zoho Expense

| Feature | Details |
|---|---|
| **Expense Submission** | Category, amount, receipt, project linkage |
| **Receipt OCR (AI)** | Auto-extract merchant, amount, date from receipt images |
| **Policy Engine** | Per-category spending limits; auto-flag violations |
| **Approval Workflow** | Employee → Manager → Finance; bulk approve |
| **Mileage Claims** | Auto-calculate distance → apply per-km rate |
| **Per Diem** | Auto daily allowance based on destination |
| **Corporate Card** | Import transactions → match with expense reports |
| **Project Costing** | Tag expenses to projects for profitability; pass-through billing |

---

### Module 17 — Timesheets & Billing

**Replaces:** Harvest, Toggl, manual Excel timesheets

| Feature | Details |
|---|---|
| **Daily Time Entry** | Hours per task with billable/non-billable flag |
| **Weekly View** | Grid: rows = tasks/projects, columns = days |
| **Auto-Fill** | Pre-populate from attendance check-in/check-out |
| **Timer Widget** | Start/stop timer against selected task |
| **Submission Flow** | Draft → Submitted → Approved/Rejected |
| **Invoice Integration** | Generate invoice from approved billable hours |
| **Missing Day Indicators** | Highlight unlogged days (excluding holidays/leaves) |

---

### Module 18 — Performance Reviews & OKRs

**Replaces:** Lattice, 15Five, Culture Amp

| Feature | Details |
|---|---|
| **Review Cycles** | Quarterly, semi-annual, annual with structured timelines |
| **Self-Assessment** | Employee self-review with achievements and goals |
| **360-Degree Feedback** | Peer reviews from selected colleagues |
| **Calibration** | HR/leadership normalize ratings across teams |
| **OKRs** | Company → Team → Individual cascade with key results |
| **Goal Management** | SMART goals with milestone tracking |
| **1:1 Notes** | Structured manager-employee check-in templates |
| **PIP** | Performance Improvement Plans with milestones |
| **AI Review Assistant** | Local Qwen model suggests feedback phrasing (privacy-safe) |

---

### Module 19 — DevOps Dashboard

**Replaces:** PagerDuty, Statuspage, Opsgenie

| Feature | Details |
|---|---|
| **CI/CD View** | Visualize pipeline stages from GitHub Actions, GitLab CI, Jenkins |
| **Deployment Tracker** | Version, environment, deployer, status (success/failed/rolled back) |
| **Service Catalog** | Register services: repo, stack, team, dependencies, docs |
| **Incident Management** | P1–P4 severity, assigned responder, status timeline |
| **On-Call Schedule** | Rotation management with escalation chains |
| **Uptime Monitoring** | HTTP checks with optional public status page |
| **Post-Mortem** | Structured template: timeline, root cause, action items |
| **Runbook Library** | Searchable operational procedures linked to services |

---

### Module 20 — Reports & Analytics

**Replaces:** Custom dashboards, Excel reports

| Category | Reports |
|---|---|
| **HR** | Headcount, attrition, diversity, skill matrix |
| **Attendance** | Daily summary, late trends, absenteeism, overtime |
| **Payroll** | Monthly summary, department cost, statutory, variance |
| **Projects** | Health scorecard, budget vs actual, utilization |
| **Sprint** | Velocity trend, burndown accuracy, scope creep |
| **Sales/CRM** | Pipeline, conversion, forecast, salesperson performance |
| **Invoicing** | Revenue by client/project, aging, MRR/ARR |

Plus: **Custom Dashboard Builder** (drag-and-drop widgets, any data source), **scheduled email delivery**, and **AI-powered natural language queries**.

---

### Module 21 — Notifications & Reminders

| Channel | Technology |
|---|---|
| In-App (Real-Time) | Socket.IO |
| Web Push | Firebase Cloud Messaging |
| Mobile Push | FCM + Expo Push |
| Email Digest | SendGrid (instant, hourly, daily, weekly) |

Per-notification-type channel toggles, DND schedules, snooze, recurring reminders.

---

### Module 22 — Email Templates & Document Generator

| Feature | Details |
|---|---|
| **Email Templates** | Rich text editor with dynamic variables (`{{employeeName}}`, etc.) |
| **Document Types** | Offer Letter, Experience Letter, Salary Certificate, Relieving Letter, NDA, Custom |
| **Bulk Generation** | Generate for entire departments |
| **Digital Signature** | E-sign integration readiness |

---

### Module 23 — Settings & Configuration

Organization settings, module-level configuration, custom fields on any module, custom statuses, branding, data import/export, backup, data retention, and GDPR tools (data export, right to deletion, consent management).

---

### Module 24 — Integrations Hub

| Category | Integrations |
|---|---|
| **Version Control** | GitHub, GitLab, Bitbucket |
| **CI/CD** | GitHub Actions, GitLab CI, Jenkins |
| **Calendar** | Google Calendar, Outlook Calendar |
| **Communication** | Slack, Microsoft Teams |
| **Accounting** | Tally, QuickBooks, Zoho Books |
| **Identity** | Google Workspace, Microsoft Entra ID, Okta |
| **Storage** | Google Drive, OneDrive, Dropbox |
| **Payment** | Razorpay, Stripe |
| **Cloud** | AWS, Azure, GCP |
| **Email** | Gmail, Outlook |

Plus: REST API (OpenAPI 3.0), webhook subscriptions, API keys, Zapier/n8n compatible.

---

### Module 25 — Mobile Application

| Platform | React Native with Expo (iOS 15+, Android 10+) |
|---|---|
| **Key Features** | One-tap attendance (GPS + photo), full chat, voice/video calls, task management, leave apply/approve, expense OCR capture, offline mode, biometric auth, dark mode, home screen widgets, deep linking |

---

## 7. Role-Based Access Control

Nexora adapts to **18 distinct roles** out of the box:

| Role | Primary View | Key Access |
|---|---|---|
| **Super Admin** | Full system metrics | Everything + tenant management |
| **Admin** | Org-wide metrics | Everything + settings |
| **HR Manager** | People operations | Directory, Attendance, Leave, Payroll, Recruitment, Performance |
| **CTO / VP Engineering** | Technical leadership | Projects, Boards, Tasks, DevOps, Wiki, Performance |
| **Tech Lead** | Team sprint | Projects, Boards, Tasks (team-scoped) |
| **Project Manager** | Delivery management | Projects, Tasks, Boards, Timesheets, Client Portal |
| **Developer** | My tasks, sprint board | Tasks, Boards, Wiki, Timesheet, Chat |
| **Designer** | Design tasks | Tasks, Boards, Wiki, Timesheet, Chat |
| **QA Engineer** | Bug board | Tasks, Boards (Bug Tracker), Wiki |
| **Sales Manager** | Pipeline, forecast | CRM, Clients, Proposals, Invoices |
| **Accounts Manager** | Revenue, payroll | Payroll, Invoices, Expenses, Reports |
| **Manager** | Team metrics | Team attendance, leaves, tasks, timesheets |
| **Employee** | Personal dashboard | Own profile, attendance, leaves, tasks, chat |
| **Client (External)** | Project progress | Client Portal (read-only) |

Permission model: `READ`, `WRITE`, `DELETE`, `HARD_DELETE`, `APPROVE`, `REJECT`, `FORCE_WRITE`, `EXPORT`, `CONFIGURE`, `BULK_ACTION`, `IMPERSONATE`

Data scoping: `SELF` → `TEAM` → `DEPARTMENT` → `PROJECT` → `ORGANIZATION`

---

## 8. Design System

### Philosophy: "Calm Enterprise"

Professional, information-dense when needed, but never overwhelming. Enterprise depth with consumer polish.

| Aspect | Specification |
|---|---|
| **Primary Color** | `#2E86C1` (Nexora Blue) |
| **Typography** | Inter (UI), JetBrains Mono (code) |
| **Theming** | 11 color presets + custom, 10 fonts, 6 radius options, 5 font sizes |
| **Dark Mode** | Full coverage with system preference detection |
| **Sidebar Styles** | Light, Dark, Colored (auto-switches in dark mode) |
| **Icons** | Lucide Icons (MIT, tree-shakeable) |
| **Responsive** | 6 breakpoints from mobile (< 640px) to 2xl (≥ 1536px) |
| **Accessibility** | WCAG 2.1 AA compliant, keyboard navigable, screen reader friendly |
| **Interactions** | Skeleton loaders, optimistic updates, drag-and-drop, keyboard shortcuts (⌘K search), right-click menus |

---

## 9. AI & Automation Strategy — The Intelligence Layer

### 9.1 Hybrid Architecture (Privacy-First)

| Layer | Model | Privacy | Use Cases |
|---|---|---|---|
| **Cloud AI** | Anthropic Claude Sonnet | API (data sent to Anthropic) | Project planning, analytics, document gen, code review |
| **Local AI** | Qwen 2.5 7B via Ollama | On-premise (never leaves infra) | HR data analysis, salary insights, performance reviews, sentiment |
| **Embedded ML** | TensorFlow.js + custom classifiers | Client-side / server-side | Receipt OCR, resume parsing, face detection, noise cancellation |

### 9.2 AI Features by Module

| Module | AI Feature | Model |
|---|---|---|
| **Dashboard** | Daily digest: auto-generated summary of anomalies and action items | Claude |
| **Boards** | Natural language → epics/stories/tasks with estimates | Claude |
| **Boards** | Smart estimation from historical similarity | Claude |
| **Boards** | Duplicate detection on issue creation | Embedding + similarity |
| **Boards** | Auto-assign based on workload + skills + history | Claude |
| **Tasks** | Sprint planning assistant: recommend backlog items | Claude |
| **Tasks** | Standup summary from issue activity | Claude |
| **Chat** | AI Bot: answer from wiki, create tasks, summarize threads | Claude |
| **Recruitment** | Resume parsing from PDF/DOCX | Claude + local |
| **Recruitment** | Candidate-job matching score | Embedding + similarity |
| **Wiki** | Semantic Q&A over all wiki content | Claude |
| **Wiki** | Auto-summarize long documents | Claude |
| **Payroll** | Anomaly detection in salary calculations | Local Qwen |
| **Payroll** | Compliance checks against statutory rules | Local Qwen |
| **Attendance** | Pattern detection: habitual late, unusual locations | Local Qwen |
| **Expenses** | Receipt OCR: extract merchant, amount, date | TensorFlow.js |
| **Performance** | Review writing assistant: suggest feedback phrasing | Local Qwen |
| **Analytics** | Natural language queries over all data | Claude |
| **Analytics** | Trend predictions and forecasting | Claude + statistical |

### 9.3 AI Safety Principles

- HR, payroll, and performance data **never leaves the organization's infrastructure** (local Qwen model)
- Cloud AI calls include only project/task metadata — **no PII**
- AI features are **opt-in per organization**
- Suggestions always presented as recommendations — **never auto-applied** without user confirmation
- Full **audit log** for all AI-generated content and actions

---

## 10. Unique Selling Points (USP)

### What Makes Nexora Different

#### 1. True Unification — Not Just Integration

Unlike competitors that connect separate tools via APIs, Nexora is **built as one platform from the ground up**. The employee who clocks in is the same employee assigned tasks, whose timesheet auto-generates, whose hours flow into client invoices, whose performance review references actual project delivery data. **Zero data duplication. Zero sync lag.**

#### 2. AI-Native with Privacy-First Architecture

Every module has built-in intelligence, but Nexora uniquely uses a **hybrid AI architecture**:
- Cloud AI (Claude) for project planning, analytics, and document generation
- Local AI (Qwen via Ollama) for anything touching HR data, salaries, or performance — **data never leaves the org's infrastructure**

No other platform in this category offers privacy-preserving AI at this depth.

#### 3. Replaces 10+ Tools at a Fraction of the Cost

| Replaced Tool | Approx. Cost/User/Month | Nexora Module |
|---|---|---|
| Jira | $8.15 | Boards + Tasks |
| Slack | $8.75 | Communication Hub |
| Zoom | $6.66 | Voice & Video |
| BambooHR | $8.25 | HR + Directory |
| QuickBooks | $15+ | Invoicing + Expenses |
| Confluence | $5.75 | Wiki |
| Greenhouse | $12+ | Recruitment |
| Harvest | $10.80 | Timesheets |
| Lattice | $11+ | Performance + OKRs |
| PagerDuty | $21+ | DevOps |
| **Total** | **$107–150+/user/mo** | — |
| **Nexora Professional** | **$15/user/mo** | **All of the above** |

**That's 85–90% cost reduction.**

#### 4. Built Specifically for IT Companies

Nexora isn't a generic HRMS or a generic PM tool. It's purpose-built for the workflows IT companies actually run:
- **Client billing from timesheets** (not a bolt-on)
- **Sprint boards with HR integration** (developer on leave? Board reflects it)
- **DevOps dashboard alongside project delivery** (incidents linked to sprints)
- **Skill matrix for resource allocation** (match developers to projects by expertise)

#### 5. Multi-Tenant from Day One

True multi-tenancy with **complete data isolation** per organization. Same role names, same policy names — isolated per org. Not an afterthought bolt-on.

#### 6. Self-Hosted Option

For enterprises with strict compliance requirements, Nexora offers a **self-hosted deployment** option — run the entire platform on your own infrastructure with a one-time license.

---

## 11. Competitive Positioning

| Capability | Tools Replaced | Nexora Advantage |
|---|---|---|
| HR & Payroll | BambooHR, Keka, GreytHR | Unified with attendance, projects, billing, performance |
| Project Management | Jira, Asana, Linear, Monday | Native sprint boards + AI planning + time billing + client portal |
| Communication | Slack, Teams, Zoom, Meet | Chat + voice + video in one; zero context switching |
| Invoicing | QuickBooks, FreshBooks | Auto-generate from time logs; GST-compliant; multi-currency |
| Recruitment | Greenhouse, Lever | Seamless onboarding handoff to HR module |
| Wiki / Docs | Confluence, Notion | Linked to projects/tasks; AI-powered search |
| CRM | HubSpot, Pipedrive | Connected to invoicing, project delivery, client portal |
| Performance | Lattice, 15Five | Tied to actual project data, task completion, OKRs |
| DevOps | PagerDuty, Opsgenie | Integrated with boards, incidents, on-call |
| Expenses | Expensify, Zoho Expense | OCR, project-linked, payroll-integrated |
| Assets | Snipe-IT, AssetTiger | Linked to directory, onboarding/offboarding |

---

## 12. Pricing Strategy

| Plan | Per User/Month | Includes |
|---|---|---|
| **Starter** | $5 | HR, Attendance, Leave, Basic Projects, Chat (up to 25 users) |
| **Professional** | $15 | + Advanced Boards, Payroll, Invoicing, Video Calls, Wiki, Timesheets |
| **Enterprise** | $28 | + CRM, Recruitment, Analytics, Performance, DevOps, SSO, API, Integrations |
| **Self-Hosted** | One-time license | Full platform on your infrastructure; annual support contract |

---

## 13. Future AI Roadmap

### Phase 1 — Intelligent Automation (Current)
- AI daily digest summarizing anomalies across all modules
- Natural language project breakdown (describe project → get epics/stories/tasks)
- Smart estimation from historical velocity data
- Receipt OCR and resume parsing
- Duplicate issue detection

### Phase 2 — Predictive Intelligence (Next)
- **Attrition Prediction**: Analyze attendance patterns, leave trends, performance data to flag flight risks (local AI — privacy-safe)
- **Sprint Forecasting**: Predict sprint completion probability based on team velocity, holidays, leave data
- **Revenue Forecasting**: Weighted pipeline + historical close rates + seasonal patterns
- **Resource Optimization**: AI suggests optimal team composition for new projects based on skills, availability, and past performance
- **Smart Scheduling**: AI recommends meeting times based on team timezones, focus time preferences, and calendar density

### Phase 3 — Conversational Operations (Future)
- **Natural Language Everything**: "Show me developers with more than 5 late check-ins this month" → auto-query → results
- **Voice-Commanded Operations**: "Create a task for Rahul to fix the login bug, priority high, due Friday" via voice in chat
- **AI Standup Bot**: Auto-generates standup summary from yesterday's activity per team member
- **Intelligent Notifications**: AI prioritizes and batches notifications based on user behavior patterns
- **Auto-Documentation**: AI observes project activity and auto-updates wiki pages with architecture decisions, API changes, deployment notes

### Phase 4 — Autonomous Operations (Vision)
- **Self-Healing Projects**: AI detects scope creep, suggests timeline adjustments, and re-balances workloads
- **Automated Client Updates**: AI drafts weekly client progress reports from project data
- **Compliance Autopilot**: Continuous statutory compliance monitoring with auto-alerts for policy violations
- **Predictive Maintenance**: Forecast IT asset failures from maintenance logs and usage patterns
- **AI Onboarding Companion**: Personalized onboarding experience that adapts pace and content based on new hire's role and experience level

---

## 14. Security & Compliance

| Feature | Implementation |
|---|---|
| **Authentication** | JWT + OAuth 2.0 + SAML 2.0 + MFA (TOTP/SMS/Email) |
| **Encryption** | TLS 1.3 in transit; AES-256 at rest for sensitive fields |
| **Password Policy** | Min 8 chars, complexity rules, no reuse of last 5, configurable expiry |
| **Account Lockout** | 5 failed attempts → 30 min lock |
| **Session Management** | Concurrent session limits, device tracking, remote revocation |
| **Data Isolation** | Complete multi-tenant isolation via `organizationId` on every query |
| **Audit Trail** | Every create/update/delete logged with actor, timestamp, before/after |
| **GDPR Tools** | Data export per employee, right to deletion (anonymization), consent management |
| **Soft Delete** | All data soft-deleted with retention policies; hard delete (Super Admin only) |
| **Privacy AI** | Sensitive data (HR, payroll, performance) processed only on local AI (Qwen) — never sent externally |

---

## 15. Success Metrics

| Metric | 12-Month Target |
|---|---|
| Daily Active Users | > 60% of registered users |
| Tool Consolidation | Replace 4+ tools per customer |
| Time Saved | 15+ hours/month/manager |
| Onboarding Time | < 2 hours to productive |
| Chat Adoption | > 80% of team communication |
| Invoice Collection | 90% on-time |
| Sprint Velocity Accuracy | Within 15% of estimate |
| NPS Score | > 50 |
| Uptime | 99.9% |
| API Latency | p95 < 300ms |

---

## 16. Current Development Status

| Component | Status |
|---|---|
| Auth Service (OTP + OAuth + SAML + MFA) | ✅ Complete |
| API Gateway | ✅ Complete |
| HR Service (Employees, Departments, Designations, Teams) | ✅ Complete |
| Attendance Service (Clock in/out, Policies, Shifts, Alerts) | ✅ Complete |
| Leave Service (Apply, Approve, Balance, Policies) | ✅ Complete |
| Project Service (CRUD, Team, Milestones) | ✅ Complete |
| Task Service (CRUD, Time Logging, Comments, Timesheets) | ✅ Complete |
| Multi-Tenant Data Isolation | ✅ Complete |
| Onboarding Wizard (3-step + team invites) | ✅ Complete |
| Settings & Appearance (Theming, Dark Mode, Preferences) | ✅ Complete |
| Frontend (Dashboard, Directory, Attendance, Leaves, Projects, Tasks, Timesheets, Policies, Roles, Settings) | ✅ Complete |
| E2E Test Suite (133+ cases, 86% pass rate) | ✅ Complete |
| Board Service (Advanced Agile Boards) | 🔨 In Progress |
| Payroll Service | 📋 Scaffolded |
| Communication Hub | 📋 Planned |
| CRM & Invoicing | 📋 Planned |
| Recruitment & ATS | 📋 Planned |
| Knowledge Base & Wiki | 📋 Planned |
| Mobile Application | 📋 Planned |

---

## 17. Summary

**Nexora is not another SaaS tool. It's the operating system for IT companies.**

One login. One data layer. One bill. Every workflow — from hiring to delivery to invoicing — in a single platform that adapts to every role, runs AI that respects privacy, and costs a fraction of the fragmented alternative.

Built by an IT company, for IT companies.

---

*Document Version: 1.0 | March 26, 2026 | Nugen IT Services*
