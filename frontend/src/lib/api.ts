const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
export const API_BASE_URL = API_BASE;

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  pagination?: { page: number; limit: number; total: number; pages: number };
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

  const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
    ...options,
    headers,
  });

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
  getUnread: () => request<{ count: number }>("/chat/unread"),
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

  // Moderation
  getFlagged: () => request("/chat/moderation/flagged"),
  reviewFlagged: (id: string, data: { status: string }) =>
    request(`/chat/moderation/flagged/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getModerationStats: () => request("/chat/moderation/stats"),

  // Analytics
  getAnalytics: async (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<any>(`/chat/analytics?${params.toString()}`);
  },
};

// ── Types: Organization ──

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
};


// ── Types: Call Log ──

export interface CallLog {
  _id: string;
  organizationId?: string;
  callerId: string;
  receiverId: string;
  callerName?: string;
  receiverName?: string;
  type: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  notes?: string;
  roomId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Call API ──

export const callApi = {
  create: (data: Partial<CallLog>) =>
    request<CallLog>("/calls", { method: "POST", body: JSON.stringify(data) }),
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<CallLog[]>("/calls" + qs);
  },
  getStats: () => request<{ totalToday: number; missedToday: number; avgDuration: number; completedToday: number }>("/calls/stats"),
  getRecent: () => request<CallLog[]>("/calls/recent"),
  getById: (id: string) => request<CallLog>(`/calls/${id}`),
  update: (id: string, data: Partial<CallLog>) =>
    request<CallLog>(`/calls/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateNotes: (id: string, notes: string) =>
    request<CallLog>(`/calls/${id}/notes`, { method: "PUT", body: JSON.stringify({ notes }) }),
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
  milestones?: Array<{ _id?: string; title: string; targetDate: string; status: string; description?: string }>;
  budget?: { amount?: number; currency?: string; billingType?: string; spent?: number };
  settings?: {
    boardType?: 'scrum' | 'kanban' | 'custom';
    sprintDuration?: number;
    estimationUnit?: 'hours' | 'story_points';
    enableTimeTracking?: boolean;
    enableSubtasks?: boolean;
    enableEpics?: boolean;
    enableSprints?: boolean;
  };
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
};

// ── Task API ──

export interface Task {
  _id: string;
  taskKey?: string;
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
  comments?: Array<{ _id?: string; userId: string; content: string; createdAt: string }>;
  attachments?: Array<{ name: string; url: string }>;
  organizationId?: string;
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
  getStats: () => request<any>("/tasks/stats"),
  updateStatus: (id: string, status: string) =>
    request<Task>(`/tasks/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  addComment: (id: string, content: string) =>
    request<Task>(`/tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  logTime: (id: string, data: { hours: number; date: string; description?: string }) =>
    request<Task>(`/tasks/${id}/time-entries`, { method: "POST", body: JSON.stringify(data) }),
  getChildren: (id: string) => request<Task[]>(`/tasks/${id}/children`),
};

// ── Board API ──

export interface BoardColumn {
  _id?: string;
  id?: string;
  name: string;
  key: string;
  order: number;
  wipLimit?: number;
  statusMapping?: string;
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
  createFromTemplate: (data: { projectId: string; template: string }) =>
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
  createdAt?: string;
  updatedAt?: string;
}

export const sprintApi = {
  getByBoard: (boardId: string) => request<Sprint[]>(`/sprints/board/${boardId}`),
  getActive: (boardId: string) => request<Sprint>(`/sprints/board/${boardId}/active`),
  getById: (id: string) => request<Sprint>(`/sprints/${id}`),
  create: (data: Partial<Sprint>) =>
    request<Sprint>("/sprints", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Sprint>) =>
    request<Sprint>(`/sprints/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  start: (id: string) =>
    request<Sprint>(`/sprints/${id}/start`, { method: "POST" }),
  complete: (id: string, data?: { moveToBacklog?: boolean }) =>
    request<Sprint>(`/sprints/${id}/complete`, { method: "POST", body: JSON.stringify(data || {}) }),
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
};

export const platformApi = {
  getOrganizations: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    request<any[]>(`/platform/organizations?${new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`),
  getOrganization: (id: string) => request<any>(`/platform/organizations/${id}`),
  suspendOrganization: (id: string) => request<any>(`/platform/organizations/${id}/suspend`, { method: 'POST' }),
  activateOrganization: (id: string) => request<any>(`/platform/organizations/${id}/activate`, { method: 'POST' }),
  updateOrganizationPlan: (id: string, plan: string) => request<any>(`/platform/organizations/${id}/plan`, { method: 'PUT', body: JSON.stringify({ plan }) }),
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    request<any[]>(`/platform/users?${new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`),
  getUser: (id: string) => request<any>(`/platform/users/${id}`),
  disableUser: (id: string) => request<any>(`/platform/users/${id}/disable`, { method: 'POST' }),
  enableUser: (id: string) => request<any>(`/platform/users/${id}/enable`, { method: 'POST' }),
  resetUserAuth: (id: string) => request<any>(`/platform/users/${id}/reset-auth`, { method: 'POST' }),
  getAnalytics: () => request<any>('/platform/analytics'),
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; targetType?: string }) =>
    request<any[]>(`/platform/audit-logs?${new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`),
};
