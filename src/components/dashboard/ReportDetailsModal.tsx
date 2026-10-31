import React from "react";
import { X, CheckCircle2, Download, Sparkles, FileText, Clock, User, Building, AlertCircle } from "lucide-react";
import { WorkLogItem, api } from "@/services/api";

interface ReportDetailsModalProps {
  log: WorkLogItem | null;
  onClose: () => void;
}

interface StructuredReportData {
  title?: string;
  subtitle?: string;
  date?: string;
  department?: string;
  participants?: string;
  platformAnalyzed?: string;
  executiveSummary?: string;
  proposals?: Array<{
    item: string;
    description: string;
    category?: string;
    priority?: string;
  }>;
  detailingTopic?: string;
  detailingParagraphs?: string[];
  referrals?: string;
  transcript?: Array<{
    speaker: string;
    role?: string;
    timestamp?: string;
    text: string;
  }>;
}

export const ReportDetailsModal: React.FC<ReportDetailsModalProps> = ({ log, onClose }) => {
  if (!log) return null;

  let structured: StructuredReportData | null = null;
  if (log.aiReport?.structuredData) {
    try {
      structured = JSON.parse(log.aiReport.structuredData);
    } catch {
      // ignore
    }
  }

  const isSolved = log.status === "Solucionado";
  const hasPdf = !!log.aiReport?.pdfPath;

  const formattedDate = new Date(log.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: isSolved ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)",
                border: `1px solid ${isSolved ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isSolved ? "#34d399" : "#818cf8",
              }}
            >
              {isSolved ? <CheckCircle2 size={18} /> : <FileText size={18} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {log.clientOrOffice}
                </h3>
                {isSolved && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    Solucionado
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                Solicitante: <strong style={{ color: "#e2e8f0" }}>{log.requester}</strong> • Registrado em {formattedDate}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: "1.5rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Card: Problema e Ação */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "0.5rem",
                }}
              >
                Problema Relatado
              </span>
              <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                {log.reportedProblem}
              </p>
            </div>

            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "0.75rem",
                padding: "1rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#34d399",
                  display: "block",
                  marginBottom: "0.5rem",
                }}
              >
                Solução / Ação Realizada
              </span>
              <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                {log.actionTaken}
              </p>
            </div>
          </div>

          {/* Relatório Estruturado de IA se houver */}
          {structured ? (
            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.5)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Sparkles size={16} style={{ color: "#a5b4fc" }} />
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e0e7ff" }}>
                    {structured.title || "Relatório Executivo de IA"}
                  </h4>
                </div>

                {hasPdf && (
                  <a
                    href={api.worklogs.getDownloadReportUrl(log.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.5rem",
                      backgroundColor: "#6366f1",
                      color: "#ffffff",
                      textDecoration: "none",
                      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    <Download size={13} /> Baixar PDF Oficial
                  </a>
                )}
              </div>

              {structured.executiveSummary && (
                <div style={{ marginBottom: "1rem" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Resumo Executivo
                  </span>
                  <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {structured.executiveSummary}
                  </p>
                </div>
              )}

              {structured.proposals && structured.proposals.length > 0 && (
                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Propostas & Melhorias Identificadas
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {structured.proposals.map((prop, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: "rgba(8, 12, 22, 0.6)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.5rem",
                          padding: "0.6rem 0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {prop.item}
                          </span>
                          {prop.priority && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                padding: "0.1rem 0.35rem",
                                borderRadius: "4px",
                                backgroundColor:
                                  prop.priority === "Alta"
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : "rgba(59, 130, 246, 0.15)",
                                color: prop.priority === "Alta" ? "#fca5a5" : "#93c5fd",
                              }}
                            >
                              {prop.priority}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          {prop.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : hasPdf ? (
            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.5)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileText size={18} style={{ color: "#a5b4fc" }} />
                <span style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500 }}>
                  Relatório PDF gerado para este atendimento
                </span>
              </div>
              <a
                href={api.worklogs.getDownloadReportUrl(log.id)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  padding: "0.35rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#6366f1",
                  color: "#ffffff",
                  textDecoration: "none",
                }}
              >
                <Download size={13} /> Baixar PDF
              </a>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--border)",
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontSize: "0.825rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
