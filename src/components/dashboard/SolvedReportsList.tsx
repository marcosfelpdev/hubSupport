import React, { useState, useMemo } from "react";
import { CheckCircle2, Search, Download, FileText, Sparkles, Cog, Lightbulb, ExternalLink, ShieldCheck } from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import TagBadge from "@/components/TagBadge";

interface SolvedReportsListProps {
  logs: WorkLogItem[];
  onSelectReport?: (log: WorkLogItem) => void;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tryParseAiTitle(structuredDataStr?: string | null): string | null {
  if (!structuredDataStr) return null;
  try {
    const data = JSON.parse(structuredDataStr);
    return data.title || null;
  } catch {
    return null;
  }
}

export const SolvedReportsList: React.FC<SolvedReportsListProps> = ({ logs, onSelectReport }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const solvedLogs = useMemo(() => {
    return logs.filter((log) => {
      const isSolved = log.status === "Solucionado";
      if (!isSolved) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const aiTitle = tryParseAiTitle(log.aiReport?.structuredData)?.toLowerCase() || "";
      return (
        log.requester?.toLowerCase().includes(term) ||
        log.clientOrOffice?.toLowerCase().includes(term) ||
        log.actionTaken?.toLowerCase().includes(term) ||
        log.reportedProblem?.toLowerCase().includes(term) ||
        log.tag?.name?.toLowerCase().includes(term) ||
        aiTitle.includes(term)
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
          gap: "0.625rem",
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
          solvedLogs.map((log) => {
            const aiTitle = tryParseAiTitle(log.aiReport?.structuredData);
            const hasPdf = !!log.aiReport?.pdfPath;

            return (
              <div
                key={log.id}
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.55)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: "0.625rem",
                  padding: "0.875rem",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.4)";
                  e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.85)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.2)";
                  e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.55)";
                }}
              >
                {/* Linha 1: Status badge e dados do cliente */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.clientOrOffice}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Solicitante: <strong style={{ color: "#cbd5e1" }}>{log.requester}</strong>
                    </span>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      padding: "0.15rem 0.5rem",
                      borderRadius: "0.375rem",
                      color: "#34d399",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={12} /> Solucionado
                  </span>
                </div>

                {/* Título do Relatório de IA se existir */}
                {aiTitle && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.375rem",
                      backgroundColor: "rgba(99, 102, 241, 0.08)",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#a5b4fc", fontSize: "0.7rem", fontWeight: 600 }}>
                      <Sparkles size={11} />
                      <span>{aiTitle}</span>
                    </div>
                  </div>
                )}

                {/* Linha 2: Solução aplicada */}
                <div style={{ marginTop: "0.5rem" }}>
                  <p
                    style={{
                      fontSize: "0.775rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    <strong style={{ color: "#34d399" }}>Solução: </strong>
                    {log.actionTaken}
                  </p>
                  <p
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      marginTop: "0.25rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    <strong style={{ color: "#94a3b8" }}>Origem: </strong>
                    {log.reportedProblem}
                  </p>
                </div>

                {/* Linha 3: Tags e Ações */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "0.625rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    {log.tag && (
                      <TagBadge name={log.tag.name} color={log.tag.color} size="sm" />
                    )}

                    {log.technicalAction && (
                      <span
                        title="Ação técnica"
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          backgroundColor: "rgba(168, 85, 247, 0.12)",
                          color: "#c084fc",
                          border: "1px solid rgba(168, 85, 247, 0.25)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Cog size={10} /> Técnica
                      </span>
                    )}

                    {log.implementation && (
                      <span
                        title="Sugestão de melhoria"
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          backgroundColor: "rgba(245, 158, 11, 0.12)",
                          color: "#fbbf24",
                          border: "1px solid rgba(245, 158, 11, 0.25)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Lightbulb size={10} /> Melhoria
                      </span>
                    )}

                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                      {formatDate(log.createdAt)}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    {hasPdf && (
                      <a
                        href={api.worklogs.getDownloadReportUrl(log.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Baixar Relatório em PDF"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.375rem",
                          backgroundColor: "rgba(99, 102, 241, 0.15)",
                          border: "1px solid rgba(99, 102, 241, 0.35)",
                          color: "#a5b4fc",
                          textDecoration: "none",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.3)";
                          e.currentTarget.style.color = "#ffffff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.15)";
                          e.currentTarget.style.color = "#a5b4fc";
                        }}
                      >
                        <Download size={11} /> PDF
                      </a>
                    )}

                    {onSelectReport && (
                      <button
                        onClick={() => onSelectReport(log)}
                        title="Ver detalhes completos do relatório"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.7rem",
                          fontWeight: 500,
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.375rem",
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                          e.currentTarget.style.color = "var(--text-primary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }}
                      >
                        <FileText size={11} /> Detalhes
                      </button>
                    )}
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
