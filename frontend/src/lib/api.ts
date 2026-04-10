const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
export const API_BASE_URL = API_BASE;

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  pagination?: { page: number; limit: number; total: number; pages: number };
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Attach CSRF token for state-changing requests
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-XSRF-TOKEN"] = csrfToken;
    }
  }

  const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Send httpOnly cookies automatically
  });

  // Token rotation: if the server returns a refreshed token, update localStorage
  const newAccessToken = res.headers.get('x-new-access-token');
  if (newAccessToken && typeof window !== 'undefined') {
    localStorage.setItem('accessToken', newAccessToken);
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error?.message || "Request failed");
  }

  return data;
}

// ── Types ──

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
  isActive: boolean;
  mfaEnabled: boolean;
  isPlatformAdmin?: boolean;
  setupStage?: string;
  createdAt: string;
}

export interface Employee {
  _id: string;
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  phone?: string;
  departmentId?: string;
  designationId?: string;
  reportingManagerId?: string;
  employmentType: string;
  joiningDate: string;
  location?: string;
  timezone?: string;
  skills: string[];
  policyIds?: string[];
  status: string;
  isActive: boolean;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  headId?: string;
  parentDepartmentId?: string;
  costCenter?: string;
  isActive: boolean;
}

export interface Designation {
  _id: string;
  title: string;
  level: number;
  track: string;
}

// ── Auth API ──

export const authApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthTokens>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  checkEmail: (email: string) =>
    request<{ exists: boolean; hasOrgs: boolean; orgs: Organization[] }>("/auth/check-email?email=" + encodeURIComponent(email)),

  me: () => request<User>("/auth/me"),

  refresh: (refreshToken: string) =>
    request<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: () => request("/auth/logout", { method: "POST" }),

  sendOtp: (email: string) =>
    request("/auth/send-otp", { method: "POST", body: JSON.stringify({ email }) }),
  verifyOtp: (email: string, otp: string) =>
    request("/auth/verify-otp", { method: "POST", body: JSON.stringify({ email, otp }) }),
  completeProfile: (data: { firstName: string; lastName: string; password: string }) =>
    request("/auth/complete-profile", { method: "POST", body: JSON.stringify(data) }),
  updateProfile: (data: { firstName?: string; lastName?: string; avatar?: string; phoneNumber?: string }) =>
    request<ApiResponse<User>>("/auth/me", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<ApiResponse<void>>("/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
  disableMFA: () =>
    request<ApiResponse<void>>("/auth/mfa", { method: "DELETE" }),
  getPreferences: () =>
    request<ApiResponse<Record<string, unknown>>>("/auth/preferences"),
  updatePreferences: (prefs: Record<string, unknown>) =>
    request<ApiResponse<Record<string, unknown>>>("/auth/preferences", { method: "PUT", body: JSON.stringify(prefs) }),
  updateSetupStage: (stage: string) =>
    request("/auth/setup-stage", { method: "PUT", body: JSON.stringify({ stage }) }),
  validateInvite: (token: string) =>
    request<{ valid: boolean; email: string; orgName: string; role: string; orgId: string }>("/auth/invites/" + token + "/validate"),
  acceptInvite: (token: string) =>
    request("/auth/invites/" + token + "/accept", { method: "POST" }),
  declineInvite: (token: string) =>
    request("/auth/invites/" + token + "/decline", { method: "POST" }),
  getSessions: () =>
    request("/auth/sessions"),
  revokeSession: (sessionId: string) =>
    request(`/auth/sessions/${sessionId}`, { method: "DELETE" }),
  revokeAllSessions: () =>
    request("/auth/sessions", { method: "DELETE" }),
  getMyDevices: () => request("/auth/devices"),
  revokeDevice: (id: string, reason?: string) =>
    request(`/auth/devices/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  revokeAllDevices: () =>
    request("/auth/devices/revoke-all", { method: "POST" }),

  // Developer / Marketplace
  createApiKey: (data: { name: string; scopes: string[]; expiresAt?: string }) =>
    request("/developer/api-keys", { method: "POST", body: JSON.stringify(data) }),
  listApiKeys: () => request("/developer/api-keys"),
  revokeApiKey: (id: string, reason?: string) =>
    request(`/developer/api-keys/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  createWebhook: (data: { name: string; url: string; events: string[] }) =>
    request("/developer/webhooks", { method: "POST", body: JSON.stringify(data) }),
  listWebhooks: () => request("/developer/webhooks"),
  deleteWebhook: (id: string) =>
    request(`/developer/webhooks/${id}`, { method: "DELETE" }),
  listAvailableIntegrations: () => request("/developer/integrations/available"),

  // GDPR
  exportMyData: () => request("/gdpr/export"),
  downloadDataExport: () => request("/gdpr/export/download"),
  requestAccountDeletion: (data: { reason?: string; confirmEmail: string }) =>
    request("/gdpr/delete-request", { method: "POST", body: JSON.stringify(data) }),
  getDeletionStatus: () => request("/gdpr/delete-request/status"),
  cancelAccountDeletion: () =>
    request("/gdpr/delete-request", { method: "DELETE" }),
};

// ── HR API ──

export const hrApi = {
  // Employees
  getEmployees: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Employee[]>(`/employees${qs}`);
  },
  getEmployee: (id: string) => request<Employee>(`/employees/${id}`),
  getStats: () => request<{ total: number; active: number; onNotice: number; departments: number }>("/employees/stats"),
  createEmployee: (data: Partial<Employee>) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: Partial<Employee>) =>
    request<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEmployee: (id: string) =>
    request(`/employees/${id}`, { method: "DELETE" }),

  // Employee Policies
  attachPolicy: (employeeId: string, policyId: string) =>
    request(`/employees/${employeeId}/policies`, { method: "POST", body: JSON.stringify({ policyId }) }),
  detachPolicy: (employeeId: string, policyId: string) =>
    request(`/employees/${employeeId}/policies/${policyId}`, { method: "DELETE" }),
  getEmployeePolicies: (employeeId: string) =>
    request<string[]>(`/employees/${employeeId}/policies`),

  // Departments
  getDepartments: () => request<Department[]>("/departments"),
  createDepartment: (data: Partial<Department>) =>
    request<Department>("/departments", { method: "POST", body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: Partial<Department>) =>
    request<Department>(`/departments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDepartment: (id: string) =>
    request(`/departments/${id}`, { method: "DELETE" }),

  // Designations
  getDesignations: () => request<Designation[]>("/designations"),
  createDesignation: (data: { title: string; level: number; departmentId?: string; track?: string }) =>
    request<Designation>("/designations", { method: "POST", body: JSON.stringify(data) }),
};

// ── Client Types & API ──

export interface ClientContactPerson {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
}

export interface Client {
  _id: string;
  companyName: string;
  displayName?: string;
  industry: string;
  contactPerson?: { name: string; email: string; phone: string; designation: string };
  contactPersons?: ClientContactPerson[];
  projectIds?: string[];
  totalRevenue?: number;
  outstandingAmount?: number;
  lastInvoiceDate?: string;
  lastPaymentDate?: string;
  billingAddress?: { street: string; city: string; state: string; country: string; zip: string };
  website?: string;
  taxId?: string;
  currency: string;
  paymentTerms: number;
  status: string;
  tags: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const clientApi = {
  getClients: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Client[]>(`/clients${qs}`);
  },
  getClient: (id: string) => request<Client>(`/clients/${id}`),
  createClient: (data: Partial<Client>) =>
    request<Client>("/clients", { method: "POST", body: JSON.stringify(data) }),
  updateClient: (id: string, data: Partial<Client>) =>
    request<Client>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteClient: (id: string) =>
    request(`/clients/${id}`, { method: "DELETE" }),
  getStats: () =>
    request<{ total: number; active: number; inactive: number; prospects: number }>("/clients/stats"),
  getDashboard: (id: string) =>
    request(`/clients/${id}/dashboard`),
  linkProject: (clientId: string, projectId: string) =>
    request(`/clients/${clientId}/projects`, { method: "POST", body: JSON.stringify({ projectId }) }),
  unlinkProject: (clientId: string, projectId: string) =>
    request(`/clients/${clientId}/projects/${projectId}`, { method: "DELETE" }),
  getProjects: (clientId: string) =>
    request(`/clients/${clientId}/projects`),
  addContact: (clientId: string, contact: Record<string, unknown>) =>
    request(`/clients/${clientId}/contacts`, { method: "POST", body: JSON.stringify(contact) }),
  removeContact: (clientId: string, idx: number) =>
    request(`/clients/${clientId}/contacts/${idx}`, { method: "DELETE" }),
};

// ── Types: Attendance, Leave, Project, Task ──

export interface Attendance {
  _id: string;
  employeeId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalWorkingHours?: number;
  status: string;
  entryType: string;
  checkInMethod?: string;
  approvalStatus?: string;
  notes?: string;
}

export interface Leave {
  _id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  approvedBy?: string;
}

// ── Attendance API ──

export const attendanceApi = {
  checkIn: () => request("/attendance/check-in", { method: "POST" }),
  checkOut: () => request("/attendance/check-out", { method: "POST" }),
  getToday: () => request<Attendance>("/attendance/today"),
  getMy: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Attendance[]>(`/attendance/my${qs}`);
  },
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Attendance[]>(`/attendance${qs}`);
  },
  getStats: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/attendance/stats${qs}`);
  },
  manualEntry: (data: { date: string; checkInTime: string; checkOutTime: string; reason: string }) =>
    request("/attendance/manual-entry", { method: "POST", body: JSON.stringify(data) }),
  getPendingApprovals: () => request("/attendance/pending-approvals"),
  approveEntry: (id: string, data: { approved: boolean; rejectionReason?: string }) =>
    request(`/attendance/${id}/approve`, { method: "PUT", body: JSON.stringify(data) }),
};

// ── Leave API ──

export const leaveApi = {
  apply: (data: { leaveType: string; startDate: string; endDate: string; reason: string }) =>
    request<Leave>("/leaves", { method: "POST", body: JSON.stringify(data) }),
  getMy: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Leave[]>(`/leaves/my${qs}`);
  },
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Leave[]>(`/leaves${qs}`);
  },
  getBalance: () => request("/leaves/balance"),
  approve: (id: string, data: { status: string; rejectionReason?: string }) =>
    request(`/leaves/${id}/approve`, { method: "PUT", body: JSON.stringify(data) }),
  cancel: (id: string, data: { reason: string }) =>
    request(`/leaves/${id}/cancel`, { method: "PUT", body: JSON.stringify(data) }),
  getStats: () => request("/leaves/stats"),
};


// ── Types: Policy & Alert ──

export interface PolicyWorkTiming {
  startTime: string;
  endTime: string;
  timezone: string;
  graceMinutes: number;
  minWorkingHours: number;
  breakMinutes: number;
}

export interface PolicyWfh {
  maxDaysPerMonth: number;
  requiresApproval: boolean;
  allowedDays: string[];
}

export interface PolicyAlerts {
  lateArrival: boolean;
  earlyDeparture: boolean;
  missedClockIn: boolean;
  overtimeAlert: boolean;
}

export interface PolicyCondition {
  name: string;
  value: string;
  description?: string;
}

export interface LeaveTypeConfig {
  type: string;
  label: string;
  annualAllocation: number;
  accrualFrequency: string;
  accrualAmount: number;
  maxCarryForward: number;
  encashable: boolean;
  maxConsecutiveDays: number;
  requiresDocument: boolean;
  applicableTo: string;
  minServiceMonths: number;
}

export interface PolicyLeave {
  leaveTypes: LeaveTypeConfig[];
  yearStart: string;
  probationLeaveAllowed: boolean;
  halfDayAllowed: boolean;
  backDatedLeaveMaxDays: number;
}

export interface PolicyRule {
  key: string;
  operator: string;
  value: unknown;
  description?: string;
}

export interface Policy {
  _id: string;
  organizationId?: string;
  policyName: string;
  description?: string;
  category: string;
  workTiming?: Record<string, unknown>;
  wfhConfig?: Record<string, unknown>;
  leaveConfig?: Record<string, unknown>;
  overtimeConfig?: Record<string, unknown>;
  shiftConfig?: Record<string, unknown>;
  expenseConfig?: Record<string, unknown>;
  travelConfig?: Record<string, unknown>;
  reimbursementConfig?: Record<string, unknown>;
  invoiceConfig?: Record<string, unknown>;
  exemptionConfig?: Record<string, unknown>;
  attendanceConfig?: Record<string, unknown>;
  rules?: PolicyRule[];
  applicableTo?: string;
  applicableIds?: string[];
  isTemplate?: boolean;
  templateName?: string;
  sourceTemplateId?: string;
  version?: number;
  previousVersionId?: string;
  isLatestVersion?: boolean;
  changeLog?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  acknowledgementRequired?: boolean;
  isActive?: boolean;
  isDeleted?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // Backward-compatible fields from old attendance-service policies
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leavePolicy?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wfhPolicy?: any;
  maxWorkingHoursPerWeek?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alerts?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Alert {
  _id: string;
  employeeId: string;
  policyId?: string;
  alertType: string;
  message: string;
  date: string;
  severity: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Policy API ──

export const policyApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Policy[]>("/policies" + qs);
  },
  getById: (id: string) => request<Policy>(`/policies/${id}`),
  create: (data: Partial<Policy>) =>
    request<Policy>("/policies", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Policy>) =>
    request<Policy>(`/policies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/policies/${id}`, { method: "DELETE" }),
  getTemplates: (category?: string) => {
    const path = category ? `/policies/templates/${category}` : "/policies/templates";
    return request<Policy[]>(path);
  },
  createFromTemplate: (templateId: string, overrides?: Partial<Policy>) =>
    request<Policy>(`/policies/from-template/${templateId}`, { method: "POST", body: JSON.stringify(overrides || {}) }),
  getVersionHistory: (id: string) =>
    request<Policy[]>(`/policies/${id}/versions`),
  acknowledge: (id: string) =>
    request<void>(`/policies/${id}/acknowledge`, { method: "POST" }),
  getApplicable: () => request<Policy[]>("/policies/applicable"),
};

// ── Alert API ──

export const alertApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Alert[]>(`/alerts${qs}`);
  },
  getMy: () => request<Alert[]>("/alerts/my"),
  acknowledge: (id: string) =>
    request<Alert>(`/alerts/${id}/acknowledge`, { method: "PUT" }),
};

// ── Types: Role ──

export interface RolePermission {
  resource: string;
  actions: string[];
}

export interface Role {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: RolePermission[];
  color: string;
  isSystem: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Role API ──


export const roleApi = {
  getRoles: () => request<Role[]>("/auth/roles"),

  getRole: (id: string) => request<Role>(`/auth/roles/${id}`),

  createRole: (data: {
    name: string;
    displayName: string;
    description?: string;
    permissions: RolePermission[];
    color?: string;
    isSystem?: boolean;
  }) => request<Role>("/auth/roles", { method: "POST", body: JSON.stringify(data) }),

  updateRole: (id: string, data: {
    displayName?: string;
    description?: string;
    permissions?: RolePermission[];
    color?: string;
    isActive?: boolean;
  }) => request<Role>(`/auth/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteRole: (id: string) => request(`/auth/roles/${id}`, { method: "DELETE" }),

  assignRoles: (userId: string, roles: string[]) =>
    request<User>(`/auth/users/${userId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roles }),
    }),

  getUsers: () => request<User[]>("/auth/users"),
};

// ── AI API ──

export const aiApi = {
  chat: (messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) =>
    request<{ text: string }>("/ai/chat", { method: "POST", body: JSON.stringify({ messages, ...options }) }),

  generateDescription: (data: { projectName: string; category: string; context?: string }) =>
    request<{ description: string }>("/ai/project/description", { method: "POST", body: JSON.stringify(data) }),

  generateMilestones: (data: { projectName: string; category: string; description?: string }) =>
    request<{ milestones: Array<{ name: string; durationDays: number }> }>("/ai/project/milestones", { method: "POST", body: JSON.stringify(data) }),

  generateBoard: (data: { projectName: string; category: string; milestones: string[]; boardType: string }) =>
    request<{ tasks: Array<{ title: string; type: string; priority: string; milestone: string; storyPoints: number; description: string }> }>("/ai/project/board", { method: "POST", body: JSON.stringify(data) }),

  generateProjectPlan: (data: { projectName: string; category: string; description?: string }) =>
    request<{ description: string; milestones: Array<{ name: string; durationDays: number }>; tasks: Array<{ title: string; type: string; priority: string; milestone: string; storyPoints: number; description: string }>; suggestedBoardType: string }>("/ai/project/plan", { method: "POST", body: JSON.stringify(data) }),

  improveText: (text: string, instruction: string) =>
    request<{ text: string }>("/ai/text/improve", { method: "POST", body: JSON.stringify({ text, instruction }) }),

  summarize: (text: string, maxLength?: number) =>
    request<{ text: string }>("/ai/text/summarize", { method: "POST", body: JSON.stringify({ text, maxLength }) }),

  generateOnboardingStructure: (data: { orgName: string; industry: string; size: string }) =>
    request<{
      departments: Array<{ name: string; code: string; description: string }>;
      designations: Array<{ title: string; level: number; track: string; department: string }>;
      teams: Array<{ name: string; department: string; description: string }>;
      suggestedRoles: Array<{ name: string; description: string }>;
      suggestedPolicies: Array<{ name: string; type: string; description: string }>;
    }>("/ai/onboarding/structure", { method: "POST", body: JSON.stringify(data) }),

  status: () => request<{ available: boolean; model: string; latencyMs: number }>("/ai/status"),
};

// ── Chat Types ──

export interface Conversation {
  _id: string;
  type: string;
  name: string;
  description?: string;
  participants: Array<{ userId: string; role: string; lastReadAt?: string; muted?: boolean }>;
  lastMessage?: { content: string; senderId: string; sentAt: string };
  guestAccess?: {
    enabled: boolean;
    guestIds: string[];
    inviteLink?: string;
    linkExpiresAt?: string;
  };
  isArchived: boolean;
  isPinned: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  replyTo?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  reactions: Array<{ emoji: string; userId: string }>;
  isEdited: boolean;
  isDeleted: boolean;
  readBy: Array<{ userId: string; readAt: string }>;
  transcription?: string;
  commandData?: {
    action?: string;
    title?: string;
    assignee?: string;
    leaveType?: string;
    start?: string;
    end?: string;
    reason?: string;
    question?: string;
    options?: string[];
  };
  threadInfo?: {
    replyCount: number;
    lastReplyAt?: string;
    participants?: string[];
  };
  createdAt: string;
}

export interface ChatSettings {
  _id: string;
  userId: string;
  readReceipts: {
    showMyReadStatus: boolean;
    showOthersReadStatus: boolean;
  };
  appearance: {
    chatBgColor: string;
    myBubbleColor: string;
    myTextColor: string;
    otherBubbleColor: string;
    otherTextColor: string;
    fontSize: string;
  };
  notifications: {
    sound: boolean;
    desktop: boolean;
    muteAll: boolean;
  };
}

export const chatApi = {
  // Conversations
  createDirect: (targetUserId: string) =>
    request<Conversation>("/chat/conversations/direct", { method: "POST", body: JSON.stringify({ targetUserId }) }),
  createGroup: (data: { name: string; description?: string; memberIds: string[] }) =>
    request<Conversation>("/chat/conversations/group", { method: "POST", body: JSON.stringify(data) }),
  createChannel: (data: { name: string; description?: string; memberIds?: string[] }) =>
    request<Conversation>("/chat/conversations/channel", { method: "POST", body: JSON.stringify(data) }),
  getConversations: () => request<Conversation[]>("/chat/conversations"),
  getConversation: (id: string) => request<Conversation>(`/chat/conversations/${id}`),
  addParticipants: (id: string, userIds: string[]) =>
    request(`/chat/conversations/${id}/participants`, { method: "POST", body: JSON.stringify({ userIds }) }),
  removeParticipant: (id: string, userId: string) =>
    request(`/chat/conversations/${id}/participants/${userId}`, { method: "DELETE" }),
  leave: (id: string) => request(`/chat/conversations/${id}/leave`, { method: "POST" }),

  // Messages
  sendMessage: (conversationId: string, content: string, type?: string, replyTo?: string) =>
    request<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
      method: "POST", body: JSON.stringify({ content, type: type || "text", replyTo }),
    }),
  getMessages: (conversationId: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<ChatMessage[]>(`/chat/conversations/${conversationId}/messages${qs}`);
  },
  editMessage: (messageId: string, content: string) =>
    request<ChatMessage>(`/chat/messages/${messageId}`, { method: "PUT", body: JSON.stringify({ content }) }),
  deleteMessage: (messageId: string) =>
    request(`/chat/messages/${messageId}`, { method: "DELETE" }),
  markAsRead: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/read`, { method: "POST" }),
  getUnread: () => request<{ count: number; unreadConversations?: Array<{ conversationId: string; count: number }> }>("/chat/unread"),
  searchMessages: (conversationId: string, query: string) =>
    request<ChatMessage[]>(`/chat/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`),
  togglePin: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/pin`, { method: "PUT" }),
  toggleMute: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/mute`, { method: "PUT" }),
  getOnlineUsers: () => request<Array<{ _id: string; firstName: string; lastName: string }>>("/chat/users/online"),
  convertToGroup: (id: string, memberIds: string[], groupName?: string) =>
    request<Conversation>(`/chat/conversations/${id}/convert-group`, { method: "POST", body: JSON.stringify({ memberIds, groupName }) }),

  // Settings
  getSettings: () => request<ChatSettings>("/chat/settings"),
  updateSettings: (data: Partial<ChatSettings>) =>
    request<ChatSettings>("/chat/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Threads
  getThreadReplies: (messageId: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{
      rootMessage: ChatMessage;
      data: ChatMessage[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/chat/threads/${messageId}${qs}`);
  },
  replyToThread: (messageId: string, content: string) =>
    request<ChatMessage>(`/chat/threads/${messageId}/reply`, { method: "POST", body: JSON.stringify({ content }) }),
  followThread: (messageId: string) =>
    request(`/chat/threads/${messageId}/follow`, { method: "POST" }),
  unfollowThread: (messageId: string) =>
    request(`/chat/threads/${messageId}/follow`, { method: "DELETE" }),

  // Presence
  setPresenceStatus: (status: string, customEmoji?: string, customText?: string) =>
    request("/chat/presence/status", { method: "PUT", body: JSON.stringify({ status, customEmoji, customText }) }),
  getPresenceBatch: (userIds: string[]) => {
    const qs = userIds.map(id => `userIds=${id}`).join("&");
    return request(`/chat/presence/batch?${qs}`);
  },
  getDndSchedule: () => request("/chat/presence/dnd"),
  updateDndSchedule: (schedule: Record<string, unknown>) =>
    request("/chat/presence/dnd", { method: "PUT", body: JSON.stringify(schedule) }),

  // Channels
  browseChannels: () => request("/chat/channels/browse"),
  joinChannel: (channelId: string) =>
    request(`/chat/channels/${channelId}/join`, { method: "POST" }),
  getChannelCategories: () => request("/chat/channels/categories"),
  createChannelCategory: (name: string) =>
    request("/chat/channels/categories", { method: "POST", body: JSON.stringify({ name }) }),

  // Pins
  pinMessage: (messageId: string) =>
    request(`/chat/messages/${messageId}/pin`, { method: "POST" }),
  unpinMessage: (messageId: string) =>
    request(`/chat/messages/${messageId}/pin`, { method: "DELETE" }),
  getPinnedMessages: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/pins`),

  // Bookmarks
  getBookmarks: () => request("/chat/bookmarks"),
  saveBookmark: (messageId: string, label?: string, note?: string) =>
    request("/chat/bookmarks", { method: "POST", body: JSON.stringify({ messageId, label, note }) }),
  removeBookmark: (bookmarkId: string) =>
    request(`/chat/bookmarks/${bookmarkId}`, { method: "DELETE" }),

  // Polls
  createPoll: (conversationId: string, question: string, options: string[], settings?: Record<string, unknown>) =>
    request("/chat/polls", { method: "POST", body: JSON.stringify({ conversationId, question, options, ...settings }) }),
  votePoll: (pollId: string, optionId: string) =>
    request(`/chat/polls/${pollId}/vote`, { method: "POST", body: JSON.stringify({ optionId }) }),
  closePoll: (pollId: string) =>
    request(`/chat/polls/${pollId}/close`, { method: "POST" }),

  // Forwarding
  forwardMessage: (messageId: string, targetConversationId: string) =>
    request(`/chat/messages/${messageId}/forward`, { method: "POST", body: JSON.stringify({ targetConversationId }) }),

  // Scheduled Messages
  scheduleMessage: (data: { conversationId: string; content: string; scheduledAt: string; type?: string }) =>
    request<ChatMessage>("/chat/scheduled", { method: "POST", body: JSON.stringify(data) }),
  getScheduledMessages: () =>
    request<Array<ChatMessage & { scheduledAt: string }>>("/chat/scheduled"),
  deleteScheduledMessage: (id: string) =>
    request(`/chat/scheduled/${id}`, { method: "DELETE" }),

  // Reminders
  createReminder: (data: { messageId: string; conversationId: string; reminderAt: string; note?: string }) =>
    request("/chat/reminders", { method: "POST", body: JSON.stringify(data) }),
  getReminders: () =>
    request<Array<{ _id: string; messageId: string; conversationId: string; reminderAt: string; note?: string }>>("/chat/reminders"),
  deleteReminder: (id: string) =>
    request(`/chat/reminders/${id}`, { method: "DELETE" }),

  // Read Status
  getReadStatus: (conversationId: string) =>
    request<Array<{ userId: string; readAt: string }>>(`/chat/conversations/${conversationId}/read-status`),

  // Commands
  getCommands: () => request<Array<{ name: string; description: string; usage: string }>>("/chat/commands"),

  // Guest Access
  enableGuestAccess: async (conversationId: string) => {
    return request<any>(`/chat/compliance/guest-access/${conversationId}/enable`, { method: 'POST' });
  },
  disableGuestAccess: async (conversationId: string) => {
    return request<any>(`/chat/compliance/guest-access/${conversationId}/disable`, { method: 'POST' });
  },
  removeGuest: async (conversationId: string, guestId: string) => {
    return request<any>(`/chat/compliance/guest-access/${conversationId}/guests/${guestId}`, { method: 'DELETE' });
  },

  // Custom Emoji
  getCustomEmoji: async () => request<any>('/chat/emoji'),
  uploadCustomEmoji: async (name: string, url: string) =>
    request<any>('/chat/emoji', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url }) }),
  deleteCustomEmoji: async (id: string) =>
    request<any>(`/chat/emoji/${id}`, { method: 'DELETE' }),

  // Clips
  createClip: async (data: { conversationId: string; mediaUrl: string; duration: number; fileSize: number; mimeType: string }) =>
    request<any>('/chat/clips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  getClip: async (clipId: string) => request<any>(`/chat/clips/${clipId}`),
  getClipTranscription: async (clipId: string) => request<any>(`/chat/clips/${clipId}/transcription`),

  // Moderation
  getFlagged: () => request("/chat/moderation/flagged"),
  reviewFlagged: (id: string, data: { status: string }) =>
    request(`/chat/moderation/flagged/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getModerationStats: () => request("/chat/moderation/stats"),

  // Smart Replies (AI)
  getSmartReplies: (conversationId: string) =>
    request<{ replies: string[] }>(`/chat/ai/smart-replies/${conversationId}`),

  // Voice Message Transcription
  transcribeVoiceMessage: (messageId: string, transcription: string) =>
    request(`/chat/voice/${messageId}/transcribe`, { method: "POST", body: JSON.stringify({ transcription }) }),
  getVoiceTranscription: (messageId: string) =>
    request<{ transcription: string | null }>(`/chat/voice/${messageId}/transcription`),

  // Translation
  translateMessage: (content: string, targetLanguage: string) =>
    request<{ translatedText: string; targetLanguage: string }>("/chat/ai/translate", {
      method: "POST",
      body: JSON.stringify({ content, targetLanguage }),
    }),

  // Analytics
  getAnalytics: async (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<any>(`/chat/analytics?${params.toString()}`);
  },

  // Chat Analytics (granular endpoints)
  getAnalyticsOverview: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/overview${qs}`);
  },
  getMessageVolume: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/volume${qs}`);
  },
  getMessagesByType: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/by-type${qs}`);
  },
  getActiveChannels: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/channels${qs}`);
  },
  getTopChatUsers: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/users${qs}`);
  },
  getPeakHours: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/peak-hours${qs}`);
  },
  getReactionStats: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/reactions${qs}`);
  },
  getResponseTimeMetrics: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/chat/analytics/response-time${qs}`);
  },
};

// ── Media API ──

export const mediaApi = {
  uploadFile: async (file: File, conversationId?: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const formData = new FormData();
    formData.append("file", file);
    if (conversationId) formData.append("conversationId", conversationId);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
    const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      credentials: "include",
    });
    return res.json();
  },

  getFile: (fileId: string) => request(`/media/files/${fileId}`),
  getDownloadUrl: (fileId: string) => request(`/media/files/${fileId}/download`),
  getPreviewUrl: (fileId: string) => request(`/media/files/${fileId}/preview`),
  getThumbnailUrl: (fileId: string) => request(`/media/files/${fileId}/thumbnail`),

  getConversationFiles: (conversationId: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/media/conversations/${conversationId}/files${qs}`);
  },

  deleteFile: (fileId: string) =>
    request(`/media/files/${fileId}`, { method: "DELETE" }),
};

// ── Upload with progress tracking (uses XMLHttpRequest for onprogress) ──

export function uploadFileWithProgress(
  file: File,
  token: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
  conversationId?: string,
): Promise<{ url: string; fileId: string; thumbnailUrl?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${API_BASE}/api/v1/media/upload`;

    // Allow aborting via AbortSignal
    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload cancelled", "AbortError"));
      }, { once: true });
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.data?.storageUrl || data.data?.url || data.url || "",
            fileId: data.data?._id || data.data?.fileId || data.fileId || "",
            thumbnailUrl: data.data?.processing?.thumbnail?.storageKey || data.data?.thumbnailUrl,
          });
        } catch {
          reject(new Error("Invalid response from upload"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload network error")));
    xhr.addEventListener("abort", () => reject(new DOMException("Upload cancelled", "AbortError")));

    const formData = new FormData();
    formData.append("file", file);
    if (conversationId) formData.append("conversationId", conversationId);

    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      xhr.setRequestHeader('X-XSRF-TOKEN', csrfToken);
    }
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

// ── Types: Organization ──

export interface OrgFeatures {
  projects?:   { enabled: boolean };
  tasks?:      { enabled: boolean };
  sprints?:    { enabled: boolean };
  timesheets?: { enabled: boolean };
  attendance?: { enabled: boolean };
  leaves?:     { enabled: boolean };
  clients?:    { enabled: boolean };
  invoices?:   { enabled: boolean };
  reports?:    { enabled: boolean };
  chat?:       { enabled: boolean };
  calls?:      { enabled: boolean };
  ai?:         { enabled: boolean };
  [key: string]: { enabled: boolean } | undefined;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  industry: string;
  size: string;
  plan: string;
  logo?: string;
  domain?: string;
  settings: { timezone: string; currency: string; dateFormat: string };
  features?: OrgFeatures;
  onboardingCompleted: boolean;
  onboardingStep: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface OrgMembership {
  _id: string;
  userId: string;
  organizationId: string;
  role: string;
  status: string;
}

// ── Organization API ──

export const orgApi = {
  create: (data: { name: string; industry?: string; size?: string; domain?: string }) =>
    request<Organization>("/auth/organizations", { method: "POST", body: JSON.stringify(data) }),
  getMyOrgs: () => request<Organization[]>("/auth/organizations/my"),
  getOrg: (id: string) => request<Organization>("/auth/organizations/" + id),
  update: (id: string, data: Partial<Organization>) =>
    request<Organization>("/auth/organizations/" + id, { method: "PUT", body: JSON.stringify(data) }),
  checkEmail: (email: string) =>
    request<Organization[]>("/auth/organizations/check-email?email=" + encodeURIComponent(email)),
  switchOrg: (orgId: string) =>
    request<{ accessToken: string; refreshToken: string }>("/auth/switch-org", { method: "POST", body: JSON.stringify({ organizationId: orgId }) }),
  invite: (orgId: string, data: { email: string; role?: string; firstName?: string; lastName?: string }) =>
    request("/auth/organizations/" + orgId + "/invite", { method: "POST", body: JSON.stringify(data) }),
  join: (orgId: string) =>
    request("/auth/organizations/" + orgId + "/join", { method: "POST" }),
  updateOnboarding: (orgId: string, data: { step: number; completed?: boolean }) =>
    request("/auth/organizations/" + orgId + "/onboarding", { method: "PUT", body: JSON.stringify(data) }),
  getMembers: (orgId: string) => request<OrgMembership[]>("/auth/organizations/" + orgId + "/members"),
  updateMemberRole: (orgId: string, memberId: string, role: string) =>
    request<ApiResponse<OrgMembership>>(`/auth/organizations/${orgId}/members/${memberId}`, { method: "PUT", body: JSON.stringify({ role }) }),
  removeMember: (orgId: string, memberId: string) =>
    request<ApiResponse<void>>(`/auth/organizations/${orgId}/members/${memberId}`, { method: "DELETE" }),
  deleteOrg: (orgId: string) =>
    request<ApiResponse<void>>(`/auth/organizations/${orgId}`, { method: "DELETE" }),
  resendInvite: (orgId: string, email: string) =>
    request(`/auth/organizations/${orgId}/resend-invite`, { method: "POST", body: JSON.stringify({ email }) }),
};

// ── Settings API ──

export const settingsApi = {
  // General
  getGeneral: () => request("/settings/general"),
  updateGeneral: (data: Record<string, unknown>) =>
    request("/settings/general", { method: "PUT", body: JSON.stringify(data) }),
  checkSlug: (slug: string) =>
    request<{ available: boolean }>("/settings/general/check-slug?slug=" + encodeURIComponent(slug)),

  // Business
  getBusiness: () => request("/settings/business"),
  updateBusiness: (data: Record<string, unknown>) =>
    request("/settings/business", { method: "PUT", body: JSON.stringify(data) }),

  // Payroll
  getPayroll: () => request("/settings/payroll"),
  updatePayroll: (data: Record<string, unknown>) =>
    request("/settings/payroll", { method: "PUT", body: JSON.stringify(data) }),

  // Work Preferences
  getWorkPreferences: () => request("/settings/work-preferences"),
  updateWorkPreferences: (data: Record<string, unknown>) =>
    request("/settings/work-preferences", { method: "PUT", body: JSON.stringify(data) }),
  addHoliday: (data: Record<string, unknown>) =>
    request("/settings/work-preferences/holidays", { method: "POST", body: JSON.stringify(data) }),
  updateHoliday: (id: string, data: Record<string, unknown>) =>
    request("/settings/work-preferences/holidays/" + id, { method: "PUT", body: JSON.stringify(data) }),
  deleteHoliday: (id: string) =>
    request("/settings/work-preferences/holidays/" + id, { method: "DELETE" }),
  addLeaveType: (data: Record<string, unknown>) =>
    request("/settings/work-preferences/leave-types", { method: "POST", body: JSON.stringify(data) }),
  updateLeaveType: (id: string, data: Record<string, unknown>) =>
    request("/settings/work-preferences/leave-types/" + id, { method: "PUT", body: JSON.stringify(data) }),
  deleteLeaveType: (id: string) =>
    request("/settings/work-preferences/leave-types/" + id, { method: "DELETE" }),

  // Branding
  getBranding: () => request("/settings/branding"),
  updateBranding: (data: Record<string, unknown>) =>
    request("/settings/branding", { method: "PUT", body: JSON.stringify(data) }),

  // Features
  getFeatures: () => request("/settings/features"),
  updateFeatures: (data: Record<string, unknown>) =>
    request("/settings/features", { method: "PUT", body: JSON.stringify(data) }),

  // Notifications
  getNotifications: () => request("/settings/notifications"),
  updateNotifications: (data: Record<string, unknown>) =>
    request("/settings/notifications", { method: "PUT", body: JSON.stringify(data) }),

  // Completeness
  getCompleteness: () => request("/settings/completeness"),
};

// ── Types: Call Log ──

export interface CallLog {
  _id: string;
  callId: string;
  initiatorId: string;
  participantIds: string[];
  type: 'audio' | 'video';
  status: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  notes?: string;
  participants?: Array<{
    userId: string;
    joinedAt?: string;
    leftAt?: string;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  }>;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Call API ──

export const callApi = {
  create: (data: { recipientId: string; type: 'audio' | 'video'; conversationId?: string }) =>
    request<CallLog>("/calls", { method: "POST", body: JSON.stringify(data) }),
  getAll: (params?: { status?: string; type?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<{ data: CallLog[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/calls/history${qs ? '?' + qs : ''}`);
  },
  getMissed: (limit?: number) =>
    request<CallLog[]>(`/calls/missed${limit ? '?limit=' + limit : ''}`),
  getIceServers: () => request('/calls/ice-servers'),
  getStats: () => request<{ totalToday: number; missedToday: number; avgDuration: number; completedToday: number }>("/calls/stats"),
  getRecent: () => request<CallLog[]>("/calls/recent"),
  getById: (id: string) => request<CallLog>(`/calls/${id}`),
  updateNotes: (id: string, notes: string) =>
    request<CallLog>(`/calls/${id}/notes`, { method: "PUT", body: JSON.stringify({ notes }) }),
};

// ── HR Call Log API (CRM call history — distinct from calling-service) ──

export interface HrCallLog {
  _id: string;
  organizationId?: string;
  callerId: string;
  receiverId: string;
  callerName?: string;
  receiverName?: string;
  type: 'audio' | 'video';
  status: 'initiated' | 'ringing' | 'answered' | 'missed' | 'declined' | 'ended' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  notes?: string;
  roomId?: string;
  createdAt: string;
  updatedAt: string;
}

export const callLogApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ data: HrCallLog[]; pagination: { page: number; limit: number; total: number; pages: number } }>("/call-logs" + qs);
  },
  getStats: (userId?: string) =>
    request<{ totalCalls: number; answeredCalls: number; missedCalls: number; totalDuration: number }>(`/call-logs/stats${userId ? "?userId=" + userId : ""}`),
  getRecent: () => request<HrCallLog[]>("/call-logs/recent"),
  getById: (id: string) => request<HrCallLog>(`/call-logs/${id}`),
  create: (data: Partial<HrCallLog>) =>
    request<HrCallLog>("/call-logs", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<HrCallLog>) =>
    request<HrCallLog>(`/call-logs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ── Types: Invoice ──

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface Invoice {
  _id: string;
  organizationId?: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string;
  templateId?: string;
  templateName?: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discount: number;
  discountType: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  status: string;
  paymentTerms: number;
  paymentMethod?: string;
  paymentNotes?: string;
  notes?: string;
  terms?: string;
  sentAt?: string;
  sentTo?: string;
  emailCount: number;
  brandName?: string;
  brandLogo?: string;
  brandAddress?: string;
  isRecurring?: boolean;
  recurringInterval?: string;
  recurringEmail?: string;
  recurringNextDate?: string;
  recurringEndDate?: string;
  isDeleted: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTemplate {
  _id: string;
  organizationId?: string;
  name: string;
  description?: string;
  defaultPaymentTerms: number;
  defaultCurrency: string;
  defaultNotes?: string;
  defaultTerms?: string;
  layout: string;
  colorScheme: string;
  showLogo: boolean;
  showTax: boolean;
  showDiscount: boolean;
  defaultItems?: Array<{ description: string; rate: number }>;
  isDefault: boolean;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceStats {
  totalCount: number;
  draftCount: number;
  sentCount: number;
  paidCount: number;
  partiallyPaidCount: number;
  overdueCount: number;
  totalRevenue: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

// ── Invoice API ──

export const invoiceApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Invoice[]>(`/invoices${qs}`);
  },
  getById: (id: string) => request<Invoice>(`/invoices/${id}`),
  create: (data: Partial<Invoice>) =>
    request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Invoice>) =>
    request<Invoice>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/invoices/${id}`, { method: "DELETE" }),
  send: (id: string, data: { email: string; subject?: string; message?: string }) =>
    request<Invoice>(`/invoices/${id}/send`, { method: "POST", body: JSON.stringify(data) }),
  markPaid: (id: string, data: { amount: number; paymentMethod?: string; paymentNotes?: string }) =>
    request<Invoice>(`/invoices/${id}/mark-paid`, { method: "POST", body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    request<Invoice>(`/invoices/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  getStats: () => request<InvoiceStats>("/invoices/stats"),
  getTemplates: () => request<InvoiceTemplate[]>("/invoices/templates"),
  createTemplate: (data: Partial<InvoiceTemplate>) =>
    request<InvoiceTemplate>("/invoices/templates", { method: "POST", body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    request(`/invoices/templates/${id}`, { method: "DELETE" }),
};

// ── Project API ──

export interface ProjectTemplate {
  _id: string;
  name: string;
  description?: string;
  organizationId: string;
  category?: string;
  methodology?: string;
  createdBy: string;
  isPublic: boolean;
  defaultSettings?: {
    boardType?: string;
    sprintDuration?: number;
    estimationUnit?: string;
    enableTimeTracking?: boolean;
    enableSubtasks?: boolean;
    enableEpics?: boolean;
    enableSprints?: boolean;
    enableReleases?: boolean;
  };
  milestoneTemplates?: Array<{
    name: string;
    description?: string;
    phase?: string;
    offsetDays: number;
    deliverables?: string[];
  }>;
  taskTemplates?: Array<{
    title: string;
    description?: string;
    type?: string;
    priority?: string;
    storyPoints?: number;
    labels?: string[];
    milestoneIndex?: number;
  }>;
  boardColumns?: Array<{
    name: string;
    statusMapping: string;
    wipLimit?: number;
    order: number;
  }>;
  teamRoles?: Array<{
    role: string;
    count: number;
    skills?: string[];
  }>;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  _id: string;
  projectName: string;
  projectKey: string;
  description?: string;
  category?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority?: string;
  methodology?: string;
  startDate?: string;
  endDate?: string;
  team: Array<{ userId: string; role: string; name?: string; email?: string; avatar?: string; allocation?: number }>;
  milestones?: Array<{ _id?: string; name: string; targetDate: string; completedDate?: string; status: string; description?: string; phase?: string; deliverables?: string[]; ownerId?: string; linkedTaskIds?: string[]; order?: number }>;
  releases?: Array<{ _id?: string; name: string; description?: string; releaseDate?: string; status: 'planned' | 'in_progress' | 'released' | 'archived'; startDate?: string; releasedDate?: string; releaseNotes?: string; issues?: string[] }>;
  visibility?: 'public' | 'private' | 'restricted';
  budget?: { amount?: number; currency?: string; billingType?: string; hourlyRate?: number; spent?: number; retainerAmount?: number };
  settings?: {
    boardType?: 'scrum' | 'kanban' | 'custom';
    clientPortalEnabled?: boolean;
    sprintDuration?: number;
    estimationUnit?: 'hours' | 'story_points';
    defaultView?: 'board' | 'list' | 'timeline' | 'calendar';
    enableTimeTracking?: boolean;
    enableSubtasks?: boolean;
    enableEpics?: boolean;
    enableSprints?: boolean;
    enableReleases?: boolean;
  };
  isDeleted?: boolean;
  healthScore?: number;
  progressPercentage?: number;
  createdBy?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const projectApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Project[]>(`/projects${qs}`);
  },
  getById: (id: string) => request<Project>(`/projects/${id}`),
  create: (data: Partial<Project>) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/projects/${id}`, { method: "DELETE" }),
  getMyProjects: () => request<Project[]>("/projects/my"),
  getStats: () => request<any>("/projects/stats"),
  getDashboard: (id: string) => request<any>(`/projects/${id}/dashboard`),
  addTeamMember: (id: string, data: { userId: string; role: string }) =>
    request<Project>(`/projects/${id}/team`, { method: "POST", body: JSON.stringify(data) }),
  removeTeamMember: (id: string, userId: string) =>
    request(`/projects/${id}/team/${userId}`, { method: "DELETE" }),
  archive: (id: string) =>
    request<Project>(`/projects/${id}/archive`, { method: "POST" }),
  addMilestone: (projectId: string, data: { name: string; description?: string; targetDate?: string; status?: string }) =>
    request(`/projects/${projectId}/milestones`, { method: "POST", body: JSON.stringify(data) }),
  updateMilestone: (projectId: string, milestoneId: string, data: Record<string, unknown>) =>
    request(`/projects/${projectId}/milestones/${milestoneId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMilestone: (projectId: string, milestoneId: string) =>
    request(`/projects/${projectId}/milestones/${milestoneId}`, { method: "DELETE" }),
  addRisk: (projectId: string, data: Record<string, unknown>) =>
    request(`/projects/${projectId}/risks`, { method: "POST", body: JSON.stringify(data) }),
  updateRisk: (projectId: string, riskId: string, data: Record<string, unknown>) =>
    request(`/projects/${projectId}/risks/${riskId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRisk: (projectId: string, riskId: string) =>
    request(`/projects/${projectId}/risks/${riskId}`, { method: "DELETE" }),
  getActivities: (projectId: string) =>
    request(`/projects/${projectId}/activities`),
  duplicateProject: (projectId: string, name: string) =>
    request(`/projects/${projectId}/duplicate`, { method: "POST", body: JSON.stringify({ projectName: name }) }),
  updateTeamMember: (projectId: string, userId: string, data: Record<string, unknown>) =>
    request(`/projects/${projectId}/team/${userId}`, { method: "PUT", body: JSON.stringify(data) }),
  updateBudget: (projectId: string, spent: number) =>
    request(`/projects/${projectId}/budget`, { method: "PUT", body: JSON.stringify({ spent }) }),
  getManagerOverview: () => request<any>("/projects/manager-overview"),

  // ── Templates ──
  getTemplates: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<ProjectTemplate[]>(`/projects/templates${qs}`);
  },
  getTemplate: (id: string) =>
    request<ProjectTemplate>(`/projects/templates/${id}`),
  createTemplate: (data: Partial<ProjectTemplate>) =>
    request<ProjectTemplate>("/projects/templates", { method: "POST", body: JSON.stringify(data) }),
  saveAsTemplate: (projectId: string, data: { name: string; description?: string; isPublic?: boolean }) =>
    request<ProjectTemplate>(`/projects/templates/from-project/${projectId}`, { method: "POST", body: JSON.stringify(data) }),
  applyTemplate: (templateId: string, data: { projectName: string; startDate?: string; description?: string; category?: string; priority?: string }) =>
    request<Project>(`/projects/templates/${templateId}/apply`, { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<ProjectTemplate>) =>
    request<ProjectTemplate>(`/projects/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    request(`/projects/templates/${id}`, { method: "DELETE" }),

  // ── Releases ──
  getReleases: (projectId: string) =>
    request<Project['releases']>(`/projects/${projectId}/releases`),
  getRelease: (projectId: string, releaseId: string) =>
    request<NonNullable<Project['releases']>[number]>(`/projects/${projectId}/releases/${releaseId}`),
};

// ── Project Reporting API ──

export interface VelocitySprint {
  sprintId: string;
  sprintName: string;
  planned: number;
  completed: number;
  carryOver: number;
  startDate: string;
  endDate: string;
  status: string;
}

export interface CumulativeFlowData {
  dates: string[];
  columns: Array<{ name: string; color: string; counts: number[] }>;
}

export interface CycleTimeData {
  tasks: Array<{ key: string; title: string; completedDate: string; cycleTimeDays: number; storyPoints: number }>;
  average: number;
  median: number;
  p90: number;
  distribution: Array<{ range: string; count: number }>;
}

export interface BurndownData {
  sprintName: string;
  totalPoints?: number;
  days: Array<{ date: string; ideal: number; actual: number | null }>;
}

export interface WorkloadMember {
  userId: string;
  logged: number;
  estimated: number;
  utilization: number;
  taskCount: number;
  completedTasks: number;
  totalPoints: number;
}

export interface BudgetUtilization {
  total: number;
  spent: number;
  remaining: number;
  currency: string;
  billingType: string;
  burnRate: number;
  projectedOverrun: number;
  byUser: Array<{ userId: string; hours: number; cost: number }>;
}

export interface CapacityMember {
  userId: string;
  currentSprint: {
    assignedPoints: number;
    completedPoints: number;
    assignedTasks: number;
    completedTasks: number;
  };
  timeTracking: {
    loggedHoursThisWeek: number;
    loggedHoursThisSprint: number;
    dailyHoursThisWeek: number[];
  };
  taskBreakdown: {
    todo: number;
    inProgress: number;
    inReview: number;
    blocked: number;
    done: number;
  };
  utilizationPercent: number;
}

export interface CapacityData {
  members: CapacityMember[];
  sprintCapacity: {
    totalPoints: number;
    committedPoints: number;
    completedPoints: number;
    remainingDays: number;
    sprintName: string | null;
    sprintId: string | null;
  };
  unassignedTasks: Array<{
    _id: string;
    taskKey?: string;
    title: string;
    storyPoints: number;
    status: string;
  }>;
}

export interface OverviewStats {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalPoints: number;
  completedPoints: number;
  avgCycleTime: number;
  statusBreakdown: Record<string, number>;
}

export const reportingApi = {
  getVelocity: (projectId: string) =>
    request<{ sprints: VelocitySprint[] }>(`/tasks/reports/${projectId}/velocity`),
  getCumulativeFlow: (projectId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<CumulativeFlowData>(`/tasks/reports/${projectId}/cumulative-flow${qs}`);
  },
  getCycleTime: (projectId: string) =>
    request<CycleTimeData>(`/tasks/reports/${projectId}/cycle-time`),
  getBurndown: (projectId: string, sprintId: string) =>
    request<BurndownData>(`/tasks/reports/${projectId}/burndown/${sprintId}`),
  getWorkload: (projectId: string) =>
    request<{ members: WorkloadMember[] }>(`/tasks/reports/${projectId}/workload`),
  getEpicProgress: (projectId: string) =>
    request<{ epics: any[] }>(`/tasks/reports/${projectId}/epic-progress`),
  getCapacity: (projectId: string, sprintId?: string) => {
    const qs = sprintId ? `?sprintId=${sprintId}` : '';
    return request<CapacityData>(`/tasks/reports/${projectId}/capacity${qs}`);
  },
  getOverview: (projectId: string) =>
    request<OverviewStats>(`/tasks/reports/${projectId}/overview`),
  getBudget: (projectId: string) =>
    request<BudgetUtilization>(`/projects/${projectId}/reports/budget`),
};

// ── Task API ──

export interface Task {
  _id: string;
  taskKey?: string;
  projectKey?: string;
  title: string;
  description?: string;
  projectId: string;
  type: 'epic' | 'story' | 'task' | 'sub_task' | 'bug' | 'improvement' | 'spike';
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low' | 'trivial';
  assigneeId?: string;
  reporterId?: string;
  parentTaskId?: string;
  boardId?: string;
  columnId?: string;
  sprintId?: string;
  storyPoints?: number;
  estimatedHours?: number;
  loggedHours?: number;
  dueDate?: string;
  labels?: string[];
  comments?: Array<{ _id?: string; userId: string; content: string; createdAt: string; isEdited?: boolean; reactions?: Array<{ emoji: string; userIds: string[] }> }>;
  attachments?: Array<{ name: string; url: string }>;
  resolution?: string;
  isFlagged?: boolean;
  watchers?: string[];
  votes?: string[];
  components?: string[];
  fixVersion?: string;
  environment?: string;
  originalEstimate?: number;
  remainingEstimate?: number;
  recurrence?: {
    enabled: boolean;
    rule?: string;
    frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string;
    maxOccurrences?: number;
    occurrenceCount?: number;
    lastGeneratedAt?: string;
  };
  isRecurringInstance?: boolean;
  recurringParentId?: string;
  organizationId?: string;
  dependencies?: Array<{ itemId: string; type: string }>;
  gitLinks?: Array<{
    _id?: string;
    type: 'commit' | 'pull_request' | 'branch';
    provider: 'github' | 'gitlab' | 'bitbucket';
    url: string;
    title: string;
    status?: string;
    author: string;
    authorAvatar?: string;
    sha?: string;
    number?: number;
    repository: string;
    branch?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const taskApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Task[]>(`/tasks${qs}`);
  },
  getById: (id: string) => request<Task>(`/tasks/${id}`),
  create: (data: Partial<Task>) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/tasks/${id}`, { method: "DELETE" }),
  getMyTasks: () => request<Task[]>("/tasks/my"),
  getMyStats: () => request<{
    thisWeek: {
      tasksCompleted: number;
      tasksCreated: number;
      storyPointsDelivered: number;
      hoursLogged: number;
      avgCycleTimeDays: number;
    };
    lastWeek: {
      tasksCompleted: number;
      storyPointsDelivered: number;
      hoursLogged: number;
      avgCycleTimeDays: number;
    };
    trends: {
      tasksCompletedChange: number;
      pointsDeliveredChange: number;
      cycleTimeChange: number;
    };
    streak: {
      currentDays: number;
      longestDays: number;
      lastActiveDate: string | null;
    };
    thisSprint: {
      assignedTasks: number;
      completedTasks: number;
      assignedPoints: number;
      completedPoints: number;
      completionRate: number;
      sprintName: string;
    };
    allTime: {
      totalTasksCompleted: number;
      totalPointsDelivered: number;
      totalHoursLogged: number;
      avgCycleTimeDays: number;
      topProject: { projectId: string; tasksCompleted: number };
    };
  }>("/tasks/my-stats"),
  getMyWork: () => request<{
    overdue: Task[];
    dueToday: Task[];
    inProgress: Task[];
    readyToStart: Task[];
    blocked: Task[];
    upcomingThisSprint: Task[];
    recentlyCompleted: Task[];
  }>("/tasks/my-work"),
  getStats: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return request<any>(`/tasks/stats${qs}`);
  },
  updateStatus: (id: string, status: string) =>
    request<Task>(`/tasks/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  addComment: (id: string, content: string) =>
    request<Task>(`/tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  updateComment: (id: string, commentId: string, content: string) =>
    request<Task>(`/tasks/${id}/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ content }) }),
  deleteComment: (id: string, commentId: string) =>
    request<Task>(`/tasks/${id}/comments/${commentId}`, { method: "DELETE" }),
  toggleReaction: (id: string, commentId: string, emoji: string) =>
    request<Task>(`/tasks/${id}/comments/${commentId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }),
  logTime: (id: string, data: { hours: number; date: string; description?: string; category?: string }) =>
    request<Task>(`/tasks/${id}/time-entries`, { method: "POST", body: JSON.stringify(data) }),
  getChildren: (id: string) => request<Task[]>(`/tasks/${id}/children`),
  getProjectAnalytics: (projectId: string) => request<any>(`/tasks/analytics?projectId=${projectId}`),
  addDependency: (id: string, itemId: string, type: string) =>
    request<Task>(`/tasks/${id}/dependencies`, { method: "POST", body: JSON.stringify({ itemId, type }) }),
  removeDependency: (id: string, depItemId: string) =>
    request<Task>(`/tasks/${id}/dependencies/${depItemId}`, { method: "DELETE" }),
  getProjectActivity: (projectId: string, limit = 50) =>
    request<ActivityLog[]>(`/tasks/activity/${projectId}?limit=${limit}`),
  bulkUpdate: (data: { taskIds: string[]; assigneeId?: string; priority?: string; status?: string; sprintId?: string; addLabels?: string[]; removeLabels?: string[] }) =>
    request<{ updated: number }>(`/tasks/bulk`, { method: "PUT", body: JSON.stringify(data) }),
  toggleFlag: (id: string) =>
    request<Task>(`/tasks/${id}/flag`, { method: "POST" }),
  toggleWatch: (id: string) =>
    request<Task>(`/tasks/${id}/watch`, { method: "POST" }),
  toggleVote: (id: string) =>
    request<Task>(`/tasks/${id}/vote`, { method: "POST" }),
  duplicate: (id: string) =>
    request<Task>(`/tasks/${id}/duplicate`, { method: "POST" }),
  setRecurrence: (id: string, data: {
    frequency: string;
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string;
    maxOccurrences?: number;
    rule?: string;
  }) => request<Task>(`/tasks/${id}/recurrence`, { method: "POST", body: JSON.stringify(data) }),
  stopRecurrence: (id: string) =>
    request<Task>(`/tasks/${id}/recurrence`, { method: "DELETE" }),
  getRecurringTasks: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return request<Task[]>(`/tasks/recurring${qs}`);
  },
  getRecurringInstances: (id: string) =>
    request<Task[]>(`/tasks/${id}/recurrence/instances`),
  getGitLinks: (id: string) =>
    request<Task['gitLinks']>(`/tasks/${id}/git-links`),

  // Import / Export
  exportTasks: async (projectId: string, format: 'csv' | 'json', filters?: Record<string, string>) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const params = new URLSearchParams({ projectId, format, ...filters });
    const res = await fetch(`${API_BASE}/api/v1/tasks/export?${params.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },

  importTasks: async (projectId: string, file: File, projectKey?: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (projectKey) formData.append('projectKey', projectKey);
    const res = await fetch(`${API_BASE}/api/v1/tasks/import`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Import failed');
    }
    return res.json();
  },

  getImportTemplate: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const res = await fetch(`${API_BASE}/api/v1/tasks/import/template`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to get template');
    return res.blob();
  },

  // Custom Fields
  createCustomField: (data: CustomFieldInput) =>
    request<CustomField>(`/tasks/custom-fields`, { method: "POST", body: JSON.stringify(data) }),
  listCustomFields: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return request<CustomField[]>(`/tasks/custom-fields${qs}`);
  },
  getCustomField: (id: string) =>
    request<CustomField>(`/tasks/custom-fields/${id}`),
  updateCustomField: (id: string, data: Partial<CustomFieldInput>) =>
    request<CustomField>(`/tasks/custom-fields/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCustomField: (id: string) =>
    request(`/tasks/custom-fields/${id}`, { method: "DELETE" }),

  // Automation Rules
  createAutomationRule: (data: AutomationRuleInput) =>
    request<AutomationRule>(`/tasks/automation-rules`, { method: "POST", body: JSON.stringify(data) }),
  listAutomationRules: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return request<AutomationRule[]>(`/tasks/automation-rules${qs}`);
  },
  getAutomationRule: (id: string) =>
    request<AutomationRule>(`/tasks/automation-rules/${id}`),
  updateAutomationRule: (id: string, data: Partial<AutomationRuleInput>) =>
    request<AutomationRule>(`/tasks/automation-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggleAutomationRule: (id: string) =>
    request<AutomationRule>(`/tasks/automation-rules/${id}/toggle`, { method: "POST" }),
  deleteAutomationRule: (id: string) =>
    request(`/tasks/automation-rules/${id}`, { method: "DELETE" }),
  testAutomationRule: (id: string, sampleTaskId: string) =>
    request<AutomationRuleTestResult>(`/tasks/automation-rules/${id}/test`, {
      method: "POST",
      body: JSON.stringify({ sampleTaskId }),
    }),
};

// ── Custom Field & Automation Rule Types ──

export interface CustomFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface CustomFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'multi_select'
  | 'checkbox'
  | 'url'
  | 'user'
  | 'currency'
  | 'percentage';

export interface CustomFieldInput {
  name: string;
  key: string;
  type: CustomFieldType;
  projectId?: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: CustomFieldOption[];
  validation?: CustomFieldValidation;
  appliesTo?: 'all' | 'project_specific' | 'task_type';
  taskTypes?: string[];
  displayOrder?: number;
  showInList?: boolean;
  showInDetail?: boolean;
}

export interface CustomField extends CustomFieldInput {
  _id: string;
  organizationId: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AutomationEvent =
  | 'task_created'
  | 'task_updated'
  | 'status_changed'
  | 'assignee_changed'
  | 'priority_changed'
  | 'due_date_approaching'
  | 'comment_added'
  | 'field_changed';

export type AutomationOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'is_empty'
  | 'is_not_empty';

export type AutomationActionType =
  | 'change_status'
  | 'assign_to'
  | 'set_priority'
  | 'add_label'
  | 'remove_label'
  | 'add_comment'
  | 'send_notification'
  | 'create_subtask'
  | 'set_due_date'
  | 'set_field';

export interface AutomationCondition {
  field: string;
  operator: AutomationOperator;
  value?: unknown;
}

export interface AutomationAction {
  type: AutomationActionType;
  params?: Record<string, unknown>;
}

export interface AutomationRuleInput {
  name: string;
  projectId?: string;
  description?: string;
  enabled?: boolean;
  trigger: {
    event: AutomationEvent;
    conditions?: AutomationCondition[];
  };
  actions: AutomationAction[];
}

export interface AutomationRule extends AutomationRuleInput {
  _id: string;
  organizationId: string;
  runCount: number;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failure' | 'skipped';
  lastRunError?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleTestResult {
  ruleId: string;
  ruleName: string;
  sampleTaskId: string;
  conditionsMatch: boolean;
  wouldExecute: boolean;
  actions: AutomationAction[];
  dryRun: boolean;
}

// ── Timesheet Types & API ──

export interface TimesheetEntry {
  taskId: string;
  taskKey?: string;
  taskTitle?: string;
  projectId: string;
  projectName?: string;
  hours: number;
  date: string;
  description?: string;
  category?: string;
}

export interface Timesheet {
  _id: string;
  userId: string;
  organizationId: string;
  period: { startDate: string; endDate: string; type: string };
  entries: TimesheetEntry[];
  totalHours: number;
  expectedHours?: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'revision_requested';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  approvedByDelegateId?: string;
  delegatorId?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalDelegation {
  _id: string;
  delegatorId: string;
  delegateId: string;
  organizationId: string;
  type: 'temporary' | 'permanent' | 'project_specific';
  projectId?: string;
  reason: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  autoExpire: boolean;
  createdAt: string;
  updatedAt: string;
}

export const timesheetApi = {
  getMyTimesheets: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Timesheet[]>(`/timesheets/my${qs}`);
  },
  getPendingTimesheets: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Timesheet[]>(`/timesheets/pending${qs}`);
  },
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Timesheet[]>(`/timesheets${qs}`);
  },
  getById: (id: string) => request<Timesheet>(`/timesheets/${id}`),
  create: (data: { period: { startDate: string; endDate: string; type: string }; entries?: TimesheetEntry[] }) =>
    request<Timesheet>("/timesheets", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Timesheet>) =>
    request<Timesheet>(`/timesheets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/timesheets/${id}`, { method: "DELETE" }),
  autoPopulate: (data: { startDate: string; endDate: string }) =>
    request<TimesheetEntry[]>("/timesheets/auto-populate", { method: "POST", body: JSON.stringify(data) }),
  submit: (id: string) =>
    request<Timesheet>(`/timesheets/${id}/submit`, { method: "POST" }),
  review: (id: string, data: { status: string; reviewComment?: string }) =>
    request<Timesheet>(`/timesheets/${id}/review`, { method: "PUT", body: JSON.stringify(data) }),
  getStats: () => request<any>("/timesheets/stats"),
  createDelegation: (data: {
    delegateId: string;
    type: string;
    projectId?: string;
    reason?: string;
    startDate: string;
    endDate?: string;
    autoExpire?: boolean;
  }) => request<ApprovalDelegation>("/timesheets/delegations", { method: "POST", body: JSON.stringify(data) }),
  getMyDelegations: () => request<ApprovalDelegation[]>("/timesheets/delegations/my"),
  getDelegatedToMe: () => request<ApprovalDelegation[]>("/timesheets/delegations/to-me"),
  revokeDelegation: (id: string) => request<ApprovalDelegation>(`/timesheets/delegations/${id}`, { method: "DELETE" }),
  getAutoRules: () => request<ApprovalDelegation[]>("/timesheets/delegations/auto-rules"),
};

// ── Billing Rate & Timesheet-to-Invoice Bridge ──

export interface BillingRate {
  _id: string;
  organizationId?: string;
  projectId: string;
  type: 'project_default' | 'role_based' | 'user_specific';
  role?: string;
  userId?: string;
  userName?: string;
  hourlyRate: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isDeleted: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePreviewLineItem {
  projectId: string;
  projectName: string;
  personId: string;
  personName: string;
  hours: number;
  rate: number;
  currency: string;
  amount: number;
}

export interface InvoicePreview {
  timesheetIds: string[];
  lineItems: InvoicePreviewLineItem[];
  projectSubtotals: Array<{ projectName: string; hours: number; amount: number }>;
  grandTotal: number;
  totalHours: number;
  currency: string;
  suggestedClientId: string | null;
}

export interface GenerateInvoiceResult {
  invoice: Invoice;
  preview: InvoicePreview;
}

export const billingApi = {
  // Billing rates
  getRates: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return request<BillingRate[]>(`/billing/rates${qs}`);
  },
  createRate: (data: {
    projectId: string;
    type: string;
    role?: string;
    userId?: string;
    userName?: string;
    hourlyRate: number;
    currency?: string;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => request<BillingRate>("/billing/rates", { method: "POST", body: JSON.stringify(data) }),
  updateRate: (id: string, data: Partial<BillingRate>) =>
    request<BillingRate>(`/billing/rates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRate: (id: string) =>
    request(`/billing/rates/${id}`, { method: "DELETE" }),

  // Invoice preview & generation from timesheets
  previewInvoice: (timesheetIds: string[]) =>
    request<InvoicePreview>("/billing/preview", { method: "POST", body: JSON.stringify({ timesheetIds }) }),
  generateInvoice: (data: {
    timesheetIds: string[];
    clientId?: string;
    dueDate?: string;
    currency?: string;
    notes?: string;
  }) => request<GenerateInvoiceResult>("/billing/generate-invoice", { method: "POST", body: JSON.stringify(data) }),
};

// ── Activity Log ──

export interface ActivityLog {
  _id: string;
  projectId: string;
  boardId?: string;
  taskId?: string;
  sprintId?: string;
  action: string;
  actorId: string;
  actorName?: string;
  entityType: string;
  entityTitle?: string;
  details?: Record<string, any>;
  createdAt: string;
}

// ── Board API ──

export interface BoardColumn {
  _id?: string;
  id?: string;
  name: string;
  key: string;
  order: number;
  wipLimit?: number;
  statusMapping?: string[];
  color?: string;
  isDoneColumn?: boolean;
  isStartColumn?: boolean;
  isCollapsed?: boolean;
}

export interface Board {
  _id: string;
  name: string;
  description?: string;
  projectId: string;
  type: 'scrum' | 'kanban' | 'bug_tracker' | 'custom';
  columns: BoardColumn[];
  isDefault?: boolean;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const boardApi = {
  getByProject: (projectId: string) => request<Board[]>(`/boards/project/${projectId}`),
  getById: (id: string) => request<Board>(`/boards/${id}`),
  create: (data: Partial<Board>) =>
    request<Board>("/boards", { method: "POST", body: JSON.stringify(data) }),
  createFromTemplate: (data: { projectId: string; templateId: string }) =>
    request<Board>("/boards/from-template", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Board>) =>
    request<Board>(`/boards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/boards/${id}`, { method: "DELETE" }),
  getTemplates: () => request<any[]>("/boards/templates"),
  addColumn: (id: string, data: Partial<BoardColumn>) =>
    request<Board>(`/boards/${id}/columns`, { method: "POST", body: JSON.stringify(data) }),
  updateColumn: (id: string, columnId: string, data: Partial<BoardColumn>) =>
    request<Board>(`/boards/${id}/columns/${columnId}`, { method: "PUT", body: JSON.stringify(data) }),
  removeColumn: (id: string, columnId: string) =>
    request<Board>(`/boards/${id}/columns/${columnId}`, { method: "DELETE" }),
  reorderColumns: (id: string, columnIds: string[]) =>
    request<Board>(`/boards/${id}/columns/reorder`, { method: "PUT", body: JSON.stringify({ columnIds }) }),
  moveTask: (boardId: string, taskId: string, data: { fromColumnId: string; toColumnId: string; newIndex?: number }) =>
    request(`/boards/${boardId}/tasks/${taskId}/move`, { method: "PUT", body: JSON.stringify(data) }),
  reorderTasks: (boardId: string, taskIds: string[], columnId?: string, sprintId?: string) =>
    request<Task[]>(`/boards/${boardId}/tasks/reorder`, {
      method: "PUT",
      body: JSON.stringify({ taskIds, columnId, sprintId }),
    }),
};

// ── Sprint API ──

export interface Sprint {
  _id: string;
  name: string;
  boardId: string;
  projectId: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status: 'planning' | 'active' | 'completed';
  taskIds?: string[];
  velocity?: number;
  plannedPoints?: number;
  completedPoints?: number;
  spilloverPoints?: number;
  spilloverTaskIds?: string[];
  carryOverPoints?: number;
  carryOverTaskIds?: string[];
  carriedFromSprintId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const sprintApi = {
  getByBoard: (boardId: string) => request<Sprint[]>(`/sprints/board/${boardId}`),
  getByProject: (projectId: string) => request<Sprint[]>(`/sprints/project/${projectId}`),
  getActive: (boardId: string) => request<Sprint>(`/sprints/board/${boardId}/active`),
  getById: (id: string) => request<Sprint>(`/sprints/${id}`),
  create: (data: Partial<Sprint>) =>
    request<Sprint>("/sprints", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Sprint>) =>
    request<Sprint>(`/sprints/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  start: (id: string) =>
    request<Sprint>(`/sprints/${id}/start`, { method: "POST" }),
  complete: (id: string, data: { moveUnfinishedTo: 'backlog' | 'next_sprint' }) =>
    request<Sprint>(`/sprints/${id}/complete`, { method: "POST", body: JSON.stringify(data) }),
  addTasks: (id: string, taskIds: string[]) =>
    request<Sprint>(`/sprints/${id}/tasks`, { method: "POST", body: JSON.stringify({ taskIds }) }),
  removeTask: (id: string, taskId: string) =>
    request(`/sprints/${id}/tasks/${taskId}`, { method: "DELETE" }),
  getDetails: (id: string) => request<any>(`/sprints/${id}/details`),
  getBurndown: (id: string) => request<any>(`/sprints/${id}/burndown`),
};

// ── Platform Admin API ──

// ── Meeting API ──

export interface Meeting {
  _id: string;
  meetingId: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  hostId: string;
  hostName: string;
  participantIds: string[];
  participants: {
    userId?: string;
    displayName: string;
    isAnonymous: boolean;
    joinedAt?: string;
    leftAt?: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
  }[];
  status: "scheduled" | "active" | "ended" | "cancelled";
  recordingEnabled: boolean;
  isRecording: boolean;
  recordingStartedAt?: string;
  transcript: {
    speakerId: string;
    speakerName: string;
    text: string;
    timestamp: string;
  }[];
  startedAt?: string;
  endedAt?: string;
  sprintId?: string;
  organizationId: string;
  createdAt: string;
}

export const meetingApi = {
  schedule: (data: {
    title: string;
    description?: string;
    scheduledAt: string | Date;
    durationMinutes?: number;
    participantIds?: string[];
    recordingEnabled?: boolean;
    sprintId?: string;
  }) =>
    request<Meeting>("/meetings", { method: "POST", body: JSON.stringify(data) }),

  list: (params?: { status?: string; sprintId?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return request<Meeting[]>(`/meetings${qs}`);
  },

  get: (meetingId: string) => request<Meeting>(`/meetings/${meetingId}`),

  getPublic: (meetingId: string) =>
    request<Partial<Meeting>>(`/meetings/${meetingId}/public`),

  update: (meetingId: string, data: Partial<Meeting>) =>
    request<Meeting>(`/meetings/${meetingId}`, { method: "PUT", body: JSON.stringify(data) }),

  start: (meetingId: string) =>
    request<Meeting>(`/meetings/${meetingId}/start`, { method: "POST" }),

  end: (meetingId: string) =>
    request<Meeting>(`/meetings/${meetingId}/end`, { method: "POST" }),

  cancel: (meetingId: string) =>
    request(`/meetings/${meetingId}`, { method: "DELETE" }),

  toggleRecording: (meetingId: string, start: boolean) =>
    request<Meeting>(`/meetings/${meetingId}/recording`, { method: "POST", body: JSON.stringify({ start }) }),

  getTranscript: (meetingId: string) =>
    request<Meeting["transcript"]>(`/meetings/${meetingId}/transcript`),

  getBySprint: (sprintId: string) =>
    request<Meeting[]>(`/meetings/sprint/${sprintId}`),

  // Live Captions
  toggleCaptions: (meetingId: string, enabled: boolean) =>
    request<{ enabled: boolean; serverTranscriptionAvailable: boolean }>(
      `/meetings/${meetingId}/captions/toggle`, { method: "POST", body: JSON.stringify({ enabled }) },
    ),
  getCaptionsStatus: (meetingId: string) =>
    request<{ enabled: boolean; serverTranscriptionAvailable: boolean; captionUsers: string[] }>(
      `/meetings/${meetingId}/captions/status`,
    ),
  submitCaptionChunk: (meetingId: string, audioData: string, language?: string, speakerName?: string) =>
    request(`/meetings/${meetingId}/captions/chunk`, {
      method: "POST",
      body: JSON.stringify({ audioData, language, speakerName }),
    }),
};

export const platformApi = {
  getOrganizations: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    request<any[]>(`/platform/organizations?${new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`),
  getOrganization: (id: string) => request<any>(`/platform/organizations/${id}`),
  suspendOrganization: (id: string) => request<any>(`/platform/organizations/${id}/suspend`, { method: 'POST' }),
  activateOrganization: (id: string) => request<any>(`/platform/organizations/${id}/activate`, { method: 'POST' }),
  updateOrganizationPlan: (id: string, plan: string) => request<any>(`/platform/organizations/${id}/plan`, { method: 'PUT', body: JSON.stringify({ plan }) }),
  updateOrganizationFeatures: (id: string, features: Record<string, { enabled: boolean }>) =>
    request<any>(`/platform/organizations/${id}/features`, { method: 'PUT', body: JSON.stringify({ features }) }),
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    request<any[]>(`/platform/users?${new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`),
  getUser: (id: string) => request<any>(`/platform/users/${id}`),
  disableUser: (id: string) => request<any>(`/platform/users/${id}/disable`, { method: 'POST' }),
  enableUser: (id: string) => request<any>(`/platform/users/${id}/enable`, { method: 'POST' }),
  resetUserAuth: (id: string) => request<any>(`/platform/users/${id}/reset-auth`, { method: 'POST' }),
  getAnalytics: () => request<any>('/platform/analytics'),
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; targetType?: string }) =>
    request<any[]>(`/platform/audit-logs?${new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`),

  // Reporting APIs
  generateReport: (data: { type: string; format: 'pdf' | 'excel' | 'csv'; startDate?: string; endDate?: string; fields?: string[] }) =>
    request<Blob>('/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
  getReportTemplates: () => request<any[]>('/reports/templates'),
  getReportTemplate: (templateId: string) => request<any>(`/reports/templates/${templateId}`),
  createReportTemplate: (data: { name: string; description: string; type: string; format: 'pdf' | 'excel' | 'csv'; filters?: Record<string, unknown> }) =>
    request<any>('/reports/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateReportTemplate: (templateId: string, data: any) =>
    request<any>(`/reports/templates/${templateId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReportTemplate: (templateId: string) =>
    request(`/reports/templates/${templateId}`, { method: 'DELETE' }),
  scheduleReport: (data: { templateId: string; recipients: string[]; schedule: 'daily' | 'weekly' | 'monthly' }) =>
    request<any>('/reports/schedule', { method: 'POST', body: JSON.stringify(data) }),
  getScheduledReports: () => request<any[]>('/reports/scheduled'),
  updateScheduledReport: (reportId: string, data: any) =>
    request<any>(`/reports/scheduled/${reportId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteScheduledReport: (reportId: string) =>
    request(`/reports/scheduled/${reportId}`, { method: 'DELETE' }),
  executeScheduledReport: (reportId: string) =>
    request<Blob>(`/reports/scheduled/${reportId}/execute`, { method: 'POST' }),
};

// ── Chat Moderation ──

export const moderationApi = {
  getFlagged: () => request<any[]>('/chat/moderation/flagged'),
  reviewFlagged: (id: string, data: { status: string; action?: string }) =>
    request<any>(`/chat/moderation/flagged/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getStats: () => request<any>('/chat/moderation/stats'),
};

// ── Chat Compliance ──

export const complianceApi = {
  // Retention
  getRetentionPolicies: () => request<any[]>('/chat/compliance/retention'),
  createRetentionPolicy: (data: any) =>
    request<any>('/chat/compliance/retention', { method: 'POST', body: JSON.stringify(data) }),
  updateRetentionPolicy: (id: string, data: any) =>
    request<any>(`/chat/compliance/retention/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRetentionPolicy: (id: string) =>
    request(`/chat/compliance/retention/${id}`, { method: 'DELETE' }),

  // DLP
  getDlpRules: () => request<any[]>('/chat/compliance/dlp'),
  createDlpRule: (data: any) =>
    request<any>('/chat/compliance/dlp', { method: 'POST', body: JSON.stringify(data) }),
  updateDlpRule: (id: string, data: any) =>
    request<any>(`/chat/compliance/dlp/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDlpRule: (id: string) =>
    request(`/chat/compliance/dlp/${id}`, { method: 'DELETE' }),
  getBuiltinPatterns: () => request<any[]>('/chat/compliance/dlp/patterns'),

  // eDiscovery
  searchEdiscovery: (params: { q?: string; from?: string; conversationId?: string; before?: string; after?: string; page?: number }) =>
    request<any>(`/chat/compliance/ediscovery/search?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`),
  exportEdiscovery: (data: any) =>
    request<any>('/chat/compliance/ediscovery/export', { method: 'POST', body: JSON.stringify(data) }),

  // Legal Holds
  getLegalHolds: () => request<any[]>('/chat/compliance/legal-holds'),
  createLegalHold: (data: any) =>
    request<any>('/chat/compliance/legal-holds', { method: 'POST', body: JSON.stringify(data) }),
  releaseLegalHold: (id: string) =>
    request<any>(`/chat/compliance/legal-holds/${id}/release`, { method: 'POST' }),
};

// ── Chat Analytics ──

export const chatAnalyticsApi = {
  getInsights: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<any>(`/chat/analytics?${params.toString()}`);
  },
};

// ── Chat Webhooks ──

// ── Client Portal API ──

export interface ClientPortalData {
  projectName: string;
  projectKey: string;
  description: string;
  status: string;
  progressPercentage: number;
  healthScore: number;
  startDate?: string;
  endDate?: string;
  milestones: Array<{
    _id: string;
    name: string;
    status: string;
    targetDate: string;
    completedDate?: string;
    phase?: string;
    deliverables: string[];
    description: string;
  }>;
  releases: Array<{
    _id: string;
    name: string;
    status: string;
    releaseDate?: string;
    description: string;
  }>;
  budget: {
    total: number;
    spent: number;
    remaining: number;
    currency: string;
    utilizationPercent: number;
    burnRate: number;
  };
  recentUpdates: Array<{
    date: string;
    title: string;
    description: string;
  }>;
  team: Array<{
    role: string;
    userId: string;
  }>;
}

export interface ClientFeedbackItem {
  _id: string;
  projectId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  type: 'bug' | 'feature' | 'question' | 'general';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'new' | 'reviewed' | 'in_progress' | 'completed' | 'closed';
  attachments?: Array<{ url: string; name: string; type: string; size: number }>;
  taskKey?: string;
  createdAt: string;
  updatedAt: string;
}

export const clientPortalApi = {
  getPortalData: (projectId: string) =>
    request<ClientPortalData>(`/projects/${projectId}/client-portal`),
  getFeedback: (projectId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ClientFeedbackItem[]>(`/projects/${projectId}/client-portal/feedback${qs}`);
  },
  submitFeedback: (projectId: string, data: {
    clientId: string;
    clientName: string;
    clientEmail: string;
    type: 'bug' | 'feature' | 'question' | 'general';
    title: string;
    description: string;
    priority?: 'low' | 'medium' | 'high';
  }) =>
    request<ClientFeedbackItem>(`/projects/${projectId}/client-portal/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  togglePortal: (projectId: string, enabled: boolean) =>
    request<Project>(`/projects/${projectId}/client-portal/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),
};

export const webhookApi = {
  getWebhooks: () => request<any[]>('/chat/webhooks'),
  createOutgoing: (data: { conversationId: string; name: string; targetUrl: string; events: string[] }) =>
    request<any>('/chat/webhooks/outgoing', { method: 'POST', body: JSON.stringify(data) }),
  createIncoming: (data: { conversationId: string; name: string; avatarUrl?: string }) =>
    request<any>('/chat/webhooks/incoming', { method: 'POST', body: JSON.stringify(data) }),
  deleteWebhook: (id: string) =>
    request(`/chat/webhooks/${id}`, { method: 'DELETE' }),
  toggleWebhook: (id: string) =>
    request<any>(`/chat/webhooks/${id}/toggle`, { method: 'POST' }),
};

// ── Git Integration API ──

export interface GitIntegrationConfig {
  provider: 'github' | 'gitlab' | 'bitbucket';
  webhookUrl: string;
  webhookSecret: string;
  isActive: boolean;
  autoTransition: boolean;
  autoTransitionTarget: string;
  lastWebhookAt?: string;
  createdAt: string;
}

export const integrationApi = {
  setupGit: (data: { provider: string; autoTransition?: boolean; autoTransitionTarget?: string }) =>
    request<GitIntegrationConfig>('/integrations/git/setup', { method: 'POST', body: JSON.stringify(data) }),
  getGitConfig: () =>
    request<GitIntegrationConfig[]>('/integrations/git/config'),
  removeGitConfig: (provider?: string) =>
    request('/integrations/git/config' + (provider ? `?provider=${provider}` : ''), { method: 'DELETE' }),
};

export const payrollApi = {
  // Salary Structures
  createSalaryStructure: (data: Record<string, unknown>) =>
    request("/salary-structures", { method: "POST", body: JSON.stringify(data) }),
  getSalaryStructure: (employeeId: string) =>
    request(`/salary-structures/${employeeId}`),
  getSalaryHistory: (employeeId: string) =>
    request(`/salary-structures/${employeeId}/history`),
  updateSalaryStructure: (id: string, data: Record<string, unknown>) =>
    request(`/salary-structures/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  submitForApproval: (id: string) =>
    request(`/salary-structures/${id}/submit`, { method: "POST" }),
  approveSalaryStructure: (id: string) =>
    request(`/salary-structures/${id}/approve`, { method: "POST" }),
  rejectSalaryStructure: (id: string, reason?: string) =>
    request(`/salary-structures/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  simulateCTC: (ctc: number, employeeId?: string) =>
    request("/salary-structures/simulate", { method: "POST", body: JSON.stringify({ ctc, employeeId }) }),

  // Payroll Runs
  initiateRun: (month: number, year: number) =>
    request("/payroll-runs", { method: "POST", body: JSON.stringify({ month, year }) }),
  getRuns: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/payroll-runs${qs}`);
  },
  getRun: (id: string) => request(`/payroll-runs/${id}`),
  processRun: (id: string) =>
    request(`/payroll-runs/${id}/process`, { method: "POST" }),
  updateRunStatus: (id: string, data: { status: string; notes?: string; paymentReference?: string }) =>
    request(`/payroll-runs/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),
  getRunEntries: (id: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/payroll-runs/${id}/entries${qs}`);
  },
  getRunEntry: (runId: string, employeeId: string) =>
    request(`/payroll-runs/${runId}/entries/${employeeId}`),
  overrideEntry: (runId: string, employeeId: string, data: Record<string, unknown>) =>
    request(`/payroll-runs/${runId}/entries/${employeeId}`, { method: "PUT", body: JSON.stringify(data) }),
  holdEntry: (runId: string, employeeId: string, reason: string) =>
    request(`/payroll-runs/${runId}/entries/${employeeId}/hold`, { method: "POST", body: JSON.stringify({ reason }) }),
  releaseEntry: (runId: string, employeeId: string) =>
    request(`/payroll-runs/${runId}/entries/${employeeId}/release`, { method: "POST" }),
  generatePayslips: (runId: string) =>
    request(`/payroll-runs/${runId}/generate-payslips`, { method: "POST" }),

  // Bank Payouts
  initiateBulkPayout: (runId: string) =>
    request(`/payroll-runs/${runId}/payout`, { method: "POST" }),
  getPayoutTransactions: (runId: string) =>
    request(`/payroll-runs/${runId}/transactions`),
  downloadBankFile: (runId: string) =>
    request(`/payroll-runs/${runId}/bank-file`),
  retryBankTransaction: (id: string) =>
    request(`/bank-transactions/${id}/retry`, { method: "POST" }),
  syncBankTransaction: (id: string) =>
    request(`/bank-transactions/${id}/sync`, { method: "POST" }),

  // Payslips
  getMyPayslips: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/payslips/my${qs}`);
  },
  getPayslip: (id: string) => request(`/payslips/${id}`),

  // Investment Declarations
  submitDeclaration: (data: Record<string, unknown>) =>
    request("/investment-declarations", { method: "POST", body: JSON.stringify(data) }),
  getMyDeclarations: () => request("/investment-declarations/my"),
  getDeclaration: (id: string) => request(`/investment-declarations/${id}`),
  updateDeclaration: (id: string, data: Record<string, unknown>) =>
    request(`/investment-declarations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  verifyDeclaration: (id: string, data: { verified: boolean; remarks?: string }) =>
    request(`/investment-declarations/${id}/verify`, { method: "POST", body: JSON.stringify(data) }),

  // Expense Claims
  createExpenseClaim: (data: Record<string, unknown>) =>
    request("/expense-claims", { method: "POST", body: JSON.stringify(data) }),
  getMyExpenseClaims: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/expense-claims/my${qs}`);
  },
  getAllExpenseClaims: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/expense-claims${qs}`);
  },
  getPendingExpenses: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/expense-claims/pending${qs}`);
  },
  getExpenseClaim: (id: string) => request(`/expense-claims/${id}`),
  updateExpenseClaim: (id: string, data: Record<string, unknown>) =>
    request(`/expense-claims/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  submitExpenseClaim: (id: string) =>
    request(`/expense-claims/${id}/submit`, { method: "POST" }),
  approveExpenseClaim: (id: string, data: { status: string; remarks?: string }) =>
    request(`/expense-claims/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  cancelExpenseClaim: (id: string) =>
    request(`/expense-claims/${id}`, { method: "DELETE" }),
  getExpenseStats: () => request("/expense-claims/stats"),

  // Onboarding
  initiateOnboarding: (data: Record<string, unknown>) =>
    request("/onboarding", { method: "POST", body: JSON.stringify(data) }),
  getAllOnboardings: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/onboarding${qs}`);
  },
  getOnboarding: (employeeId: string) => request(`/onboarding/${employeeId}`),
  completeChecklistItem: (employeeId: string, data: { taskId: string; notes?: string }) =>
    request(`/onboarding/${employeeId}/checklist/complete`, { method: "POST", body: JSON.stringify(data) }),
  uploadDocument: (employeeId: string, docIndex: number, url: string) =>
    request(`/onboarding/${employeeId}/documents/${docIndex}/upload`, { method: "POST", body: JSON.stringify({ url }) }),
  verifyDocument: (employeeId: string, docIndex: number, data: { status: string; rejectionReason?: string }) =>
    request(`/onboarding/${employeeId}/documents/${docIndex}/verify`, { method: "POST", body: JSON.stringify(data) }),
  confirmEmployee: (employeeId: string) =>
    request(`/onboarding/${employeeId}/confirm`, { method: "POST" }),

  // Offboarding
  initiateOffboarding: (data: Record<string, unknown>) =>
    request("/offboarding", { method: "POST", body: JSON.stringify(data) }),
  getAllOffboardings: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/offboarding${qs}`);
  },
  getOffboarding: (employeeId: string) => request(`/offboarding/${employeeId}`),
  updateClearance: (employeeId: string, data: { department: string; status: string; remarks?: string }) =>
    request(`/offboarding/${employeeId}/clearance`, { method: "PUT", body: JSON.stringify(data) }),
  submitExitInterview: (employeeId: string, data: Record<string, unknown>) =>
    request(`/offboarding/${employeeId}/exit-interview`, { method: "POST", body: JSON.stringify(data) }),
  calculateFnF: (employeeId: string) =>
    request(`/offboarding/${employeeId}/calculate-fnf`, { method: "POST" }),
  approveFnF: (employeeId: string, data?: { notes?: string }) =>
    request(`/offboarding/${employeeId}/approve-fnf`, { method: "POST", body: JSON.stringify(data || {}) }),
  generateLetters: (employeeId: string) =>
    request(`/offboarding/${employeeId}/generate-letters`, { method: "POST" }),

  // Loans
  applyLoan: (data: Record<string, unknown>) =>
    request("/loans", { method: "POST", body: JSON.stringify(data) }),
  getLoans: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/loans${qs}`);
  },
  getMyLoans: () => request("/loans/my"),
  getLoan: (id: string) => request(`/loans/${id}`),
  approveLoan: (id: string, data: { status: string; comments?: string }) =>
    request(`/loans/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),
  disburseLoan: (id: string) =>
    request(`/loans/${id}/disburse`, { method: "POST" }),
  closeLoan: (id: string) =>
    request(`/loans/${id}/close`, { method: "POST" }),

  // Analytics
  getDashboardMetrics: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/analytics/dashboard${qs}`);
  },
  getHeadcountTrends: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/analytics/headcount${qs}`);
  },
  getAttritionTrends: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/analytics/attrition${qs}`);
  },
  getAttritionPredictions: () => request("/analytics/attrition/predictions"),
  getLiveAttritionPredictions: () => request("/analytics/attrition/predictions/live"),
  getCostAnalytics: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/analytics/cost${qs}`);
  },
  getAttendanceTrends: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/analytics/attendance-trends${qs}`);
  },
  getHeadcountForecast: () => request("/analytics/headcount-forecast"),
  generateSnapshot: () => request("/analytics/snapshots/generate", { method: "POST" }),

  // Recruitment
  createJobPosting: (data: Record<string, unknown>) =>
    request("/jobs", { method: "POST", body: JSON.stringify(data) }),
  getJobPostings: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/jobs${qs}`);
  },
  getJobPosting: (id: string) => request(`/jobs/${id}`),
  updateJobPosting: (id: string, data: Record<string, unknown>) =>
    request(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateJobStatus: (id: string, status: string) =>
    request(`/jobs/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  addCandidate: (data: Record<string, unknown>) =>
    request("/candidates", { method: "POST", body: JSON.stringify(data) }),
  getCandidates: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/candidates${qs}`);
  },
  getCandidate: (id: string) => request(`/candidates/${id}`),
  advanceCandidate: (id: string) =>
    request(`/candidates/${id}/advance`, { method: "POST" }),
  rejectCandidate: (id: string, reason: string) =>
    request(`/candidates/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  scheduleInterview: (id: string, data: Record<string, unknown>) =>
    request(`/candidates/${id}/schedule-interview`, { method: "POST", body: JSON.stringify(data) }),
  submitInterviewFeedback: (id: string, data: Record<string, unknown>) =>
    request(`/candidates/${id}/interview-feedback`, { method: "POST", body: JSON.stringify(data) }),
  createOffer: (id: string, data: Record<string, unknown>) =>
    request(`/candidates/${id}/offer`, { method: "POST", body: JSON.stringify(data) }),
  sendOffer: (id: string) =>
    request(`/candidates/${id}/send-offer`, { method: "POST" }),
  convertToEmployee: (id: string) =>
    request(`/candidates/${id}/convert-to-employee`, { method: "POST" }),
  getRecruitmentAnalytics: () => request("/recruitment/analytics"),

  // AI Recruitment
  parseResume: (data: { resumeText: string; jobPostingId?: string }) =>
    request("/candidates/parse-resume", { method: "POST", body: JSON.stringify(data) }),
  parseAndCreateCandidate: (data: { jobPostingId: string; resumeText: string; email: string }) =>
    request("/candidates/parse-and-create", { method: "POST", body: JSON.stringify(data) }),
  smartMatchCandidates: (data: { jobPostingId: string; minScore?: number; limit?: number }) =>
    request("/jobs/smart-match", { method: "POST", body: JSON.stringify(data) }),

  // Statutory Reports
  generateForm16: (data: { employeeId: string; financialYear: string }) =>
    request("/statutory-reports/form-16", { method: "POST", body: JSON.stringify(data) }),
  generatePFECR: (data: { month: number; year: number }) =>
    request("/statutory-reports/pf-ecr", { method: "POST", body: JSON.stringify(data) }),
  generateESIReturn: (data: { month: number; year: number }) =>
    request("/statutory-reports/esi-return", { method: "POST", body: JSON.stringify(data) }),
  generateTDSQuarterly: (data: { quarter: number; year: number }) =>
    request("/statutory-reports/tds-quarterly", { method: "POST", body: JSON.stringify(data) }),
  listStatutoryReports: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/statutory-reports${qs}`);
  },
  getStatutoryReport: (id: string) => request(`/statutory-reports/${id}`),
  getMyForm16: () => request("/statutory-reports/my/form-16"),

  // Performance Management: Goals
  createGoal: (data: Record<string, unknown>) =>
    request("/goals", { method: "POST", body: JSON.stringify(data) }),
  getAllGoals: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/goals${qs}`);
  },
  getMyGoals: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/goals/my${qs}`);
  },
  getGoal: (id: string) => request(`/goals/${id}`),
  updateGoal: (id: string, data: Record<string, unknown>) =>
    request(`/goals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  goalCheckIn: (id: string, data: Record<string, unknown>) =>
    request(`/goals/${id}/check-in`, { method: "POST", body: JSON.stringify(data) }),
  rateGoal: (id: string, data: Record<string, unknown>) =>
    request(`/goals/${id}/rate`, { method: "POST", body: JSON.stringify(data) }),
  deleteGoal: (id: string) =>
    request(`/goals/${id}`, { method: "DELETE" }),

  // Performance Management: Review Cycles
  createReviewCycle: (data: Record<string, unknown>) =>
    request("/review-cycles", { method: "POST", body: JSON.stringify(data) }),
  listReviewCycles: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/review-cycles${qs}`);
  },
  getReviewCycle: (id: string) => request(`/review-cycles/${id}`),
  updateReviewCycle: (id: string, data: Record<string, unknown>) =>
    request(`/review-cycles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  startReviewCycle: (id: string, data?: Record<string, unknown>) =>
    request(`/review-cycles/${id}/start`, { method: "POST", body: JSON.stringify(data || {}) }),
  updateCycleStatus: (id: string, status: string) =>
    request(`/review-cycles/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  // Performance Management: Reviews
  getMyReviews: () => request("/reviews/my"),
  getPendingReviews: () => request("/reviews/pending"),
  getReview: (id: string) => request(`/reviews/${id}`),
  submitSelfReview: (id: string, data: Record<string, unknown>) =>
    request(`/reviews/${id}/self-review`, { method: "POST", body: JSON.stringify(data) }),
  submitPeerReview: (id: string, data: Record<string, unknown>) =>
    request(`/reviews/${id}/peer-review`, { method: "POST", body: JSON.stringify(data) }),
  submitManagerReview: (id: string, data: Record<string, unknown>) =>
    request(`/reviews/${id}/manager-review`, { method: "POST", body: JSON.stringify(data) }),
  finalizeReview: (id: string, data: Record<string, unknown>) =>
    request(`/reviews/${id}/finalize`, { method: "POST", body: JSON.stringify(data) }),

  // Employee Engagement: Announcements
  createAnnouncement: (data: Record<string, unknown>) =>
    request("/announcements", { method: "POST", body: JSON.stringify(data) }),
  listAnnouncements: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/announcements${qs}`);
  },
  getPinnedAnnouncements: () => request("/announcements/pinned"),
  getAnnouncement: (id: string) => request(`/announcements/${id}`),
  updateAnnouncement: (id: string, data: Record<string, unknown>) =>
    request(`/announcements/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publishAnnouncement: (id: string) =>
    request(`/announcements/${id}/publish`, { method: "POST" }),
  markAnnouncementRead: (id: string) =>
    request(`/announcements/${id}/read`, { method: "POST", body: JSON.stringify({}) }),
  reactToAnnouncement: (id: string, emoji: string) =>
    request(`/announcements/${id}/react`, { method: "POST", body: JSON.stringify({ emoji }) }),
  deleteAnnouncement: (id: string) =>
    request(`/announcements/${id}`, { method: "DELETE" }),

  // Employee Engagement: Kudos
  giveKudos: (data: Record<string, unknown>) =>
    request("/kudos", { method: "POST", body: JSON.stringify(data) }),
  listKudos: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/kudos${qs}`);
  },
  getMyReceivedKudos: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/kudos/received${qs}`);
  },
  getMyGivenKudos: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/kudos/given${qs}`);
  },
  getKudosLeaderboard: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return request(`/kudos/leaderboard${qs}`);
  },
  deleteKudos: (id: string) =>
    request(`/kudos/${id}`, { method: "DELETE" }),

  // Employee Engagement: Surveys / Polls / eNPS
  createSurvey: (data: Record<string, unknown>) =>
    request("/surveys", { method: "POST", body: JSON.stringify(data) }),
  listSurveys: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/surveys${qs}`);
  },
  getActiveSurveysForUser: () => request("/surveys/active"),
  getSurvey: (id: string) => request(`/surveys/${id}`),
  updateSurvey: (id: string, data: Record<string, unknown>) =>
    request(`/surveys/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publishSurvey: (id: string) =>
    request(`/surveys/${id}/publish`, { method: "POST" }),
  closeSurvey: (id: string) =>
    request(`/surveys/${id}/close`, { method: "POST" }),
  submitSurveyResponse: (id: string, data: Record<string, unknown>) =>
    request(`/surveys/${id}/respond`, { method: "POST", body: JSON.stringify(data) }),
  getSurveyResults: (id: string) => request(`/surveys/${id}/results`),
  getMySurveyResponse: (id: string) => request(`/surveys/${id}/my-response`),

  // Learning Management System (LMS): Courses
  createCourse: (data: Record<string, unknown>) =>
    request("/courses", { method: "POST", body: JSON.stringify(data) }),
  listCourses: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/courses${qs}`);
  },
  getMandatoryCourses: () => request("/courses/mandatory"),
  getCourse: (id: string) => request(`/courses/${id}`),
  updateCourse: (id: string, data: Record<string, unknown>) =>
    request(`/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publishCourse: (id: string) =>
    request(`/courses/${id}/publish`, { method: "POST" }),
  archiveCourse: (id: string) =>
    request(`/courses/${id}/archive`, { method: "POST" }),
  rateCourse: (id: string, data: { rating: number; feedback?: string }) =>
    request(`/courses/${id}/rate`, { method: "POST", body: JSON.stringify(data) }),
  deleteCourse: (id: string) =>
    request(`/courses/${id}`, { method: "DELETE" }),

  // LMS: Enrollments
  enrollInCourse: (data: { courseId: string }) =>
    request("/enrollments", { method: "POST", body: JSON.stringify(data) }),
  getMyEnrollments: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/enrollments/my${qs}`);
  },
  getMyActiveCourses: () => request("/enrollments/my/active"),
  getCourseEnrollments: (courseId: string) =>
    request(`/enrollments/course/${courseId}`),
  getEnrollment: (id: string) => request(`/enrollments/${id}`),
  markCourseStarted: (id: string) =>
    request(`/enrollments/${id}/start`, { method: "POST" }),
  updateLessonProgress: (
    id: string,
    data: { lessonId: string; status: string; timeSpent?: number },
  ) =>
    request(`/enrollments/${id}/lesson-progress`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submitQuiz: (
    id: string,
    data: { answers: Array<{ questionId: string; answer: unknown }> },
  ) =>
    request(`/enrollments/${id}/quiz`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  dropCourse: (id: string) =>
    request(`/enrollments/${id}/drop`, { method: "POST" }),

  // LMS: Certificates
  getMyCertificates: () => request("/certificates/my"),
  getCertificate: (id: string) => request(`/certificates/${id}`),
  downloadCertificate: (id: string) =>
    request(`/certificates/${id}/download`, { method: "POST" }),
  verifyCertificate: (code: string) =>
    request(`/certificates/verify/${code}`),
  revokeCertificate: (id: string, reason?: string) =>
    request(`/certificates/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // LMS: Learning Paths
  createLearningPath: (data: Record<string, unknown>) =>
    request("/learning-paths", { method: "POST", body: JSON.stringify(data) }),
  listLearningPaths: () => request("/learning-paths"),
  getLearningPath: (id: string) => request(`/learning-paths/${id}`),
  updateLearningPath: (id: string, data: Record<string, unknown>) =>
    request(`/learning-paths/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLearningPath: (id: string) =>
    request(`/learning-paths/${id}`, { method: "DELETE" }),
};
