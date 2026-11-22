import React from "react";
import {
  Sparkles,
  Maximize2,
  Paperclip,
  Inbox,
  Clock,
  Hourglass,
  ShieldAlert,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import TagBadge from "./TagBadge";
import { getCategoryIconComponent } from "./CategoryIconPicker";
import { getValidationDuration } from "./dashboard/WorkLogDetailContent";

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
  isPrompt?: boolean;
  isIdea?: boolean;
  hasValidationRejection?: boolean;
  validationStartedAt?: Date | string | null;
  notes?: Array<{
    id: string;
    type: string;
    content: string;
  }>;
  categoryId?: string | null;
  category?: {
    id?: string;
    slug?: string;
    name: string;
    color?: string;
    icon?: string;
  } | null;
  media?: string;
  userId?: string;
  user?: {
    name?: string;
    email?: string;
  } | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email?: string;
    role?: string | null;
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

export interface StatusPillConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

export function getStatusPill(status: string): StatusPillConfig {
  const norm = (status || "").toLowerCase().trim();

  if (
    norm === "solucionado" ||
    norm === "finalizadas" ||
    norm === "finalizado" ||
    norm === "concluído" ||
    norm === "concluido" ||
    norm === "realizado" ||
    norm === "já realizado" ||
    norm === "ja realizado"
  ) {
    return {
      label: "Solucionado",
      badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  if (
    norm === "validação" ||
    norm === "validacao" ||
    norm === "em validação" ||
    norm === "em validacao"
  ) {
    return {
      label: "Validação",
      badgeClass: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
      dotClass: "bg-purple-500",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em progresso",
      badgeClass: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
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
      badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      dotClass: "bg-amber-500",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não realizado",
      badgeClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
      dotClass: "bg-rose-500",
    };
  }

  if (norm === "backlog") {
    return {
      label: "Backlog",
      badgeClass: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
      dotClass: "bg-indigo-500",
    };
  }

  return {
    label: status || "Registrado",
    badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400",
  };
}

export interface StatusIconDef {
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  colorClass: string;
  bgClass: string;
}

export function getStatusIconDef(status: string): StatusIconDef {
  const norm = (status || "").toLowerCase().trim();

  if (
    norm === "solucionado" ||
    norm === "finalizadas" ||
    norm === "finalizado" ||
    norm === "concluído" ||
    norm === "concluido" ||
    norm === "realizado" ||
    norm === "já realizado" ||
    norm === "ja realizado"
  ) {
    return {
      label: "Solucionado",
      icon: CheckCircle2,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    };
  }

  if (
    norm === "validação" ||
    norm === "validacao" ||
    norm === "em validação" ||
    norm === "em validacao"
  ) {
    return {
      label: "Aguardando Validação",
      icon: ShieldAlert,
      colorClass: "text-purple-600 dark:text-purple-400",
      bgClass: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em progresso",
      icon: Hourglass,
      colorClass: "text-sky-600 dark:text-sky-400",
      bgClass: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800",
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
      icon: Clock,
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    };
  }

  return {
    label: "Backlog",
    icon: Inbox,
    colorClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800",
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

const AVATAR_BG_COLORS = [
  "bg-indigo-600",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-teal-600",
  "bg-blue-600",
];

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColorClass(str?: string | null): string {
  if (!str) return "bg-indigo-600";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

function getFirstName(fullName?: string | null): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || fullName;
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
  const statusIconDef = getStatusIconDef(log.status);
  const StatusIcon = statusIconDef.icon;

  const categoryName =
    log.category?.name ||
    (log.technicalAction
      ? "Ação Técnica"
      : log.implementation
      ? "Implementação"
      : log.isPrompt
      ? "Prompt"
      : log.isIdea
      ? "Ideia"
      : "Atendimento");

  const categoryColor =
    log.category?.color ||
    (log.technicalAction
      ? "#0284c7"
      : log.implementation
      ? "#8b5cf6"
      : log.isPrompt
      ? "#10b981"
      : log.isIdea
      ? "#7c3aed"
      : "#3b82f6");

  const categoryIconKey =
    log.category?.icon ||
    (log.technicalAction
      ? "cog"
      : log.implementation
      ? "rocket"
      : log.isPrompt
      ? "sparkles"
      : log.isIdea
      ? "lightbulb"
      : "cog");

  const CategoryIcon = getCategoryIconComponent(categoryIconKey);

  const formattedDate = formatDate(log.createdAt);

  const assignedName = log.assignedTo?.name;
  const assignedFirstName = React.useMemo(() => getFirstName(assignedName), [assignedName]);
  const assignedInitials = React.useMemo(() => getInitials(assignedName), [assignedName]);
  const assignedColorClass = React.useMemo(() => getAvatarColorClass(assignedName), [assignedName]);

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

  const hasRejection = Boolean(
    log.hasValidationRejection || log.notes?.some((n) => n.type === "rejection")
  );

  const tagColor = log.tag?.color || "#0284c7";
  const tagName = log.tag?.name || "Geral";
  const titleText = log.title || log.reportedProblem || "Sem título informado.";

  const cursorClasses = draggable
    ? "cursor-grab active:cursor-grabbing"
    : onClick
    ? "cursor-pointer"
    : "";

  const surfaceClasses = isSelected
    ? ""
    : "bg-white dark:bg-[#111726] hover:bg-white dark:hover:bg-[#161f33]";

  const stateClasses = isDragging
    ? "opacity-50 scale-[0.98] border-dashed border-brand-card-selected-border dark:border-sky-500 shadow-md"
    : isSelected
    ? "brand-card-selected dark:bg-sky-950/20 dark:hover:bg-sky-950/30 dark:border-sky-400 dark:ring-[1.5px] dark:ring-inset dark:ring-sky-500/40 dark:shadow-md dark:shadow-sky-950/40"
    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md";

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
      className={`group w-full shrink-0 min-h-[160px] h-[160px] ${surfaceClasses} border rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-200 select-none ${cursorClasses} ${stateClasses} ${className}`.trim()}
    >
      {/* Conteúdo interno do card */}
      <div className="p-3.5 flex flex-col justify-between flex-1 min-h-0 gap-1.5">
        {/* Linha Superior: TagBadge com dot + Ícones de status e categoria no topo direito */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <TagBadge name={tagName} color={tagColor} size="sm" />

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Indicador visual de Card Aberto / Maximizado */}
            {isSelected && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-card-selected-pill dark:bg-sky-600 text-white shadow-2xs animate-fade-in"
                title="Chamado aberto"
              >
                <Maximize2 size={10} className="text-white shrink-0" />
                <span>Aberto</span>
              </span>
            )}

            {/* Símbolo de IA */}
            {isAiGenerating ? (
              <span
                title="IA gerando relatório PDF em segundo plano..."
                className="inline-flex items-center text-indigo-600 dark:text-indigo-400 animate-sparkle cursor-help"
              >
                <Sparkles size={13} />
              </span>
            ) : isAiCompleted ? (
              <span
                title="Relatório de IA e PDF disponíveis"
                className="inline-flex items-center text-indigo-600 dark:text-indigo-400"
              >
                <Sparkles size={13} />
              </span>
            ) : null}

            {/* Indicador sutil de Validação Reprovada */}
            {hasRejection && (
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-2xs animate-fade-in cursor-help"
                title="Atenção: Este atendimento foi reprovado na validação anterior e possui nota de recusa."
              >
                <RotateCcw size={12} className="shrink-0" />
              </span>
            )}

            {/* Ícone de Categoria */}
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-lg border shadow-2xs cursor-help transition-all"
              style={{
                backgroundColor: `${categoryColor}15`,
                borderColor: `${categoryColor}35`,
                color: categoryColor,
              }}
              title={`Categoria: ${categoryName}`}
            >
              <CategoryIcon size={13} className="shrink-0" style={{ color: categoryColor }} />
            </span>

            {/* Ícone de Status */}
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-lg border shadow-2xs cursor-help transition-all ${statusIconDef.bgClass} ${statusIconDef.colorClass}`}
              title={
                statusIconDef.label === "Validação" && log.validationStartedAt
                  ? `Status: Validação (${getValidationDuration(log.validationStartedAt).label} em validação)`
                  : `Status: ${statusIconDef.label}`
              }
            >
              <StatusIcon size={13} className="shrink-0" />
            </span>
          </div>
        </div>

        {/* Linha Central: Título com line-clamp-2 */}
        <div className="flex items-center justify-start my-auto min-h-[42px] px-0.5">
          <p
            title={titleText}
            className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 break-words"
          >
            {titleText}
          </p>
        </div>

        {/* Linha Divisória Sutil */}
        <div className="w-full border-t border-slate-100 dark:border-slate-800/80 my-1 shrink-0" />

        {/* Linha Inferior: Solicitante, Empresa & Metadados (Responsável, Anexos, Data) */}
        <div className="flex items-end justify-between gap-2 min-w-0 shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Solicitante
            </span>
            <div
              className="text-xs truncate font-semibold text-slate-700 dark:text-slate-200"
              title={`${log.requester || "Não informado"}${log.clientOrOffice ? ` · ${log.clientOrOffice}` : ""}`}
            >
              <span>{log.requester || "Não informado"}</span>
              {log.clientOrOffice && (
                <span className="text-slate-500 dark:text-slate-400 font-normal"> · {log.clientOrOffice}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {log.assignedTo && (
              <div
                className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs select-none shrink-0"
                title={`Responsável: ${log.assignedTo.name}`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 shadow-2xs ring-1 ring-white/20 dark:ring-white/10 ${assignedColorClass}`}
                >
                  {assignedInitials}
                </div>
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 max-w-[65px] truncate">
                  {assignedFirstName}
                </span>
              </div>
            )}
            {mediaCount > 0 && (
              <span
                className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-md px-2 py-0.5 text-[0.7rem] font-medium"
                title={`${mediaCount} mídia(s) anexada(s)`}
              >
                <Paperclip size={10} className="text-slate-400 dark:text-slate-500" />
                <span>{mediaCount}</span>
              </span>
            )}
            {formattedDate && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {formattedDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardMinimized;
