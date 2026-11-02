export interface WorkLogStatusHistoryItem {
  id: string;
  workLogId: string;
  fromStatus: string;
  toStatus: string;
  changedById: string;
  changedBy: {
    id: string;
    name: string;
    role?: string | null;
  };
  createdAt: string;
}

// Serviços de comunicação HTTP com o Backend REST

const TOKEN_KEY = "hubsupport_jwt_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    workLogs: number;
  };
}

export interface WorkLogItem {
  id: string;
  title?: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken?: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  media: string;
  userId: string;
  tagId?: string | null;
  tag?: TagItem | null;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string;
    email: string;
    role?: string;
  };
  statusHistory?: WorkLogStatusHistoryItem[];
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  } | null;
  aiReport?: {
    id: string;
    status: string;
    errorMessage?: string | null;
    pdfPath?: string | null;
    videoPath?: string | null;
    structuredData?: string | null;
    completedAt?: string | null;
    startedAt?: string | null;
  } | null;
}

export interface DashboardSummaryData {
  recentLogs: WorkLogItem[];
  solvedLogs: WorkLogItem[];
  stats: {
    total: number;
    solved: number;
    today: number;
    technical: number;
    inProgress: number;
  };
}

export interface NotificationItem {
  id: string;
  userId: string;
  workLogId?: string | null;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  workLog?: {
    id: string;
    requester: string;
    clientOrOffice: string;
    technicalAction: boolean;
    implementation: boolean;
    status: string;
  } | null;
}

export interface AgendaEventItem {
  id: string;
  date: string;
  time: string;
  title: string;
  category: "Reunião" | "Atendimento" | "Técnico" | "Lembrete" | string;
  completed: boolean;
  employeeId?: string | null;
  employee?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
  createdById?: string | null;
  createdBy?: {
    id: string;
    name: string;
  } | null;
  notificationSent?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeItem {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  _count?: {
    workLogs: number;
  };
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Não define Content-Type se for FormData (o browser define com boundary)
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Garante cookies de sessão
  });

  if (response.status === 401) {
    removeToken();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  let data: any = {};
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error("O servidor backend está offline ou reiniciando. Verifique a conexão.");
    }
    throw new Error(data?.error || `Erro na requisição (${response.status}): ${response.statusText || "Falha na comunicação"}`);
  }

  return data as T;
}

export const api = {
  // Autenticação
  auth: {
    async login(email: string, password: string): Promise<{ success: boolean; token: string; user: UserProfile }> {
      const res = await request<{ success: boolean; token: string; user: UserProfile }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res.token) {
        setToken(res.token);
      }
      return res;
    },
    async me(): Promise<{ user: UserProfile }> {
      return request<{ user: UserProfile }>("/api/auth/me");
    },
    async logout(): Promise<{ success: boolean }> {
      try {
        await request<{ success: boolean }>("/api/auth/logout", { method: "POST" });
      } finally {
        removeToken();
      }
      return { success: true };
    },
  },

  // Atendimentos (WorkLogs)
  worklogs: {
    async getDaily(): Promise<WorkLogItem[]> {
      return request<WorkLogItem[]>("/api/worklogs");
    },
    async getAll(params?: { startDate?: string; endDate?: string }): Promise<WorkLogItem[]> {
      const query = new URLSearchParams();
      if (params?.startDate) query.set("startDate", params.startDate);
      if (params?.endDate) query.set("endDate", params.endDate);
      const qs = query.toString();
      return request<WorkLogItem[]>(`/api/worklogs${qs ? `?${qs}` : ""}`);
    },
    async getRecent(limit = 25): Promise<WorkLogItem[]> {
      return request<WorkLogItem[]>(`/api/worklogs?type=recent&limit=${limit}`);
    },
    async getSolved(limit = 25): Promise<WorkLogItem[]> {
      return request<WorkLogItem[]>(`/api/worklogs?type=solved&limit=${limit}`);
    },
    async getDashboardSummary(): Promise<DashboardSummaryData> {
      return request<DashboardSummaryData>("/api/worklogs/dashboard-summary");
    },
    async getTechnical(): Promise<WorkLogItem[]> {
      return request<WorkLogItem[]>("/api/worklogs?type=technical");
    },
    async create(formData: FormData): Promise<{ success: boolean; logId: string }> {
      return request<{ success: boolean; logId: string }>("/api/worklogs", {
        method: "POST",
        body: formData,
      });
    },
    async resolve(id: string): Promise<{ success: boolean; status: string; history?: WorkLogStatusHistoryItem[]; error?: string }> {
      return request<{ success: boolean; status: string; error?: string }>(`/api/worklogs/${id}/resolve`, {
        method: "PATCH",
      });
    },
    async assign(
      id: string,
      assignedToId: string | null
    ): Promise<{ success: boolean; assignedTo?: { id: string; name: string; email: string; role?: string | null } | null; error?: string }> {
      return request<{ success: boolean; assignedTo?: { id: string; name: string; email: string; role?: string | null } | null; error?: string }>(
        `/api/worklogs/${id}/assign`,
        {
          method: "PATCH",
          body: JSON.stringify({ assignedToId }),
        }
      );
    },
    async updateStatus(id: string, status: string): Promise<{ success: boolean; status: string; history?: WorkLogStatusHistoryItem[]; error?: string }> {
      return request<{ success: boolean; status: string; error?: string }>(`/api/worklogs/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    async retryAi(id: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/worklogs/${id}/retry-ai`, {
        method: "POST",
      });
    },
    async generateAiReport(id: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/worklogs/${id}/generate-ai-report`, {
        method: "POST",
      });
    },
    async getAiStatus(id: string): Promise<WorkLogItem["aiReport"]> {
      return request<WorkLogItem["aiReport"]>(`/api/worklogs/${id}/ai-status`);
    },
    getDownloadReportUrl(id: string): string {
      return `/api/reports/${id}/download`;
    },
    getViewReportUrl(id: string): string {
      const token = getToken();
      return `/api/reports/${id}/download?view=inline${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    },
    getDownloadRecordingUrl(id: string): string {
      return `/api/reports/${id}/recording`;
    },
  },

  // Tags Mestre / Categorias de Plataforma
  tags: {
    async getAll(): Promise<TagItem[]> {
      return request<TagItem[]>("/api/tags");
    },
    async create(data: { name: string; color?: string }): Promise<{ success: boolean; tag: TagItem }> {
      return request<{ success: boolean; tag: TagItem }>("/api/tags", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(id: string, data: { name: string; color?: string }): Promise<{ success: boolean; tag: TagItem }> {
      return request<{ success: boolean; tag: TagItem }>(`/api/tags/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    async delete(id: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/tags/${id}`, {
        method: "DELETE",
      });
    },
  },

  // Notificações
  notifications: {
    async getAll(): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
      return request<{ notifications: NotificationItem[]; unreadCount: number }>("/api/notifications");
    },
    async markAsRead(id: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
    },
    async markAllAsRead(): Promise<{ success: boolean }> {
      return request<{ success: boolean }>("/api/notifications/read-all", {
        method: "PATCH",
      });
    },
  },

  // Agenda Compartilhada
  agenda: {
    async getAll(): Promise<AgendaEventItem[]> {
      return request<AgendaEventItem[]>("/api/agenda");
    },
    async create(data: {
      title: string;
      date: string;
      time?: string;
      category?: string;
      employeeId?: string | null;
    }): Promise<{ success: boolean; event: AgendaEventItem }> {
      return request<{ success: boolean; event: AgendaEventItem }>("/api/agenda", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(
      id: string,
      data: Partial<{
        title: string;
        date: string;
        time: string;
        category: string;
        completed: boolean;
        employeeId: string | null;
      }>
    ): Promise<{ success: boolean; event: AgendaEventItem }> {
      return request<{ success: boolean; event: AgendaEventItem }>(`/api/agenda/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    async delete(id: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/agenda/${id}`, {
        method: "DELETE",
      });
    },
  },

  // Gestão de Funcionários
  employees: {
    async getAll(): Promise<EmployeeItem[]> {
      return request<EmployeeItem[]>("/api/employees");
    },
    async create(data: { name: string; email: string; password: string; role?: string }): Promise<{ success: boolean; id: string }> {
      return request<{ success: boolean; id: string }>("/api/employees", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(id: string, data: { name: string; password?: string; role?: string; active: boolean }): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    async delete(id: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/employees/${id}`, {
        method: "DELETE",
      });
    },
  },
};
