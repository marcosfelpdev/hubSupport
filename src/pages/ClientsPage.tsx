import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, ClientItem } from "../services/api";
import ClientsManager from "../components/ClientsManager";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.clients.getAll();
      setClients(data);
    } catch (err) {
      console.error("[ClientsPage] Erro ao carregar clientes:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  if (!user) return null;

  if (loading) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
        <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-slate-700 dark:text-slate-300 animate-spin" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Carregando lista de clientes...
          </span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl p-4 text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchClients}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <ClientsManager
      initialClients={clients}
      currentUser={user}
      onClientsChanged={fetchClients}
    />
  );
}
