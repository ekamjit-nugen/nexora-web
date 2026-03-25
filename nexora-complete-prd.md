# NEXORA — The Complete IT Operations Platform

## Product Requirements Document

**Version:** 1.0
**Last Updated:** March 18, 2026
**Author:** Nugen IT Services
**Status:** Living Document | Confidential
**Project Classification:** Major Product — Enterprise Grade

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack & Architecture](#2-technology-stack--architecture)
3. [Design System & UI/UX Specification](#3-design-system--uiux-specification)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Module 01 — Authentication & Onboarding](#5-module-01--authentication--onboarding)
6. [Module 02 — Executive Dashboard](#6-module-02--executive-dashboard)
7. [Module 03 — Employee Directory & Org Management](#7-module-03--employee-directory--org-management)
8. [Module 04 — Attendance & Shift Management](#8-module-04--attendance--shift-management)
9. [Module 05 — Leave Management](#9-module-05--leave-management)
10. [Module 06 — Payroll & Compensation](#10-module-06--payroll--compensation)
11. [Module 07 — Project Management](#11-module-07--project-management)
12. [Module 08 — Advanced Board Maker (Jira Replacement)](#12-module-08--advanced-board-maker-jira-replacement)
13. [Module 09 — Task Management](#13-module-09--task-management)
14. [Module 10 — Communication Hub (Chat, Voice & Video)](#14-module-10--communication-hub-chat-voice--video)
15. [Module 11 — Client Management & CRM](#15-module-11--client-management--crm)
16. [Module 12 — Invoicing & Billing](#16-module-12--invoicing--billing)
17. [Module 13 — Recruitment & ATS](#17-module-13--recruitment--ats)
18. [Module 14 — Knowledge Base & Wiki](#18-module-14--knowledge-base--wiki)
19. [Module 15 — IT Asset Management](#19-module-15--it-asset-management)
20. [Module 16 — Expense Management](#20-module-16--expense-management)
21. [Module 17 — Timesheets & Billing](#21-module-17--timesheets--billing)
22. [Module 18 — Performance Reviews & OKRs](#22-module-18--performance-reviews--okrs)
23. [Module 19 — DevOps Dashboard](#23-module-19--devops-dashboard)
24. [Module 20 — Reports & Analytics](#24-module-20--reports--analytics)
25. [Module 21 — Notifications & Reminders](#25-module-21--notifications--reminders)
26. [Module 22 — Email Templates & Document Generator](#26-module-22--email-templates--document-generator)
27. [Module 23 — Settings & Configuration](#27-module-23--settings--configuration)
28. [Module 24 — Integrations Hub](#28-module-24--integrations-hub)
29. [Module 25 — Mobile Application](#29-module-25--mobile-application)
30. [AI & Automation Strategy](#30-ai--automation-strategy)
31. [Security & Compliance](#31-security--compliance)
32. [Non-Functional Requirements](#32-non-functional-requirements)
33. [Infrastructure & Deployment](#33-infrastructure--deployment)
34. [Test Strategy & Testmo Test Cases](#34-test-strategy--testmo-test-cases)
35. [Implementation Roadmap](#35-implementation-roadmap)
36. [Competitive Positioning](#36-competitive-positioning)
37. [Success Metrics](#37-success-metrics)
38. [Appendix](#38-appendix)

---

## 1. Executive Summary

### 1.1 What is Nexora?

Nexora is a comprehensive, enterprise-grade IT operations platform built to be the single operating system for technology companies. It replaces 10+ fragmented SaaS tools — Jira, Slack, Microsoft Teams, BambooHR, QuickBooks, Confluence, Greenhouse, PagerDuty, HubSpot, and more — with one unified platform purpose-built for IT services, digital agencies, and engineering organizations.

### 1.2 Problem Statement

Growing IT companies operate across 8–15 disconnected SaaS tools for HR, communication, project management, invoicing, recruitment, and documentation. This fragmentation leads to:

- **Data silos** — employee data in BambooHR can't inform project staffing in Jira
- **Context switching** — developers lose 23 minutes per context switch (UCI research)
- **Duplicated effort** — time logged in one tool must be re-entered for invoicing in another
- **Security gaps** — offboarded employee still has access to 3 of 12 tools
- **Spiraling costs** — $150–300/employee/month across tool subscriptions
- **Lost institutional knowledge** — scattered across Slack threads, Confluence pages, and email chains

### 1.3 Vision

> "One platform. Every workflow. Every role. Every team."

Nexora consolidates core operational workflows into a single platform with unified identity, real-time communication, AI-powered automation, and pixel-perfect design — purpose-built for IT companies managing distributed teams, client projects, and complex billing.

### 1.4 Target Users

| Segment | Size | Key Pain Points |
|---|---|---|
| IT Services / Outsourcing | 20–500 employees | Client billing, resource allocation, multi-timezone teams, compliance |
| Digital Agencies | 10–200 employees | Project profitability, time tracking, creative workflows, client visibility |
| Startup Engineering Teams | 5–50 employees | Lightweight but complete ops, rapid onboarding, budget constraints |
| Managed Service Providers | 50–300 employees | SLA tracking, ticket management, workforce scheduling, incident response |
| Product Companies | 20–200 employees | Sprint management, release planning, developer experience, code integration |
| Consulting Firms | 10–100 employees | Bench management, skill matching, utilization tracking, proposal generation |

### 1.5 Core Principles

1. **Unified by Design** — Every module shares the same user identity, notification system, and data layer. No imports, no syncs, no duplicates.
2. **Role-Aware** — The platform adapts its interface and capabilities based on the user's role. A developer sees sprint boards; HR sees leave queues; accounts sees invoices.
3. **AI-Native** — AI isn't bolted on. Every module has intelligence built in — from smart task assignment to natural language analytics.
4. **Pixel-Perfect** — Enterprise software shouldn't look like enterprise software. Nexora is designed with the polish of a consumer product and the depth of an enterprise tool.
5. **Privacy-First** — Sensitive HR and payroll data never leaves the organization's infrastructure. Hybrid AI architecture with local LLMs for sensitive operations.

---

## 2. Technology Stack & Architecture

### 2.1 Core Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | Next.js (App Router) | 14.x | SSR, routing, API routes, middleware |
| | React | 18.x | UI components, hooks, context |
| | TypeScript | 5.x | Type safety across entire codebase |
| | Tailwind CSS | 3.4+ | Utility-first styling, design tokens |
| | Shadcn/ui | Latest | Accessible, composable component primitives |
| | Radix UI | Latest | Headless accessible primitives (underlying shadcn) |
| | Redux Toolkit | 2.x | Global state management (auth, preferences, cache) |
| | React Query (TanStack) | 5.x | Server state, caching, optimistic updates |
| | Framer Motion | 11.x | Animations, page transitions, micro-interactions |
| | Recharts | 2.x | Data visualization (charts, graphs) |
| | Tiptap | 2.x | Rich text editor (wiki, comments, descriptions) |
| | React DnD Kit | Latest | Drag-and-drop (kanban, dashboards, board columns) |
| **Backend** | Node.js | 20 LTS | Runtime for all microservices |
| **Microservices Framework** | NestJS | 10.x | Enterprise-grade, TypeScript-first microservices framework |
| | Express.js | 4.18+ | Lightweight HTTP framework for individual services |
| | Mongoose | 7.x | MongoDB ODM, schema validation, middleware |
| | Socket.IO | 4.x | Real-time WebSocket (chat, presence, notifications) |
| | BullMQ | 5.x | Job queues, cron, background workers (shared queue) |
| | Joi / Zod | Latest | Request validation schemas |
| | Passport.js | Latest | Authentication strategies (JWT, OAuth, SAML) |
| **Service Mesh** | Kong | Latest | API Gateway, rate limiting, authentication routing |
| | Consul | Latest | Service discovery, DNS resolution |
| **Database** | MongoDB | 7.x | Primary data store (replica set) |
| | Redis | 7.x | Cache, sessions, pub-sub, rate limiting, queues |
| | Elasticsearch | 8.x | Full-text search, log aggregation |
| **Media/VoIP** | WebRTC | — | Peer-to-peer voice/video |
| | LiveKit / Mediasoup | Latest | SFU for group calls (25+ participants) |
| | coturn | Latest | TURN/STUN server for NAT traversal |
| **Storage** | AWS S3 | — | Files, images, documents, recordings |
| | CloudFront | — | CDN for media delivery |
| **AI/LLM** | Anthropic Claude API | Sonnet | Cloud AI — project planning, analytics, document gen |
| | Ollama + Qwen 2.5 | 7B | Local AI — HR data, salary, sentiment (privacy) |
| | TensorFlow.js | Latest | Client-side ML (OCR, background blur) |
| **Email** | SendGrid | — | Transactional email (invoices, payslips, notifications) |
| | Nodemailer | — | SMTP fallback |
| **Notifications** | Firebase Cloud Messaging | — | Push notifications (web, iOS, Android) |
| | Expo Push | — | Mobile push notifications |
| **Infra** | Docker Compose | — | Local development, small deployments |
| | Kubernetes (EKS/AKS) | — | Production orchestration |
| | Nginx | — | Reverse proxy, TLS, rate limiting |
| | GitHub Actions | — | CI/CD pipelines |
| **Monitoring** | Prometheus + Grafana | — | Metrics, dashboards, alerting |
| | Sentry | — | Error tracking, performance monitoring |
| | ELK Stack | — | Centralized logging |
| **Testing** | Jest | 29.x | Unit tests |
| | React Testing Library | Latest | Component tests |
| | Playwright | Latest | E2E tests |
| | Supertest | Latest | API integration tests |
| | Testmo | — | Test case management, reporting |

### 2.2 Architecture Diagram — Microservices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                           │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐       │
│   │ Web App  │   │ iOS App  │   │ Android  │   │ Client Portal    │       │
│   │ (Next.js)│   │ (Expo)   │   │ (Expo)   │   │ (Next.js SSR)    │       │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────────┬─────────┘       │
└────────┼──────────────┼──────────────┼───────────────────┼─────────────────┘
         │              │              │                   │
         ▼              ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KONG API GATEWAY + SERVICE MESH (Consul)                 │
│            (TLS Termination, Auth Routing, Rate Limiting, Load Balancing)   │
└────────┬──────────────┬──────────────┬──────────────┬────────────┬──────────┘
         │              │              │              │            │
    ┌────▼────┐   ┌─────▼────┐   ┌────▼────┐   ┌────▼────┐  ┌────▼──────┐
    │ Auth    │   │ Socket.IO│   │ WebRTC  │   │ File    │  │ API       │
    │ Service │   │ Gateway  │   │ SFU     │   │ Service │  │ Gateway   │
    │ (Port   │   │ (Port    │   │ (Port   │   │ (Port   │  │ (Port     │
    │ 3001)   │   │ 3002)    │   │ 3003)   │   │ 3004)   │  │ 3005)     │
    └────┬────┘   └─────┬────┘   └────┬────┘   └────┬────┘  └────┬──────┘
         │              │              │              │            │
         ▼──────────────▼──────────────▼──────────────▼────────────▼
     ┌────────────────────────────────────────────────────────────────────┐
     │                   MICROSERVICES CLUSTER                            │
     │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
     │  │  HR        │  │  Project   │  │  Finance   │  │  CRM       │  │
     │  │  Service   │  │  Service   │  │  Service   │  │  Service   │  │
     │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
     │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
     │  │  Task      │  │  Document  │  │  Notif     │  │  AI        │  │
     │  │  Service   │  │  Service   │  │  Service   │  │  Service   │  │
     │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
     │  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
     │  │  Real-time │  │  Analytics │  │  Integration│                   │
     │  │  Service   │  │  Service   │  │  Service   │                   │
     │  └────────────┘  └────────────┘  └────────────┘                   │
     └────────────────────────────────────────────────────────────────────┘
             │                                │
     ┌───────▼────────────────────────────────▼──────────┐
     │              SHARED DATA LAYER                     │
     │  ┌──────────┐ ┌────────┐ ┌────────────┐ ┌──────┐  │
     │  │ MongoDB  │ │ Redis  │ │Elasticsearch│ │ S3   │  │
     │  │ Replica  │ │Cluster │ │ Cluster    │ │ CDN  │  │
     │  └──────────┘ └────────┘ └────────────┘ └──────┘  │
     └────────────────────────────────────────────────────┘
             │
     ┌───────▼────────────────────────────────────────┐
     │        DISTRIBUTED WORKERS & QUEUES            │
     │  ┌──────────────┐ ┌──────────────────────────┐ │
     │  │ BullMQ Queue │ │  Worker Instances       │ │
     │  │ (Redis-      │ │ - Email Worker          │ │
     │  │  backed)     │ │ - Payroll Worker        │ │
     │  │              │ │ - AI Worker (Ollama)    │ │
     │  │              │ │ - Sync Worker           │ │
     │  └──────────────┘ └──────────────────────────┘ │
     └──────────────────────────────────────────────────┘
```

### 2.3 Microservices Architecture Details

#### Service Inventory

| Service | Port | Purpose | Database | Key Responsibilities |
|---|---|---|---|---|
| **Auth Service** | 3001 | Authentication, SSO, OAuth | MongoDB (user collection) + Redis (sessions) | Login, MFA, token refresh, SSO, SAML |
| **HR Service** | 3010 | HR operations | MongoDB (employees, attendance, leaves) | Employee directory, org chart, leave management |
| **Attendance Service** | 3011 | Check-in/out, shifts | MongoDB (attendance, shifts) | Check-in/out, geofence, shift management |
| **Payroll Service** | 3012 | Salary processing | MongoDB (payroll, payslips) | Payroll runs, payslip generation, statutory |
| **Project Service** | 3020 | Project management | MongoDB (projects, milestones) | Project CRUD, resource allocation, templates |
| **Task Service** | 3021 | Task management | MongoDB (tasks, subtasks, time logs) | Task CRUD, comments, time logging, submissions |
| **Board Service** | 3022 | Kanban/Scrum boards | MongoDB (boards, sprints, issues) | Board operations, sprint planning, workflows |
| **CRM Service** | 3030 | Client management | MongoDB (clients, leads, deals) | Client CRUD, pipeline, proposals, portal |
| **Invoice Service** | 3031 | Invoicing & billing | MongoDB (invoices, line items) | Invoice generation, payment tracking, aging |
| **Expense Service** | 3032 | Expense management | MongoDB (expenses, receipts) | Submit expenses, OCR, approval, reimbursement |
| **Document Service** | 3040 | Wiki, knowledge base | MongoDB (documents, pages, comments) | Document CRUD, versioning, search, export |
| **Asset Service** | 3041 | IT asset management | MongoDB (assets, assignments) | Asset registry, tracking, QR codes, audit |
| **Recruitment Service** | 3050 | ATS & recruitment | MongoDB (candidates, applications, scores) | Job posts, applications, interviews, offers |
| **Notification Service** | 3060 | Notifications & reminders | MongoDB (notifications, preferences) + Redis | Multi-channel delivery, preferences, reminders |
| **Real-Time Service** | 3002 | WebSocket gateway | Redis | Chat, presence, live updates, subscriptions |
| **Analytics Service** | 3070 | Reports & analytics | Elasticsearch, MongoDB aggregation | Dashboards, KPIs, trends, custom reports |
| **AI Service** | 3080 | AI features | Vector DB, Claude API, Ollama | NLP, suggestions, automation, duplicate detection |
| **File Service** | 3004 | File upload/download | S3, MongoDB (metadata) | Upload, download, CDN delivery, virus scan |
| **Integration Service** | 3090 | Third-party integrations | MongoDB (webhooks, mappings) | GitHub, Slack, Calendar, Accounting webhooks |
| **API Gateway** | 3005 | Request routing | Kong config | Route requests, auth validation, rate limiting |

#### Inter-Service Communication

- **Synchronous**: HTTP REST (internal), gRPC (performance-critical)
- **Asynchronous**: Redis Pub/Sub, RabbitMQ, event streams
- **Service Discovery**: Consul (DNS-based service resolution)
- **Circuit Breaker**: Implemented at gateway level to prevent cascading failures
- **Shared Data Access**: Services read from shared MongoDB collections (immutable references); own-service mutations

### 2.3 Database Design Principles

- **Collection per module** with consistent naming: `users`, `attendance`, `leaves`, `tasks`, `projects`, `invoices`, etc.
- **Soft delete everywhere**: `isDeleted: Boolean`, `deletedAt: Date`, `deletedBy: ObjectId`
- **Audit fields on every document**: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`
- **Indexing strategy**: compound indexes on frequently queried fields; text indexes for search; TTL indexes for ephemeral data
- **Reference pattern**: ObjectId references for relationships; denormalize sparingly for read-heavy views (e.g., user name/avatar cached on task documents)
- **Schema versioning**: `schemaVersion` field on documents for forward-compatible migrations

### 2.4 API Design Standards

- RESTful with resource-based URLs: `GET /api/v1/projects/:id/tasks`
- Consistent response envelope: `{ success: boolean, data: T, message: string, pagination?: {...} }`
- Error format: `{ success: false, error: { code: string, message: string, details?: any } }`
- HTTP status codes: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Validation), 429 (Rate Limited), 500 (Server Error)
- Pagination: cursor-based for infinite scroll, offset-based for paginated tables
- Filtering: query params with operators `?status=active&priority=high&createdAt[gte]=2026-01-01`
- Sorting: `?sort=-createdAt,priority` (prefix `-` for descending)
- Field selection: `?fields=title,status,assignee`
- Rate limiting: 100 req/min (standard), 20 req/min (write-heavy), 5 req/min (AI endpoints)

---

## 3. Design System & UI/UX Specification

### 3.1 Design Philosophy

Nexora follows a **"Calm Enterprise"** design philosophy — professional, information-dense when needed, but never overwhelming. The interface should feel like a premium product that teams *want* to use, not one they're forced to use.

**Key Design Principles:**
1. **Clarity over decoration** — every pixel serves a purpose
2. **Consistent density** — compact for power users, comfortable for casual users (configurable)
3. **Progressive disclosure** — show summary first, reveal detail on demand
4. **Contextual actions** — right-click menus, hover actions, keyboard shortcuts
5. **Responsive by default** — desktop-first but fully functional on tablet and mobile
6. **Accessible** — WCAG 2.1 AA compliant, keyboard navigable, screen reader friendly

### 3.2 Color System

#### Primary Palette

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--primary-50` | `#EBF5FF` | `#0A1628` | Subtle backgrounds |
| `--primary-100` | `#D6EAFF` | `#0F2440` | Hover states |
| `--primary-200` | `#ADD5FF` | `#163560` | Active backgrounds |
| `--primary-500` | `#2E86C1` | `#5DADE2` | Primary brand color |
| `--primary-600` | `#2471A3` | `#85C1E9` | Primary hover |
| `--primary-700` | `#1A5276` | `#AED6F1` | Primary pressed |
| `--primary-900` | `#0B2F4A` | `#D6EAF8` | Headings, emphasis |

#### Neutral Palette

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--neutral-0` | `#FFFFFF` | `#0F1117` | Page background |
| `--neutral-50` | `#F8FAFC` | `#151822` | Card backgrounds |
| `--neutral-100` | `#F1F5F9` | `#1C2030` | Section backgrounds |
| `--neutral-200` | `#E2E8F0` | `#252A3A` | Borders, dividers |
| `--neutral-300` | `#CBD5E1` | `#334155` | Disabled states |
| `--neutral-500` | `#64748B` | `#94A3B8` | Secondary text |
| `--neutral-700` | `#334155` | `#CBD5E1` | Primary text |
| `--neutral-900` | `#0F172A` | `#F1F5F9` | Headings |

#### Semantic Colors

| Token | Color | Usage |
|---|---|---|
| `--success` | `#10B981` / `#059669` | Success states, approved, completed |
| `--warning` | `#F59E0B` / `#D97706` | Warning states, pending, attention |
| `--error` | `#EF4444` / `#DC2626` | Error states, rejected, overdue, critical |
| `--info` | `#3B82F6` / `#2563EB` | Information, links, help |

#### Role Accent Colors (for role badges and sidebar accents)

| Role | Color | Hex |
|---|---|---|
| Admin | Deep Purple | `#7C3AED` |
| HR | Teal | `#0D9488` |
| CTO / Tech Lead | Indigo | `#4F46E5` |
| Developer | Blue | `#2563EB` |
| Designer | Pink | `#EC4899` |
| Manager | Amber | `#D97706` |
| Sales | Green | `#059669` |
| Accounts | Orange | `#EA580C` |
| Employee | Slate | `#475569` |
| Client | Cyan | `#0891B2` |

### 3.3 Typography

| Element | Font | Weight | Size | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Display | Inter | 700 | 36px / 2.25rem | 1.2 | -0.02em |
| H1 | Inter | 700 | 30px / 1.875rem | 1.25 | -0.02em |
| H2 | Inter | 600 | 24px / 1.5rem | 1.3 | -0.01em |
| H3 | Inter | 600 | 20px / 1.25rem | 1.4 | -0.01em |
| H4 | Inter | 600 | 16px / 1rem | 1.4 | 0 |
| Body Large | Inter | 400 | 16px / 1rem | 1.6 | 0 |
| Body | Inter | 400 | 14px / 0.875rem | 1.5 | 0 |
| Body Small | Inter | 400 | 13px / 0.8125rem | 1.5 | 0 |
| Caption | Inter | 500 | 12px / 0.75rem | 1.4 | 0.02em |
| Overline | Inter | 600 | 11px / 0.6875rem | 1.4 | 0.08em |
| Code | JetBrains Mono | 400 | 13px / 0.8125rem | 1.6 | 0 |

### 3.4 Spacing & Grid

- **Base unit**: 4px
- **Spacing scale**: 0, 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px), 20 (80px), 24 (96px)
- **Page max-width**: 1440px (centered with auto margins)
- **Content max-width**: 1280px
- **Sidebar width**: 260px (expanded), 64px (collapsed)
- **Grid**: 12-column with 24px gutter
- **Card padding**: 16px (compact), 20px (default), 24px (comfortable)
- **Section spacing**: 32px between sections, 16px between related elements
- **Border radius**: 4px (inputs), 6px (cards), 8px (modals), 12px (panels), 9999px (pills)

### 3.5 Component Library

#### Core Components

| Component | Variants | States |
|---|---|---|
| Button | Primary, Secondary, Ghost, Danger, Success, Link, Icon-only | Default, Hover, Active, Disabled, Loading |
| Input | Text, Number, Password, Search, Textarea | Default, Focus, Error, Disabled, Read-only |
| Select | Single, Multi, Searchable, Creatable, Grouped | Default, Open, Filtered, Loading |
| Checkbox | Default, Indeterminate | Checked, Unchecked, Disabled |
| Radio | Default | Selected, Unselected, Disabled |
| Toggle | Default, With label | On, Off, Disabled |
| Avatar | Image, Initials, Icon | Sizes: xs(24), sm(32), md(40), lg(48), xl(64) |
| Badge | Status, Count, Role, Priority | Colors per semantic meaning |
| Tag | Default, Removable, Clickable | Normal, Hover, Selected |
| Tooltip | Default, Rich (with actions) | Positions: top, right, bottom, left |
| Popover | Default, With form, Confirmation | Triggered by click or hover |
| Modal | Small (400px), Medium (560px), Large (720px), Full | With/without footer, scrollable |
| Drawer | Right (default), Left | Sizes: sm(320px), md(480px), lg(640px), xl(800px) |
| Toast | Success, Error, Warning, Info | With/without action, auto-dismiss (5s) |
| Table | Default, Compact, Comfortable | Sortable, Selectable, Expandable, Sticky header |
| Tabs | Underline, Pill, Segmented | Default, Active, Disabled |
| Breadcrumb | Text, With icons | Collapsible for deep nesting |
| Pagination | Default, Compact, Load-more | Page numbers, cursor-based |
| Date Picker | Single, Range, Month, Year | With presets (Today, This Week, etc.) |
| Time Picker | 12h, 24h | With timezone display |
| File Upload | Drag-drop zone, Button, Avatar crop | Progress, Error, Success |
| Skeleton | Text, Avatar, Card, Table row | Animated shimmer |
| Empty State | Default, Search, Error, First-use | With illustration and CTA |
| Command Palette | Global search + actions | ⌘K / Ctrl+K trigger |

#### Layout Components

| Component | Description |
|---|---|
| AppShell | Main layout: sidebar + header + content area |
| Sidebar | Collapsible navigation with role-based menu items |
| Header | Global search, notifications bell, user menu, breadcrumbs |
| PageHeader | Title, description, action buttons, tabs |
| Card | Container with optional header, footer, padding variants |
| Split View | Master-detail layout (list on left, detail on right) |
| Kanban Board | Horizontal scrolling columns with drag-and-drop |
| Calendar View | Month/week/day views with event rendering |
| Timeline | Vertical activity feed with grouped entries |
| Stat Card | Metric value + label + trend indicator + sparkline |

### 3.6 Layout Specifications

#### Sidebar Navigation

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌────────┐                                                       │
│ │ NEXORA │  ← Logo (collapsed: icon only)                       │
│ │  logo  │                                                       │
│ └────────┘                                                       │
│                                                                  │
│ MAIN                                                             │
│ ├── 🏠 Dashboard                                                │
│ ├── 💬 Messages              (unread badge)                     │
│ ├── ✅ My Tasks              (count badge)                      │
│ ├── 📅 Calendar                                                 │
│                                                                  │
│ WORK                                                             │
│ ├── 📁 Projects                                                 │
│ │   ├── Project Alpha                                           │
│ │   ├── Project Beta                                            │
│ │   └── + New Project                                           │
│ ├── 📋 Boards                                                   │
│ ├── 📊 Timesheets                                               │
│                                                                  │
│ PEOPLE (HR, Admin)                                               │
│ ├── 👥 Directory                                                │
│ ├── 📋 Attendance                                               │
│ ├── 🏖️ Leaves                                                  │
│ ├── 🎯 Performance                                              │
│ ├── 📄 Recruitment                                              │
│                                                                  │
│ FINANCE (Accounts, Admin)                                        │
│ ├── 💰 Payroll                                                  │
│ ├── 🧾 Invoices                                                 │
│ ├── 💳 Expenses                                                 │
│ ├── 🏢 Clients                                                  │
│                                                                  │
│ KNOWLEDGE                                                        │
│ ├── 📚 Wiki                                                     │
│ ├── 🖥️ Assets                                                  │
│ ├── 🔧 DevOps                                                   │
│                                                                  │
│ ─────────────────                                                │
│ ├── ⚙️ Settings               (Admin only)                     │
│ ├── 📊 Reports                                                  │
│ └── 🔌 Integrations                                             │
│                                                                  │
│ ┌────────────────────┐                                          │
│ │ 👤 Varun Kumar     │  ← User card                            │
│ │    CTO • Online    │                                          │
│ └────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────┘
```

#### Page Layout Template

```
┌─────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Breadcrumb: Dashboard > Projects > Project Alpha         │
│         │                                                           │
│         │  ┌─────────────────────────────────────────────────────┐  │
│         │  │ Page Title              [+ New] [Filter] [Export]   │  │
│         │  │ Subtitle / description                              │  │
│         │  │ [Tab 1] [Tab 2] [Tab 3]                            │  │
│         │  └─────────────────────────────────────────────────────┘  │
│         │                                                           │
│         │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  ← Stat cards     │
│         │  │ Stat │ │ Stat │ │ Stat │ │ Stat │                    │
│         │  └──────┘ └──────┘ └──────┘ └──────┘                    │
│         │                                                           │
│         │  ┌─────────────────────────────────────────────────────┐  │
│         │  │                                                     │  │
│         │  │              Main Content Area                      │  │
│         │  │         (Table / Kanban / Form / etc.)              │  │
│         │  │                                                     │  │
│         │  └─────────────────────────────────────────────────────┘  │
│         │                                                           │
│         │  [Pagination: ← 1 2 3 4 5 ... 12 →]                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.7 Interaction Patterns

| Pattern | Implementation |
|---|---|
| **Page transitions** | Fade-in (150ms ease-out) on route change; skeleton loaders during data fetch |
| **Hover states** | Background shift (50ms), subtle scale on cards (1.01), opacity on icons |
| **Loading** | Skeleton shimmer for content areas; spinner for actions; progress bar for uploads |
| **Drag and drop** | Ghost preview with opacity 0.6; drop zone highlight with dashed border |
| **Infinite scroll** | Load 20 items initially; fetch next page at 80% scroll; spinner at bottom |
| **Optimistic updates** | Reflect changes immediately; rollback with toast on API error |
| **Keyboard shortcuts** | ⌘K (search), ⌘N (new), Esc (close), Enter (confirm), ⌘S (save) |
| **Right-click menus** | Context menus on table rows, kanban cards, file items |
| **Bulk actions** | Checkbox selection → floating action bar at bottom |
| **Empty states** | Illustration + message + CTA button for first-time use |
| **Error states** | Inline validation (red border + message below field); toast for API errors |
| **Success feedback** | Green toast (auto-dismiss 3s) with undo action where applicable |

### 3.8 Dark Mode Specification

- System preference auto-detection with manual override
- CSS custom properties switch entire palette simultaneously
- Shadows: reduce opacity by 50% in dark mode; use subtle border instead
- Images: no inversion; logos should have dark-mode variants
- Charts: adjusted color palette for dark backgrounds (lighter, more saturated)
- Transition: 200ms ease for theme switch

### 3.9 Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| `xs` | < 640px | Single column; bottom nav; full-width cards; drawer modals |
| `sm` | 640–767px | Single column; sidebar hidden; hamburger menu |
| `md` | 768–1023px | Sidebar collapsed (icons only); 2-column grids |
| `lg` | 1024–1279px | Sidebar expanded; 3-column grids; split views |
| `xl` | 1280–1535px | Full layout; 4-column stat cards; comfortable spacing |
| `2xl` | ≥ 1536px | Max-width container centered; extra whitespace |

### 3.10 Iconography

- **Icon library**: Lucide Icons (consistent, MIT-licensed, tree-shakeable)
- **Icon sizes**: 16px (inline), 20px (default), 24px (header), 32px (empty states)
- **Icon style**: Outline (1.5px stroke) for navigation; filled for active/selected states
- **Custom icons**: SVG format, 24×24 viewBox, 1.5px stroke, round line cap/join

### 3.11 Illustration Style

- **Style**: Flat with subtle gradients; geometric; brand colors + neutrals
- **Usage**: Empty states, onboarding, error pages, loading screens
- **Format**: SVG (scalable, theme-aware via CSS variables)
- **Consistency**: All illustrations use the same character style, proportion, and color palette

---

## 4. User Roles & Permissions

### 4.1 Role Definitions

| Role | Primary Persona | Dashboard View | Key Modules |
|---|---|---|---|
| **Super Admin** | Platform owner / CTO | Full system metrics | All modules + Settings + Tenant management |
| **Admin** | Operations head | Org-wide metrics | All modules + Settings |
| **HR Manager** | People operations | Headcount, attendance, leaves | Directory, Attendance, Leave, Payroll, Recruitment, Performance |
| **HR Executive** | Day-to-day HR | Pending approvals | Same as HR Manager with limited configuration |
| **CTO / VP Engineering** | Technical leadership | Project health, sprint velocity | Projects, Boards, Tasks, DevOps, Wiki, Performance |
| **Tech Lead** | Team leadership | Team sprint, code metrics | Projects, Boards, Tasks, Wiki, DevOps (team-scoped) |
| **Developer** | Individual contributor | My tasks, sprint board | Tasks, Boards, Wiki, Timesheet, Chat |
| **Designer** | Creative contributor | Design tasks, review queue | Tasks, Boards, Wiki, Timesheet, Chat |
| **QA Engineer** | Quality assurance | Bug board, test results | Tasks, Boards (Bug Tracker), Wiki, Timesheet |
| **Project Manager** | Delivery management | Project timeline, utilization | Projects, Tasks, Boards, Timesheets, Client Portal |
| **Sales Manager** | Business development | Pipeline, revenue forecast | CRM, Clients, Proposals, Invoices |
| **Sales Executive** | Lead generation | My leads, activities | CRM (own leads), Clients (read), Proposals |
| **Accounts Manager** | Finance head | Revenue, payroll, expenses | Payroll, Invoices, Expenses, Reports (financial) |
| **Accountant** | Day-to-day finance | Pending invoices, payroll queue | Invoices, Payroll, Expenses (limited config) |
| **Manager** | Team/dept manager | Team metrics | Team members' attendance, leaves, tasks, timesheets |
| **Employee** | General staff | Personal dashboard | Own profile, attendance, leaves, tasks, chat |
| **Intern** | Trainee | Limited personal view | Own attendance, assigned tasks, chat |
| **Client (External)** | Customer | Project progress | Client Portal (read-only projects, invoices, feedback) |
| **Contractor** | External contributor | Task-focused | Assigned tasks, timesheet, chat (limited) |

### 4.2 Permission Matrix

| Permission | Description | Granted To |
|---|---|---|
| `READ` | View and list data | All roles (scoped) |
| `WRITE` | Create and edit records | Role-dependent per module |
| `DELETE` | Soft-delete records | Admin, HR, Managers (scoped) |
| `HARD_DELETE` | Permanent removal | Super Admin only |
| `APPROVE` | Approve pending items | Managers, HR, Admin |
| `REJECT` | Reject with reason | Managers, HR, Admin |
| `FORCE_WRITE` | Override/admin actions | Admin, HR (attendance overrides) |
| `EXPORT` | Download/export data | Managers+, configurable |
| `CONFIGURE` | Module settings | Admin, HR (HR modules), CTO (dev modules) |
| `BULK_ACTION` | Bulk operations | Admin, HR, Accounts |
| `IMPERSONATE` | View as another user | Super Admin only (audit logged) |

### 4.3 Data Scope Rules

| Scope Level | Description | Example |
|---|---|---|
| `SELF` | Only own records | Employee sees own attendance |
| `TEAM` | Own + direct reportees | Manager sees team's leaves |
| `DEPARTMENT` | Entire department | HR Manager sees department payroll |
| `PROJECT` | Project members | PM sees all project task data |
| `ORGANIZATION` | All records | Admin sees everything |

---

## 5. Module 01 — Authentication & Onboarding

### 5.1 Features

#### Login & Authentication
- Email + password login with bcrypt hashing (12 rounds)
- OAuth 2.0: Google Workspace, Microsoft Entra ID
- SAML 2.0 SSO for enterprise (configurable IdP)
- Multi-Factor Authentication: TOTP (Google Authenticator), SMS OTP, Email OTP
- "Remember this device" with device fingerprinting (30-day trust)
- Brute-force protection: account lockout after 5 failed attempts (15-min cooldown)
- Password strength meter (zxcvbn library)
- Password policies: min 8 chars, complexity rules, no reuse of last 5 passwords, 90-day expiry (configurable)

#### Session Management
- JWT access tokens (15-min expiry) + refresh tokens (7-day expiry, rotated on use)
- Concurrent session limit: configurable (default 3 devices)
- Active sessions dashboard: device, browser, IP, location, last active
- Remote session revocation (logout from all devices)
- Token stored in httpOnly secure cookie (not localStorage)

#### Self-Service Onboarding Portal
- Invite-based: admin sends invite email → new hire sets password
- Step-by-step wizard:
  1. Set password + enable MFA
  2. Complete personal profile (photo, contact, emergency contact)
  3. Upload documents (Aadhar, PAN, certificates, etc.)
  4. Review and accept company policies
  5. Set notification preferences
  6. Introduction tour of the platform
- Progress tracker showing completion percentage
- Admin dashboard showing onboarding status per new hire

#### Offboarding
- Triggered by HR: marks employee as "offboarding"
- Automated checklist: asset return, access revocation, final settlement, exit interview
- Gradual access removal: immediate (critical systems) vs. grace period (email, docs)
- Exit interview form (optional, anonymous option)
- Final payslip generation and delivery
- Data retention per policy (anonymize after configurable period)

### 5.2 Data Model

```
User {
  _id: ObjectId
  email: String (unique, indexed, lowercase)
  password: String (bcrypt hash)
  firstName: String
  lastName: String
  displayName: String (computed: firstName + lastName)
  avatar: String (S3 URL)
  mobileNumber: String
  dateOfBirth: Date
  gender: Enum [male, female, non_binary, prefer_not_to_say]
  address: {
    street: String
    city: String
    state: String
    zip: String
    country: String
  }
  joiningDate: Date
  exitDate: Date (nullable)
  roleId: ObjectId → Role
  departmentId: ObjectId → Department
  reportingManagerId: ObjectId → User
  profileId: ObjectId → Designation
  employeeId: String (company employee ID, e.g., NX-001)
  employmentType: Enum [full_time, part_time, contract, intern]
  workLocation: Enum [office, remote, hybrid]
  timezone: String (IANA format)
  
  // Attendance config
  attendanceConfig: {
    shiftId: ObjectId → Shift
    paidLeaveCount: Number
    graceMinutes: Number
    wfhEnabled: Boolean
  }
  
  // Auth
  mfaEnabled: Boolean
  mfaSecret: String (encrypted)
  passwordChangedAt: Date
  failedLoginAttempts: Number
  lockUntil: Date
  
  // Devices & tokens
  devices: [{
    deviceId: String
    platform: Enum [web, ios, android]
    fcmToken: String
    lastActive: Date
  }]
  refreshTokens: [{ token: String, device: String, expiresAt: Date }]
  
  // Documents
  documents: {
    aadhar: String (S3 URL)
    pan: String (S3 URL)
    passport: String (S3 URL)
    marksheets: [String]
    degree: [String]
    experienceLetters: [String]
    medicalCert: String
    drivingLicense: String
    others: [{ name: String, url: String }]
  }
  documentVerification: [{
    type: String
    status: Enum [pending, approved, rejected]
    verifiedBy: ObjectId
    verifiedAt: Date
    rejectionReason: String
  }]
  
  // Skills & certifications
  skills: [{ name: String, proficiency: Enum [beginner, intermediate, advanced, expert] }]
  certifications: [{ name: String, issuer: String, issuedDate: Date, expiryDate: Date, url: String }]
  
  // Emergency
  emergencyContact: {
    name: String
    relationship: String
    phone: String
    email: String
  }
  
  // Status
  isActive: Boolean
  onboardingStatus: Enum [invited, in_progress, completed]
  onboardingProgress: Number (percentage)
  
  // Meta
  isDeleted: Boolean
  deletedAt: Date
  deletedBy: ObjectId
  createdBy: ObjectId
  updatedBy: ObjectId
  createdAt: Date
  updatedAt: Date
  schemaVersion: Number (default: 1)
}
```

### 5.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Email + password login | Public |
| POST | `/api/v1/auth/oauth/google` | Google OAuth callback | Public |
| POST | `/api/v1/auth/oauth/microsoft` | Microsoft OAuth callback | Public |
| POST | `/api/v1/auth/saml/callback` | SAML SSO callback | Public |
| POST | `/api/v1/auth/mfa/verify` | Verify MFA code | Partial auth |
| POST | `/api/v1/auth/refresh` | Refresh access token | Refresh token |
| POST | `/api/v1/auth/logout` | Logout current session | Authenticated |
| POST | `/api/v1/auth/logout-all` | Logout all sessions | Authenticated |
| POST | `/api/v1/auth/forgot-password` | Send password reset email | Public |
| POST | `/api/v1/auth/reset-password` | Reset password with token | Public (token) |
| PUT | `/api/v1/auth/change-password` | Change own password | Authenticated |
| GET | `/api/v1/auth/sessions` | List active sessions | Authenticated |
| DELETE | `/api/v1/auth/sessions/:id` | Revoke specific session | Authenticated |
| POST | `/api/v1/auth/invite` | Send onboarding invite | Admin, HR |
| GET | `/api/v1/onboarding/status` | Get onboarding progress | Authenticated |
| PUT | `/api/v1/onboarding/step/:step` | Complete onboarding step | Authenticated |

---

## 6. Module 02 — Executive Dashboard

### 6.1 Role-Based Dashboard Views

#### Admin / Super Admin Dashboard
- **Stat Cards**: Total employees (active/inactive), active projects, pending approvals (leaves + timesheets + expenses), revenue this month, outstanding invoices
- **Attendance Widget**: Live check-in count, late arrivals, on leave today, WFH today (with avatar list)
- **Task Overview**: Tasks by status (pie chart), overdue tasks count, tasks created vs completed this week (line chart)
- **Revenue Widget**: Monthly revenue trend (bar chart), top 5 clients by revenue, invoice aging summary
- **Team Utilization**: Heatmap of hours logged per team member vs capacity
- **AI Daily Digest**: Auto-generated summary of anomalies and action items
- **Quick Actions**: Approve pending leaves, review timesheets, send payslips, create announcement
- **Recent Activity Feed**: Last 20 platform-wide activities with actor, action, target

#### HR Dashboard
- **Stat Cards**: Headcount, new joiners this month, exits this month, pending document verifications, open positions
- **Attendance Summary**: Present, late, absent, on leave (with department breakdown)
- **Leave Calendar**: Team availability heatmap for next 2 weeks
- **Pending Queues**: Leaves to approve, manual entries to review, documents to verify
- **Recruitment Pipeline**: Active positions, candidates in pipeline, interviews this week
- **Onboarding Progress**: New hires with completion percentage
- **Birthday / Anniversary Widget**: Upcoming celebrations this week

#### Developer / Designer Dashboard
- **My Tasks Widget**: Assigned to me (grouped by status), overdue tasks highlighted
- **Sprint Progress**: Current sprint burndown, my story points completed vs total
- **Pull Request / Review Queue**: Linked PRs awaiting review (if Git integrated)
- **Attendance Status**: Today's check-in/out status with total hours
- **Upcoming Deadlines**: Tasks due this week with priority indicators
- **Recent Activity**: My recent task updates, comments, submissions
- **Quick Actions**: Log time, update task status, submit for review

#### Sales Dashboard
- **Pipeline Widget**: Leads by stage with total deal value per stage
- **Revenue Forecast**: Weighted pipeline value by expected close month
- **Activity Summary**: Calls, emails, meetings logged this week
- **Top Deals**: Highest value deals in Negotiation/Proposal stage
- **Win/Loss Ratio**: Monthly trend chart
- **Recent Leads**: Latest leads with status and next action

#### Accounts Dashboard
- **Stat Cards**: Revenue this month, outstanding invoices, overdue amount, payroll due date
- **Invoice Status**: Draft, sent, paid, overdue counts with amounts
- **Invoice Aging**: 30/60/90/120 day buckets with total amounts
- **Payroll Status**: Current month payroll progress (generated, reviewed, sent)
- **Expense Summary**: Pending approvals, reimbursed this month, by category (pie chart)
- **Cash Flow**: Monthly inflow vs outflow trend

### 6.2 Dashboard Configuration

- Drag-and-drop widget arrangement (saved per user)
- Widget resize: small (1/4), medium (1/2), large (full width)
- Widget visibility toggles (hide/show per preference)
- Date range selector applies globally to all widgets
- Auto-refresh interval: configurable (30s, 1m, 5m, manual)
- Full-screen mode for presentation/TV display

---

## 7. Module 03 — Employee Directory & Org Management

### 7.1 Features

#### Employee Directory
- **Global Search**: Instant search by name, email, employee ID, department, skill, location, role
- **Profile Cards**: Grid or list view; each card shows avatar, name, title, department, location, timezone, status (online/offline/on leave)
- **Advanced Filters**: Department, role, location, employment type, skills, joining date range, status
- **Org Chart**: Interactive hierarchical tree visualization with expand/collapse per node, search-to-zoom, manager chain highlighting
- **Department Browser**: Department list → team list → member list with headcount and budget
- **Skill Matrix**: Filterable matrix of employees × skills with proficiency level; useful for project staffing
- **Location Map**: World map with employee distribution pins; click to filter by location
- **Timezone View**: Table sorted by timezone with local time display; overlap hours highlighted
- **Quick Actions**: Click-to-message, click-to-call, assign-to-task, view-full-profile from any card

#### Department Management (Admin/HR)
- CRUD for departments: name, code, description, head (user), parent department, cost center, budget
- Team creation within departments: name, lead, members, description
- Cross-functional teams: virtual teams spanning multiple departments
- Headcount planning: budgeted positions vs filled vs open per department
- Department hierarchy visualization

#### Designation / Profile Management
- CRUD for designations: title, level (L1–L10), department, salary band range
- Career ladder visualization: IC track and management track
- Bulk assignment of designations

### 7.2 Data Models

```
Department {
  _id: ObjectId
  name: String
  code: String (unique, e.g., "ENG", "HR", "SALES")
  description: String
  headId: ObjectId → User
  parentDepartmentId: ObjectId → Department (nullable, for hierarchy)
  costCenter: String
  budget: { amount: Number, currency: String, period: Enum [monthly, quarterly, annual] }
  isActive: Boolean
  isDeleted: Boolean
  createdBy: ObjectId
  updatedBy: ObjectId
  createdAt: Date
  updatedAt: Date
}

Team {
  _id: ObjectId
  name: String
  description: String
  departmentId: ObjectId → Department
  leadId: ObjectId → User
  members: [ObjectId → User]
  isCrossFunctional: Boolean
  isActive: Boolean
  createdAt: Date
  updatedAt: Date
}

Designation {
  _id: ObjectId
  title: String
  level: Number (1-10)
  track: Enum [individual_contributor, management]
  departmentId: ObjectId → Department
  salaryBand: { min: Number, max: Number, currency: String }
  isActive: Boolean
  createdAt: Date
  updatedAt: Date
}
```

---

## 8. Module 04 — Attendance & Shift Management

### 8.1 Features

#### Employee-Facing
- **One-Tap Check-In/Out**: Large button on dashboard and mobile; captures timestamp, IP, GPS (optional), photo (configurable)
- **Today's Status Card**: Current state (not checked in / working / checked out), total hours today, check-in time, expected check-out
- **My Attendance History**: Calendar view with color-coded days (present, late, half-day, absent, holiday, leave, WFH); list view with filters by month/year and type
- **Manual Entry Request**: Submit with reason category (forgot, system_down, network_issue, power_outage, other) and free-text explanation; limited by policy (default 3/month)
- **Regularization Request**: Correct check-in/out times with reason → manager approval → HR confirmation
- **Overtime Log**: Auto-detected hours beyond shift; view accumulated OT for the month

#### Admin/HR-Facing
- **Live Dashboard**: Real-time grid of all employees with status (checked-in, not yet, on leave, WFH); filter by department, team, shift
- **All Attendance Records**: Searchable, filterable table with export; columns: employee, date, check-in, check-out, total hours, effective hours, status, entry type
- **Pending Manual Entries Queue**: Approve/reject with reason; batch actions
- **Pending Regularizations Queue**: Review corrections with before/after comparison
- **Force Log**: Admin can force check-in/out on behalf of any employee with mandatory reason; creates audit trail entry
- **Attendance Reports**: Department-wise summary, late arrivals trend, absenteeism rate, overtime analysis
- **Photo Verification Gallery**: View check-in/out photos; full-screen gallery viewer; flag suspicious entries

#### Shift Management
- **Shift Definitions**: Create shifts with name, start time, end time, grace minutes (late arrival), grace minutes (early departure), minimum working hours, break duration
- **Shift Assignment**: Assign shifts to employees individually or in bulk; effective date for changes
- **Shift Rotation**: Define rotation patterns (e.g., weekly rotation between morning/evening shifts)
- **Shift Swap**: Employee requests swap with colleague → both confirm → manager approves

#### Attendance Policies
- **Policy CRUD**: Name, effective dates, status (draft/active/archived)
- **Working Days**: Monday–Sunday toggles (default Mon–Fri)
- **Multiple Shifts**: Define multiple shifts per policy
- **Holiday Calendar**: Embedded in policy; date + name + optional/mandatory
- **Geofence Rules**: Office coordinates + radius; action on violation (block / warn / log only)
- **WiFi Validation**: Office SSID list; action on mismatch
- **Manual Entry Limits**: Configurable per month
- **Late Arrival Thresholds**: Minutes after grace → late marking
- **Half-Day Rules**: Auto-mark half-day if hours < threshold
- **Auto-Absent**: Mark absent if no check-in by configurable cutoff time
- **Comp-Off Rules**: OT hours threshold to earn comp-off leave credit

### 8.2 Data Model

```
Attendance {
  _id: ObjectId
  employeeId: ObjectId → User (indexed)
  date: Date (indexed)
  
  // Check-in/out
  checkInTime: Date
  checkOutTime: Date
  checkInPhoto: String (S3 URL)
  checkOutPhoto: String (S3 URL)
  checkInIP: String
  checkOutIP: String
  checkInLocation: { lat: Number, lng: Number, accuracy: Number }
  checkOutLocation: { lat: Number, lng: Number, accuracy: Number }
  checkInMethod: Enum [web, mobile, biometric, admin_force]
  checkOutMethod: Enum [web, mobile, biometric, admin_force, auto]
  
  // Calculated
  totalWorkingHours: Number
  effectiveWorkingHours: Number (excludes breaks)
  overtimeHours: Number
  status: Enum [present, late, half_day, absent, holiday, leave, wfh, comp_off]
  
  // Late tracking
  isLateArrival: Boolean
  lateByMinutes: Number
  isEarlyDeparture: Boolean
  earlyByMinutes: Number
  
  // Entry type
  entryType: Enum [system, manual, regularization, force]
  
  // Manual entry
  manualEntry: {
    isManual: Boolean
    reason: String
    reasonCategory: Enum [forgot, system_down, network_issue, power_outage, other]
    approvalStatus: Enum [pending, approved, rejected]
    approvedBy: ObjectId → User
    approvedAt: Date
    rejectionReason: String
  }
  
  // Regularization
  regularization: {
    originalCheckIn: Date
    originalCheckOut: Date
    correctedCheckIn: Date
    correctedCheckOut: Date
    reason: String
    approvalStatus: Enum [pending, manager_approved, hr_approved, rejected]
    managerApprovedBy: ObjectId
    hrApprovedBy: ObjectId
    rejectionReason: String
  }
  
  // Audit
  modificationHistory: [{
    modifiedBy: ObjectId → User
    modifiedAt: Date
    changes: Object (before/after diff)
    reason: String
  }]
  
  // Geofence
  geofenceStatus: Enum [within, outside, not_checked]
  wifiValidationStatus: Enum [valid, invalid, not_checked]
  
  // Policy reference
  policyId: ObjectId → AttendancePolicy
  shiftId: ObjectId → Shift
  
  isDeleted: Boolean
  createdAt: Date
  updatedAt: Date
}

AttendancePolicy {
  _id: ObjectId
  policyName: String
  effectiveFrom: Date
  effectiveTo: Date
  status: Enum [draft, active, archived]
  
  workingDays: {
    monday: Boolean, tuesday: Boolean, wednesday: Boolean,
    thursday: Boolean, friday: Boolean, saturday: Boolean, sunday: Boolean
  }
  
  shifts: [ObjectId → Shift]
  
  holidays: [{ date: Date, name: String, type: Enum [mandatory, optional] }]
  
  geofence: {
    enabled: Boolean
    offices: [{ name: String, lat: Number, lng: Number, radiusMeters: Number }]
    action: Enum [block, warn, log]
  }
  
  wifiValidation: {
    enabled: Boolean
    allowedSSIDs: [String]
    action: Enum [block, warn, log]
  }
  
  manualEntryLimit: Number (default: 3)
  lateArrivalThresholdMinutes: Number (default: 0, after grace)
  halfDayThresholdHours: Number (default: 4)
  autoAbsentCutoffTime: String (HH:mm format, e.g., "12:00")
  
  compOff: {
    enabled: Boolean
    minOvertimeHours: Number (default: 4)
    creditsPerDay: Number (default: 1)
  }
  
  photoRequired: { checkIn: Boolean, checkOut: Boolean }
  
  isDeleted: Boolean
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}

Shift {
  _id: ObjectId
  shiftName: String
  startTime: String (HH:mm)
  endTime: String (HH:mm)
  graceMinutesLateArrival: Number (default: 15)
  graceMinutesEarlyDeparture: Number (default: 15)
  minimumWorkingHours: Number (default: 8)
  breakDurationMinutes: Number (default: 60)
  isNightShift: Boolean
  isActive: Boolean
  createdAt: Date
  updatedAt: Date
}
```

---

## 9. Module 05 — Leave Management

### 9.1 Features

#### Employee-Facing
- **Apply for Leave**: Select type, date range, half-day option, reason; show remaining balance before submission
- **Leave Balance Dashboard**: Visual cards per leave type showing earned, used, available, carried-forward, encashed
- **Leave History**: Table with filters by type, status, date range; calendar view with leave days highlighted
- **Cancel Leave**: Cancel pending or approved future leaves with reason
- **Team Calendar**: See who's on leave in my team/department (heatmap view)

#### Manager-Facing
- **Pending Queue**: List of leave requests from direct reportees with type, dates, day count, reason
- **Conflict Check**: Visual indicator if approving would cause understaffing (shows who else is off those dates)
- **Approve/Reject**: With optional comment; bulk approve supported
- **Team Leave Calendar**: Department-wide availability view

#### HR/Admin-Facing
- **All Leaves View**: Organization-wide, filterable by employee, department, type, status, date range
- **Leave Policy Configuration**: Define leave types with accrual rules, carry-forward limits, encashment rates
- **Leave Balance Adjustments**: Manual credit/debit with reason and audit trail
- **Blackout Periods**: Define dates when leave requests are restricted
- **Leave Reports**: Department-wise utilization, type-wise trends, balance reports

#### Leave Types & Accrual Engine

| Leave Type | Default Allocation | Accrual | Carry-Forward | Encashable |
|---|---|---|---|---|
| Casual Leave | 12/year | Monthly (1/month) | Max 3 | No |
| Sick Leave | 12/year | Monthly (1/month) | Max 6 | No |
| Earned/Privilege Leave | 15/year | Monthly (1.25/month) | Max 30 | Yes |
| Work From Home | 24/year | Monthly (2/month) | 0 | No |
| Maternity Leave | 26 weeks | On request | N/A | No |
| Paternity Leave | 2 weeks | On request | N/A | No |
| Bereavement Leave | 5 days | On request | N/A | No |
| Comp-Off | Earned from OT | Per event | Max 5 | No |
| Loss of Pay (LOP) | Unlimited | N/A | N/A | N/A |

### 9.2 Data Model

```
Leave {
  _id: ObjectId
  employeeId: ObjectId → User
  leaveType: Enum [casual, sick, earned, wfh, maternity, paternity, bereavement, comp_off, lop]
  startDate: Date
  endDate: Date
  halfDay: { enabled: Boolean, date: Date, half: Enum [first_half, second_half] }
  totalDays: Number (calculated, excluding holidays and weekends)
  reason: String
  
  status: Enum [pending, approved, rejected, cancelled]
  approvedBy: ObjectId → User
  approvedAt: Date
  rejectionReason: String
  
  cancellation: {
    cancelledAt: Date
    cancelledBy: ObjectId
    reason: String
  }
  
  isDeleted: Boolean
  createdAt: Date
  updatedAt: Date
}

LeaveBalance {
  _id: ObjectId
  employeeId: ObjectId → User
  year: Number
  balances: [{
    leaveType: String
    opening: Number
    accrued: Number
    used: Number
    adjusted: Number
    carriedForward: Number
    encashed: Number
    available: Number (computed)
  }]
  updatedAt: Date
}

LeavePolicy {
  _id: ObjectId
  policyName: String
  leaveTypes: [{
    type: String
    annualAllocation: Number
    accrualFrequency: Enum [monthly, quarterly, annual, on_request]
    accrualAmount: Number
    maxCarryForward: Number
    encashable: Boolean
    encashmentRate: Number (percentage of daily salary)
    maxConsecutiveDays: Number
    requiresDocument: Boolean (e.g., medical cert for sick leave > 3 days)
    applicableTo: Enum [all, male, female]
    minServiceMonths: Number (eligibility after N months)
  }]
  blackoutPeriods: [{ startDate: Date, endDate: Date, reason: String }]
  status: Enum [draft, active, archived]
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

---

## 10. Module 06 — Payroll & Compensation

### 10.1 Features

#### Payroll Processing
- **Payroll Run Wizard**: Select month → auto-pull attendance/timesheet data → calculate → preview → approve → generate payslips → send
- **Preview Dashboard**: Before finalization, show per-employee breakdown with variance from last month highlighted
- **Earnings**: Basic salary, HRA, conveyance, special allowance, bonus, overtime pay, reimbursements, custom components
- **Deductions**: PF (employee + employer), ESI, Professional Tax, TDS, LOP deductions, loan EMIs, custom deductions
- **Statutory Compliance**: Auto-calculate PF (12% of basic), ESI (0.75%/3.25%), PT (state-wise slabs), TDS (slab-based)
- **Overtime Calculation**: Hours × rate per policy; configurable multipliers (1.5x, 2x for holidays)
- **Attendance-Based Deductions**: Auto-deduct for unauthorized absences, excessive late arrivals per policy rules
- **Salary Revision**: Propose → approve workflow with effective date; auto-adjust from next payroll run
- **Arrears Calculation**: Auto-compute arrears when revision is backdated

#### Payslip Management
- **Generate**: From approved timesheet + active policy; batch generation for all employees
- **Edit Draft**: Adjust line items before finalization
- **Finalize**: Lock payslip; no further edits
- **Send via Email**: Using configurable email template; batch send
- **Employee Self-Service**: View and download own payslips (PDF)
- **PDF Design**: Professional payslip with company logo, employee details, earnings table, deductions table, net pay, YTD summary

#### Payroll Policies
- **Policy CRUD**: Name, applicability (all / roles / specific employees), currency, pay frequency
- **Flexible Earnings**: Fixed amount or percentage of basic; multiple components
- **Rule-Based Deductions**: Triggered by conditions (late, absent, half-day, early departure, unapproved leave)
- **Tax Configuration**: TDS slabs, exemptions, declarations (Section 80C, 80D, HRA, LTA)
- **Reimbursement Types**: Medical, travel, meals, phone, internet (with limits and claim workflow)
- **Loan/Advance Tracking**: Disbursement, EMI schedule, auto-deduction from salary

#### Compensation Management
- **CTC Breakup Tool**: Define CTC → auto-distribute across components
- **Salary Benchmarking**: Compare employee salary against band for designation/level
- **Compensation History**: Timeline of salary changes per employee
- **Budget vs Actual**: Department-wise payroll budget tracking

### 10.2 Data Models

```
PayrollPolicy {
  _id: ObjectId
  policyName: String
  applicableTo: Enum [all, specific_roles, specific_employees, specific_departments]
  applicableIds: [ObjectId] (role/employee/department IDs if specific)
  currency: String (default: "INR")
  payFrequency: Enum [monthly, bi_weekly, weekly]
  
  earnings: [{
    name: String
    type: Enum [fixed, percentage]
    value: Number
    basedOn: String (if percentage, e.g., "basicSalary")
    taxable: Boolean
  }]
  
  deductions: [{
    name: String
    type: Enum [fixed, percentage, per_day, per_instance]
    value: Number
    appliesTo: Enum [all, late, absent, half_day, early_departure, unapproved_leave, lop]
    basedOn: String
    statutory: Boolean
  }]
  
  statutory: {
    pf: { enabled: Boolean, employeeRate: Number, employerRate: Number, ceiling: Number }
    esi: { enabled: Boolean, employeeRate: Number, employerRate: Number, ceiling: Number }
    professionalTax: { enabled: Boolean, state: String }
    tds: { enabled: Boolean }
  }
  
  overtime: {
    enabled: Boolean
    ratePerHour: Number
    weekdayMultiplier: Number (default: 1.5)
    holidayMultiplier: Number (default: 2.0)
  }
  
  reimbursements: [{
    name: String
    monthlyLimit: Number
    requiresReceipt: Boolean
    taxExempt: Boolean
  }]
  
  status: Enum [draft, active, archived]
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}

Payslip {
  _id: ObjectId
  employeeId: ObjectId → User
  timesheetId: ObjectId → Timesheet
  policyId: ObjectId → PayrollPolicy
  
  period: { month: Number, year: Number }
  periodStart: Date
  periodEnd: Date
  
  basicSalary: Number
  
  earnings: [{ name: String, amount: Number, taxable: Boolean }]
  totalEarnings: Number
  
  deductions: [{ name: String, amount: Number, reason: String, count: Number, statutory: Boolean }]
  totalDeductions: Number
  
  reimbursements: [{ name: String, amount: Number }]
  totalReimbursements: Number
  
  netPay: Number (earnings - deductions + reimbursements)
  
  statutory: {
    pfEmployee: Number
    pfEmployer: Number
    esiEmployee: Number
    esiEmployer: Number
    professionalTax: Number
    tds: Number
  }
  
  ytd: {
    totalEarnings: Number
    totalDeductions: Number
    totalTax: Number
    netPay: Number
  }
  
  currency: String
  status: Enum [draft, finalized, sent]
  
  emailSent: Boolean
  emailSentAt: Date
  
  pdfUrl: String (S3)
  
  isDeleted: Boolean
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

---

## 11. Module 07 — Project Management

### 11.1 Features

#### Project CRUD
- **Create Project**: Name, description, category, client (optional), start/end dates, budget, billing type (fixed/T&M/retainer)
- **Project Card View**: Grid of cards showing name, category, client, progress bar, team avatars, start date, budget utilization
- **Project Detail Page**: Overview tab, Tasks tab, Board tab, Timesheets tab, Files tab, Settings tab

#### Team & Resource Management
- **Assign Members**: Add users with roles (project admin, manager, member, viewer)
- **Resource Allocation**: Per-member allocation percentage (e.g., 50% on Project A, 50% on Project B)
- **Utilization Dashboard**: Bar chart per team member showing allocated vs logged hours
- **Bench Management**: Identify unallocated team members available for new projects

#### Project Templates
- **Pre-built Templates**: Web Application, Mobile App, API Development, Cloud Migration, Staff Augmentation, DevOps Setup
- **Custom Templates**: Save any project structure as a template; includes default tasks, milestones, and board configuration
- **Quick Start**: Create project from template → auto-populate tasks and board

#### Project Health & Tracking
- **Health Score**: Auto-calculated from overdue tasks %, blocked items, burn rate vs budget, milestone completion
- **Milestones**: Define key milestones with target dates; track completion
- **Progress Bar**: Calculated from task completion percentage (weighted by story points if available)
- **Budget Tracking**: Budget vs actual spend; burn rate projection
- **Risk Register**: Log project risks with probability, impact, mitigation plan, owner

#### Client Visibility
- **Client Portal Link**: Generate secure shareable link for client
- **Client Dashboard**: Milestone progress, recent updates, shared deliverables
- **Feedback Loop**: Client can comment on deliverables, approve/request changes

### 11.2 Data Model

```
Project {
  _id: ObjectId
  projectName: String
  description: String
  category: String
  clientId: ObjectId → Client (nullable)
  
  startDate: Date
  endDate: Date
  status: Enum [planning, active, on_hold, completed, cancelled]
  
  budget: {
    amount: Number
    currency: String
    billingType: Enum [fixed, time_and_material, retainer, internal]
    hourlyRate: Number (for T&M)
    retainerAmount: Number (for retainer)
  }
  
  team: [{
    userId: ObjectId → User
    role: Enum [admin, manager, member, viewer]
    allocationPercentage: Number (0-100)
    assignedAt: Date
    removedAt: Date
  }]
  
  milestones: [{
    _id: ObjectId
    name: String
    targetDate: Date
    completedDate: Date
    status: Enum [pending, in_progress, completed, missed]
  }]
  
  risks: [{
    _id: ObjectId
    description: String
    probability: Enum [low, medium, high]
    impact: Enum [low, medium, high]
    mitigation: String
    ownerId: ObjectId → User
    status: Enum [open, mitigated, occurred, closed]
  }]
  
  healthScore: Number (0-100, auto-calculated)
  progressPercentage: Number (from tasks)
  
  settings: {
    boardType: Enum [scrum, kanban, custom]
    defaultBoardId: ObjectId → Board
    clientPortalEnabled: Boolean
    clientPortalToken: String
  }
  
  templateId: ObjectId → ProjectTemplate
  
  isDeleted: Boolean
  createdBy: ObjectId
  updatedBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

---

## 12. Module 08 — Advanced Board Maker (Jira Replacement)

### 12.1 Board Types

| Board Type | Key Features | Default Columns |
|---|---|---|
| **Scrum Board** | Sprint planning, backlog, velocity, burndown | Backlog → To Do → In Progress → In Review → Done |
| **Kanban Board** | WIP limits, cycle time, continuous flow | To Do → In Progress → In Review → Done |
| **Bug Tracker** | Severity matrix, reproduction steps, environment | New → Triaged → In Progress → Fixed → Verified → Closed |
| **Roadmap Board** | Timeline view, epics, milestones, dependencies | Planning → In Design → Development → Testing → Released |
| **Custom Board** | User-defined everything | User-defined columns and transitions |

### 12.2 Issue System

#### Issue Types
- **Epic**: Large body of work spanning multiple sprints; contains stories
- **Story**: User-facing feature or requirement; belongs to an epic
- **Task**: Technical or operational work item; standalone or under a story
- **Sub-Task**: Breakdown of a task; must have a parent task/story
- **Bug**: Defect report with severity, reproduction steps, environment, expected vs actual behavior
- **Improvement**: Enhancement to existing functionality
- **Spike**: Research or investigation task with time-box

#### Issue Fields

| Field | Type | Description |
|---|---|---|
| Title | String | Concise summary (required) |
| Description | Rich Text (Tiptap) | Detailed description with formatting, images, code blocks |
| Type | Enum | Epic, Story, Task, Sub-task, Bug, Improvement, Spike |
| Status | Enum | Board-column-mapped (customizable per board) |
| Priority | Enum | Critical, High, Medium, Low, Trivial |
| Severity (Bugs) | Enum | Blocker, Critical, Major, Minor, Cosmetic |
| Assignee | User(s) | One or more assigned users |
| Reporter | User | Creator of the issue |
| Sprint | Sprint | Current sprint assignment |
| Epic | Issue | Parent epic (for stories) |
| Parent | Issue | Parent issue (for sub-tasks) |
| Story Points | Number | Fibonacci: 1, 2, 3, 5, 8, 13, 21 |
| Original Estimate | Duration | Estimated time (hours:minutes) |
| Time Logged | Duration | Actual time spent (aggregated from time entries) |
| Remaining Estimate | Duration | Auto-calculated or manual |
| Labels | Tags | Color-coded labels (frontend, backend, infra, urgent, tech-debt) |
| Due Date | Date | Deadline |
| Environment (Bugs) | Enum | Development, Staging, Production |
| Browser/OS (Bugs) | String | Reproduction environment details |
| Steps to Reproduce | Rich Text | Bug reproduction steps |
| Expected/Actual Result | Rich Text | Bug behavior description |
| Linked Issues | Relations | Blocks, Is blocked by, Duplicates, Relates to, Is child of |
| Watchers | Users | Subscribed to updates |
| Attachments | Files | Screenshots, documents, logs |
| Custom Fields | Dynamic | Org-defined: dropdown, text, number, date, user-picker |

### 12.3 Sprint Management

- **Sprint Creation**: Name, goal, start date, end date, team capacity (story points)
- **Backlog**: Ordered list of all unassigned issues; drag into sprints
- **Sprint Board**: Visual kanban of sprint issues with status columns
- **Sprint Planning Meeting View**: Backlog on left, sprint on right; drag to assign; capacity indicator
- **Burndown Chart**: Ideal line vs actual story points remaining
- **Velocity Chart**: Completed story points per sprint (last 6 sprints average)
- **Sprint Retrospective Board**: Three columns — What went well / What didn't / Action items
- **Sprint Report**: Auto-generated summary with completed, incomplete, added mid-sprint, removed
- **Sprint Close**: Auto-move incomplete issues to backlog or next sprint (user choice)

### 12.4 Workflow Engine

- **Custom Statuses**: Define any number of statuses per board (not limited to columns)
- **Transition Rules**: Define which status can move to which (directed graph)
- **Transition Conditions**: Status change only allowed if: required fields are filled, assignee exists, reviewer assigned, time logged ≥ estimate
- **Transition Actions**: On status change: auto-assign reviewer, send notification, update custom field, trigger webhook, add comment
- **Approval Gates**: Certain transitions require designated approver (e.g., Done → Released requires PM approval)

### 12.5 Automation Rules

- **Rule Format**: WHEN [trigger] IF [condition] THEN [action]
- **Triggers**: Issue created, status changed, assignee changed, priority changed, comment added, due date approaching, sprint started/ended
- **Conditions**: Priority equals, assignee is empty, label contains, time since creation > N hours, story points > N
- **Actions**: Change status, assign user, add label, send notification, add comment, create sub-task, trigger webhook, escalate to manager
- **Pre-built Rules**: Auto-assign on creation, notify on overdue, escalate critical unassigned bugs, auto-close stale issues

### 12.6 Reporting

| Report | Description |
|---|---|
| Burndown | Story points remaining vs ideal line per sprint |
| Velocity | Completed points per sprint with running average |
| Cumulative Flow | Stacked area chart of issues per status over time |
| Cycle Time | Distribution of time from In Progress to Done |
| Lead Time | Distribution of time from Created to Done |
| Issue Age | How long issues have been in current status |
| Created vs Resolved | Inflow vs outflow trend |
| Resolution Time by Priority | Average resolution time grouped by priority |
| Workload Balance | Issues assigned per team member (effort-weighted) |
| Sprint Comparison | Side-by-side comparison of sprint metrics |

### 12.7 AI Features

- **AI Project Breakdown**: Describe project in natural language → auto-generate epics, stories, tasks with estimates
- **Smart Estimation**: Suggest story points based on similar historical issues (title + description similarity)
- **Duplicate Detection**: On issue creation, surface potentially duplicate issues
- **Auto-Assign**: Suggest best assignee based on current workload, skill tags, past performance on similar issues
- **Sprint Planning AI**: Recommend backlog items for next sprint based on velocity + priority + dependencies
- **Daily Standup Summary**: Auto-generate standup report from yesterday's issue activity per team member
- **Risk Detection**: Flag sprints at risk based on burn rate, scope creep (mid-sprint additions), blocked items

---

## 13. Module 09 — Task Management

### 13.1 Features

#### Views
- **List View**: Tabular with columns: title, assignee, status, priority, due date, project, story points
  - Tabs: "Assigned To Me" / "Assigned By Me" / "All Tasks" (manager+)
  - Filters: status, priority, project, date range, assignee
  - Bulk actions: change status, reassign, change priority
- **Kanban Board**: Drag-and-drop columns per status
- **Calendar View**: Tasks plotted on calendar by due date
- **Gantt View**: Timeline bars with dependencies (arrows)
- **Table View**: Spreadsheet-like with inline editing

#### Task Operations
- **Create Task**: Title, description (rich text), assignee(s), project, priority, due date, story points, labels, checklist, attachments
- **Quick Create**: Inline creation from kanban column or list (title only → expand to edit)
- **Sub-Tasks**: Nested tasks under parent with progress tracking
- **Checklists**: Simple checkbox lists within a task (e.g., "Definition of Done")
- **Time Logging**: Log time entries against tasks with description and billable flag
- **Task Comments**: Threaded comments with @mentions, reactions, file attachments
- **Activity Log**: Full history of all changes (status, assignee, priority, edits) with diffs
- **Task Submission**: Submit completed work with notes + screenshots for review
- **Review Workflow**: Reviewer approves or rejects with feedback; rejected → back to In Progress
- **Recurring Tasks**: Auto-create from template on schedule (daily, weekly, monthly)
- **Task Templates**: Pre-defined task structures for common work items
- **Bulk Import**: Import tasks from CSV/Excel

#### Dependencies
- **Link Types**: Blocks, Is Blocked By, Relates To, Duplicates, Is Parent Of
- **Dependency Visualization**: Arrows on Gantt view; warning icon when blocked
- **Circular Dependency Detection**: Prevent creating circular dependency chains

---

## 14. Module 10 — Communication Hub (Chat, Voice & Video)

### 14.1 Messaging

#### Channels & DMs
- **Direct Messages**: 1:1 encrypted chat; message history persisted
- **Group DMs**: Up to 8 participants without creating a formal channel
- **Public Channels**: Open to all org members; indexed in search
- **Private Channels**: Invite-only; admin-managed membership
- **Project Channels**: Auto-created per project with project members; linked to project context
- **Announcement Channel**: Admin/HR-only posting; all employees subscribed (read-only for others)

#### Message Features
- Rich text formatting: bold, italic, strikethrough, code inline, code blocks (with syntax highlighting), blockquotes, lists
- File sharing: drag-drop or paste; preview for images, PDFs; download for others
- Reactions: emoji reactions on messages
- Threading: reply to a specific message in a thread (keeps main channel clean)
- @Mentions: @user, @channel, @here (only online), @role (e.g., @developers)
- Pinned messages: pin important messages to channel header
- Bookmarks: save messages for personal reference
- Message editing: edit within 15 minutes; show "(edited)" indicator
- Message deletion: delete own messages; shows "This message was deleted" placeholder
- Link previews: auto-unfurl URLs with Open Graph metadata, image preview
- Voice messages: record and send audio clips (mobile-first)
- Polls: create quick polls within channels

#### Search
- Full-text search across all messages with filters: channel, sender, date range, has:file, has:link
- Elasticsearch-powered for speed
- Jump-to-message from search results

#### Presence & Status
- Online, Away (auto after 5 min idle), DND (mute notifications), Offline
- Custom status text with optional emoji and expiry time
- Calendar-synced status: auto-set "In a meeting" during calendar events

### 14.2 Voice & Video Calls

| Feature | Description |
|---|---|
| 1:1 Voice Call | WebRTC P2P; initiate from DM or directory card |
| 1:1 Video Call | HD video; camera/mic toggle; picture-in-picture mode |
| Group Call (Audio) | Up to 50 participants via SFU |
| Group Call (Video) | Up to 25 participants; grid layout; speaker spotlight |
| Screen Sharing | Share screen, window, or Chrome tab with audio |
| Call Recording | Record with consent banner; stored in S3; playback in channel |
| Virtual Background | Blur or image replacement (TensorFlow.js client-side) |
| Meeting Schedule | Schedule with title, time, invitees → generates meeting link + calendar invite |
| Meeting Rooms | Persistent rooms for recurring standups (join anytime) |
| Call Lobby | Waiting room for external/client participants |
| Breakout Rooms | Split large meeting into smaller groups; timer to reconvene |
| In-Call Chat | Side panel for text during active call |
| Raise Hand | Queue-based speaking order |
| Call Quality | Real-time bitrate, latency, packet loss indicators |
| Noise Cancellation | AI-powered background noise suppression |
| Live Captions | Real-time speech-to-text (AI-powered, English initially) |

### 14.3 Bots & Integrations
- **Nexora Bot**: AI assistant in chat — answer questions from wiki, create tasks from messages ("@nexora create task: Fix login bug on staging"), summarize channel activity
- **Webhook Bots**: Incoming webhooks for CI/CD notifications, monitoring alerts, calendar events
- **Custom Bots**: API for building custom bots with message sending, command handling, interactive messages

---

## 15. Module 11 — Client Management & CRM

### 15.1 Client Management

- **Client CRUD**: Company name, contact person(s), email, phone, address, GSTIN, PAN, currency, notes
- **Multi-Contact**: Multiple contact persons per client with roles (primary, billing, technical)
- **Communication History**: Timeline of all emails, calls, meetings, notes with a client
- **Client Categories**: Tags for industry, size, relationship tier (strategic, standard, new)
- **Associated Entities**: Linked projects, invoices, proposals, contracts per client

### 15.2 CRM Pipeline

- **Lead Pipeline**: Kanban board: New Lead → Contacted → Qualified → Proposal Sent → Negotiation → Won / Lost
- **Lead Source Tracking**: Website, referral, cold outreach, event, LinkedIn, other
- **Deal Tracking**: Deal value, currency, probability, expected close date, assigned salesperson
- **Activity Logging**: Log calls, emails, meetings, notes against leads; auto-log from integrated email
- **Proposal Builder**: Create proposals from templates with scope, timeline, team, pricing; export as PDF
- **Follow-Up Reminders**: Scheduled reminders for next action on each lead
- **Revenue Forecasting**: Weighted pipeline (deal value × probability) by expected close month
- **Win/Loss Analysis**: Tag reasons for outcomes; view aggregated trends
- **Sales Reports**: Pipeline value by stage, conversion rates, salesperson performance, lead source effectiveness

### 15.3 Client Portal
- Secure external login (invite-based, separate from internal auth)
- Project progress dashboard with milestones
- Invoice viewing and payment status
- Deliverable review with approve/request-changes workflow
- Shared file repository
- Dedicated communication channel (optional)
- SLA dashboard for managed services
- White-label: client's logo and color scheme

---

## 16. Module 12 — Invoicing & Billing

### 16.1 Features

- **Create Invoice**: Select client, add line items (description, quantity, rate, amount), apply taxes, apply discount
- **Invoice Numbering**: Auto-generated sequential (configurable prefix, e.g., NX-INV-2026-001)
- **Client Snapshot**: Freeze client details at invoice creation (immutable on invoice)
- **Tax Engine**: GST (CGST, SGST, IGST), VAT, custom tax types with configurable rates
- **Discounts**: Flat amount or percentage; per-line-item or invoice-level
- **Auto-Calculate**: Subtotal, tax, discount, total, amount paid, balance due
- **Currency Support**: INR, USD, EUR, GBP, AUD, CAD, SGD (with exchange rate)
- **Recurring Invoices**: Auto-generate on schedule (monthly, quarterly, custom); auto-send option
- **Time-Based Billing**: Generate invoice from billable time logged on project
- **Proforma Invoice**: Pre-invoice for client approval before formal invoicing
- **Credit Notes**: Issue credit against existing invoices
- **Payment Tracking**: Record partial/full payments; auto-update balance due; payment history
- **Payment Reminders**: Auto-email reminders on overdue invoices (configurable intervals)
- **Invoice Status Flow**: Draft → Sent → Partially Paid → Paid / Overdue / Cancelled
- **Send via Email**: Configurable template; PDF attachment; track delivery
- **E-Invoicing**: GST e-invoice generation with IRN (India)
- **Invoice PDF**: Professional template with company logo, address, bank details, terms; customizable
- **Invoice Aging Report**: 30/60/90/120+ day buckets with amounts and client breakdown
- **Revenue Reports**: By client, project, month, currency; MRR/ARR tracking

---

## 17. Module 13 — Recruitment & ATS

### 17.1 Features

| Feature | Description |
|---|---|
| Job Postings | Create positions: title, department, description, requirements, salary range, employment type, location |
| Career Page Widget | Embeddable job listings for company website |
| Application Form | Configurable per position; auto-collect resume, cover letter, custom fields |
| Candidate Pipeline | Kanban: Applied → Screening → Phone Screen → Technical Interview → Cultural Fit → Assessment → Offer → Hired / Rejected |
| Resume Parsing (AI) | Extract name, email, phone, skills, experience, education from uploaded resume |
| Candidate Profile | Consolidated view: resume, parsed data, interview scores, notes, communication history |
| Interview Scheduling | Select interviewers + candidate availability → auto-find slots → send calendar invites |
| Scorecard System | Configurable evaluation criteria per stage; 1–5 rating per criterion; weighted total |
| Interview Feedback | Interviewer submits structured feedback; visible to hiring team |
| Offer Management | Generate offer letter from template → candidate reviews → accepts/negotiates/declines |
| Onboarding Handoff | On acceptance: auto-create User record → trigger onboarding workflow → assign equipment request |
| Referral Program | Employees refer candidates → track status → reward on successful hire |
| Candidate Communication | Email templates for each stage (application received, interview invite, rejection, offer) |
| Rejection Reasons | Mandatory tagging on rejection for analytics |
| Analytics | Time-to-hire, cost-per-hire, source effectiveness, stage conversion rates, interviewer load |
| Talent Pool | Maintain database of past candidates for future openings; tag with skills |

---

## 18. Module 14 — Knowledge Base & Wiki

### 18.1 Features

- **Spaces**: Top-level containers (e.g., Engineering, HR Policies, Client Docs, Product, Onboarding)
- **Pages**: Rich-text documents with unlimited nesting (parent → child → grandchild)
- **Rich Content Editor** (Tiptap):
  - Headings (H1–H6), paragraphs, bold, italic, strikethrough, underline
  - Ordered/unordered lists, checklists
  - Code blocks with syntax highlighting (50+ languages)
  - Tables with resize and formatting
  - Images (upload/paste/URL), videos (embed), file attachments
  - Mermaid diagrams (flowcharts, sequence, class, Gantt)
  - Callout blocks (info, warning, tip, danger)
  - Dividers, blockquotes
  - @mentions of users (notifies them)
  - Slash commands for quick insertion
- **Page Templates**: Meeting notes, Decision log, Architecture doc, Runbook, RFC, Sprint retro, Onboarding checklist
- **Version History**: Full revision history with visual diff (added/removed highlighting); restore any version
- **Comments**: Inline comments on selected text; page-level discussion threads; resolve/unresolve
- **Permissions**: Space-level (view, edit, admin) and page-level overrides
- **Search**: Full-text with Elasticsearch; filters by space, author, date, tags
- **Cross-Linking**: `[[Page Name]]` syntax for linking between pages; auto-backlinks section
- **Tags**: Tag pages for cross-cutting categorization
- **Favorites**: Star pages for quick access
- **Recently Viewed**: Track and display recently visited pages
- **Export**: PDF, Markdown, HTML per page or per space
- **Import**: From Markdown, Confluence (XML), Notion (ZIP)
- **AI Features**: Semantic search (ask a question, get answer from wiki), auto-summarize long pages, suggest related pages

---

## 19. Module 15 — IT Asset Management

### 19.1 Features

- **Asset Registry**: Catalog all company assets with: name, type (laptop, monitor, phone, server, peripheral, software), serial number, purchase date, vendor, cost, warranty expiry, condition
- **Assignment Tracking**: Assign to employee → record issue date, condition at issue; on return → record condition, damage notes
- **Software Licenses**: Track license keys, license type (per-seat, per-device, enterprise), total seats, used seats, renewal date, annual cost
- **QR Code Generation**: Generate QR codes for each asset; print for physical tagging; scan to view details
- **Procurement Workflow**: Employee requests → manager approves → procurement processes → admin confirms receipt → assigns to requester
- **Maintenance Log**: Schedule and track maintenance/repair events with vendor, cost, downtime
- **Depreciation**: Auto-calculate depreciation (straight-line, declining balance) for accounting
- **Disposal Workflow**: End-of-life: data wipe confirmation → recycling/disposal → write-off from books
- **Asset Audit**: Periodic audit checklist; mark verified/missing per asset
- **Reports**: Asset utilization, aging analysis, upcoming warranty expirations, cost by department, license compliance
- **Alerts**: Warranty expiry (30-day advance), license renewal, asset unassigned for > N days

---

## 20. Module 16 — Expense Management

### 20.1 Features

- **Expense Submission**: Category, amount, currency, date, merchant, description, receipt (photo/PDF), project linkage
- **Receipt OCR (AI)**: Auto-extract merchant, amount, date, currency from receipt image
- **Expense Categories**: Configurable: travel, meals, accommodation, software, equipment, training, client entertainment, office supplies, communication, other
- **Policy Engine**: Per-category spending limits (per-transaction and per-month); auto-flag violations
- **Approval Workflow**: Employee → Manager → Finance; configurable chain; bulk approve
- **Mileage Claims**: Start/end location → auto-calculate distance → apply per-km rate
- **Per Diem**: Auto-calculate daily allowance for business travel based on destination
- **Corporate Card Reconciliation**: Import card transactions → match with expense reports → flag unmatched
- **Reimbursement Tracking**: Track status (pending, approved, processing, reimbursed); include in payroll or process separately
- **Project Costing**: Tag expenses to projects for accurate profitability; pass-through billing to clients
- **Reports**: Per-employee, per-department, per-project, per-category; trends over time; policy violation summary

---

## 21. Module 17 — Timesheets & Billing

### 21.1 Features

- **Daily Time Entry**: Log hours per task with description and billable/non-billable flag
- **Weekly Timesheet View**: Grid layout — rows = tasks/projects, columns = days; total hours per row and column
- **Auto-Fill from Attendance**: Pre-populate total hours from check-in/check-out data
- **Timer Widget**: Start/stop timer that logs time against a selected task
- **Timesheet Submission**: Submit weekly/monthly timesheet for approval (Draft → Submitted → Approved/Rejected)
- **Approval Workflow**: Manager reviews → approves/rejects with comments; bulk approve
- **Quick Date Selectors**: This Week, Last Week, This Month, Last Month, Custom Range
- **Per-Day Breakdown**: Expand to see check-in/out times, effective hours, break, status (present/late/holiday/leave)
- **Missing Day Indicators**: Highlight days with no time logged (excluding holidays and leaves)
- **Billable Hours Report**: By project, by client, by employee; billable vs non-billable ratio
- **Invoice Integration**: Generate invoice from approved timesheet hours at project billing rate
- **Export**: CSV, Excel, PDF for client reporting

---

## 22. Module 18 — Performance Reviews & OKRs

### 22.1 Features

#### Performance Reviews
- **Review Cycles**: Admin creates review cycle (quarterly, semi-annual, annual) with timeline
- **Self-Assessment**: Employee fills self-review form with achievements, challenges, goals
- **Manager Review**: Manager evaluates against competencies with ratings and comments
- **360-Degree Feedback**: Optional peer reviews from selected colleagues
- **Calibration**: HR/leadership review all ratings for consistency across teams
- **Final Rating**: Composite score with manager comments; shared with employee
- **PIP (Performance Improvement Plan)**: Create structured improvement plan with milestones and check-ins

#### OKRs (Objectives & Key Results)
- **Company OKRs**: Organization-level objectives set by leadership
- **Team OKRs**: Department/team objectives aligned to company OKRs
- **Individual OKRs**: Personal objectives aligned to team OKRs
- **Key Results**: Measurable outcomes per objective with target and current value
- **Progress Tracking**: Auto-update from linked tasks/metrics where possible
- **Check-Ins**: Regular updates on key result progress with notes
- **Alignment View**: Visual tree showing company → team → individual OKR cascade
- **Scoring**: 0.0–1.0 scale per key result; objective score = average of key results

#### Goal Management
- **SMART Goals**: Structured goal setting (Specific, Measurable, Achievable, Relevant, Time-bound)
- **Goal Categories**: Technical skills, leadership, collaboration, innovation, client satisfaction
- **Progress Tracking**: Milestone-based with percentage completion
- **1:1 Meeting Notes**: Structured template for manager-employee check-ins; linked to goals and feedback

---

## 23. Module 19 — DevOps Dashboard

### 23.1 Features

| Feature | Description |
|---|---|
| CI/CD Pipeline View | Visualize build → test → deploy stages from GitHub Actions, GitLab CI, Jenkins (via webhooks) |
| Deployment Tracker | Log deployments: version/tag, environment (dev/staging/prod), deployer, timestamp, status (success/failed/rolled back) |
| Environment Registry | Define environments per project: name, URL, variables (encrypted vault), health check endpoint |
| Service Catalog | Register microservices/apps: name, repo, tech stack, team owner, dependencies, documentation link |
| Incident Management | Create incidents: severity (P1–P4), affected service, assigned responder, status (investigating/identified/monitoring/resolved), timeline |
| On-Call Schedule | Rotation management: define rotations by team, view current on-call, escalation chain |
| Uptime Monitoring | HTTP endpoint checks at configurable intervals; alert on downtime; public status page (optional) |
| Changelog Generator | Auto-generate changelog from merged PRs/commits linked to issues |
| Post-Mortem | Structured template: summary, timeline, root cause, impact, action items, owner, status |
| Runbook Library | Searchable repository of operational procedures linked to services |
| Alert Management | Route alerts from monitoring tools to on-call via push/SMS/email; acknowledge/resolve flow |

---

## 24. Module 20 — Reports & Analytics

### 24.1 Pre-Built Reports

| Category | Reports |
|---|---|
| **HR** | Headcount, attrition rate, new hire trend, department distribution, skill matrix, diversity metrics |
| **Attendance** | Daily summary, late arrivals trend, absenteeism rate, overtime analysis, department comparison |
| **Leave** | Balance summary, utilization by type, department comparison, blackout period impact |
| **Payroll** | Monthly payroll summary, department-wise cost, YTD analysis, statutory contributions, variance report |
| **Projects** | Health scorecard, budget vs actual, resource utilization, milestone tracker, client satisfaction |
| **Tasks** | Completion rate, overdue analysis, workload distribution, cycle time, priority breakdown |
| **Sprint** | Velocity trend, burndown accuracy, scope creep, carry-over rate |
| **Sales/CRM** | Pipeline value, conversion rates, revenue forecast, lead source ROI, salesperson performance |
| **Invoicing** | Revenue by client/project/month, invoice aging, collection rate, MRR/ARR trend |
| **Expenses** | Category breakdown, department comparison, policy violations, reimbursement turnaround |

### 24.2 Custom Dashboard Builder
- Drag-and-drop widget placement on configurable grid
- Widget types: number metric, line chart, bar chart, pie chart, table, heatmap, funnel, gauge
- Data source selection per widget (any module)
- Filter controls: date range, department, project, employee, custom field
- Save and share dashboards with team/organization
- Schedule email delivery (PDF snapshot) daily/weekly/monthly

### 24.3 AI-Powered Analytics
- **Natural Language Queries**: "Show me developers with more than 5 late check-ins this month" → auto-generate query → display results
- **Anomaly Detection**: Auto-flag unusual patterns (spending spike, attendance drop, velocity decline)
- **Trend Predictions**: Forecast metrics based on historical data (revenue, attrition, utilization)
- **Automated Insights**: Weekly AI-generated summary of key metric changes and anomalies

---

## 25. Module 21 — Notifications & Reminders

### 25.1 Notification Channels

| Channel | Technology | Use Case |
|---|---|---|
| In-App (Real-Time) | Socket.IO | Instant notifications within the web/mobile app |
| Push (Web) | Firebase Cloud Messaging | Browser notifications when tab is not active |
| Push (Mobile) | FCM + Expo Push | iOS/Android push notifications |
| Email Digest | SendGrid | Configurable: instant, hourly digest, daily digest, weekly digest |

### 25.2 Notification Types

- Task assigned / status changed / commented / overdue / submitted for review / review approved/rejected
- Leave requested / approved / rejected / cancelled
- Attendance manual entry submitted / approved / rejected
- Timesheet submitted / approved / rejected
- Invoice created / sent / paid / overdue
- Expense submitted / approved / rejected / reimbursed
- Payslip generated / sent
- Performance review cycle started / self-review due / feedback due
- Recruitment: new application / interview scheduled / offer accepted/declined
- Chat: DM received / @mentioned / channel invite
- Meeting: scheduled / starting in 5 min / recording available
- System: password expiry, document verification, asset return due, license renewal
- Announcement: new company announcement

### 25.3 Notification Preferences
- Per-channel toggle per notification type (e.g., task.assigned: in-app ✓, email ✗, push ✓)
- DND schedule (e.g., no push notifications 10 PM – 8 AM)
- Mute specific channels, projects, or conversations
- Unsubscribe from non-critical notifications

### 25.4 Reminders
- **Create Reminder**: Title, description, date/time, assigned to (self or team members), recurrence
- **Snooze**: 5 min, 15 min, 1 hour, tomorrow, custom
- **Recurring**: Daily, weekly (specific days), monthly (specific date), custom cron
- **Delivery**: Push notification 5 minutes before + at scheduled time
- **Manager Reminders**: Create reminders for team members (e.g., "Submit weekly report")

---

## 26. Module 22 — Email Templates & Document Generator

### 26.1 Email Templates
- **Template CRUD**: Admin creates templates with rich text editor (Tiptap)
- **Template Categories**: Payslip, Invoice, Offer Letter, Leave Notification, Task Notification, Welcome Email, Password Reset, Custom
- **Dynamic Variables**: `{{employeeName}}`, `{{salary}}`, `{{month}}`, `{{invoiceNumber}}`, `{{companyName}}`, etc.
- **Preview Mode**: Render template with sample data before saving
- **Versioning**: Track template changes with revision history
- **Multi-Language**: Templates in multiple languages (English, Hindi initially)

### 26.2 Document Generator
- **Template Types**: Offer Letter, Experience Letter, Salary Certificate, Relieving Letter, Appraisal Letter, NDA, Custom
- **Dynamic Form**: Template keywords drive form fields; fill in values → preview HTML → generate PDF
- **Bulk Generation**: Generate documents for multiple employees (e.g., appraisal letters for entire department)
- **Digital Signature**: Optional digital signature field (e-sign integration readiness)
- **Document History**: Track all generated documents with filters by type, creator, date
- **Storage**: Generated documents stored in S3 with links in employee profile

---

## 27. Module 23 — Settings & Configuration

### 27.1 Organization Settings
- Company name, logo, address, contact info, GSTIN, PAN, bank details
- Financial year definition (e.g., April–March for India)
- Default currency and timezone
- Working days and standard hours
- Holiday calendar management

### 27.2 Module Settings
- Attendance: policies, shifts, geofence, photo requirements
- Leave: policies, types, accrual rules, blackout periods
- Payroll: policies, statutory rates, reimbursement types, tax slabs
- Invoicing: numbering format, default terms, tax configurations, bank details on invoice
- Projects: default board type, billing rates, project categories
- Recruitment: pipeline stages, scorecard criteria, email templates
- Notifications: default preferences, email digest schedule

### 27.3 Customization
- **Custom Fields**: Add custom fields to any module (text, number, date, dropdown, multi-select, user-picker)
- **Custom Statuses**: Define additional statuses for tasks, leaves, invoices
- **Branding**: Primary color, logo, favicon (applies across platform and emails)
- **Email Domain**: Custom sending domain for transactional emails

### 27.4 Data Management
- **Import**: Bulk import employees, clients, tasks from CSV/Excel
- **Export**: Export any module data as CSV, Excel, PDF
- **Backup**: Manual backup trigger; download as encrypted archive
- **Data Retention**: Configure retention periods per module; auto-purge after expiry
- **GDPR Tools**: Data export per employee, right to deletion (anonymization), consent management

---

## 28. Module 24 — Integrations Hub

### 28.1 Pre-Built Integrations

| Category | Integrations | Sync Type |
|---|---|---|
| Version Control | GitHub, GitLab, Bitbucket | Webhook (commits, PRs → linked issues) |
| CI/CD | GitHub Actions, GitLab CI, Jenkins | Webhook (pipeline status → DevOps dashboard) |
| Calendar | Google Calendar, Outlook Calendar | OAuth (bi-directional meeting sync) |
| Communication | Slack, Microsoft Teams | Webhook (notifications to channels) |
| Accounting | Tally, QuickBooks, Zoho Books | API (invoice + payment sync) |
| Identity | Google Workspace, Microsoft Entra ID, Okta | SAML/OAuth/SCIM (SSO + provisioning) |
| Storage | Google Drive, OneDrive, Dropbox | OAuth (file linking, shared access) |
| Payment | Razorpay, Stripe | API (online invoice payment collection) |
| Cloud | AWS, Azure, GCP | API (billing alerts, resource monitoring) |
| Email | Gmail, Outlook | OAuth (email tracking for CRM) |
| HR | Darwinbox, Keka | API (employee data sync) |

### 28.2 API & Webhooks
- **REST API**: OpenAPI 3.0 spec; interactive Swagger docs at `/api/docs`
- **Webhooks**: Subscribe to events; configurable URL + secret; retry with exponential backoff
- **API Keys**: Generate per-user or per-integration; rotate, revoke; rate-limited
- **OAuth 2.0 App Authorization**: For third-party app access
- **Webhook Events**: `employee.created`, `task.updated`, `leave.approved`, `invoice.sent`, `attendance.checkin`, etc.
- **Zapier/n8n Compatible**: Standard webhook format for no-code automation

---

## 29. Module 25 — Mobile Application

### 29.1 Platform & Tech

- **Framework**: React Native with Expo
- **Platforms**: iOS 15+, Android 10+
- **Distribution**: App Store, Google Play; optional enterprise MDM distribution

### 29.2 Features

| Feature | Description |
|---|---|
| Attendance | One-tap check-in/out with photo + GPS; offline queue; geofence awareness |
| Chat | Full messaging: DMs, channels, threads, file sharing, voice messages |
| Voice/Video | Join/initiate calls; CallKit (iOS) / ConnectionService (Android) integration |
| Tasks | View, update status, log time, submit for review; quick create |
| Leave | Apply, view balance, track status; manager approve/reject from notification |
| Notifications | Grouped push with quick actions (approve, reject, reply, open) |
| Expenses | Photo receipt capture → OCR → auto-fill → submit |
| Directory | Search colleagues; tap to message/call |
| Calendar | View schedule, meetings, deadlines; join meeting from notification |
| Timesheets | Log daily hours; submit weekly timesheet |
| Approvals | Unified approval inbox: leaves, expenses, timesheets, manual entries |
| Offline Mode | Queue actions; sync on reconnect; local cache for recently viewed data |
| Biometric Auth | Face ID, Touch ID, Fingerprint for app unlock |
| Dark Mode | System-synced with manual override |
| Widgets | iOS: Today widget for attendance status; Android: attendance + upcoming tasks |
| Deep Linking | Push notification → opens exact screen (task detail, leave request, chat message) |

---

## 30. AI & Automation Strategy

### 30.1 Architecture

| Layer | Model | Privacy | Use Cases |
|---|---|---|---|
| Cloud AI | Anthropic Claude Sonnet | API (data sent to Anthropic) | Project planning, analytics, document gen, code review |
| Local AI | Qwen 2.5 7B via Ollama | On-premise (never leaves infra) | HR data analysis, salary insights, performance review assists, sentiment |
| Embedded ML | TensorFlow.js, custom classifiers | Client-side / server-side | Receipt OCR, resume parsing, face detection, noise cancellation |

### 30.2 AI Features by Module

| Module | AI Feature | Model |
|---|---|---|
| Dashboard | Daily digest: auto-generated summary of anomalies and action items | Claude |
| Boards | Project breakdown: NL → epics/stories/tasks with estimates | Claude |
| Boards | Smart estimation: suggest story points from historical similarity | Claude |
| Boards | Duplicate detection on issue creation | Embedding + similarity |
| Boards | Auto-assign based on workload + skills + history | Claude |
| Tasks | Sprint planning assistant: recommend backlog items for next sprint | Claude |
| Tasks | Standup summary: auto-generate from issue activity | Claude |
| Chat | AI Bot: answer from wiki, create tasks, summarize threads | Claude |
| Recruitment | Resume parsing: extract structured data from PDF/DOCX | Claude + local |
| Recruitment | Candidate-job matching score | Embedding + similarity |
| Knowledge Base | Semantic search: Q&A over wiki content | Claude |
| Knowledge Base | Auto-summarize long documents | Claude |
| Payroll | Anomaly detection in salary calculations | Local Qwen |
| Payroll | Compliance checks against statutory rules | Local Qwen |
| Attendance | Pattern detection: habitual late, unusual locations | Local Qwen |
| Expenses | Receipt OCR: extract merchant, amount, date | TensorFlow.js |
| Expenses | Policy violation detection | Rule engine + local AI |
| Analytics | Natural language queries over all data | Claude |
| Analytics | Trend predictions and forecasting | Claude + statistical |
| Performance | Review writing assistant: suggest feedback phrasing | Local Qwen |

### 30.3 AI Safety & Privacy

- All HR, payroll, and performance data routed through local Qwen model (never sent to external API)
- Cloud AI calls include only project/task metadata (no PII)
- AI features are opt-in per organization
- AI suggestions always presented as recommendations (never auto-applied without user confirmation)
- Audit log for all AI-generated content and actions

---

## 31. Security & Compliance

| Area | Implementation |
|---|---|
| Authentication | JWT (access + refresh), OAuth 2.0, SAML SSO, MFA (TOTP, SMS, Email) |
| Authorization | RBAC with per-module granularity; ABAC overrides; data scope rules (self/team/dept/org) |
| Encryption (Transit) | TLS 1.3 for all HTTP/WebSocket; certificate pinning on mobile |
| Encryption (Rest) | AES-256 for S3 objects and MongoDB encryption at rest |
| Encryption (E2EE) | Signal Protocol for DMs; optional for channels |
| API Security | Helmet.js, CORS whitelist, rate limiting (per-user + per-IP), request validation (Zod), CSRF tokens |
| Input Sanitization | XSS prevention (DOMPurify for rich text), SQL/NoSQL injection prevention |
| Data Privacy | GDPR-ready: data export, right to deletion, consent management, cookie consent, DPA |
| Audit Logging | Immutable audit trail (separate collection, append-only) for: auth events, data access, admin actions, permission changes |
| IP Restrictions | Configurable allowlist per org for admin panel access |
| Session Security | Token rotation on refresh, device fingerprinting, concurrent session limits, auto-logout on inactivity |
| Backup & DR | Daily MongoDB backups (30-day retention); S3 cross-region replication; RTO < 4hr, RPO < 1hr |
| Compliance | SOC 2 Type II controls, ISO 27001 alignment, OWASP Top 10 mitigations |
| Vulnerability | Snyk dependency scanning, container scanning, SAST in CI, DAST quarterly |
| Penetration Testing | Annual third-party pentest with remediation tracking |
| Data Residency | Configurable deployment region (AWS region selection) for data sovereignty |
| Secret Management | AWS Secrets Manager / HashiCorp Vault for API keys, DB credentials, encryption keys |

---

## 32. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Availability | 99.9% uptime (≤ 8.76 hrs/year downtime) |
| API Latency (Read) | p95 < 200ms, p99 < 500ms |
| API Latency (Write) | p95 < 400ms, p99 < 800ms |
| WebSocket Latency | Message delivery < 100ms (same region) |
| Video Call Quality | 720p @ 30fps minimum; < 150ms E2E audio latency |
| Search Latency | Full-text results < 200ms |
| Concurrent Users | 2,000 per tenant; 10,000+ with horizontal scaling |
| File Upload | Up to 100MB; streaming with progress; resumable for mobile |
| Page Load | First Contentful Paint < 1.2s; Time to Interactive < 2.5s |
| Bundle Size | Initial JS bundle < 200KB gzipped |
| Database | MongoDB replica set; read replicas for analytics queries |
| Cache Hit Rate | > 90% for frequently accessed data (Redis) |
| Browser Support | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| Mobile Support | iOS 15+, Android 10+ |
| Accessibility | WCAG 2.1 AA compliance |
| Internationalization | UTF-8; timezone-aware; language packs (EN, HI); RTL-ready |
| Data Retention | Configurable soft-delete + hard purge (default 90 days) |
| Backup | Daily automated; 30-day retention; PITR within 7 days |
| Monitoring | Prometheus + Grafana; Sentry; ELK; custom health dashboards |
| Recovery | RTO < 4 hours; RPO < 1 hour |

---

## 33. Infrastructure & Deployment

### 33.1 Docker Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| nexora-api | Node 20 Alpine | 3000 | Express.js REST API |
| nexora-web | Node 20 Alpine | 3001 | Next.js web application (SSR) |
| nexora-socket | Node 20 Alpine | 3002 | Socket.IO real-time server |
| nexora-worker | Node 20 Alpine | — | BullMQ background job processor |
| nexora-sfu | LiveKit / Mediasoup | 7880 | Video/audio SFU |
| mongo | mongo:7 | 27017 | Primary database (replica set) |
| redis | redis:7-alpine | 6379 | Cache, pub-sub, queues |
| elasticsearch | elasticsearch:8 | 9200 | Full-text search |
| coturn | coturn/coturn | 3478 | TURN/STUN for WebRTC |
| ollama | ollama/ollama | 11434 | Local LLM (Qwen 2.5) |
| nginx | nginx:alpine | 80/443 | Reverse proxy, TLS |

### 33.2 Production (Kubernetes)

- EKS (AWS) or AKS (Azure) managed Kubernetes
- Horizontal Pod Autoscaler on API, Socket, Worker services
- MongoDB Atlas or self-managed replica set (3-node minimum)
- Redis Cluster (3 masters + 3 replicas) or ElastiCache
- S3 + CloudFront for static/media
- ALB (Application Load Balancer) with WAF
- GitHub Actions CI/CD: lint → test → build → push image → deploy
- Blue-green deployments for zero-downtime releases
- Separate namespaces: `production`, `staging`, `development`

---

## 34. Test Strategy & Testmo Test Cases

### 34.1 Test Strategy Overview

| Aspect | Specification |
|---|---|
| **Coverage Target** | ≥ 85% code coverage across all modules |
| **Test Management** | Testmo — all test cases, runs, and results tracked |
| **Unit Testing** | Jest + React Testing Library (frontend), Jest + Supertest (backend) |
| **Integration Testing** | Supertest against running API with test MongoDB instance |
| **E2E Testing** | Playwright — critical user flows per module |
| **Performance Testing** | k6 for load testing; target p95 < 500ms under 1000 concurrent users |
| **Security Testing** | OWASP ZAP (automated DAST), manual pentest annually |
| **Accessibility Testing** | axe-core automated checks in CI; manual screen reader testing quarterly |
| **Visual Regression** | Playwright screenshot comparison for UI components |
| **API Contract Testing** | OpenAPI spec validation; Dredd for contract testing |

### 34.2 Test Case Format (Testmo Standard)

```
Test Case ID: NX-[MODULE]-[NUMBER]
Title: [Short descriptive title]
Suite: [Module / Feature Group]
Priority: P1 (Critical) / P2 (High) / P3 (Medium) / P4 (Low)
Type: Functional / UI / API / Security / Performance / Accessibility
Preconditions: [Setup required]
Steps:
  1. [Action]
  2. [Action]
  3. [Action]
Expected Result: [What should happen]
Postconditions: [Cleanup if needed]
Automation Status: Automated / Manual / To Be Automated
```

### 34.3 Module Test Cases

---

#### MODULE 01: Authentication & Onboarding

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-AUTH-001 | Successful email/password login | P1 | Functional | 1. Navigate to /login 2. Enter valid email + password 3. Click Login | Redirect to dashboard; JWT cookie set; user menu shows name |
| NX-AUTH-002 | Login with invalid password | P1 | Functional | 1. Enter valid email + wrong password 2. Click Login | Error toast "Invalid credentials"; no redirect; attempt counter incremented |
| NX-AUTH-003 | Account lockout after 5 failed attempts | P1 | Security | 1. Attempt login with wrong password 5 times | Account locked; error "Account locked, try after 15 minutes" |
| NX-AUTH-004 | MFA verification (TOTP) | P1 | Functional | 1. Login with valid credentials 2. MFA prompt shown 3. Enter valid TOTP code | Login completes; redirect to dashboard |
| NX-AUTH-005 | MFA verification with invalid code | P2 | Functional | 1. Login successfully 2. Enter invalid TOTP code | Error "Invalid verification code"; remain on MFA screen |
| NX-AUTH-006 | Google OAuth login | P1 | Functional | 1. Click "Sign in with Google" 2. Select Google account 3. Authorize | User created/matched; redirect to dashboard |
| NX-AUTH-007 | Password reset flow | P1 | Functional | 1. Click "Forgot password" 2. Enter email 3. Open reset email 4. Set new password | Password updated; can login with new password |
| NX-AUTH-008 | Session expiry handling | P2 | Security | 1. Login 2. Wait 15 min (access token expires) 3. Make API request | Auto-refresh via refresh token; request succeeds transparently |
| NX-AUTH-009 | Concurrent session limit | P2 | Security | 1. Login on device A, B, C (limit 3) 2. Login on device D | Oldest session (A) terminated; device D logged in |
| NX-AUTH-010 | Remote session revocation | P2 | Functional | 1. Go to Settings > Sessions 2. Click "Logout" on a session | Target session invalidated; that device redirected to login |
| NX-AUTH-011 | Onboarding wizard completion | P1 | Functional | 1. Accept invite 2. Set password 3. Complete profile 4. Upload documents 5. Accept policies | Onboarding status = completed; progress 100%; full platform access |
| NX-AUTH-012 | Onboarding progress persistence | P2 | Functional | 1. Complete step 1-2 2. Close browser 3. Reopen | Resume from step 3; progress saved |
| NX-AUTH-013 | Password strength validation | P3 | UI | 1. Type passwords of varying strength | Strength meter updates (weak/fair/strong); submit blocked if below minimum |
| NX-AUTH-014 | CSRF token validation | P1 | Security | 1. Send POST request without CSRF token | Request rejected with 403 |
| NX-AUTH-015 | XSS in login form | P1 | Security | 1. Enter `<script>alert('xss')</script>` in email field | Input sanitized; no script execution |

---

#### MODULE 02: Dashboard

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-DASH-001 | Dashboard loads with correct role view | P1 | Functional | 1. Login as Admin 2. Navigate to Dashboard | Admin dashboard layout with all stat cards, revenue widget, attendance feed |
| NX-DASH-002 | Stat cards display accurate data | P1 | Functional | 1. View dashboard | Total employees matches User count; active projects matches Project count; pending leaves matches Leave queue |
| NX-DASH-003 | Real-time attendance update | P2 | Functional | 1. Open dashboard 2. Another user checks in | Attendance widget updates without page refresh (Socket.IO) |
| NX-DASH-004 | Widget drag-and-drop rearrange | P3 | UI | 1. Drag "Revenue" widget to top-left 2. Release | Widget snaps to new position; layout saved; persists on reload |
| NX-DASH-005 | Date range filter applies globally | P2 | Functional | 1. Change date range to "Last Month" | All widgets update to reflect last month's data |
| NX-DASH-006 | Quick action: approve leave | P2 | Functional | 1. Click "Approve" on pending leave in widget | Leave approved; count decrements; success toast |
| NX-DASH-007 | Developer dashboard shows correct widgets | P2 | Functional | 1. Login as Developer | Shows: My Tasks, Sprint Progress, Attendance Status, Deadlines; NOT revenue or payroll |
| NX-DASH-008 | AI daily digest displays | P3 | Functional | 1. View dashboard (morning) | AI digest panel shows summary of anomalies and suggested actions |
| NX-DASH-009 | Dashboard responsive on tablet | P2 | UI | 1. View dashboard on 768px width | Stat cards stack 2-per-row; sidebar collapses; all widgets visible |
| NX-DASH-010 | Dashboard performance | P2 | Performance | 1. Load dashboard with 500 employees in org | Page loads in < 3 seconds; all data rendered |

---

#### MODULE 03: Employee Directory

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-DIR-001 | Search employee by name | P1 | Functional | 1. Type employee name in search 2. Wait 300ms debounce | Matching employees shown; search highlights in name |
| NX-DIR-002 | Filter by department | P2 | Functional | 1. Select "Engineering" from department filter | Only Engineering department employees displayed |
| NX-DIR-003 | Org chart renders correctly | P2 | UI | 1. Navigate to Org Chart tab | Hierarchical tree renders; CEO at top; expand/collapse works |
| NX-DIR-004 | Skill matrix search | P3 | Functional | 1. Search "React" in skill matrix | All employees with React skill shown with proficiency level |
| NX-DIR-005 | Quick action: send message from card | P2 | Functional | 1. Hover employee card 2. Click message icon | Chat opens with DM to that employee |
| NX-DIR-006 | CRUD department | P2 | Functional | 1. Create department "Design" 2. Edit name 3. Delete | Department created, updated, soft-deleted; reflected in directory |
| NX-DIR-007 | Bulk import employees via CSV | P2 | Functional | 1. Upload CSV with 50 employees | Progress bar; validation errors shown per row; valid rows imported |
| NX-DIR-008 | Employee profile detail view | P1 | Functional | 1. Click employee name | Drawer/page opens with full profile: personal info, skills, timeline, documents |
| NX-DIR-009 | Privacy: employee sees limited peer info | P2 | Security | 1. Login as Employee 2. View another employee's profile | Shows: name, title, department, contact; NOT salary, documents, address |
| NX-DIR-010 | Timezone display accuracy | P3 | Functional | 1. View employee in different timezone | Local time displayed correctly based on IANA timezone |

---

#### MODULE 04: Attendance

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-ATT-001 | Employee check-in | P1 | Functional | 1. Click "Check In" button | Timestamp recorded; status changes to "Working"; IP and location captured |
| NX-ATT-002 | Employee check-out | P1 | Functional | 1. Click "Check Out" after check-in | Check-out time recorded; total hours calculated; status updated |
| NX-ATT-003 | Late arrival auto-detection | P1 | Functional | 1. Check in 20 minutes after shift start + grace | Status marked as "Late"; lateByMinutes calculated correctly |
| NX-ATT-004 | Geofence check-in block | P2 | Functional | 1. Attempt check-in from outside geofence radius (GPS spoofed in test) | Check-in blocked; error "You are outside office premises" |
| NX-ATT-005 | Photo capture on check-in | P2 | Functional | 1. Check in with photo required policy | Camera opens; photo captured and stored; visible in admin view |
| NX-ATT-006 | Manual entry submission | P1 | Functional | 1. Submit manual entry with reason "Forgot" | Entry created with status "pending"; appears in admin queue |
| NX-ATT-007 | Manual entry limit enforcement | P2 | Functional | 1. Submit 4th manual entry in month (limit: 3) | Submission blocked; error "Monthly manual entry limit reached" |
| NX-ATT-008 | Admin approves manual entry | P1 | Functional | 1. Admin clicks Approve on pending entry | Status → approved; attendance record updated; employee notified |
| NX-ATT-009 | Admin force check-out | P2 | Functional | 1. Admin force-checks-out employee | Check-out recorded with entryType "force"; audit trail entry created |
| NX-ATT-010 | Overtime auto-calculation | P2 | Functional | 1. Employee works 10 hours (shift: 8 hours) | overtimeHours = 2; reflected in timesheet |
| NX-ATT-011 | Attendance report export | P3 | Functional | 1. Admin filters by March 2026 2. Clicks Export CSV | CSV downloaded with all attendance records for the period |
| NX-ATT-012 | Shift swap workflow | P3 | Functional | 1. Employee A requests swap with B 2. B confirms 3. Manager approves | Shifts swapped for specified dates |
| NX-ATT-013 | Holiday auto-marking | P2 | Functional | 1. Date is configured holiday in policy | All employees auto-marked as "holiday" for that date |
| NX-ATT-014 | Attendance calendar view | P2 | UI | 1. Open "My Attendance" → Calendar tab | Color-coded calendar; click a day to see details |
| NX-ATT-015 | Concurrent check-in prevention | P1 | Security | 1. Already checked in 2. Click Check In again | Error "Already checked in today" |

---

#### MODULE 05: Leave Management

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-LV-001 | Apply for casual leave | P1 | Functional | 1. Select Casual Leave 2. Pick dates 3. Enter reason 4. Submit | Leave request created; status "pending"; balance decremented tentatively |
| NX-LV-002 | Manager approves leave | P1 | Functional | 1. Manager views pending queue 2. Clicks Approve | Status → approved; balance confirmed deducted; employee notified |
| NX-LV-003 | Manager rejects leave with reason | P1 | Functional | 1. Manager clicks Reject 2. Enters rejection reason | Status → rejected; balance restored; employee notified with reason |
| NX-LV-004 | Leave balance accuracy | P1 | Functional | 1. View leave balance dashboard | Available = Opening + Accrued - Used - LOP + Adjusted (matches calculation) |
| NX-LV-005 | Insufficient balance prevention | P2 | Functional | 1. Apply for 5 days casual leave with 2 days remaining | Error "Insufficient leave balance (2 days available)" |
| NX-LV-006 | Half-day leave | P2 | Functional | 1. Apply leave with half-day option 2. Select first half | Leave counted as 0.5 days; deducted accordingly |
| NX-LV-007 | Team calendar conflict warning | P3 | Functional | 1. Apply for leave when 2 team members already off | Warning shown "2 team members already on leave for these dates" |
| NX-LV-008 | Blackout period enforcement | P2 | Functional | 1. Apply for leave during blackout period | Error "Leave requests are restricted during this period" |
| NX-LV-009 | Cancel approved future leave | P2 | Functional | 1. Cancel approved leave that hasn't started | Status → cancelled; balance restored |
| NX-LV-010 | Leave accrual monthly | P2 | Functional | 1. Cron runs on 1st of month | All employees accrue leave per policy; reflected in balance |
| NX-LV-011 | Carry-forward at year end | P2 | Functional | 1. Year-end process runs | Unused leave carried forward up to max limit; excess lapses |
| NX-LV-012 | Leave report by department | P3 | Functional | 1. HR generates department leave report | Report shows leave utilization per department per type |

---

#### MODULE 06: Payroll

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-PAY-001 | Generate payslip for employee | P1 | Functional | 1. Select employee + month 2. Click Generate | Payslip created with correct earnings, deductions, net pay |
| NX-PAY-002 | PF calculation accuracy | P1 | Functional | 1. Generate payslip for employee with basic 25000 | PF employee: 3000 (12%); PF employer: 3000 (12%) |
| NX-PAY-003 | LOP deduction from attendance | P1 | Functional | 1. Employee has 2 unapproved absences 2. Generate payslip | 2 days deducted as LOP; net pay reduced accordingly |
| NX-PAY-004 | Overtime pay calculation | P2 | Functional | 1. Employee has 10 OT hours at 1.5x rate | Overtime earning line item = 10 × hourlyRate × 1.5 |
| NX-PAY-005 | Bulk payslip generation | P1 | Functional | 1. Admin runs payroll for all employees for March | All payslips generated; preview dashboard shows each with variance |
| NX-PAY-006 | Edit draft payslip | P2 | Functional | 1. Edit draft payslip: add bonus line item 2. Save | Bonus added; net pay recalculated; status remains draft |
| NX-PAY-007 | Finalize payslip (lock) | P1 | Functional | 1. Finalize payslip | Status → finalized; no further edits allowed |
| NX-PAY-008 | Send payslip via email | P1 | Functional | 1. Send finalized payslip | Email sent with PDF attachment; emailSent = true; emailSentAt set |
| NX-PAY-009 | Employee views own payslip | P2 | Functional | 1. Login as employee 2. Navigate to Payroll | See own payslips list; click to view/download PDF |
| NX-PAY-010 | Salary revision workflow | P2 | Functional | 1. HR proposes revision 2. Admin approves 3. Next payroll | New salary applied from effective date; arrears calculated if backdated |
| NX-PAY-011 | TDS slab calculation | P2 | Functional | 1. Generate payslip for employee with annual income > 5L | TDS deducted per applicable slab after exemptions |
| NX-PAY-012 | Payslip PDF format verification | P2 | UI | 1. Download payslip PDF | Contains company logo, employee details, earnings table, deductions table, net pay, YTD |

---

#### MODULE 07: Projects

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-PROJ-001 | Create new project | P1 | Functional | 1. Click + New Project 2. Fill form 3. Save | Project created; appears in project list; default board created |
| NX-PROJ-002 | Assign team members | P1 | Functional | 1. Open project settings 2. Add members with roles | Members added; can access project; allocation % tracked |
| NX-PROJ-003 | Project health score calculation | P2 | Functional | 1. Create project with 10 tasks 2. Mark 3 overdue | Health score reflects overdue percentage; visual indicator changes color |
| NX-PROJ-004 | Create from template | P2 | Functional | 1. Select "Web Application" template 2. Create | Project created with pre-populated tasks, milestones, board columns |
| NX-PROJ-005 | Budget tracking | P2 | Functional | 1. Set budget $50,000 2. Log billable hours | Budget utilization % calculated; warning at 80% threshold |
| NX-PROJ-006 | Client portal access | P3 | Functional | 1. Enable client portal 2. Share link 3. Client logs in | Client sees milestones, progress, deliverables; no internal data visible |
| NX-PROJ-007 | Project card view rendering | P2 | UI | 1. Navigate to Projects | Grid of cards with name, progress bar, team avatars, status badge |
| NX-PROJ-008 | Archive project | P2 | Functional | 1. Change status to "Completed" | Project moved to archive view; data preserved; no new task creation |

---

#### MODULE 08: Boards (Jira)

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-BRD-001 | Create Scrum board | P1 | Functional | 1. Create board with Scrum type | Board created with Backlog, To Do, In Progress, In Review, Done columns |
| NX-BRD-002 | Create issue (Story) | P1 | Functional | 1. Click + in backlog 2. Fill title, description, priority, points | Issue created in backlog; visible in board |
| NX-BRD-003 | Drag issue between columns | P1 | UI | 1. Drag issue from "To Do" to "In Progress" | Status updates; animation smooth; position persisted |
| NX-BRD-004 | Sprint creation and planning | P1 | Functional | 1. Create sprint 2. Drag items from backlog to sprint 3. Start sprint | Sprint active; items appear on sprint board; burndown starts |
| NX-BRD-005 | Burndown chart accuracy | P2 | Functional | 1. Start sprint with 50 points 2. Complete 20 points over 3 days | Burndown shows ideal line and actual line declining correctly |
| NX-BRD-006 | WIP limit enforcement (Kanban) | P2 | Functional | 1. Set WIP limit 3 for "In Progress" 2. Try to add 4th item | Warning displayed; column header turns red; drag allowed but flagged |
| NX-BRD-007 | Issue linking (blocks) | P2 | Functional | 1. Create link "Issue A blocks Issue B" | Dependency shown on both issues; Gantt view shows arrow |
| NX-BRD-008 | Custom field on issue | P3 | Functional | 1. Admin adds custom field "Client Impact" (dropdown) 2. Set on issue | Field visible on issue detail; filterable in board |
| NX-BRD-009 | Automation rule execution | P2 | Functional | 1. Create rule: IF priority=Critical AND unassigned for 1hr THEN notify lead 2. Create critical unassigned issue 3. Wait 1 hr | Notification sent to team lead |
| NX-BRD-010 | Sprint retrospective board | P3 | Functional | 1. End sprint 2. Open retro board | Three columns available; team can add items; action items tracked |
| NX-BRD-011 | AI project breakdown | P2 | Functional | 1. Describe "E-commerce site with payments" in AI planner | AI generates epics (Catalog, Cart, Payments, Orders) with stories and estimates |
| NX-BRD-012 | Velocity chart | P2 | Functional | 1. Complete 3 sprints | Velocity chart shows points per sprint with average trend line |
| NX-BRD-013 | Bulk issue import from CSV | P3 | Functional | 1. Upload CSV with 50 issues | Issues created; validation errors shown per row |
| NX-BRD-014 | Issue search with JQL-like syntax | P3 | Functional | 1. Search: `priority = High AND status != Done AND assignee = me` | Correct results returned; saveable as filter |
| NX-BRD-015 | Sprint close with carry-over | P2 | Functional | 1. End sprint with 3 incomplete items 2. Choose "Move to next sprint" | Items moved to next sprint; sprint report shows carry-over |

---

#### MODULE 10: Communication Hub

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-CHAT-001 | Send direct message | P1 | Functional | 1. Open DM with colleague 2. Type message 3. Send | Message delivered; appears in recipient's chat; real-time |
| NX-CHAT-002 | Create public channel | P1 | Functional | 1. Click + Channel 2. Set name, public 3. Create | Channel created; appears in sidebar; joinable by all |
| NX-CHAT-003 | Thread reply | P2 | Functional | 1. Hover message 2. Click "Reply in thread" 3. Type reply | Thread opens in side panel; reply linked to parent message |
| NX-CHAT-004 | @mention notification | P1 | Functional | 1. Type @username in message 2. Send | Mentioned user receives push + in-app notification |
| NX-CHAT-005 | File sharing in chat | P2 | Functional | 1. Drag file into chat 2. Drop | File uploads with progress; preview shows for images/PDFs |
| NX-CHAT-006 | Message search | P2 | Functional | 1. Search "deployment" 2. Filter by channel "engineering" | Matching messages shown with context; click to jump to message |
| NX-CHAT-007 | 1:1 video call | P1 | Functional | 1. Click video icon in DM | Call initiated; both users see video; mic/camera controls work |
| NX-CHAT-008 | Group video call (10 participants) | P1 | Functional | 1. Start group call 2. 10 users join | All participants visible in grid; audio clear; speaker highlighted |
| NX-CHAT-009 | Screen sharing in call | P2 | Functional | 1. During call, click "Share Screen" 2. Select screen | Screen visible to all participants; presenter controls available |
| NX-CHAT-010 | Call recording | P2 | Functional | 1. Start recording during call 2. Stop | Recording saved; playback available in channel; consent noted |
| NX-CHAT-011 | Presence status accuracy | P2 | Functional | 1. User goes idle for 5 minutes | Status changes to "Away"; returns to "Online" on activity |
| NX-CHAT-012 | Message edit within window | P3 | Functional | 1. Edit sent message within 15 min | Message updated; "(edited)" shown; beyond 15 min: edit disabled |
| NX-CHAT-013 | Emoji reaction | P3 | UI | 1. React to message with 👍 | Reaction shows below message; count increments for duplicates |
| NX-CHAT-014 | Pin message | P3 | Functional | 1. Pin message in channel | Message pinned; visible in "Pinned" section; all members see |
| NX-CHAT-015 | DND mode blocks notifications | P2 | Functional | 1. Set status to DND | No push or in-app notifications; messages still delivered (visible when DND off) |

---

#### MODULE 12: Invoicing

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-INV-001 | Create invoice with line items | P1 | Functional | 1. Select client 2. Add 3 line items 3. Apply GST 4. Save | Invoice created; subtotal, tax, total calculated correctly |
| NX-INV-002 | Auto-sequential numbering | P2 | Functional | 1. Create 3 invoices | Numbers: NX-INV-2026-001, NX-INV-2026-002, NX-INV-2026-003 |
| NX-INV-003 | GST calculation (CGST + SGST) | P1 | Functional | 1. Intra-state invoice with 18% GST | CGST 9% + SGST 9% line items; amounts correct |
| NX-INV-004 | Percentage discount | P2 | Functional | 1. Apply 10% discount | Discount calculated on subtotal; total = subtotal - discount + tax |
| NX-INV-005 | Send invoice via email | P1 | Functional | 1. Click Send 2. Confirm | Email sent with PDF; status → Sent; delivery tracked |
| NX-INV-006 | Record partial payment | P2 | Functional | 1. Record payment of 50% | amountPaid updated; balanceDue recalculated; status → Partially Paid |
| NX-INV-007 | Overdue auto-detection | P2 | Functional | 1. Due date passes 2. Cron runs | Status → Overdue; reminder email sent (if configured) |
| NX-INV-008 | Recurring invoice generation | P2 | Functional | 1. Set up monthly recurring for client 2. Cron runs on schedule | New invoice auto-created; auto-sent if configured |
| NX-INV-009 | Invoice PDF download | P1 | UI | 1. Download invoice PDF | Professional layout; company logo, client details, line items, totals, bank details |
| NX-INV-010 | Multi-currency invoice | P2 | Functional | 1. Create invoice in USD for US client | Amount in USD; exchange rate noted; totals in USD |

---

#### MODULE 13: Recruitment

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-REC-001 | Create job posting | P1 | Functional | 1. Fill job details 2. Publish | Job visible on career page widget; pipeline created |
| NX-REC-002 | Candidate application | P1 | Functional | 1. Candidate fills form 2. Uploads resume 3. Submits | Application received; appears in pipeline "Applied" stage |
| NX-REC-003 | AI resume parsing | P2 | Functional | 1. Upload PDF resume | Name, email, skills, experience extracted; pre-fill candidate profile |
| NX-REC-004 | Move candidate through pipeline | P1 | Functional | 1. Drag candidate from "Screening" to "Interview" | Stage updated; interview scheduling prompt appears |
| NX-REC-005 | Interview scheduling | P2 | Functional | 1. Select interviewers 2. Pick slot 3. Confirm | Calendar event created; email invites sent to all parties |
| NX-REC-006 | Scorecard submission | P2 | Functional | 1. Interviewer fills scorecard after interview | Ratings saved; visible to hiring team; weighted total calculated |
| NX-REC-007 | Generate offer letter | P2 | Functional | 1. Select template 2. Fill variables 3. Generate PDF | Professional offer letter PDF; sent to candidate |
| NX-REC-008 | Onboarding handoff | P1 | Functional | 1. Candidate accepts offer | User record auto-created; onboarding workflow triggered; equipment request created |
| NX-REC-009 | Rejection with reason | P2 | Functional | 1. Reject candidate 2. Select reason 3. Send rejection email | Candidate moved to rejected; reason logged; email sent |
| NX-REC-010 | Time-to-hire analytics | P3 | Functional | 1. View recruitment analytics | Average days from application to hire; breakdown by stage |

---

#### MODULE 18: Performance Reviews

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-PERF-001 | Create review cycle | P1 | Functional | 1. Admin creates Q1 review cycle 2. Sets timeline | Cycle created; notifications sent to all participants |
| NX-PERF-002 | Employee self-assessment | P1 | Functional | 1. Employee fills self-review form | Assessment saved; visible to manager |
| NX-PERF-003 | Manager review submission | P1 | Functional | 1. Manager rates competencies 2. Adds comments 3. Submits | Review saved; ready for calibration |
| NX-PERF-004 | OKR creation and alignment | P2 | Functional | 1. Create team OKR 2. Create individual OKR aligned to it | Alignment chain visible in tree view |
| NX-PERF-005 | OKR progress tracking | P2 | Functional | 1. Update key result progress | Progress bar updates; objective score recalculated |
| NX-PERF-006 | 360-degree feedback | P3 | Functional | 1. Select peers for review 2. Peers submit feedback | Aggregated feedback visible to manager (anonymized option) |

---

#### CROSS-MODULE & SECURITY TESTS

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-SEC-001 | Role-based route protection | P1 | Security | 1. Login as Employee 2. Navigate to /admin/payroll | Redirect to 403 page; API returns 403 Forbidden |
| NX-SEC-002 | Data scope enforcement | P1 | Security | 1. Login as Employee 2. GET /api/v1/users (all users) | Only own profile returned (SELF scope) |
| NX-SEC-003 | Rate limiting enforcement | P2 | Security | 1. Send 150 requests in 1 minute | After 100: HTTP 429 "Too Many Requests"; Retry-After header set |
| NX-SEC-004 | SQL/NoSQL injection prevention | P1 | Security | 1. Send `{"email": {"$gt": ""}}` in login payload | Request rejected; validation error; no data leak |
| NX-SEC-005 | File upload size limit | P2 | Security | 1. Upload 150MB file | Error "File size exceeds 100MB limit" |
| NX-SEC-006 | Soft delete prevents data loss | P2 | Functional | 1. Delete employee 2. Query database | isDeleted = true; record exists; not visible in UI |
| NX-SEC-007 | Audit trail for admin actions | P1 | Security | 1. Admin force check-out employee | Audit log entry: who, what, when, IP, before/after values |
| NX-SEC-008 | CORS blocks unauthorized origins | P2 | Security | 1. Send API request from unauthorized domain | Request blocked; CORS error |
| NX-SEC-009 | Password not exposed in API | P1 | Security | 1. GET /api/v1/users/:id | Password field NOT in response; hashed in DB |
| NX-SEC-010 | Encrypted data at rest | P1 | Security | 1. Inspect MongoDB storage | Sensitive fields (MFA secret, documents) encrypted |

---

#### ACCESSIBILITY TESTS

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-A11Y-001 | Keyboard navigation | P2 | Accessibility | 1. Tab through login page | All fields and buttons focusable in logical order; focus ring visible |
| NX-A11Y-002 | Screen reader compatibility | P2 | Accessibility | 1. Run NVDA/VoiceOver on dashboard | All elements announced correctly; dynamic content updates announced |
| NX-A11Y-003 | Color contrast compliance | P2 | Accessibility | 1. Run axe-core on all pages | No contrast violations (4.5:1 for text, 3:1 for large text) |
| NX-A11Y-004 | Form label association | P2 | Accessibility | 1. Inspect form fields | All inputs have associated labels; errors linked via aria-describedby |
| NX-A11Y-005 | Focus management in modals | P2 | Accessibility | 1. Open modal 2. Tab through | Focus trapped in modal; Esc closes; focus returns to trigger |

---

#### PERFORMANCE TESTS

| ID | Title | Priority | Type | Steps | Expected Result |
|---|---|---|---|---|---|
| NX-PERF-P01 | API response under load | P1 | Performance | 1. k6: 1000 concurrent users hitting GET /api/v1/tasks | p95 < 500ms; 0% error rate |
| NX-PERF-P02 | WebSocket message delivery | P1 | Performance | 1. 500 concurrent chat connections 2. Send message | Delivery to all recipients < 100ms |
| NX-PERF-P03 | Dashboard initial load | P2 | Performance | 1. Fresh login 2. Measure dashboard load | FCP < 1.2s; TTI < 2.5s; LCP < 2.5s |
| NX-PERF-P04 | Search response time | P2 | Performance | 1. Search "project" across 100K records | Results returned < 200ms |
| NX-PERF-P05 | Bulk payroll generation | P2 | Performance | 1. Generate payslips for 500 employees | Completes in < 60 seconds; no timeouts |

### 34.4 Coverage Summary

| Module | Test Cases | P1 | P2 | P3 | P4 | Automation Target |
|---|---|---|---|---|---|---|
| Authentication | 15 | 8 | 5 | 1 | 1 | 100% |
| Dashboard | 10 | 1 | 6 | 2 | 1 | 80% |
| Directory | 10 | 2 | 5 | 2 | 1 | 80% |
| Attendance | 15 | 5 | 6 | 2 | 2 | 90% |
| Leave | 12 | 4 | 5 | 2 | 1 | 90% |
| Payroll | 12 | 5 | 5 | 1 | 1 | 85% |
| Projects | 8 | 2 | 4 | 1 | 1 | 80% |
| Boards (Jira) | 15 | 3 | 7 | 3 | 2 | 85% |
| Tasks | (per boards) | — | — | — | — | — |
| Communication | 15 | 3 | 7 | 3 | 2 | 75% |
| Invoicing | 10 | 3 | 5 | 1 | 1 | 85% |
| Recruitment | 10 | 3 | 4 | 2 | 1 | 80% |
| Performance | 6 | 2 | 2 | 1 | 1 | 75% |
| Security | 10 | 5 | 3 | 1 | 1 | 95% |
| Accessibility | 5 | 0 | 5 | 0 | 0 | 80% |
| Performance (Load) | 5 | 2 | 3 | 0 | 0 | 100% |
| **TOTAL** | **158** | **48** | **70** | **22** | **18** | **~86%** |

> **Total coverage target: 86% automated, 100% manual across all priority levels.**
> All P1 tests must pass for release. P2 tests allow ≤ 2 failures with workaround. P3/P4 tracked but non-blocking.

---

## 35. Implementation Roadmap

### Phase 1: Foundation (Months 1–3)

**Goal**: Stabilize core, build infrastructure, enhance existing modules

- Rebrand from Nugen to Nexora (UI, emails, docs, domain)
- Migrate frontend to Next.js 14 App Router with TypeScript strict mode
- Implement design system: Tailwind config, Shadcn/ui components, dark mode
- Set up Redis (caching, sessions, pub-sub), Elasticsearch (search indexing)
- Implement role-based dashboard views (Admin, HR, Developer, Sales, Accounts)
- Enhance authentication: OAuth, MFA, session management, onboarding wizard
- Enhance attendance: geofence, WiFi validation, multi-shift, anomaly detection
- Enhance leave: balance engine, accrual, carry-forward, team calendar, half-day
- Enhance payroll: PF/ESI/TDS auto-calc, multi-currency, revision workflow
- Build employee directory: org chart, skill matrix, department management
- SSO integration: Google Workspace, Microsoft Entra ID
- API documentation: OpenAPI 3.0 with Swagger UI
- Testing infrastructure: Jest, Playwright, Testmo integration, CI pipeline

### Phase 2: Communication & Boards (Months 4–7)

**Goal**: Launch real-time communication and advanced project boards

- Chat system: DMs, channels, threads, file sharing, reactions, search
- Presence & status system (Socket.IO + Redis)
- Voice calls: WebRTC 1:1 with STUN/TURN
- Video calls: 1:1 WebRTC + group via LiveKit SFU (25 participants)
- Screen sharing, call recording, virtual backgrounds
- Advanced board maker: Scrum, Kanban, Bug Tracker, Custom boards
- Issue system: all types, custom fields, linking, time tracking
- Sprint management: planning, burndown, velocity, retro
- Workflow engine: custom statuses, transitions, conditions, actions
- Automation rules engine
- Gantt chart view
- Timesheets module with approval workflow
- Mobile app v1: attendance, chat, tasks, push notifications
- Notification system overhaul: real-time + digest options

### Phase 3: Business Operations (Months 8–10)

**Goal**: CRM, recruitment, expenses, knowledge base

- CRM: lead pipeline, deal tracking, activity logging, proposal builder
- Client portal: secure external access, project dashboard, feedback
- Recruitment ATS: pipeline, resume parsing, interview scheduling, scorecards, offer management
- Onboarding automation: acceptance → employee record → documents → equipment
- Expense management: submission, OCR, approval, project linkage, reimbursement
- IT asset management: registry, assignment, licenses, QR codes, procurement
- Knowledge base: spaces, pages, rich editor, version history, permissions, search
- Enhanced invoicing: recurring, time-based, e-invoicing, payment tracking
- Payment collection: Razorpay/Stripe integration
- Performance reviews: review cycles, self-assessment, manager review, OKRs
- Document generator: templates, dynamic fields, bulk generation

### Phase 4: Intelligence & Scale (Months 11–14)

**Goal**: AI capabilities, analytics, integrations, enterprise features

- AI project planner: NL → epic/story/task breakdown
- AI chat bot: wiki Q&A, task creation from messages, thread summarization
- Natural language analytics across all modules
- Custom dashboard builder: drag-and-drop, cross-module data
- Scheduled reports with email delivery
- DevOps dashboard: CI/CD, deployments, incidents, on-call
- Integration hub: GitHub, GitLab, Slack, Google Calendar, Tally, QuickBooks
- Multi-tenant support: data isolation, tenant management
- Kubernetes production deployment: auto-scaling, rolling updates
- Mobile app v2: video calls, expenses, offline, biometric, widgets
- Performance optimization: query tuning, connection pooling, CDN
- SOC 2 readiness: audit controls, encryption verification, pen test
- Load testing: k6 at 2000 concurrent users
- Final test pass: all Testmo suites green at 85%+ coverage

---

## 36. Competitive Positioning

| Capability | Tools Replaced | Nexora Advantage |
|---|---|---|
| HR & Payroll | BambooHR, Keka, GreytHR, Darwinbox | Unified with attendance, projects, billing, performance |
| Project Management | Jira, Asana, Linear, Trello, Monday | Native sprint boards + AI planning + time billing + client portal |
| Communication | Slack, Microsoft Teams, Zoom, Google Meet | Chat + voice + video in one platform; no context switching |
| Invoicing | QuickBooks, Zoho Invoice, FreshBooks | Auto-generate from time logs; GST-compliant; multi-currency |
| Recruitment | Greenhouse, Lever, Workable | Seamless onboarding handoff to HR module |
| Wiki / Docs | Confluence, Notion, Slite | Linked to projects/tasks; AI-powered search |
| CRM | HubSpot, Pipedrive, Zoho CRM | Connected to invoicing, project delivery, client portal |
| Performance | Lattice, 15Five, Culture Amp | Tied to project data, task completion, OKRs |
| DevOps | PagerDuty, Statuspage, Opsgenie | Integrated with boards, incidents, on-call |
| Expenses | Expensify, Zoho Expense | OCR, project-linked, payroll-integrated |
| Assets | Snipe-IT, AssetTiger | Linked to directory, onboarding/offboarding |

### Pricing Strategy

| Plan | Per User/Month | Includes |
|---|---|---|
| **Starter** | $5 | HR, Attendance, Leave, Basic Projects, Chat (up to 25 users) |
| **Professional** | $15 | + Advanced Boards, Payroll, Invoicing, Video Calls, Wiki, Timesheets |
| **Enterprise** | $28 | + CRM, Recruitment, Analytics, Performance, DevOps, SSO, API, Integrations |
| **Self-Hosted** | One-time license | Full platform on your infrastructure; annual support contract |

---

## 37. Success Metrics

| Metric | Target (12 months) | Measurement |
|---|---|---|
| Daily Active Users | > 60% of registered | Login + meaningful action within 24hr |
| Tool Consolidation | Replace 4+ tools/customer | Pre/post onboarding audit |
| Time Saved | 15+ hours/month/manager | Workflow timing comparison |
| Onboarding Time | < 2 hours to productive | Time from invite to first meaningful action |
| Chat Adoption | > 80% team communication | Message volume vs external tools |
| Invoice Collection | 90% on-time | Payment date vs due date |
| Sprint Velocity Accuracy | Within 15% of estimate | Estimated vs completed story points |
| NPS Score | > 50 | Quarterly survey |
| Uptime | 99.9% | Monitoring |
| API Latency | p95 < 300ms | Prometheus |
| Test Coverage | ≥ 85% | Jest coverage reports |
| Bug Escape Rate | < 5% post-release | Bugs found in production vs pre-release |

---

## 38. Appendix

### A. Glossary

| Term | Definition |
|---|---|
| SFU | Selective Forwarding Unit — server that relays video streams for group calls |
| STUN/TURN | NAT traversal protocols for WebRTC connectivity |
| WIP | Work In Progress — limits on concurrent items in a kanban column |
| OKR | Objectives and Key Results — goal-setting framework |
| CTC | Cost to Company — total compensation including all benefits |
| LOP | Loss of Pay — salary deduction for unauthorized absence |
| PITR | Point In Time Recovery — database backup restoration to specific moment |
| E2EE | End-to-End Encryption — only sender and receiver can read messages |
| RBAC | Role-Based Access Control |
| ABAC | Attribute-Based Access Control |
| SCIM | System for Cross-domain Identity Management — user provisioning standard |
| IRN | Invoice Reference Number — unique ID for GST e-invoices in India |

### B. Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | March 18, 2026 | Nugen IT Services | Initial comprehensive PRD for Nexora |

---

*© 2026 Nugen IT Services. All rights reserved. This document is confidential and intended for internal use only.*
