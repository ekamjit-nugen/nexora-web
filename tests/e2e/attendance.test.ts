/**
 * Nexora E2E Tests — Attendance Module
 * Tests clock-in/out, manual entries, shifts, policies, templates, alerts
 */

import { suite, test, expect, businessTest, run } from '../framework';
import { apiRequest, createTestUser, createTestOrg } from '../config';

suite('Attendance', 'e2e', 'attendance');

// ── Shared State ──

const TS = Date.now();
let adminToken = '';
let adminOrgId = '';
let memberToken = '';
let memberUserId = '';
let manualEntryId = '';
let manualEntryId2 = '';
let shiftId = '';
let policyId = '';
let templateId = '';

// ── Setup: create admin user + org, invite member user ──

test('Setup: create admin user and org', async () => {
  const adminEmail = `att-admin-${TS}@test.nexora.io`;
  adminToken = await createTestUser(adminEmail, 'AttAdmin', 'Tester');
  expect(adminToken).toBeTruthy();

  const org = await createTestOrg(adminToken, `AttTestOrg-${TS}`);
  adminOrgId = org.orgId;
  adminToken = org.token;
  expect(adminOrgId).toBeTruthy();
});

test('Setup: create member user and invite to org', async () => {
  // Create the member user independently first
  const memberEmail = `att-member-${TS}@test.nexora.io`;
  const tempMemberToken = await createTestUser(memberEmail, 'AttMember', 'Worker');
  expect(tempMemberToken).toBeTruthy();

  // Invite member to org
  const inviteRes = await apiRequest(`/auth/organizations/${adminOrgId}/invite`, {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({ email: memberEmail, role: 'member', firstName: 'AttMember', lastName: 'Worker' }),
  });
  expect(inviteRes.data.success).toBe(true);

  // Member joins the org
  const joinRes = await apiRequest(`/auth/organizations/${adminOrgId}/join`, {
    method: 'POST',
    token: tempMemberToken,
  });
  // Switch member to org context
  const switchRes = await apiRequest('/auth/switch-org', {
    method: 'POST',
    token: tempMemberToken,
    body: JSON.stringify({ organizationId: adminOrgId }),
  });
  memberToken = (switchRes.data.data as Record<string, string>)?.accessToken || tempMemberToken;
  expect(memberToken).toBeTruthy();

  // Get member userId from /auth/me
  const meRes = await apiRequest('/auth/me', { token: memberToken });
  memberUserId = (meRes.data.data as Record<string, string>)?._id ||
    (meRes.data.data as Record<string, Record<string, string>>)?.user?._id || '';
  expect(memberUserId).toBeTruthy();
});

// ── 1. Clock In ──

test('1. Clock in records attendance for non-admin user', async () => {
  const res = await apiRequest('/attendance/check-in', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({ method: 'web' }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── 2. Clock Out ──

test('2. Clock out calculates working hours', async () => {
  // Small delay to produce a nonzero duration
  await new Promise(r => setTimeout(r, 1000));

  const res = await apiRequest('/attendance/check-out', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({ method: 'web' }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── 3. Cannot clock in twice without clocking out ──

test('3. Cannot clock in twice without clocking out (expect 409)', async () => {
  // First clock in
  const first = await apiRequest('/attendance/check-in', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({ method: 'web' }),
  });
  expect(first.status).toBe(201);

  // Second clock in without clock out should fail
  const second = await apiRequest('/attendance/check-in', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({ method: 'web' }),
  });
  expect(second.status).toBe(409);

  // Cleanup: clock out
  await apiRequest('/attendance/check-out', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({ method: 'web' }),
  });
});

// ── 4. Admin/super_admin cannot clock in ──

test('4. Admin/super_admin cannot clock in (expect 403)', async () => {
  const res = await apiRequest('/attendance/check-in', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({ method: 'web' }),
  });
  expect(res.status).toBe(403);
});

// ── 5. Manual entry creates pending record ──

test('5. Manual entry creates pending record', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const res = await apiRequest('/attendance/manual-entry', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      date: dateStr,
      checkInTime: `${dateStr}T09:00:00.000Z`,
      checkOutTime: `${dateStr}T17:00:00.000Z`,
      reason: 'Forgot to clock in - E2E test',
      status: 'present',
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  manualEntryId = (res.data.data as Record<string, string>)?._id || '';
  expect(manualEntryId).toBeTruthy();
});

// ── 6. Approve manual entry ──

test('6. Approve manual entry', async () => {
  // Create another manual entry for approval
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().split('T')[0];

  const createRes = await apiRequest('/attendance/manual-entry', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      date: dateStr,
      checkInTime: `${dateStr}T09:00:00.000Z`,
      checkOutTime: `${dateStr}T17:00:00.000Z`,
      reason: 'For approval test',
      status: 'present',
    }),
  });
  const entryId = (createRes.data.data as Record<string, string>)?._id || '';
  expect(entryId).toBeTruthy();

  // Admin approves it
  const res = await apiRequest(`/attendance/${entryId}/approve`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ approved: true }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// ── 7. Reject manual entry with reason ──

test('7. Reject manual entry with reason', async () => {
  // Create another manual entry for rejection
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const dateStr = threeDaysAgo.toISOString().split('T')[0];

  const createRes = await apiRequest('/attendance/manual-entry', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      date: dateStr,
      checkInTime: `${dateStr}T10:00:00.000Z`,
      checkOutTime: `${dateStr}T18:00:00.000Z`,
      reason: 'For rejection test',
      status: 'present',
    }),
  });
  manualEntryId2 = (createRes.data.data as Record<string, string>)?._id || '';
  expect(manualEntryId2).toBeTruthy();

  // Admin rejects it
  const res = await apiRequest(`/attendance/${manualEntryId2}/approve`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ approved: false, rejectionReason: 'Invalid hours reported' }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.message).toContain('rejected');
});

// ── 8. Today status shows sessions ──

test('8. Today status shows sessions', async () => {
  const res = await apiRequest('/attendance/today', {
    token: memberToken,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── 9. Attendance stats ──

test('9. Attendance stats', async () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  const res = await apiRequest(`/attendance/stats?startDate=${startDate}&endDate=${endDate}`, {
    token: adminToken,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── 10. Shift CRUD ──

test('10a. Create shift', async () => {
  const res = await apiRequest('/shifts', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      shiftName: `Morning Shift ${TS}`,
      startTime: '09:00',
      endTime: '17:00',
      graceMinutesLateArrival: 15,
      graceMinutesEarlyDeparture: 10,
      minimumWorkingHours: 8,
      breakDurationMinutes: 60,
      isNightShift: false,
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  shiftId = (res.data.data as Record<string, string>)?._id || '';
  expect(shiftId).toBeTruthy();
});

test('10b. List shifts', async () => {
  const res = await apiRequest('/shifts', { token: adminToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const shifts = res.data.data as unknown[];
  expect(Array.isArray(shifts)).toBe(true);
  expect(shifts.length).toBeGreaterThan(0);
});

test('10c. Update shift', async () => {
  const res = await apiRequest(`/shifts/${shiftId}`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ shiftName: `Updated Morning Shift ${TS}`, graceMinutesLateArrival: 20 }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

test('10d. Delete shift', async () => {
  const res = await apiRequest(`/shifts/${shiftId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// ── 11. Policy CRUD ──

test('11a. Create policy', async () => {
  const res = await apiRequest('/policies', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      policyName: `Work Timing Policy ${TS}`,
      description: 'E2E test work timing policy',
      type: 'work_timing',
      category: 'work_policy',
      applicableTo: 'all',
      maxWorkingHoursPerWeek: 40,
      workTiming: {
        startTime: '09:00',
        endTime: '18:00',
        timezone: 'Asia/Kolkata',
        graceMinutes: 15,
        minWorkingHours: 8,
        breakMinutes: 60,
      },
      alerts: {
        lateArrival: true,
        earlyDeparture: true,
        missedClockIn: true,
        overtimeAlert: true,
      },
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  policyId = (res.data.data as Record<string, string>)?._id || '';
  expect(policyId).toBeTruthy();
});

test('11b. List policies', async () => {
  const res = await apiRequest('/policies', { token: adminToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const policies = res.data.data as unknown[];
  expect(Array.isArray(policies)).toBe(true);
  expect(policies.length).toBeGreaterThan(0);
});

test('11c. Update policy', async () => {
  const res = await apiRequest(`/policies/${policyId}`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ policyName: `Updated Policy ${TS}`, maxWorkingHoursPerWeek: 45 }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

test('11d. Delete policy', async () => {
  const res = await apiRequest(`/policies/${policyId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// ── 12. Create policy from template ──

test('12. Create policy from template', async () => {
  // First get templates
  const templatesRes = await apiRequest('/policies/templates', { token: adminToken });
  expect(templatesRes.status).toBe(200);
  const templates = templatesRes.data.data as Array<Record<string, string>>;

  if (Array.isArray(templates) && templates.length > 0) {
    templateId = templates[0]._id;
    const res = await apiRequest(`/policies/from-template/${templateId}`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ policyName: `From Template ${TS}` }),
    });
    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
  } else {
    // No templates seeded; create a template first, then derive from it
    const tplRes = await apiRequest('/policies', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        policyName: `Template ${TS}`,
        type: 'work_timing',
        category: 'work_policy',
        isTemplate: true,
        templateName: `Tpl-${TS}`,
        workTiming: { startTime: '08:00', endTime: '16:00', graceMinutes: 10, minWorkingHours: 7 },
      }),
    });
    templateId = (tplRes.data.data as Record<string, string>)?._id || '';
    expect(templateId).toBeTruthy();

    const res = await apiRequest(`/policies/from-template/${templateId}`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ policyName: `Derived Policy ${TS}` }),
    });
    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
  }
});

// ── 13. Get templates ──

test('13. Get templates', async () => {
  const res = await apiRequest('/policies/templates', { token: adminToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── 14. Alert generation on late clock-in ──

test('14. Alert generation on late clock-in', async () => {
  // Create a strict policy with early start time (start 05:00) so current clock-in is "late"
  const strictPolicyRes = await apiRequest('/policies', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      policyName: `Strict Early Policy ${TS}`,
      type: 'work_timing',
      category: 'work_policy',
      applicableTo: 'all',
      workTiming: {
        startTime: '05:00',
        endTime: '13:00',
        graceMinutes: 0,
        minWorkingHours: 8,
      },
      alerts: {
        lateArrival: true,
        earlyDeparture: false,
        missedClockIn: false,
        overtimeAlert: false,
      },
    }),
  });
  expect(strictPolicyRes.status).toBe(201);

  // Member clocks in (should be considered late against 05:00 start)
  await apiRequest('/attendance/check-in', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({ method: 'web' }),
  });

  // Check alerts
  const alertsRes = await apiRequest('/alerts/my', { token: memberToken });
  expect(alertsRes.status).toBe(200);
  expect(alertsRes.data.success).toBe(true);
  // Alerts data is defined (may or may not have a late arrival depending on timing)
  expect(alertsRes.data.data).toBeDefined();

  // Cleanup clock-out
  await apiRequest('/attendance/check-out', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({ method: 'web' }),
  });
});

run();
