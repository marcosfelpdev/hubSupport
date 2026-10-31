import React, { useState, useMemo } from "react";
import { Clock, Search, Cog, Lightbulb, Sparkles, ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { WorkLogItem } from "@/services/api";

interface RecentWorkLogsListProps {
  logs: WorkLogItem[];
  onSelectLog?: (log: WorkLogItem) => void;
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

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  if (!name) return "U";
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
        label: "Realizado",
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
        label: "Não realizado",
        color: "#f87171",
        bg: "rgba(239, 68, 68, 0.12)",
        border: "rgba(239, 68, 68, 0.3)",
      };
    default:
      return {
        label: status || "Registrado",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.12)",
        border: "rgba(148, 163, 184, 0.25)",
      };
  }
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    return `Ontem às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const RecentWorkLogsList: React.FC<RecentWorkLogsListProps> = ({ logs, onSelectLog }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !searchTerm.trim() ||
        log.requester?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.clientOrOffice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.reportedProblem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "0.875rem",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
        height: "100%",
        minHeight: "580px",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.25rem 1.25rem 1rem",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "rgba(15, 23, 42, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#818cf8",
              }}
            >
              <Clock size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                Últimos Atendimentos
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                Atendimentos registrados recentemente
              </p>
            </div>
          </div>

          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.2rem 0.6rem",
              borderRadius: "999px",
              backgroundColor: "rgba(99, 102, 241, 0.12)",
              color: "#a5b4fc",
              border: "1px solid rgba(99, 102, 241, 0.25)",
            }}
          >
            {filteredLogs.length} {filteredLogs.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {/* Busca rápida */}
        <div style={{ position: "relative", marginTop: "0.75rem" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            placeholder="Buscar por cliente, solicitante ou problema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.45rem 0.75rem 0.45rem 2.2rem",
              fontSize: "0.8rem",
              backgroundColor: "rgba(8, 12, 22, 0.7)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>

        {/* Filtro por status rápido */}
        <div
          style={{
            display: "flex",
            gap: "0.375rem",
            marginTop: "0.625rem",
            overflowX: "auto",
            paddingBottom: "0.2rem",
          }}
        >
          {["ALL", "Em andamento", "Realizado", "Aguardando reunião", "Solucionado"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                fontSize: "0.7rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid",
                borderColor: statusFilter === st ? "rgba(99, 102, 241, 0.5)" : "var(--border)",
                backgroundColor: statusFilter === st ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.02)",
                color: statusFilter === st ? "#ffffff" : "var(--text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {st === "ALL" ? "Todos" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Vertical */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.875rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
        }}
      >
        {filteredLogs.length === 0 ? (
          <div
            style={{
              padding: "2.5rem 1rem",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.825rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Clock size={28} style={{ opacity: 0.35, color: "var(--text-muted)" }} />
            <span>Nenhum atendimento encontrado.</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const statusConfig = getStatusBadgeConfig(log.status);
            const isExpanded = expandedLogId === log.id;
            const hasAiReport = !!log.aiReport;

            return (
              <div
                key={log.id}
                onClick={() => onSelectLog?.(log)}
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.5)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.625rem",
                  padding: "0.75rem 0.875rem",
                  transition: "all 0.15s ease",
                  cursor: onSelectLog ? "pointer" : "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.35)";
                  e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.85)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.5)";
                }}
              >
                {/* Linha 1: Solicitante, Cliente e Status */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: getAvatarColor(log.userId || log.id),
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(log.requester)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.requester}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.clientOrOffice}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "0.375rem",
                      color: statusConfig.color,
                      backgroundColor: statusConfig.bg,
                      border: `1px solid ${statusConfig.border}`,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Linha 2: Problema Relatado */}
                <div style={{ marginTop: "0.5rem" }}>
                  <p
                    style={{
                      fontSize: "0.775rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.35,
                      display: isExpanded ? "block" : "-webkit-box",
                      WebkitLineClamp: isExpanded ? undefined : 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    <strong style={{ color: "#cbd5e1" }}>Problema: </strong>
                    {log.reportedProblem}
                  </p>
                </div>

                {/* Linha expandida com Ação Realizada */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      paddingTop: "0.5rem",
                      borderTop: "1px dashed rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <p style={{ fontSize: "0.775rem", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                      <strong style={{ color: "#34d399" }}>Ação Realizada: </strong>
                      {log.actionTaken}
                    </p>
                  </div>
                )}

                {/* Linha 3: Badges de Tipo e Rodapé */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "0.625rem",
                    paddingTop: "0.4rem",
                    borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                    {log.technicalAction && (
                      <span
                        title="Ação técnica solicitada"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          backgroundColor: "rgba(168, 85, 247, 0.15)",
                          color: "#c084fc",
                          border: "1px solid rgba(168, 85, 247, 0.3)",
                        }}
                      >
                        <Cog size={10} /> Técnica
                      </span>
                    )}

                    {log.implementation && (
                      <span
                        title="Sugestão de implementação"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          color: "#fbbf24",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        <Lightbulb size={10} /> Melhoria
                      </span>
                    )}

                    {hasAiReport && (
                      <span
                        title="Possui relatório gerado por IA"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          backgroundColor: "rgba(99, 102, 241, 0.15)",
                          color: "#818cf8",
                          border: "1px solid rgba(99, 102, 241, 0.3)",
                        }}
                      >
                        <Sparkles size={10} /> IA
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                      {formatRelativeTime(log.createdAt)}
                    </span>
                    <button
                      onClick={(e) => toggleExpand(log.id, e)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: "0.1rem",
                      }}
                      title={isExpanded ? "Recolher" : "Expandir"}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
