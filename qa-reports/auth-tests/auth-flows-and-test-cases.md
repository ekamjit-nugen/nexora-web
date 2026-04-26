# Nexora Auth Flows & QA Test Cases

**Date:** 2026-04-17
**Scope:** 2 organizations, 10 members each, full auth lifecycle
**Environment:** API Gateway `localhost:3005`, MailHog `localhost:8025`

---

## Test Data

### Organization 1: Alpha Corp

| # | Email | Name | Role | Type |
|---|---|---|---|---|
| 1 | owner.alpha@test.nexora.io | Alice Alpha | owner | Org creator |
| 2 | dev1.alpha@test.nexora.io | Bob Builder | developer | New user invite |
| 3 | dev2.alpha@test.nexora.io | Charlie Coder | developer | New user invite |
| 4 | lead.alpha@test.nexora.io | Diana Lead | manager | New user invite |
| 5 | hr.alpha@test.nexora.io | Eve HR | hr | New user invite |
| 6 | admin.alpha@test.nexora.io | Frank Admin | admin | New user invite |
| 7 | design.alpha@test.nexora.io | Grace Designer | designer | New user invite |
| 8 | intern1.alpha@test.nexora.io | Hank Intern | employee | New user invite |
| 9 | intern2.alpha@test.nexora.io | Ivy Intern | employee | New user invite |
| 10 | viewer.alpha@test.nexora.io | Jack Viewer | viewer | New user invite |

### Organization 2: Beta Labs

| # | Email | Name | Role | Type |
|---|---|---|---|---|
| 1 | owner.beta@test.nexora.io | Kai Beta | owner | Org creator |
| 2 | dev1.beta@test.nexora.io | Liam Dev | developer | New user invite |
| 3 | dev2.beta@test.nexora.io | Maya Dev | developer | New user invite |
| 4 | lead.beta@test.nexora.io | Nora Lead | manager | New user invite |
| 5 | hr.beta@test.nexora.io | Omar HR | hr | New user invite |
| 6 | admin.beta@test.nexora.io | Priya Admin | admin | New user invite |
| 7 | design.beta@test.nexora.io | Quinn Designer | designer | New user invite |
| 8 | intern1.beta@test.nexora.io | Raj Intern | employee | New user invite |
| 9 | intern2.beta@test.nexora.io | Sara Intern | employee | New user invite |
| 10 | dev1.alpha@test.nexora.io | Bob Builder | developer | **Cross-org** (already in Alpha) |

**Note:** Bob (dev1.alpha) is deliberately in BOTH orgs to test multi-org flows.

---

## Pre-test Cleanup

| Step | Action | Verification |
|---|---|---|
| C-1 | Delete all users with `@test.nexora.io` emails from `nexora_auth.users` | Count = 0 |
| C-2 | Delete all org memberships for those user IDs from `nexora_auth.orgmemberships` | Count = 0 |
| C-3 | Delete orgs named "Alpha Corp" and "Beta Labs" from `nexora_auth.organizations` | Count = 0 |
| C-4 | Delete test employees from `nexora_hr.employees` | Count = 0 |
| C-5 | Clear all MailHog messages via `DELETE /api/v1/messages` | MailHog inbox empty |
| C-6 | Verify Nugen org users untouched (`organizations` contains `6600000000000000000000a0`) | Count = 58 |

---

## Phase 1: New User Onboarding (Owner)

> Repeat for both Alpha Corp and Beta Labs owners.

### TC-1.1: Send OTP to new user

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/send-otp` |
| **Body** | `{ "email": "owner.alpha@test.nexora.io" }` |
| **Expected status** | `200` |
| **Expected response** | `{ "success": true, "message": "OTP sent to your email" }` |
| **Verify** | User created in DB with `setupStage: "otp_verified"` |

### TC-1.2: Verify OTP arrives in MailHog

| Field | Value |
|---|---|
| **Endpoint** | `GET http://localhost:8025/api/v2/search?kind=to&query=owner.alpha@test.nexora.io&limit=1` |
| **Expected** | `items.length >= 1` |
| **Extract** | 6-digit OTP from subject line (format: `305144 — Your Nexora verification code`) |
| **Verify** | Subject contains a 6-digit code |

### TC-1.3: Verify OTP

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/verify-otp` |
| **Body** | `{ "email": "owner.alpha@test.nexora.io", "otp": "<from MailHog>" }` |
| **Expected status** | `200` |
| **Expected response.data.route** | `/auth/setup-organization` |
| **Expected response.data.routeReason** | `new_user` |
| **Expected response.data.isNewUser** | `true` |
| **Expected response.data.accessToken** | Non-empty JWT |
| **Expected response.data.refreshToken** | Non-empty JWT |
| **Save** | `accessToken` as `OWNER_TOKEN` |

### TC-1.4: Create Organization

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/organizations` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>` |
| **Body** | `{ "name": "Alpha Corp", "industry": "technology", "size": "11-50" }` |
| **Expected status** | `201` |
| **Expected response.data.organization.name** | `Alpha Corp` |
| **Expected response.data.membership.role** | `owner` |
| **Expected response.data.membership.status** | `active` |
| **Save** | `organization._id` as `ORG_ID` |
| **DB verify** | `nexora_auth.organizations` has doc with `name: "Alpha Corp"` |
| **DB verify** | `nexora_auth.orgmemberships` has doc with `userId: <owner>, organizationId: <ORG_ID>, role: "owner", status: "active"` |
| **DB verify** | User's `setupStage` is now `org_created` |
| **DB verify** | Default roles seeded (owner, admin, hr, manager, developer, designer, employee) |

### TC-1.5: Complete Profile

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/complete-profile` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Body** | `{ "firstName": "Alice", "lastName": "Alpha" }` |
| **Expected status** | `200` |
| **DB verify** | User `firstName: "Alice"`, `lastName: "Alpha"`, `setupStage: "profile_complete"` |
| **HR verify** | `nexora_hr.employees` has doc with `email: "owner.alpha@test.nexora.io"`, `firstName: "Alice"`, `status: "active"` |

### TC-1.6: Advance Setup Stage

| Field | Value |
|---|---|
| **Endpoint** | `PUT /api/v1/auth/setup-stage` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Body** | `{ "stage": "complete" }` |
| **Expected status** | `200` |
| **DB verify** | User `setupStage: "complete"` |

### TC-1.7: Re-login Owner

| Field | Value |
|---|---|
| **Action** | Repeat TC-1.1 + TC-1.2 + TC-1.3 for same email |
| **Expected response.data.route** | `/dashboard` |
| **Expected response.data.routeReason** | `active_user` |
| **Expected response.data.organizationId** | `<ORG_ID>` |
| **Save** | New `accessToken` as `OWNER_TOKEN` (now has org context in JWT) |

### TC-1.8: Owner in Directory

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Expected status** | `200` |
| **Expected** | Response contains employee with `email: "owner.alpha@test.nexora.io"` |
| **Expected** | That employee has `status: "active"` |

---

## Phase 2: Invite Members

> Repeat for all 9 members of each org. Below shows one example; repeat for each row in the test data table.

### TC-2.1: Invite member

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/organizations/<ORG_ID>/invite` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Body** | `{ "email": "dev1.alpha@test.nexora.io", "role": "developer", "firstName": "Bob", "lastName": "Builder" }` |
| **Expected status** | `201` |
| **Expected response.data.status** | `pending` |
| **Expected response.data.inviteToken** | Non-empty UUID string |
| **Expected response.data.invitedBy** | Owner's user ID |
| **Expected response.data.role** | `developer` |
| **Save** | `inviteToken` for this member |

### TC-2.2: MailHog receives invite email

| Field | Value |
|---|---|
| **Endpoint** | `GET http://localhost:8025/api/v2/search?kind=to&query=dev1.alpha@test.nexora.io&limit=5` |
| **Expected** | At least 1 email found |
| **Verify** | Email contains invite link or OTP |

### TC-2.3: DB state after invite (new user)

| Check | Expected |
|---|---|
| `nexora_auth.users` | New doc: `email: "dev1.alpha@test.nexora.io"`, `setupStage: "invited"`, `isActive: false` |
| `nexora_auth.orgmemberships` | New doc: `status: "pending"`, `inviteToken: <UUID>`, `inviteExpiresAt: <7 days from now>` |
| `nexora_hr.employees` | New doc: `email: "dev1.alpha@test.nexora.io"`, `status: "invited"`, `organizationId: <ORG_ID>` |

### TC-2.4: Invite all 9 members (batch)

Repeat TC-2.1 through TC-2.3 for each member in the org's member list. Track results:

| # | Email | Role | Invite status | Token | MailHog email | Employee created |
|---|---|---|---|---|---|---|
| 1 | dev1.alpha@test.nexora.io | developer | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 2 | dev2.alpha@test.nexora.io | developer | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 3 | lead.alpha@test.nexora.io | manager | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 4 | hr.alpha@test.nexora.io | hr | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 5 | admin.alpha@test.nexora.io | admin | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 6 | design.alpha@test.nexora.io | designer | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 7 | intern1.alpha@test.nexora.io | employee | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 8 | intern2.alpha@test.nexora.io | employee | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |
| 9 | viewer.alpha@test.nexora.io | viewer | `[ ] 201` | `[ ] saved` | `[ ] received` | `[ ] status=invited` |

### TC-2.5: Duplicate invite rejection

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/organizations/<ORG_ID>/invite` |
| **Body** | `{ "email": "dev1.alpha@test.nexora.io", "role": "developer" }` (same member again) |
| **Expected status** | `409` |
| **Expected** | Error about existing membership/invite |

---

## Phase 3: Directory Status Check (Pre-Acceptance)

### TC-3.1: List all employees

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Expected status** | `200` |
| **Expected total** | 10 (1 owner + 9 invited) |
| **Verify** | Owner has `status: "active"` |
| **Verify** | All 9 invited members have `status: "invited"` |

### TC-3.2: Filter by status=invited

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?status=invited&limit=100` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Expected status** | `200` |
| **Expected count** | 9 |
| **Verify** | Every returned employee has `status: "invited"` |
| **Verify** | Owner does NOT appear in this filtered list |

### TC-3.3: Filter by status=active

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?status=active&limit=100` |
| **Expected count** | 1 (owner only) |

---

## Phase 4: Accept Invitations

> Repeat for each of the 9 invited members. Below shows the complete flow for one member.

### TC-4.1: Validate invite token (public)

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/auth/invites/<INVITE_TOKEN>/validate` |
| **Auth** | None (public endpoint) |
| **Expected status** | `200` |
| **Expected response.data.valid** | `true` |
| **Expected response.data.email** | Member's email |
| **Expected response.data.orgName** | `Alpha Corp` |
| **Expected response.data.role** | Member's assigned role |

### TC-4.2: Invited user sends OTP

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/send-otp` |
| **Body** | `{ "email": "dev1.alpha@test.nexora.io" }` |
| **Expected status** | `200` |

### TC-4.3: Invited user retrieves OTP from MailHog

| Field | Value |
|---|---|
| **Endpoint** | MailHog search for this email |
| **Expected** | New OTP email arrives (separate from invite email) |
| **Extract** | 6-digit OTP |

### TC-4.4: Invited user verifies OTP

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/verify-otp` |
| **Body** | `{ "email": "dev1.alpha@test.nexora.io", "otp": "<OTP>" }` |
| **Expected status** | `200` |
| **Expected response.data.route** | `/auth/accept-invite` |
| **Expected response.data.routeReason** | `pending_invite` |
| **Save** | `accessToken` as `MEMBER_TOKEN` |

### TC-4.5: Accept invite

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/invites/<INVITE_TOKEN>/accept` |
| **Headers** | `Authorization: Bearer <MEMBER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Expected status** | `200` |
| **Expected response.data.status** | `active` |
| **Expected response.data.joinedAt** | Non-null timestamp |
| **Expected response.data.inviteToken** | `null` (consumed) |
| **DB verify** | `orgmemberships.status` = `active` |
| **DB verify** | User `setupStage` = `complete` |
| **DB verify** | User `organizations[]` includes `<ORG_ID>` |
| **HR verify** | Employee `status` = `active` |

### TC-4.6: Re-validate consumed token (should fail)

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/auth/invites/<INVITE_TOKEN>/validate` |
| **Expected response.data.valid** | `false` |

### TC-4.7: Accept all 9 members (batch tracker)

| # | Email | Validate | OTP sent | OTP received | OTP verified | Accepted | Dir status |
|---|---|---|---|---|---|---|---|
| 1 | dev1.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 2 | dev2.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 3 | lead.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 4 | hr.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 5 | admin.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 6 | design.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 7 | intern1.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 8 | intern2.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |
| 9 | viewer.alpha@test.nexora.io | `[ ] valid` | `[ ] 200` | `[ ] MailHog` | `[ ] 200` | `[ ] active` | `[ ] active` |

---

## Phase 5: Directory Status Check (Post-Acceptance)

### TC-5.1: All members now active

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | `Authorization: Bearer <OWNER_TOKEN>`, `x-organization-id: <ORG_ID>` |
| **Expected total** | 10 |
| **Verify** | All 10 employees have `status: "active"` |
| **Verify** | 0 employees have `status: "invited"` |

### TC-5.2: Filter by status=invited returns empty

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?status=invited&limit=100` |
| **Expected count** | 0 |

### TC-5.3: Search by name

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?search=Bob&limit=100` |
| **Expected** | Returns Bob Builder |

### TC-5.4: Search by email

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?search=lead.alpha&limit=100` |
| **Expected** | Returns Diana Lead |

---

## Phase 6: Repeat for Org 2 (Beta Labs)

> Execute Phase 1 through Phase 5 identically for Beta Labs using Beta Labs test data.
> Key difference: Member #10 in Beta is `dev1.alpha@test.nexora.io` (Bob) who already exists from Alpha Corp.

### TC-6.1: Invite existing user (Bob) to Org 2

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/organizations/<ORG2_ID>/invite` |
| **Body** | `{ "email": "dev1.alpha@test.nexora.io", "role": "developer", "firstName": "Bob", "lastName": "Builder" }` |
| **Expected status** | `201` |
| **DB verify** | New `orgmembership` created for Bob + Org2 (status: `pending`) |
| **DB verify** | Bob's existing Alpha Corp membership is UNAFFECTED |
| **DB verify** | Bob's user.setupStage remains `complete` (not reset) |

### TC-6.2: Bob accepts Org 2 invite

| Field | Value |
|---|---|
| **Action** | Login as Bob (OTP), accept invite token for Org 2 |
| **Expected** | Membership status = `active` |
| **DB verify** | Bob's `organizations[]` now has BOTH org IDs |
| **HR verify** | Bob has employee record in BOTH orgs, both `status: "active"` |

---

## Phase 7: Organization Segregation

### TC-7.1: Alpha owner cannot see Beta employees

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | `Authorization: Bearer <ALPHA_OWNER_TOKEN>`, `x-organization-id: <BETA_ORG_ID>` |
| **Expected** | Either 403/401, OR 200 with 0 employees |
| **Critical check** | Beta-exclusive emails (`*.beta@test.nexora.io`) must NOT appear |

### TC-7.2: Beta member cannot see Alpha employees

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | `Authorization: Bearer <BETA_MEMBER_TOKEN>`, `x-organization-id: <ALPHA_ORG_ID>` |
| **Expected** | Either 403/401, OR 200 with 0 employees |
| **Critical check** | Alpha-exclusive emails must NOT appear |

### TC-7.3: Alpha owner sees only Alpha employees

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | `Authorization: Bearer <ALPHA_OWNER_TOKEN>`, `x-organization-id: <ALPHA_ORG_ID>` |
| **Expected count** | 10 |
| **Verify** | All emails match `*.alpha@test.nexora.io` or the owner |

### TC-7.4: Beta owner sees only Beta employees

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | `Authorization: Bearer <BETA_OWNER_TOKEN>`, `x-organization-id: <BETA_ORG_ID>` |
| **Expected count** | 10 (9 beta members + Bob cross-org) |
| **Verify** | No Alpha-exclusive emails leak through |

### TC-7.5: Neither org sees Nugen employees

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=100` |
| **Headers** | Alpha or Beta token, with `x-organization-id: 6600000000000000000000a0` (Nugen) |
| **Expected** | 0 employees or 403 |
| **Critical check** | Nugen employee emails must NOT appear |

---

## Phase 8: Multi-Org User (Bob)

### TC-8.1: Bob login routes to select-organization

| Field | Value |
|---|---|
| **Action** | Send OTP + verify for `dev1.alpha@test.nexora.io` |
| **Expected response.data.route** | `/auth/select-organization` |
| **Expected response.data.routeReason** | `multi_org` |
| **Verify** | `response.data.organizations` contains both org IDs |

### TC-8.2: Bob's JWT has correct claims

| Field | Value |
|---|---|
| **Decode** | JWT payload from Bob's accessToken |
| **Verify** | `sub` = Bob's user ID |
| **Verify** | `email` = `dev1.alpha@test.nexora.io` |
| **Verify** | `isPlatformAdmin` = `false` |

### TC-8.3: Bob switches orgs

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/switch-org` |
| **Headers** | `Authorization: Bearer <BOB_TOKEN>` |
| **Body** | `{ "organizationId": "<ALPHA_ORG_ID>" }` |
| **Expected status** | `200` |
| **Expected** | New accessToken with `organizationId: <ALPHA_ORG_ID>` in JWT |
| **Then** | Switch to Beta: `{ "organizationId": "<BETA_ORG_ID>" }` |
| **Expected** | New accessToken with `organizationId: <BETA_ORG_ID>` |

### TC-8.4: Bob sees correct employees per org

| Field | Value |
|---|---|
| **Action** | GET /employees with Alpha token → Alpha employees only |
| **Action** | GET /employees with Beta token → Beta employees only |

---

## Phase 9: Existing User Re-Login

### TC-9.1: Single-org user re-login

| Field | Value |
|---|---|
| **User** | `lead.alpha@test.nexora.io` (only in Alpha, not multi-org) |
| **Action** | Full OTP cycle: send → MailHog → verify |
| **Expected response.data.route** | `/dashboard` |
| **Expected response.data.routeReason** | `active_user` |
| **Expected response.data.organizationId** | `<ALPHA_ORG_ID>` |

### TC-9.2: Token works for API calls

| Field | Value |
|---|---|
| **Endpoint** | `GET /api/v1/employees?limit=5` |
| **Headers** | `Authorization: Bearer <TOKEN>`, `x-organization-id: <ALPHA_ORG_ID>` |
| **Expected status** | `200` |

---

## Phase 10: Edge Cases & Negative Tests

### TC-10.1: Invalid OTP

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/verify-otp` |
| **Body** | `{ "email": "owner.alpha@test.nexora.io", "otp": "000000" }` |
| **Expected status** | `401` or `400` |
| **Expected** | Error message about invalid OTP |

### TC-10.2: Expired invite token

| Field | Value |
|---|---|
| **Setup** | Manually set `inviteExpiresAt` to past date in DB |
| **Endpoint** | `GET /api/v1/auth/invites/<TOKEN>/validate` |
| **Expected response.data.valid** | `false` |

### TC-10.3: Accept invite without auth

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/invites/<TOKEN>/accept` |
| **Headers** | No Authorization header |
| **Expected status** | `401` |

### TC-10.4: Create org with duplicate name

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/organizations` |
| **Body** | `{ "name": "Alpha Corp" }` (already exists) |
| **Expected** | Either 409 (conflict) or 201 (allows duplicates — document which) |

### TC-10.5: Invite to org you don't belong to

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/organizations/<BETA_ORG_ID>/invite` |
| **Headers** | Alpha owner's token (not a Beta member) |
| **Body** | `{ "email": "rogue@test.nexora.io" }` |
| **Expected status** | `403` |

### TC-10.6: OTP with non-existent email format

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/send-otp` |
| **Body** | `{ "email": "not-an-email" }` |
| **Expected status** | `400` |

### TC-10.7: Verify OTP with wrong email

| Field | Value |
|---|---|
| **Setup** | Send OTP to user-A, get code from MailHog |
| **Endpoint** | `POST /api/v1/auth/verify-otp` |
| **Body** | `{ "email": "different-user@test.nexora.io", "otp": "<user-A's OTP>" }` |
| **Expected status** | `401` or `400` |

### TC-10.8: Rate limiting on OTP send

| Field | Value |
|---|---|
| **Action** | Send OTP 10+ times in quick succession to same email |
| **Expected** | Eventually returns `429` (Too Many Requests) or similar throttle |
| **If no rate limit** | Flag as **S-CRITICAL: OTP brute force vector** |

### TC-10.9: Deactivated user login

| Field | Value |
|---|---|
| **Setup** | Set a user's `isActive: false` in DB |
| **Action** | Send OTP + verify |
| **Expected** | Either blocked at send-otp or verify-otp, OR routes appropriately with restricted access |

### TC-10.10: Empty body requests

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/v1/auth/send-otp` with `{}` |
| **Expected status** | `400` |
| **Endpoint** | `POST /api/v1/auth/organizations` with `{}` |
| **Expected status** | `400` |

---

## Severity Definitions

| Severity | Meaning |
|---|---|
| **P0 — Blocker** | Auth bypass, data leak across orgs, complete flow broken |
| **P1 — Critical** | User can't complete onboarding, invite flow broken, wrong org data |
| **P2 — Major** | Status not updating, MailHog not receiving, wrong route |
| **P3 — Minor** | Missing validation message, cosmetic response issues |

---

## Results Template

After executing all tests, fill in the following summary:

```
Phase 1 (Owner Onboarding):  __ / 8 passed (Alpha), __ / 8 passed (Beta)
Phase 2 (Invite Members):    __ / 9 invited (Alpha), __ / 9 invited (Beta)
Phase 3 (Directory Pre):     __ / 3 passed (Alpha), __ / 3 passed (Beta)
Phase 4 (Accept Invites):    __ / 9 accepted (Alpha), __ / 9 accepted (Beta)
Phase 5 (Directory Post):    __ / 4 passed (Alpha), __ / 4 passed (Beta)
Phase 6 (Org 2 repeat):      Covered above
Phase 7 (Segregation):       __ / 5 passed
Phase 8 (Multi-org):         __ / 4 passed
Phase 9 (Re-login):          __ / 2 passed
Phase 10 (Edge Cases):       __ / 10 passed

Total: __ / ~100 test cases
Bugs found: __
Blockers: __
```
