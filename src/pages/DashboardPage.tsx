import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, WorkLogItem } from "../services/api";
import DashboardClient from "../components/DashboardClient";

export default function DashboardPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkLogItem[]>([]);
  const [employees, setEmployees] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [logsData, employeesData] = await Promise.all([
        api.worklogs.getDaily(),
        api.employees.getAll(),
      ]);
      setLogs(logsData);
      setEmployees(employeesData.map((e) => ({ name: e.name })));
    } catch (err) {
      console.error("[DashboardPage] Erro ao carregar dados:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar dados do dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
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
      {/* Page title */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "0.25rem",
          }}
        >
          Dashboard de Atendimentos
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textTransform: "capitalize" }}>
          {today}
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
          <span>Carregando atendimentos do dia...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="btn-ghost"
            style={{ marginLeft: "auto", padding: "0.25rem 0.5rem" }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <DashboardClient
          logs={logs}
          currentUserId={user.id}
          employees={employees}
          onLogCreated={fetchDashboardData}
        />
      )}
    </main>
  );
}
