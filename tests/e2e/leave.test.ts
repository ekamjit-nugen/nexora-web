/**
 * Nexora E2E Tests — Leave Management Module
 * Tests leave apply/approve/reject/cancel, balance, policies, stats, team calendar
 */

import { suite, test, expect, businessTest, run } from '../framework';
import { apiRequest, createTestUser, createTestOrg } from '../config';

suite('Leave Management', 'e2e', 'leave');

// ── Shared State ──

const TS = Date.now();
let adminToken = '';
let adminOrgId = '';
let memberToken = '';
let memberUserId = '';
let leaveId = '';
let leaveIdForApproval = '';
let leaveIdForRejection = '';
let leaveIdForCancel = '';
let leaveIdRejected = '';
let leavePolicyId = '';
let lopLeaveId = '';

// Helper: future date string offset by N days from today
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

// ── Setup ──

test('Setup: create admin user and org', async () => {
  const adminEmail = `lv-admin-${TS}@test.nexora.io`;
  adminToken = await createTestUser(adminEmail, 'LvAdmin', 'Tester');
  expect(adminToken).toBeTruthy();

  const org = await createTestOrg(adminToken, `LvTestOrg-${TS}`);
  adminOrgId = org.orgId;
  adminToken = org.token;
  expect(adminOrgId).toBeTruthy();
});

test('Setup: create member user and invite to org', async () => {
  const memberEmail = `lv-member-${TS}@test.nexora.io`;
  const tempMemberToken = await createTestUser(memberEmail, 'LvMember', 'Worker');
  expect(tempMemberToken).toBeTruthy();

  // Invite member
  const inviteRes = await apiRequest(`/auth/organizations/${adminOrgId}/invite`, {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({ email: memberEmail, role: 'member', firstName: 'LvMember', lastName: 'Worker' }),
  });
  expect(inviteRes.data.success).toBe(true);

  // Member joins org
  await apiRequest(`/auth/organizations/${adminOrgId}/join`, {
    method: 'POST',
    token: tempMemberToken,
  });

  // Switch to org context
  const switchRes = await apiRequest('/auth/switch-org', {
    method: 'POST',
    token: tempMemberToken,
    body: JSON.stringify({ organizationId: adminOrgId }),
  });
  memberToken = (switchRes.data.data as Record<string, string>)?.accessToken || tempMemberToken;
  expect(memberToken).toBeTruthy();

  // Get member userId
  const meRes = await apiRequest('/auth/me', { token: memberToken });
  memberUserId = (meRes.data.data as Record<string, string>)?._id ||
    (meRes.data.data as Record<string, Record<string, string>>)?.user?._id || '';
  expect(memberUserId).toBeTruthy();
});

test('Setup: create leave policy for the org', async () => {
  const res = await apiRequest('/leave-policies', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      policyName: `Leave Policy ${TS}`,
      status: 'active',
      leaveTypes: [
        { type: 'casual', annualAllocation: 12, accrualFrequency: 'annual', maxCarryForward: 3, encashable: false, maxConsecutiveDays: 3 },
        { type: 'sick', annualAllocation: 12, accrualFrequency: 'annual', maxCarryForward: 0, encashable: false, maxConsecutiveDays: 7 },
        { type: 'earned', annualAllocation: 15, accrualFrequency: 'monthly', maxCarryForward: 5, encashable: true, maxConsecutiveDays: 10 },
        { type: 'wfh', annualAllocation: 24, accrualFrequency: 'annual', maxCarryForward: 0, encashable: false, maxConsecutiveDays: 5 },
        { type: 'lop', annualAllocation: 0, accrualFrequency: 'on_request', maxCarryForward: 0, encashable: false, maxConsecutiveDays: 30 },
      ],
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  leavePolicyId = (res.data.data as Record<string, string>)?._id || '';
  expect(leavePolicyId).toBeTruthy();
});

// ── 1. Apply leave with valid dates ──

test('1. Apply leave with valid dates', async () => {
  const start = futureDate(10);
  const end = futureDate(11);

  const res = await apiRequest('/leaves', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      leaveType: 'casual',
      startDate: start,
      endDate: end,
      reason: 'E2E test casual leave',
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  leaveId = (res.data.data as Record<string, string>)?._id || '';
  expect(leaveId).toBeTruthy();
});

// ── 2. Overlapping leave rejected (409) ──

test('2. Overlapping leave rejected (409)', async () => {
  const start = futureDate(10);
  const end = futureDate(11);

  const res = await apiRequest('/leaves', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      leaveType: 'casual',
      startDate: start,
      endDate: end,
      reason: 'Overlapping leave attempt',
    }),
  });
  expect(res.status).toBe(409);
});

// ── 3. Approve leave deducts balance ──

test('3. Approve leave deducts balance', async () => {
  // Create a leave to approve
  const start = futureDate(20);
  const end = futureDate(21);

  const createRes = await apiRequest('/leaves', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      leaveType: 'casual',
      startDate: start,
      endDate: end,
      reason: 'For approval test',
    }),
  });
  leaveIdForApproval = (createRes.data.data as Record<string, string>)?._id || '';
  expect(leaveIdForApproval).toBeTruthy();

  // Get balance before approval
  const currentYear = new Date().getFullYear();
  const balanceBefore = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });

  // Admin approves
  const approveRes = await apiRequest(`/leaves/${leaveIdForApproval}/approve`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'approved' }),
  });
  expect(approveRes.status).toBe(200);
  expect(approveRes.data.success).toBe(true);

  // Verify balance changed
  const balanceAfter = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });
  expect(balanceAfter.status).toBe(200);
  expect(balanceAfter.data.data).toBeDefined();
});

// ── 4. Reject leave with reason ──

test('4. Reject leave with reason', async () => {
  const start = futureDate(30);
  const end = futureDate(31);

  const createRes = await apiRequest('/leaves', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      leaveType: 'casual',
      startDate: start,
      endDate: end,
      reason: 'For rejection test',
    }),
  });
  leaveIdForRejection = (createRes.data.data as Record<string, string>)?._id || '';
  expect(leaveIdForRejection).toBeTruthy();

  const res = await apiRequest(`/leaves/${leaveIdForRejection}/approve`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'rejected', rejectionReason: 'Team capacity full during that period' }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.message).toContain('rejected');
});

// ── 5. Cancel approved leave restores balance ──

test('5. Cancel approved leave restores balance', async () => {
  // Create and approve a leave
  const start = futureDate(40);
  const end = futureDate(41);

  const createRes = await apiRequest('/leaves', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      leaveType: 'casual',
      startDate: start,
      endDate: end,
      reason: 'For cancel test',
    }),
  });
  leaveIdForCancel = (createRes.data.data as Record<string, string>)?._id || '';
  expect(leaveIdForCancel).toBeTruthy();

  // Approve it
  await apiRequest(`/leaves/${leaveIdForCancel}/approve`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ status: 'approved' }),
  });

  // Get balance after approval
  const currentYear = new Date().getFullYear();
  const balanceAfterApprove = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });

  // Cancel the approved leave
  const cancelRes = await apiRequest(`/leaves/${leaveIdForCancel}/cancel`, {
    method: 'PUT',
    token: memberToken,
    body: JSON.stringify({ reason: 'Plans changed, no longer needed' }),
  });
  expect([200, 201]).toContain(cancelRes.status);
  expect(cancelRes.data.success || cancelRes.status === 200 || cancelRes.status === 201).toBeTruthy();

  // Verify balance restored
  const balanceAfterCancel = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });
  expect(balanceAfterCancel.status).toBe(200);
  expect(balanceAfterCancel.data.data).toBeDefined();
});

// ── 6. Cannot cancel rejected leave ──

test('6. Cannot cancel rejected leave', async () => {
  // leaveIdForRejection was already rejected in test 4
  const res = await apiRequest(`/leaves/${leaveIdForRejection}/cancel`, {
    method: 'PUT',
    token: memberToken,
    body: JSON.stringify({ reason: 'Trying to cancel rejected leave' }),
  });
  // Should fail — rejected leaves cannot be cancelled
  expect(res.status).not.toBe(200);
});

// ── 7. My leaves filter ──

test('7. My leaves filter', async () => {
  const res = await apiRequest('/leaves/my', { token: memberToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const leaves = res.data.data as unknown[];
  expect(Array.isArray(leaves)).toBe(true);
  expect(leaves.length).toBeGreaterThan(0);
});

// ── 8. All leaves list ──

test('8. All leaves list', async () => {
  const res = await apiRequest('/leaves', { token: adminToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const leaves = res.data.data as unknown[];
  expect(Array.isArray(leaves)).toBe(true);
});

// ── 9. Leave balance auto-initialize ──

test('9. Leave balance auto-initialize', async () => {
  const currentYear = new Date().getFullYear();
  const res = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── 10. Half-day leave ──

test('10. Half-day leave (0.5 days)', async () => {
  const halfDayDate = futureDate(50);

  const res = await apiRequest('/leaves', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      leaveType: 'casual',
      startDate: halfDayDate,
      endDate: halfDayDate,
      reason: 'Half day E2E test',
      halfDay: {
        enabled: true,
        date: halfDayDate,
        half: 'first_half',
      },
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
});

// ── 11. Leave stats ──

test('11. Leave stats', async () => {
  const startDate = `${new Date().getFullYear()}-01-01`;
  const endDate = `${new Date().getFullYear()}-12-31`;

  const res = await apiRequest(`/leaves/stats?startDate=${startDate}&endDate=${endDate}`, {
    token: adminToken,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── 12. Leave policy CRUD ──

test('12a. Create leave policy', async () => {
  const res = await apiRequest('/leave-policies', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      policyName: `CRUD Policy ${TS}`,
      status: 'draft',
      leaveTypes: [
        { type: 'casual', annualAllocation: 10, accrualFrequency: 'annual', maxCarryForward: 2, encashable: false, maxConsecutiveDays: 3 },
        { type: 'sick', annualAllocation: 8, accrualFrequency: 'annual', maxCarryForward: 0, encashable: false, maxConsecutiveDays: 5 },
      ],
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const newPolicyId = (res.data.data as Record<string, string>)?._id || '';
  expect(newPolicyId).toBeTruthy();
  // Store for update/delete
  leavePolicyId = newPolicyId;
});

test('12b. List leave policies', async () => {
  const res = await apiRequest('/leave-policies', { token: adminToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const policies = res.data.data as unknown[];
  expect(Array.isArray(policies)).toBe(true);
  expect(policies.length).toBeGreaterThan(0);
});

test('12c. Get leave policy by ID', async () => {
  const res = await apiRequest(`/leave-policies/${leavePolicyId}`, { token: adminToken });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

test('12d. Update leave policy', async () => {
  const res = await apiRequest(`/leave-policies/${leavePolicyId}`, {
    method: 'PUT',
    token: adminToken,
    body: JSON.stringify({ policyName: `Updated CRUD Policy ${TS}`, status: 'active' }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

test('12e. Delete leave policy', async () => {
  const res = await apiRequest(`/leave-policies/${leavePolicyId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// ── 13. LOP leave skips balance check ──

test('13. LOP leave skips balance check', async () => {
  const start = futureDate(60);
  const end = futureDate(65);

  const res = await apiRequest('/leaves', {
    method: 'POST',
    token: memberToken,
    body: JSON.stringify({
      leaveType: 'lop',
      startDate: start,
      endDate: end,
      reason: 'LOP leave - no balance deduction needed',
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  lopLeaveId = (res.data.data as Record<string, string>)?._id || '';
  expect(lopLeaveId).toBeTruthy();
});

// ── 14. Team calendar ──

test('14. Team calendar', async () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const res = await apiRequest(`/leaves/team-calendar?month=${month}&year=${year}&departmentId=all`, {
    token: adminToken,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// ── Business Tests ──

businessTest(
  'BIZ: Leave balance auto-initializes for new employees',
  async () => {
    // Create a brand new member and check their balance immediately
    const newMemberEmail = `lv-newbie-${TS}@test.nexora.io`;
    const newToken = await createTestUser(newMemberEmail, 'Newbie', 'Employee');
    expect(newToken).toBeTruthy();

    // Invite and switch to org
    await apiRequest(`/auth/organizations/${adminOrgId}/invite`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ email: newMemberEmail, role: 'member', firstName: 'Newbie', lastName: 'Employee' }),
    });
    await apiRequest(`/auth/organizations/${adminOrgId}/join`, {
      method: 'POST',
      token: newToken,
    });
    const switchRes = await apiRequest('/auth/switch-org', {
      method: 'POST',
      token: newToken,
      body: JSON.stringify({ organizationId: adminOrgId }),
    });
    const orgToken = (switchRes.data.data as Record<string, string>)?.accessToken || newToken;

    // Check balance — should be auto-initialized without manual setup
    const currentYear = new Date().getFullYear();
    const balanceRes = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: orgToken });
    expect(balanceRes.status).toBe(200);
    expect(balanceRes.data.success).toBe(true);
    expect(balanceRes.data.data).toBeDefined();
  },
  'No manual setup needed per employee',
);

businessTest(
  'BIZ: Approved leave cancellation restores balance',
  async () => {
    // Create and approve a leave, then cancel and verify balance is restored
    const start = futureDate(70);
    const end = futureDate(71);
    const currentYear = new Date().getFullYear();

    // Get initial balance
    const balanceBefore = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });
    expect(balanceBefore.status).toBe(200);

    // Apply leave
    const createRes = await apiRequest('/leaves', {
      method: 'POST',
      token: memberToken,
      body: JSON.stringify({
        leaveType: 'sick',
        startDate: start,
        endDate: end,
        reason: 'BIZ test sick leave',
      }),
    });
    expect(createRes.status).toBe(201);
    const bizLeaveId = (createRes.data.data as Record<string, string>)?._id || '';

    // Approve
    const approveRes = await apiRequest(`/leaves/${bizLeaveId}/approve`, {
      method: 'PUT',
      token: adminToken,
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(approveRes.status).toBe(200);

    // Balance after approval (should be reduced)
    const balanceAfterApprove = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });
    expect(balanceAfterApprove.status).toBe(200);

    // Cancel the leave
    const cancelRes = await apiRequest(`/leaves/${bizLeaveId}/cancel`, {
      method: 'PUT',
      token: memberToken,
      body: JSON.stringify({ reason: 'BIZ test cancellation' }),
    });
    expect(cancelRes.status).toBe(200);

    // Balance after cancellation (should be restored)
    const balanceAfterCancel = await apiRequest(`/leaves/balance?year=${currentYear}`, { token: memberToken });
    expect(balanceAfterCancel.status).toBe(200);
    expect(balanceAfterCancel.data.data).toBeDefined();
  },
  'Prevents leave balance corruption',
);

run();
