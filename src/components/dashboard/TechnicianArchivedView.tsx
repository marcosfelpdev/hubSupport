import React, { useState, useEffect, useMemo } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Search,
  Trash2,
  Eye,
  RefreshCw,
  PackageOpen,
  Calendar,
  Building,
  User,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import { ReportDetailsModal } from "./ReportDetailsModal";
import { COLUMNS, getColumnForStatus } from "./TechnicianKanbanBoard";
import TagBadge from "@/components/TagBadge";

interface TechnicianArchivedViewProps {
  onBack: () => void;
  onRefreshKanban: () => void;
}

export const TechnicianArchivedView: React.FC<TechnicianArchivedViewProps> = ({
  onBack,
  onRefreshKanban,
}) => {
  const [archivedLogs, setArchivedLogs] = useState<WorkLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal de Detalhes
  const [selectedLogForModal, setSelectedLogForModal] = useState<WorkLogItem | null>(null);

  // Modal de Exclusão Definitiva
  const [deletingLog, setDeletingLog] = useState<WorkLogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Desarquivamento em andamento
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  // Toast de Feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchArchivedData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const data = await api.worklogs.getArchived();
      setArchivedLogs(data);
    } catch (err) {
      console.error("[ArchivedView] Erro ao buscar chamados arquivados:", err);
      setError("Não foi possível carregar os chamados arquivados.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArchivedData(false);
  }, []);

  const handleUnarchive = async (log: WorkLogItem) => {
    setUnarchivingId(log.id);
    try {
      await api.worklogs.unarchive(log.id);
      // Remove da lista local
      setArchivedLogs((prev) => prev.filter((item) => item.id !== log.id));
      setToast({
        message: `Chamado restaurado com sucesso para a coluna '${log.status}'!`,
        type: "success",
      });
      setTimeout(() => setToast(null), 4000);
      onRefreshKanban();
    } catch (err) {
      console.error("[ArchivedView] Erro ao desarquivar chamado:", err);
      setToast({ message: "Erro ao restaurar chamado.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setUnarchivingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLog) return;
    setIsDeleting(true);
    try {
      await api.worklogs.delete(deletingLog.id);
      setArchivedLogs((prev) => prev.filter((item) => item.id !== deletingLog.id));
      setDeletingLog(null);
      setToast({ message: "Chamado excluído definitivamente com sucesso.", type: "success" });
      setTimeout(() => setToast(null), 4000);
      onRefreshKanban();
    } catch (err) {
      console.error("[ArchivedView] Erro ao excluir chamado:", err);
      setToast({ message: "Não foi possível excluir o chamado definitivamente.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return archivedLogs;
    const term = searchTerm.toLowerCase().trim();
    return archivedLogs.filter((log) => {
      const title = (log.title || "").toLowerCase();
      const problem = (log.reportedProblem || "").toLowerCase();
      const client = (log.clientOrOffice || "").toLowerCase();
      const requester = (log.requester || "").toLowerCase();
      const status = (log.status || "").toLowerCase();
      return (
        title.includes(term) ||
        problem.includes(term) ||
        client.includes(term) ||
        requester.includes(term) ||
        status.includes(term)
      );
    });
  }, [archivedLogs, searchTerm]);

  return (
    <div className="w-full animate-fade-in flex flex-col gap-6">
      {/* Topbar da Tela de Arquivados */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Voltar ao Quadro Kanban</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              <Archive size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Chamados Arquivados
                </h2>
                <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {archivedLogs.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Relatórios desconsiderados ou guardados fora do fluxo ativo
              </p>
            </div>
          </div>
        </div>

        {/* Controles: Busca e Recarregar */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px] flex-1 sm:w-72">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar nos arquivados..."
              className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-1.5 pl-9 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-brand-focus-border dark:focus:border-slate-400 transition-all shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchArchivedData(true)}
            disabled={loading || isRefreshing}
            title="Atualizar lista de arquivados"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              size={13}
              className={loading || isRefreshing ? "animate-spin text-slate-400" : ""}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="py-20 px-8 flex flex-col items-center justify-center gap-4 text-center bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-xs">
          <div className="w-10 h-10 border-[3px] border-slate-200 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Carregando chamados arquivados...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Buscando registros preservados fora do quadro
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchArchivedData(false)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-red-950/60 hover:bg-red-50 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 transition-colors cursor-pointer shadow-xs"
          >
            Tentar novamente
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-20 px-8 flex flex-col items-center justify-center gap-3 text-center bg-white dark:bg-[#111726] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-1">
            <PackageOpen size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {searchTerm ? "Nenhum chamado arquivado encontrado" : "Nenhum chamado arquivado"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            {searchTerm
              ? `Não foram encontrados registros para o termo "${searchTerm}". Tente uma nova busca.`
              : "Quando você arquivar um chamado clicando com o botão direito nos cards do Kanban, ele será armazenado com segurança aqui sem poluir o fluxo ativo."}
          </p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              Limpar busca
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLogs.map((log) => {
            const colId = getColumnForStatus(log.status);
            const colDef = COLUMNS.find((c) => c.id === colId);
            const isUnarchiving = unarchivingId === log.id;

            const archivedDateStr = log.archivedAt
              ? new Date(log.archivedAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;

            return (
              <div
                key={log.id}
                className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Linha Topo: Badges e Status de Origem */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    {log.tag ? (
                      <TagBadge name={log.tag.name} color={log.tag.color} size="sm" />
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Atendimento
                      </span>
                    )}

                    {/* Coluna original preservada */}
                    <div
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      title="Coluna para onde o chamado voltará se for restaurado"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${colDef?.dotColor || "bg-slate-400"}`} />
                      <span>{colDef?.title || log.status}</span>
                    </div>
                  </div>

                  {/* Título do Chamado */}
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 mb-1.5 leading-snug">
                    {log.title || log.reportedProblem}
                  </h4>

                  {/* Detalhes rápidos: Cliente e Solicitante */}
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{log.clientOrOffice || "Cliente não informado"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <User size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{log.requester}</span>
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card: Data de arquivamento + Botões de Ação */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <Calendar size={12} className="shrink-0" />
                    <span>
                      {archivedDateStr ? `Arquivado em ${archivedDateStr}` : "Arquivado"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Botão Ver Detalhes */}
                    <button
                      type="button"
                      onClick={() => setSelectedLogForModal(log)}
                      title="Visualizar detalhes e relatório em PDF"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Detalhes</span>
                    </button>

                    {/* Botão Restaurar ao Kanban */}
                    <button
                      type="button"
                      disabled={isUnarchiving}
                      onClick={() => handleUnarchive(log)}
                      title={`Restaurar este chamado de volta para o quadro na etapa '${log.status}'`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isUnarchiving ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <ArchiveRestore size={13} />
                      )}
                      <span>Restaurar</span>
                    </button>

                    {/* Botão Excluir Definitivamente */}
                    <button
                      type="button"
                      onClick={() => setDeletingLog(log)}
                      title="Excluir chamado definitivamente do banco"
                      className="inline-flex items-center p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes Completo */}
      {selectedLogForModal && (
        <ReportDetailsModal
          log={selectedLogForModal}
          onClose={() => setSelectedLogForModal(null)}
          onRefresh={async () => {
            fetchArchivedData(true);
            onRefreshKanban();
          }}
        />
      )}

      {/* Modal de Confirmação de Exclusão Definitiva */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Excluir chamado definitivamente?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              Tem certeza que deseja excluir o chamado arquivado{" "}
              <strong className="text-slate-900 dark:text-white font-semibold">
                "{deletingLog.title || deletingLog.reportedProblem}"
              </strong>
              ? Esta ação removerá o registro e todas as mídias permanentemente.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingLog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                <span>{isDeleting ? "Excluindo..." : "Sim, excluir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Flutuante */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 border ${
            toast.type === "success"
              ? "bg-slate-900/95 dark:bg-[#111726]/95 text-white border-slate-700"
              : "bg-red-900/95 text-white border-red-700"
          }`}
        >
          <Archive size={16} className={toast.type === "success" ? "text-amber-400 shrink-0" : "text-red-300 shrink-0"} />
          <span className="text-xs font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer ml-1"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TechnicianArchivedView;
