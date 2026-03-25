/**
 * Nexora Test Configuration
 * Central config for all test suites — API URLs, credentials, timeouts
 */

export const CONFIG = {
  // API Gateway — all requests go through here
  API_BASE: process.env.TEST_API_URL || "http://localhost:3005",

  // Direct service URLs (for unit/integration tests)
  SERVICES: {
    auth: process.env.AUTH_URL || "http://localhost:3010",
    hr: process.env.HR_URL || "http://localhost:3020",
    attendance: process.env.ATTENDANCE_URL || "http://localhost:3011",
    leave: process.env.LEAVE_URL || "http://localhost:3012",
    project: process.env.PROJECT_URL || "http://localhost:3030",
    task: process.env.TASK_URL || "http://localhost:3031",
  },

  // Test user credentials (OTP is always 000000 in dev)
  DEV_OTP: "000000",

  // Timeouts
  REQUEST_TIMEOUT: 10000,
  SUITE_TIMEOUT: 120000,

  // MongoDB
  MONGO_URI: "mongodb://root:nexora_dev_password@localhost:27017",
  DATABASES: ["nexora_auth", "nexora_hr", "nexora_attendance", "nexora_leave", "nexora_projects", "nexora_tasks"],
};

export const API = `${CONFIG.API_BASE}/api/v1`;

/** Helper: Make authenticated API request */
export async function apiRequest(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<{ status: number; data: Record<string, unknown> }> {
  const { token, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOpts.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API}${path}`, {
    ...fetchOpts,
    headers,
    signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT),
  });

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }

  return { status: res.status, data };
}

/** Helper: Create a new user via OTP flow and return token */
export async function createTestUser(email: string, firstName = "Test", lastName = "User"): Promise<string> {
  // Send OTP
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  // Verify OTP
  const verify = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: CONFIG.DEV_OTP }),
  });

  const token = (verify.data.data as Record<string, unknown>)?.tokens
    ? ((verify.data.data as Record<string, Record<string, string>>).tokens).accessToken
    : "";

  // Complete profile if new user
  const isNew = (verify.data.data as Record<string, unknown>)?.isNewUser;
  if (isNew) {
    await apiRequest("/auth/complete-profile", {
      method: "POST",
      token,
      body: JSON.stringify({ firstName, lastName, password: "" }),
    });
  }

  return token;
}

/** Helper: Create org and return { orgId, token } with org-scoped JWT */
export async function createTestOrg(
  token: string,
  name: string,
  industry = "it_company",
  size = "11-50"
): Promise<{ orgId: string; token: string }> {
  const orgRes = await apiRequest("/auth/organizations", {
    method: "POST",
    token,
    body: JSON.stringify({ name, industry, size }),
  });

  const orgData = (orgRes.data.data as Record<string, Record<string, string>>)?.organization;
  const orgId = orgData?._id || "";

  // Switch to org to get org-scoped token
  const switchRes = await apiRequest("/auth/switch-org", {
    method: "POST",
    token,
    body: JSON.stringify({ organizationId: orgId }),
  });

  const newToken = (switchRes.data.data as Record<string, string>)?.accessToken || token;

  return { orgId, token: newToken };
}
