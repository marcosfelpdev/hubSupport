"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Cog, Lightbulb, CheckCircle2, ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import { resolveWorkLog } from "@/actions/worklog";

export interface TechnicalWorkLog {
  id: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  media: string;
  createdAt: Date;
  userId: string;
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
}

interface TechnicianDashboardProps {
  logs: TechnicalWorkLog[];
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
    case "Solucionado":
      return {
        label: "Solucionado",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.15)",
        border: "rgba(16, 185, 129, 0.35)",
      };
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

function getMediaPaths(log: TechnicalWorkLog): string[] {
  try {
    return JSON.parse(log.media || "[]");
  } catch {
    return [];
  }
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url);
}

export default function TechnicianDashboardClient({
  logs: initialLogs,
  currentUserId,
  employees,
}: TechnicianDashboardProps) {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");

  const [logs, setLogs] = useState<TechnicalWorkLog[]>(initialLogs);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(requestedId || null);
  const [isPending, startTransition] = useTransition();
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sincroniza caso initialLogs mude
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // Se houver id no query param, seleciona automaticamente
  useEffect(() => {
    if (requestedId) {
      setSelectedLogId(requestedId);
    }
  }, [requestedId]);

  const [filters, setFilters] = useState({
    requester: "",
    clientOrOffice: "",
    date: "",
    status: "",
    employee: "",
    type: "", // 'technical', 'implementation' ou ''
  });

  // Media Modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaCurrentIndex, setMediaCurrentIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState<string[]>([]);

  const employeeOptions = useMemo(() => {
    const unique = Array.from(new Set(employees.map((e) => e.name).filter(Boolean)));
    unique.sort();
    return unique;
  }, [employees]);

  const statusOptions = useMemo(() => {
    const list = Array.from(new Set(logs.map((l) => l.status).filter(Boolean)));
    if (!list.includes("Solucionado")) list.push("Solucionado");
    return list;
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
      const matchesType =
        filters.type === "technical"
          ? log.technicalAction
          : filters.type === "implementation"
            ? log.implementation
            : true;

      return matchesRequester && matchesClient && matchesDate && matchesStatus && matchesEmployee && matchesType;
    });
  }, [logs, filters]);

  const validSelectedLogId = useMemo(() => {
    if (!selectedLogId) return filteredLogs.length > 0 ? filteredLogs[0].id : null;
    if (filteredLogs.find((l) => l.id === selectedLogId)) return selectedLogId;
    return filteredLogs.length > 0 ? filteredLogs[0].id : null;
  }, [selectedLogId, filteredLogs]);

  const selectedLog = logs.find((log) => log.id === validSelectedLogId);

  function openMediaModal(log: TechnicalWorkLog, startIndex = 0) {
    const paths = getMediaPaths(log);
    setMediaItems(paths);
    setMediaCurrentIndex(startIndex);
    setMediaModalOpen(true);
  }

  // Handler para marcar o atendimento como Solucionado
  async function handleMarkSolved(logId: string) {
    setActionFeedback(null);
    startTransition(async () => {
      try {
        const res = await resolveWorkLog(logId);
        if (res.error) {
          setActionFeedback({ type: "error", text: res.error });
          return;
        }

        // Atualização imediata no estado local
        setLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, status: "Solucionado" } : l))
        );

        setActionFeedback({
          type: "success",
          text: "Atendimento marcado como solucionado com sucesso!",
        });

        setTimeout(() => setActionFeedback(null), 4000);
      } catch (err) {
        console.error("Erro ao solucionar atendimento:", err);
        setActionFeedback({
          type: "error",
          text: "Falha ao definir como solucionado. Tente novamente.",
        });
      }
    });
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Barra de Filtros */}
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
          style={{ maxWidth: "200px", flex: "1 1 200px", cursor: "pointer" }}
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
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          style={{ maxWidth: "200px", flex: "1 1 200px", cursor: "pointer" }}
        >
          <option value="">Todos os tipos</option>
          <option value="technical">Ação Técnica</option>
          <option value="implementation">Implementação</option>
        </select>
        <select
          className="input-dark"
          value={filters.employee}
          onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
          style={{ maxWidth: "200px", flex: "1 1 200px", cursor: "pointer" }}
        >
          <option value="">Todos os autores</option>
          {employeeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid Principal: Cards minimizados ao lado (esquerda) e Card expandido ao centro */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: "1.5rem",
          alignItems: "start",
          minHeight: "calc(100vh - 280px)",
        }}
      >
        {/* Coluna Esquerda: Cards minimizados */}
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
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "2.5rem 1rem",
                borderStyle: "dashed",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(56, 189, 248, 0.1)",
                  color: "#38bdf8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 0.75rem",
                }}
              >
                <Cog size={20} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Nenhum chamado técnico encontrado
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = log.id === validSelectedLogId;
              const avatarColor = getAvatarColor(log.userId);
              const statusConfig = getStatusBadgeConfig(log.status);
              const hasTechnical = log.technicalAction;
              const hasImplementation = log.implementation;
              const isSolved = log.status === "Solucionado";

              return (
                <div
                  key={log.id}
                  id={`card-tech-${log.id}`}
                  onClick={() => setSelectedLogId(log.id)}
                  className="card card-hover animate-fade-in"
                  style={{
                    cursor: "pointer",
                    position: "relative",
                    borderColor: isSelected
                      ? "#38bdf8"
                      : isSolved
                        ? "rgba(16, 185, 129, 0.25)"
                        : "var(--border)",
                    boxShadow: isSelected
                      ? "0 0 0 1px #38bdf8, 0 8px 20px rgba(56, 189, 248, 0.15)"
                      : "none",
                    padding: "0.875rem",
                    zIndex: 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Tipo tags (canto superior direito) */}
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      zIndex: 10,
                    }}
                  >
                    {hasTechnical && (
                      <div
                        title="Ação Técnica"
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#f59e0b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1.5px solid #0d1322",
                        }}
                      >
                        <Cog size={9} strokeWidth={1.5} color="white" />
                      </div>
                    )}
                    {hasImplementation && (
                      <div
                        title="Implementação"
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#3b82f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1.5px solid #0d1322",
                        }}
                      >
                        <Lightbulb size={9} strokeWidth={1.5} color="white" />
                      </div>
                    )}
                  </div>

                  {/* Header do Card minimizado: Avatar e Status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.625rem",
                      paddingRight: "1.5rem",
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
                  </div>

                  {/* Status Badge */}
                  <div style={{ marginBottom: "0.5rem" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: statusConfig.color,
                        background: statusConfig.bg,
                        border: `1px solid ${statusConfig.border}`,
                      }}
                    >
                      {isSolved && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Solicitante & Escritório */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div style={{ minWidth: 0, marginBottom: "0" }}>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.125rem" }}>
                        Solicitante
                      </p>
                      <p
                        style={{
                          fontSize: "0.78rem",
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
                    <div style={{ minWidth: 0, marginBottom: "0" }}>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.125rem" }}>
                        Escritório
                      </p>
                      <p
                        style={{
                          fontSize: "0.78rem",
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

                  {/* Problema relatado (preview) */}
                  <div>
                    <p style={{ fontSize: "0.72rem", color: "#f87171", marginBottom: "0.125rem", fontWeight: 600 }}>
                      Problema relatado
                    </p>
                    <p
                      style={{
                        fontSize: "0.76rem",
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

        {/* Coluna Central: Card expandido */}
        <div
          className="card"
          style={{
            minHeight: "calc(100vh - 300px)",
            maxHeight: "calc(100vh - 300px)",
            overflowY: "auto",
            position: "relative",
          }}
        >
          {selectedLog ? (
            <div className="animate-fade-in">
              {/* Alerta de Feedback de Ação */}
              {actionFeedback && (
                <div
                  className={`alert animate-fade-in ${
                    actionFeedback.type === "success" ? "alert-success" : "alert-error"
                  }`}
                  style={{ marginBottom: "1rem" }}
                >
                  {actionFeedback.type === "success" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  )}
                  {actionFeedback.text}
                </div>
              )}

              {/* Topo do card expandido */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1.25rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  position: "relative",
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
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {selectedLog.user.name}
                      </p>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {selectedLog.user.role === "ADMIN"
                          ? "Administrador"
                          : selectedLog.user.role === "SUPPORT"
                            ? "Suporte"
                            : selectedLog.user.role === "MANAGER"
                              ? "Gestor"
                              : "Colaborador"}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Registrado em {formatDate(selectedLog.createdAt)} às{" "}
                      {new Date(selectedLog.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {/* Tags */}
                  {selectedLog.technicalAction && (
                    <div
                      title="Ação Técnica"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "6px",
                        background: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        color: "#fbbf24",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      <Cog size={12} />
                      Ação Técnica
                    </div>
                  )}
                  {selectedLog.implementation && (
                    <div
                      title="Implementação"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "6px",
                        background: "rgba(59, 130, 246, 0.15)",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        color: "#60a5fa",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      <Lightbulb size={12} />
                      Implementação
                    </div>
                  )}

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: getStatusBadgeConfig(selectedLog.status).color,
                      background: getStatusBadgeConfig(selectedLog.status).bg,
                      border: `1px solid ${getStatusBadgeConfig(selectedLog.status).border}`,
                    }}
                  >
                    {selectedLog.status === "Solucionado" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {getStatusBadgeConfig(selectedLog.status).label}
                  </span>
                </div>
              </div>

              {/* Solicitante & Escritório */}
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
                  <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 600 }}>
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
                  <p style={{ fontSize: "0.9rem", color: "#e0e7ff", fontWeight: 600 }}>
                    {selectedLog.clientOrOffice}
                  </p>
                </div>
              </div>

              {/* Botão Mídia (se houver) */}
              {getMediaPaths(selectedLog).length > 0 && (
                <button
                  onClick={() => openMediaModal(selectedLog)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.625rem 1rem",
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    borderRadius: "8px",
                    color: "#818cf8",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    marginBottom: "1rem",
                    transition: "all 0.2s",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Ver Mídias Anexadas ({getMediaPaths(selectedLog).length})
                </button>
              )}

              {/* Detalhes do Chamado */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.75rem" }}>
                {/* Problema relatado */}
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

                {/* Ação realizada */}
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
                    Ação realizada pelo autor
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                    {selectedLog.actionTaken}
                  </p>
                </div>
              </div>

              {/* SEÇÃO DE AÇÃO TÉCNICA: BOTÃO "SOLUCIONADO" */}
              <div
                style={{
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  paddingTop: "1.25rem",
                  marginTop: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                    Resolução Técnica
                  </h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Quando o chamado for atendido e resolvido, defina-o como solucionado.
                  </p>
                </div>

                <div>
                  {selectedLog.status === "Solucionado" ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.625rem 1.25rem",
                        borderRadius: "8px",
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        color: "#34d399",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        boxShadow: "0 0 15px rgba(16, 185, 129, 0.2)",
                      }}
                    >
                      <CheckCircle2 size={18} />
                      <span>Solucionado</span>
                    </div>
                  ) : (
                    <button
                      id="btn-solucionado"
                      onClick={() => handleMarkSolved(selectedLog.id)}
                      disabled={isPending}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "8px",
                        backgroundColor: "#10b981",
                        border: "1px solid #059669",
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        cursor: isPending ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isPending) {
                          e.currentTarget.style.backgroundColor = "#059669";
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.6)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isPending) {
                          e.currentTarget.style.backgroundColor = "#10b981";
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.4)";
                        }
                      }}
                    >
                      {isPending ? (
                        <div
                          className="spinner"
                          style={{ width: "16px", height: "16px", borderTopColor: "white" }}
                        />
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <span>Solucionado</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                textAlign: "center",
                padding: "2rem",
              }}
            >
              <div>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "rgba(56, 189, 248, 0.1)",
                    color: "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1rem",
                  }}
                >
                  <Cog size={24} />
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Selecione um chamado ao lado para visualizar os detalhes e a opção de solucioná-lo
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Modal de Mídia */}
      {mediaModalOpen && mediaItems.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => setMediaModalOpen(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fechar */}
            <button
              onClick={() => setMediaModalOpen(false)}
              style={{
                position: "absolute",
                top: "-40px",
                right: "0",
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
              }}
            >
              <X size={24} />
            </button>

            {/* Conteúdo da mídia */}
            {isImage(mediaItems[mediaCurrentIndex]) ? (
              <img
                src={mediaItems[mediaCurrentIndex]}
                alt="Mídia anexada"
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  borderRadius: "8px",
                }}
              />
            ) : isVideo(mediaItems[mediaCurrentIndex]) ? (
              <video
                src={mediaItems[mediaCurrentIndex]}
                controls
                autoPlay
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  borderRadius: "8px",
                }}
              />
            ) : (
              <div
                style={{
                  padding: "3rem",
                  background: "#0d1322",
                  borderRadius: "12px",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                }}
              >
                <p style={{ color: "white", marginBottom: "1rem" }}>Arquivo anexado</p>
                <a
                  href={mediaItems[mediaCurrentIndex]}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}
                >
                  <Download size={16} /> Baixar / Visualizar Arquivo
                </a>
              </div>
            )}

            {/* Navegação caso tenha mais de 1 mídia */}
            {mediaItems.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  marginTop: "1rem",
                  color: "white",
                }}
              >
                <button
                  onClick={() =>
                    setMediaCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1))
                  }
                  className="btn-ghost"
                  style={{ padding: "0.4rem" }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: "0.85rem" }}>
                  {mediaCurrentIndex + 1} / {mediaItems.length}
                </span>
                <button
                  onClick={() =>
                    setMediaCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0))
                  }
                  className="btn-ghost"
                  style={{ padding: "0.4rem" }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
