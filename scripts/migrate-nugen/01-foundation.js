// Nugen → Nexora migration: Phase 1 (foundation)
// Migrates: Organization, Designations, Roles, Users + Employees + OrgMemberships, Device Tokens
// Strategy A: preserve source _ids verbatim.
//
// Run: node scripts/migrate-nugen/01-foundation.js
//
// SAFE TO RE-RUN: uses upsert on source _id.

const { MongoClient, ObjectId } = require('mongodb');

const SOURCE_URI =
  'mongodb+srv://varun:hariom786@cluster0-r2jpw.mongodb.net/nugen_backend_prod?retryWrites=true&w=majority';
const LOCAL_URI =
  'mongodb://root:nexora_dev_password@localhost:27017/?authSource=admin';

// Synthetic Nugen org ID (deterministic so reruns are safe).
const NUGEN_ORG_ID = '6600000000000000000000a0';
const ADMIN_USER_SOURCE_ID = '645c9ffd5329fcac1a3d0d21'; // admin@gmail.com — Nugen tenant admin (NOT platform admin)
// Platform admin is a separate, single cross-tenant user (platform@nexora.io) managed outside this script.

// ── Role enum remap (Nugen roleName → Nexora orgmembership.role enum) ──
const ROLE_ENUM_MAP = {
  'ADMIN': 'admin',
  'CTO': 'owner',
  'HR': 'hr',
  'TEAM LEAD': 'manager',
  'SCRUM MASTER': 'manager',
  'JR. DEVELOPER': 'developer',
  'INTERN': 'employee',
  'TRAINEE': 'employee',
  'DIGITAL MARKETING': 'employee',
  'BDE': 'employee',
};

// ── Role permission resource remap ──
const PERM_RESOURCE_MAP = {
  'My Leave': 'leaves',
  'Leave Tagged': 'leaves',
  'Checkin/Checkout': 'attendance',
  'Tasks': 'tasks',
  'Holidays': 'attendance', // no 'holidays' in Nexora enum
  'All Users': 'employees',
  'Profiles': 'employees',
  'Users Attendance Config': 'employees',
  'Roles': 'roles',
  'Stats': 'reports',
  'Filter': 'reports',
  'Logs': 'reports',
  'Settings Change Password': null, // drop
  'Email Templates': null, // drop
  'Notification Send Custom Notification': null, // drop
};

// Source action → Nexora actions[] (enum: view, create, edit, delete, export, assign)
function mapActions(sourceActions) {
  const out = new Set();
  for (const a of sourceActions || []) {
    const up = a.toUpperCase();
    if (up === 'READ' || up.startsWith('READ_')) out.add('view');
    else if (up === 'WRITE') { out.add('create'); out.add('edit'); }
    else if (up === 'DELETE') out.add('delete');
    else if (up === 'EXPORT') out.add('export');
    else if (up === 'ASSIGN') out.add('assign');
  }
  return [...out];
}

function splitName(userName) {
  if (!userName || typeof userName !== 'string') return { firstName: 'Unknown', lastName: 'User' };
  const trimmed = userName.trim();
  if (!trimmed) return { firstName: 'Unknown', lastName: 'User' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  const src = await MongoClient.connect(SOURCE_URI);
  const dst = await MongoClient.connect(LOCAL_URI);

  try {
    const srcDb = src.db('nugen_backend_prod');
    const authDb = dst.db('nexora_auth');
    const hrDb = dst.db('nexora_hr');
    const notifDb = dst.db('nexora_notifications');

    const now = new Date();
    const counters = {};

    // ── 1. Organization ──
    console.log('\n=== 1. Organization ===');
    const org = {
      _id: new ObjectId(NUGEN_ORG_ID),
      name: 'Nugen IT Services',
      slug: 'nugen-it-services',
      industry: 'it-services',
      size: '11-50',
      plan: 'enterprise',
      country: 'India',
      state: 'Punjab',
      city: 'Jalandhar',
      description: 'Migrated from legacy Nugen backend',
      ownerId: ADMIN_USER_SOURCE_ID,
      settings: {
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        numberFormat: 'indian',
        weekStartDay: 'monday',
        financialYearStart: 4,
      },
      onboardingCompleted: true,
      onboardingStep: 99,
      isActive: true,
      isDeleted: false,
      createdBy: ADMIN_USER_SOURCE_ID,
      createdAt: now,
      updatedAt: now,
    };
    // Pull geofence from source config if present
    const srcConfig = await srcDb.collection('config').findOne();
    if (srcConfig && srcConfig.officeCoordinates) {
      org.workPreferences = {
        legacyGeofence: {
          lat: parseFloat(srcConfig.officeCoordinates.latitude),
          lng: parseFloat(srcConfig.officeCoordinates.longitude),
          radiusMeters: srcConfig.geoFenceAreaInMeter || 500,
        },
        legalLinks: {
          privacyPolicy: srcConfig.privacyPolicy,
          termsAndCondition: srcConfig.termsAndCondition,
        },
      };
    }
    await authDb.collection('organizations').replaceOne({ _id: org._id }, org, { upsert: true });
    counters.organization = 1;
    console.log(`  upserted organization: ${org.name}`);

    // ── 2. Designations (source: profile) ──
    console.log('\n=== 2. Designations ===');
    const profiles = await srcDb.collection('profile').find({ isDeleted: { $ne: true } }).toArray();
    let designationCount = 0;
    for (const p of profiles) {
      const doc = {
        _id: p._id,
        organizationId: NUGEN_ORG_ID,
        title: p.name,
        level: 5,
        track: /manager|lead|cto/i.test(p.name) ? 'management' : 'individual_contributor',
        isActive: p.isActive !== false,
        isDeleted: !!p.isDeleted,
        createdAt: p.createdAt || now,
        updatedAt: p.updatedAt || now,
      };
      await hrDb.collection('designations').replaceOne({ _id: doc._id }, doc, { upsert: true });
      designationCount++;
    }
    counters.designations = designationCount;
    console.log(`  upserted ${designationCount} designations`);

    // ── 3. Roles ──
    console.log('\n=== 3. Roles ===');
    const srcRoles = await srcDb.collection('roles').find({ isDeleted: { $ne: true } }).toArray();
    let roleCount = 0;
    for (const r of srcRoles) {
      // Remap permissions
      const resourceMap = new Map(); // resource -> Set<action>
      for (const p of r.permissions || []) {
        const resource = PERM_RESOURCE_MAP[p.name];
        if (resource === undefined || resource === null) continue;
        const actions = mapActions(p.permissions);
        if (!resourceMap.has(resource)) resourceMap.set(resource, new Set());
        actions.forEach(a => resourceMap.get(resource).add(a));
      }
      const permissions = [...resourceMap.entries()].map(([resource, actions]) => ({
        resource,
        actions: [...actions],
      }));

      const doc = {
        _id: r._id,
        name: slugify(r.roleName),
        displayName: r.roleName,
        description: `Migrated from Nugen (${r.roleName})`,
        permissions,
        color: '#475569',
        organizationId: NUGEN_ORG_ID,
        isSystem: false,
        isActive: r.isActive !== false,
        isDeleted: !!r.isDeleted,
        createdBy: ADMIN_USER_SOURCE_ID,
        createdAt: r.createdAt || now,
        updatedAt: r.updatedAt || now,
      };
      await authDb.collection('roles').replaceOne({ _id: doc._id }, doc, { upsert: true });
      roleCount++;
    }
    counters.roles = roleCount;
    console.log(`  upserted ${roleCount} roles`);

    // ── 4. Users + Employees + OrgMemberships ──
    console.log('\n=== 4. Users + Employees + Memberships ===');
    const srcUsers = await srcDb.collection('users').find({ isDeleted: { $ne: true } }).toArray();
    // Build role lookup
    const roleById = new Map();
    srcRoles.forEach(r => roleById.set(String(r._id), r));

    let userCount = 0, empCount = 0, memCount = 0;
    const emailSeen = new Set();
    for (const u of srcUsers) {
      const email = (u.email || '').toLowerCase().trim();
      if (!email || emailSeen.has(email)) {
        console.log(`  skipping duplicate/invalid email: ${u._id} ${u.email}`);
        continue;
      }
      emailSeen.add(email);

      const { firstName, lastName } = splitName(u.userName);

      // 4a. auth.users
      const userDoc = {
        _id: u._id,
        email,
        firstName,
        lastName,
        avatar: u.profileImage || null,
        isEmailVerified: true,
        phoneNumber: u.mobileNumber || null,
        isPhoneVerified: !!u.mobileNumber,
        mfaEnabled: false,
        loginAttempts: 0,
        isActive: u.isActive !== false,
        setupStage: 'complete',
        defaultOrganizationId: NUGEN_ORG_ID,
        lastOrgId: NUGEN_ORG_ID,
        organizations: [NUGEN_ORG_ID],
        roles: [],
        permissions: [],
        isPlatformAdmin: false, // Nugen users are tenant-scoped; platform@nexora.io is the only platform admin
        preferences: {
          theme: 'system',
          language: 'en',
          timezone: 'Asia/Kolkata',
          notifications: { email: true, inApp: true, desktop: true },
        },
        createdAt: u.createdAt || now,
        updatedAt: u.updatedAt || now,
      };
      await authDb.collection('users').replaceOne({ _id: userDoc._id }, userDoc, { upsert: true });
      userCount++;

      // 4b. hr.employees
      const srcRole = u.roleId ? roleById.get(String(u.roleId)) : null;
      const empDoc = {
        _id: u._id, // same id for simplicity
        organizationId: NUGEN_ORG_ID,
        userId: String(u._id),
        employeeId: `NUG-${String(u._id).slice(-6).toUpperCase()}`,
        firstName,
        lastName,
        email,
        avatar: u.profileImage || null,
        phone: u.mobileNumber || null,
        dateOfBirth: u.dOB || null,
        designationId: u.profileId ? String(u.profileId) : null,
        employmentType: /intern|trainee/i.test(srcRole?.roleName || '') ? 'intern' : 'full_time',
        joiningDate: u.joiningDate || u.createdAt || now,
        location: u.address || null,
        timezone: 'Asia/Kolkata',
        skills: [],
        documents: u.idProof ? [{ type: 'id_proof', url: u.idProof, uploadedAt: u.createdAt || now, verified: false }] : [],
        status: u.isActive !== false ? 'active' : 'exited',
        isActive: u.isActive !== false,
        isDeleted: !!u.isDeleted,
        createdBy: ADMIN_USER_SOURCE_ID,
        createdAt: u.createdAt || now,
        updatedAt: u.updatedAt || now,
      };
      await hrDb.collection('employees').replaceOne({ _id: empDoc._id }, empDoc, { upsert: true });
      empCount++;

      // 4c. auth.orgmemberships
      const roleEnum = srcRole ? (ROLE_ENUM_MAP[srcRole.roleName] || 'employee') : 'employee';
      const memDoc = {
        organizationId: NUGEN_ORG_ID,
        userId: String(u._id),
        email,
        roleId: u.roleId ? String(u.roleId) : null,
        role: roleEnum,
        status: u.isActive !== false ? 'active' : 'deactivated',
        joinedAt: u.joiningDate || u.createdAt || now,
        createdAt: u.createdAt || now,
        updatedAt: u.updatedAt || now,
      };
      await authDb.collection('orgmemberships').replaceOne(
        { userId: memDoc.userId, organizationId: NUGEN_ORG_ID },
        memDoc,
        { upsert: true },
      );
      memCount++;
    }
    counters.users = userCount;
    counters.employees = empCount;
    counters.memberships = memCount;
    console.log(`  users: ${userCount}, employees: ${empCount}, memberships: ${memCount}`);

    // ── 5. Device Tokens ──
    console.log('\n=== 5. Device Tokens ===');
    let deviceCount = 0;
    for (const u of srcUsers) {
      const devices = u.devices || [];
      for (const d of devices) {
        if (!d.token) continue;
        const doc = {
          _id: d._id || new ObjectId(),
          userId: String(u._id),
          platform: ['android', 'ios', 'web'].includes(d.platform) ? d.platform : 'web',
          token: d.token,
          deviceId: d.deviceId || 'unknown',
          appVersion: d.appVersion || null,
          lastUsedAt: d.lastSeenAt || now,
          failCount: 0,
          createdAt: d.createdAt || now,
          updatedAt: now,
        };
        try {
          await notifDb.collection('devicetokens').replaceOne(
            { token: doc.token },
            doc,
            { upsert: true },
          );
          deviceCount++;
        } catch (e) {
          // duplicate token (unique index) — skip
        }
      }
    }
    counters.deviceTokens = deviceCount;
    console.log(`  upserted ${deviceCount} device tokens`);

    // ── Summary ──
    console.log('\n=== SUMMARY ===');
    console.table(counters);
  } finally {
    await src.close();
    await dst.close();
  }
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e);
  process.exit(1);
});
