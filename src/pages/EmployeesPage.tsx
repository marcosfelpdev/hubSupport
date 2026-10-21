import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, EmployeeItem } from "../services/api";
import EmployeesManager from "../components/EmployeesManager";

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.employees.getAll();
      setEmployees(data);
    } catch (err) {
      console.error("[EmployeesPage] Erro ao carregar funcionários:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          color: "var(--text-muted)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          minHeight: "50vh",
        }}
      >
        <div className="spinner" style={{ width: "28px", height: "28px" }} />
        <span>Carregando funcionários...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <div className="alert alert-error">
          <span>{error}</span>
          <button
            onClick={fetchEmployees}
            className="btn-ghost"
            style={{ marginLeft: "auto", padding: "0.25rem 0.5rem" }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <EmployeesManager
      initialEmployees={employees}
      currentUser={user}
      onEmployeesChanged={fetchEmployees}
    />
  );
}
