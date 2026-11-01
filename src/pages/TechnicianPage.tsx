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
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "classic">("kanban");

  const fetchTechnicalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [logsData, employeesData] = await Promise.all([
        api.worklogs.getTechnical(),
        api.employees.getAll(),
      ]);
      setLogs(logsData);
      setEmployees(employeesData.map((e) => ({ name: e.name })));
    } catch (err) {
      console.error("[TechnicianPage] Erro ao carregar dados técnicos:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar atendimentos técnicos.");
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Painel de Atendimentos Técnicos
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 backdrop-blur-xs shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span>🔧 Equipe Técnica</span>
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] capitalize flex items-center gap-2">
            <span>{today}</span>
            <span className="text-[var(--border-light)]">&bull;</span>
            <span className="normal-case">Relatórios marcados para ação técnica ou implementação</span>
          </p>
        </div>

        {/* Controles de visualização e sincronização */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Botão de atualização rápida */}
          <button
            type="button"
            onClick={fetchTechnicalData}
            disabled={loading}
            title="Atualizar chamados"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] border border-[var(--border-light)] hover:border-slate-600 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer shadow-xs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-sky-400" : ""} />
            <span>Atualizar</span>
          </button>

          {/* Toggle Switcher: Kanban vs Lista */}
          <div className="inline-flex p-1 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl shadow-inner gap-1">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-md shadow-sky-500/25"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <Columns3 size={15} />
              <span>Quadro Kanban (Operações)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("classic")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === "classic"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <LayoutList size={15} />
              <span>Lista Tradicional</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 px-8 flex flex-col items-center justify-center gap-4 text-center bg-[var(--bg-card)]/50 border border-[var(--border)] rounded-2xl backdrop-blur-xs">
          <div className="w-10 h-10 border-[3px] border-sky-500/20 border-t-sky-400 rounded-full animate-spin" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Carregando atendimentos técnicos...
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Sincronizando fila técnica e portais de despacho
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-4 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchTechnicalData}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 transition-colors duration-150 cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      ) : viewMode === "kanban" ? (
        <TechnicianKanbanBoard
          logs={logs}
          currentUserId={user.id}
          employees={employees}
          onLogResolved={fetchTechnicalData}
        />
      ) : (
        <TechnicianDashboardClient
          logs={logs}
          currentUserId={user.id}
          employees={employees}
          onLogResolved={fetchTechnicalData}
        />
      )}
    </main>
  );
}
