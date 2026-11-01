import { useEffect, useState } from "react";
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
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-600">Carregando membros da equipe...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button
            onClick={fetchEmployees}
            className="text-xs font-semibold text-rose-700 underline hover:text-rose-900 cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      </main>
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
