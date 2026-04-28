import * as SecureStore from "expo-secure-store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://192.168.29.218:3005";

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

  // Check whether an account exists for this email — drives the
  // "no account, contact your admin" gate on the mobile login screen.
  // Mobile is invite-only: brand-new users can't sign up here, they
  // get added to an org by an admin first. Returns shape:
  //   { exists: boolean, hasOrgs: boolean, orgs: [{ _id, name }] }
  checkEmail: (email: string) =>
    request<{ exists: boolean; hasOrgs: boolean; orgs: Array<{ _id: string; name: string }> }>(
      `/auth/check-email?email=${encodeURIComponent(email)}`,
    ),

  me: () => request<any>("/auth/me"),

  // Update the current user's editable profile fields. Backend (auth-service
  // PUT /auth/me) accepts firstName, lastName, phoneNumber, avatar — all
  // optional — and returns the updated user. Other fields (email, roles,
  // setupStage) are not editable from the client.
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    avatar?: string;
  }) =>
    request<any>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // User preferences — notifications (email/inApp/desktop), theme,
  // language, timezone. Persisted on the auth-service user record.
  getPreferences: () =>
    request<{
      notifications?: { email?: boolean; inApp?: boolean; desktop?: boolean };
      theme?: "system" | "light" | "dark";
      language?: string;
      timezone?: string | null;
    }>("/auth/preferences"),

  updatePreferences: (prefs: Record<string, unknown>) =>
    request<any>("/auth/preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    }),

  logout: () => request("/auth/logout", { method: "POST" }),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Media uploads — multipart/form-data to media-service. Used for profile
// avatars, chat attachments, etc. The server stores the file and returns a
// `storageUrl` we can persist on whichever record needed the image.
// ─────────────────────────────────────────────────────────────────────────────
export const mediaApi = {
  // Upload a local image (file://...) and return the server URL.
  // `accessLevel` — "private" (default) requires auth to read back; "public"
  // is OK for avatars since they're already shown to anyone in the org.
  uploadImage: async (
    localUri: string,
    opts?: { fileName?: string; accessLevel?: "public" | "private" },
  ): Promise<{ storageUrl: string; _id: string }> => {
    const token = await SecureStore.getItemAsync("accessToken");
    const orgId = await SecureStore.getItemAsync("currentOrgId");

    const form = new FormData();
    // Infer mime + filename. RN's FormData accepts the {uri, name, type}
    // shape — Metro handles the multipart serialisation.
    const guessedName = opts?.fileName || `avatar-${Date.now()}.jpg`;
    const ext = guessedName.split(".").pop()?.toLowerCase() || "jpg";
    const mimeType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    // @ts-ignore — RN's FormData typing diverges from web FormData.
    form.append("file", { uri: localUri, name: guessedName, type: mimeType });
    if (opts?.accessLevel) form.append("accessLevel", opts.accessLevel);

    const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || ""}`,
        ...(orgId ? { "X-Organization-Id": orgId } : {}),
        // NB: don't set Content-Type manually — fetch needs to fill in
        // the multipart boundary itself.
      },
      body: form as any,
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message || json?.message || `Upload failed (${res.status})`);
    }
    return {
      storageUrl: json?.data?.storageUrl,
      _id: json?.data?._id,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Bug reports — platform-level ticket system. Any user can submit; the
// platform team receives an email at platform@nexora.io and triages from
// the super-admin dashboard.
// ─────────────────────────────────────────────────────────────────────────────
export const bugReportApi = {
  submit: (data: {
    title: string;
    description: string;
    category?: "bug" | "feature" | "feedback" | "security" | "data";
    severity?: "low" | "medium" | "high" | "critical";
    area?: string;
    appVersion?: string;
    platform?: "ios" | "android" | "web";
    userAgent?: string;
    url?: string;
  }) =>
    request<any>("/bug-reports", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  mine: () => request<any[]>("/bug-reports/mine"),
};

export const orgApi = {
  getMyOrgs: () => request<any[]>("/auth/organizations/my"),

  switchOrg: (orgId: string) =>
    request<any>("/auth/organizations/switch-org", {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId }),
    }),
};

// Location captured from the device GPS at clock-in/out. Optional —
// if the user denies the permission, mobile passes nothing and the
// backend stores `checkInLocation: null`. Backend rejects malformed
// coords (validators on `lat -90..90` / `lng -180..180`), so we don't
// need to re-validate on the client.
export interface AttendanceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
}

export const attendanceApi = {
  checkIn: (data?: { method?: string; location?: AttendanceLocation | null }) =>
    request<any>("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({
        method: data?.method ?? "mobile",
        ...(data?.location ? { location: data.location } : {}),
      }),
    }),

  checkOut: (data?: { method?: string; location?: AttendanceLocation | null }) =>
    request<any>("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({
        method: data?.method ?? "mobile",
        ...(data?.location ? { location: data.location } : {}),
      }),
    }),

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

  // ─── Personal tasks (no project) ─────────────────────────────────
  // Lightweight todo list scoped to the user. Backend stores them with
  // `isPersonal: true` and `projectId: null`. Optional collaborators
  // are other org members the user wants to share the todo with.
  getPersonal: (status?: string) =>
    request<any[]>(`/tasks/personal${status ? `?status=${status}` : ""}`),

  createPersonal: (data: {
    title: string;
    description?: string;
    priority?: "critical" | "high" | "medium" | "low" | "trivial";
    dueDate?: string;
    assigneeId?: string;
    collaborators?: string[];
    labels?: string[];
  }) =>
    request<any>("/tasks", {
      method: "POST",
      body: JSON.stringify({ ...data, isPersonal: true }),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    request<any>(`/tasks/${id}`, { method: "DELETE" }),
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
