/**
 * Nexora E2E Tests — Tasks & Timesheets Module
 * Tests task CRUD, status workflow, comments, time logging, and timesheet lifecycle
 */

import { suite, test, expect, businessTest, run } from "../framework";
import { apiRequest, createTestUser, createTestOrg } from "../config";

suite("Tasks & Timesheets", "e2e", "tasks");

// ── Shared state ──
const suffix = Date.now();
const testEmail = `task-test-${suffix}@nexora-test.io`;
let token = "";
let orgId = "";
let projectId = "";
let taskId = "";
let taskId2 = "";
let timesheetId = "";
let draftTimesheetId = "";

// ── Setup: create user + org + project ──
test("Setup: create test user, org, and project", async () => {
  token = await createTestUser(testEmail, "TaskTest", "User");
  expect(token).toBeTruthy();

  const org = await createTestOrg(token, `TaskTestOrg-${suffix}`);
  orgId = org.orgId;
  token = org.token;
  expect(orgId).toBeTruthy();

  // Create a project to link tasks to
  const projRes = await apiRequest("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({
      projectName: `Task Test Project ${suffix}`,
      status: "active",
    }),
  });
  expect(projRes.status).toBe(201);
  const project = projRes.data.data as Record<string, unknown>;
  projectId = (project._id || project.id) as string;
  expect(projectId).toBeTruthy();
});

// 1. Create task linked to project
test("Create task linked to project", async () => {
  const res = await apiRequest("/tasks", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `E2E Task ${suffix}`,
      projectId,
      description: "Task created in E2E test",
      type: "task",
      priority: "high",
      estimatedHours: 8,
      labels: ["e2e", "test"],
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const task = res.data.data as Record<string, unknown>;
  taskId = (task._id || task.id) as string;
  expect(taskId).toBeTruthy();
  expect(task.title).toBe(`E2E Task ${suffix}`);
  expect(task.projectId).toBe(projectId);
});

// 2. List tasks with filters
test("List tasks with filters", async () => {
  const res = await apiRequest(`/tasks?projectId=${projectId}&priority=high`, {
    method: "GET",
    token,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const data = res.data.data as Record<string, unknown>[];
  expect(data.length).toBeGreaterThanOrEqual(1);
});

// 3. Get task by ID
test("Get task by ID", async () => {
  const res = await apiRequest(`/tasks/${taskId}`, { method: "GET", token });
  expect(res.status).toBe(200);
  const task = res.data.data as Record<string, unknown>;
  expect(task.title).toBe(`E2E Task ${suffix}`);
  expect(task.priority).toBe("high");
});

// 4. Update task
test("Update task", async () => {
  const res = await apiRequest(`/tasks/${taskId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      description: "Updated task description",
      priority: "critical",
      estimatedHours: 12,
    }),
  });
  expect(res.status).toBe(200);
  const task = res.data.data as Record<string, unknown>;
  expect(task.description).toBe("Updated task description");
  expect(task.priority).toBe("critical");
});

// 5. Delete task — create a throwaway task for this
test("Delete task", async () => {
  const createRes = await apiRequest("/tasks", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `Deletable Task ${suffix}`,
      projectId,
    }),
  });
  const delTask = createRes.data.data as Record<string, unknown>;
  const delId = (delTask._id || delTask.id) as string;

  const res = await apiRequest(`/tasks/${delId}`, { method: "DELETE", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// 6. Update task status
test("Update task status", async () => {
  const res = await apiRequest(`/tasks/${taskId}/status`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status: "in_progress" }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const task = res.data.data as Record<string, unknown>;
  expect(task.status).toBe("in_progress");
});

// 7. Add comment to task
test("Add comment to task", async () => {
  const res = await apiRequest(`/tasks/${taskId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ content: "This is an E2E test comment" }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const task = res.data.data as Record<string, unknown>;
  const comments = task.comments as Record<string, unknown>[];
  expect(comments.length).toBeGreaterThanOrEqual(1);
});

// 8. Log time on task (updates loggedHours)
test("Log time on task (updates loggedHours)", async () => {
  const res = await apiRequest(`/tasks/${taskId}/time-entries`, {
    method: "POST",
    token,
    body: JSON.stringify({
      hours: 2.5,
      description: "Worked on feature implementation",
      date: "2026-03-23",
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const task = res.data.data as Record<string, unknown>;
  expect((task.loggedHours as number)).toBeGreaterThanOrEqual(2.5);
});

// 9. My tasks filter
test("My tasks filter", async () => {
  const res = await apiRequest("/tasks/my", { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// 10. Task stats by project
test("Task stats by project", async () => {
  const res = await apiRequest(`/tasks/stats?projectId=${projectId}`, { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// 11. Create timesheet
test("Create timesheet", async () => {
  const res = await apiRequest("/timesheets", {
    method: "POST",
    token,
    body: JSON.stringify({
      period: "weekly",
      startDate: "2026-03-16",
      endDate: "2026-03-22",
      entries: [
        {
          date: "2026-03-16",
          projectId,
          projectName: `Task Test Project ${suffix}`,
          hours: 8,
          description: "Development work",
          category: "development",
        },
        {
          date: "2026-03-17",
          projectId,
          projectName: `Task Test Project ${suffix}`,
          hours: 7,
          description: "Code review",
          category: "review",
        },
      ],
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const ts = res.data.data as Record<string, unknown>;
  timesheetId = (ts._id || ts.id) as string;
  expect(timesheetId).toBeTruthy();
});

// 12. Get my timesheets
test("Get my timesheets", async () => {
  const res = await apiRequest("/timesheets/my", { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const data = res.data.data as unknown[];
  expect(data.length).toBeGreaterThanOrEqual(1);
});

// 13. Submit timesheet
test("Submit timesheet", async () => {
  const res = await apiRequest(`/timesheets/${timesheetId}/submit`, {
    method: "POST",
    token,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const ts = res.data.data as Record<string, unknown>;
  expect(ts.status).toBe("submitted");
});

// 14. Review (approve) timesheet
test("Review (approve) timesheet", async () => {
  const res = await apiRequest(`/timesheets/${timesheetId}/review`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      status: "approved",
      reviewComment: "Looks good, approved by E2E test",
    }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const ts = res.data.data as Record<string, unknown>;
  expect(ts.status).toBe("approved");
});

// 15. Cannot edit submitted timesheet
test("Cannot edit submitted timesheet", async () => {
  // The timesheet was submitted and approved — updating should fail
  const res = await apiRequest(`/timesheets/${timesheetId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      entries: [
        { date: "2026-03-16", hours: 10, description: "Trying to edit" },
      ],
    }),
  });
  // Expect a non-200 status (400 or 403 typically)
  expect(res.status).not.toBe(200);
});

// 16. Delete only draft timesheets
test("Delete only draft timesheets", async () => {
  // Create a draft timesheet
  const createRes = await apiRequest("/timesheets", {
    method: "POST",
    token,
    body: JSON.stringify({
      period: "daily",
      startDate: "2026-03-23",
      endDate: "2026-03-23",
      entries: [
        { date: "2026-03-23", hours: 4, description: "Draft entry", category: "development" },
      ],
    }),
  });
  expect(createRes.status).toBe(201);
  const draft = createRes.data.data as Record<string, unknown>;
  draftTimesheetId = (draft._id || draft.id) as string;

  // Delete draft — should succeed
  const delRes = await apiRequest(`/timesheets/${draftTimesheetId}`, { method: "DELETE", token });
  expect(delRes.status).toBe(200);
  expect(delRes.data.success).toBe(true);

  // Try to delete the approved timesheet — should fail
  const failRes = await apiRequest(`/timesheets/${timesheetId}`, { method: "DELETE", token });
  expect(failRes.status).not.toBe(200);
});

// 17. Pending timesheets list
test("Pending timesheets list", async () => {
  // Create and submit a timesheet so there is a pending one
  const createRes = await apiRequest("/timesheets", {
    method: "POST",
    token,
    body: JSON.stringify({
      period: "daily",
      startDate: "2026-03-20",
      endDate: "2026-03-20",
      entries: [
        { date: "2026-03-20", hours: 6, description: "Pending entry", category: "development" },
      ],
    }),
  });
  const pendingTs = createRes.data.data as Record<string, unknown>;
  const pendingTsId = (pendingTs._id || pendingTs.id) as string;

  await apiRequest(`/timesheets/${pendingTsId}/submit`, { method: "POST", token });

  const res = await apiRequest("/timesheets/pending", { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const data = res.data.data as unknown[];
  expect(data.length).toBeGreaterThanOrEqual(1);
});

// ── Business Tests ──

businessTest(
  "BIZ: Time logged on tasks aggregates correctly",
  async () => {
    // Create a second task and log time on both
    const task2Res = await apiRequest("/tasks", {
      method: "POST",
      token,
      body: JSON.stringify({
        title: `Aggregation Task ${suffix}`,
        projectId,
        estimatedHours: 4,
      }),
    });
    const task2 = task2Res.data.data as Record<string, unknown>;
    taskId2 = (task2._id || task2.id) as string;

    // Log time on task 2
    await apiRequest(`/tasks/${taskId2}/time-entries`, {
      method: "POST",
      token,
      body: JSON.stringify({ hours: 3, description: "Task 2 work", date: "2026-03-23" }),
    });

    // Log additional time on task 1
    await apiRequest(`/tasks/${taskId}/time-entries`, {
      method: "POST",
      token,
      body: JSON.stringify({ hours: 1.5, description: "More work on task 1", date: "2026-03-23" }),
    });

    // Verify task 1 now has 2.5 + 1.5 = 4.0 hours
    const t1Res = await apiRequest(`/tasks/${taskId}`, { method: "GET", token });
    const t1 = t1Res.data.data as Record<string, unknown>;
    expect((t1.loggedHours as number)).toBeGreaterThanOrEqual(4);

    // Verify task 2 has 3 hours
    const t2Res = await apiRequest(`/tasks/${taskId2}`, { method: "GET", token });
    const t2 = t2Res.data.data as Record<string, unknown>;
    expect((t2.loggedHours as number)).toBeGreaterThanOrEqual(3);
  },
  "Accurate time tracking for billing",
);

businessTest(
  "BIZ: Timesheet review workflow prevents unreviewed billing",
  async () => {
    // Create a timesheet with billable hours
    const createRes = await apiRequest("/timesheets", {
      method: "POST",
      token,
      body: JSON.stringify({
        period: "daily",
        startDate: "2026-03-19",
        endDate: "2026-03-19",
        entries: [
          {
            date: "2026-03-19",
            projectId,
            hours: 8,
            description: "Billable client work",
            category: "development",
          },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const ts = createRes.data.data as Record<string, unknown>;
    const tsId = (ts._id || ts.id) as string;

    // Verify it starts as draft — not yet billable
    expect(ts.status).toBe("draft");

    // Submit it
    const submitRes = await apiRequest(`/timesheets/${tsId}/submit`, { method: "POST", token });
    const submitted = submitRes.data.data as Record<string, unknown>;
    expect(submitted.status).toBe("submitted");

    // Reject it — simulates review catching errors before billing
    const rejectRes = await apiRequest(`/timesheets/${tsId}/review`, {
      method: "PUT",
      token,
      body: JSON.stringify({
        status: "rejected",
        reviewComment: "Hours seem too high for this task, please revise",
      }),
    });
    expect(rejectRes.status).toBe(200);
    const rejected = rejectRes.data.data as Record<string, unknown>;
    expect(rejected.status).toBe("rejected");
  },
  "Financial control for client billing",
);

run();
