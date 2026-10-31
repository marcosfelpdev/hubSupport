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

function getStatusPillConfig(status: string) {
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
      className: "bg-emerald-900/30 text-emerald-400 border-emerald-800/40",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em progresso",
      className: "bg-blue-900/30 text-blue-400 border-blue-800/40",
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
      className: "bg-amber-900/30 text-amber-400 border-amber-800/40",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não realizado",
      className: "bg-rose-900/30 text-rose-400 border-rose-800/40",
    };
  }

  if (norm === "backlog") {
    return {
      label: "Backlog",
      className: "bg-indigo-900/30 text-indigo-400 border-indigo-800/40",
    };
  }

  return {
    label: status || "Registrado",
    className: "bg-slate-800/40 text-slate-300 border-slate-700/40",
  };
}

function getFooterConfig(technicalAction?: boolean, implementation?: boolean) {
  if (technicalAction && implementation) {
    return {
      label: "Ação Técnica · Implementação",
      className: "bg-amber-900/30 text-amber-400 border-amber-900/50",
    };
  }
  if (technicalAction) {
    return {
      label: "Ação Técnica",
      className: "bg-orange-900/30 text-orange-400 border-orange-900/50",
    };
  }
  if (implementation) {
    return {
      label: "Implementação",
      className: "bg-violet-900/30 text-violet-400 border-violet-900/50",
    };
  }
  return {
    label: "Atendimento",
    className: "bg-cyan-900/30 text-cyan-400 border-cyan-900/50",
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
  const statusConfig = getStatusPillConfig(log.status);
  const footerConfig = getFooterConfig(log.technicalAction, log.implementation);
  const formattedDate = formatDate(log.createdAt);
  const hasAiReport = !!log.aiReport;

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
        ...style,
      }}
      className={`w-full h-[214px] min-h-[214px] max-h-[214px] bg-[#161a23] border rounded-xl flex flex-col font-sans shadow-lg overflow-hidden transition-all duration-150 relative select-none cursor-pointer ${
        isSelected
          ? "border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/50"
          : "border-slate-800/90 hover:border-slate-700 hover:shadow-2xl"
      } ${isDragging ? "opacity-35 scale-[0.98]" : "opacity-100"} ${className}`}
    >
      {/* Conteúdo Interno com Padding fixo */}
      <div className="p-3.5 flex flex-col justify-between flex-1 min-h-0">
        {/* Linha 1: Plataforma & Status */}
        <div className="flex justify-between items-center gap-2">
          {/* Badge de Plataforma / Tag */}
          {log.tag ? (
            <span
              className="px-2.5 py-0.5 rounded text-xs font-semibold truncate max-w-[140px]"
              style={{
                color: log.tag.color || "#06b6d4",
                backgroundColor: hexToRgba(log.tag.color || "#06b6d4", 0.25),
                border: `1px solid ${hexToRgba(log.tag.color || "#06b6d4", 0.35)}`,
              }}
              title={log.tag.name}
            >
              {log.tag.name}
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold text-slate-400 bg-slate-800/60 border border-slate-700/50 truncate max-w-[140px]">
              Geral
            </span>
          )}

          {/* Status Pill com indicador sutil de IA */}
          <div className="flex items-center gap-1.5 shrink-0">
            {hasAiReport && (
              <span
                title="Relatório de IA disponível"
                className="flex items-center text-indigo-400"
              >
                <Sparkles size={12} />
              </span>
            )}
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full font-semibold border uppercase tracking-wide shrink-0 ${statusConfig.className}`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Linha 2: Descrição com tamanho padrão imutável de até 3 linhas e fade-out */}
        <div className="flex flex-col mt-1">
          <span className="text-[#e26b6b] text-[10px] font-bold uppercase tracking-wider">
            Descrição
          </span>
          <div
            className="relative mt-0.5 overflow-hidden"
            style={{ height: "3.75rem", maxHeight: "3.75rem" }}
          >
            <p className="text-white text-xs font-semibold leading-[1.25rem] break-words whitespace-normal m-0 p-0">
              {log.reportedProblem || "Sem descrição informada."}
            </p>
            {/* Fade-out suave ao bater no limite de 3 linhas do card */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#161a23] to-transparent"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Linha 3: Divisor */}
        <div className="h-px bg-slate-800/80 w-full my-0.5" />

        {/* Linha 4: Solicitante & Data */}
        <div className="flex justify-between items-end gap-2">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
              Solicitante
            </span>
            <div className="text-xs truncate">
              <span className="font-medium text-slate-200">
                {log.requester || "Não informado"}
              </span>
              {log.clientOrOffice && (
                <span className="text-slate-400">
                  {" "}· {log.clientOrOffice}
                </span>
              )}
            </div>
          </div>
          <span className="text-slate-500 text-[11px] font-medium shrink-0 ml-1">
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Rodapé: Categoria do Atendimento (Atendimento / Ação Técnica / Implementação) */}
      <div
        className={`w-full py-1 text-[9px] uppercase tracking-widest font-bold text-center border-t shrink-0 ${footerConfig.className}`}
      >
        {footerConfig.label}
      </div>
    </div>
  );
};

export default ReportCardMinimized;
