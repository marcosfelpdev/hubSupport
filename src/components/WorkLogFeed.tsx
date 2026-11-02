import React from "react";
import ReportCardMinimized from "@/components/ReportCardMinimized";
import { Clock } from "lucide-react";

export interface WorkLog {
  id: string;
  title?: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken?: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  media: string;
  tagId?: string | null;
  tag?: {
    id: string;
    name: string;
    color: string;
  } | null;
  createdAt: Date;
  userId: string;
  user: {
    name: string;
    email: string;
  };
  aiReport?: {
    id: string;
    status: string;
    videoPath?: string | null;
    pdfPath?: string | null;
    structuredData?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | string | null;
    completedAt?: Date | string | null;
  } | null;
}

export default function WorkLogFeed({
  logs,
  currentUserId,
}: {
  logs: WorkLog[];
  currentUserId: string;
}) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Feed header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Feed de Atendimentos
          </h2>
          {logs.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {logs.length} {logs.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Atualizado automaticamente
        </span>
      </div>

      {/* Empty state */}
      {logs.length === 0 && (
        <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/80 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1">
            <Clock size={22} />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Nenhum atendimento registrado hoje
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Preencha o formulário para registrar o primeiro chamado do dia.
          </p>
        </div>
      )}

      {/* Log entries */}
      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <ReportCardMinimized
            key={log.id}
            log={log}
          />
        ))}
      </div>
    </div>
  );
}
