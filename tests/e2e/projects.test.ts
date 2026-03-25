/**
 * Nexora E2E Tests — Projects Module
 * Tests project CRUD, team management, milestones, risks, budget, and dashboard
 */

import { suite, test, expect, run } from "../framework";
import { apiRequest, createTestUser, createTestOrg } from "../config";

suite("Projects", "e2e", "projects");

// ── Shared state ──
const suffix = Date.now();
const testEmail = `proj-test-${suffix}@nexora-test.io`;
let token = "";
let orgId = "";
let projectId = "";
let milestoneId = "";
let riskId = "";
let memberUserId = "";

// ── Setup: create user + org ──
test("Setup: create test user and org", async () => {
  token = await createTestUser(testEmail, "ProjTest", "User");
  expect(token).toBeTruthy();

  const org = await createTestOrg(token, `ProjTestOrg-${suffix}`);
  orgId = org.orgId;
  token = org.token;
  expect(orgId).toBeTruthy();
});

// 1. Create project with org context
test("Create project with org context", async () => {
  const res = await apiRequest("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({
      projectName: `E2E Project ${suffix}`,
      description: "End-to-end test project",
      category: "engineering",
      status: "planning",
      priority: "high",
      startDate: "2026-03-01",
      endDate: "2026-06-30",
      budget: { amount: 50000, currency: "USD", billingType: "fixed" },
      tags: ["e2e", "test"],
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const project = res.data.data as Record<string, unknown>;
  projectId = (project._id || project.id) as string;
  expect(projectId).toBeTruthy();
  expect(project.projectName).toBe(`E2E Project ${suffix}`);
});

// 2. List projects filtered by org
test("List projects filtered by org", async () => {
  const res = await apiRequest("/projects", { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const data = res.data.data as Record<string, unknown>[];
  expect(data.length).toBeGreaterThanOrEqual(1);
});

// 3. Get project by ID
test("Get project by ID", async () => {
  const res = await apiRequest(`/projects/${projectId}`, { method: "GET", token });
  expect(res.status).toBe(200);
  const project = res.data.data as Record<string, unknown>;
  expect(project.projectName).toBe(`E2E Project ${suffix}`);
  expect(project.priority).toBe("high");
});

// 4. Update project
test("Update project", async () => {
  const res = await apiRequest(`/projects/${projectId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      description: "Updated description for E2E",
      status: "active",
      priority: "critical",
    }),
  });
  expect(res.status).toBe(200);
  const project = res.data.data as Record<string, unknown>;
  expect(project.description).toBe("Updated description for E2E");
  expect(project.status).toBe("active");
});

// 5. Delete project (soft delete) — we create a throwaway project for this
test("Delete project (soft delete)", async () => {
  const createRes = await apiRequest("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ projectName: `Deletable Project ${suffix}` }),
  });
  const delProject = createRes.data.data as Record<string, unknown>;
  const delId = (delProject._id || delProject.id) as string;

  const res = await apiRequest(`/projects/${delId}`, { method: "DELETE", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// 6. Add team member to project
test("Add team member to project", async () => {
  // Create a second user to add as a team member
  const memberEmail = `proj-member-${suffix}@nexora-test.io`;
  const memberToken = await createTestUser(memberEmail, "Member", "User");
  expect(memberToken).toBeTruthy();

  // Get member user info from /auth/me
  const meRes = await apiRequest("/auth/me", { method: "GET", token: memberToken });
  const meData = meRes.data.data as Record<string, unknown>;
  memberUserId = (meData._id || meData.id || meData.userId) as string;
  expect(memberUserId).toBeTruthy();

  const res = await apiRequest(`/projects/${projectId}/team`, {
    method: "POST",
    token,
    body: JSON.stringify({
      userId: memberUserId,
      role: "member",
      allocationPercentage: 80,
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
});

// 7. Remove team member
test("Remove team member", async () => {
  const res = await apiRequest(`/projects/${projectId}/team/${memberUserId}`, {
    method: "DELETE",
    token,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// 8. Add milestone
test("Add milestone", async () => {
  const res = await apiRequest(`/projects/${projectId}/milestones`, {
    method: "POST",
    token,
    body: JSON.stringify({
      name: "Phase 1 Complete",
      targetDate: "2026-04-15",
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const project = res.data.data as Record<string, unknown>;
  const milestones = project.milestones as Record<string, unknown>[];
  expect(milestones.length).toBeGreaterThanOrEqual(1);
  milestoneId = (milestones[milestones.length - 1]._id || milestones[milestones.length - 1].id) as string;
  expect(milestoneId).toBeTruthy();
});

// 9. Update milestone status
test("Update milestone status", async () => {
  const res = await apiRequest(`/projects/${projectId}/milestones/${milestoneId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status: "completed" }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// 10. Health score calculation
test("Health score calculation (overdue milestones)", async () => {
  // Create a project with an overdue milestone to test health score
  const createRes = await apiRequest("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({
      projectName: `Health Score Project ${suffix}`,
      startDate: "2025-01-01",
      endDate: "2026-12-31",
    }),
  });
  const hProject = createRes.data.data as Record<string, unknown>;
  const hProjectId = (hProject._id || hProject.id) as string;

  // Add overdue milestone (past date)
  await apiRequest(`/projects/${hProjectId}/milestones`, {
    method: "POST",
    token,
    body: JSON.stringify({ name: "Overdue Milestone", targetDate: "2025-06-01" }),
  });

  // Fetch dashboard to see health score
  const dashRes = await apiRequest(`/projects/${hProjectId}/dashboard`, { method: "GET", token });
  expect(dashRes.status).toBe(200);
  expect(dashRes.data.success).toBe(true);
  expect(dashRes.data.data).toBeDefined();
});

// 11. Budget tracking (update spent)
test("Budget tracking (update spent)", async () => {
  const res = await apiRequest(`/projects/${projectId}/budget`, {
    method: "PUT",
    token,
    body: JSON.stringify({ spent: 12500 }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const project = res.data.data as Record<string, unknown>;
  const budget = project.budget as Record<string, unknown>;
  expect(budget.spent).toBe(12500);
});

// 12. Add risk
test("Add risk", async () => {
  const res = await apiRequest(`/projects/${projectId}/risks`, {
    method: "POST",
    token,
    body: JSON.stringify({
      description: "Key developer might leave",
      probability: "medium",
      impact: "high",
      mitigation: "Cross-train team members",
    }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const project = res.data.data as Record<string, unknown>;
  const risks = project.risks as Record<string, unknown>[];
  expect(risks.length).toBeGreaterThanOrEqual(1);
  riskId = (risks[risks.length - 1]._id || risks[risks.length - 1].id) as string;
  expect(riskId).toBeTruthy();
});

// 13. Update risk
test("Update risk", async () => {
  const res = await apiRequest(`/projects/${projectId}/risks/${riskId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      status: "mitigated",
      mitigation: "Team cross-training completed",
    }),
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// 14. Remove risk
test("Remove risk", async () => {
  // Add another risk to remove
  const addRes = await apiRequest(`/projects/${projectId}/risks`, {
    method: "POST",
    token,
    body: JSON.stringify({
      description: "Temporary risk to remove",
      probability: "low",
      impact: "low",
    }),
  });
  const project = addRes.data.data as Record<string, unknown>;
  const risks = project.risks as Record<string, unknown>[];
  const tempRiskId = (risks[risks.length - 1]._id || risks[risks.length - 1].id) as string;

  const res = await apiRequest(`/projects/${projectId}/risks/${tempRiskId}`, {
    method: "DELETE",
    token,
  });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
});

// 15. Project activities logged
test("Project activities logged", async () => {
  const res = await apiRequest(`/projects/${projectId}/activities`, { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const activities = res.data.data as unknown[];
  // After create + update + team + milestone + risk operations, there should be activities
  expect(activities.length).toBeGreaterThanOrEqual(1);
});

// 16. Duplicate project
test("Duplicate project", async () => {
  const res = await apiRequest(`/projects/${projectId}/duplicate`, {
    method: "POST",
    token,
    body: JSON.stringify({ projectName: `Duplicated Project ${suffix}` }),
  });
  expect(res.status).toBe(201);
  expect(res.data.success).toBe(true);
  const dup = res.data.data as Record<string, unknown>;
  expect(dup.projectName).toBe(`Duplicated Project ${suffix}`);
  const dupId = (dup._id || dup.id) as string;
  expect(dupId).toBeTruthy();
  expect(dupId).not.toBe(projectId);
});

// 17. Archive project
test("Archive project", async () => {
  // Create a project to archive (don't archive the main test project)
  const createRes = await apiRequest("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ projectName: `Archivable Project ${suffix}` }),
  });
  const archProject = createRes.data.data as Record<string, unknown>;
  const archId = (archProject._id || archProject.id) as string;

  const res = await apiRequest(`/projects/${archId}/archive`, {
    method: "POST",
    token,
  });
  expect([200, 201]).toContain(res.status);
  expect(res.data.success).toBe(true);
});

// 18. Project dashboard data
test("Project dashboard data", async () => {
  const res = await apiRequest(`/projects/${projectId}/dashboard`, { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

// 19. My projects (filtered by team membership)
test("My projects (filtered by team membership)", async () => {
  const res = await apiRequest("/projects/my", { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  const projects = res.data.data as unknown[];
  expect(projects).toBeDefined();
});

// 20. Project stats
test("Project stats", async () => {
  const res = await apiRequest("/projects/stats", { method: "GET", token });
  expect(res.status).toBe(200);
  expect(res.data.success).toBe(true);
  expect(res.data.data).toBeDefined();
});

run();
