import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, WorkLogItem } from "../services/api";
import TechnicianDashboardClient from "../components/TechnicianDashboardClient";
import { TechnicianKanbanBoard } from "../components/dashboard/TechnicianKanbanBoard";
import { Columns3, LayoutList, RefreshCw } from "lucide-react";

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
    <main
      className="animate-fade-in"
      style={{
        maxWidth: "1800px",
        padding: "1.75rem 2rem",
        width: "100%",
        margin: "0 auto",
      }}
    >
      {/* Cabeçalho da página com View Switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Painel de Atendimentos Técnicos
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 600,
                backgroundColor: "rgba(56, 189, 248, 0.12)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              🔧 Equipe Técnica
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textTransform: "capitalize" }}>
            {today} &bull; Relatórios marcados para ação técnica ou implementação
          </p>
        </div>

        {/* Controles de visualização e sincronização */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Botão de atualização rápida */}
          <button
            onClick={fetchTechnicalData}
            title="Atualizar chamados"
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.8rem",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>

          {/* Toggle Switcher: Kanban vs Lista */}
          <div
            style={{
              display: "flex",
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              padding: "3px",
              gap: "3px",
            }}
          >
            <button
              onClick={() => setViewMode("kanban")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.45rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: viewMode === "kanban" ? "linear-gradient(135deg, #0284c7, #0ea5e9)" : "transparent",
                color: viewMode === "kanban" ? "#ffffff" : "#94a3b8",
                boxShadow: viewMode === "kanban" ? "0 2px 8px rgba(14, 165, 233, 0.3)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Columns3 size={15} />
              <span>Quadro Kanban (Operações)</span>
            </button>
            <button
              onClick={() => setViewMode("classic")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.45rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: viewMode === "classic" ? "linear-gradient(135deg, #4f46e5, #6366f1)" : "transparent",
                color: viewMode === "classic" ? "#ffffff" : "#94a3b8",
                boxShadow: viewMode === "classic" ? "0 2px 8px rgba(99, 102, 241, 0.3)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <LayoutList size={15} />
              <span>Lista Tradicional</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: "4rem 2rem",
            textAlign: "center",
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            background: "rgba(15, 23, 42, 0.5)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <div className="spinner" style={{ width: "32px", height: "32px" }} />
          <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Sincronizando fila técnica e portais de despacho...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          <span>{error}</span>
          <button
            onClick={fetchTechnicalData}
            className="btn-ghost"
            style={{ marginLeft: "auto", padding: "0.25rem 0.5rem" }}
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
