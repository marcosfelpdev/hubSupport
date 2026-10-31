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
  CheckCircle2,
  Clock,
  Calendar,
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
    <main
      className="animate-fade-in"
      style={{
        maxWidth: "1600px",
        padding: "2rem 2.5rem",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
      }}
    >
      {/* Header com Saudação e Ações Rápidas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.65rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.875rem",
              textTransform: "capitalize",
              marginTop: "0.2rem",
            }}
          >
            {todayFormatted} • Bem-vindo(a), <strong style={{ color: "#e2e8f0" }}>{user.name}</strong>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 0.85rem",
              fontSize: "0.825rem",
              fontWeight: 600,
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Atualizar dados do dashboard"
          >
            <RotateCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>

          <Link
            to="/dashboard/atendimentos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 1rem",
              fontSize: "0.825rem",
              fontWeight: 600,
              backgroundColor: "#6366f1",
              border: "none",
              borderRadius: "0.5rem",
              color: "#ffffff",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
              transition: "all 0.15s ease",
            }}
          >
            <Plus size={15} />
            <span>Novo Atendimento</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards / Métricas de Resumo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* KPI 1: Total Registrado */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Total de Atendimentos
            </span>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.2rem" }}>
              {data.stats.total}
            </div>
            <span style={{ fontSize: "0.72rem", color: "#818cf8" }}>
              Cadastrados no sistema
            </span>
          </div>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(99, 102, 241, 0.15)",
              color: "#818cf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers size={20} />
          </div>
        </div>

        {/* KPI 2: Solucionados Técnico */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "0.75rem",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#34d399", textTransform: "uppercase" }}>
              Solucionados (Técnico)
            </span>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.2rem" }}>
              {data.stats.solved}
            </div>
            <span style={{ fontSize: "0.72rem", color: "#34d399" }}>
              Finalizados com êxito
            </span>
          </div>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileCheck2 size={20} />
          </div>
        </div>

        {/* KPI 3: Em Andamento / Pendentes */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Em Andamento
            </span>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.2rem" }}>
              {data.stats.inProgress}
            </div>
            <span style={{ fontSize: "0.72rem", color: "#60a5fa" }}>
              Aguardando conclusão
            </span>
          </div>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={20} />
          </div>
        </div>

        {/* KPI 4: Registros de Hoje */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Atendimentos de Hoje
            </span>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.2rem" }}>
              {data.stats.today}
            </div>
            <span style={{ fontSize: "0.72rem", color: "#fbbf24" }}>
              Criados no plantão atual
            </span>
          </div>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Tratamento de Erro */}
      {error && (
        <div className="alert alert-error" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            onClick={fetchDashboard}
            className="btn-ghost"
            style={{ marginLeft: "auto", padding: "0.25rem 0.5rem" }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Grid Principal com os 3 Campos Solicitados */}
      {loading ? (
        <div
          style={{
            padding: "5rem 2rem",
            textAlign: "center",
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            backgroundColor: "var(--bg-card)",
            borderRadius: "1rem",
            border: "1px solid var(--border)",
          }}
        >
          <div className="spinner" style={{ width: "32px", height: "32px" }} />
          <span style={{ fontSize: "0.9rem" }}>Carregando dados do dashboard...</span>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.25rem",
            alignItems: "stretch",
          }}
        >
          {/* Campo 1: Lista vertical com os últimos atendimentos registrados */}
          <div style={{ minWidth: 0, height: "calc(100vh - 270px)", minHeight: "620px", maxHeight: "800px" }}>
            <RecentWorkLogsList
              logs={data.recentLogs}
              onSelectLog={(log) => setSelectedLog(log)}
            />
          </div>

          {/* Campo 2: Lista vertical com os últimos relatórios marcados como Solucionado */}
          <div style={{ minWidth: 0, height: "calc(100vh - 270px)", minHeight: "620px", maxHeight: "800px" }}>
            <SolvedReportsList
              logs={data.solvedLogs}
              onSelectReport={(log) => setSelectedLog(log)}
            />
          </div>

          {/* Campo 3: Agenda funcional básica */}
          <div style={{ minWidth: 0, height: "calc(100vh - 270px)", minHeight: "620px", maxHeight: "800px" }}>
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
