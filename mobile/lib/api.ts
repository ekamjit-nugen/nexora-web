import * as SecureStore from "expo-secure-store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3005";

if (!__DEV__ && API_BASE && !API_BASE.startsWith("https://")) {
  console.warn("[Security] API_BASE should use HTTPS in production:", API_BASE);
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync("refreshToken");
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    credentials: "omit",
  });

  if (!res.ok) {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    throw new Error("Session expired");
  }

  const json = await res.json();
  const newAccess = json.data?.accessToken || json.accessToken;
  const newRefresh = json.data?.refreshToken || json.refreshToken;

  if (newAccess) await SecureStore.setItemAsync("accessToken", newAccess);
  if (newRefresh) await SecureStore.setItemAsync("refreshToken", newRefresh);

  return newAccess;
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await SecureStore.getItemAsync("accessToken");
  const orgId = await SecureStore.getItemAsync("currentOrgId");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { "X-Organization-Id": orgId } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
    ...options,
    headers,
    credentials: "omit", // Mobile uses Bearer token auth, never cookies
  });

  if (res.status === 401 && !endpoint.includes("/auth/refresh")) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken();
      }
      const newToken = await refreshPromise;
      refreshPromise = null;

      const retryHeaders: Record<string, string> = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };

      const retryRes = await fetch(`${API_BASE}/api/v1${endpoint}`, {
        ...options,
        headers: retryHeaders,
        credentials: "omit",
      });

      const retryJson = await retryRes.json();

      if (!retryRes.ok) {
        throw new Error(retryJson.message || `Request failed with status ${retryRes.status}`);
      }

      return retryJson;
    } catch (refreshError) {
      refreshPromise = null;
      throw refreshError;
    }
  }

  const json = await res.json();

  if (!res.ok) {
    const errorMessage =
      json.error?.message ||
      json.message ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMessage);
  }

  return json;
}

export const authApi = {
  sendOtp: (email: string) =>
    request("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, otp: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>(
      "/auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      }
    ),

  me: () => request<any>("/auth/me"),

  logout: () => request("/auth/logout", { method: "POST" }),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
};

export const orgApi = {
  getMyOrgs: () => request<any[]>("/auth/organizations/my"),

  switchOrg: (orgId: string) =>
    request<any>("/auth/organizations/switch-org", {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId }),
    }),
};

export const attendanceApi = {
  checkIn: () =>
    request<any>("/attendance/check-in", { method: "POST" }),

  checkOut: () =>
    request<any>("/attendance/check-out", { method: "POST" }),

  getToday: () => request<any>("/attendance/today"),

  getHistory: (params?: { page?: number; limit?: number }) =>
    request<any[]>(
      `/attendance?page=${params?.page || 1}&limit=${params?.limit || 20}`
    ),
};

export const leaveApi = {
  getById: (id: string) => request<any>(`/leaves/${id}`),

  getBalance: () => request<any[]>("/leaves/balance"),

  apply: (data: {
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    halfDay?: { enabled: boolean; date?: string; half?: string };
  }) =>
    request<any>("/leaves", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyLeaves: (params?: { page?: number }) =>
    request<any[]>(`/leaves/my?page=${params?.page || 1}`),

  cancel: (id: string, reason?: string) =>
    request<any>(`/leaves/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify({ reason: reason || "Cancelled by employee" }),
    }),

  getAll: (params?: { page?: number; status?: string }) =>
    request<any[]>(
      `/leaves?page=${params?.page || 1}${
        params?.status ? `&status=${params.status}` : ""
      }`
    ),

  approve: (id: string, data: { status: "approved" | "rejected"; rejectionReason?: string }) =>
    request<any>(`/leaves/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export const projectApi = {
  getAll: (params?: { page?: number }) =>
    request<any[]>(`/projects?page=${params?.page || 1}`),

  getById: (id: string) => request<any>(`/projects/${id}`),
};

export const taskApi = {
  getAll: (params?: { page?: number; status?: string }) =>
    request<any[]>(
      `/tasks?page=${params?.page || 1}${
        params?.status ? `&status=${params.status}` : ""
      }`
    ),

  getById: (id: string) => request<any>(`/tasks/${id}`),

  updateStatus: (id: string, status: string) =>
    request<any>(`/tasks/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  getMyWork: () => request<any>("/tasks/my-work"),
};

export const boardApi = {
  getByProject: (projectId: string) =>
    request<any[]>(`/boards/project/${projectId}`),

  getById: (id: string) => request<any>(`/boards/${id}`),

  moveTask: (
    boardId: string,
    taskId: string,
    data: { fromColumnId: string; toColumnId: string; newIndex?: number }
  ) =>
    request(`/boards/${boardId}/tasks/${taskId}/move`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getTasksByProject: (projectId: string, params?: { status?: string }) =>
    request<any[]>(
      `/tasks?projectId=${projectId}${
        params?.status ? `&status=${params.status}` : ""
      }`
    ),
};

export const chatApi = {
  getConversations: () => request<any[]>("/chat/conversations"),

  getConversation: (id: string) => request<any>(`/chat/conversations/${id}`),

  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<any[]>(`/chat/conversations/${conversationId}/messages${query ? `?${query}` : ""}`);
  },

  sendMessage: (conversationId: string, content: string, type = "text", replyTo?: string) =>
    request<any>(`/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, type, replyTo }),
    }),

  markAsRead: (conversationId: string) =>
    request(`/chat/conversations/${conversationId}/read`, { method: "POST" }),

  getOnlineUsers: () =>
    request<Array<{ _id: string; firstName: string; lastName: string }>>("/chat/users/online"),

  createDirectConversation: (targetUserId: string) =>
    request<any>("/chat/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    }),

  getUnread: () =>
    request<{ count: number; unreadConversations?: Array<{ conversationId: string; count: number }> }>("/chat/unread"),
};

export const employeeApi = {
  getAll: (params?: { page?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request<any[]>(`/employees${query ? `?${query}` : ""}`);
  },
};

export const notificationApi = {
  getNotifications: (page = 1, limit = 20) =>
    request<any[]>(`/tasks/notifications?page=${page}&limit=${limit}`),

  getUnreadCount: () =>
    request<{ count: number }>("/tasks/notifications/unread-count"),

  markAsRead: (id: string) =>
    request<any>(`/tasks/notifications/${id}/read`, { method: "PUT" }),

  markAllAsRead: () =>
    request<any>("/tasks/notifications/read-all", { method: "PUT" }),
};

export const policyApi = {
  getApplicable: () => request<any[]>('/policies/applicable'),
  getById: (id: string) => request<any>(`/policies/${id}`),
  acknowledge: (id: string) =>
    request<any>(`/policies/${id}/acknowledge`, { method: 'POST' }),
};

export const timesheetApi = {
  getMyTimesheets: (params?: { page?: number }) =>
    request<any[]>(`/timesheets/my?page=${params?.page || 1}`),

  getPending: (params?: { page?: number }) =>
    request<any[]>(`/timesheets/pending?page=${params?.page || 1}`),

  getById: (id: string) => request<any>(`/timesheets/${id}`),

  create: (data: { period: { startDate: string; endDate: string; type: string } }) =>
    request<any>("/timesheets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    request<any>(`/timesheets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  autoPopulate: (data: { startDate: string; endDate: string }) =>
    request<any>("/timesheets/auto-populate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submit: (id: string) =>
    request<any>(`/timesheets/${id}/submit`, {
      method: "POST",
    }),

  review: (id: string, data: { status: string; reviewComment?: string }) =>
    request<any>(`/timesheets/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getStats: () => request<any>("/timesheets/stats"),
};
