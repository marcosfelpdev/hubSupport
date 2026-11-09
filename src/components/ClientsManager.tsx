import { useState, useTransition, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { api, ClientItem } from "@/services/api";
import {
  Building2,
  Plus,
  Search,
  Trash2,
  Check,
  X,
  AlertCircle,
  Loader2,
  Calendar,
  MessageSquare,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

interface ClientsManagerProps {
  initialClients: ClientItem[];
  currentUser: CurrentUser;
  onClientsChanged?: () => void;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateValue?: string) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function ClientsManager({
  initialClients,
  currentUser,
  onClientsChanged,
}: ClientsManagerProps) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  // Permissões
  const canDelete = currentUser.role === "ADMIN" || currentUser.role === "TECHNICIAN";

  // Estados de Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [deletingClient, setDeletingClient] = useState<ClientItem | null>(null);

  // Feedbacks
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Sincroniza estado com initialClients
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  function showSuccess(msg: string) {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  }

  // Filtragem em tempo real
  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(term));
  }, [clients, searchTerm]);

  // Totais agregados
  const totalWorkLogs = useMemo(() => {
    return clients.reduce((acc, c) => acc + (c._count?.workLogs || 0), 0);
  }, [clients]);

  const totalEvents = useMemo(() => {
    return clients.reduce((acc, c) => acc + (c._count?.events || 0), 0);
  }, [clients]);

  // Handler: Criar Cliente (Simples: apenas nome e salvar)
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);

    const cleanName = clientName.trim();
    if (!cleanName) {
      setActionError("Por favor, digite o nome do cliente.");
      return;
    }

    startTransition(async () => {
      try {
        await api.clients.create({ name: cleanName });
        setClientName("");
        setIsCreateOpen(false);
        showSuccess("Cliente cadastrado com sucesso!");
        onClientsChanged?.();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erro ao cadastrar cliente.");
      }
    });
  }

  // Handler: Excluir Cliente
  async function handleDeleteConfirm() {
    if (!deletingClient) return;
    setActionError(null);

    startTransition(async () => {
      try {
        await api.clients.delete(deletingClient.id);
        setDeletingClient(null);
        showSuccess("Cliente excluído com sucesso.");
        onClientsChanged?.();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erro ao excluir cliente.");
      }
    });
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs">
              <Building2 className="w-5 h-5" />
            </span>
            <span>Clientes</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão e histórico de atendimentos por cliente
          </p>
        </div>

        {/* Action Button: Novo Cliente */}
        <button
          id="btn-open-create-client"
          type="button"
          onClick={() => {
            setActionError(null);
            setClientName("");
            setIsCreateOpen(true);
          }}
          className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl px-4 py-2.5 text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 rounded-xl p-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fade-in shadow-2xs">
          <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search and Summary bar */}
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-4 sm:px-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            placeholder="Buscar clientes por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Badges / Metrics */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Total de Clientes:{" "}
            <strong className="text-slate-900 dark:text-white font-semibold">
              {clients.length}
            </strong>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{totalWorkLogs} Atendimentos</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/60">
            <Calendar className="w-3.5 h-3.5" />
            <span>{totalEvents} Reuniões</span>
          </span>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3 shadow-2xs">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              {searchTerm
                ? `Não encontramos nenhum cliente com o termo "${searchTerm}". Tente outro nome.`
                : "Cadastre seus clientes para gerenciar o histórico completo de atendimentos e reuniões."}
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setClientName("");
                  setIsCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold px-4 py-2 rounded-xl shadow-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeiro Cliente</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#0b0f19]/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Cliente</th>
                  <th className="px-6 py-3.5 text-center">Atendimentos</th>
                  <th className="px-6 py-3.5 text-center">Reuniões</th>
                  <th className="px-6 py-3.5">Data de Cadastro</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClients.map((client) => {
                  const workLogsCount = client._count?.workLogs || 0;
                  const eventsCount = client._count?.events || 0;

                  return (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/dashboard/clientes/${client.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#161f33]/60 transition-colors cursor-pointer group"
                    >
                      {/* 1. Avatar & Nome do Cliente */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                            {getInitials(client.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block truncate">
                              {client.name}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>Clique para ver histórico completo</span>
                              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Total de Atendimentos */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 shadow-2xs">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{workLogsCount}</span>
                        </span>
                      </td>

                      {/* 3. Total de Reuniões */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/70 dark:border-violet-800/60 shadow-2xs">
                          <Calendar className="w-3.5 h-3.5 text-violet-500" />
                          <span>{eventsCount}</span>
                        </span>
                      </td>

                      {/* 4. Data de Cadastro */}
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(client.createdAt)}
                      </td>

                      {/* 5. Ações */}
                      <td className="px-6 py-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Ver perfil e histórico"
                            onClick={() => navigate(`/dashboard/clientes/${client.id}`)}
                            className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl transition-all cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              title="Excluir cliente"
                              onClick={() => {
                                setActionError(null);
                                setDeletingClient(client);
                              }}
                              className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: NOVO CLIENTE (Simples: Nome e Salvar) ================= */}
      {isCreateOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isPending && setIsCreateOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#111726] rounded-2xl shadow-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 max-w-md w-full animate-scale-in flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    Novo Cliente
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Cadastre uma nova empresa ou cliente parceiro.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isPending && setIsCreateOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {actionError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="client-name-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Nome do Cliente <span className="text-rose-500">*</span>
                </label>
                <input
                  id="client-name-input"
                  type="text"
                  autoFocus
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                  placeholder="Ex: Cartório de Notas ou Empresa Alpha"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !clientName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Cliente</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: EXCLUIR CLIENTE ================= */}
      {deletingClient && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isPending && setDeletingClient(null)}
        >
          <div
            className="bg-white dark:bg-[#111726] rounded-2xl shadow-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 max-w-md w-full animate-scale-in flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/60 shadow-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Excluir Cliente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Tem certeza que deseja excluir o cliente{" "}
                  <strong className="text-slate-900 dark:text-white font-semibold">
                    "{deletingClient.name}"
                  </strong>
                  ? Os atendimentos e reuniões existentes serão preservados, mas não estarão mais vinculados a este perfil.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDeletingClient(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Sim, excluir</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
