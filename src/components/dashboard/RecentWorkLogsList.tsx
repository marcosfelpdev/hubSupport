import React, { useState, useMemo } from "react";
import { Clock, Search } from "lucide-react";
import { WorkLogItem } from "@/services/api";
import ReportCardMinimized from "@/components/ReportCardMinimized";

interface RecentWorkLogsListProps {
  logs: WorkLogItem[];
  onSelectLog?: (log: WorkLogItem) => void;
}

export const RecentWorkLogsList: React.FC<RecentWorkLogsListProps> = ({ logs, onSelectLog }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !searchTerm.trim() ||
        log.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.requester?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.clientOrOffice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.reportedProblem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.tag?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col h-full min-h-[580px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Clock size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Últimos Atendimentos
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Atendimentos registrados recentemente
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
            {filteredLogs.length} {filteredLogs.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {/* Busca rápida */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar por cliente, solicitante, plataforma..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
          />
        </div>

        {/* Filtro por status rápido */}
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5">
          {["ALL", "Em andamento", "Realizado", "Aguardando reunião", "Solucionado"].map((st) => {
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-slate-100/80 hover:bg-slate-200/70 text-slate-600 border-transparent"
                }`}
              >
                {st === "ALL" ? "Todos" : st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista Vertical */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Clock size={28} className="opacity-40 text-slate-400" />
            <span>Nenhum atendimento encontrado.</span>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <ReportCardMinimized
              key={log.id}
              log={log}
              onClick={() => onSelectLog?.(log)}
            />
          ))
        )}
      </div>
    </div>
  );
};
