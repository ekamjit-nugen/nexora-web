# PRD: Authentication & Organization Management

**Module:** Auth Service
**Version:** 1.0
**Date:** 2026-04-06
**Status:** Implemented
**Service:** `services/auth-service` (Port 3001)
**Owner:** Nexora Platform Team

---

## 1. Purpose

The Auth module provides identity management, multi-tenant organization support, role-based access control, and onboarding workflows for the Nexora platform. It enables users to authenticate via OTP, password, or OAuth, manage organizations, invite team members, and control access to platform features through a granular permission system.

---

## 2. Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Frictionless onboarding | < 3 minutes from first OTP to dashboard |
| Secure authentication | Zero plaintext credentials; all tokens rotated |
| Multi-tenancy | Users operate across multiple orgs without data leakage |
| Compliance readiness | 365-day audit trail for all auth/org events |
| Invite-driven growth | Team invites convert > 60% within 7 days |

---

## 3. User Personas

| Persona | Description | Primary Flows |
|---------|-------------|---------------|
| **New User** | First-time visitor, no account | OTP signup → org creation → profile → invite team |
| **Invited User** | Received email invitation | Validate invite → OTP verify → accept → dashboard |
| **Returning User** | Existing account, single org | OTP/password login → dashboard |
| **Multi-Org User** | Member of 2+ organizations | Login → select organization → dashboard |
| **Org Admin** | Manages org settings, members, roles | Member management, role assignment, settings config |
| **Org Owner** | Created the organization | Full control including danger zone (delete org) |
| **Platform Admin** | Nexora platform operator | Cross-org visibility, platform-level admin |

---

## 4. Authentication Methods

### 4.1 Passwordless OTP (Primary)

The default and recommended authentication method.

**Flow:**
1. User enters email → `POST /auth/send-otp`
2. System generates 6-digit OTP, hashes with SHA256, emails to user
3. User enters OTP → `POST /auth/verify-otp`
4. System validates OTP, creates/finds user, returns JWT + refresh token
5. Frontend routes user based on `setupStage` and org membership

**Security Controls:**
- OTP hashed with SHA256 (never stored in plaintext)
- 10-minute expiry window
- 30-second cooldown between requests
- Max 5 requests per email per hour
- Max 5 verification attempts before 15-minute lockout
- Time-safe comparison to prevent timing attacks

### 4.2 Password-Based Login

Traditional email/password authentication with optional MFA.

**Registration Requirements:**
- Email: valid format, unique
- Password: 8+ characters, must include uppercase, lowercase, digit, and special character
- First name, last name: 2-50 characters each

**Login Security:**
- Passwords hashed with bcrypt (salt rounds: 10)
- Max 5 failed attempts → 30-minute account lockout
- Counter resets on successful login
- Optional `organizationId` to scope login to specific org

### 4.3 OAuth (Google & Microsoft)

**Supported Providers:**
- Google OAuth 2.0 (profile + email scopes)
- Microsoft Azure AD (profile + email scopes)

**Flow:**
1. User clicks provider button → redirect to provider
2. Provider authenticates → callback to `/auth/oauth/{provider}/callback`
3. System creates or links user account via `oauthProviders` field
4. Returns JWT + refresh token

### 4.4 SAML 2.0

Enterprise SSO for organizations requiring SAML-based authentication.

**Flow:**
1. Initiate via `GET /auth/saml/login`
2. Redirect to Identity Provider
3. IDP posts assertion to `POST /auth/saml/callback`
4. System validates assertion signature, maps attributes to user

### 4.5 Multi-Factor Authentication (MFA)

**Supported Methods:**
- TOTP (Google Authenticator, Authy)
- SMS-based codes
- Email-based codes

**Features:**
- Setup generates secret + QR code
- Backup codes for recovery (encrypted storage)
- Can be enabled/disabled per user
- Verified during login when enabled

---

## 5. Token Architecture

### 5.1 Access Token (JWT)

| Field | Description |
|-------|-------------|
| `sub` | User ID |
| `email` | User email |
| `firstName`, `lastName` | Display name |
| `roles` | User's global roles |
| `organizationId` | Active organization (or null) |
| `orgRole` | Role within active organization |
| `setupStage` | Current onboarding stage |
| `isPlatformAdmin` | Platform-level admin flag |
| `family` | Token family for rotation tracking |

- **Expiry:** 15 minutes (configurable via `JWT_EXPIRY`)
- **Signing:** HMAC with `JWT_SECRET`

### 5.2 Refresh Token

| Field | Description |
|-------|-------------|
| `sub` | User ID |
| `family` | Token family identifier |

- **Expiry:** 7 days
- **Storage:** Session record in MongoDB with TTL auto-cleanup

### 5.3 Token Rotation

Refresh tokens use family-based rotation to detect reuse attacks:

1. Client sends refresh token
2. Server validates token, looks up session by family
3. If session is revoked → **token reuse detected** → revoke all user sessions
4. If valid → create new family, issue new token pair, revoke old session
5. Client receives fresh access + refresh tokens

### 5.4 CSRF Protection

- Server generates 32-byte random hex token
- Set as `XSRF-TOKEN` cookie
- Client sends back as `X-XSRF-TOKEN` header on mutating requests
- Server validates header matches cookie on POST/PUT/DELETE/PATCH

---

## 6. Session Management

### 6.1 Session Schema

Each login creates a session record:
- `userId` — owner of the session
- `refreshTokenFamily` — unique family ID (enables rotation)
- `deviceInfo` — browser/device identification
- `ipAddress` — client IP
- `isRevoked` — revocation status
- `lastUsedAt` — last token refresh timestamp
- `expiresAt` — 7-day TTL (auto-deleted by MongoDB)

### 6.2 Session Operations

| Endpoint | Action |
|----------|--------|
| `GET /auth/sessions` | List all active sessions for current user |
| `DELETE /auth/sessions/:id` | Revoke a specific session |
| `DELETE /auth/sessions` | Revoke all sessions except current |

---

## 7. Multi-Tenancy & Organizations

### 7.1 Organization Model

Organizations are the primary tenant boundary in Nexora.

**Core Fields:**
- Name, slug (URL-friendly, unique), industry, size, plan
- Location: country, state, city
- Owner: `createdBy` user ID

**Plan Tiers:** `free` | `starter` | `professional` | `enterprise`

**Size Categories:** `1-10` | `11-50` | `51-200` | `201-500` | `500+`

### 7.2 Regional Settings

| Setting | Default | Options |
|---------|---------|---------|
| Timezone | Asia/Kolkata | IANA timezones |
| Currency | INR | ISO 4217 codes |
| Date Format | DD/MM/YYYY | DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD |
| Time Format | 12h | 12h, 24h |
| Number Format | Indian | Indian, International, European |
| Week Start | Monday | Monday, Sunday |
| Financial Year Start | April (4) | Any month |

### 7.3 Feature Flags

Each organization can enable/disable platform modules:

| Feature | Description |
|---------|-------------|
| `projects` | Project management |
| `tasks` | Task tracking |
| `sprints` | Sprint planning |
| `timesheets` | Time tracking |
| `attendance` | Attendance tracking |
| `leaves` | Leave management |
| `clients` | Client management |
| `invoices` | Invoice generation |
| `reports` | Reporting & analytics |
| `chat` | Team messaging |
| `calls` | Video/audio calling |
| `ai` | AI-powered features |
| `assetManagement` | Asset tracking |
| `expenseManagement` | Expense tracking |
| `recruitment` | Hiring pipeline |

### 7.4 Organization Settings Modules

**Business & Legal:**
- Registered address, communication address
- PAN, GSTIN, CIN, TAN
- MSME registration, IEC, Shops & Establishment license
- Contact emails (HR, Finance)
- Authorized signatory (name, designation, PAN, DIN)
- Bank details (encrypted account number)

**Payroll Configuration:**
- PF: registration number, employer/employee rates, wage ceiling
- ESI: registration number, rates, wage limit
- TDS: default tax regime, auto-calculation toggle
- PT: state-specific, deduction frequency
- LWF: state-specific, frequency
- Salary structure: configurable components
- Schedule: pay cycle, pay day, processing start, attendance cutoff

**Work Preferences:**
- Working days, Saturday pattern
- Working hours (start, end, break, effective)
- Flexible timing toggle
- Grace periods (late arrival, early departure)
- Overtime: applicable, rate, minimum trigger
- Attendance tracking: geo-fence, IP restriction, office locations, auto-checkout
- Holidays: annual holiday calendar
- Leave types: configurable leave policies

**Branding:**
- Logo (standard, dark, icon variants)
- Color scheme (primary, secondary, sidebar)
- Logo alignment
- Document templates (payslip header/footer, letter header/footer)

**Notifications:**
- Channels: in-app, email, desktop push, mobile push, internal chat
- Categories: attendance, leave, payroll, tasks, projects, members, system, announcements
- Escalation: pending reminder hours, auto-escalation days, auto-approve days

**Integrations:**
- Provider connections with status tracking
- Config per integration, sync timestamps
- Connected by user tracking

**Webhooks:**
- URL, events, secret key
- Active/inactive toggle
- Failure count tracking

### 7.5 Organization Switching

Multi-org users can switch active context:

1. `POST /auth/switch-org` with target `organizationId`
2. Server validates membership, generates new JWT scoped to target org
3. Returns fresh access + refresh tokens
4. Frontend updates `currentOrgId` in localStorage, refreshes UI

---

## 8. Membership & Roles

### 8.1 Organization Membership

Each user-org relationship is tracked via `OrgMembership`:

| Field | Description |
|-------|-------------|
| `userId` | User reference (null for email-only invites) |
| `organizationId` | Organization reference |
| `email` | Invite email (null if user exists) |
| `role` | Organization role |
| `status` | active, pending, invited, deactivated, removed, suspended |
| `inviteToken` | UUID for email invitations (7-day expiry) |
| `invitedBy` | User who sent the invite |
| `joinedAt` | Acceptance timestamp |

### 8.2 System Roles

| Role | Hierarchy | Description |
|------|-----------|-------------|
| `owner` | 100 | Organization creator, full control |
| `admin` | 90 | Administrative access |
| `hr` | 70 | People management |
| `manager` | 60 | Team oversight |
| `developer` | 40 | Technical contributor |
| `designer` | 40 | Design contributor |
| `employee` | 10 | Standard member |
| `member` | — | Default for new org users |
| `viewer` | — | Read-only access |

### 8.3 Custom Roles

Organizations can create custom roles with granular permissions:

**Resources (14):**
dashboard, employees, attendance, leaves, projects, tasks, departments, roles, policies, reports, invoices, expenses, clients, settings

**Actions per Resource (6):**
view, create, edit, delete, export, assign

**Example:** A "Team Lead" custom role might have:
- `employees: [view]`
- `tasks: [view, create, edit, assign]`
- `projects: [view]`
- `attendance: [view, export]`

### 8.4 Permission Enforcement

| Layer | Mechanism |
|-------|-----------|
| Route level | `@RequireRoles()` decorator + `RolesGuard` |
| Granular | `@RequirePermissions()` decorator + `PermissionsGuard` |
| Org boundary | `OrgMembershipGuard` validates active membership |
| Platform | `isPlatformAdmin` flag bypasses org checks |
| Frontend | `hasOrgRole()`, `isFeatureEnabled()` hide/show UI elements |

### 8.5 Settings Access Matrix

| Section | Owner | Admin | HR | Manager | Employee |
|---------|-------|-------|-----|---------|----------|
| Profile & Security | Yes | Yes | Yes | Yes | Yes |
| General Settings | Yes | Yes | Yes | — | — |
| Business & Legal | Yes | Yes | Yes | — | — |
| Work Preferences | Yes | Yes | Yes | — | — |
| Departments | Yes | Yes | Yes | — | — |
| Members | Yes | Yes | Yes | — | — |
| Payroll | Yes | Yes | — | — | — |
| Branding | Yes | Yes | — | — | — |
| Features | Yes | Yes | — | — | — |
| Integrations | Yes | Yes | — | — | — |
| Danger Zone | Yes | — | — | — | — |

---

## 9. Invitation System

### 9.1 Invite Flow

```
Admin invites user@example.com
  → Create OrgMembership (status: invited, inviteToken: UUID)
  → Create placeholder User (setupStage: invited) if new
  → Send branded HTML email with accept link
  → Token valid for 7 days

User clicks invite link
  → GET /auth/invites/:token/validate (check validity)
  → If not logged in → redirect to /login with postLoginRedirect
  → POST /auth/invites/:token/accept
    → Link membership to userId
    → Set status: active, joinedAt: now
    → Provision employee in HR service
    → Return tokens + redirect to /dashboard
```

### 9.2 Invite States

| State | Trigger |
|-------|---------|
| `invited` | Admin sends invite |
| `pending` | User created account but hasn't accepted |
| `active` | User accepted invitation |
| `removed` | User declined or admin removed |

### 9.3 Post-Signup Claim

When a user signs up with an email that has pending invitations:
- `MembershipService.claimPendingInvitations()` runs
- Links all email-matched OrgMembership records to the new userId
- User can then accept invitations from their account

---

## 10. Onboarding & Setup Flow

### 10.1 Setup Stages

| Stage | Meaning | Next Step |
|-------|---------|-----------|
| `otp_verified` | Email verified, no profile | Create organization |
| `org_created` | Organization exists, profile incomplete | Complete profile |
| `profile_complete` | Profile done, team not invited | Invite team |
| `complete` | Fully onboarded | Dashboard |
| `invited` | Arrived via invitation | Accept invite |

### 10.2 Post-Login Routing

The `CompletenessService.determinePostLoginRoute()` evaluates 7 cases:

| # | Condition | Route | Reason |
|---|-----------|-------|--------|
| 1 | setupStage=otp_verified + no orgs | `/auth/setup-organization` | new_user |
| 2 | setupStage=invited + pending membership | `/auth/accept-invite` | pending_invite |
| 3 | setupStage=org_created | `/auth/setup-profile` | incomplete_profile |
| 4 | setupStage=profile_complete | `/auth/invite-team` | incomplete_setup |
| 5 | setupStage=complete + 1 org | `/dashboard` | active_user |
| 6 | setupStage=complete + 2+ orgs | `/auth/select-organization` | multi_org |
| 7 | setupStage=complete + no active orgs | `/auth/setup-organization` | no_active_org |

### 10.3 Organization Setup Completeness

Weighted score (0-100%) across 6 categories:

| Category | Weight | Checks |
|----------|--------|--------|
| Basic Info | 15% | Name, type, size, country |
| Business Details | 20% | Address, pincode, PAN |
| Payroll Setup | 25% | PF registration, TDS/TAN |
| Work Configuration | 15% | Working days, hours, holidays |
| Branding | 10% | Logo uploaded |
| Team Setup | 15% | 2+ active members |

Dashboard widget displays progress and suggests next high-impact action.

---

## 11. HR Service Integration

Auth service provisions employees in the HR service upon org join/invite:

| Event | HR Action |
|-------|-----------|
| User creates org | Provision employee (role: owner) |
| User accepts invite | Provision employee with invite role |
| Profile completed | Sync name to employee record |
| Invite accepted | Sync status to active |

**Implementation:** Best-effort HTTP calls with 1-minute JWT tokens. Failures are logged but do not block auth operations.

---

## 12. Audit & Compliance

### 12.1 Tracked Events (60+)

**Authentication:** OTP_REQUESTED, OTP_VERIFIED, OTP_FAILED, ACCOUNT_LOCKED, USER_LOGIN, USER_LOGOUT, TOKEN_REFRESHED, SESSION_REVOKED, ALL_SESSIONS_REVOKED, MFA_SETUP, MFA_VERIFIED, MFA_DISABLED

**Organization:** ORG_CREATED, ORG_UPDATED, ORG_DELETED, DELETION_REQUESTED, DELETION_CANCELLED

**Members:** MEMBER_INVITED, INVITE_ACCEPTED, INVITE_DECLINED, INVITE_RESENT, MEMBER_ROLE_UPDATED, MEMBER_REMOVED, MEMBER_DEACTIVATED, MEMBER_REACTIVATED

**Roles:** ROLE_CREATED, ROLE_UPDATED, ROLE_DELETED, ROLE_ASSIGNED

**Settings:** SETTINGS_GENERAL_UPDATED, SETTINGS_BUSINESS_UPDATED, SETTINGS_PAYROLL_UPDATED, SETTINGS_WORK_PREFS_UPDATED, SETTINGS_BRANDING_UPDATED, SETTINGS_NOTIFICATIONS_UPDATED, SETTINGS_FEATURES_UPDATED, SETTINGS_INTEGRATIONS_UPDATED

### 12.2 Audit Record Fields

- `organizationId` — tenant context
- `userId` — who performed the action
- `targetUserId` — who was affected
- `action` — event type (enum)
- `resource`, `resourceId` — what was changed
- `details` — action-specific metadata (JSON)
- `ipAddress`, `userAgent` — client info
- `timestamp` — when it happened

### 12.3 Retention

- **TTL:** 365 days (MongoDB TTL index on `timestamp`)
- **Auto-cleanup:** Expired logs removed automatically

---

## 13. API Gateway Integration

### 13.1 Route Proxying

| Pattern | Target |
|---------|--------|
| `/api/v1/auth/*` | Auth Service (port 3001) |
| `/api/v1/settings/*` | Auth Service (port 3001) |
| `/api/v1/platform/*` | Auth Service (port 3001) |

### 13.2 Gateway Security

| Control | Configuration |
|---------|---------------|
| Rate Limit (Global) | 100 requests/minute |
| Rate Limit (Auth) | 5 requests/15 minutes |
| CORS | Origin validation via allowlist |
| Helmet | HSTS enabled, CSP disabled for multi-service |
| Compression | gzip enabled |
| Org Header | JWT decoded → `X-Organization-Id` injected |

---

## 14. Frontend Auth Architecture

### 14.1 Auth Context Provider

Central React Context managing:
- `user` — current authenticated user
- `currentOrg` — active organization
- `organizations` — all user organizations
- `orgRole` — role in active org
- `isPlatformAdmin` — platform admin flag
- `loading` — initialization state

**Key Methods:**
- `login()` / `logout()` — authentication
- `switchOrg(orgId)` — change active organization
- `hasOrgRole(minRole)` — role hierarchy check
- `isFeatureEnabled(feature)` — feature flag evaluation
- `handlePostOtpRoute()` — post-login routing

### 14.2 Token Storage

- `accessToken` in localStorage (sent as `Authorization: Bearer`)
- `refreshToken` in localStorage (used for token rotation)
- `currentOrgId` in localStorage (org context persistence)
- httpOnly cookies set by server (`nexora_token`, `nexora_refresh`)

### 14.3 Auth Pages

| Route | Purpose |
|-------|---------|
| `/login` | OTP entry, verification, inline onboarding |
| `/auth/setup-organization` | Create first organization |
| `/auth/setup-profile` | Complete profile (name, phone, job) |
| `/auth/invite-team` | Invite team members |
| `/auth/select-organization` | Choose active org (multi-org) |
| `/auth/accept-invite` | Accept org invitation |
| `/auth/access-denied` | Permission/membership error |

### 14.4 Login Page Phases

1. **Email** — enter email, send OTP
2. **Verify** — enter 6-digit OTP code
3. **Org Selection** — choose organization (if multiple)
4. **Welcome Splash** — new user greeting
5. **Profile** — complete name, phone, job title
6. **Org Setup** — create organization
7. **Team Setup** — invite team members
8. **Setting Up** — auto-redirect to dashboard

---

## 15. Error Handling

### 15.1 Response Format

**Success:**
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": { ... }
  }
}
```

### 15.2 Auth Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_CREDENTIALS` | Wrong email/password |
| `ACCOUNT_LOCKED` | Too many failed attempts |
| `INVALID_OTP` | Wrong or expired OTP |
| `OTP_EXPIRED` | OTP past 10-minute window |
| `RATE_LIMIT_OTP` | Exceeded 5 OTP requests/hour |
| `OTP_COOLDOWN` | Must wait 30 seconds |
| `INSUFFICIENT_PERMISSION` | Missing required role/permission |
| `NOT_ORG_MEMBER` | User not in organization |
| `USER_NOT_FOUND` | No user with given identifier |
| `ORGANIZATION_NOT_FOUND` | No org with given ID |
| `CONFLICT` | Duplicate user or invite |

---

## 16. Environment Configuration

### 16.1 Required

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Signing key for JWTs (fatal if missing) |

### 16.2 Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRY` | `15m` | Access token lifetime |
| `AUTH_SERVICE_PORT` | `3001` | Service listen port |
| `MONGODB_URI` | `mongodb://localhost:27017/nexora_auth` | Database connection |
| `FRONTEND_URL` | `http://localhost:3100` | Frontend URL for emails |
| `SMTP_HOST` | `mailhog` | Email server |
| `SMTP_PORT` | `1025` | Email server port |
| `HR_SERVICE_URL` | `http://hr-service:3010` | HR service for provisioning |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client |
| `MICROSOFT_CLIENT_ID` | — | Microsoft OAuth client |

---

## 17. API Reference

### 17.1 Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/send-otp` | No | Send OTP to email |
| POST | `/auth/verify-otp` | No | Verify OTP, get tokens |
| POST | `/auth/register` | No | Register with password |
| POST | `/auth/login` | No | Login with password |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Revoke current session |
| GET | `/auth/me` | Yes | Get current user |
| PUT | `/auth/me` | Yes | Update profile |
| POST | `/auth/complete-profile` | Yes | Complete new user profile |
| POST | `/auth/change-password` | Yes | Change password |
| GET | `/auth/preferences` | Yes | Get user preferences |
| PUT | `/auth/preferences` | Yes | Update preferences |
| PUT | `/auth/setup-stage` | Yes | Update setup stage |
| POST | `/auth/check-email` | No | Check email for orgs |

### 17.2 Session Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/sessions` | Yes | List active sessions |
| DELETE | `/auth/sessions/:id` | Yes | Revoke specific session |
| DELETE | `/auth/sessions` | Yes | Revoke all except current |

### 17.3 MFA Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/mfa/setup` | Yes | Setup MFA (TOTP/SMS/EMAIL) |
| POST | `/auth/mfa/verify` | Yes | Verify MFA code |
| DELETE | `/auth/mfa` | Yes | Disable MFA |

### 17.4 Organization Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/organizations` | Yes | Create organization |
| GET | `/auth/organizations/my` | Yes | List user's orgs |
| GET | `/auth/organizations/:id` | Yes | Get org details |
| PUT | `/auth/organizations/:id` | Yes | Update org |
| DELETE | `/auth/organizations/:id` | Yes | Soft-delete org |
| POST | `/auth/switch-org` | Yes | Switch active org |
| POST | `/auth/organizations/:id/invite` | Yes | Invite member |
| POST | `/auth/organizations/:id/join` | Yes | Join org |
| GET | `/auth/organizations/:id/members` | Yes | List members |
| PUT | `/auth/organizations/:id/members/:mid` | Yes | Update member role |
| DELETE | `/auth/organizations/:id/members/:mid` | Yes | Remove member |
| POST | `/auth/organizations/:id/resend-invite` | Yes | Resend invite email |
| PUT | `/auth/organizations/:id/onboarding` | Yes | Update onboarding step |

### 17.5 Invite Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/invites/:token/validate` | Yes | Validate invite token |
| POST | `/auth/invites/:token/accept` | Yes | Accept invitation |
| POST | `/auth/invites/:token/decline` | Yes | Decline invitation |

### 17.6 Role Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/roles` | Yes | Create custom role |
| GET | `/auth/roles` | Yes | List org roles |
| GET | `/auth/roles/:id` | Yes | Get role details |
| PUT | `/auth/roles/:id` | Yes | Update role |
| DELETE | `/auth/roles/:id` | Yes | Delete role |
| PUT | `/auth/users/:id/roles` | Yes | Assign roles to user |
| GET | `/auth/users` | Yes | List org users |

### 17.7 Member Status Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/organizations/:orgId/members/:userId/deactivate` | Yes | Deactivate member |
| POST | `/auth/organizations/:orgId/members/:userId/reactivate` | Yes | Reactivate member |

### 17.8 Settings Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/PUT | `/settings/general` | Yes | Org general settings |
| GET | `/settings/general/check-slug` | Yes | Check slug availability |
| GET/PUT | `/settings/business` | Yes | Business & legal details |
| GET/PUT | `/settings/payroll` | Yes | Payroll configuration |
| GET/PUT | `/settings/work-preferences` | Yes | Work hours, holidays, leaves |
| GET/PUT | `/settings/branding` | Yes | Logo, colors, templates |
| GET/PUT | `/settings/notifications` | Yes | Notification preferences |
| GET/PUT | `/settings/features` | Yes | Feature flag toggles |
| GET/PUT | `/settings/departments` | Yes | Department management |
| GET/PUT | `/settings/integrations` | Yes | Third-party integrations |

### 17.9 OAuth & SAML Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/oauth/google` | No | Initiate Google OAuth |
| GET | `/auth/oauth/google/callback` | No | Google callback |
| GET | `/auth/oauth/microsoft` | No | Initiate Microsoft OAuth |
| GET | `/auth/oauth/microsoft/callback` | No | Microsoft callback |
| GET | `/auth/saml/login` | No | Initiate SAML login |
| POST | `/auth/saml/callback` | No | SAML assertion callback |

---

## 18. Data Models

### 18.1 User

| Field | Type | Notes |
|-------|------|-------|
| `email` | string | Unique, lowercase |
| `password` | string | Bcrypt hashed, optional for OAuth/OTP |
| `firstName`, `lastName` | string | Required |
| `avatar` | string | Optional URL |
| `phoneNumber` | string | Optional |
| `isEmailVerified` | boolean | — |
| `isPhoneVerified` | boolean | — |
| `mfaEnabled` | boolean | — |
| `mfaMethod` | enum | TOTP, SMS, EMAIL |
| `loginAttempts` | number | Max 5 |
| `lockUntil` | Date | 30-min lockout |
| `isActive` | boolean | — |
| `setupStage` | enum | otp_verified, org_created, profile_complete, complete, invited |
| `defaultOrganizationId` | string | Active org |
| `organizations` | string[] | All org IDs |
| `roles` | string[] | Global roles |
| `permissions` | string[] | — |
| `isPlatformAdmin` | boolean | — |
| `oauthProviders` | object | Google, Microsoft, SAML provider data |
| `preferences` | object | Theme, language, timezone, notifications |
| `otp`, `otpExpiresAt` | string, Date | SHA256 hashed OTP |

### 18.2 Organization

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Required |
| `slug` | string | Unique, URL-friendly |
| `industry`, `size`, `type` | string | Organization metadata |
| `plan` | enum | free, starter, professional, enterprise |
| `settings` | object | Timezone, currency, date/time/number format |
| `features` | object | 15 feature flags |
| `business` | object | Legal, tax, bank details |
| `payroll` | object | PF, ESI, TDS, PT, LWF, salary structure |
| `workPreferences` | object | Hours, attendance, holidays, leaves |
| `branding` | object | Logo, colors, templates |
| `notifications` | object | Channels, categories, escalation |
| `integrations` | array | Third-party connections |
| `webhooks` | array | Event webhooks |
| `onboardingCompleted` | boolean | — |
| `isActive`, `isDeleted` | boolean | Soft delete support |

### 18.3 OrgMembership

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Null for email-only invites |
| `organizationId` | string | Required |
| `email` | string | For pending invites |
| `role` | enum | owner, admin, hr, manager, developer, designer, employee, member, viewer |
| `status` | enum | active, pending, invited, deactivated, removed, suspended |
| `inviteToken` | string | UUID, 7-day expiry |
| `invitedBy` | string | Inviter user ID |

### 18.4 Session

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Required |
| `refreshTokenFamily` | string | Unique, rotation tracking |
| `deviceInfo` | string | Browser/device |
| `ipAddress` | string | Client IP |
| `isRevoked` | boolean | — |
| `expiresAt` | Date | 7-day TTL |

### 18.5 Role

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Unique per org |
| `displayName` | string | Human-readable |
| `permissions` | array | { resource, actions[] } pairs |
| `organizationId` | string | Null for system roles |
| `isSystem` | boolean | Platform-provided |

### 18.6 Audit Log

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | string | Tenant context |
| `userId` | string | Performer |
| `targetUserId` | string | Affected user |
| `action` | enum | 60+ event types |
| `resource`, `resourceId` | string | Changed entity |
| `details` | object | Action metadata |
| `ipAddress`, `userAgent` | string | Client info |
| `timestamp` | Date | 365-day TTL |

---

## 19. Security Summary

| Layer | Mechanism |
|-------|-----------|
| Password storage | Bcrypt (10 salt rounds) |
| OTP storage | SHA256 hash |
| Token signing | HMAC-SHA256 via JWT_SECRET |
| Token rotation | Family-based, reuse detection |
| Rate limiting | Gateway: 5 auth requests/15 min |
| OTP rate limiting | 5/hour, 30s cooldown, 5 attempt lockout |
| Login lockout | 5 failures → 30 min |
| CSRF | Random 32-byte token, header validation |
| Session TTL | 7-day auto-expiry |
| Audit retention | 365-day TTL |
| Org isolation | JWT claims + membership guards |
| Encryption | Bank account numbers encrypted at rest |

---

## 20. Known Constraints & Future Considerations

| Area | Current State | Consideration |
|------|---------------|---------------|
| Data isolation | Soft multi-tenancy (orgId filtering) | Hard isolation for enterprise tier |
| Password for OTP users | Optional | May need enforcement for sensitive orgs |
| OAuth providers | Google, Microsoft | Add GitHub, Apple, LinkedIn |
| SAML | Basic implementation | Per-org SAML configuration |
| Session limits | No max concurrent sessions | Add configurable session cap |
| Audit export | No export endpoint | Add CSV/JSON export for compliance |
| Rate limiting | Gateway-level only | Add per-user, per-org limits |
| Token storage | localStorage | Migration to httpOnly-only (Wave 1.1 in progress) |
| Role inheritance | Manual assignment only | Add hierarchical permission inheritance |

---

*Generated by Krillin — Nexora Documentation Agent*
*Last verified against codebase: 2026-04-06*
