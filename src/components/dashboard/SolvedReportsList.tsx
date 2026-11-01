import React, { useState, useMemo } from "react";
import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { WorkLogItem } from "@/services/api";
import ReportCardMinimized from "@/components/ReportCardMinimized";

interface SolvedReportsListProps {
  logs: WorkLogItem[];
  onSelectReport?: (log: WorkLogItem) => void;
}

export const SolvedReportsList: React.FC<SolvedReportsListProps> = ({ logs, onSelectReport }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const solvedLogs = useMemo(() => {
    return logs.filter((log) => {
      const isSolved = log.status === "Solucionado";
      if (!isSolved) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        log.title?.toLowerCase().includes(term) ||
        log.requester?.toLowerCase().includes(term) ||
        log.clientOrOffice?.toLowerCase().includes(term) ||
        log.actionTaken?.toLowerCase().includes(term) ||
        log.reportedProblem?.toLowerCase().includes(term) ||
        log.tag?.name?.toLowerCase().includes(term)
      );
    });
  }, [logs, searchTerm]);

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
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#34d399",
              }}
            >
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                Relatórios Solucionados
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                Chamados marcados como Solucionado pelo técnico
              </p>
            </div>
          </div>

          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.2rem 0.6rem",
              borderRadius: "999px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >
            {solvedLogs.length} {solvedLogs.length === 1 ? "solucionado" : "solucionados"}
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
        {solvedLogs.length === 0 ? (
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
            <ShieldCheck size={28} style={{ opacity: 0.35, color: "var(--text-muted)" }} />
            <span>Nenhum relatório solucionado encontrado.</span>
          </div>
        ) : (
          solvedLogs.map((log) => (
            <ReportCardMinimized
              key={log.id}
              log={log}
              onClick={() => onSelectReport?.(log)}
            />
          ))
        )}
      </div>
    </div>
  );
};
