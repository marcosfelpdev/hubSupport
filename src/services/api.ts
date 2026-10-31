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

export interface WorkLogItem {
  id: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  media: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string;
    email: string;
    role?: string;
  };
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Ocorreu um erro ao processar a requisição.");
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
    async resolve(id: string): Promise<{ success: boolean; status: string; error?: string }> {
      return request<{ success: boolean; status: string; error?: string }>(`/api/worklogs/${id}/resolve`, {
        method: "PATCH",
      });
    },
    async updateStatus(id: string, status: string): Promise<{ success: boolean; status: string; error?: string }> {
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
    async getAiStatus(id: string): Promise<WorkLogItem["aiReport"]> {
      return request<WorkLogItem["aiReport"]>(`/api/worklogs/${id}/ai-status`);
    },
    getDownloadReportUrl(id: string): string {
      return `/api/reports/${id}/download`;
    },
    getDownloadRecordingUrl(id: string): string {
      return `/api/reports/${id}/recording`;
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
