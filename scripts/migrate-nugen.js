// One-shot migration: Nugen Atlas (nugen_backend_prod) → local Nexora multi-DB.
//
// Usage (from host):
//   MIGRATION_SOURCE_URI='mongodb+srv://USER:PASS@cluster.../nugen_backend_prod' \
//   docker cp scripts/migrate-nugen.js nexora-auth-service:/tmp/ && \
//   docker exec -e MIGRATION_SOURCE_URI="$MIGRATION_SOURCE_URI" \
//     -e MIGRATION_DEST_URI="mongodb://root:nexora_dev_password@mongodb:27017/?authSource=admin" \
//     nexora-auth-service node /tmp/migrate-nugen.js
//
// CREDENTIALS NEVER LIVE IN THIS FILE — they come via env var only.
//
// Idempotent: every migrated doc is tagged with `_migration.source` +
// `_migration.sourceId` (the original Atlas _id). Re-runs skip docs
// whose source-id is already present, so the script can be retried
// after a failure or partial run without duplicates.
//
// Multi-DB target (one mongodb instance, many logical databases):
//   nexora_auth        — users, organizations, orgmemberships
//   nexora_hr          — employees, designations
//   nexora_attendance  — attendances, holidays
//   nexora_task        — tasks
//
// What gets migrated:
//   ✓ users (58)            → auth.users + auth.orgmemberships + hr.employees
//   ✓ profile (8)           → hr.designations
//   ✓ holidays (27)         → attendance.holidays
//   ✓ dailyLogs (5333)      → attendance.attendances
//   ✓ tasks (60)            → task.tasks (project-less, flat list)
//
// What's deliberately skipped (per product decisions in chat):
//   ✗ projects, leaves, calls (recruitment), notifications,
//     feedbacks, documents, reports, email_templates, taskSubmissions,
//     task_comments, project_comments

'use strict';

const { MongoClient } = require('mongodb');

const SOURCE_URI = process.env.MIGRATION_SOURCE_URI;
const DEST_URI = process.env.MIGRATION_DEST_URI ||
  'mongodb://root:nexora_dev_password@mongodb:27017/?authSource=admin';

if (!SOURCE_URI) {
  console.error('Set MIGRATION_SOURCE_URI to the Atlas mongodb+srv:// URI.');
  process.exit(1);
}

// ── Constants ──────────────────────────────────────────────────────────

const SOURCE_TAG = 'nugen-2026-04';
const ORG_NAME = 'Nugen IT Services';
const ORG_SLUG = 'nugen-it-services';
const PLATFORM_EMAIL = 'platform@nexora.io';
const VARUN_EMAIL = 'cto.varun@gmail.com';

// Nugen role name → Nexora orgRole. INTERN/JR DEVELOPER/etc. all roll up
// to `employee`; ADMIN/CTO → `admin` (Varun specifically gets `owner`
// because he's the tenant owner — see Phase 5).
const ROLE_MAP = {
  ADMIN: 'admin',
  CTO: 'admin',
  HR: 'hr',
  'TEAM LEAD': 'manager',
  'SCRUM MASTER': 'manager',
  'JR. DEVELOPER': 'employee',
  INTERN: 'employee',
  TRAINEE: 'employee',
  BDE: 'employee',
  'DIGITAL MARKETING': 'employee',
};

// Per-tenant feature toggles for Nugen. Only what they asked for is on;
// everything else is explicitly off (the auth-context defaults missing
// flags to `enabled` for backward compat, so explicit-off is required
// to actually hide a section).
const NUGEN_FEATURES = {
  attendance:        { enabled: true },
  tasks:             { enabled: true },
  clients:           { enabled: true },
  invoices:          { enabled: true },
  reports:           { enabled: true },
  // Off
  projects:          { enabled: false },
  sprints:           { enabled: false },
  timesheets:        { enabled: false },
  leaves:            { enabled: false },
  chat:              { enabled: false },
  calls:             { enabled: false },
  ai:                { enabled: false },
  assetManagement:   { enabled: false },
  expenseManagement: { enabled: false },
  recruitment:       { enabled: false },
  payroll:           { enabled: false },
  performance:       { enabled: false },
  helpdesk:          { enabled: false },
  knowledge:         { enabled: false },
};

// ── Helpers ─────────────────────────────────────────────────────────────

function splitName(userName) {
  const parts = (userName || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { firstName: 'Unknown', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function utcDateOnly(d) {
  if (!d) return null;
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

async function main() {
  const src = new MongoClient(SOURCE_URI);
  const dst = new MongoClient(DEST_URI);
  await src.connect();
  await dst.connect();
  console.log('✓ Connected to source + destination');

  const srcDb = src.db('nugen_backend_prod');
  const auth = dst.db('nexora_auth');
  const hr = dst.db('nexora_hr');
  const att = dst.db('nexora_attendance');
  const tsk = dst.db('nexora_task');

  // ── Phase 1: Bootstrap platform super-admin ─────────────────────────
  // Nexora's super admin is a USER (not an org) — it's whoever has
  // `isPlatformAdmin: true` and can see/manage every tenant. We create
  // platform@nexora.in if absent so there's always someone above the
  // tenants. OTP-only (no password).
  console.log('\n[1/8] Platform super-admin');
  let platformUser = await auth.collection('users').findOne({ email: PLATFORM_EMAIL });
  if (!platformUser) {
    const r = await auth.collection('users').insertOne({
      email: PLATFORM_EMAIL,
      firstName: 'Platform',
      lastName: 'Admin',
      isPlatformAdmin: true,
      roles: ['user', 'super_admin'],
      organizations: [],
      isActive: true,
      isDeleted: false,
      isEmailVerified: true,
      isPhoneVerified: false,
      setupStage: 'completed',
      loginAttempts: 0,
      mfaEnabled: false,
      otpAttempts: 0,
      otpRequestCount: 0,
      preferences: {},
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      _migration: { source: SOURCE_TAG, role: 'platform-admin' },
    });
    platformUser = await auth.collection('users').findOne({ _id: r.insertedId });
    console.log(`  ✓ created ${PLATFORM_EMAIL} (_id=${platformUser._id})`);
  } else {
    if (!platformUser.isPlatformAdmin) {
      await auth.collection('users').updateOne(
        { _id: platformUser._id },
        { $set: { isPlatformAdmin: true, updatedAt: new Date() } },
      );
      console.log('  ✓ flipped existing user to isPlatformAdmin=true');
    }
    console.log(`  ✓ ${PLATFORM_EMAIL} exists (_id=${platformUser._id})`);
  }

  // ── Phase 2: Create / sync Nugen org ────────────────────────────────
  console.log('\n[2/8] Nugen organization');
  let nugen = await auth.collection('organizations').findOne({ slug: ORG_SLUG });
  if (!nugen) {
    const r = await auth.collection('organizations').insertOne({
      name: ORG_NAME,
      slug: ORG_SLUG,
      industry: 'technology',
      size: '51-200',
      plan: 'professional',
      country: 'IN',
      type: 'private_limited',
      settings: {
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        numberFormat: 'indian',
        weekStartDay: 'monday',
        financialYearStart: 4,
      },
      features: NUGEN_FEATURES,
      onboardingCompleted: true,
      onboardingStep: 999,
      isActive: true,
      isDeleted: false,
      createdBy: String(platformUser._id),
      ownerId: null, // Backfilled in Phase 5 once Varun's auth user exists
      createdAt: new Date(),
      updatedAt: new Date(),
      _migration: { source: SOURCE_TAG },
    });
    nugen = await auth.collection('organizations').findOne({ _id: r.insertedId });
    console.log(`  ✓ created Nugen org (_id=${nugen._id})`);
  } else {
    // Re-run path: keep existing org, sync features in case toggles changed
    await auth.collection('organizations').updateOne(
      { _id: nugen._id },
      { $set: { features: NUGEN_FEATURES, updatedAt: new Date() } },
    );
    console.log(`  ✓ Nugen org exists (_id=${nugen._id}), features synced`);
  }
  const nugenOrgId = String(nugen._id);

  // ── Phase 3: Roles lookup (in-memory only) ──────────────────────────
  console.log('\n[3/8] Roles lookup');
  const roleLookup = {};
  for (const r of await srcDb.collection('roles').find({}).toArray()) {
    roleLookup[String(r._id)] = r.roleName;
  }
  console.log(`  ✓ ${Object.keys(roleLookup).length} roles loaded`);

  // ── Phase 4: Designations (Nugen `profile` → hr.designations) ──────
  console.log('\n[4/8] Designations');
  let desigCount = 0;
  for (const p of await srcDb.collection('profile').find({ isDeleted: false }).toArray()) {
    const existing = await hr.collection('designations').findOne({
      organizationId: nugenOrgId,
      title: p.name,
    });
    if (existing) continue;
    await hr.collection('designations').insertOne({
      organizationId: nugenOrgId,
      title: p.name,
      level: 1,
      track: 'general',
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      _migration: { source: SOURCE_TAG, sourceId: String(p._id) },
    });
    desigCount++;
  }
  console.log(`  ✓ migrated ${desigCount} new designations`);

  // ── Phase 5: Users + memberships + employees ───────────────────────
  // Three writes per Nugen user: auth.users, auth.orgmemberships,
  // hr.employees. Keep an in-memory map old userId → new ids so later
  // phases (attendance, tasks) can translate references.
  console.log('\n[5/8] Users + employees');
  const userMap = {};

  // Resume highest existing NUG-XXXX seq for re-run safety
  const lastEmp = await hr.collection('employees')
    .find({ organizationId: nugenOrgId, employeeId: /^NUG-/ })
    .sort({ employeeId: -1 })
    .limit(1)
    .toArray();
  let nextSeq = 1;
  if (lastEmp.length) {
    const m = lastEmp[0].employeeId.match(/^NUG-(\d+)$/);
    if (m) nextSeq = parseInt(m[1], 10) + 1;
  }

  let userNew = 0, userExisting = 0;
  for (const u of await srcDb.collection('users').find({}).toArray()) {
    const oldId = String(u._id);
    const isVarun = (u.email || '').toLowerCase() === VARUN_EMAIL;

    // Step 1: auth.users (idempotent on _migration.sourceId)
    let authUserId;
    const existingAuth = await auth.collection('users').findOne({
      '_migration.sourceId': oldId,
      '_migration.source': SOURCE_TAG,
    });
    if (existingAuth) {
      authUserId = String(existingAuth._id);
      userExisting++;
    } else {
      const { firstName, lastName } = splitName(u.userName);
      const r = await auth.collection('users').insertOne({
        email: u.email,
        firstName,
        lastName,
        avatar: u.profileImage || null,
        // Nugen used a top-level `mobileNumber` field. Carrying as `phone`
        // (matching auth schema) — empty string normalised to null.
        phone: u.mobileNumber && u.mobileNumber.trim() ? u.mobileNumber.trim() : null,
        // No password — OTP login only. The auth service handles a
        // missing password field by routing the user through OTP on
        // first sign-in.
        isPlatformAdmin: false,
        roles: ['user'],
        organizations: [nugenOrgId],
        defaultOrganizationId: nugenOrgId,
        // Carrying isActive across — terminated users come over as
        // isActive=false. The membership-status check downstream
        // ('inactive' status) prevents them from being assigned new
        // work or showing up in active stats.
        isActive: !!(u.isActive && !u.isDeleted),
        isDeleted: !!u.isDeleted,
        // Nugen treated email as verified by virtue of having an
        // account — carry that forward. Phone unverified by default.
        isEmailVerified: true,
        isPhoneVerified: false,
        setupStage: 'completed',
        loginAttempts: 0,
        mfaEnabled: false,
        otpAttempts: 0,
        otpRequestCount: 0,
        preferences: {},
        permissions: [],
        createdAt: u.createdAt || new Date(),
        updatedAt: u.updatedAt || new Date(),
        _migration: {
          source: SOURCE_TAG,
          sourceId: oldId,
          sourceUserName: u.userName,
        },
      });
      authUserId = String(r.insertedId);
      userNew++;
    }

    // Step 2: orgmembership (upsert — re-run syncs role)
    // Varun gets `owner` (highest privilege; can do anything an admin
    // can plus suspend/transfer the tenant). Other ADMIN/CTO get
    // `admin`. HR/managers/employees per ROLE_MAP.
    const nugenRoleName = roleLookup[String(u.roleId)];
    let orgRole = isVarun ? 'owner' : (ROLE_MAP[nugenRoleName] || 'employee');
    await auth.collection('orgmemberships').updateOne(
      { userId: authUserId, organizationId: nugenOrgId },
      {
        $set: {
          role: orgRole,
          status: (u.isActive && !u.isDeleted) ? 'active' : 'inactive',
          joinedAt: u.joiningDate || u.createdAt || new Date(),
        },
      },
      { upsert: true },
    );

    // Step 3: hr.employees (idempotent on _migration.sourceId)
    let employeeMongoId;
    let employeeIdStr;
    const existingEmp = await hr.collection('employees').findOne({
      organizationId: nugenOrgId,
      '_migration.sourceId': oldId,
    });
    if (existingEmp) {
      employeeMongoId = String(existingEmp._id);
      employeeIdStr = existingEmp.employeeId;
    } else {
      employeeIdStr = `NUG-${String(nextSeq++).padStart(4, '0')}`;
      const { firstName, lastName } = splitName(u.userName);
      const status = (u.isActive && !u.isDeleted) ? 'active' : 'exited';
      const empDoc = {
        organizationId: nugenOrgId,
        userId: authUserId,
        employeeId: employeeIdStr,
        firstName,
        lastName,
        email: u.email,
        phone: u.mobileNumber && u.mobileNumber.trim() ? u.mobileNumber.trim() : null,
        avatar: u.profileImage || null,
        dateOfBirth: u.dOB || null,
        joiningDate: u.joiningDate || u.createdAt || new Date(),
        employmentType: 'full_time',
        status,
        // Mark inactive in directory listing for terminated users, but
        // keep the doc (isDeleted=false) so historical attendance/tasks
        // still resolve to a real person record. Reactivate flow
        // restores them via `previousStatus`.
        isActive: !!(u.isActive && !u.isDeleted),
        isDeleted: false,
        previousStatus: status === 'exited' ? 'active' : null,
        skills: [],
        policyIds: [],
        documents: [],
        bankChangeHistory: [],
        timezone: 'Asia/Kolkata',
        // Nugen stored address as a single free-text string. We park it
        // in the `street` field so the structured-address UI still
        // displays something rather than collapsing the data.
        address: u.address && u.address.trim()
          ? { street: u.address.trim(), city: '', state: '', country: 'India', zip: '' }
          : null,
        createdAt: u.createdAt || new Date(),
        updatedAt: u.updatedAt || new Date(),
        _migration: {
          source: SOURCE_TAG,
          sourceId: oldId,
          sourceRoleName: nugenRoleName || null,
          sourceUserName: u.userName,
        },
      };
      if (status === 'exited') {
        empDoc.exitDate = u.updatedAt || new Date();
      }
      const r = await hr.collection('employees').insertOne(empDoc);
      employeeMongoId = String(r.insertedId);
    }

    userMap[oldId] = { authUserId, employeeMongoId, employeeIdStr, isVarun };
  }
  console.log(`  ✓ ${userNew} new users, ${userExisting} already migrated`);
  console.log(`  ✓ employee IDs assigned through ${`NUG-${String(nextSeq - 1).padStart(4, '0')}`}`);

  // Backfill Nugen org owner = Varun
  const varun = await auth.collection('users').findOne({ email: VARUN_EMAIL });
  if (varun) {
    await auth.collection('organizations').updateOne(
      { _id: nugen._id },
      { $set: { ownerId: String(varun._id) } },
    );
    console.log(`  ✓ Nugen org owner set to Varun (${VARUN_EMAIL})`);
  } else {
    console.log(`  ⚠ Varun not found — org owner left null`);
  }

  // ── Phase 6: Holidays ──────────────────────────────────────────────
  console.log('\n[6/8] Holidays');
  let holidayCount = 0;
  for (const h of await srcDb.collection('holidays').find({ isDeleted: false }).toArray()) {
    const existing = await att.collection('holidays').findOne({
      organizationId: nugenOrgId,
      '_migration.sourceId': String(h._id),
    });
    if (existing) continue;
    const date = utcDateOnly(h.date);
    if (!date) continue;
    await att.collection('holidays').insertOne({
      organizationId: nugenOrgId,
      date,
      name: h.description || 'Holiday',
      type: 'company',
      year: date.getUTCFullYear(),
      isDeleted: false,
      createdAt: h.createdAt || new Date(),
      updatedAt: h.updatedAt || new Date(),
      _migration: { source: SOURCE_TAG, sourceId: String(h._id) },
    });
    holidayCount++;
  }
  console.log(`  ✓ migrated ${holidayCount} new holidays`);

  // ── Phase 7: Attendance (5333 docs — biggest phase) ────────────────
  console.log('\n[7/8] Attendance (dailyLogs)');
  let attNew = 0, attSkipped = 0, attOrphan = 0;
  const cursor = srcDb.collection('dailyLogs').find({});
  while (await cursor.hasNext()) {
    const d = await cursor.next();
    const oldUserId = String(d.userId);
    const userInfo = userMap[oldUserId];
    if (!userInfo) { attOrphan++; continue; }

    const checkInTime = d.timeStampCheckin;
    if (!checkInTime) { attOrphan++; continue; }

    const existing = await att.collection('attendances').findOne({
      '_migration.sourceId': String(d._id),
    });
    if (existing) { attSkipped++; continue; }

    let totalWorkingHours = null;
    if (d.timeStampCheckout) {
      const ms = new Date(d.timeStampCheckout).getTime() - new Date(checkInTime).getTime();
      totalWorkingHours = parseFloat((ms / 3_600_000).toFixed(2));
    }

    // Nugen captured selfie URLs at clock-in/out (image-capture feature).
    // Nexora doesn't yet have an image-capture column, so we pack the
    // URLs into the `notes` field rather than dropping the data —
    // when the image-capture column is added later, a follow-up
    // migration can parse them out of notes.
    const noteParts = [];
    if (d.checkedInImage)  noteParts.push(`selfie-in: ${d.checkedInImage}`);
    if (d.checkedOutImage) noteParts.push(`selfie-out: ${d.checkedOutImage}`);
    if (d.description)     noteParts.push(d.description);

    await att.collection('attendances').insertOne({
      organizationId: nugenOrgId,
      // attendance.employeeId is the AUTH userId (matches what
      // attendance.service.ts writes via req.user.userId on live
      // check-ins). NOT the hr.employees._id.
      employeeId: userInfo.authUserId,
      date: utcDateOnly(checkInTime),
      checkInTime,
      checkOutTime: d.timeStampCheckout || null,
      checkInIP: null,
      checkOutIP: null,
      checkInLocation: null,
      checkOutLocation: null,
      // Nugen ran on a mobile app — preserve that as the entry method
      // so reports can still distinguish web/mobile when both exist.
      checkInMethod: 'mobile',
      checkOutMethod: d.timeStampCheckout ? 'mobile' : null,
      totalWorkingHours,
      effectiveWorkingHours: totalWorkingHours,
      overtimeHours: 0,
      // Conservative status mapping. Nugen's records have no late/half-
      // day classification — we preserve "present" and let any
      // downstream re-classification (e.g. shift policy retro-apply)
      // happen later if needed.
      status: 'present',
      isLateArrival: false, lateByMinutes: 0,
      isEarlyDeparture: false, earlyByMinutes: 0,
      isNightShift: false,
      entryType: 'system',
      isDeleted: !!d.isDeleted,
      notes: noteParts.length ? noteParts.join(' | ') : null,
      createdBy: userInfo.authUserId,
      createdAt: d.createdAt || new Date(),
      updatedAt: d.updatedAt || new Date(),
      _migration: { source: SOURCE_TAG, sourceId: String(d._id) },
    });
    attNew++;
    if (attNew % 500 === 0) console.log(`  … ${attNew} attendance records inserted`);
  }
  console.log(`  ✓ ${attNew} attendance records inserted, ${attSkipped} already migrated, ${attOrphan} orphaned (no userId match — typical when a checkInTime is missing)`);

  // ── Phase 8: Tasks ─────────────────────────────────────────────────
  // Per product decision (no full Jira), tasks land in task.tasks
  // with projectId=null. Fields trimmed to what the Nexora task
  // schema accepts; richer Nugen-only fields (taskEffort, clientProgress)
  // dropped — they don't have a destination column.
  console.log('\n[8/8] Tasks');
  let taskNew = 0, taskOrphan = 0;
  for (const t of await srcDb.collection('tasks').find({ isDeleted: false }).toArray()) {
    const existing = await tsk.collection('tasks').findOne({
      '_migration.sourceId': String(t._id),
    });
    if (existing) continue;

    const assignee = userMap[String(t.userAssigned)];
    const creator = userMap[String(t.assignedBy)];
    if (!assignee) { taskOrphan++; continue; }

    let status = 'todo';
    if (t.isCompleted) status = 'done';
    else if (t.onHold) status = 'blocked';
    else if ((t.progress || 0) > 0) status = 'in_progress';

    await tsk.collection('tasks').insertOne({
      organizationId: nugenOrgId,
      projectId: null,
      title: t.taskTitle || 'Untitled task',
      description: t.description || '',
      status,
      priority: 'medium',
      assigneeId: assignee.authUserId,
      assigneeIds: [assignee.authUserId],
      reporterId: creator ? creator.authUserId : assignee.authUserId,
      createdBy: creator ? creator.authUserId : assignee.authUserId,
      dueDate: t.deadline || null,
      completedAt: t.isCompleted ? (t.completionDate || t.updatedAt || null) : null,
      progress: Math.max(0, Math.min(100, t.progress || 0)),
      labels: [],
      attachments: [],
      isDeleted: false,
      createdAt: t.createdAt || new Date(),
      updatedAt: t.updatedAt || new Date(),
      _migration: {
        source: SOURCE_TAG,
        sourceId: String(t._id),
        sourceTaskEffort: t.taskEffort || null,
        sourceReviewFeedback: t.reviewFeedback || null,
      },
    });
    taskNew++;
  }
  console.log(`  ✓ ${taskNew} tasks migrated, ${taskOrphan} orphaned (assignee not in user map)`);

  // ── Verification summary ───────────────────────────────────────────
  console.log('\n=== Verification ===');
  console.log(`Tenant: ${ORG_NAME}`);
  console.log(`  org _id:       ${nugenOrgId}`);
  console.log(`  features on:   ${Object.entries(NUGEN_FEATURES).filter(([,v]) => v.enabled).map(([k]) => k).join(', ')}`);
  console.log(`  features off:  ${Object.entries(NUGEN_FEATURES).filter(([,v]) => !v.enabled).map(([k]) => k).join(', ')}`);
  console.log(`  total members: ${await auth.collection('orgmemberships').countDocuments({ organizationId: nugenOrgId })}`);
  console.log(`     active:     ${await auth.collection('orgmemberships').countDocuments({ organizationId: nugenOrgId, status: 'active' })}`);
  console.log(`     inactive:   ${await auth.collection('orgmemberships').countDocuments({ organizationId: nugenOrgId, status: 'inactive' })}`);
  console.log(`  employees:     ${await hr.collection('employees').countDocuments({ organizationId: nugenOrgId })}`);
  console.log(`     active:     ${await hr.collection('employees').countDocuments({ organizationId: nugenOrgId, status: 'active' })}`);
  console.log(`     exited:     ${await hr.collection('employees').countDocuments({ organizationId: nugenOrgId, status: 'exited' })}`);
  console.log(`  designations:  ${await hr.collection('designations').countDocuments({ organizationId: nugenOrgId })}`);
  console.log(`  holidays:      ${await att.collection('holidays').countDocuments({ organizationId: nugenOrgId })}`);
  console.log(`  attendance:    ${await att.collection('attendances').countDocuments({ organizationId: nugenOrgId })}`);
  console.log(`  tasks:         ${await tsk.collection('tasks').countDocuments({ organizationId: nugenOrgId })}`);

  // Sanity: who's the owner?
  const refreshedOrg = await auth.collection('organizations').findOne({ _id: nugen._id });
  if (refreshedOrg.ownerId) {
    const owner = await auth.collection('users').findOne(
      { _id: typeof refreshedOrg.ownerId === 'string' ? null : refreshedOrg.ownerId },
    ) || await auth.collection('users').findOne({ email: VARUN_EMAIL });
    if (owner) {
      console.log(`  owner:         ${owner.firstName} ${owner.lastName} <${owner.email}>`);
    }
  }

  await src.close();
  await dst.close();
  console.log('\n✓ Migration complete\n');
}

main().catch((e) => {
  console.error('\n✗ Migration failed:', e);
  process.exit(1);
});
