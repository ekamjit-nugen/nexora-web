# Nexora Market Readiness — Simulation Progress

**Simulation Org:** PixelCraft Studios Pvt. Ltd.
**Plan:** 4 Waves × 2 Weeks = 8 weeks to production readiness
**Adoption Readiness at start:** 5.0/10
**Target Adoption Readiness:** 8.5/10

---

## Wave Overview

| Wave | Theme | Timeline | Status | Report |
|---|---|---|---|---|
| Wave 1 | Security & Core Stability | Weeks 1-2 | ✅ Complete | [WAVE-1-COMPLETION.md](wave-1/WAVE-1-COMPLETION.md) |
| Wave 2 | Collaboration & Board Usability | Weeks 3-4 | ✅ Complete | [WAVE-2-COMPLETION.md](wave-2/WAVE-2-COMPLETION.md) |
| Wave 3 | Advanced Project Management | Weeks 5-6 | 🔜 Pending | — |
| Wave 4 | Reporting & Market Differentiators | Weeks 7-8 | 🔜 Pending | — |

---

## Wave 1 — Completed ✅

**Adoption Readiness after Wave 1:** 6.5/10

### P0 Blockers Fixed
| # | Issue | Fix |
|---|---|---|
| P0-1 | XSS: JWT tokens in localStorage | httpOnly cookie migration (auth.controller.ts, jwt-auth.guard.ts) |
| P0-2 | No frontend RBAC | RouteGuard + RequirePermission + usePermissions (route-guard.tsx) |
| P0-3 | Sprint complete — missing `new_sprint` action | Added to DTO + sprint.service.ts |

### Features Delivered
- JWT stored in `httpOnly` cookie — XSS-proof, CSRF-protected
- Backwards-compatible: Bearer token still accepted for API/script clients
- Full RBAC permission map (admin/manager/member/viewer)
- `can()` helper for ownership checks (`task:edit_own`)
- Sprint complete supports `backlog | next_sprint | new_sprint + forceCompleteIds`
- Burndown + velocity endpoints already implemented (verified)
- Reporter field already in schema and auto-set (verified)

### Simulation Dataset
- 1 organisation: PixelCraft Studios
- 18 members seeded across 4 roles
- 3 projects: DQM (Scrum), WEB (Kanban), INT (Scrum)
- 3 DQM sprints: Sprint 21 (42sp), Sprint 22 (44sp), Sprint 23 (active)
- 18+ tasks with realistic content, assignees, reporters, comments
- Seed script: `scripts/simulate-wave1-pixelcraft.sh`

---

## Wave 2 — Completed ✅

**Adoption Readiness after Wave 2:** 7.8/10

### P1 Issues Fixed
| # | Issue | Fix |
|---|---|---|
| P1-1 | Lack of team collaboration features | @Mentions + notification system (NotificationService + NotificationController) |
| P1-2 | Board overwhelming with many tasks | BoardFilters component + 6 filter types (search, assignees, labels, priority, status, type) |
| P1-3 | Repetitive single-task updates | BulkOperations component + bulk update support (status, priority, assignee, sprint) |
| P1-4 | Backlog management inflexible | Drag-and-drop reordering with task order persistence |
| P1-5 | No real-time feedback | Real-time notifications on mentions and assignments |

### Features Delivered
- @Mentions in comments trigger notifications for mentioned users
- Real-time notification system (create, retrieve, mark as read, delete)
- Advanced board filter bar (6 filter types, multi-select support)
- Swimlane grouping (by assignee, priority, type) with collapsible UI
- Bulk task operations with checkbox selection (4 operations)
- Backlog drag-and-drop reordering with order persistence
- 5+ new API endpoints (notifications + reordering)

---

## Wave 3 — Pending 🔜

**Theme:** Advanced Project Management

### Features Planned
- 3.1 Epic hierarchy — stories/tasks under epics
- 3.2 Task dependencies (blocked_by, relates_to, duplicates)
- 3.3 Time tracking UI (log work modal, timesheet view)
- 3.4 Custom workflow states per project
- 3.5 Per-project role assignments (Jira project roles parity)

---

## Wave 4 — Pending 🔜

**Theme:** Reporting & Market Differentiators

### Features Planned
- 4.1 Dashboard: project health, team velocity, cycle time
- 4.2 Cumulative flow diagram
- 4.3 Sprint reports (release notes auto-generation)
- 4.4 Export: CSV, PDF, Confluence-style page
- 4.5 Competitive differentiator: integrated time tracking vs Jira+Tempo ($5/user/mo)

---

## Simulation Credentials (Always Current)

> **Run seed script to reset and re-populate:** `bash scripts/simulate-wave1-pixelcraft.sh`
> ⚠️ Script clears ALL data first.

### Platform Admin
| Email | Auth | Role |
|---|---|---|
| `platform@nexora.io` | OTP: `000000` | platform_admin |

### PixelCraft Studios Admin
| Email | Password | Role |
|---|---|---|
| `aditya.malhotra@pixelcraft.studio` | `Nexora@Admin1` | admin |

### Managers
| Email | Password | Title |
|---|---|---|
| `kavya.rao@pixelcraft.studio` | `Nexora@Kavya1` | Engineering Lead |
| `nikhil.verma@pixelcraft.studio` | `Nexora@Nikhil1` | Product Manager |
| `anjali.shetty@pixelcraft.studio` | `Nexora@Anjali1` | Scrum Master |
| `naina.sharma@pixelcraft.studio` | `Nexora@Naina1` | QA Lead |

### Members (sample — see wave-1 report for full list)
| Email | Password | Title |
|---|---|---|
| `rohan.deshmukh@pixelcraft.studio` | `Nexora@Rohan1` | Sr Unity Developer |
| `arjun.nambiar@pixelcraft.studio` | `Nexora@Arjun1` | Backend Developer |
| `meera.jain@pixelcraft.studio` | `Nexora@Meera1` | UI/UX Designer |
| `naina.sharma@pixelcraft.studio` | `Nexora@Naina1` | QA Lead |
| `pooja.menon@pixelcraft.studio` | `Nexora@Pooja1` | DevOps Engineer |

### Viewer
| Email | Password | Title |
|---|---|---|
| `maya.chen@dreamgames.corp` | `Nexora@Maya1` | Client — DreamGames Corp |
