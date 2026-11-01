import React from "react";
import { Sparkles, Maximize2, Paperclip } from "lucide-react";
import { hexToRgba } from "./TagBadge";

export interface ReportCardMinimizedLog {
  id: string;
  title?: string;
  requester?: string;
  clientOrOffice?: string;
  reportedProblem?: string;
  actionTaken?: string;
  status: string;
  createdAt: Date | string;
  technicalAction?: boolean;
  implementation?: boolean;
  media?: string;
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

interface StatusPillConfig {
  label: string;
  badgeClass: string;
  color: string;
  bg: string;
  border: string;
}

function getStatusPill(status: string): StatusPillConfig {
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
      badgeClass: "text-emerald-400 bg-emerald-950/40 border border-emerald-500/40",
      color: "#34d399",
      bg: "rgba(6, 78, 59, 0.4)",
      border: "1px solid rgba(16, 185, 129, 0.4)",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em progresso",
      badgeClass: "text-blue-400 bg-blue-950/40 border border-blue-500/40",
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
      badgeClass: "text-amber-400 bg-amber-950/40 border border-amber-500/40",
      color: "#fbbf24",
      bg: "rgba(120, 53, 15, 0.4)",
      border: "1px solid rgba(245, 158, 11, 0.4)",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não realizado",
      badgeClass: "text-rose-400 bg-rose-950/40 border border-rose-500/40",
      color: "#f87171",
      bg: "rgba(136, 19, 55, 0.4)",
      border: "1px solid rgba(239, 68, 68, 0.4)",
    };
  }

  if (norm === "backlog") {
    return {
      label: "Backlog",
      badgeClass: "text-indigo-400 bg-indigo-950/40 border border-indigo-500/40",
      color: "#818cf8",
      bg: "rgba(49, 46, 129, 0.4)",
      border: "1px solid rgba(99, 102, 241, 0.4)",
    };
  }

  return {
    label: status || "Registrado",
    badgeClass: "text-slate-300 bg-slate-800/50 border border-slate-700/50",
    color: "#cbd5e1",
    bg: "rgba(30, 41, 59, 0.5)",
    border: "1px solid rgba(71, 85, 105, 0.5)",
  };
}

interface FooterConfig {
  label: string;
  badgeClass: string;
  color: string;
  bg: string;
  borderTop: string;
}

function getFooterConfig(technicalAction?: boolean, implementation?: boolean): FooterConfig {
  if (technicalAction && implementation) {
    return {
      label: "Ação Técnica · Implementação",
      badgeClass: "text-amber-300 bg-amber-950/35 border-t border-amber-500/30",
      color: "#fbbf24",
      bg: "rgba(120, 53, 15, 0.35)",
      borderTop: "1px solid rgba(180, 83, 9, 0.5)",
    };
  }
  if (technicalAction) {
    return {
      label: "Ação Técnica",
      badgeClass: "text-orange-300 bg-orange-950/30 border-t border-orange-500/30",
      color: "#fb923c",
      bg: "rgba(124, 45, 18, 0.3)",
      borderTop: "1px solid rgba(194, 65, 12, 0.5)",
    };
  }
  if (implementation) {
    return {
      label: "Implementação",
      badgeClass: "text-purple-300 bg-purple-950/30 border-t border-purple-500/30",
      color: "#c084fc",
      bg: "rgba(76, 29, 149, 0.3)",
      borderTop: "1px solid rgba(109, 40, 217, 0.5)",
    };
  }
  return {
    label: "Atendimento",
    badgeClass: "text-cyan-300 bg-cyan-950/30 border-t border-cyan-500/30",
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

  const isAiGenerating = Boolean(
    log.aiReport &&
      (log.aiReport.status === "pending" ||
        log.aiReport.status === "processing" ||
        (!log.aiReport.pdfPath && log.aiReport.status !== "failed"))
  );

  const isAiCompleted = Boolean(
    log.aiReport &&
      (log.aiReport.status === "completed" || Boolean(log.aiReport.pdfPath))
  );

  const mediaCount = React.useMemo(() => {
    if (!log.media) return 0;
    try {
      const parsed = JSON.parse(log.media);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [log.media]);

  const tagColor = log.tag?.color || "#06b6d4";
  const tagBg = log.tag ? hexToRgba(tagColor, 0.2) : "rgba(6, 182, 212, 0.2)";
  const tagBorder = log.tag ? hexToRgba(tagColor, 0.35) : "rgba(6, 182, 212, 0.35)";
  const tagName = log.tag?.name || "Geral";
  const titleText = log.title || log.reportedProblem || "Sem título informado.";

  const cursorClasses = draggable
    ? "cursor-grab active:cursor-grabbing"
    : onClick
    ? "cursor-pointer"
    : "";

  const stateClasses = isDragging
    ? "opacity-40 scale-[0.98]"
    : isSelected
    ? "bg-[#182338] ring-2 ring-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.3)] border-sky-400/90 border-l-[4px] border-l-sky-400"
    : "border-slate-800/80 hover:border-slate-700 hover:shadow-xl hover:-translate-y-0.5";

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
      style={style}
      className={`group w-full shrink-0 min-h-[185px] h-[185px] bg-[#151c2c]/80 backdrop-blur-sm border rounded-xl overflow-hidden shadow-md flex flex-col justify-between transition-all duration-200 select-none ${cursorClasses} ${stateClasses} ${className}`.trim()}
    >
      {/* Conteúdo interno do card */}
      <div className="p-3.5 pb-2 flex flex-col justify-between flex-1 min-h-0 gap-1.5">
        {/* Linha Superior: Tag da Plataforma & Status / IA */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <span
            className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold max-w-[140px] truncate border select-none transition-colors"
            style={{
              color: tagColor,
              backgroundColor: tagBg,
              borderColor: tagBorder,
            }}
            title={tagName}
          >
            {tagName}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Indicador visual de Card Aberto / Maximizado */}
            {isSelected && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-xs animate-fade-in"
                title="Chamado aberto / maximizado"
              >
                <Maximize2 size={10} className="text-sky-400" />
                <span>Aberto</span>
              </span>
            )}

            {/* Símbolo de IA: piscando sutilmente enquanto processa, fixo quando concluído */}
            {isAiGenerating ? (
              <span
                title="IA gerando relatório PDF em segundo plano..."
                className="inline-flex items-center text-indigo-300 animate-sparkle cursor-help"
              >
                <Sparkles size={13} />
              </span>
            ) : isAiCompleted ? (
              <span
                title="Relatório de IA e PDF disponíveis"
                className="inline-flex items-center text-indigo-400 drop-shadow-[0_0_4px_rgba(129,140,248,0.5)]"
              >
                <Sparkles size={13} />
              </span>
            ) : null}

            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${statusPill.badgeClass}`}
            >
              {statusPill.label}
            </span>
          </div>
        </div>

        {/* Linha Central: Título com line-clamp-2 */}
        <div className="flex items-center justify-center my-auto min-h-[44px] px-1">
          <p
            title={titleText}
            className="text-sm font-semibold text-slate-100 text-center leading-snug line-clamp-2 break-words"
          >
            {titleText}
          </p>
        </div>

        {/* Linha Divisória Sutil */}
        <div className="w-full border-t border-slate-800/80 my-1 shrink-0" />

        {/* Linha Inferior: Solicitante, Empresa & Data */}
        <div className="flex items-end justify-between gap-2 min-w-0 shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Solicitante
            </span>
            <div
              className="text-xs truncate"
              title={`${log.requester || "Não informado"}${log.clientOrOffice ? ` · ${log.clientOrOffice}` : ""}`}
            >
              <span className="font-medium text-slate-300">
                {log.requester || "Não informado"}
              </span>
              {log.clientOrOffice && (
                <span className="text-slate-400"> · {log.clientOrOffice}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-1">
            {mediaCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60"
                title={`${mediaCount} mídia(s) anexada(s)`}
              >
                <Paperclip size={10} className="text-sky-400" />
                <span>{mediaCount}</span>
              </span>
            )}
            {formattedDate && (
              <span className="text-[11px] text-slate-500 font-medium">
                {formattedDate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé: Faixa de Categoria */}
      <div
        className={`w-full py-1 px-2 text-[9px] uppercase tracking-widest font-bold text-center shrink-0 ${footerConfig.badgeClass}`}
      >
        {footerConfig.label}
      </div>
    </div>
  );
};

export default ReportCardMinimized;
