import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, WorkLogItem } from "../services/api";
import TechnicianDashboardClient from "../components/TechnicianDashboardClient";

export default function TechnicianPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkLogItem[]>([]);
  const [employees, setEmployees] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        maxWidth: "1600px",
        padding: "2rem 2.5rem",
        width: "100%",
      }}
    >
      {/* Cabeçalho da página */}
      <div style={{ marginBottom: "2rem" }}>
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

      {loading ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div className="spinner" style={{ width: "28px", height: "28px" }} />
          <span>Carregando fila técnica...</span>
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
