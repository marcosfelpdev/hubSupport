import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Check,
  X,
  Download,
  FileText,
  Video,
  ArrowLeft,
  Loader2,
  Paperclip,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import { formatReportAsText, copyToClipboard } from "@/lib/report-formatter";
import WorkLogDetailContent, {
  StructuredReportData,
} from "@/components/dashboard/WorkLogDetailContent";

interface ReportDetailsModalProps {
  log: WorkLogItem | null;
  onClose: () => void;
  onRefresh?: () => void;
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

export const ReportDetailsModal: React.FC<ReportDetailsModalProps> = ({
  log,
  onClose,
  onRefresh,
}) => {
  const [viewingPdf, setViewingPdf] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [viewingMedia, setViewingMedia] = useState<boolean>(false);
  const [mediaCurrentIndex, setMediaCurrentIndex] = useState<number>(0);

  const [copiedPdfText, setCopiedPdfText] = useState(false);

  const handleCopyPdfText = async () => {
    if (!log) return;
    let parsed: any = null;
    if (log.aiReport?.structuredData) {
      try {
        parsed = JSON.parse(log.aiReport.structuredData);
      } catch {}
    }
    const text = formatReportAsText(parsed, {
      title: log.title,
      requester: log.requester,
      clientOrOffice: log.clientOrOffice,
      reportedProblem: log.reportedProblem,
      actionTaken: log.actionTaken,
      status: log.status,
      createdAt: log.createdAt,
    });
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedPdfText(true);
      setTimeout(() => setCopiedPdfText(false), 2000);
    }
  };

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
          setMediaCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "ArrowRight") {
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

  const formattedDate = new Date(log.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const modalContent = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl w-full flex flex-col shadow-2xl shadow-slate-900/30 overflow-hidden transition-all duration-300 relative ${
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
          <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-[#111726]">
            {/* Barra Superior estilo Gemini / CloudNexus */}
            <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] flex items-center justify-between gap-4 shrink-0 shadow-xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <h4
                    className="text-sm font-bold text-slate-900 dark:text-white truncate"
                    title={structured?.title || log.title || `Relatório Técnico - ${log.clientOrOffice}`}
                  >
                    {structured?.title || log.title || `Relatório Técnico - ${log.clientOrOffice}`}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {log.clientOrOffice} • Registrado em {formattedDate}
                    {log.tag && <span className="ml-1 text-slate-400 dark:text-slate-500">• {log.tag.name}</span>}
                  </p>
                </div>
              </div>

              {/* Ações da barra superior */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Botão Copiar Texto do Relatório */}
                <button
                  type="button"
                  onClick={handleCopyPdfText}
                  id="btn-modal-copy-report-text"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-95 transition-all cursor-pointer"
                  title="Copiar texto do relatório para a área de transferência"
                >
                  {copiedPdfText ? (
                    <>
                      <Check size={13} className="text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} className="text-slate-500 dark:text-slate-400" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                {/* Botão Exportar (baixa o PDF oficial) */}
                <a
                  href={api.worklogs.getDownloadReportUrl(log.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-95 transition-all"
                  title="Baixar arquivo PDF original"
                >
                  <Download size={13} />
                  <span>Exportar</span>
                </a>

                {/* Alternar de volta para detalhes do chamado */}
                <button
                  type="button"
                  onClick={() => setViewingPdf(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                  title="Voltar para a visão detalhada do chamado"
                >
                  <ArrowLeft size={13} />
                  <span>Detalhes</span>
                </button>

                {/* Fechar modal */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                  title="Fechar visualizador"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Canvas de Exibição do Documento PDF */}
            <div className="flex-1 w-full h-full relative bg-slate-100 dark:bg-[#0b0f19] p-3 sm:p-5 overflow-hidden flex items-center justify-center">
              {pdfLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100/90 dark:bg-[#0b0f19]/90 z-10 backdrop-blur-xs text-slate-600 dark:text-slate-400">
                  <Loader2 size={32} className="text-slate-900 dark:text-white animate-spin" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Carregando relatório PDF oficial...
                  </span>
                </div>
              )}

              <iframe
                src={api.worklogs.getViewReportUrl(log.id)}
                className="w-full h-full border border-slate-200 dark:border-slate-800 rounded-xl shadow-md bg-white dark:bg-[#0b0f19]"
                title={log.title || "Relatório PDF"}
                onLoad={() => setPdfLoading(false)}
              />
            </div>
          </div>
        ) : viewingMedia ? (
          /* ============================================================
             2. Visualizador de Mídias Anexadas (Galeria com navegação)
             ============================================================ */
          <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-[#111726]">
            {/* Topbar da Galeria */}
            <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] flex items-center justify-between gap-4 shrink-0 shadow-xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <Paperclip size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    Mídias Anexadas ({mediaCurrentIndex + 1} de {mediaPaths.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-95 transition-all"
                  title="Baixar arquivo original"
                >
                  <Download size={13} />
                  <span>Baixar Arquivo</span>
                </a>

                {/* Alternar de volta para detalhes */}
                <button
                  type="button"
                  onClick={() => setViewingMedia(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                  title="Voltar para a visão detalhada do chamado"
                >
                  <ArrowLeft size={13} />
                  <span>Detalhes</span>
                </button>

                {/* Fechar modal */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Conteúdo Central da Galeria */}
            <div className="flex-1 w-full bg-slate-100 dark:bg-[#0b0f19] p-4 sm:p-6 flex flex-col items-center justify-between min-h-0 overflow-hidden">
              {/* Palco Central: Seta Esquerda + Card Central + Seta Direita */}
              <div className="w-full flex-1 min-h-0 flex items-center justify-center gap-3 sm:gap-6">
                {/* Seta Esquerda (Sem loop) */}
                {mediaPaths.length > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevMedia}
                    disabled={!canGoPrev}
                    aria-label="Mídia anterior"
                    className="bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md p-3 rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                    title={canGoPrev ? "Mídia anterior (Seta esquerda)" : "Primeira mídia"}
                  >
                    <ChevronLeft size={28} />
                  </button>
                )}

                {/* Quadro Central da Mídia */}
                <div className="flex-1 max-w-4xl h-full flex items-center justify-center min-h-0 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 shadow-md p-2 sm:p-4 overflow-hidden relative">
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
                    <div className="p-8 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-2xl text-center max-w-md shadow-xs flex flex-col items-center gap-3">
                      <FileText size={42} className="text-slate-600 dark:text-slate-400" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Arquivo Anexado</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 break-all">{mediaPaths[mediaCurrentIndex]}</p>
                      <a
                        href={mediaPaths[mediaCurrentIndex]}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-xs transition-all"
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
                    className="bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md p-3 rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
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
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border transition-all duration-200 shrink-0 cursor-pointer relative group bg-white dark:bg-[#161f33] ${
                          isSelectedMedia
                            ? "ring-2 ring-slate-900 dark:ring-white border-slate-900 dark:border-white shadow-md scale-105 opacity-100"
                            : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-400 dark:hover:border-slate-600 hover:scale-100"
                        }`}
                        title={`Ir para mídia ${idx + 1}`}
                      >
                        {isImage(path) ? (
                          <img src={path} alt="" className="w-full h-full object-cover" />
                        ) : isVideo(path) ? (
                          <div className="w-full h-full bg-slate-100 dark:bg-[#0b0f19] flex items-center justify-center text-slate-600 dark:text-slate-400">
                            <Video size={18} />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-slate-100 dark:bg-[#0b0f19] flex items-center justify-center text-slate-600 dark:text-slate-400">
                            <FileText size={18} />
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0.5 right-1 text-[9px] font-bold px-1 rounded shadow-xs ${
                            isSelectedMedia
                              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                              : "bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
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
             3. Visão Padrão de Detalhes do Chamado com WorkLogDetailContent
             ============================================================ */
          <div className="p-5 sm:p-6 overflow-y-auto max-h-[90vh]">
            <WorkLogDetailContent
              log={log}
              onRefresh={onRefresh}
              onClose={onClose}
              onDelete={() => {
                onClose();
                onRefresh?.();
              }}
              headerAction={
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all duration-150 cursor-pointer"
                  title="Fechar (Esc)"
                >
                  <X size={20} />
                </button>
              }
              onOpenPdfModal={() => {
                setViewingPdf(true);
                setPdfLoading(true);
              }}
              onOpenMediaModal={() => {
                setMediaCurrentIndex(0);
                setViewingMedia(true);
              }}
              footerActions={
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition-all duration-150 active:scale-95 cursor-pointer"
                >
                  Fechar
                </button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
};
