import React from "react";
import { Sparkles, Maximize2, Paperclip } from "lucide-react";
import TagBadge from "./TagBadge";

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
  dotClass: string;
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
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dotClass: "bg-emerald-500",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em progresso",
      badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
      dotClass: "bg-sky-500",
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
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
      dotClass: "bg-amber-500",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não realizado",
      badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
      dotClass: "bg-rose-500",
    };
  }

  if (norm === "backlog") {
    return {
      label: "Backlog",
      badgeClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",
      dotClass: "bg-indigo-500",
    };
  }

  return {
    label: status || "Registrado",
    badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
    dotClass: "bg-slate-400",
  };
}

interface FooterConfig {
  label: string;
  badgeClass: string;
}

function getFooterConfig(technicalAction?: boolean, implementation?: boolean): FooterConfig {
  if (technicalAction && implementation) {
    return {
      label: "Ação Técnica · Implementação",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80",
    };
  }
  if (technicalAction) {
    return {
      label: "Ação Técnica",
      badgeClass: "bg-orange-50 text-orange-800 border-orange-200/80",
    };
  }
  if (implementation) {
    return {
      label: "Implementação",
      badgeClass: "bg-purple-50 text-purple-800 border-purple-200/80",
    };
  }
  return {
    label: "Atendimento",
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200/80",
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

  const tagColor = log.tag?.color || "#0284c7";
  const tagName = log.tag?.name || "Geral";
  const titleText = log.title || log.reportedProblem || "Sem título informado.";

  const cursorClasses = draggable
    ? "cursor-grab active:cursor-grabbing"
    : onClick
    ? "cursor-pointer"
    : "";

  const stateClasses = isDragging
    ? "opacity-50 scale-[0.98] border-dashed border-sky-400 shadow-md"
    : isSelected
    ? "ring-2 ring-slate-900 border-slate-900 shadow-md"
    : "border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md";

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
      className={`group w-full shrink-0 min-h-[185px] h-[185px] bg-white hover:bg-white border rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-200 select-none ${cursorClasses} ${stateClasses} ${className}`.trim()}
    >
      {/* Conteúdo interno do card */}
      <div className="p-3.5 pb-2 flex flex-col justify-between flex-1 min-h-0 gap-1.5">
        {/* Linha Superior: TagBadge com dot + Badge de status em pill com indicator dot */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <TagBadge name={tagName} color={tagColor} size="sm" />

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Indicador visual de Card Aberto / Maximizado */}
            {isSelected && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-white shadow-xs animate-fade-in"
                title="Chamado aberto"
              >
                <Maximize2 size={10} className="text-white" />
                <span>Aberto</span>
              </span>
            )}

            {/* Símbolo de IA: piscando sutilmente enquanto processa, fixo quando concluído */}
            {isAiGenerating ? (
              <span
                title="IA gerando relatório PDF em segundo plano..."
                className="inline-flex items-center text-indigo-600 animate-sparkle cursor-help"
              >
                <Sparkles size={13} />
              </span>
            ) : isAiCompleted ? (
              <span
                title="Relatório de IA e PDF disponíveis"
                className="inline-flex items-center text-indigo-600"
              >
                <Sparkles size={13} />
              </span>
            ) : null}

            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shadow-xs ${statusPill.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusPill.dotClass}`} />
              <span>{statusPill.label}</span>
            </span>
          </div>
        </div>

        {/* Linha Central: Título com line-clamp-2 */}
        <div className="flex items-center justify-start my-auto min-h-[42px] px-0.5">
          <p
            title={titleText}
            className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 break-words"
          >
            {titleText}
          </p>
        </div>

        {/* Linha Divisória Sutil */}
        <div className="w-full border-t border-slate-100 my-1 shrink-0" />

        {/* Linha Inferior: Solicitante, Empresa & Data */}
        <div className="flex items-end justify-between gap-2 min-w-0 shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Solicitante
            </span>
            <div
              className="text-xs truncate font-semibold text-slate-700"
              title={`${log.requester || "Não informado"}${log.clientOrOffice ? ` · ${log.clientOrOffice}` : ""}`}
            >
              <span>{log.requester || "Não informado"}</span>
              {log.clientOrOffice && (
                <span className="text-slate-500 font-normal"> · {log.clientOrOffice}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {mediaCount > 0 && (
              <span
                className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-2 py-0.5 text-[0.7rem] font-medium"
                title={`${mediaCount} mídia(s) anexada(s)`}
              >
                <Paperclip size={10} className="text-slate-400" />
                <span>{mediaCount}</span>
              </span>
            )}
            {formattedDate && (
              <span className="text-[11px] text-slate-400 font-medium">
                {formattedDate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé: Faixa de Categoria */}
      <div
        className={`w-full py-1.5 px-3 text-[9px] uppercase tracking-wider font-bold text-center shrink-0 border-t ${footerConfig.badgeClass}`}
      >
        {footerConfig.label}
      </div>
    </div>
  );
};

export default ReportCardMinimized;
