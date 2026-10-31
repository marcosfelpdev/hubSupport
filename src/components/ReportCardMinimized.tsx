import React from "react";
import { Sparkles } from "lucide-react";
import { hexToRgba } from "./TagBadge";

export interface ReportCardMinimizedLog {
  id: string;
  requester?: string;
  clientOrOffice?: string;
  reportedProblem?: string;
  actionTaken?: string;
  status: string;
  createdAt: Date | string;
  technicalAction?: boolean;
  implementation?: boolean;
  userId?: string;
  user?: {
    name?: string;
    email?: string;
  } | null;
  tagId?: string | null;
  tag?: {
    id: string;
    name: string;
    color: string;
  } | null;
  aiReport?: any;
}

export interface ReportCardMinimizedProps {
  log: ReportCardMinimizedLog;
  isSelected?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  dataCardId?: string;
}

function getStatusPill(status: string) {
  const norm = (status || "").toLowerCase().trim();

  if (
    norm === "solucionado" ||
    norm === "finalizadas" ||
    norm === "finalizado" ||
    norm === "concluído" ||
    norm === "concluido" ||
    norm === "realizado" ||
    norm === "já realizado"
  ) {
    return {
      label: "Solucionado",
      color: "#34d399",
      bg: "rgba(6, 78, 59, 0.4)",
      border: "1px solid rgba(16, 185, 129, 0.4)",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em progresso",
      color: "#60a5fa",
      bg: "rgba(30, 58, 138, 0.35)",
      border: "1px solid rgba(59, 130, 246, 0.4)",
    };
  }

  if (
    norm === "pendências" ||
    norm === "pendencias" ||
    norm === "pendente" ||
    norm === "aguardando reunião" ||
    norm === "aguardando reuniao"
  ) {
    return {
      label: "Pendência",
      color: "#fbbf24",
      bg: "rgba(120, 53, 15, 0.4)",
      border: "1px solid rgba(245, 158, 11, 0.4)",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não realizado",
      color: "#f87171",
      bg: "rgba(136, 19, 55, 0.4)",
      border: "1px solid rgba(239, 68, 68, 0.4)",
    };
  }

  if (norm === "backlog") {
    return {
      label: "Backlog",
      color: "#818cf8",
      bg: "rgba(49, 46, 129, 0.4)",
      border: "1px solid rgba(99, 102, 241, 0.4)",
    };
  }

  return {
    label: status || "Registrado",
    color: "#cbd5e1",
    bg: "rgba(30, 41, 59, 0.5)",
    border: "1px solid rgba(71, 85, 105, 0.5)",
  };
}

function getFooterConfig(technicalAction?: boolean, implementation?: boolean) {
  if (technicalAction && implementation) {
    return {
      label: "Ação Técnica · Implementação",
      color: "#fbbf24",
      bg: "rgba(120, 53, 15, 0.35)",
      borderTop: "1px solid rgba(180, 83, 9, 0.5)",
    };
  }
  if (technicalAction) {
    return {
      label: "Ação Técnica",
      color: "#fb923c",
      bg: "rgba(124, 45, 18, 0.3)",
      borderTop: "1px solid rgba(194, 65, 12, 0.5)",
    };
  }
  if (implementation) {
    return {
      label: "Implementação",
      color: "#c084fc",
      bg: "rgba(76, 29, 149, 0.3)",
      borderTop: "1px solid rgba(109, 40, 217, 0.5)",
    };
  }
  return {
    label: "Atendimento",
    color: "#22d3ee",
    bg: "rgba(22, 78, 99, 0.3)",
    borderTop: "1px solid rgba(14, 116, 144, 0.5)",
  };
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export const ReportCardMinimized: React.FC<ReportCardMinimizedProps> = ({
  log,
  isSelected = false,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging = false,
  className = "",
  style = {},
  id,
  dataCardId,
}) => {
  const statusPill = getStatusPill(log.status);
  const footerConfig = getFooterConfig(log.technicalAction, log.implementation);
  const formattedDate = formatDate(log.createdAt);
  const hasAiReport = !!log.aiReport;

  const tagColor = log.tag?.color || "#06b6d4";
  const tagBg = log.tag ? hexToRgba(tagColor, 0.25) : "rgba(6, 182, 212, 0.25)";
  const tagBorder = log.tag ? hexToRgba(tagColor, 0.4) : "rgba(6, 182, 212, 0.4)";
  const tagName = log.tag?.name || "Geral";

  return (
    <div
      id={id}
      data-card-id={dataCardId || log.id}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      style={{
        width: "100%",
        height: "204px",
        minHeight: "204px",
        maxHeight: "204px",
        backgroundColor: "#161a23",
        border: isSelected ? "1.5px solid #06b6d4" : "1px solid #1e293b",
        boxShadow: isSelected
          ? "0 0 15px rgba(6, 182, 212, 0.25), 0 10px 25px -5px rgba(0, 0, 0, 0.5)"
          : "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
        transition: "all 0.15s ease",
        position: "relative",
        userSelect: "none",
        cursor: draggable ? "grab" : "pointer",
        opacity: isDragging ? 0.35 : 1,
        ...style,
      }}
      className={`card-hover ${className}`}
    >
      {/* Conteúdo com padding e espaçamento estritamente baseado na referência */}
      <div
        style={{
          padding: "0.875rem 1rem 0.65rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          flex: 1,
          justifyContent: "space-between",
          minHeight: 0,
        }}
      >
        {/* Linha 1: Plataforma & Status */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              padding: "0.125rem 0.625rem",
              borderRadius: "0.25rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: tagColor,
              backgroundColor: tagBg,
              border: `1px solid ${tagBorder}`,
              maxWidth: "140px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "inline-block",
            }}
            title={tagName}
          >
            {tagName}
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexShrink: 0,
            }}
          >
            {hasAiReport && (
              <span
                title="Relatório de IA disponível"
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "#818cf8",
                }}
              >
                <Sparkles size={12} />
              </span>
            )}
            <span
              style={{
                padding: "0.125rem 0.5rem",
                borderRadius: "9999px",
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: statusPill.color,
                backgroundColor: statusPill.bg,
                border: statusPill.border,
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
            >
              {statusPill.label}
            </span>
          </div>
        </div>

        {/* Linha 2: Descrição com tamanho padrão imutável de até 3 linhas e fade-out */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{
              color: "#e26b6b",
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
            }}
          >
            Descrição
          </span>
          <div
            style={{
              position: "relative",
              height: "44px",
              maxHeight: "44px",
              overflow: "hidden",
              marginTop: "0.125rem",
            }}
          >
            <p
              style={{
                color: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 600,
                lineHeight: "15px",
                margin: 0,
                padding: 0,
                wordBreak: "break-word",
                whiteSpace: "normal",
              }}
            >
              {log.reportedProblem || "Sem descrição informada."}
            </p>
            {/* Fade-out suave ao bater no limite de 3 linhas do card */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "12px",
                background: "linear-gradient(to top, #161a23 15%, transparent 100%)",
                pointerEvents: "none",
              }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Linha 3: Divisor */}
        <div
          style={{
            height: "1px",
            backgroundColor: "rgba(51, 65, 85, 0.7)",
            width: "100%",
            margin: "0.125rem 0",
          }}
        />

        {/* Linha 4: Solicitante & Data */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.125rem",
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                color: "#64748b",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              Solicitante
            </span>
            <div
              style={{
                fontSize: "0.75rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontWeight: 500, color: "#e2e8f0" }}>
                {log.requester || "Não informado"}
              </span>
              {log.clientOrOffice && (
                <span style={{ color: "#94a3b8" }}>
                  {" "}· {log.clientOrOffice}
                </span>
              )}
            </div>
          </div>
          <span
            style={{
              color: "#64748b",
              fontSize: "11px",
              fontWeight: 500,
              flexShrink: 0,
              marginLeft: "0.25rem",
            }}
          >
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Rodapé: Categoria do Atendimento (Atendimento / Ação Técnica / Implementação) */}
      <div
        style={{
          width: "100%",
          padding: "0.25rem 0.5rem",
          fontSize: "9px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
          textAlign: "center",
          flexShrink: 0,
          color: footerConfig.color,
          backgroundColor: footerConfig.bg,
          borderTop: footerConfig.borderTop,
        }}
      >
        {footerConfig.label}
      </div>
    </div>
  );
};

export default ReportCardMinimized;
