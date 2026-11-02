import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  CheckCircle2,
  FileText,
  Sparkles,
  Video,
  Paperclip,
  Eye,
  MessageSquareText,
  Loader2,
  Clock,
  AlertTriangle,
  RotateCw,
  Cog,
  Lightbulb,
} from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import TagBadge from "@/components/TagBadge";

export interface StructuredReportData {
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

export interface StatusPillConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Interface flexível para acomodar tanto WorkLogItem quanto variações de dashboards de técnicos.
 */
export interface WorkLogDetailData {
  id: string;
  title?: string | null;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken?: string | null;
  status: string;
  technicalAction?: boolean;
  implementation?: boolean;
  media?: string | null;
  userId?: string;
  tagId?: string | null;
  tag?: {
    id?: string;
    name: string;
    color: string;
  } | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  user?: {
    name: string;
    email: string;
    role?: string | null;
  };
  aiReport?: {
    id?: string;
    status: string;
    errorMessage?: string | null;
    pdfPath?: string | null;
    videoPath?: string | null;
    structuredData?: string | null;
    completedAt?: Date | string | null;
    startedAt?: Date | string | null;
  } | null;
}

export interface WorkLogDetailContentProps {
  log: WorkLogDetailData;
  onRefresh?: () => void;
  headerAction?: React.ReactNode;
  footerActions?: React.ReactNode;
  onOpenPdfModal?: (logId: string) => void;
  onOpenMediaModal?: (log: WorkLogItem | WorkLogDetailData) => void;
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
    norm === "já realizado"
  ) {
    return {
      label: "Solucionado",
      badgeClass:
        "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em progresso",
      badgeClass:
        "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
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
      badgeClass:
        "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      dotClass: "bg-amber-500",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não realizado",
      badgeClass:
        "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
      dotClass: "bg-rose-500",
    };
  }

  if (norm === "backlog") {
    return {
      label: "Backlog",
      badgeClass:
        "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
      dotClass: "bg-indigo-500",
    };
  }

  return {
    label: status || "Registrado",
    badgeClass:
      "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  };
}

export function parseMediaPaths(media?: string | null): string[] {
  if (!media) return [];
  try {
    const parsed = JSON.parse(media);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const WorkLogDetailContent: React.FC<WorkLogDetailContentProps> = ({
  log,
  onRefresh,
  headerAction,
  footerActions,
  onOpenPdfModal,
  onOpenMediaModal,
}) => {
  // Estado local do relatório de IA para suportar polling e geração sob demanda
  const [currentAiReport, setCurrentAiReport] = useState(log.aiReport ?? null);
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [generateFeedback, setGenerateFeedback] = useState<string | null>(null);
  const [isRetrying, startRetryTransition] = useTransition();
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  // Sincroniza estado quando o atendimento muda
  useEffect(() => {
    setCurrentAiReport(log.aiReport ?? null);
    setGenerateFeedback(null);
    setRetryFeedback(null);
  }, [log.id, log.aiReport]);

  // Polling leve enquanto o relatório estiver pendente ou em processamento
  useEffect(() => {
    const status = currentAiReport?.status;
    if (!status || (status !== "pending" && status !== "processing")) {
      return;
    }

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const updated = await api.worklogs.getAiStatus(log.id);
        if (updated && isMounted) {
          setCurrentAiReport((prev) => ({
            ...prev,
            ...updated,
          }));
          if (updated.status === "completed" || updated.status === "failed") {
            onRefresh?.();
          }
        }
      } catch (err) {
        console.error("Erro ao verificar status do relatório de IA:", err);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [log.id, currentAiReport?.status, onRefresh]);

  // Extrai lista de mídias anexadas
  const mediaPaths = useMemo(() => parseMediaPaths(log.media), [log.media]);

  // Faz o parse seguro do structuredData
  const structured: StructuredReportData | null = useMemo(() => {
    if (!currentAiReport?.structuredData) return null;
    try {
      return JSON.parse(currentAiReport.structuredData);
    } catch {
      return null;
    }
  }, [currentAiReport?.structuredData]);

  const isSolved = useMemo(() => {
    const norm = (log.status || "").toLowerCase().trim();
    return (
      norm === "solucionado" ||
      norm === "finalizadas" ||
      norm === "finalizado" ||
      norm === "concluído" ||
      norm === "concluido" ||
      norm === "realizado" ||
      norm === "já realizado"
    );
  }, [log.status]);

  const statusPill = useMemo(() => getStatusPill(log.status), [log.status]);
  const hasPdf = !!currentAiReport?.pdfPath;
  const hasVideo = !!currentAiReport?.videoPath;

  const formattedDate = useMemo(() => {
    if (!log.createdAt) return "";
    try {
      const d = new Date(log.createdAt);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(log.createdAt);
    }
  }, [log.createdAt]);

  const handleGenerateReport = () => {
    setGenerateFeedback(null);
    startGeneratingTransition(async () => {
      try {
        await api.worklogs.generateAiReport(log.id);
        setCurrentAiReport({
          id: `ai-${log.id}`,
          status: "pending",
        });
        onRefresh?.();
      } catch (err) {
        setGenerateFeedback(
          err instanceof Error ? err.message : "Erro ao solicitar geração de relatório com IA."
        );
      }
    });
  };

  const handleRetry = () => {
    setRetryFeedback(null);
    startRetryTransition(async () => {
      try {
        await api.worklogs.retryAi(log.id);
        setCurrentAiReport((prev) =>
          prev
            ? {
                ...prev,
                status: "pending",
                errorMessage: null,
              }
            : { status: "pending" }
        );
        onRefresh?.();
      } catch (err) {
        setRetryFeedback(err instanceof Error ? err.message : "Erro ao tentar novamente.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 text-xs sm:text-sm">
      {/* 1. Header do Chamado */}
      <div className="flex items-start sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isSolved
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {isSolved ? <CheckCircle2 size={20} /> : <FileText size={20} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug truncate max-w-full">
                {log.title || log.clientOrOffice}
              </h3>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-xs ${statusPill.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusPill.dotClass}`} />
                <span>{statusPill.label}</span>
              </span>

              {log.tag && (
                <TagBadge name={log.tag.name} color={log.tag.color} size="sm" />
              )}

              {log.technicalAction && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800 shrink-0">
                  <Cog size={11} />
                  Ação Técnica
                </span>
              )}

              {log.implementation && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 shrink-0">
                  <Lightbulb size={11} />
                  Implementação
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
              {log.title && (
                <span className="inline-flex items-center gap-1">
                  <span>Cliente:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                    {log.clientOrOffice}
                  </strong>
                  <span className="text-slate-300 dark:text-slate-600 ml-1">•</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1">
                <span>Solicitante:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                  {log.requester}
                </strong>
                <span className="text-slate-300 dark:text-slate-600 ml-1">•</span>
              </span>

              <span className="inline-flex items-center gap-1">
                <span>Registrado em:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {formattedDate}
                </span>
              </span>

              {log.tag && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span>Plataforma:</span>
                    <strong style={{ color: log.tag.color }} className="font-semibold">
                      {log.tag.name}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {headerAction && (
          <div className="shrink-0 flex items-center self-start sm:self-center">
            {headerAction}
          </div>
        )}
      </div>

      {/* 2. Grid de 2 Colunas Lado a Lado: Descrição & Solução */}
      <div
        className={`grid gap-3.5 ${
          log.actionTaken && log.actionTaken.trim() !== ""
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {/* Coluna 1: Descrição do Atendimento */}
        <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Descrição do Atendimento
            </span>
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
              {log.reportedProblem}
            </p>
          </div>
        </div>

        {/* Coluna 2: Solução / Ação Realizada (com ícone CheckCircle2 verde) */}
        {log.actionTaken && log.actionTaken.trim() !== "" && (
          <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Solução / Ação Realizada
              </span>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                {log.actionTaken}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Seção Rica de Relatório de IA ou Estados de Progresso / Fallback */}
      {structured ? (
        /* Card Estruturado com Acabamento Rico */
        <div className="bg-slate-50/60 dark:bg-[#0b0f19]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
          {/* Header do Card de IA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sparkles size={15} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {structured.title || "Relatório Executivo de IA"}
                </h4>
                {structured.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {structured.subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Botão Vídeo gravado */}
              {hasVideo && (
                <a
                  href={api.worklogs.getDownloadRecordingUrl(log.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150"
                  title="Baixar gravação em vídeo"
                >
                  <Video size={13} />
                  <span>Vídeo</span>
                </a>
              )}

              {/* Botão Visualizar Mídias Anexadas */}
              {mediaPaths.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenMediaModal?.(log)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                  title="Visualizar mídias e arquivos anexados a este atendimento"
                >
                  <Paperclip size={13} />
                  <span>Mídias ({mediaPaths.length})</span>
                </button>
              )}

              {/* Botão Visualizar PDF */}
              {hasPdf && (
                onOpenPdfModal ? (
                  <button
                    type="button"
                    onClick={() => onOpenPdfModal(log.id)}
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                    title="Visualizar o PDF oficial"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </button>
                ) : (
                  <a
                    href={api.worklogs.getViewReportUrl(log.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150"
                    title="Visualizar o PDF oficial em nova aba"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </a>
                )
              )}
            </div>
          </div>

          {/* Resumo Executivo */}
          {structured.executiveSummary && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Resumo Executivo
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {structured.executiveSummary}
              </p>
            </div>
          )}

          {/* Propostas & Melhorias Identificadas com Badges de Prioridade */}
          {structured.proposals && structured.proposals.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Propostas & Melhorias Identificadas
              </span>
              <div className="flex flex-col gap-2.5">
                {structured.proposals.map((prop, idx) => {
                  const pNorm = (prop.priority || "").toLowerCase().trim();
                  const isHighPriority =
                    pNorm === "alta" || pNorm === "high" || pNorm === "urgente";
                  const isMediumPriority =
                    pNorm === "média" || pNorm === "media" || pNorm === "medium";

                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-[#161f33] border border-slate-200 dark:border-slate-800 rounded-lg p-3 sm:p-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {prop.item}
                        </span>
                        {prop.priority && (
                          <span
                            className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full border ${
                              isHighPriority
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                : isMediumPriority
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            }`}
                          >
                            {prop.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {prop.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detalhamento Técnico */}
          {structured.detailingTopic && (
            <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Detalhamento: {structured.detailingTopic}
              </span>
              {structured.detailingParagraphs?.map((p, i) => (
                <p
                  key={i}
                  className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-1"
                >
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* Encaminhamentos */}
          {structured.referrals && (
            <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Encaminhamentos & Próximos Passos
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {structured.referrals}
              </p>
            </div>
          )}

          {/* Transcrição Relevante */}
          {structured.transcript && structured.transcript.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareText size={14} className="text-indigo-600 dark:text-indigo-400" />
                Trechos Relevantes da Transcrição
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {structured.transcript.map((line, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-[#161f33] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex flex-col gap-1 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {line.speaker} {line.role ? `(${line.role})` : ""}
                      </span>
                      {line.timestamp && <span>{line.timestamp}</span>}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800">
                      {line.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : currentAiReport?.status === "pending" ? (
        /* Estado Pendente */
        <div className="flex flex-col gap-3 p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-xl">
          <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <Clock size={16} className="text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
            <span className="font-medium">
              {currentAiReport.videoPath
                ? "A gravação foi recebida e está aguardando o início da análise pela inteligência artificial."
                : "O chamado foi recebido e está aguardando o início da análise pela inteligência artificial."}
            </span>
          </div>

          {hasVideo && (
            <div className="flex justify-end pt-1">
              <a
                href={api.worklogs.getDownloadRecordingUrl(log.id)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Baixar gravação de vídeo</span>
              </a>
            </div>
          )}
        </div>
      ) : currentAiReport?.status === "processing" ? (
        /* Estado Processando com Barra Animada */
        <div className="flex flex-col gap-3 p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl">
          <div className="flex items-center gap-2.5 text-xs text-indigo-950 dark:text-indigo-200 font-medium">
            <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {currentAiReport.videoPath
                ? "A IA está analisando o vídeo e estruturando o relatório executivo..."
                : "A IA está analisando as informações do chamado e estruturando o relatório..."}
            </span>
          </div>

          {/* Barra de Progresso Animada */}
          <div className="w-full h-1.5 bg-indigo-100/80 dark:bg-indigo-950/60 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-500 rounded-full animate-pulse" />
          </div>

          {hasVideo && (
            <div className="flex justify-end pt-1">
              <a
                href={api.worklogs.getDownloadRecordingUrl(log.id)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Baixar gravação</span>
              </a>
            </div>
          )}
        </div>
      ) : currentAiReport?.status === "failed" ? (
        /* Estado de Falha com Botão de Tentativa */
        <div className="flex flex-col gap-3 p-4 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-xl">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 leading-tight">
                Não foi possível gerar o relatório
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 leading-normal break-words">
                {currentAiReport.errorMessage ||
                  "Ocorreu um erro no processamento com a IA. Tente novamente."}
              </p>
              {retryFeedback && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                  {retryFeedback}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            {hasVideo && (
              <a
                href={api.worklogs.getDownloadRecordingUrl(log.id)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-slate-600 dark:text-slate-400" />
                <span>Baixar gravação</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-rose-950/40 hover:bg-rose-50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 shadow-xs transition-all cursor-pointer ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw
                size={13}
                className={isRetrying ? "animate-spin text-rose-600 dark:text-rose-400" : "text-rose-600 dark:text-rose-400"}
              />
              <span>{isRetrying ? "Reiniciando..." : "Tentar novamente"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Fallback: Banner Elegante Convidativo para Gerar IA Sob Demanda */
        <div className="bg-gradient-to-r from-indigo-50/70 via-sky-50/40 to-indigo-50/70 dark:from-indigo-950/25 dark:via-sky-950/15 dark:to-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100/70 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Relatório Executivo com IA
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Este atendimento foi registrado sem gravação de tela. Você pode solicitar a geração sob demanda de uma análise técnica executiva com base nas informações e mídias deste chamado.
                </p>
                {generateFeedback && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>{generateFeedback}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 active:scale-[0.98] shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Iniciando IA...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-white" />
                  <span>Gerar Relatório com IA</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Fallback de PDF e Mídias caso o relatório de IA não tenha structuredData mas tenha PDF ou anexos */}
      {!structured && (hasPdf || mediaPaths.length > 0) && (
        <div className="flex flex-col gap-3">
          {hasPdf && (
            <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Relatório PDF disponível
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Relatório oficial gerado para este atendimento
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {hasVideo && (
                  <a
                    href={api.worklogs.getDownloadRecordingUrl(log.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all duration-150"
                  >
                    <Video size={13} />
                    <span>Vídeo</span>
                  </a>
                )}

                {onOpenPdfModal ? (
                  <button
                    type="button"
                    onClick={() => onOpenPdfModal(log.id)}
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150 shrink-0 cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </button>
                ) : (
                  <a
                    href={api.worklogs.getViewReportUrl(log.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150 shrink-0"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {mediaPaths.length > 0 && (
            <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <Paperclip size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {mediaPaths.length} mídia(s) anexada(s)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Imagens, capturas de tela e arquivos anexados
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenMediaModal?.(log)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
              >
                <Paperclip size={13} />
                <span>Ver Mídias ({mediaPaths.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Slot de Ações do Rodapé (ex: Marcar como Solucionado) */}
      {footerActions && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 flex-wrap">
          {footerActions}
        </div>
      )}
    </div>
  );
};

export default WorkLogDetailContent;
