"use client";

import { useMemo, useState } from "react";
import WorkLogForm from "@/components/WorkLogForm";
import { WorkLog } from "@/components/WorkLogFeed";

interface DashboardProps {
  logs: WorkLog[];
  currentUserId: string;
  employees: { name: string }[];
}

const avatarColors = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function getAvatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "Realizado":
    case "Já realizado":
      return {
        label: "Já realizado",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.3)",
      };
    case "Em andamento":
      return {
        label: "Em andamento",
        color: "#60a5fa",
        bg: "rgba(59, 130, 246, 0.12)",
        border: "rgba(59, 130, 246, 0.3)",
      };
    case "Aguardando reunião":
      return {
        label: "Aguardando reunião",
        color: "#fbbf24",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.3)",
      };
    case "Não foi possível realizar":
      return {
        label: "Não foi possível realizar",
        color: "#f87171",
        bg: "rgba(239, 68, 68, 0.12)",
        border: "rgba(239, 68, 68, 0.3)",
      };
    default:
      return {
        label: status || "Registrado",
        color: "#818cf8",
        bg: "rgba(99, 102, 241, 0.12)",
        border: "rgba(99, 102, 241, 0.25)",
      };
  }
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function DashboardClient({ logs, currentUserId, employees }: DashboardProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    requester: "",
    clientOrOffice: "",
    date: "",
    status: "",
    employee: "",
  });

  const employeeOptions = useMemo(() => {
    const unique = Array.from(new Set(employees.map((e) => e.name).filter(Boolean)));
    unique.sort();
    return unique;
  }, [employees]);

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(logs.map((l) => l.status).filter(Boolean)));
    unique.sort();
    return unique;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesRequester = filters.requester
        ? log.requester.toLowerCase().includes(filters.requester.toLowerCase())
        : true;
      const matchesClient = filters.clientOrOffice
        ? log.clientOrOffice.toLowerCase().includes(filters.clientOrOffice.toLowerCase())
        : true;
      const matchesDate = filters.date
        ? new Date(log.createdAt).toISOString().split("T")[0] === filters.date
        : true;
      const matchesStatus = filters.status ? log.status === filters.status : true;
      const matchesEmployee = filters.employee ? log.user.name === filters.employee : true;
      return matchesRequester && matchesClient && matchesDate && matchesStatus && matchesEmployee;
    });
  }, [logs, filters]);

  const validSelectedLogId = useMemo(() => {
    if (!selectedLogId) return filteredLogs.length > 0 ? filteredLogs[0].id : null;
    if (filteredLogs.find((l) => l.id === selectedLogId)) return selectedLogId;
    return filteredLogs.length > 0 ? filteredLogs[0].id : null;
  }, [selectedLogId, filteredLogs]);

  const selectedLog = logs.find((log) => log.id === validSelectedLogId);

  return (
    <main className="animate-fade-in" style={{ maxWidth: "1600px", padding: "2rem 2.5rem", width: "100%" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "0.25rem",
          }}
        >
          Dashboard de Atendimentos
        </h1>
      </div>

      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "flex-start" }}>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo Atendimento
        </button>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          className="input-dark"
          placeholder="Pesquisar por solicitante"
          value={filters.requester}
          onChange={(e) => setFilters({ ...filters, requester: e.target.value })}
          style={{ maxWidth: "200px", flex: "1 1 200px" }}
        />
        <input
          type="text"
          className="input-dark"
          placeholder="Pesquisar por escritório/cliente"
          value={filters.clientOrOffice}
          onChange={(e) => setFilters({ ...filters, clientOrOffice: e.target.value })}
          style={{ maxWidth: "220px", flex: "1 1 220px" }}
        />
        <input
          type="date"
          className="input-dark"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          style={{ maxWidth: "180px", flex: "1 1 180px" }}
        />
        <select
          className="input-dark"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={{ maxWidth: "220px", flex: "1 1 220px", cursor: "pointer" }}
        >
          <option value="">Todos os status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {getStatusBadgeConfig(status).label}
            </option>
          ))}
        </select>
        <select
          className="input-dark"
          value={filters.employee}
          onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
          style={{ maxWidth: "220px", flex: "1 1 220px", cursor: "pointer" }}
        >
          <option value="">Todos os funcionários</option>
          {employeeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: "1.5rem",
          alignItems: "start",
          minHeight: "calc(100vh - 280px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxHeight: "calc(100vh - 300px)",
            overflowY: "auto",
            paddingRight: "0.25rem",
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem 1rem", borderStyle: "dashed" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Nenhum atendimento encontrado</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = log.id === selectedLogId;
              const avatarColor = getAvatarColor(log.userId);
              const statusConfig = getStatusBadgeConfig(log.status);
              const isOwn = log.userId === currentUserId;

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className="card card-hover animate-fade-in"
                  style={{
                    cursor: "pointer",
                    borderColor: isSelected ? "rgba(99,102,241,0.6)" : isOwn ? "rgba(99,102,241,0.25)" : "var(--border)",
                    boxShadow: isSelected ? "0 0 0 1px rgba(99,102,241,0.4)" : "none",
                    padding: "0.875rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.625rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                      <div
                        className="avatar"
                        style={{
                          background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}aa)`,
                          width: "28px",
                          height: "28px",
                          fontSize: "0.7rem",
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(log.user.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.user.name}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: statusConfig.color,
                        background: statusConfig.bg,
                        border: `1px solid ${statusConfig.border}`,
                        flexShrink: 0,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "nowrap", marginBottom: "0.5rem" }}>
                    <div style={{ flex: "1 1 150px", marginBottom: "0", minWidth: 0 }}>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.125rem" }}>
                        Solicitante
                      </p>
                      <p
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-primary)",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.requester}
                      </p>
                    </div>
                    <div style={{ flex: "1 1 150px", marginBottom: "0", minWidth: 0 }}>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.125rem" }}>
                        Escritório
                      </p>
                      <p
                        style={{
                          fontSize: "0.8rem",
                          color: "#e0e7ff",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.clientOrOffice}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#f87171", marginBottom: "0.125rem", fontWeight: 600 }}>
                      Problema relatado
                    </p>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {log.reportedProblem}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ minHeight: "calc(100vh - 300px)", maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
          {selectedLog ? (
            <div className="animate-fade-in">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                  paddingBottom: "0.875rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    className="avatar"
                    style={{
                      background: `linear-gradient(135deg, ${getAvatarColor(selectedLog.userId)}, ${getAvatarColor(selectedLog.userId)}aa)`,
                    }}
                  >
                    {getInitials(selectedLog.user.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {selectedLog.user.name}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Registrado em {formatDate(selectedLog.createdAt)} às{" "}
                      {new Date(selectedLog.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.25rem 0.7rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: getStatusBadgeConfig(selectedLog.status).color,
                    background: getStatusBadgeConfig(selectedLog.status).bg,
                    border: `1px solid ${getStatusBadgeConfig(selectedLog.status).border}`,
                  }}
                >
                  {getStatusBadgeConfig(selectedLog.status).label}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    flex: "1 1 250px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    Solicitante
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>
                    {selectedLog.requester}
                  </p>
                </div>
                <div
                  style={{
                    flex: "1 1 250px",
                    background: "rgba(99, 102, 241, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "#a5b4fc", marginBottom: "0.375rem" }}>
                    Escritório / Cliente
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "#e0e7ff", fontWeight: 600 }}>
                    {selectedLog.clientOrOffice}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "1rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#f87171",
                      marginBottom: "0.625rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Problema relatado
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                    {selectedLog.reportedProblem}
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "1rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#34d399",
                      marginBottom: "0.625rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Ação realizada
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                    {selectedLog.actionTaken}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Selecione um atendimento para visualizar os detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            animation: "fadeIn 0.2s ease-in",
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              animation: "slideUp 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: "absolute",
                top: "0.75rem",
                right: "0.75rem",
                zIndex: 10,
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid var(--border-light)",
                color: "var(--text-muted)",
                borderRadius: "6px",
                width: "28px",
                height: "28px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <WorkLogForm onSuccess={() => setIsModalOpen(false)} />
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
