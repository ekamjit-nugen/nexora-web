# Nexora — Platform Super Admin PRD

## Overview

Introduce a **platform-level super admin** role that sits *above* all organizations. This user can view and manage every organization on the platform, access cross-org analytics, and perform administrative operations — but **cannot** access data that is personal/private to an organization (e.g., chat messages, internal documents, employee personal details beyond what's needed for administration).

---

## Current State

| Aspect | How It Works Today |
|---|---|
| **super_admin role** | Org-scoped. Seeded via `seed-roles.sh` for a single org. Behaves like a powerful org admin — no cross-org visibility. |
| **JWT payload** | Contains a single `organizationId`. All service queries filter by this org. |
| **User.roles[]** | Global array of role names (e.g., `['admin', 'super_admin']`) but enforcement is org-scoped. |
| **API Gateway** | Extracts `organizationId` from JWT and forwards as `x-organization-id` header. |
| **Service filtering** | `if (orgId) filter.organizationId = orgId` — no org filter when `orgId` is null, but this is a gap, not a feature. |

**Gap**: There is no concept of a *platform-level* admin who can operate across organizations.

---

## Proposed Architecture

### 1. New Role: `platform_admin`

A new role type that is **not org-scoped**. It lives at the platform level and is stored differently from org roles.

| Field | Value |
|---|---|
| `name` | `platform_admin` |
| `scope` | `platform` (new field) |
| `organizationId` | `null` |
| `isSystem` | `true` |
| `isActive` | `true` |

#### User Schema Changes

```typescript
// Add to User schema
isPlatformAdmin: { type: Boolean, default: false, index: true }
```

- `isPlatformAdmin` is the single source of truth — simpler than checking role arrays for cross-org logic.
- This flag is **only** set via database seed or CLI command, never via the UI (prevents privilege escalation).

#### JWT Payload Changes

```typescript
{
  sub: user._id,
  email: user.email,
  roles: user.roles,
  organizationId: orgId || null,
  isPlatformAdmin: true  // NEW — only present for platform admins
}
```

When `isPlatformAdmin: true`:
- `organizationId` can be `null` (platform-wide view) or set to a specific org (scoped view).
- Services detect this flag and bypass org filtering for authorized endpoints.

---

### 2. Access Levels & Boundaries

#### What Platform Admin CAN Do

| Category | Access | Details |
|---|---|---|
| **Organizations** | Full CRUD | Create, view, edit, suspend, delete (soft) any org |
| **Organization Settings** | View & Edit | Plan, billing status, feature flags, limits |
| **User Accounts** | View & Manage | List all users, disable/enable accounts, reset auth, force logout |
| **Org Membership** | View | See who belongs to which org, their roles |
| **Roles (platform)** | Full CRUD | Manage platform-level roles |
| **Roles (org)** | View Only | See org role configurations (cannot modify) |
| **Departments** | View Only | See department structure across orgs |
| **Employee Directory** | View (limited) | Name, email, role, department, status — no personal details (phone, address, salary, emergency contacts) |
| **Attendance Summary** | View (aggregated) | Org-level attendance stats, not individual clock-in/out |
| **Leave Summary** | View (aggregated) | Org-level leave stats, not individual leave reasons |
| **Projects** | View (metadata) | Project name, status, team size, dates — not tasks/comments |
| **Policies** | View Only | See what policies each org has configured |
| **Platform Analytics** | Full | Cross-org dashboards: total users, active orgs, usage metrics |
| **Audit Logs** | Full | All platform-level actions (org creation, user disabling, plan changes) |
| **System Health** | Full | Service health, database stats, queue metrics |

#### What Platform Admin CANNOT Do

| Category | Restriction | Reason |
|---|---|---|
| **Chat Messages** | No access | Private org communication |
| **Task Comments** | No access | Internal work discussions |
| **Employee Personal Data** | No access | Phone, address, salary, bank details, emergency contacts |
| **Individual Attendance** | No access | Specific clock-in/out times of employees |
| **Leave Details** | No access | Individual leave reasons, medical certificates |
| **Invoices/Expenses** | No access | Financial data is org-private |
| **File Uploads** | No access | Documents, attachments within org |
| **Modify Org Roles** | No access | Org admins own their role configuration |
| **Create Content in Org** | No access | Cannot create tasks, projects, policies *as if* they were an org member |
| **Impersonate Users** | No access (v1) | Future consideration with full audit trail |

---

### 3. Backend Implementation Plan

#### Phase 1: Auth Service Changes

**Files to modify:**
- `services/auth-service/src/auth/schemas/user.schema.ts` — Add `isPlatformAdmin` field
- `services/auth-service/src/auth/auth.service.ts` — Include `isPlatformAdmin` in JWT payload
- `services/auth-service/src/auth/strategies/jwt.strategy.ts` — Extract `isPlatformAdmin` from payload

**New files:**
- `services/auth-service/src/auth/guards/platform-admin.guard.ts` — Guard that checks `req.user.isPlatformAdmin`
- `services/auth-service/src/auth/platform-admin.controller.ts` — Platform admin endpoints
- `services/auth-service/src/auth/platform-admin.service.ts` — Platform admin business logic

**New guard:**
```typescript
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.isPlatformAdmin === true;
  }
}
```

#### Phase 2: Platform Admin API Endpoints

All prefixed with `/api/v1/platform/` and protected by `PlatformAdminGuard`.

| Endpoint | Method | Description |
|---|---|---|
| `/platform/organizations` | GET | List all organizations (paginated, filterable) |
| `/platform/organizations/:id` | GET | Organization details (settings, plan, member count) |
| `/platform/organizations/:id` | PUT | Update org settings (plan, limits, active status) |
| `/platform/organizations/:id/suspend` | POST | Suspend an organization |
| `/platform/organizations/:id/activate` | POST | Reactivate a suspended organization |
| `/platform/organizations/:id/members` | GET | List org members (limited fields) |
| `/platform/organizations/:id/stats` | GET | Org-level aggregated stats |
| `/platform/users` | GET | List all platform users (paginated) |
| `/platform/users/:id` | GET | User details (cross-org memberships) |
| `/platform/users/:id/disable` | POST | Disable user account |
| `/platform/users/:id/enable` | POST | Enable user account |
| `/platform/users/:id/reset-auth` | POST | Force password/OTP reset |
| `/platform/analytics` | GET | Platform-wide analytics |
| `/platform/analytics/usage` | GET | Usage trends over time |
| `/platform/analytics/growth` | GET | Org/user growth metrics |
| `/platform/health` | GET | Detailed system health |
| `/platform/audit-logs` | GET | Platform audit log (paginated) |

#### Phase 3: API Gateway Routing

Add to `services/api-gateway/src/main.ts` ROUTES array:

```typescript
{ path: '/api/v1/platform', target: 'http://auth-service:3001' }
```

Platform endpoints live in auth-service since they primarily deal with users and organizations.

#### Phase 4: Cross-Service Aggregation

For stats that span multiple services (attendance summary, project counts), the platform admin service calls other services internally:

```typescript
// platform-admin.service.ts
async getOrgStats(orgId: string): Promise<OrgStats> {
  const [employees, attendance, projects] = await Promise.all([
    this.httpService.get(`http://hr-service:3010/api/v1/employees/stats?orgId=${orgId}`),
    this.httpService.get(`http://attendance-service:3011/api/v1/attendance/stats?orgId=${orgId}`),
    this.httpService.get(`http://project-service:3020/api/v1/projects/stats?orgId=${orgId}`),
  ]);
  return { employees: employees.data, attendance: attendance.data, projects: projects.data };
}
```

Each downstream service exposes a `/stats` endpoint that accepts `orgId` as a query param (only when called internally — not exposed via gateway to regular users).

#### Phase 5: Audit Logging

**New schema: `AuditLog`** (in auth-service)

```typescript
{
  action: String,        // 'org.suspend', 'user.disable', 'org.plan_change'
  performedBy: String,   // Platform admin userId
  targetType: String,    // 'organization', 'user'
  targetId: String,
  details: Mixed,        // { before: {...}, after: {...} }
  ipAddress: String,
  timestamp: Date
}
```

Every platform admin action is logged with before/after state.

---

### 4. Frontend Implementation Plan

#### New Route: `/platform`

Only accessible when `user.isPlatformAdmin === true`. Separate layout from org-scoped pages.

| Route | Description |
|---|---|
| `/platform` | Dashboard — org count, user count, active users, growth charts |
| `/platform/organizations` | Organization list — search, filter by plan/status/industry, sort |
| `/platform/organizations/:id` | Org detail — settings, member list, usage stats, actions (suspend/activate) |
| `/platform/users` | User list — search, filter by status, cross-org view |
| `/platform/users/:id` | User detail — memberships, activity, actions (disable/enable/reset) |
| `/platform/analytics` | Charts — growth, engagement, feature adoption, revenue by plan |
| `/platform/audit-logs` | Searchable log table with filters |
| `/platform/health` | Service status, DB metrics, uptime |

#### Sidebar Changes

When `isPlatformAdmin` is detected, show an additional **PLATFORM** section at the top of sidebar:

```typescript
{
  title: "PLATFORM",
  roles: [], // Not role-based — uses isPlatformAdmin flag
  isPlatformOnly: true,
  items: [
    { label: "Platform Dashboard", href: "/platform", icon: LayoutGrid },
    { label: "Organizations", href: "/platform/organizations", icon: Building2 },
    { label: "All Users", href: "/platform/users", icon: Users },
    { label: "Analytics", href: "/platform/analytics", icon: BarChart3 },
    { label: "Audit Logs", href: "/platform/audit-logs", icon: ScrollText },
    { label: "System Health", href: "/platform/health", icon: Activity },
  ]
}
```

A platform admin can also switch into a specific org's view (read-only) to see what org admins see — using the existing org switcher but with a "Platform View" badge.

#### Auth Context Changes

```typescript
// Add to AuthContext
isPlatformAdmin: boolean;

// Computed from user object
const isPlatformAdmin = user?.isPlatformAdmin === true;
```

---

### 5. Data Access Matrix

| Data Type | Platform Admin Access | Fields Visible | Fields Hidden |
|---|---|---|---|
| Organization | Full | All settings, plan, billing status | — |
| User Account | Full (management) | Email, name, status, orgs, roles, last login | Password hash, MFA secrets |
| Employee | Limited | Name, email, department, designation, status | Phone, address, salary, bank, emergency contacts |
| Attendance | Aggregated | Org totals, averages, trends | Individual clock-in/out records |
| Leaves | Aggregated | Org leave usage stats | Individual leave applications, reasons |
| Projects | Metadata | Name, status, team count, dates | Tasks, comments, files |
| Policies | View | Policy type, rules, applicability | — |
| Chat | None | — | Everything |
| Invoices | None | — | Everything |
| Files/Docs | None | — | Everything |

---

### 6. Security Considerations

1. **No UI for granting platform admin** — Only via DB seed script or secure CLI tool
2. **Separate JWT claim** — `isPlatformAdmin` in token, verified server-side
3. **Rate limiting** — Platform admin endpoints have stricter rate limits (prevents data scraping)
4. **IP allowlisting** (optional) — Platform admin login restricted to known IPs
5. **Mandatory MFA** — Platform admin accounts require MFA enabled
6. **Audit everything** — Every action logged with IP, timestamp, before/after state
7. **Session timeout** — Shorter session for platform admin (1 hour vs 7 days)
8. **No org data mutation** — Platform admin cannot create/edit/delete data within an org's namespace

---

### 7. Seed Script

```bash
# scripts/seed-platform-admin.sh
# Creates a platform admin user (DEV_ONLY)

curl -X POST http://localhost:3005/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "platform@nexora.io",
    "firstName": "Platform",
    "lastName": "Admin"
  }'

# Then set isPlatformAdmin via direct DB update (no API for this)
docker exec -it nexora-mongodb mongosh -u root -p nexora_dev_password \
  --eval 'db.getSiblingDB("nexora_auth").users.updateOne(
    { email: "platform@nexora.io" },
    { $set: { isPlatformAdmin: true } }
  )'
```

**Test credentials:**
| Email | OTP (dev) | Role |
|---|---|---|
| platform@nexora.io | 000000 | Platform Admin |

---

### 8. Implementation Phases

| Phase | Scope | Effort |
|---|---|---|
| **Phase 1** | User schema + JWT changes + PlatformAdminGuard | 1 sprint |
| **Phase 2** | Organization management endpoints (list, view, suspend) | 1 sprint |
| **Phase 3** | User management endpoints (list, view, disable/enable) | 1 sprint |
| **Phase 4** | Frontend — platform layout, org list, user list | 1-2 sprints |
| **Phase 5** | Cross-service stats aggregation + analytics dashboard | 1 sprint |
| **Phase 6** | Audit logging + audit log viewer | 1 sprint |
| **Phase 7** | System health dashboard | 0.5 sprint |

**Total: ~6-7 sprints**

---

### 9. Future Considerations (Not in v1)

- **User impersonation** — "View as" feature to debug org issues (with full audit)
- **Feature flags per org** — Enable/disable features for specific orgs
- **Billing integration** — Stripe/payment gateway for plan management
- **Multi-level platform roles** — platform_viewer (read-only), platform_support (limited actions), platform_admin (full)
- **Org templates** — Pre-configured org setups for different industries
- **Data export** — Platform-wide data export for compliance/reporting
- **Webhook management** — Configure platform-level webhooks for org events
