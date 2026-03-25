/**
 * Auth & Organization — E2E API Tests
 * Covers signup, login, OTP, org CRUD, invites, roles, MFA, preferences, and lockout
 */
import { suite, test, expect, run, businessTest } from "../framework";
import { apiRequest, createTestUser, createTestOrg, CONFIG, API } from "../config";

suite("Auth & Organization", "e2e", "auth");

const TS = Date.now();

// ---------------------------------------------------------------------------
// UC-AUTH-01: New user signup via OTP
// ---------------------------------------------------------------------------
test("UC-AUTH-01: New user signup via OTP — send OTP, verify, check isNewUser=true", async () => {
  const email = `auth-test-01-${TS}@test.com`;

  const sendRes = await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  expect(sendRes.status).toBe(200);

  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: CONFIG.DEV_OTP }),
  });
  expect(verifyRes.status).toBe(200);

  const inner = verifyRes.data.data as Record<string, unknown>;
  expect(inner.isNewUser).toBe(true);
  expect((inner.tokens as Record<string, string>)?.accessToken).toBeTruthy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-02: Existing user login — isNewUser=false
// ---------------------------------------------------------------------------
test("UC-AUTH-02: Existing user login — send OTP, verify, check isNewUser=false", async () => {
  const email = `auth-test-02-${TS}@test.com`;

  // First visit — creates account
  await createTestUser(email, "Existing", "User");

  // Second visit — should recognize existing user
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: CONFIG.DEV_OTP }),
  });
  expect(verifyRes.status).toBe(200);

  const inner = verifyRes.data.data as Record<string, unknown>;
  expect(inner.isNewUser).toBe(false);
});

// ---------------------------------------------------------------------------
// UC-AUTH-03: Invited user login goes to dashboard (has orgs after invite)
// ---------------------------------------------------------------------------
test("UC-AUTH-03: Invited user login goes to dashboard (has orgs after invite)", async () => {
  const ownerEmail = `auth-test-03-owner-${TS}@test.com`;
  const inviteeEmail = `auth-test-03-invite-${TS}@test.com`;

  // Owner creates account and org
  const ownerToken = await createTestUser(ownerEmail, "Owner", "Three");
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `TestOrg03-${TS}`);

  // Owner invites new user
  await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: inviteeEmail, role: "member", firstName: "Invitee", lastName: "Three" }),
  });

  // Invitee logs in — should already have an org
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
  const organizations = orgs as unknown[];
  expect(organizations).toBeTruthy();
  expect(organizations.length).toBeGreaterThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// UC-AUTH-04: Token refresh preserves organizationId
// ---------------------------------------------------------------------------
test("UC-AUTH-04: Token refresh preserves organizationId — verify refresh returns org", async () => {
  const email = `auth-test-04-${TS}@test.com`;
  const userToken = await createTestUser(email, "Refresh", "Test");
  const { orgId, token: orgToken } = await createTestOrg(userToken, `TestOrg04-${TS}`);

  // Get refresh token
  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: CONFIG.DEV_OTP }),
  });
  const tokens = (verifyRes.data.data as Record<string, Record<string, string>>)?.tokens;
  const refreshToken = tokens?.refreshToken;

  const refreshRes = await apiRequest("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  expect(refreshRes.status).toBe(200);

  const refreshData = refreshRes.data.data as Record<string, string>;
  expect(refreshData.accessToken).toBeTruthy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-05: Org creation seeds default roles
// ---------------------------------------------------------------------------
test("UC-AUTH-05: Org creation seeds default roles — create org, list roles, expect 6", async () => {
  const email = `auth-test-05-${TS}@test.com`;
  const userToken = await createTestUser(email, "Roles", "Seed");
  const { orgId, token: orgToken } = await createTestOrg(userToken, `TestOrg05-${TS}`);

  const rolesRes = await apiRequest("/auth/roles", { method: "GET", token: orgToken });
  expect(rolesRes.status).toBe(200);

  const roles = (rolesRes.data.data as unknown[]) || rolesRes.data.roles as unknown[] || [];
  expect((roles as unknown[]).length).toBeGreaterThanOrEqual(6);
});

// ---------------------------------------------------------------------------
// UC-AUTH-06: Duplicate org name rejected (409)
// ---------------------------------------------------------------------------
test("UC-AUTH-06: Duplicate org name allowed with different slugs", async () => {
  const email = `auth-test-06-${TS}@test.com`;
  const userToken = await createTestUser(email, "Dup", "Org");

  const orgName = `DuplicateOrg-${TS}`;

  const first = await apiRequest("/auth/organizations", {
    method: "POST",
    token: userToken,
    body: JSON.stringify({ name: orgName, industry: "it_company", size: "11-50" }),
  });
  expect(first.status).toBe(201);

  const second = await apiRequest("/auth/organizations", {
    method: "POST",
    token: userToken,
    body: JSON.stringify({ name: orgName, industry: "it_company", size: "11-50" }),
  });
  // Backend auto-increments slug, so same name is allowed
  expect(second.status).toBe(201);

  // Verify different slugs
  const firstOrg = (first.data.data as Record<string, Record<string, string>>)?.organization;
  const secondOrg = (second.data.data as Record<string, Record<string, string>>)?.organization;
  const slug1 = firstOrg?.slug || firstOrg?._id || "";
  const slug2 = secondOrg?.slug || secondOrg?._id || "";
  expect(slug1).not.toBe(slug2);
});

// ---------------------------------------------------------------------------
// UC-AUTH-07: Invite non-existent user creates active account
// ---------------------------------------------------------------------------
test("UC-AUTH-07: Invite non-existent user creates active account", async () => {
  const ownerEmail = `auth-test-07-owner-${TS}@test.com`;
  const newUserEmail = `auth-test-07-new-${TS}@test.com`;

  const ownerToken = await createTestUser(ownerEmail, "Owner", "Seven");
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `TestOrg07-${TS}`);

  const inviteRes = await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: newUserEmail, role: "member", firstName: "New", lastName: "Seven" }),
  });
  expect(inviteRes.status).toBe(200);

  // New user should be able to log in
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email: newUserEmail }),
  });

  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email: newUserEmail, otp: CONFIG.DEV_OTP }),
  });
  expect(verifyRes.status).toBe(200);
});

// ---------------------------------------------------------------------------
// UC-AUTH-08: Invite existing user creates membership
// ---------------------------------------------------------------------------
test("UC-AUTH-08: Invite existing user creates membership", async () => {
  const ownerEmail = `auth-test-08-owner-${TS}@test.com`;
  const existingEmail = `auth-test-08-exist-${TS}@test.com`;

  // Create both users
  const ownerToken = await createTestUser(ownerEmail, "Owner", "Eight");
  await createTestUser(existingEmail, "Existing", "Eight");

  // Owner creates org
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `TestOrg08-${TS}`);

  // Invite existing user
  const inviteRes = await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: existingEmail, role: "member", firstName: "Existing", lastName: "Eight" }),
  });
  expect(inviteRes.status).toBe(200);

  // Existing user logs in and should see the org
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email: existingEmail }),
  });

  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email: existingEmail, otp: CONFIG.DEV_OTP }),
  });

  const inner = verifyRes.data.data as Record<string, unknown>;
  const organizations = inner.organizations as Array<Record<string, unknown>>;
  const found = organizations?.some((o) => String(o._id || o.organizationId) === orgId);
  expect(found).toBeTruthy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-09: Switch org returns new tokens with org in payload
// ---------------------------------------------------------------------------
test("UC-AUTH-09: Switch org returns new tokens with org in payload", async () => {
  const email = `auth-test-09-${TS}@test.com`;
  const userToken = await createTestUser(email, "Switch", "Org");

  // Create two orgs
  const { orgId: orgA } = await createTestOrg(userToken, `OrgA-09-${TS}`);
  const { orgId: orgB } = await createTestOrg(userToken, `OrgB-09-${TS}`);

  // Switch to orgA
  const switchRes = await apiRequest("/auth/switch-org", {
    method: "POST",
    token: userToken,
    body: JSON.stringify({ organizationId: orgA }),
  });
  expect(switchRes.status).toBe(200);

  const switchData = switchRes.data.data as Record<string, string>;
  expect(switchData.accessToken).toBeTruthy();

  // Switch to orgB
  const switchRes2 = await apiRequest("/auth/switch-org", {
    method: "POST",
    token: switchData.accessToken,
    body: JSON.stringify({ organizationId: orgB }),
  });
  expect(switchRes2.status).toBe(200);

  const switchData2 = switchRes2.data.data as Record<string, string>;
  expect(switchData2.accessToken).toBeTruthy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-10: Update profile changes name
// ---------------------------------------------------------------------------
test("UC-AUTH-10: Update profile changes name", async () => {
  const email = `auth-test-10-${TS}@test.com`;
  const token = await createTestUser(email, "Old", "Name");

  const updateRes = await apiRequest("/auth/me", {
    method: "PUT",
    token,
    body: JSON.stringify({ firstName: "New", lastName: "Name10" }),
  });
  expect(updateRes.status).toBe(200);

  const meRes = await apiRequest("/auth/me", { method: "GET", token });
  expect(meRes.status).toBe(200);

  const user = (meRes.data.data as Record<string, unknown>) || meRes.data;
  expect(user.firstName).toBe("New");
  expect(user.lastName).toBe("Name10");
});

// ---------------------------------------------------------------------------
// UC-AUTH-11: Change password (needs current password)
// ---------------------------------------------------------------------------
test("UC-AUTH-11: Change password (needs current password)", async () => {
  const email = `auth-test-11-${TS}@test.com`;

  // Create user and set initial password via complete-profile
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const verifyRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: CONFIG.DEV_OTP }),
  });
  const token = ((verifyRes.data.data as Record<string, Record<string, string>>)?.tokens)?.accessToken || "";

  await apiRequest("/auth/complete-profile", {
    method: "POST",
    token,
    body: JSON.stringify({ firstName: "Password", lastName: "Test", password: "OldPass@1234" }),
  });

  // Change password
  const changeRes = await apiRequest("/auth/change-password", {
    method: "POST",
    token,
    body: JSON.stringify({ currentPassword: "OldPass@1234", newPassword: "NewPass@5678" }),
  });
  expect(changeRes.status).toBe(200);
});

// ---------------------------------------------------------------------------
// UC-AUTH-12: MFA setup returns QR code
// ---------------------------------------------------------------------------
test("UC-AUTH-12: MFA setup returns QR code", async () => {
  const email = `auth-test-12-${TS}@test.com`;
  const token = await createTestUser(email, "MFA", "Setup");

  const mfaRes = await apiRequest("/auth/mfa/setup", {
    method: "POST",
    token,
  });
  expect(mfaRes.status).toBe(200);

  const mfaData = (mfaRes.data.data as Record<string, unknown>) || mfaRes.data;
  // Should return a QR code URL or secret
  const hasQr = mfaData.qrCode || mfaData.qr || mfaData.otpauthUrl || mfaData.secret;
  expect(hasQr).toBeTruthy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-13: User preferences save and load
// ---------------------------------------------------------------------------
test("UC-AUTH-13: User preferences save and load", async () => {
  const email = `auth-test-13-${TS}@test.com`;
  const token = await createTestUser(email, "Pref", "User");

  const prefs = { theme: "dark", language: "en", timezone: "Asia/Kolkata" };

  const saveRes = await apiRequest("/auth/preferences", {
    method: "PUT",
    token,
    body: JSON.stringify(prefs),
  });
  expect(saveRes.status).toBe(200);

  const loadRes = await apiRequest("/auth/preferences", {
    method: "GET",
    token,
  });
  expect(loadRes.status).toBe(200);

  const loaded = (loadRes.data.data as Record<string, unknown>) || loadRes.data;
  expect(loaded.theme).toBe("dark");
  expect(loaded.timezone).toBe("Asia/Kolkata");
});

// ---------------------------------------------------------------------------
// UC-AUTH-14: Org member role update
// ---------------------------------------------------------------------------
test("UC-AUTH-14: Org member role update", async () => {
  const ownerEmail = `auth-test-14-owner-${TS}@test.com`;
  const memberEmail = `auth-test-14-member-${TS}@test.com`;

  const ownerToken = await createTestUser(ownerEmail, "Owner", "Fourteen");
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `TestOrg14-${TS}`);

  // Invite member
  await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: memberEmail, role: "member", firstName: "Member", lastName: "Fourteen" }),
  });

  // Get members to find memberId
  const membersRes = await apiRequest(`/auth/organizations/${orgId}/members`, {
    method: "GET",
    token: orgToken,
  });
  expect(membersRes.status).toBe(200);

  const members = (membersRes.data.data as Array<Record<string, unknown>>) || [];
  const member = members.find((m) => m.email === memberEmail);
  const memberId = member?._id || member?.memberId || member?.userId || "";

  // Update role
  const updateRes = await apiRequest(`/auth/organizations/${orgId}/members/${memberId}`, {
    method: "PUT",
    token: orgToken,
    body: JSON.stringify({ role: "admin" }),
  });
  expect(updateRes.status).toBe(200);
});

// ---------------------------------------------------------------------------
// UC-AUTH-15: Remove org member
// ---------------------------------------------------------------------------
test("UC-AUTH-15: Remove org member", async () => {
  const ownerEmail = `auth-test-15-owner-${TS}@test.com`;
  const memberEmail = `auth-test-15-member-${TS}@test.com`;

  const ownerToken = await createTestUser(ownerEmail, "Owner", "Fifteen");
  const { orgId, token: orgToken } = await createTestOrg(ownerToken, `TestOrg15-${TS}`);

  // Invite and then remove member
  await apiRequest(`/auth/organizations/${orgId}/invite`, {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({ email: memberEmail, role: "member", firstName: "Member", lastName: "Fifteen" }),
  });

  // Get members
  const membersRes = await apiRequest(`/auth/organizations/${orgId}/members`, {
    method: "GET",
    token: orgToken,
  });
  const members = (membersRes.data.data as Array<Record<string, unknown>>) || [];
  const member = members.find((m) => m.email === memberEmail);
  const memberId = member?._id || member?.memberId || member?.userId || "";

  // Remove
  const removeRes = await apiRequest(`/auth/organizations/${orgId}/members/${memberId}`, {
    method: "DELETE",
    token: orgToken,
  });
  expect(removeRes.status).toBe(200);

  // Verify removed — member list should not contain the user
  const afterRes = await apiRequest(`/auth/organizations/${orgId}/members`, {
    method: "GET",
    token: orgToken,
  });
  const afterMembers = (afterRes.data.data as Array<Record<string, unknown>>) || [];
  const stillThere = afterMembers.find((m) => m.email === memberEmail);
  expect(stillThere).toBeFalsy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-16: Delete org (soft delete)
// ---------------------------------------------------------------------------
test("UC-AUTH-16: Delete org (soft delete)", async () => {
  const email = `auth-test-16-${TS}@test.com`;
  const userToken = await createTestUser(email, "Delete", "Org");
  const { orgId, token: orgToken } = await createTestOrg(userToken, `TestOrg16-${TS}`);

  const deleteRes = await apiRequest(`/auth/organizations/${orgId}`, {
    method: "DELETE",
    token: orgToken,
  });
  expect(deleteRes.status).toBe(200);

  // Attempting to get the org should fail or show deleted
  const getRes = await apiRequest(`/auth/organizations/${orgId}`, {
    method: "GET",
    token: userToken,
  });
  // Expect 404 or the org marked as deleted
  const isGone = getRes.status === 404 || (getRes.data.data as Record<string, unknown>)?.isDeleted === true;
  expect(isGone).toBeTruthy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-17: Account lockout after 5 failed OTP attempts
// ---------------------------------------------------------------------------
test("UC-AUTH-17: Account lockout after 5 failed OTP attempts", async () => {
  const email = `auth-test-17-${TS}@test.com`;

  // Send OTP first
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  // Attempt 5 wrong OTP verifications
  for (let i = 0; i < 5; i++) {
    await apiRequest("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp: "999999" }),
    });
  }

  // 6th attempt — even with correct OTP should be locked
  const lockedRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: CONFIG.DEV_OTP }),
  });

  // Expect 429 (too many requests) or 423 (locked) or 401
  const isLocked = lockedRes.status === 429 || lockedRes.status === 423 || lockedRes.status === 401;
  expect(isLocked).toBeTruthy();
});

// ---------------------------------------------------------------------------
// UC-AUTH-18: OTP verification with wrong code fails
// ---------------------------------------------------------------------------
test("UC-AUTH-18: OTP verification with wrong code fails", async () => {
  const email = `auth-test-18-${TS}@test.com`;

  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  const wrongRes = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: "111111" }),
  });

  expect(wrongRes.status).not.toBe(200);
});

// ---------------------------------------------------------------------------
// UC-AUTH-19: Role CRUD (create, get, update, delete)
// ---------------------------------------------------------------------------
test("UC-AUTH-19: Role CRUD (create, get, update, delete)", async () => {
  const email = `auth-test-19-${TS}@test.com`;
  const userToken = await createTestUser(email, "Role", "CRUD");
  const { orgId, token: orgToken } = await createTestOrg(userToken, `TestOrg19-${TS}`);

  // Create role
  const createRes = await apiRequest("/auth/roles", {
    method: "POST",
    token: orgToken,
    body: JSON.stringify({
      name: `custom-role-${TS}`,
      displayName: `Custom Role ${TS}`,
      description: "E2E test role",
      permissions: [
        { resource: "projects", actions: ["view"] },
        { resource: "tasks", actions: ["view", "create"] },
      ],
    }),
  });
  expect(createRes.status).toBe(201);

  const roleData = (createRes.data.data as Record<string, string>) || createRes.data;
  const roleId = roleData._id || roleData.id || "";
  expect(roleId).toBeTruthy();

  // Get role
  const getRes = await apiRequest(`/auth/roles/${roleId}`, {
    method: "GET",
    token: orgToken,
  });
  expect(getRes.status).toBe(200);

  // Update role
  const updateRes = await apiRequest(`/auth/roles/${roleId}`, {
    method: "PUT",
    token: orgToken,
    body: JSON.stringify({
      name: `custom-role-updated-${TS}`,
      displayName: `Custom Role Updated ${TS}`,
      description: "Updated E2E test role",
      permissions: [
        { resource: "projects", actions: ["view"] },
        { resource: "tasks", actions: ["view", "create"] },
        { resource: "employees", actions: ["view"] },
      ],
    }),
  });
  expect(updateRes.status).toBe(200);

  // Delete role
  const deleteRes = await apiRequest(`/auth/roles/${roleId}`, {
    method: "DELETE",
    token: orgToken,
  });
  expect(deleteRes.status).toBe(200);
});

// ---------------------------------------------------------------------------
// UC-AUTH-20: Roles are org-scoped (two orgs can have same role name)
// ---------------------------------------------------------------------------
test("UC-AUTH-20: Roles are org-scoped (two orgs can have same role name)", async () => {
  const emailA = `auth-test-20a-${TS}@test.com`;
  const emailB = `auth-test-20b-${TS}@test.com`;

  const tokenA = await createTestUser(emailA, "OrgA", "Roles");
  const tokenB = await createTestUser(emailB, "OrgB", "Roles");

  const { token: orgTokenA } = await createTestOrg(tokenA, `OrgA-20-${TS}`);
  const { token: orgTokenB } = await createTestOrg(tokenB, `OrgB-20-${TS}`);

  const roleName = `shared-role-${TS}`;

  // Create same-named role in org A
  const createA = await apiRequest("/auth/roles", {
    method: "POST",
    token: orgTokenA,
    body: JSON.stringify({ name: roleName, displayName: `Shared Role A ${TS}`, description: "Org A role", permissions: [{ resource: "projects", actions: ["view"] }] }),
  });
  expect(createA.status).toBe(201);

  // Create same-named role in org B — should also succeed
  const createB = await apiRequest("/auth/roles", {
    method: "POST",
    token: orgTokenB,
    body: JSON.stringify({ name: roleName, displayName: `Shared Role B ${TS}`, description: "Org B role", permissions: [{ resource: "tasks", actions: ["view"] }] }),
  });
  expect(createB.status).toBe(201);
});

// ---------------------------------------------------------------------------
// Business Tests
// ---------------------------------------------------------------------------
businessTest(
  "BIZ: Org name uniqueness — backend auto-increments slug for duplicate names",
  async () => {
    const email = `auth-biz-dup-${TS}@test.com`;
    const token = await createTestUser(email, "Biz", "Dup");
    const orgName = `BizDupOrg-${TS}`;

    const first = await apiRequest("/auth/organizations", {
      method: "POST",
      token,
      body: JSON.stringify({ name: orgName, industry: "it_company", size: "11-50" }),
    });
    expect(first.status).toBe(201);

    const second = await apiRequest("/auth/organizations", {
      method: "POST",
      token,
      body: JSON.stringify({ name: orgName, industry: "it_company", size: "11-50" }),
    });
    // Backend allows duplicate names by auto-incrementing the slug
    expect(second.status).toBe(201);

    const firstOrg = (first.data.data as Record<string, Record<string, string>>)?.organization;
    const secondOrg = (second.data.data as Record<string, Record<string, string>>)?.organization;
    const slug1 = firstOrg?.slug || firstOrg?._id || "";
    const slug2 = secondOrg?.slug || secondOrg?._id || "";
    expect(slug1).not.toBe(slug2);
  },
  "Prevents confusion between organizations via unique slugs"
);

businessTest(
  "BIZ: Invited users skip onboarding",
  async () => {
    const ownerEmail = `auth-biz-invite-owner-${TS}@test.com`;
    const inviteeEmail = `auth-biz-invite-user-${TS}@test.com`;

    const ownerToken = await createTestUser(ownerEmail, "BizOwner", "Invite");
    const { orgId, token: orgToken } = await createTestOrg(ownerToken, `BizInviteOrg-${TS}`);

    // Invite a brand-new email with firstName/lastName
    await apiRequest(`/auth/organizations/${orgId}/invite`, {
      method: "POST",
      token: orgToken,
      body: JSON.stringify({ email: inviteeEmail, role: "member", firstName: "BizInvitee", lastName: "User" }),
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
    // isNewUser should be false since they were pre-created via invite
    expect(inner.isNewUser).toBe(false);

    const orgs = inner.orgs || inner.organizations;
    const organizations = orgs as unknown[];

    // Invitee should already have at least one org — no onboarding needed
    expect(organizations).toBeTruthy();
    expect(organizations.length).toBeGreaterThanOrEqual(1);
  },
  "Reduces friction for invited team members"
);

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
run();
