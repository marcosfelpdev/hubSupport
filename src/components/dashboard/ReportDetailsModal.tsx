import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  CheckCircle2,
  Download,
  Sparkles,
  FileText,
  Video,
  MessageSquareText,
  Eye,
  ArrowLeft,
  Loader2,
  Paperclip,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import TagBadge from "@/components/TagBadge";

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

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

export const ReportDetailsModal: React.FC<ReportDetailsModalProps> = ({ log, onClose }) => {
  const [viewingPdf, setViewingPdf] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [viewingMedia, setViewingMedia] = useState<boolean>(false);
  const [mediaCurrentIndex, setMediaCurrentIndex] = useState<number>(0);

  // Extrai lista de mídias anexadas
  const mediaPaths: string[] = useMemo(() => {
    if (!log?.media) return [];
    try {
      const parsed = JSON.parse(log.media);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [log?.media]);

  // Reseta os modos de visualização caso o chamado mude
  useEffect(() => {
    setViewingPdf(false);
    setPdfLoading(true);
    setViewingMedia(false);
    setMediaCurrentIndex(0);
  }, [log?.id]);

  const canGoPrev = mediaCurrentIndex > 0;
  const canGoNext = mediaCurrentIndex < mediaPaths.length - 1;

  const handlePrevMedia = () => {
    if (mediaCurrentIndex > 0) {
      setMediaCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNextMedia = () => {
    if (mediaCurrentIndex < mediaPaths.length - 1) {
      setMediaCurrentIndex((prev) => prev + 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewingMedia) {
          setViewingMedia(false);
        } else if (viewingPdf) {
          setViewingPdf(false);
        } else {
          onClose();
        }
      } else if (viewingMedia && mediaPaths.length > 1) {
        if (e.key === "ArrowLeft") {
          // Sem loop: apenas volta se não estiver na primeira mídia
          setMediaCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "ArrowRight") {
          // Sem loop: apenas avança se não estiver na última mídia
          setMediaCurrentIndex((prev) => (prev < mediaPaths.length - 1 ? prev + 1 : prev));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, viewingPdf, viewingMedia, mediaPaths.length]);

  if (!log) return null;

  let structured: StructuredReportData | null = null;
  if (log.aiReport?.structuredData) {
    try {
      structured = JSON.parse(log.aiReport.structuredData);
    } catch {
      // ignore parsing error
    }
  }

  const isSolved =
    log.status?.toLowerCase() === "solucionado" ||
    log.status?.toLowerCase() === "finalizadas" ||
    log.status?.toLowerCase() === "finalizado" ||
    log.status?.toLowerCase() === "concluído" ||
    log.status?.toLowerCase() === "concluido";

  const statusPill = getStatusPill(log.status);
  const hasPdf = !!log.aiReport?.pdfPath;
  const hasVideo = !!log.aiReport?.videoPath;

  const formattedDate = new Date(log.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-white border border-slate-200 rounded-2xl w-full flex flex-col shadow-2xl shadow-slate-900/15 overflow-hidden transition-all duration-300 relative ${
          viewingPdf || viewingMedia
            ? "max-w-[96vw] xl:max-w-6xl h-[92vh] max-h-[92vh]"
            : "max-w-3xl max-h-[90vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {viewingPdf ? (
          /* ============================================================
             1. Visualizador de PDF estilo Gemini (com toolbar e botão Exportar)
             ============================================================ */
          <div className="flex flex-col h-full w-full overflow-hidden bg-white">
            {/* Barra Superior estilo Gemini / CloudNexus */}
            <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0 shadow-xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <h4
                    className="text-sm font-bold text-slate-900 truncate"
                    title={structured?.title || log.title || `Relatório Técnico - ${log.clientOrOffice}`}
                  >
                    {structured?.title || log.title || `Relatório Técnico - ${log.clientOrOffice}`}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {log.clientOrOffice} • Registrado em {formattedDate}
                    {log.tag && <span className="ml-1 text-slate-400">• {log.tag.name}</span>}
                  </p>
                </div>
              </div>

              {/* Ações da barra superior */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Botão Exportar (baixa o PDF oficial) */}
                <a
                  href={api.worklogs.getDownloadReportUrl(log.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-95 transition-all"
                  title="Baixar arquivo PDF original"
                >
                  <Download size={13} />
                  <span>Exportar</span>
                </a>

                {/* Alternar de volta para detalhes do chamado */}
                <button
                  type="button"
                  onClick={() => setViewingPdf(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  title="Voltar para a visão detalhada do chamado"
                >
                  <ArrowLeft size={13} />
                  <span>Detalhes</span>
                </button>

                {/* Fechar modal */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
                  title="Fechar visualizador"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Canvas de Exibição do Documento PDF */}
            <div className="flex-1 w-full h-full relative bg-slate-100 p-3 sm:p-5 overflow-hidden flex items-center justify-center">
              {pdfLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100/90 z-10 backdrop-blur-xs text-slate-600">
                  <Loader2 size={32} className="text-slate-900 animate-spin" />
                  <span className="text-xs font-medium text-slate-600">
                    Carregando relatório PDF oficial...
                  </span>
                </div>
              )}

              <iframe
                src={api.worklogs.getViewReportUrl(log.id)}
                className="w-full h-full border border-slate-200 rounded-xl shadow-md bg-white"
                title={log.title || "Relatório PDF"}
                onLoad={() => setPdfLoading(false)}
              />
            </div>
          </div>
        ) : viewingMedia ? (
          /* ============================================================
             2. Visualizador de Mídias Anexadas (Galeria com navegação)
             ============================================================ */
          <div className="flex flex-col h-full w-full overflow-hidden bg-white">
            {/* Topbar da Galeria */}
            <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0 shadow-xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
                  <Paperclip size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    Mídias Anexadas ({mediaCurrentIndex + 1} de {mediaPaths.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {log.clientOrOffice} • Solicitante: {log.requester}
                  </p>
                </div>
              </div>

              {/* Ações da barra da galeria */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Botão Baixar Mídia Atual */}
                <a
                  href={mediaPaths[mediaCurrentIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-95 transition-all"
                  title="Baixar arquivo original"
                >
                  <Download size={13} />
                  <span>Baixar Arquivo</span>
                </a>

                {/* Alternar de volta para detalhes */}
                <button
                  type="button"
                  onClick={() => setViewingMedia(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  title="Voltar para a visão detalhada do chamado"
                >
                  <ArrowLeft size={13} />
                  <span>Detalhes</span>
                </button>

                {/* Fechar modal */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Conteúdo Central da Galeria */}
            <div className="flex-1 w-full bg-slate-100 p-4 sm:p-6 flex flex-col items-center justify-between min-h-0 overflow-hidden">
              {/* Palco Central: Seta Esquerda + Card Central + Seta Direita */}
              <div className="w-full flex-1 min-h-0 flex items-center justify-center gap-3 sm:gap-6">
                {/* Seta Esquerda (Sem loop) */}
                {mediaPaths.length > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevMedia}
                    disabled={!canGoPrev}
                    aria-label="Mídia anterior"
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-md p-3 rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                    title={canGoPrev ? "Mídia anterior (Seta esquerda)" : "Primeira mídia"}
                  >
                    <ChevronLeft size={28} />
                  </button>
                )}

                {/* Quadro Central da Mídia */}
                <div className="flex-1 max-w-4xl h-full flex items-center justify-center min-h-0 rounded-2xl bg-white border border-slate-200 shadow-md p-2 sm:p-4 overflow-hidden relative">
                  {isImage(mediaPaths[mediaCurrentIndex]) ? (
                    <img
                      src={mediaPaths[mediaCurrentIndex]}
                      alt={`Mídia anexada ${mediaCurrentIndex + 1}`}
                      className="max-h-full max-w-full object-contain rounded-xl select-none"
                    />
                  ) : isVideo(mediaPaths[mediaCurrentIndex]) ? (
                    <video
                      src={mediaPaths[mediaCurrentIndex]}
                      controls
                      autoPlay
                      className="max-h-full max-w-full rounded-xl"
                    />
                  ) : (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center max-w-md shadow-xs flex flex-col items-center gap-3">
                      <FileText size={42} className="text-slate-600" />
                      <p className="text-sm font-semibold text-slate-900">Arquivo Anexado</p>
                      <p className="text-xs text-slate-500 break-all">{mediaPaths[mediaCurrentIndex]}</p>
                      <a
                        href={mediaPaths[mediaCurrentIndex]}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all"
                      >
                        <Download size={14} />
                        <span>Baixar Arquivo</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Seta Direita (Sem loop) */}
                {mediaPaths.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNextMedia}
                    disabled={!canGoNext}
                    aria-label="Próxima mídia"
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-md p-3 rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                    title={canGoNext ? "Próxima mídia (Seta direita)" : "Última mídia"}
                  >
                    <ChevronRight size={28} />
                  </button>
                )}
              </div>

              {/* Miniaturas das Mídias Abaixo do Quadro Central */}
              {mediaPaths.length > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4 pb-1 max-w-full overflow-x-auto shrink-0 px-4">
                  {mediaPaths.map((path, idx) => {
                    const isSelectedMedia = idx === mediaCurrentIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMediaCurrentIndex(idx)}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border transition-all duration-200 shrink-0 cursor-pointer relative group bg-white ${
                          isSelectedMedia
                            ? "ring-2 ring-slate-900 border-slate-900 shadow-md scale-105 opacity-100"
                            : "border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-400 hover:scale-100"
                        }`}
                        title={`Ir para mídia ${idx + 1}`}
                      >
                        {isImage(path) ? (
                          <img src={path} alt="" className="w-full h-full object-cover" />
                        ) : isVideo(path) ? (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <Video size={18} />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <FileText size={18} />
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0.5 right-1 text-[9px] font-bold px-1 rounded shadow-xs ${
                            isSelectedMedia
                              ? "bg-slate-900 text-white"
                              : "bg-white/90 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ============================================================
             3. Visão Padrão de Detalhes do Chamado
             ============================================================ */
          <>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isSolved
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                      : "bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  {isSolved ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate max-w-full">
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
                      <span className="inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200/80 shrink-0">
                        Ação Técnica
                      </span>
                    )}

                    {log.implementation && (
                      <span className="inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200/80 shrink-0">
                        Implementação
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {log.title && (
                      <span className="inline-flex items-center gap-1">
                        <span>Cliente:</span>
                        <strong className="text-slate-800 font-semibold">{log.clientOrOffice}</strong>
                        <span className="text-slate-300 ml-1">•</span>
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1">
                      <span>Solicitante:</span>
                      <strong className="text-slate-800 font-semibold">{log.requester}</strong>
                      <span className="text-slate-300 ml-1">•</span>
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <span>Registrado em:</span>
                      <span className="text-slate-700 font-medium">{formattedDate}</span>
                    </span>

                    {log.tag && (
                      <>
                        <span className="text-slate-300">•</span>
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

              {/* Botão Fechar Modal */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all duration-150 cursor-pointer"
                title="Fechar (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4 text-xs sm:text-sm bg-white">
              {/* Seção: Descrição & Solução */}
              <div
                className={`grid gap-3.5 ${
                  log.actionTaken && log.actionTaken.trim() !== ""
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {/* Descrição do Problema */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Descrição do Atendimento
                    </span>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {log.reportedProblem}
                    </p>
                  </div>
                </div>

                {/* Solução / Ação Realizada */}
                {log.actionTaken && log.actionTaken.trim() !== "" && (
                  <div className="bg-slate-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                        <CheckCircle2 size={13} />
                        Solução / Ação Realizada
                      </span>
                      <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {log.actionTaken}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Relatório Estruturado de IA */}
              {structured ? (
                <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
                  {/* Cabeçalho do Card de IA */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                        <Sparkles size={15} />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                          {structured.title || "Relatório Executivo de IA"}
                        </h4>
                        {structured.subtitle && (
                          <p className="text-xs text-slate-500">
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
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs active:scale-98 transition-all duration-150"
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
                          onClick={() => {
                            setMediaCurrentIndex(0);
                            setViewingMedia(true);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                          title="Visualizar mídias e arquivos anexados a este atendimento"
                        >
                          <Paperclip size={13} />
                          <span>Mídias ({mediaPaths.length})</span>
                        </button>
                      )}

                      {/* Botão Visualizar PDF */}
                      {hasPdf && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewingPdf(true);
                            setPdfLoading(true);
                          }}
                          className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                          title="Visualizar o PDF dentro do modal"
                        >
                          <Eye size={14} />
                          <span>Visualizar PDF</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resumo Executivo */}
                  {structured.executiveSummary && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Resumo Executivo
                      </span>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {structured.executiveSummary}
                      </p>
                    </div>
                  )}

                  {/* Propostas & Melhorias Identificadas */}
                  {structured.proposals && structured.proposals.length > 0 && (
                    <div className="space-y-2.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Propostas & Melhorias Identificadas
                      </span>
                      <div className="flex flex-col gap-2.5">
                        {structured.proposals.map((prop, idx) => {
                          const isHighPriority = prop.priority?.toLowerCase() === "alta";
                          const isMediumPriority =
                            prop.priority?.toLowerCase() === "média" ||
                            prop.priority?.toLowerCase() === "media";
                          return (
                            <div
                              key={idx}
                              className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 hover:border-slate-300 transition-colors shadow-xs"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                                  {prop.item}
                                </span>
                                {prop.priority && (
                                  <span
                                    className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full border ${
                                      isHighPriority
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : isMediumPriority
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                    }`}
                                  >
                                    {prop.priority}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">
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
                    <div className="space-y-1.5 border-t border-slate-200 pt-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Detalhamento: {structured.detailingTopic}
                      </span>
                      {structured.detailingParagraphs?.map((p, i) => (
                        <p key={i} className="text-xs text-slate-600 leading-relaxed mb-1">
                          {p}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Transcrição de Áudio se houver */}
                  {structured.transcript && structured.transcript.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquareText size={14} className="text-indigo-600" />
                        Trechos Relevantes da Transcrição
                      </span>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {structured.transcript.map((line, i) => (
                          <div
                            key={i}
                            className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex flex-col gap-1 shadow-xs"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-800">
                                {line.speaker} {line.role ? `(${line.role})` : ""}
                              </span>
                              {line.timestamp && <span>{line.timestamp}</span>}
                            </div>
                            <p className="text-slate-700 pl-2 border-l-2 border-indigo-200">
                              {line.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Banner Fallback quando não há relatório estruturado */
                <div className="flex flex-col gap-3">
                  {hasPdf && (
                    <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Relatório PDF disponível
                          </p>
                          <p className="text-xs text-slate-500">
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
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all duration-150"
                          >
                            <Video size={13} />
                            <span>Vídeo</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setViewingPdf(true);
                            setPdfLoading(true);
                          }}
                          className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-98 transition-all duration-150 shrink-0 cursor-pointer"
                        >
                          <Eye size={14} />
                          <span>Visualizar PDF</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {mediaPaths.length > 0 && (
                    <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
                          <Paperclip size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {mediaPaths.length} mídia(s) anexada(s)
                          </p>
                          <p className="text-xs text-slate-500">
                            Imagens, capturas de tela e arquivos anexados
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMediaCurrentIndex(0);
                          setViewingMedia(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                      >
                        <Paperclip size={13} />
                        <span>Ver Mídias ({mediaPaths.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold shadow-xs transition-all duration-150 active:scale-95 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
