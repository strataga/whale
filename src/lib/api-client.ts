// Typed API client for client-side fetch calls.
// No external dependencies — lightweight interfaces defined inline.

// ---------------------------------------------------------------------------
// Entity interfaces (subset of DB columns used in list/detail views)
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  workspaceId: string;
  taskCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  position: number;
  tags: string;
  createdAt: number;
  updatedAt: number;
}

export interface Bot {
  id: string;
  name: string;
  host: string;
  status: string;
  statusReason: string | null;
  capabilities: string;
  lastSeenAt: number | null;
  version: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  readAt: number | null;
  createdAt: number;
}

export interface Alert {
  id: string;
  workspaceId: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  createdAt: number;
}

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: number | null;
  lastUsedAt: number | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  );
  return `?${qs.toString()}`;
}

async function fetchApi<T>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const init: RequestInit = { method: options?.method ?? "GET" };
  if (options?.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Request failed", data.details);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Namespaced API methods
// ---------------------------------------------------------------------------

export const api = {
  projects: {
    list: (params?: { page?: number; limit?: number }) =>
      fetchApi<{ projects: Project[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        `/api/projects${toQuery(params)}`,
      ),
    get: (id: string) =>
      fetchApi<{ project: Project }>(`/api/projects/${id}`),
    create: (data: { name: string; description?: string }) =>
      fetchApi<{ project: Project }>("/api/projects", { method: "POST", body: data }),
    update: (id: string, data: Partial<Pick<Project, "name" | "description" | "status">>) =>
      fetchApi<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  },

  tasks: {
    list: (projectId: string, params?: { status?: string; limit?: number }) =>
      fetchApi<{ tasks: Task[] }>(`/api/projects/${projectId}/tasks${toQuery(params)}`),
    create: (projectId: string, data: { title: string; description?: string; priority?: string; milestoneId?: string; dueDate?: string; estimatedMinutes?: number; templateId?: string }) =>
      fetchApi<{ task: Task }>(`/api/projects/${projectId}/tasks`, { method: "POST", body: data }),
    update: (projectId: string, taskId: string, data: Record<string, unknown>) =>
      fetchApi<{ task: Task }>(`/api/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", body: data }),
  },

  bots: {
    list: () =>
      fetchApi<{ bots: Bot[] }>("/api/bots"),
    get: (botId: string) =>
      fetchApi<{ bot: Bot }>(`/api/bots/${botId}`),
  },

  notifications: {
    list: () =>
      fetchApi<{ notifications: Notification[] }>("/api/notifications"),
    markAllRead: () =>
      fetchApi<{ readAll: boolean }>("/api/notifications/read-all", { method: "POST" }),
  },

  alerts: {
    list: () =>
      fetchApi<{ alerts: Alert[] }>("/api/alerts"),
    acknowledge: (alertId: string) =>
      fetchApi<{ alert: Alert }>(`/api/alerts/${alertId}`, { method: "PATCH", body: {} }),
  },

  tokens: {
    list: () =>
      fetchApi<{ tokens: ApiToken[] }>("/api/tokens"),
    create: (data: { name: string; scopes?: string[]; expiresInDays?: number }) =>
      fetchApi<{ id: string; token: string; prefix: string; expiresAt: number | null }>("/api/tokens", { method: "POST", body: data }),
    delete: (tokenId: string) =>
      fetchApi<{ ok: boolean }>(`/api/tokens/${tokenId}`, { method: "DELETE" }),
  },
};
