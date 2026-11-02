import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, WorkLogItem, DashboardSummaryData } from "../services/api";
import { RecentWorkLogsList } from "../components/dashboard/RecentWorkLogsList";
import { SolvedReportsList } from "../components/dashboard/SolvedReportsList";
import { BasicAgenda } from "../components/dashboard/BasicAgenda";
import { ReportDetailsModal } from "../components/dashboard/ReportDetailsModal";
import {
  Layers,
  Clock,
  Plus,
  RotateCw,
  TrendingUp,
  AlertCircle,
  FileCheck2,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSummaryData>({
    recentLogs: [],
    solvedLogs: [],
    stats: {
      total: 0,
      solved: 0,
      today: 0,
      technical: 0,
      inProgress: 0,
    },
  });

  const [selectedLog, setSelectedLog] = useState<WorkLogItem | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await api.worklogs.getDashboardSummary();
      setData(summary);
    } catch (err) {
      console.error("[DashboardOverviewPage] Erro ao carregar dados:", err);
      // Fallback para getRecent e getSolved caso o endpoint consolidado falhe
      try {
        const [recent, solved] = await Promise.all([
          api.worklogs.getRecent(25),
          api.worklogs.getSolved(25),
        ]);
        setData({
          recentLogs: recent,
          solvedLogs: solved,
          stats: {
            total: recent.length,
            solved: solved.length,
            today: recent.filter((l) => {
              const d = new Date(l.createdAt);
              const today = new Date();
              return d.toDateString() === today.toDateString();
            }).length,
            technical: recent.filter((l) => l.technicalAction || l.implementation).length,
            inProgress: Math.max(0, recent.length - solved.length),
          },
        });
      } catch (fallbackErr) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dados do dashboard."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const todayFormatted = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!user) return null;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col gap-6 animate-fade-in">
      {/* Header com Saudação e Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 capitalize mt-1">
            {todayFormatted} • Bem-vindo(a), <span className="font-semibold text-slate-700">{user.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            title="Atualizar dados do dashboard"
          >
            <RotateCw size={14} className={loading ? "animate-spin text-slate-500" : "text-slate-500"} />
            <span>Atualizar</span>
          </button>

          <Link
            to="/dashboard/atendimentos"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
          >
            <Plus size={15} />
            <span>Novo Atendimento</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards / Métricas de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Registrado */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total de Atendimentos
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {data.stats.total}
            </div>
            <span className="text-xs font-medium text-indigo-600 mt-0.5 block">
              Cadastrados no sistema
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers size={20} />
          </div>
        </div>

        {/* KPI 2: Solucionados Técnico */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Solucionados (Técnico)
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {data.stats.solved}
            </div>
            <span className="text-xs font-medium text-emerald-600 mt-0.5 block">
              Finalizados com êxito
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
            <FileCheck2 size={20} />
          </div>
        </div>

        {/* KPI 3: Em Andamento / Pendentes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Em Andamento
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {data.stats.inProgress}
            </div>
            <span className="text-xs font-medium text-sky-600 mt-0.5 block">
              Aguardando conclusão
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100/80 text-sky-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
        </div>

        {/* KPI 4: Registros de Hoje */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Atendimentos de Hoje
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {data.stats.today}
            </div>
            <span className="text-xs font-medium text-amber-600 mt-0.5 block">
              Criados no plantão atual
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100/80 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Tratamento de Erro */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 flex items-center justify-between text-sm shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDashboard}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline px-2 py-1 rounded transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Grid Principal com os 3 Painéis */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-600">Carregando dados do dashboard...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Campo 1: Lista vertical com os últimos atendimentos registrados */}
          <div className="min-w-0 h-[calc(100vh-280px)] min-h-[620px] max-h-[820px]">
            <RecentWorkLogsList
              logs={data.recentLogs}
              onSelectLog={(log) => setSelectedLog(log)}
            />
          </div>

          {/* Campo 2: Lista vertical com os últimos relatórios marcados como Solucionado */}
          <div className="min-w-0 h-[calc(100vh-280px)] min-h-[620px] max-h-[820px]">
            <SolvedReportsList
              logs={data.solvedLogs}
              onSelectReport={(log) => setSelectedLog(log)}
            />
          </div>

          {/* Campo 3: Agenda funcional básica */}
          <div className="min-w-0 h-[calc(100vh-280px)] min-h-[620px] max-h-[820px]">
            <BasicAgenda />
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Relatório */}
      <ReportDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </main>
  );
}
