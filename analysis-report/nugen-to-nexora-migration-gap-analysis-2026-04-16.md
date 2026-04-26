# Nugen → Nexora Data Migration: Gap Analysis

**Date:** 2026-04-16
**Author:** Goku (Business Architect)
**Source DB:** `mongodb+srv://…@cluster0-r2jpw.mongodb.net/nugen_backend_prod`
**Target:** Nexora (multi-tenant microservices — `nexora_auth`, `nexora_hr`, `nexora_attendance`, `nexora_leave`, `nexora_projects`, `nexora_tasks`, `nexora_payroll`, `nexora_notifications`, `nexora_media`)

---

## Executive Summary

**Feasibility: MEDIUM.** Migration is possible but not a straight `mongodump/mongorestore`. The source is a flat, single-tenant Mongo DB built for a now-legacy NestJS monolith; Nexora is a multi-tenant microservice stack with strict schema enums, enforced `organizationId` scoping, and a split between `auth.User` and `hr.Employee`. Every collection requires transformation, and 4 entities (tasks, leaves, candidates, holidays) have **hard schema gaps** that will cause data loss or require Nexora schema changes.

**Data volume (source, live — excluding soft-deletes):**

| Collection | Count | Priority | Migrates cleanly? |
|---|---:|---|---|
| users | 58 | P0 | ⚠ Split needed |
| roles | 10 | P0 | ⚠ Enum remap |
| projects | 1 | P1 | ✅ |
| tasks | 60 | P1 | ❌ No `projectId` |
| task_comments | 1 | P2 | ✅ Embed |
| taskSubmissions | 6 | P2 | ❌ No equivalent |
| leaves | 47 live (63 total) | P0 | ❌ No `leaveType` |
| holidays | 18 live (27 total) | P1 | ❌ No target collection |
| dailyLogs (attendance) | 5,333 | P0 | ⚠ Photo fields missing |
| calls (recruitment candidates) | 76 | P2 | ⚠ Requires `jobPostingId` |
| documents | 17 | P2 | ⚠ S3 rehost |
| notifications | 305 | P3 | ➖ Recommend skip |
| feedbacks | 38 | P3 | ➖ Recommend skip |
| profile (designations) | 8 | P1 | ✅ |
| reports | 2 | P3 | ➖ Recommend skip |
| email_templates | 6 | P3 | ➖ Recommend skip |
| config | 1 | P1 | ⚠ Split across org + policy |
| *errorLogs, events, privacyPolicy, project_comments, quotes, reminders, termsAndConditions* | 0 | — | Skip — empty |

**Bottom-line effort:** **~14 engineering days (≈ 3 calendar weeks)** for a single engineer, assuming you accept the recommended simplifications below. +3–5 days if you want zero-data-loss with Nexora schema changes.

---

## 1. Structural Mismatches (Root Causes)

These 5 structural differences drive most of the work.

### 1.1 Single-tenant → Multi-tenant
Source has no concept of `organizationId`. Nexora enforces it on almost every collection as `{ type: String, index: true }` (often `required: true`).
**Resolution:** Create one `Organization` doc ("Nugen IT Services"), stamp its `_id` onto every migrated record. All 58 users get a matching `OrgMembership` in `nexora_auth`.

### 1.2 User-model split
| Source `users` field | Goes to |
|---|---|
| email, password¹, mobileNumber, profileImage, isActive | `nexora_auth.users` |
| roleId, isActive | `nexora_auth.orgmemberships` |
| userName (single string), joiningDate, dOB, address, idProof, profileId (→ designation), attendanceConfig | `nexora_hr.employees` |
| tokens[] (legacy JWTs) | **DROP** — auth changed to OTP |
| devices[] (FCM tokens + metadata) | `nexora_notifications.devicetokens` |

¹ `password` is bcrypt but **Nexora no longer uses passwords** (OTP-only login via MailHog). You cannot preserve login continuity. Users will re-authenticate via OTP on next login. Either:
- **(Recommended)** Drop the password field, force OTP on first login (zero extra work, well-trod path).
- Restore password-login endpoint in `auth-service` (~2 days effort, reopens a removed auth path — NOT recommended).

`userName` is a single string like `"Admin"`, `"Hari Singh"`. Nexora requires `firstName` + `lastName`. Heuristic: split on first whitespace, fall back to `firstName=userName, lastName=""`. Spot-check top 10 users manually.

### 1.3 Role model: shape and enum remap
**Source:**
```json
{ "roleName": "JR. DEVELOPER",
  "permissions": [ { "name": "My Leave", "permissions": ["READ","WRITE","DELETE"] }, ... ] }
```
**Nexora:**
```json
{ "name": "jr-developer", "displayName": "Jr Developer",
  "permissions": [ { "resource": "leaves", "actions": ["view","create","delete"] }, ... ],
  "organizationId": "...", "isSystem": false }
```

**Permission resource remap table:**

| Source `permissions.name` | Nexora `resource` | Notes |
|---|---|---|
| My Leave, Leave Tagged | `leaves` | merge |
| Checkin/Checkout | `attendance` | |
| Tasks | `tasks` | |
| Holidays | `attendance` | Nexora has no `holidays` resource in the enum — gap |
| All Users, Profiles, Users Attendance Config | `employees` | merge 3→1 |
| Roles | `roles` | |
| Stats, Filter, Logs | `reports` | collapse |
| Settings Change Password | — | drop (no password) |
| Email Templates | — | drop (no collection) |
| Notification Send Custom Notification | — | drop (or add to enum — see §3) |

**Action remap:** `READ → view`, `WRITE → create, edit`, `DELETE → delete`, `READ_ALL_USERS/READ_TODAY_* → view`.

**Role name → `orgmemberships.role` enum**
Target enum: `['owner','admin','hr','manager','developer','designer','employee','member','viewer']`.

| Source | Target enum | Keep custom role via `roleId`? |
|---|---|---|
| ADMIN | `admin` | Yes |
| CTO | `owner` | Yes |
| HR | `hr` | Yes |
| TEAM LEAD | `manager` | Yes |
| SCRUM MASTER | `manager` | Yes |
| JR. DEVELOPER | `developer` | Yes |
| INTERN, TRAINEE | `employee` | Yes |
| DIGITAL MARKETING | `employee` | Yes |
| BDE | `employee` | Yes |

The custom role doc (with full permission detail) goes into `nexora_auth.roles` with `organizationId` set and `isSystem: false`, and each membership links via `roleId`. The `role` field holds the enum simplification for Nexora's RBAC middleware.

### 1.4 Auth mechanism
- Source: password login + long-lived JWTs stored on the user doc
- Target: email OTP via MailHog, short-lived access + refresh tokens issued per login

**Impact:** `users.tokens[]` (~hundreds of historical JWTs per user) is dead weight. Do not migrate. No user login session will survive. Communicate this to end users before cut-over.

### 1.5 Database-per-service
Nexora splits data across ~10 Mongo databases. Source is all in one DB. An ETL script cannot do naive `copyCollection()`; every write has to go to the correct DB (and ideally via the service API to keep business rules, though direct Mongo writes are faster and acceptable for a one-time bulk import).

**Recommendation:** Write an ETL Node script using the Nexora services' own Mongoose schemas (import from `services/*/src/**/schemas`) so enum validation catches garbage at write-time, and connect to each target DB by name.

---

## 2. Per-Collection Gap Register

### 2.1 `users` → `nexora_auth.users` + `nexora_hr.employees` + `nexora_auth.orgmemberships`

| Source field | Target | Gap |
|---|---|---|
| email | `auth.users.email` | ✅ |
| password (bcrypt) | — | **DROP** (OTP-only). Communicated. |
| userName | `auth.users.firstName` + `lastName` | ⚠ Heuristic split |
| mobileNumber | `auth.users.phoneNumber` | ✅ |
| profileImage | `auth.users.avatar` | ⚠ S3 rehost (§4) |
| dOB | `hr.employees.dateOfBirth` | ✅ |
| idProof | `hr.employees.documents[]` (synthesize `{type:'id_proof', url, uploadedAt, verified:false}`) | ✅ |
| joiningDate | `hr.employees.joiningDate` | ✅ |
| address (single string) | `hr.employees.address.street` | ⚠ Flat string, no city/state/country parsing |
| roleId | `orgmemberships.roleId` + `role` | ✅ after role remap |
| profileId | `hr.employees.designationId` (after designation migration) | ✅ |
| isActive | `auth.users.isActive` + `orgmemberships.status` | ✅ |
| isDeleted | `auth.users.deletedAt` (set to now if true) | ✅ (0 deleted in source) |
| isPushNotification, accessTokenNotification, deviceToken | `notification-service` (preferences + primary device token) | ✅ |
| devices[] | `notification-service.devicetokens` | ✅ direct map |
| attendanceConfig { isWorkFromHome, checkinTime, checkOut, shiftHours, checkinDelay, checkOutEarly, isCheckinAffectSalary, isCheckoutAffectSalary, totalPaidLeave } | ⚠ Nexora has **policy-level only** (`attendance.policy.workTiming`). No per-user override. | **GAP** — §3.1 |
| tokens[] | — | DROP |

**Required Nexora field not in source:** `setupStage` (set to `'complete'`), `isEmailVerified: true`, `defaultOrganizationId`, `organizations:[...]`.

### 2.2 `roles` → `nexora_auth.roles`
Covered in §1.3. 10 source roles → 10 custom roles with `isSystem:false, organizationId:<nugenOrgId>`.

### 2.3 `projects` → `nexora_projects.projects`
Only 1 doc. Straightforward.
- `assignedUsers[{userId, role, assignedAt}]` → `team[{userId, role, allocationPercentage:100, assignedAt}]`
- `status: "active"` → Nexora enum accepts this
- Missing in source, defaults on Nexora: `projectKey` (generate e.g. `NAP-1`), `priority: 'medium'`, `visibility: 'private'`, `methodology: 'agile'`, `settings.*`, `healthScore: 100`, `progressPercentage: 0`
- Creator `createdBy` points to `645c9ffd5329fcac1a3d0d21` (must exist post-migration — OK, this is the Admin user)

### 2.4 `tasks` → `nexora_tasks.tasks` — **🔴 CRITICAL GAP**

**Problem:** 60 tasks in source, **only 1 project exists**, and source tasks have **no `projectId` field at all**. Nexora requires `projectId` on every task.

**Options:**
1. **(Recommended)** Create a synthetic "Legacy Tasks" project in the Nugen org, assign all 60 tasks to it. Preserves history without schema changes.
2. Heuristically assign based on `assignedBy`/`userAssigned` — messy, low accuracy.
3. Change `task.projectId` to optional — **avoid**, this is a load-bearing invariant used by the project-service API.

Other field mapping:

| Source | Target | Notes |
|---|---|---|
| taskTitle | title | ✅ |
| description | description | ✅ |
| userAssigned | assigneeId | ✅ |
| assignedBy | reporterId + createdBy | ✅ |
| deadline | dueDate | ✅ |
| isCompleted=true + completionDate | status=`done`, completedAt | ✅ |
| onHold=true | status=`blocked` | ✅ |
| isDelayed | no target field | drop (derivable) |
| progress (0-9 integer) | customFields.progress | ⚠ Or drop |
| taskEffort ("03:00") | estimatedHours = parseHMS(taskEffort) | ⚠ Parser needed |
| reviewFeedback (long text) | comments[{ userId: assignedBy, content: 'Review: ' + reviewFeedback }] | ⚠ Synthesize |
| taskImages[] | attachments[] | ⚠ S3 rehost |
| clientProgress[] | drop | Empty anyway |
| isClientBasedTask | customFields.isClientBased | Low priority |

Source has no `taskKey`, no `type`, no `sprintId` — use defaults (`type:'task'`, no sprint).

### 2.5 `task_comments` (1 doc) → embedded in `nexora_tasks.tasks.comments[]`
Trivial — the one comment links to `taskId=6926b7baa8be5efc78db4e60`. Append to that task's `comments` array.

### 2.6 `taskSubmissions` (6 docs) → **⚠ GAP (no equivalent)**
Source has a custom "submit work for review → manager approves / holds / rejects" workflow. Fields: `submissionNotes`, `submissionImages`, `reviewStatus`, `holdAt`, `holdBy`, `holdNote`, `submissionAt`.

**Options:**
1. **(Recommended, low effort)** Append each submission as a synthesized comment on the parent task: `"Submission: <notes>\nImages: <urls>\nStatus: <reviewStatus>"`. Loses structure but preserves info.
2. Add a new schema `TaskSubmission` in `task-service` (~4h + endpoints).
3. Skip (6 records).

### 2.7 `leaves` → `nexora_leave.leaves` — **🔴 HIGH GAP**

Source has 63 docs (16 soft-deleted → migrate 47). Multiple hard gaps:

| Source | Target | Gap |
|---|---|---|
| userId | employeeId | ⚠ User→Employee ID lookup |
| startDate, endDate | ✅ same | |
| reason | reason | ✅ |
| isHalfDay (bool only) | halfDay: { enabled, date, half:'first_half'\|'second_half' } | **GAP** — source doesn't specify which day or which half. Default `date=startDate, half='first_half'`. |
| **NO `leaveType`** | leaveType enum required | **GAP** — default all to `'casual'`. Manual cleanup post-migration by HR. |
| **NO `totalDays`** | totalDays required, min 0.5 | Compute: `halfDay ? 0.5 : daysBetween(start,end)+1`. |
| overAllStatus="" (empty on all) | status enum: pending/approved/rejected/cancelled | **GAP** — fall back to `reportedTo[0].status` (values: "Pending","Approved","Rejected") lowercased. |
| reportedTo[{userId, status, reason, tasks}] | approvedBy + approvedAt + rejectionReason | Collapse: first entry where status != 'Pending'. `reportedTo[].tasks` (3 records) is task reassignment data → DROP (no target field). |
| isDeleted | isDeleted | ✅ |

### 2.8 `holidays` (27 docs, 18 live) → **🔴 GAP: No target collection**

Nexora has **no dedicated holidays collection**. Holidays are implied by attendance records with `status: 'holiday'`.

**Options:**
1. **(Recommended, schema change)** Add a `Holiday` schema in `attendance-service` (orgId + date + name + isDeleted). ~4h. Gives HR a UI to manage holidays going forward.
2. For each holiday + each active employee, pre-seed an attendance record with `status: 'holiday'`. Explosive row count (18 holidays × 58 users = 1,044 rows), loses named holidays.
3. Store in `Organization.settings` as an array. Not queryable well.

### 2.9 `dailyLogs` (5,333 docs) → `nexora_attendance.attendances` — **⚠ MEDIUM GAP**

| Source | Target | Gap |
|---|---|---|
| userId | employeeId | ⚠ lookup |
| timeStampCheckin | checkInTime, date (=midnight of checkInTime in org TZ) | ✅ |
| timeStampCheckout | checkOutTime | ✅ |
| isCheckin/isCheckout | status: compute (`present` if both, `half_day` if one, etc.) | ⚠ compute |
| forceCheckout | entryType: `'force'` | ✅ |
| checkedInImage | **NO TARGET** | **GAP** — see §3.2 |
| checkedOutImage | **NO TARGET** | **GAP** |
| description | notes | ✅ |
| — | checkInMethod (required default `'web'`) | synth |
| — | totalWorkingHours, effectiveWorkingHours, lateByMinutes, earlyByMinutes | compute vs policy |

**Date range:** 2023-05-25 → 2026-04-13 (live — last log is 3 days ago, so the source system is effectively still running).

### 2.10 `calls` (recruitment — 76 docs) → `nexora_payroll.candidates` — **⚠ GAP**

Despite the name, `calls` in source is candidate tracking (interview history), not voice calls.

| Source | Target | Gap |
|---|---|---|
| candidateName | name | ✅ |
| email, mobileNumber | email, phone | ✅ |
| **jobProfile** (string) | **jobPostingId** (required FK) | **GAP** — no `jobPostings` collection in source. Synthesize one JobPosting per distinct `jobProfile` value, link. |
| location | parsedResume.location | ✅ |
| totalExperience, relevantExperience | parsedResume.totalExperienceYears | ✅ (lose relevant vs total distinction) |
| CTC, expectedCTC, noticePeriod | **NO TARGET FIELDS** in candidate schema | **GAP** — recommend adding to candidate schema or store in `offer.ctc` if offer exists. |
| source | source | ✅ |
| call[ { callTime, description, callStatus, nextCallTime } ] | interviews[ { round, scheduledAt, status, feedback } ] + stageHistory[] | ⚠ Field remap per entry |
| documents[] (resume URLs) | resumeUrl (take first) | ✅ |
| — | organizationId, jobPostingId (required) | synth |

**Interview statuses:** source uses free-text (`"Interview Scheduled"`, `"Rejected"`, `"Selected"`, etc.) — must map to Nexora enums.

### 2.11 `documents` (17) → `nexora_media.mediafiles`
Per-user misc file uploads. Clean map after S3 rehost (§4). Must synthesize `storageKey` (parse from URL path), `processing.status='complete'`, `scanStatus='clean'`.

### 2.12 `notifications` (305) → `nexora_notifications.*`
**Recommendation: SKIP.** Notifications are historical/transient by nature. Nexora's notification service will regenerate go-forward notifications. 305 old "task assigned" / "leave approved" records have no ongoing value.

If required for audit: map `notification_type` to Nexora types (LEAVE_APPLY, TASK_CREATED, etc. — need to verify Nexora's enum in `notification-service`).

### 2.13 `feedbacks` (38) → **no target**
Simple `{ userId, feedback: "..." }` anonymous/named feedback.
**Recommendation: SKIP.** Or optionally migrate as `helpdesk-service` tickets under a "Legacy Feedback" queue (~0.5 day).

### 2.14 `profile` (8) → `nexora_hr.designations`
Clean map. `profile.name` → `designation.title`. 8 records: Frontend Developer, etc.

### 2.15 `reports` (2 docs, OFFER_LETTER)
Generated PDFs with S3 URLs. **Recommendation: SKIP** — these are historical outputs, not templates. Regenerate on demand.

### 2.16 `email_templates` (6) → **no target**
HTML templates for password change, offer letter, etc. Nexora emails are coded in `auth.service.ts` directly (see `sendOtpEmail`). No templates collection exists.
**Recommendation: SKIP.** Templates should live in code or a design system, not the DB. Copy template HTML into `services/*/templates/` if re-used.

### 2.17 `config` (1 doc)
```json
{ "geoFenceAreaInMeter": 500,
  "officeCoordinates": { "latitude": "30.707…", "longitude": "76.688…" },
  "privacyPolicy": "https://www.nugeninfo.com/",
  "termsAndCondition": "https://www.nugeninfo.com/" }
```
**Split across targets:**
- `officeCoordinates` + `geoFenceAreaInMeter` → **GAP.** Nexora has no geofence config. Add to `Organization.businessDetails` or new `attendance.geofenceConfig`. See §3.3.
- `privacyPolicy`, `termsAndCondition` → `Organization.settings.legalLinks` (schema add — minor).

---

## 3. Required Nexora Schema Changes

To migrate without data loss:

### 3.1 Per-user attendance override (optional, HIGH effort)
Source lets each user have their own check-in time, grace, shift hours. Nexora has this only at policy level. If you want parity:
- Add `attendanceConfigOverride` sub-document to `hr.employee` with the same fields as `policy.workTiming`
- Update attendance-service to check user override before policy

**Verdict:** Only if HR has active per-user exceptions. Check with Varun. If everyone was using similar timings, skip and apply at policy level.

### 3.2 Attendance selfie URLs (MEDIUM effort — 2h)
Add to `AttendanceSchema`:
```ts
checkInPhotoUrl?: string;
checkOutPhotoUrl?: string;
checkInLocation?: { lat: number; lng: number };
checkOutLocation?: { lat: number; lng: number };
```
**Without this, 5,333 selfie URLs are lost.** Low schema risk, ~2h with tests.

### 3.3 Geofence config (MEDIUM effort — 4h)
Add to `Organization` schema or `Policy.workTiming`:
```ts
geofence?: { lat: number; lng: number; radiusMeters: number; enforce: boolean };
```
Plus attendance-service validation that check-in GPS is within radius. Only needed if you want to ship the geofence feature; source data just preserves the config.

### 3.4 Holiday collection (MEDIUM effort — 4h)
Add `attendance-service/schemas/holiday.schema.ts`:
```ts
{ organizationId, date, name, isRecurring, isDeleted }
```
+ CRUD endpoints. Alternative is seeding attendance rows, which I don't recommend.

### 3.5 Candidate CTC / noticePeriod fields (LOW — 1h)
Add to `candidate.schema.ts`:
```ts
currentCtc?: number; expectedCtc?: number; noticePeriodDays?: number;
```

### 3.6 TaskSubmission schema (LOW — 4h if wanted)
Only if you want structured task-submission workflow instead of squashing to comments.

---

## 4. S3 Asset Migration

**Problem:** All files in source reference `https://nugen.s3.ap-south-1.amazonaws.com/...`. Nexora has its own bucket (verify actual bucket name with infra). If the nugen bucket:
- Stays live → URLs will resolve, but (a) CORS may break embedded display in Nexora UI, (b) you now depend on a third-party bucket you don't control long-term.
- Goes away → all photos/resumes/attachments 404.

**Affected assets (rough counts):**
- ~58 profile images (`users.profileImage`)
- ~5,000+ check-in/check-out selfies (most `dailyLogs` have both)
- ~76 resumes (`calls.documents[]`)
- ~17 general documents
- ~10 task images (`tasks.taskImages[]`)
- ~6 task-submission images

**Total: ~5,000–10,000 files.** At an average ~100 KB each, ~500 MB–1 GB.

**Options:**
1. **(Recommended)** Rehost script: stream each file from source S3, upload to Nexora bucket, rewrite URLs in the ETL pass. 1–2 days with checkpointing and error handling.
2. Leave URLs pointing at nugen bucket indefinitely. Fragile, free.
3. Proxy on-demand in media-service. Adds permanent coupling.

---

## 5. Identity Mapping Strategy

Source `_id` (Mongo ObjectId) is referenced everywhere (taskAssigned, createdBy, userAssigned, approvedBy, etc.). Two approaches:

### Strategy A: Preserve IDs
Insert Nexora docs using the source's `_id` verbatim. Keeps all cross-references working without a lookup map.
- ✅ Simpler ETL, no rewrite pass
- ❌ Mixes legacy IDs with Nexora-generated ones — slight aesthetic impurity
- ❌ `nexora_auth.users` already seeded the platform admin with a different ID (already created at `69e07b3557c5854304926e04`)

### Strategy B: Generate new IDs + maintain a lookup map
Generate `sourceToNexoraId: Map<string, string>` per collection, rewrite all foreign references.
- ✅ Clean
- ❌ ~2× the ETL code
- ❌ If any reference is missed, silent breakage

**Recommendation: Strategy A.** Delete the existing Nexora platform-admin user first (or map the Nugen admin to become `isPlatformAdmin: true`), then use source `_id`s verbatim. Acceptable for a bulk one-time import.

---

## 6. Effort Estimate

Single engineer familiar with both schemas, writing a TypeScript ETL using the Nexora Mongoose schemas.

| Phase | Effort |
|---|---:|
| 0. Source dump + local restore for safe iteration | 0.5 d |
| 1. Nexora schema changes (§3.2, §3.3, §3.4, §3.5 — recommended set) | 2 d |
| 2. ETL framework: Mongo connections per-DB, id-mapper, dry-run harness, rollback | 1 d |
| 3. Org + Users + Memberships + Employees + Designations + Departments (synthesize) | 2 d |
| 4. Roles with permission-shape translation + enum remap | 1 d |
| 5. Attendance (5,333 rows + photo-URL plumbing) | 1 d |
| 6. Leaves with type/status/halfDay heuristics | 1 d |
| 7. Holidays (into new collection) | 0.5 d |
| 8. Projects + Tasks (with synthetic default project) + task_comments + taskSubmissions→comments | 1 d |
| 9. Candidates (calls) + synthesized JobPostings | 1 d |
| 10. Documents → media-service | 0.5 d |
| 11. S3 asset rehost script + URL rewrite | 1.5 d |
| 12. Dry-run against prod-mirror, fix, data QA (spot-check 10 users, 20 attendance records, 5 leaves, 5 tasks) | 2 d |
| 13. Cut-over runbook + comms draft (OTP re-login, feature gaps) | 0.5 d |
| **Total** | **~14 engineering days (≈ 3 weeks)** |

**Excluded by recommendation:** notifications, feedbacks, reports, email_templates, legacy JWT tokens. Adding these: +1–2 days.

**Risks that could push effort:**
- S3 rehost runs slow or hits rate limits → +1–2 days
- HR insists per-user attendance config (§3.1) must be preserved → +2–3 days
- More `organizationId`-required collections surface during testing → +1 day
- User-ID collision with existing Nexora platform-admin → already a known issue, 0.5 day cleanup

---

## 7. Prioritized Recommendations

### Must-do before any migration begins
1. **Rotate the leaked credentials** from the user message. The source DB connection string (`varun:hariom786`) is in plaintext in this conversation and any chat logs — rotate the MongoDB user password and restrict IP allowlist today.
2. **Decide on auth cut-over**: password DROP (recommended) vs restore password endpoint. Affects user comms.
3. **Confirm scope** with Varun: is per-user `attendanceConfig` actively varied? Are 305 old notifications or 38 feedbacks worth migrating?
4. **S3 bucket decision**: rehost now vs later.

### Schema changes to merge first (§3)
Order:
1. §3.4 Holidays collection (blocks holidays migration)
2. §3.2 Attendance selfie URL fields (blocks asset migration)
3. §3.3 Geofence (blocks config migration — or defer and store in `Organization.settings.legacyGeofence`)
4. §3.5 Candidate CTC fields (blocks candidate migration — or store in customFields)

### ETL design principles
- Write all ETL code as idempotent upserts on source `_id` — rerunnable safely
- Every collection's migrator must emit a count + hash of its output for QA diff-ability
- `--dry-run` mode that validates enum/required fields without writing
- Hard-fail on any enum mismatch; never silently coerce

### Do not do
- Do not migrate `users.password` by reviving the password-login endpoint
- Do not migrate `users.tokens[]` (legacy JWTs — security liability)
- Do not copy-paste email template HTML into the DB if Nexora uses code-based templates
- Do not make `task.projectId` optional to dodge §2.4 — synthesize a project instead

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Credentials leak (already occurred in plaintext) | **Certain** | High | Rotate now |
| S3 rehost partial failure → broken images | Medium | Medium | Idempotent script + URL fallback to source bucket |
| Leave-type defaulting-to-casual confuses HR | High | Low | Pre-migration HR review of 47 leave records |
| Synthetic default project pollutes analytics | Low | Low | Name clearly `[LEGACY] Imported Tasks`, filter out in dashboards |
| Source system still live (last attendance 2026-04-13) | **Certain** | High | Plan a cut-over freeze window OR run delta re-sync after initial bulk load |
| Nexora organization-ID enforcement catches missed fields at runtime | Medium | Medium | Dry-run with full dataset before any write |
| User/Employee ID collision with existing platform-admin | Known | Low | Pre-migration: delete platform-admin user (already discussed), re-seed after |

---

## 9. Open Questions for User / Varun

1. Is the Nugen source system **still in use**? Last attendance = 2026-04-13. If live, we need a freeze window or dual-write plan.
2. Should the platform admin (`platform@nexora.io`) remain, or should the source `admin@gmail.com` become the Nexora platform admin?
3. Per-user attendance config variation — real or all uniform?
4. Asset hosting — keep pointing at nugen S3 bucket, or rehost to Nexora bucket?
5. Historical notifications (305) + feedbacks (38) — migrate or drop?
6. Leave type reconstruction — HR willing to review the 47 leaves post-migration and re-classify, or default all to `casual` and move on?
7. How should the Nugen source data map into Nexora's multi-tenant world — single "Nugen IT Services" org (assumed here), or different split?

---

## Appendix A — Source collection field maps (abbreviated)
Already enumerated inline in §2. Full `allKeys()` output available in session transcript.

## Appendix B — Volume summary
- ~58 users → 58 Nexora users + 58 employees + 58 memberships + 10 org-scoped roles + 8 designations + 1 organization
- ~5,333 attendance records
- ~47 active leaves
- ~60 tasks + 1 project + 1 synthetic project
- ~76 candidates + ~6 synthetic job postings
- ~17 documents + ~5,000 assets to rehost
- **Rows created in target: ~5,700 + ~5,000 S3 objects**
