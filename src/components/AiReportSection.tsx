"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Sparkles, Download, RotateCw, Clock, AlertTriangle, FileText, Loader2, Video } from "lucide-react";
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
      case "completed":
        return {
          label: "Disponível",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />,
        };
      case "processing":
        return {
          label: "Processando IA",
          badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: <Loader2 size={12} className="animate-spin text-indigo-600 shrink-0" />,
        };
      case "pending":
        return {
          label: "Aguardando",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          icon: <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />,
        };
      case "failed":
        return {
          label: "Falha",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />,
        };
      default:
        return {
          label: report.status,
          badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
          icon: <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-4">
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
              Relatório gerado por IA
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Gerado a partir da gravação de tela com Google Gemini
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border shadow-2xs ${badge.badgeClass}`}
        >
          {badge.icon}
          <span>{badge.label}</span>
        </span>
      </div>

      {/* Conteúdo baseado no estado */}
      {report.status === "pending" && (
        <div className="flex flex-col gap-3 p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl">
          <div className="flex items-center gap-2.5 text-xs text-amber-900">
            <Clock size={16} className="text-amber-600 animate-pulse shrink-0" />
            <span className="font-medium">
              A gravação foi recebida e está aguardando o início da análise pela inteligência artificial.
            </span>
          </div>

          {report.videoPath && (
            <div className="flex justify-end pt-1">
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording-pending"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-indigo-600" />
                <span>Baixar gravação de vídeo</span>
              </a>
            </div>
          )}
        </div>
      )}

      {report.status === "processing" && (
        <div className="flex flex-col gap-3 p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl">
          <div className="flex items-center gap-2.5 text-xs text-indigo-950 font-medium">
            <Loader2 size={16} className="animate-spin text-indigo-600 shrink-0" />
            <span>A IA está analisando o vídeo e estruturando o relatório em PDF...</span>
          </div>

          {/* Barra de progresso moderna */}
          <div className="w-full h-1.5 bg-indigo-100/80 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full animate-pulse" />
          </div>

          {report.videoPath && (
            <div className="flex justify-end pt-1">
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording-processing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-indigo-600" />
                <span>Baixar gravação</span>
              </a>
            </div>
          )}
        </div>
      )}

      {report.status === "completed" && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-tight">
                Relatório executivo estruturado
              </p>
              {report.completedAt && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gerado em {new Date(report.completedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {report.videoPath && (
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                title="Baixar arquivo da gravação de tela com áudio"
              >
                <Video size={13} className="text-slate-600" />
                <span>Baixar gravação</span>
              </a>
            )}

            <a
              href={`/api/reports/${workLogId}/download`}
              target="_blank"
              rel="noopener noreferrer"
              download
              id="btn-download-pdf"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer"
              title="Baixar relatório executivo em PDF"
            >
              <Download size={14} className="text-white" />
              <span>Baixar relatório PDF</span>
            </a>
          </div>
        </div>
      )}

      {report.status === "failed" && (
        <div className="flex flex-col gap-3 p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-xl">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-rose-900 leading-tight">
                Não foi possível gerar o relatório
              </p>
              <p className="text-[11px] text-rose-700 mt-1 leading-normal break-words">
                {report.errorMessage || "Ocorreu um erro no processamento com a IA. Tente novamente."}
              </p>
              {retryFeedback && (
                <p className="text-[11px] text-amber-700 font-medium mt-1">
                  {retryFeedback}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            {report.videoPath && (
              <a
                href={`/api/reports/${workLogId}/recording`}
                target="_blank"
                rel="noopener noreferrer"
                download
                id="btn-download-recording-failed"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-slate-600" />
                <span>Baixar gravação</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 shadow-xs transition-all cursor-pointer ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw size={13} className={isRetrying ? "animate-spin text-rose-600" : "text-rose-600"} />
              <span>{isRetrying ? "Reiniciando..." : "Tentar novamente"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
