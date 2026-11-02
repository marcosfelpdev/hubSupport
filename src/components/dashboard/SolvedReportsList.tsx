import React, { useState, useMemo } from "react";
import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { WorkLogItem } from "@/services/api";
import ReportCardMinimized from "@/components/ReportCardMinimized";

interface SolvedReportsListProps {
  logs: WorkLogItem[];
  onSelectReport?: (log: WorkLogItem) => void;
}

export const SolvedReportsList: React.FC<SolvedReportsListProps> = ({ logs, onSelectReport }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const solvedLogs = useMemo(() => {
    return logs.filter((log) => {
      const isSolved = log.status === "Solucionado";
      if (!isSolved) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        log.title?.toLowerCase().includes(term) ||
        log.requester?.toLowerCase().includes(term) ||
        log.clientOrOffice?.toLowerCase().includes(term) ||
        log.actionTaken?.toLowerCase().includes(term) ||
        log.reportedProblem?.toLowerCase().includes(term) ||
        log.tag?.name?.toLowerCase().includes(term)
      );
    });
  }, [logs, searchTerm]);

  return (
    <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col h-full min-h-[580px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Relatórios Solucionados
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Chamados marcados como Solucionado pelo técnico
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
            {solvedLogs.length} {solvedLogs.length === 1 ? "solucionado" : "solucionados"}
          </span>
        </div>

        {/* Busca rápida */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar por cliente, solicitante, plataforma..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Lista Vertical */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {solvedLogs.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <ShieldCheck size={28} className="opacity-40 text-slate-400 dark:text-slate-500" />
            <span>Nenhum relatório solucionado encontrado.</span>
          </div>
        ) : (
          solvedLogs.map((log) => (
            <ReportCardMinimized
              key={log.id}
              log={log}
              onClick={() => onSelectReport?.(log)}
            />
          ))
        )}
      </div>
    </div>
  );
};
