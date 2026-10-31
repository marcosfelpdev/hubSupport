import React, { useState, useMemo } from "react";
import { Clock, Search } from "lucide-react";
import { WorkLogItem } from "@/services/api";
import ReportCardMinimized from "@/components/ReportCardMinimized";

interface RecentWorkLogsListProps {
  logs: WorkLogItem[];
  onSelectLog?: (log: WorkLogItem) => void;
}

export const RecentWorkLogsList: React.FC<RecentWorkLogsListProps> = ({ logs, onSelectLog }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !searchTerm.trim() ||
        log.requester?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.clientOrOffice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.reportedProblem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.tag?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

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
            placeholder="Buscar por cliente, solicitante, plataforma..."
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
          gap: "0.75rem",
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
          filteredLogs.map((log) => (
            <ReportCardMinimized
              key={log.id}
              log={log}
              onClick={() => onSelectLog?.(log)}
            />
          ))
        )}
      </div>
    </div>
  );
};
