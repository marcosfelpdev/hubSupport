import React, { useState, useMemo, useEffect } from "react";
import {
  Cog,
  Lightbulb,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Inbox,
  X,
} from "lucide-react";
import { WorkLogItem, api } from "@/services/api";
import { ReportDetailsModal } from "@/components/dashboard/ReportDetailsModal";
import ReportCardMinimized from "@/components/ReportCardMinimized";

export type ColumnId = "backlog" | "pendencias" | "em_progresso" | "finalizadas";

interface ColumnDef {
  id: ColumnId;
  title: string;
  dotColor: string;
  headerBorder: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  isDefault?: boolean;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "backlog",
    title: "Backlog",
    dotColor: "bg-indigo-400",
    headerBorder: "border-indigo-500",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
    icon: Inbox,
    isDefault: true,
  },
  {
    id: "pendencias",
    title: "Pendências",
    dotColor: "bg-amber-400",
    headerBorder: "border-amber-500",
    badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    icon: AlertCircle,
  },
  {
    id: "em_progresso",
    title: "Em progresso",
    dotColor: "bg-sky-400",
    headerBorder: "border-sky-500",
    badgeClass: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
    icon: Clock,
  },
  {
    id: "finalizadas",
    title: "Finalizadas",
    dotColor: "bg-emerald-400",
    headerBorder: "border-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    icon: CheckCircle2,
  },
];

function getColumnForStatus(status: string): ColumnId {
  const normalized = (status || "").toLowerCase().trim();
  if (
    normalized === "solucionado" ||
    normalized === "finalizadas" ||
    normalized === "finalizado" ||
    normalized === "concluído" ||
    normalized === "concluido"
  ) {
    return "finalizadas";
  }
  if (normalized === "em progresso" || normalized === "em andamento") {
    return "em_progresso";
  }
  if (
    normalized === "pendências" ||
    normalized === "pendencias" ||
    normalized === "pendente" ||
    normalized === "aguardando reunião" ||
    normalized === "aguardando reuniao" ||
    normalized === "não foi possível realizar"
  ) {
    return "pendencias";
  }
  // Coluna padrão inalterável: novos cards de ação técnica e implementação entram aqui
  return "backlog";
}

function getStatusForColumn(colId: ColumnId): string {
  switch (colId) {
    case "finalizadas":
      return "Solucionado";
    case "em_progresso":
      return "Em progresso";
    case "pendencias":
      return "Pendências";
    case "backlog":
    default:
      return "Backlog";
  }
}

interface TechnicianKanbanBoardProps {
  logs: WorkLogItem[];
  currentUserId: string;
  employees: { name: string }[];
  onLogResolved?: () => void;
}

export const TechnicianKanbanBoard: React.FC<TechnicianKanbanBoardProps> = ({
  logs: initialLogs,
  onLogResolved,
}) => {
  const [logs, setLogs] = useState<WorkLogItem[]>(initialLogs);
  const [selectedLogForModal, setSelectedLogForModal] = useState<WorkLogItem | null>(null);

  // Drag and Drop state
  const [draggingLogId, setDraggingLogId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"" | "technical" | "implementation">("");
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // Sincroniza quando initialLogs mudar
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // Polling leve para atualizar cards com relatórios de IA sendo gerados
  useEffect(() => {
    const hasGenerating = logs.some(
      (l) =>
        l.aiReport &&
        (l.aiReport.status === "pending" ||
          l.aiReport.status === "processing" ||
          (!l.aiReport.pdfPath && l.aiReport.status !== "failed"))
    );

    if (!hasGenerating) return;

    const interval = setInterval(async () => {
      try {
        const pendingLogs = logs.filter(
          (l) =>
            l.aiReport &&
            (l.aiReport.status === "pending" ||
              l.aiReport.status === "processing" ||
              (!l.aiReport.pdfPath && l.aiReport.status !== "failed"))
        );

        let changed = false;
        const updated = [...logs];

        await Promise.all(
          pendingLogs.map(async (pLog) => {
            const status = await api.worklogs.getAiStatus(pLog.id);
            if (status && status.status !== pLog.aiReport?.status) {
              const idx = updated.findIndex((x) => x.id === pLog.id);
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  aiReport: {
                    ...updated[idx].aiReport,
                    ...status,
                  },
                };
                changed = true;
              }
            }
          })
        );

        if (changed) {
          setLogs(updated);
        }
      } catch (err) {
        console.error("[Kanban] Erro ao sincronizar status de IA:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [logs]);

  const authorOptions = useMemo(() => {
    const list = Array.from(new Set(logs.map((l) => l.user?.name).filter(Boolean)));
    list.sort();
    return list;
  }, [logs]);

  const tagOptions = useMemo(() => {
    const list = Array.from(new Set(logs.map((l) => l.tag?.name).filter(Boolean))) as string[];
    list.sort();
    return list;
  }, [logs]);

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
          (log.title && log.title.toLowerCase().includes(query)) ||
          log.requester.toLowerCase().includes(query) ||
          log.clientOrOffice.toLowerCase().includes(query) ||
          log.reportedProblem.toLowerCase().includes(query) ||
          (log.user?.name && log.user.name.toLowerCase().includes(query)) ||
          (log.tag?.name && log.tag.name.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }
      if (filterType === "technical" && !log.technicalAction) return false;
      if (filterType === "implementation" && !log.implementation) return false;
      if (filterAuthor && log.user?.name !== filterAuthor) return false;
      if (filterTag && log.tag?.name !== filterTag) return false;
      return true;
    });
  }, [logs, searchTerm, filterType, filterAuthor, filterTag]);

  // Contagens para o totalizador métrico
  const technicalCount = useMemo(
    () => filteredLogs.filter((l) => l.technicalAction).length,
    [filteredLogs]
  );
  const implementationCount = useMemo(
    () => filteredLogs.filter((l) => l.implementation).length,
    [filteredLogs]
  );

  const hasActiveFilters = Boolean(searchTerm || filterType || filterAuthor || filterTag);

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType("");
    setFilterAuthor("");
    setFilterTag("");
  };

  // Agrupamento por colunas
  const columnsData = useMemo(() => {
    const groups: Record<ColumnId, WorkLogItem[]> = {
      backlog: [],
      pendencias: [],
      em_progresso: [],
      finalizadas: [],
    };

    filteredLogs.forEach((log) => {
      const colId = getColumnForStatus(log.status);
      groups[colId].push(log);
    });

    return groups;
  }, [filteredLogs]);

  // Handlers de Drag and Drop
  const handleDragStart = (logId: string, e: React.DragEvent) => {
    setDraggingLogId(logId);
    e.dataTransfer.setData("text/plain", logId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingLogId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (colId: ColumnId, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (colId: ColumnId, e: React.DragEvent) => {
    // Só limpa se o cursor realmente saiu do container da coluna e não para um elemento interno
    if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn((prev) => (prev === colId ? null : prev));
    }
  };

  // Listener global de segurança para limpar o estado de drag quando a ação for finalizada ou cancelada
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggingLogId(null);
      setDragOverColumn(null);
    };
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, []);

  const handleDrop = async (targetColId: ColumnId, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const logId = e.dataTransfer.getData("text/plain") || draggingLogId;
    if (!logId) return;

    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const currentColumn = getColumnForStatus(log.status);
    if (currentColumn === targetColId) {
      setDraggingLogId(null);
      return;
    }

    const newStatus = getStatusForColumn(targetColId);

    // Atualização otimista no estado local
    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, status: newStatus } : l))
    );
    setDraggingLogId(null);

    // Persistência no backend via API
    try {
      if (targetColId === "finalizadas") {
        await api.worklogs.resolve(logId);
      } else {
        await api.worklogs.updateStatus(logId, newStatus);
      }
      onLogResolved?.();
    } catch (err) {
      console.error("[Kanban] Erro ao mover card:", err);
      // Reverte caso ocorra falha
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: log.status } : l))
      );
    }
  };

  return (
    <div className="w-full">
      {/* Barra de Filtros Moderna (Task 2) */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Controles de Filtro */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Campo de Busca Polido */}
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-xs rounded-lg pl-9 pr-3 py-2 placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all shadow-inner"
                placeholder="Buscar por solicitante, cliente, plataforma ou problema..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Dropdown: Tipo */}
            <select
              className="bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "" | "technical" | "implementation")}
            >
              <option value="">Todos os tipos</option>
              <option value="technical">Ação Técnica</option>
              <option value="implementation">Implementação</option>
            </select>

            {/* Dropdown: Tag */}
            <select
              className="bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all max-w-[170px]"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="">Todas as tags</option>
              {tagOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Dropdown: Autor */}
            <select
              className="bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all max-w-[180px]"
              value={filterAuthor}
              onChange={(e) => setFilterAuthor(e.target.value)}
            >
              <option value="">Todos os autores</option>
              {authorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Botão para limpar filtros */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-sky-400 hover:bg-white/5 transition-colors cursor-pointer"
                title="Limpar todos os filtros"
              >
                <X size={14} />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>

          {/* Totalizador Métrico Aprimorado */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xs">
              <span className="text-[var(--text-muted)]">Total:</span>
              <strong className="text-[var(--text-primary)] font-bold">{filteredLogs.length}</strong>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/25 shadow-xs">
              <Cog size={13} className="text-sky-400" />
              <span>Ação Técnica:</span>
              <strong className="font-bold">{technicalCount}</strong>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/25 shadow-xs">
              <Lightbulb size={13} className="text-purple-400" />
              <span>Implementação:</span>
              <strong className="font-bold">{implementationCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Grid das 4 Colunas do Kanban (Task 3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start min-h-[calc(100vh-270px)]">
        {COLUMNS.map((col) => {
          const cardsInCol = columnsData[col.id];
          const isOver = dragOverColumn === col.id;
          const EmptyIcon = col.icon;

          return (
            <div
              key={col.id}
              data-column-id={col.id}
              onDragOver={(e) => handleDragOver(col.id, e)}
              onDragLeave={(e) => handleDragLeave(col.id, e)}
              onDrop={(e) => handleDrop(col.id, e)}
              className={`rounded-2xl p-3.5 flex flex-col h-[calc(100vh-270px)] min-h-[500px] max-h-[calc(100vh-270px)] transition-all duration-200 overflow-hidden ${
                isOver
                  ? "border-2 border-dashed border-sky-400 bg-sky-500/10 shadow-[0_0_20px_rgba(56,189,248,0.15)]"
                  : "bg-[var(--bg-secondary)]/50 border border-[var(--border)] hover:border-[var(--border-light)]"
              }`}
            >
              {/* Cabeçalho da Coluna */}
              <div className={`flex items-center justify-between pb-3 mb-3 border-b-2 shrink-0 ${col.headerBorder}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                    {col.title}
                  </span>
                  {col.isDefault && (
                    <span
                      title="Coluna padrão onde novos chamados técnicos e implementações são inseridos"
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-[var(--text-muted)] border border-white/5"
                    >
                      Padrão
                    </span>
                  )}
                </div>

                <span
                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold ${col.badgeClass}`}
                >
                  {cardsInCol.length}
                </span>
              </div>

              {/* Slot / Feedback de Dropzone quando arrastando sobre */}
              {isOver && (
                <div className="py-2.5 px-3 mb-3 rounded-xl border border-dashed border-sky-400 bg-sky-500/15 text-sky-300 text-xs font-semibold text-center animate-pulse flex items-center justify-center gap-1.5 shrink-0">
                  <span>Solte para mover para {col.title}</span>
                </div>
              )}

              {/* Lista rolável de Cards da Coluna */}
              <div
                onDragOver={(e) => handleDragOver(col.id, e)}
                onDrop={(e) => handleDrop(col.id, e)}
                className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-1.5"
              >
                {cardsInCol.length === 0 && !isOver ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-[var(--border-light)]/40 bg-[var(--bg-card)]/30 my-auto min-h-[160px]">
                    <EmptyIcon size={26} className="text-[var(--text-muted)]/50 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                      Nenhum chamado nesta etapa
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {col.id === "backlog" ? "Novos itens aparecerão aqui" : "Arraste um card para cá"}
                    </p>
                  </div>
                ) : (
                  cardsInCol.map((log) => {
                    const isDragging = draggingLogId === log.id;

                    return (
                      <ReportCardMinimized
                        key={log.id}
                        dataCardId={log.id}
                        draggable
                        onDragStart={(e) => handleDragStart(log.id, e)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverColumn !== col.id) {
                            setDragOverColumn(col.id);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDrop(col.id, e);
                        }}
                        onClick={() => setSelectedLogForModal(log)}
                        isDragging={isDragging}
                        isSelected={selectedLogForModal?.id === log.id}
                        log={log}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Detalhes Completo ao Clicar no Card */}
      {selectedLogForModal && (
        <ReportDetailsModal
          log={selectedLogForModal}
          onClose={() => setSelectedLogForModal(null)}
        />
      )}
    </div>
  );
};
