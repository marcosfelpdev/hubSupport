"use client";

import { useState, useEffect, useTransition } from "react";
import { Sparkles, Download, RotateCw, Clock, AlertTriangle, CheckCircle2, FileText, Loader2, Video } from "lucide-react";
import { api } from "@/services/api";

interface AiReportData {
  id: string;
  status: string; // "pending" | "processing" | "completed" | "failed"
  videoPath?: string | null;
  pdfPath?: string | null;
  structuredData?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}

interface AiReportSectionProps {
  workLogId: string;
  initialReport?: AiReportData | null;
}

export default function AiReportSection({
  workLogId,
  initialReport,
}: AiReportSectionProps) {
  const [report, setReport] = useState<AiReportData | null>(initialReport ?? null);
  const [isRetrying, startRetryTransition] = useTransition();
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  // Sincroniza estado quando o atendimento selecionado muda
  useEffect(() => {
    setReport(initialReport ?? null);
    setRetryFeedback(null);
  }, [workLogId, initialReport]);

  // Polling leve enquanto estiver nos estados "pending" ou "processing"
  useEffect(() => {
    if (!report || (report.status !== "pending" && report.status !== "processing")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await api.worklogs.getAiStatus(workLogId);
        if (updated) {
          setReport((prev) => ({
            ...prev,
            ...updated,
          }));
        }
      } catch (err) {
        console.error("Erro ao verificar status do relatório:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [workLogId, report?.status]);

  if (!report) {
    return null;
  }

  const handleRetry = () => {
    setRetryFeedback(null);
    startRetryTransition(async () => {
      try {
        await api.worklogs.retryAi(workLogId);
        setReport((prev) =>
          prev
            ? {
                ...prev,
                status: "pending",
                errorMessage: null,
              }
            : null
        );
      } catch (err) {
        setRetryFeedback(err instanceof Error ? err.message : "Erro ao tentar novamente.");
      }
    });
  };

  const getStatusBadge = () => {
    switch (report.status) {
      case "pending":
        return {
          label: "Aguardando",
          bg: "rgba(245, 158, 11, 0.12)",
          color: "#fbbf24",
          border: "rgba(245, 158, 11, 0.3)",
          icon: <Clock size={12} />,
        };
      case "processing":
        return {
          label: "Processando IA",
          bg: "rgba(99, 102, 241, 0.15)",
          color: "#818cf8",
          border: "rgba(99, 102, 241, 0.35)",
          icon: <Loader2 size={12} className="animate-spin" />,
        };
      case "completed":
        return {
          label: "Disponível",
          bg: "rgba(16, 185, 129, 0.15)",
          color: "#34d399",
          border: "rgba(16, 185, 129, 0.35)",
          icon: <CheckCircle2 size={12} />,
        };
      case "failed":
        return {
          label: "Falha",
          bg: "rgba(239, 68, 68, 0.15)",
          color: "#f87171",
          border: "rgba(239, 68, 68, 0.35)",
          icon: <AlertTriangle size={12} />,
        };
      default:
        return {
          label: report.status,
          bg: "rgba(255, 255, 255, 0.05)",
          color: "var(--text-muted)",
          border: "var(--border)",
          icon: <FileText size={12} />,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(99, 102, 241, 0.25)",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "1rem",
        position: "relative",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Header da seção */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3))",
              border: "1px solid rgba(168, 85, 247, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c084fc",
            }}
          >
            <Sparkles size={15} />
          </div>
          <div>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Relatório gerado por IA
            </h3>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              Gerado a partir da gravação de tela com Google Gemini
            </span>
          </div>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.2rem 0.55rem",
            borderRadius: "9999px",
            fontSize: "0.7rem",
            fontWeight: 600,
            color: badge.color,
            background: badge.bg,
            border: `1px solid ${badge.border}`,
          }}
        >
          {badge.icon}
          {badge.label}
        </span>
      </div>

      {/* Conteúdo baseado no estado */}
      {report.status === "pending" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            padding: "0.75rem",
            background: "rgba(245, 158, 11, 0.06)",
            border: "1px dashed rgba(245, 158, 11, 0.25)",
            borderRadius: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", color: "#fde68a", fontSize: "0.8rem" }}>
            <Clock size={16} className="animate-pulse" />
            <span>A gravação foi recebida e está aguardando o início da análise pela inteligência artificial.</span>
          </div>

          {report.videoPath && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording-pending"
                style={{
                  fontSize: "0.75rem",
                  color: "#a5b4fc",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "5px",
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  transition: "all 0.2s",
                }}
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} color="#818cf8" />
                Baixar gravação de vídeo
              </a>
            </div>
          )}
        </div>
      )}

      {report.status === "processing" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
            padding: "0.875rem",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", color: "#a5b4fc", fontSize: "0.825rem" }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontWeight: 500 }}>
              A IA está analisando o vídeo e estruturando o relatório em PDF...
            </span>
          </div>
          {/* Barra de progresso animada */}
          <div
            style={{
              width: "100%",
              height: "4px",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "2px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "45%",
                height: "100%",
                background: "linear-gradient(90deg, #6366f1, #a855f7)",
                borderRadius: "2px",
                animation: "pulse 1.5s infinite",
              }}
            />
          </div>

          {report.videoPath && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording-processing"
                style={{
                  fontSize: "0.75rem",
                  color: "#a5b4fc",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "5px",
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  transition: "all 0.2s",
                }}
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} color="#818cf8" />
                Baixar gravação
              </a>
            </div>
          )}
        </div>
      )}

      {report.status === "completed" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileText size={18} color="#34d399" />
            <div>
              <p style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Relatório executivo estruturado
              </p>
              {report.completedAt && (
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>
                  Gerado em {new Date(report.completedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {report.videoPath && (
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording"
                style={{
                  padding: "0.5rem 0.875rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  background: "rgba(99, 102, 241, 0.15)",
                  border: "1px solid rgba(99, 102, 241, 0.35)",
                  color: "#c7d2fe",
                  borderRadius: "6px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                title="Baixar arquivo da gravação de tela com áudio"
              >
                <Video size={14} color="#818cf8" />
                Baixar gravação
              </a>
            )}

            <a
              href={`/api/reports/${workLogId}/download`}
              target="_blank"
              rel="noopener noreferrer"
              download
              id="btn-download-pdf"
              className="btn-primary"
              style={{
                padding: "0.5rem 0.875rem",
                fontSize: "0.8rem",
                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Download size={14} />
              Baixar relatório PDF
            </a>
          </div>
        </div>
      )}

      {report.status === "failed" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
            padding: "0.75rem",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <AlertTriangle size={16} color="#f87171" style={{ marginTop: "2px", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.825rem", fontWeight: 600, color: "#fca5a5", margin: "0 0 0.25rem 0" }}>
                Não foi possível gerar o relatório
              </p>
              <p style={{ fontSize: "0.75rem", color: "#f87171", margin: 0 }}>
                {report.errorMessage || "Ocorreu um erro no processamento com a IA. Tente novamente."}
              </p>
              {retryFeedback && (
                <p style={{ fontSize: "0.75rem", color: "#fbbf24", marginTop: "0.25rem" }}>
                  {retryFeedback}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            {report.videoPath && (
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording-failed"
                style={{
                  fontSize: "0.75rem",
                  color: "#a5b4fc",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.35rem 0.7rem",
                  borderRadius: "4px",
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                }}
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} color="#818cf8" />
                Baixar gravação
              </a>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="btn-ghost"
              style={{
                padding: "0.35rem 0.7rem",
                fontSize: "0.75rem",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "4px",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              <RotateCw size={13} className={isRetrying ? "animate-spin" : ""} />
              {isRetrying ? "Reiniciando..." : "Tentar novamente"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
