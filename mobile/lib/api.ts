import * as SecureStore from "expo-secure-store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3005";

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
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
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
  getBalance: () => request<any[]>("/leaves/balance"),

  apply: (data: {
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) =>
    request<any>("/leaves", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyLeaves: (params?: { page?: number }) =>
    request<any[]>(`/leaves/my?page=${params?.page || 1}`),

  cancel: (id: string) =>
    request<any>(`/leaves/${id}/cancel`, { method: "PUT" }),
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
};

export const chatApi = {
  getConversations: () => request<any[]>("/chat/conversations"),
};
