import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, WorkLogItem } from "../services/api";
import TechnicianDashboardClient from "../components/TechnicianDashboardClient";
import { TechnicianKanbanBoard } from "../components/dashboard/TechnicianKanbanBoard";
import { Columns3, LayoutList, RefreshCw, AlertTriangle } from "lucide-react";

export default function TechnicianPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkLogItem[]>([]);
  const [employees, setEmployees] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "classic">("kanban");

  const fetchTechnicalData = async (silent = false) => {
    try {
      if (!silent) {
        if (logs.length === 0) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
      }
      setError(null);
      const [logsData, employeesData] = await Promise.all([
        api.worklogs.getTechnical(),
        api.employees.getAll(),
      ]);
      setLogs(logsData);
      setEmployees(employeesData.map((e) => ({ name: e.name })));
    } catch (err) {
      console.error("[TechnicianPage] Erro ao carregar dados técnicos:", err);
      if (logs.length === 0) {
        setError(err instanceof Error ? err.message : "Erro ao carregar atendimentos técnicos.");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTechnicalData();
  }, []);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!user) return null;

  return (
    <main className="animate-fade-in w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cabeçalho da página com View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Painel de Atendimentos Técnicos
            </h1>
            <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1 text-xs font-semibold shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span>🔧 Equipe Técnica</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 capitalize flex items-center gap-2">
            <span>{today}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="normal-case">Relatórios marcados para ação técnica ou implementação</span>
          </p>
        </div>

        {/* Controles de visualização e sincronização */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Botão de atualização rápida */}
          <button
            type="button"
            onClick={() => fetchTechnicalData(false)}
            disabled={loading || isRefreshing}
            title="Atualizar chamados"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw size={14} className={loading || isRefreshing ? "animate-spin text-slate-400" : "text-slate-500"} />
            <span>{isRefreshing ? "Sincronizando..." : "Atualizar"}</span>
          </button>

          {/* Switcher de visualização: Kanban vs Lista */}
          <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 rounded-lg font-medium hover:bg-slate-200/60"
              }`}
            >
              <Columns3 size={15} />
              <span>Quadro Kanban (Operações)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("classic")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                viewMode === "classic"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 rounded-lg font-medium hover:bg-slate-200/60"
              }`}
            >
              <LayoutList size={15} />
              <span>Lista Tradicional</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 px-8 flex flex-col items-center justify-center gap-4 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="w-10 h-10 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-slate-900">
              Carregando atendimentos técnicos...
            </p>
            <p className="text-xs text-slate-500">
              Sincronizando fila técnica e portais de despacho
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-4 p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchTechnicalData(false)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-200 transition-colors duration-150 cursor-pointer shadow-xs"
          >
            Tentar novamente
          </button>
        </div>
      ) : viewMode === "kanban" ? (
        <TechnicianKanbanBoard
          logs={logs}
          currentUserId={user.id}
          employees={employees}
          onLogResolved={() => fetchTechnicalData(true)}
        />
      ) : (
        <TechnicianDashboardClient
          logs={logs}
          currentUserId={user.id}
          employees={employees}
          onLogResolved={() => fetchTechnicalData(true)}
        />
      )}
    </main>
  );
}
