/**
 * Multi-Tenancy Isolation — E2E Tests
 * Verifies complete data isolation between two separate organizations across all modules.
 */
import { suite, test, expect, run, businessTest } from "../framework";
import { apiRequest, createTestUser, createTestOrg } from "../config";

suite("Multi-Tenancy Isolation", "e2e", "multi-tenancy");

const TS = Date.now();

// Shared state: two separate orgs with separate admin users
let tokenA = "";
let orgIdA = "";
let tokenB = "";
let orgIdB = "";

// IDs created in Org A for cross-check
let employeeIdA = "";
let departmentIdA = "";
let projectIdA = "";
let taskIdA = "";
let policyIdA = "";
let shiftIdA = "";
let leaveIdA = "";
let clientIdA = "";
let timesheetIdA = "";

// ---------------------------------------------------------------------------
// Setup: Create Org A
// ---------------------------------------------------------------------------
test("Setup: create admin user + Org A", async () => {
  const userToken = await createTestUser(`mt-admin-a-${TS}@nexora.io`, "OrgAAdmin", "User");
  expect(userToken).toBeTruthy();
  const org = await createTestOrg(userToken, `MultiTenantOrgA-${TS}`);
  tokenA = org.token;
  orgIdA = org.orgId;
  expect(orgIdA).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Setup: Create Org B
// ---------------------------------------------------------------------------
test("Setup: create admin user + Org B", async () => {
  const userToken = await createTestUser(`mt-admin-b-${TS}@nexora.io`, "OrgBAdmin", "User");
  expect(userToken).toBeTruthy();
  const org = await createTestOrg(userToken, `MultiTenantOrgB-${TS}`);
  tokenB = org.token;
  orgIdB = org.orgId;
  expect(orgIdB).toBeTruthy();
});

// ---------------------------------------------------------------------------
// 1. Employees from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("1. Employees from Org A invisible to Org B", async () => {
  const uniqueTs = Date.now();
  // Create employee in Org A
  const createRes = await apiRequest("/employees", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      firstName: "TenantA",
      lastName: `Employee-${uniqueTs}`,
      email: `mt-emp-a-${uniqueTs}@nexora.io`,
      joiningDate: "2025-06-01",
      employmentType: "full_time",
    }),
  });
  expect(createRes.status).toBe(201);
  const emp = createRes.data.data as Record<string, unknown>;
  employeeIdA = emp._id as string;
  expect(employeeIdA).toBeTruthy();

  // List employees from Org B
  const listB = await apiRequest("/employees", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const employeesB = (listB.data.data as Record<string, unknown>[]) || [];
  const idsInB = employeesB.map((e) => e._id);
  expect(idsInB).not.toContain(employeeIdA);
});

// ---------------------------------------------------------------------------
// 2. Departments from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("2. Departments from Org A invisible to Org B", async () => {
  // Create department in Org A
  const createRes = await apiRequest("/departments", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      name: `Engineering-A-${TS}`,
      code: `ENG-A-${TS}`,
      description: "Org A engineering dept",
    }),
  });
  expect(createRes.status).toBe(201);
  const dept = createRes.data.data as Record<string, unknown>;
  departmentIdA = (dept._id || dept.id) as string;
  expect(departmentIdA).toBeTruthy();

  // List departments from Org B
  const listB = await apiRequest("/departments", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const deptsB = (listB.data.data as Record<string, unknown>[]) || [];
  const idsInB = deptsB.map((d) => d._id || d.id);
  expect(idsInB).not.toContain(departmentIdA);
});

// ---------------------------------------------------------------------------
// 3. Projects from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("3. Projects from Org A invisible to Org B", async () => {
  // Create project in Org A
  const createRes = await apiRequest("/projects", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      projectName: `MT Project A ${TS}`,
      description: "Multi-tenancy test project",
      status: "planning",
      priority: "high",
    }),
  });
  expect(createRes.status).toBe(201);
  const proj = createRes.data.data as Record<string, unknown>;
  projectIdA = (proj._id || proj.id) as string;
  expect(projectIdA).toBeTruthy();

  // List projects from Org B
  const listB = await apiRequest("/projects", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const projectsB = (listB.data.data as Record<string, unknown>[]) || [];
  const idsInB = projectsB.map((p) => p._id || p.id);
  expect(idsInB).not.toContain(projectIdA);
});

// ---------------------------------------------------------------------------
// 4. Tasks from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("4. Tasks from Org A invisible to Org B", async () => {
  // Ensure we have a project in Org A (projectIdA should be set from test 3)
  expect(projectIdA).toBeTruthy();
  // Create task in Org A's project
  const createRes = await apiRequest("/tasks", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      title: `MT Task A ${TS}`,
      projectId: projectIdA,
      description: "Multi-tenancy test task",
      priority: "high",
    }),
  });
  expect(createRes.status).toBe(201);
  const task = createRes.data.data as Record<string, unknown>;
  taskIdA = (task._id || task.id) as string;
  expect(taskIdA).toBeTruthy();

  // List tasks from Org B
  const listB = await apiRequest("/tasks", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const tasksB = (listB.data.data as Record<string, unknown>[]) || [];
  const idsInB = tasksB.map((t) => t._id || t.id);
  expect(idsInB).not.toContain(taskIdA);
});

// ---------------------------------------------------------------------------
// 5. Policies from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("5. Policies from Org A invisible to Org B", async () => {
  // Create policy in Org A
  const createRes = await apiRequest("/policies", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      policyName: `Work Policy A ${TS}`,
      type: "work_timing",
      workTiming: {
        startTime: "09:00",
        endTime: "18:00",
        graceMinutes: 15,
        minWorkingHours: 8,
      },
      maxWorkingHoursPerWeek: 40,
      applicableTo: "all",
    }),
  });
  expect(createRes.status).toBe(201);
  const policy = createRes.data.data as Record<string, unknown>;
  policyIdA = (policy._id || policy.id) as string;
  expect(policyIdA).toBeTruthy();

  // List policies from Org B
  const listB = await apiRequest("/policies", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const policiesB = (listB.data.data as Record<string, unknown>[]) || [];
  const idsInB = policiesB.map((p) => p._id || p.id);
  expect(idsInB).not.toContain(policyIdA);
});

// ---------------------------------------------------------------------------
// 6. Roles scoped per org — same name in both orgs succeeds
// ---------------------------------------------------------------------------
test("6. Roles scoped per org — create team_lead in both orgs", async () => {
  const roleName = `team_lead_${TS}`;

  // Create in Org A
  const createA = await apiRequest("/auth/roles", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      name: roleName,
      displayName: `Team Lead ${TS}`,
      description: "Team lead role for Org A",
      permissions: [
        { resource: "projects", actions: ["view"] },
        { resource: "tasks", actions: ["view", "create", "edit"] },
      ],
    }),
  });
  expect(createA.status).toBe(201);

  // Create same-named role in Org B — should also succeed
  const createB = await apiRequest("/auth/roles", {
    method: "POST",
    token: tokenB,
    body: JSON.stringify({
      name: roleName,
      displayName: `Team Lead ${TS}`,
      description: "Team lead role for Org B",
      permissions: [
        { resource: "projects", actions: ["view"] },
        { resource: "tasks", actions: ["view", "create", "edit"] },
        { resource: "employees", actions: ["view"] },
      ],
    }),
  });
  expect(createB.status).toBe(201);
});

// ---------------------------------------------------------------------------
// 7. Leaves from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("7. Leaves from Org A invisible to Org B", async () => {
  // Apply leave in Org A
  const createRes = await apiRequest("/leaves", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      leaveType: "casual",
      startDate: "2026-04-10",
      endDate: "2026-04-11",
      reason: "Multi-tenancy test leave",
    }),
  });
  // Accept 201 or 200 (some systems return 200 for leave apply)
  const leaveCreated = createRes.status === 201 || createRes.status === 200;
  expect(leaveCreated).toBeTruthy();
  const leave = createRes.data.data as Record<string, unknown>;
  leaveIdA = (leave._id || leave.id || "") as string;

  // List leaves from Org B
  const listB = await apiRequest("/leaves", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const leavesB = (listB.data.data as Record<string, unknown>[]) || [];
  if (leaveIdA) {
    const idsInB = leavesB.map((l) => l._id || l.id);
    expect(idsInB).not.toContain(leaveIdA);
  }
  // Even without ID, Org B should see 0 leaves since we never created any there
  expect(leavesB.length).toBe(0);
});

// ---------------------------------------------------------------------------
// 8. Shifts from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("8. Shifts from Org A invisible to Org B", async () => {
  // Create shift in Org A
  const createRes = await apiRequest("/shifts", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      shiftName: `Day Shift A ${TS}`,
      startTime: "09:00",
      endTime: "18:00",
    }),
  });
  expect(createRes.status).toBe(201);
  const shift = createRes.data.data as Record<string, unknown>;
  shiftIdA = (shift._id || shift.id) as string;
  expect(shiftIdA).toBeTruthy();

  // List shifts from Org B
  const listB = await apiRequest("/shifts", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const shiftsB = (listB.data.data as Record<string, unknown>[]) || [];
  const idsInB = shiftsB.map((s) => s._id || s.id);
  expect(idsInB).not.toContain(shiftIdA);
});

// ---------------------------------------------------------------------------
// 9. Clients from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("9. Clients from Org A invisible to Org B", async () => {
  // Create client in Org A
  const createRes = await apiRequest("/clients", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      companyName: `Client A ${TS}`,
      industry: "technology",
      contactPerson: { name: "Client Contact", email: `client-a-${TS}@external.com` },
      status: "active",
    }),
  });
  // Accept 201 or 200
  const clientCreated = createRes.status === 201 || createRes.status === 200;
  expect(clientCreated).toBeTruthy();
  const client = createRes.data.data as Record<string, unknown>;
  clientIdA = (client._id || client.id || "") as string;

  // List clients from Org B
  const listB = await apiRequest("/clients", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const clientsB = (listB.data.data as Record<string, unknown>[]) || [];
  if (clientIdA) {
    const idsInB = clientsB.map((c) => c._id || c.id);
    expect(idsInB).not.toContain(clientIdA);
  }
});

// ---------------------------------------------------------------------------
// 10. Timesheets from Org A invisible to Org B
// ---------------------------------------------------------------------------
test("10. Timesheets from Org A invisible to Org B", async () => {
  // Create timesheet in Org A
  const createRes = await apiRequest("/timesheets", {
    method: "POST",
    token: tokenA,
    body: JSON.stringify({
      period: "weekly",
      startDate: "2026-03-16",
      endDate: "2026-03-22",
      entries: [
        {
          date: "2026-03-20",
          projectId: projectIdA,
          hours: 8,
          description: "Multi-tenancy test timesheet",
        },
      ],
    }),
  });
  // Accept 201 or 200
  const tsCreated = createRes.status === 201 || createRes.status === 200;
  expect(tsCreated).toBeTruthy();
  const tsData = createRes.data.data as Record<string, unknown>;
  timesheetIdA = (tsData._id || tsData.id || "") as string;

  // List timesheets from Org B
  const listB = await apiRequest("/timesheets", { method: "GET", token: tokenB });
  expect(listB.status).toBe(200);
  const timesheetsB = (listB.data.data as Record<string, unknown>[]) || [];
  if (timesheetIdA) {
    const idsInB = timesheetsB.map((t) => t._id || t.id);
    expect(idsInB).not.toContain(timesheetIdA);
  }
});

// ---------------------------------------------------------------------------
// Business Tests
// ---------------------------------------------------------------------------
businessTest(
  "BIZ: Complete data isolation between organizations",
  async () => {
    // Verify Org B cannot see Org A's employee by direct ID fetch
    const directFetch = await apiRequest(`/employees/${employeeIdA}`, {
      method: "GET",
      token: tokenB,
    });
    // Should return 404 or 403 — not the actual employee data
    const isBlocked = directFetch.status === 404 || directFetch.status === 403 || directFetch.status === 401;
    expect(isBlocked).toBeTruthy();

    // Verify Org B cannot see Org A's project by direct ID fetch
    const projectFetch = await apiRequest(`/projects/${projectIdA}`, {
      method: "GET",
      token: tokenB,
    });
    const projectBlocked = projectFetch.status === 404 || projectFetch.status === 403 || projectFetch.status === 401;
    expect(projectBlocked).toBeTruthy();
  },
  "CRITICAL: No cross-tenant data leakage"
);

businessTest(
  "BIZ: Same role names allowed in different orgs",
  async () => {
    const sharedName = `qa_lead_biz_${TS}`;

    const resA = await apiRequest("/auth/roles", {
      method: "POST",
      token: tokenA,
      body: JSON.stringify({
        name: sharedName,
        displayName: `QA Lead ${TS}`,
        description: "QA Lead A",
        permissions: [{ resource: "projects", actions: ["view"] }],
      }),
    });
    expect(resA.status).toBe(201);

    const resB = await apiRequest("/auth/roles", {
      method: "POST",
      token: tokenB,
      body: JSON.stringify({
        name: sharedName,
        displayName: `QA Lead ${TS}`,
        description: "QA Lead B",
        permissions: [{ resource: "tasks", actions: ["view"] }],
      }),
    });
    expect(resB.status).toBe(201);
  },
  "Each org can customize roles independently"
);

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
run();
