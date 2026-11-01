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
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Dashboard de Atendimentos
        </h1>
        <p className="text-sm text-slate-500 capitalize mt-1">
          {today}
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-600">Carregando atendimentos do dia...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 flex items-center justify-between text-sm shadow-xs mb-6">
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline px-2 py-1 rounded transition-colors"
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
