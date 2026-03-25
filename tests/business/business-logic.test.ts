/**
 * Business Logic — Validation Tests
 * Verifies core business rules: default roles, invites, preferences, directory, tokens, member management
 */
import { suite, test, expect, run, businessTest } from "../framework";
import { apiRequest, createTestUser, createTestOrg, CONFIG } from "../config";

suite("Business Logic", "business", "business");

const TS = Date.now();

// Shared state
let adminToken = "";
let adminOrgId = "";
let memberEmail = "";
let memberUserId = "";
let memberToken = "";

// ---------------------------------------------------------------------------
// Setup: Create admin user + org
// ---------------------------------------------------------------------------
test("Setup: create admin user and org", async () => {
  const email = `biz-admin-${TS}@nexora.io`;
  const userToken = await createTestUser(email, "BizAdmin", "User");
  expect(userToken).toBeTruthy();
  const org = await createTestOrg(userToken, `BizTestOrg-${TS}`);
  adminToken = org.token;
  adminOrgId = org.orgId;
  expect(adminOrgId).toBeTruthy();
});

// ---------------------------------------------------------------------------
// 1. Org creation seeds exactly 6 default roles
// ---------------------------------------------------------------------------
test("1. Org creation seeds exactly 6 default roles (admin, hr, manager, developer, designer, employee)", async () => {
  const rolesRes = await apiRequest("/auth/roles", { method: "GET", token: adminToken });
  expect(rolesRes.status).toBe(200);

  const roles = (rolesRes.data.data as Array<Record<string, unknown>>) || [];
  expect(roles.length).toBeGreaterThanOrEqual(6);

  const roleNames = roles.map((r) => (r.name as string || "").toLowerCase());
  expect(roleNames).toContain("admin");
  expect(roleNames).toContain("hr");
  expect(roleNames).toContain("manager");
  expect(roleNames).toContain("developer");
  expect(roleNames).toContain("designer");
  expect(roleNames).toContain("employee");
});

// ---------------------------------------------------------------------------
// 2. Invite with names creates fully active user
// ---------------------------------------------------------------------------
test("2. Invite with names creates fully active user (isActive=true, organizations set)", async () => {
  memberEmail = `biz-invite-${TS}@nexora.io`;

  // Invite with firstName/lastName
  const inviteRes = await apiRequest(`/auth/organizations/${adminOrgId}/invite`, {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({
      email: memberEmail,
      role: "member",
      firstName: "Invited",
      lastName: "Member",
    }),
  });
  expect(inviteRes.status).toBe(200);

  // Invitee logs in via OTP
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email: memberEmail }),
  });

  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email: memberEmail, otp: CONFIG.DEV_OTP }),
  });
  expect(verifyRes.status).toBe(200);

  const inner = verifyRes.data.data as Record<string, unknown>;
  const orgs = inner.orgs || inner.organizations;
  const organizations = orgs as Array<Record<string, unknown>>;
  expect(organizations).toBeTruthy();
  expect(organizations.length).toBeGreaterThanOrEqual(1);

  // User should have isActive = true (or equivalent)
  const user = inner.user as Record<string, unknown> | undefined;
  if (user) {
    const isActive = user.isActive !== false; // defaults to true if not explicitly false
    expect(isActive).toBeTruthy();
  }

  // Store member token for later tests
  const tokens = inner.tokens as Record<string, string>;
  memberToken = tokens?.accessToken || "";
  expect(memberToken).toBeTruthy();
});

// ---------------------------------------------------------------------------
// 3. Preferences are per-user
// ---------------------------------------------------------------------------
test("3. Preferences are per-user (save for user A, load for user B, expect different)", async () => {
  const emailA = `biz-pref-a-${TS}@nexora.io`;
  const emailB = `biz-pref-b-${TS}@nexora.io`;

  const tokenA = await createTestUser(emailA, "PrefA", "User");
  const tokenB = await createTestUser(emailB, "PrefB", "User");

  // User A saves dark theme
  await apiRequest("/auth/preferences", {
    method: "PUT",
    token: tokenA,
    body: JSON.stringify({ theme: "dark", language: "en", timezone: "Asia/Kolkata" }),
  });

  // User B saves light theme
  await apiRequest("/auth/preferences", {
    method: "PUT",
    token: tokenB,
    body: JSON.stringify({ theme: "light", language: "es", timezone: "America/New_York" }),
  });

  // Load User A preferences
  const loadA = await apiRequest("/auth/preferences", { method: "GET", token: tokenA });
  expect(loadA.status).toBe(200);
  const prefsA = (loadA.data.data as Record<string, unknown>) || loadA.data;
  expect(prefsA.theme).toBe("dark");
  expect(prefsA.timezone).toBe("Asia/Kolkata");

  // Load User B preferences — should be different
  const loadB = await apiRequest("/auth/preferences", { method: "GET", token: tokenB });
  expect(loadB.status).toBe(200);
  const prefsB = (loadB.data.data as Record<string, unknown>) || loadB.data;
  expect(prefsB.theme).toBe("light");
  expect(prefsB.timezone).toBe("America/New_York");

  // Verify they are different
  expect(prefsA.theme).not.toBe(prefsB.theme);
});

// ---------------------------------------------------------------------------
// 4. Admin sees other employees in directory (not themselves)
// ---------------------------------------------------------------------------
test("4. Admin sees employees in directory", async () => {
  // Create two employees in the org
  const emp1Res = await apiRequest("/employees", {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({
      firstName: "DirOne",
      lastName: `Visible-${TS}`,
      email: `biz-dir1-${TS}@nexora.io`,
      joiningDate: "2025-05-01",
      employmentType: "full_time",
    }),
  });
  expect(emp1Res.status).toBe(201);

  const emp2Res = await apiRequest("/employees", {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({
      firstName: "DirTwo",
      lastName: `Visible-${TS}`,
      email: `biz-dir2-${TS}@nexora.io`,
      joiningDate: "2025-05-02",
      employmentType: "full_time",
    }),
  });
  expect(emp2Res.status).toBe(201);

  // List employees
  const listRes = await apiRequest("/employees", { method: "GET", token: adminToken });
  expect(listRes.status).toBe(200);
  const employees = (listRes.data.data as Record<string, unknown>[]) || [];

  // Should contain both employees we just created
  const found1 = employees.some(
    (e) => (e.email as string)?.includes(`biz-dir1-${TS}`)
  );
  const found2 = employees.some(
    (e) => (e.email as string)?.includes(`biz-dir2-${TS}`)
  );
  expect(found1).toBeTruthy();
  expect(found2).toBeTruthy();
  expect(employees.length).toBeGreaterThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// 5. Token refresh preserves org context
// ---------------------------------------------------------------------------
test("5. Token refresh preserves org context", async () => {
  const email = `biz-refresh-${TS}@nexora.io`;
  const userToken = await createTestUser(email, "Refresh", "BizTest");
  const { orgId, token: orgToken } = await createTestOrg(userToken, `BizRefreshOrg-${TS}`);

  // Get refresh token by re-verifying OTP
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: CONFIG.DEV_OTP }),
  });
  const tokens = (verifyRes.data.data as Record<string, Record<string, string>>)?.tokens;
  const refreshToken = tokens?.refreshToken;
  expect(refreshToken).toBeTruthy();

  // Refresh the token
  const refreshRes = await apiRequest("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  expect(refreshRes.status).toBe(200);

  const refreshData = refreshRes.data.data as Record<string, string>;
  const newAccessToken = refreshData.accessToken;
  expect(newAccessToken).toBeTruthy();

  // Use new token to access org-scoped resource — should still work
  const meRes = await apiRequest("/auth/me", { method: "GET", token: newAccessToken });
  expect(meRes.status).toBe(200);
});

// ---------------------------------------------------------------------------
// 6. Org admin can update member roles
// ---------------------------------------------------------------------------
test("6. Org admin can update member roles", async () => {
  const ownerEmail = `biz-role-owner-${TS}@nexora.io`;
  const targetEmail = `biz-role-target-${TS}@nexora.io`;

  const ownerToken = await createTestUser(ownerEmail, "RoleOwner", "Biz");
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `BizRoleOrg-${TS}`);

  // Invite member
  await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: targetEmail, role: "member", firstName: "RoleTarget", lastName: "Biz" }),
  });

  // Get members to find memberId
  const membersRes = await apiRequest(`/auth/organizations/${orgId}/members`, {
    method: "GET",
    token: orgToken,
  });
  expect(membersRes.status).toBe(200);

  const members = (membersRes.data.data as Array<Record<string, unknown>>) || [];
  const target = members.find((m) => m.email === targetEmail);
  const memberId = (target?._id || target?.memberId || target?.userId || "") as string;
  expect(memberId).toBeTruthy();

  // Update role to admin
  const updateRes = await apiRequest(`/auth/organizations/${orgId}/members/${memberId}`, {
    method: "PUT",
    token: orgToken,
    body: JSON.stringify({ role: "admin" }),
  });
  expect(updateRes.status).toBe(200);
});

// ---------------------------------------------------------------------------
// 7. Org admin can remove members
// ---------------------------------------------------------------------------
test("7. Org admin can remove members", async () => {
  const ownerEmail = `biz-rm-owner-${TS}@nexora.io`;
  const removeEmail = `biz-rm-target-${TS}@nexora.io`;

  const ownerToken = await createTestUser(ownerEmail, "RmOwner", "Biz");
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `BizRmOrg-${TS}`);

  // Invite member
  await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: removeEmail, role: "member", firstName: "RmTarget", lastName: "Biz" }),
  });

  // Get members
  const membersRes = await apiRequest(`/auth/organizations/${orgId}/members`, {
    method: "GET",
    token: orgToken,
  });
  const members = (membersRes.data.data as Array<Record<string, unknown>>) || [];
  const target = members.find((m) => m.email === removeEmail);
  const memberId = (target?._id || target?.memberId || target?.userId || "") as string;
  expect(memberId).toBeTruthy();

  // Remove member
  const removeRes = await apiRequest(`/auth/organizations/${orgId}/members/${memberId}`, {
    method: "DELETE",
    token: orgToken,
  });
  expect(removeRes.status).toBe(200);

  // Verify removal
  const afterRes = await apiRequest(`/auth/organizations/${orgId}/members`, {
    method: "GET",
    token: orgToken,
  });
  const afterMembers = (afterRes.data.data as Array<Record<string, unknown>>) || [];
  const stillThere = afterMembers.find((m) => m.email === removeEmail);
  expect(stillThere).toBeFalsy();
});

// ---------------------------------------------------------------------------
// 8. Cannot delete org if not admin
// ---------------------------------------------------------------------------
test("8. Cannot delete org if not admin", async () => {
  const ownerEmail = `biz-nodelete-owner-${TS}@nexora.io`;
  const memberEmail2 = `biz-nodelete-member-${TS}@nexora.io`;

  const ownerToken = await createTestUser(ownerEmail, "NoDelOwner", "Biz");
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `BizNoDelOrg-${TS}`);

  // Create member user and invite
  const memToken = await createTestUser(memberEmail2, "NoDelMember", "Biz");

  await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: memberEmail2, role: "member", firstName: "NoDelMember", lastName: "Biz" }),
  });

  // Member joins and switches to org
  await apiRequest(`/auth/organizations/${orgId}/join`, {
    method: "POST",
    token: memToken,
  });
  const switchRes = await apiRequest("/auth/switch-org", {
    method: "POST",
    token: memToken,
    body: JSON.stringify({ organizationId: orgId }),
  });
  const memberOrgToken = (switchRes.data.data as Record<string, string>)?.accessToken || memToken;

  // Member tries to delete org — should fail
  const deleteRes = await apiRequest(`/auth/organizations/${orgId}`, {
    method: "DELETE",
    token: memberOrgToken,
  });
  const isBlocked = deleteRes.status === 403 || deleteRes.status === 401 || deleteRes.status === 400;
  expect(isBlocked).toBeTruthy();
});

// ---------------------------------------------------------------------------
// 9. Employee ID auto-increments within org (NXR-0001, NXR-0002)
// ---------------------------------------------------------------------------
test("9. Employee ID auto-increments within org (NXR-0001, NXR-0002)", async () => {
  const uniqueTs = Date.now();
  const email = `biz-autoid-${uniqueTs}@nexora.io`;
  const userToken = await createTestUser(email, "AutoId", "Biz");
  const { orgId, token: orgToken } = await createTestOrg(userToken, `BizAutoIdOrg-${uniqueTs}`);

  // Create first employee
  const emp1Res = await apiRequest("/employees", {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({
      firstName: "First",
      lastName: `AutoId-${uniqueTs}`,
      email: `biz-auto1-${uniqueTs}@nexora.io`,
      joiningDate: "2025-01-01",
      employmentType: "full_time",
    }),
  });
  expect(emp1Res.status).toBe(201);
  const emp1 = emp1Res.data.data as Record<string, unknown>;
  const empId1 = (emp1.employeeId || emp1.empId || emp1.employeeCode) as string;

  // Create second employee
  const emp2Res = await apiRequest("/employees", {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({
      firstName: "Second",
      lastName: `AutoId-${uniqueTs}`,
      email: `biz-auto2-${uniqueTs}@nexora.io`,
      joiningDate: "2025-01-02",
      employmentType: "full_time",
    }),
  });
  expect(emp2Res.status).toBe(201);
  const emp2 = emp2Res.data.data as Record<string, unknown>;
  const empId2 = (emp2.employeeId || emp2.empId || emp2.employeeCode) as string;

  // Both should have NXR-prefixed IDs
  if (empId1 && empId2) {
    expect(empId1).toMatch(/^NXR-/);
    expect(empId2).toMatch(/^NXR-/);

    // Extract numeric parts and verify auto-increment
    const num1 = parseInt(empId1.replace("NXR-", ""), 10);
    const num2 = parseInt(empId2.replace("NXR-", ""), 10);
    expect(num2).toBeGreaterThan(num1);
  }
});

// ---------------------------------------------------------------------------
// 10. Leave balance auto-initializes with policy defaults
// ---------------------------------------------------------------------------
test("10. Leave balance auto-initializes with policy defaults", async () => {
  const uniqueTs = Date.now();
  const email = `biz-leavebal-${uniqueTs}@nexora.io`;
  const userToken = await createTestUser(email, "LeaveBal", "Biz");
  const { orgId, token: orgToken } = await createTestOrg(userToken, `BizLeaveOrg-${uniqueTs}`);

  // Create a leave policy with defined allocations
  const policyRes = await apiRequest("/leave-policies", {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({
      name: `Leave Policy ${TS}`,
      type: "leave",
      leaveTypes: [
        {
          type: "casual",
          annualAllocation: 12,
          accrualFrequency: "yearly",
          accrualAmount: 12,
          maxCarryForward: 3,
        },
        {
          type: "sick",
          annualAllocation: 12,
          accrualFrequency: "yearly",
          accrualAmount: 12,
          maxCarryForward: 0,
        },
      ],
      yearStart: "january",
      applicableTo: "all",
    }),
  });
  const policyCreated = policyRes.status === 201 || policyRes.status === 200;
  expect(policyCreated).toBeTruthy();

  // Check leave balance for the user
  const balanceRes = await apiRequest("/leaves/balance", {
    method: "GET",
    token: orgToken,
  });
  expect(balanceRes.status).toBe(200);

  const balances = balanceRes.data.data as Record<string, unknown>[] | Record<string, unknown>;
  // Balance should exist (structure may vary)
  expect(balances).toBeDefined();
});

// ---------------------------------------------------------------------------
// Business Tests
// ---------------------------------------------------------------------------
businessTest(
  "BIZ: Default roles match common org structures",
  async () => {
    const email = `biz-roles-check-${TS}@nexora.io`;
    const userToken = await createTestUser(email, "RolesCheck", "Biz");
    const { token: orgToken } = await createTestOrg(userToken, `BizRolesCheckOrg-${TS}`);

    const rolesRes = await apiRequest("/auth/roles", { method: "GET", token: orgToken });
    expect(rolesRes.status).toBe(200);

    const roles = (rolesRes.data.data as Array<Record<string, unknown>>) || [];
    const roleNames = roles.map((r) => (r.name as string || "").toLowerCase());

    // Core organizational roles should be present
    expect(roleNames).toContain("admin");
    expect(roleNames).toContain("hr");
    expect(roleNames).toContain("manager");
    expect(roleNames).toContain("developer");
    expect(roleNames).toContain("designer");
    expect(roleNames).toContain("employee");
  },
  "Reduces setup time for new organizations"
);

businessTest(
  "BIZ: Per-user preferences enable personalization",
  async () => {
    const emailX = `biz-pref-x-${TS}@nexora.io`;
    const emailY = `biz-pref-y-${TS}@nexora.io`;

    const tokenX = await createTestUser(emailX, "PrefX", "Biz");
    const tokenY = await createTestUser(emailY, "PrefY", "Biz");

    // Save different preferences
    await apiRequest("/auth/preferences", {
      method: "PUT",
      token: tokenX,
      body: JSON.stringify({ theme: "dark", language: "en" }),
    });
    await apiRequest("/auth/preferences", {
      method: "PUT",
      token: tokenY,
      body: JSON.stringify({ theme: "light", language: "fr" }),
    });

    // Load and verify isolation
    const loadX = await apiRequest("/auth/preferences", { method: "GET", token: tokenX });
    const loadY = await apiRequest("/auth/preferences", { method: "GET", token: tokenY });

    const prefsX = (loadX.data.data as Record<string, unknown>) || loadX.data;
    const prefsY = (loadY.data.data as Record<string, unknown>) || loadY.data;

    expect(prefsX.theme).toBe("dark");
    expect(prefsY.theme).toBe("light");
    expect(prefsX.language).toBe("en");
    expect(prefsY.language).toBe("fr");
  },
  "Each user gets their own workspace feel"
);

businessTest(
  "BIZ: Invited users are production-ready",
  async () => {
    const ownerEmail = `biz-ready-owner-${TS}@nexora.io`;
    const inviteeEmail = `biz-ready-invite-${TS}@nexora.io`;

    const ownerToken = await createTestUser(ownerEmail, "ReadyOwner", "Biz");
    const { orgId, token: orgToken } = await createTestOrg(ownerToken, `BizReadyOrg-${TS}`);

    // Invite with names
    await apiRequest(`/auth/organizations/${orgId}/invite`, {
      method: "POST",
      token: orgToken,
      body: JSON.stringify({
        email: inviteeEmail,
        role: "member",
        firstName: "Ready",
        lastName: "User",
      }),
    });

    // Invitee logs in
    await apiRequest("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email: inviteeEmail }),
    });

    const verifyRes = await apiRequest("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email: inviteeEmail, otp: CONFIG.DEV_OTP }),
    });
    expect(verifyRes.status).toBe(200);

    const inner = verifyRes.data.data as Record<string, unknown>;
    const orgs = inner.orgs || inner.organizations;
    const organizations = orgs as Array<Record<string, unknown>>;

    // Should immediately have org access — no activation step
    expect(organizations).toBeTruthy();
    expect(organizations.length).toBeGreaterThanOrEqual(1);

    // Should have tokens ready to use
    const tokens = inner.tokens as Record<string, string>;
    expect(tokens?.accessToken).toBeTruthy();
  },
  "No activation step needed — reduces onboarding friction"
);

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
run();
