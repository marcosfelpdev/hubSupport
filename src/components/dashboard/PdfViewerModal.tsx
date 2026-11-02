import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FileText, Download, X, Loader2 } from "lucide-react";
import { api, WorkLogItem } from "@/services/api";
import { WorkLogDetailData } from "@/components/dashboard/WorkLogDetailContent";

export interface PdfViewerModalProps {
  log: WorkLogItem | WorkLogDetailData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);

  // Reseta estado de carregamento ao trocar de chamado ou abrir
  useEffect(() => {
    if (isOpen && log?.id) {
      setPdfLoading(true);
    }
  }, [isOpen, log?.id]);

  // Suporte a atalho de teclado Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const structured = useMemo(() => {
    if (!log?.aiReport?.structuredData) return null;
    try {
      return JSON.parse(log.aiReport.structuredData);
    } catch {
      return null;
    }
  }, [log?.aiReport?.structuredData]);

  const formattedDate = useMemo(() => {
    if (!log?.createdAt) return "";
    try {
      return new Date(log.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(log.createdAt);
    }
  }, [log?.createdAt]);

  if (!isOpen || !log || typeof document === "undefined") {
    return null;
  }

  const title =
    structured?.title ||
    log.title ||
    `Relatório Técnico - ${log.clientOrOffice}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl w-full flex flex-col shadow-2xl shadow-slate-900/30 overflow-hidden transition-all duration-300 relative max-w-[96vw] xl:max-w-6xl h-[92vh] max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra Superior estilo Gemini / CloudNexus */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] flex items-center justify-between gap-4 shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h4
                className="text-sm font-bold text-slate-900 dark:text-white truncate"
                title={title}
              >
                {title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {log.clientOrOffice} • Registrado em {formattedDate}
                {log.tag && (
                  <span className="ml-1 text-slate-400 dark:text-slate-500">
                    • {log.tag.name}
                  </span>
                )}
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Baixar arquivo PDF original"
            >
              <Download size={13} />
              <span>Exportar</span>
            </a>

            {/* Fechar modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title="Fechar visualizador (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Canvas de Exibição do Documento PDF */}
        <div className="flex-1 w-full h-full relative bg-slate-100 dark:bg-[#0b0f19] p-3 sm:p-5 overflow-hidden flex items-center justify-center">
          {pdfLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100/90 dark:bg-[#0b0f19]/90 z-10 backdrop-blur-xs text-slate-600 dark:text-slate-400">
              <Loader2
                size={32}
                className="text-slate-900 dark:text-white animate-spin"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Carregando relatório PDF oficial...
              </span>
            </div>
          )}

          <iframe
            src={api.worklogs.getViewReportUrl(log.id)}
            className="w-full h-full border border-slate-200 dark:border-slate-800 rounded-xl shadow-md bg-white dark:bg-[#0b0f19]"
            title={title}
            onLoad={() => setPdfLoading(false)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PdfViewerModal;
