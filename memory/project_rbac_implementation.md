---
name: RBAC Implementation Status
description: Status of the RBAC and Access Control implementation for Nexora platform
type: project
---

RBAC implementation completed (Phase 1 & 2) on 2026-03-30.

**Why:** Required before any real users access the platform (security hardening, Wave 2).

**What was implemented:**

### Phase 1: Backend RBAC
- `auth-service`: Injected `OrgMembership` model into `AuthService`, updated `generateTokens()` to include `orgRole` in JWT payload by looking up the user's membership in the org.
- All `jwt-auth.guard.ts` files (project-service, task-service): Updated to expose `orgRole` and `isPlatformAdmin` from JWT on `request.user`.
- Created `roles.guard.ts` in `project-service` and `task-service` with `@Roles()` decorator factory using `SetMetadata`.
- Added `RolesGuard` and `Reflector` to `project.module.ts` and `task.module.ts` providers.
- Applied `@Roles()` decorators to all endpoints in `project.controller.ts`, `task.controller.ts`, `sprint.controller.ts`.
- Added ownership check in `task.service.ts#updateTask()` — members can only edit tasks they created or are assigned to.

### Phase 2: Frontend RBAC
- `auth-context.tsx`: Added `orgRole` state (decoded from JWT), `hasOrgRole(minRole)` and `isProjectRole(team, minRole)` helpers using role hierarchy `['viewer','member','manager','admin','owner']`.
- Created `frontend/src/components/route-guard.tsx` — `<RouteGuard minOrgRole="admin">` or `<RouteGuard requirePlatformAdmin>` wraps pages.
- Updated `sidebar.tsx`: Changed `roles[]` arrays to `minRole` string, uses `hasOrgRole()` for filtering sections and items.
- Updated `projects/page.tsx`: Conditionally shows New Project button (manager+), Edit/Delete menu options (admin+/manager+).
- Updated `projects/[id]/page.tsx`: Conditionally shows New Sprint (manager+), Add Item (member+), Edit/Delete project menu (manager+/admin+). Passed `canCreateTask` and `canManageProject` props to `BoardView` and `PlanningView` components.
- Updated `tasks/page.tsx`: "All Tasks" tab only visible to manager+.

**Phase 3 (Feature Flags) — NOT YET IMPLEMENTED.**

**How to apply:** When adding new features or pages, use `<RouteGuard minOrgRole="...">` on pages and `hasOrgRole()`/`isProjectRole()` for conditional UI. On backend, add `@Roles('manager', 'admin', 'owner')` decorators to NestJS controller endpoints.
