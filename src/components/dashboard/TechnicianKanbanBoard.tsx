import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Inbox,
  X,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { WorkLogItem, WorkLogCategoryItem, api } from "@/services/api";
import { getCategoryIconComponent } from "@/components/CategoryIconPicker";
import { ReportDetailsModal } from "@/components/dashboard/ReportDetailsModal";
import ReportCardMinimized from "@/components/ReportCardMinimized";
import ValidationRejectionModal from "@/components/dashboard/ValidationRejectionModal";

export type ColumnId = "backlog" | "pendencias" | "em_progresso" | "validacao" | "finalizadas";

interface ColumnDef {
  id: ColumnId;
  title: string;
  dotColor: string;
  headerBorder: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  isDefault?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  {
    id: "backlog",
    title: "Backlog",
    dotColor: "bg-indigo-500",
    headerBorder: "border-indigo-500",
    badgeClass: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    icon: Inbox,
    isDefault: true,
  },
  {
    id: "pendencias",
    title: "Pendências",
    dotColor: "bg-amber-500",
    headerBorder: "border-amber-500",
    badgeClass: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    icon: AlertCircle,
  },
  {
    id: "em_progresso",
    title: "Em progresso",
    dotColor: "bg-sky-500",
    headerBorder: "border-sky-500",
    badgeClass: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    icon: Clock,
  },
  {
    id: "validacao",
    title: "Validação",
    dotColor: "bg-purple-500",
    headerBorder: "border-purple-500",
    badgeClass: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    icon: ShieldCheck,
  },
  {
    id: "finalizadas",
    title: "Finalizadas",
    dotColor: "bg-emerald-500",
    headerBorder: "border-emerald-500",
    badgeClass: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    icon: CheckCircle2,
  },
];

export function getColumnForStatus(status: string): ColumnId {
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
  if (
    normalized === "validação" ||
    normalized === "validacao" ||
    normalized === "em validação" ||
    normalized === "em validacao"
  ) {
    return "validacao";
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

export function getStatusForColumn(colId: ColumnId): string {
  switch (colId) {
    case "finalizadas":
      return "Solucionado";
    case "validacao":
      return "Validação";
    case "em_progresso":
      return "Em progresso";
    case "pendencias":
      return "Pendências";
    case "backlog":
    default:
      return "Backlog";
  }
}

/**
 * Determina se um card da coluna Finalizadas foi concluído hoje.
 * Verifica statusHistory (mais recente com toStatus finalizado),
 * recorrendo ao fallback de updatedAt ou createdAt.
 */
export function isFinalizedToday(log: WorkLogItem): boolean {
  if (!log) return false;

  let targetDateStr: string | null | undefined = null;

  if (log.statusHistory && Array.isArray(log.statusHistory) && log.statusHistory.length > 0) {
    const finalizedEntries = log.statusHistory
      .filter((h) => {
        const norm = (h.toStatus || "").toLowerCase().trim();
        return (
          norm === "solucionado" ||
          norm === "finalizadas" ||
          norm === "finalizado" ||
          norm === "concluído" ||
          norm === "concluido" ||
          getColumnForStatus(h.toStatus) === "finalizadas"
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (finalizedEntries.length > 0 && finalizedEntries[0].createdAt) {
      targetDateStr = finalizedEntries[0].createdAt;
    }
  }

  if (!targetDateStr) {
    targetDateStr = log.updatedAt || log.createdAt;
  }

  if (!targetDateStr) return false;

  const date = new Date(targetDateStr);
  if (isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
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

  // Filtro de Finalizadas (Hoje vs Todos)
  const [finishedFilter, setFinishedFilter] = useState<"hoje" | "todos">("hoje");

  // Drag and Drop state
  const [draggingLogId, setDraggingLogId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  // Governança de Validação & Motivo de Reprovação
  const [rejectionModalData, setRejectionModalData] = useState<{
    isOpen: boolean;
    logId: string;
    targetColId: ColumnId;
    newStatus: string;
    targetColumnTitle: string;
    cardTitle?: string;
  } | null>(null);

  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [categories, setCategories] = useState<WorkLogCategoryItem[]>([]);

  // Carrega categorias ativas para os filtros dinâmicos
  useEffect(() => {
    api.categories
      .getAll()
      .then((cats) => setCategories(cats.filter((c) => c.active)))
      .catch((err) => console.error("[Kanban] Erro ao buscar categorias:", err));
  }, []);

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

  const DEFAULT_CATEGORIES: WorkLogCategoryItem[] = useMemo(
    () => [
      { id: "technical_action", name: "Ação Técnica", slug: "technical_action", color: "#0284c7", icon: "cog", targetKanban: true, lockStatus: false, active: true, order: 1, createdAt: "", updatedAt: "" },
      { id: "implementation", name: "Implementação", slug: "implementation", color: "#8b5cf6", icon: "rocket", targetKanban: true, lockStatus: false, active: true, order: 2, createdAt: "", updatedAt: "" },
      { id: "prompt", name: "Prompt", slug: "prompt", color: "#10b981", icon: "sparkles", targetKanban: true, lockStatus: false, active: true, order: 3, createdAt: "", updatedAt: "" },
      { id: "idea", name: "Ideia", slug: "idea", color: "#7c3aed", icon: "lightbulb", targetKanban: true, lockStatus: false, active: true, order: 4, createdAt: "", updatedAt: "" },
    ],
    []
  );

  const displayedCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

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
      if (filterType) {
        const isCatMatch =
          log.category?.id === filterType ||
          log.category?.slug === filterType ||
          log.categoryId === filterType;
        const isLegacyMatch =
          (filterType === "technical_action" && log.technicalAction) ||
          (filterType === "technical" && log.technicalAction) ||
          (filterType === "implementation" && log.implementation) ||
          (filterType === "prompt" && log.isPrompt) ||
          (filterType === "idea" && log.isIdea);
        if (!isCatMatch && !isLegacyMatch) return false;
      }
      if (filterAuthor && log.user?.name !== filterAuthor) return false;
      if (filterTag && log.tag?.name !== filterTag) return false;
      return true;
    });
  }, [logs, searchTerm, filterType, filterAuthor, filterTag]);

  // Contagens dinâmicas por categoria baseadas na busca e filtros gerais (exceto filterType)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of displayedCategories) {
      counts[cat.id] = logs.filter((log) => {
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
        if (filterAuthor && log.user?.name !== filterAuthor) return false;
        if (filterTag && log.tag?.name !== filterTag) return false;

        const isCatMatch =
          log.category?.id === cat.id ||
          log.category?.slug === cat.slug ||
          log.categoryId === cat.id;
        const isLegacyMatch =
          (cat.slug === "technical_action" && log.technicalAction) ||
          (cat.slug === "implementation" && log.implementation) ||
          (cat.slug === "prompt" && log.isPrompt) ||
          (cat.slug === "idea" && log.isIdea);
        return isCatMatch || isLegacyMatch;
      }).length;
    }
    return counts;
  }, [displayedCategories, logs, searchTerm, filterAuthor, filterTag]);

  const hasActiveFilters = Boolean(searchTerm || filterType || filterAuthor || filterTag);

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType("");
    setFilterAuthor("");
    setFilterTag("");
  };

  // Total geral de finalizadas sem o filtro diário (para uso no badge / tooltip)
  const totalFinalizedCount = useMemo(() => {
    return filteredLogs.filter((log) => getColumnForStatus(log.status) === "finalizadas").length;
  }, [filteredLogs]);

  // Agrupamento por colunas
  const columnsData = useMemo(() => {
    const groups: Record<ColumnId, WorkLogItem[]> = {
      backlog: [],
      pendencias: [],
      em_progresso: [],
      validacao: [],
      finalizadas: [],
    };

    filteredLogs.forEach((log) => {
      const colId = getColumnForStatus(log.status);
      if (colId === "finalizadas") {
        if (finishedFilter === "todos" || isFinalizedToday(log)) {
          groups.finalizadas.push(log);
        }
      } else {
        groups[colId].push(log);
      }
    });

    return groups;
  }, [filteredLogs, finishedFilter]);

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

    // 1. REGRA DE VALIDAÇÃO OBRIGATÓRIA: Tentativa de arrasto direto para "Finalizadas"
    if (targetColId === "finalizadas") {
      setDraggingLogId(null);
      setValidationWarning(
        "Todo atendimento precisa obrigatoriamente passar pela coluna de Validação e ser aprovado pelo botão 'Aprovar Solução'. O chamado foi direcionado para a Validação."
      );
      setTimeout(() => setValidationWarning(null), 7000);

      // Se já está na validação, não faz nada
      if (currentColumn === "validacao") {
        return;
      }

      // Direciona para a coluna de Validação
      const validationStatus = "Validação";
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: validationStatus } : l))
      );

      try {
        await api.worklogs.updateStatus(logId, validationStatus);
        onLogResolved?.();
      } catch (err) {
        console.error("[Kanban] Erro ao mover para validação:", err);
        setLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, status: log.status } : l))
        );
      }
      return;
    }

    const newStatus = getStatusForColumn(targetColId);

    // 2. REGRA DE REPROVAÇÃO: Card saindo da coluna de Validação para etapas anteriores
    if (currentColumn === "validacao" && targetColId !== "validacao") {
      setDraggingLogId(null);
      const targetColumnDef = COLUMNS.find((c) => c.id === targetColId);
      setRejectionModalData({
        isOpen: true,
        logId,
        targetColId,
        newStatus,
        targetColumnTitle: targetColumnDef?.title || targetColId,
        cardTitle: log.title || log.reportedProblem,
      });
      return;
    }

    // 3. Movimentação padrão entre as outras colunas
    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, status: newStatus } : l))
    );
    setDraggingLogId(null);

    // Persistência no backend via API
    try {
      await api.worklogs.updateStatus(logId, newStatus);
      onLogResolved?.();
    } catch (err) {
      console.error("[Kanban] Erro ao mover card:", err);
      // Reverte caso ocorra falha
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: log.status } : l))
      );
    }
  };

  const handleConfirmRejection = async (reason: string) => {
    if (!rejectionModalData) return;
    const { logId, newStatus } = rejectionModalData;

    // Atualização otimista
    setLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? {
              ...l,
              status: newStatus,
              hasValidationRejection: true,
            }
          : l
      )
    );

    try {
      await api.worklogs.updateStatus(logId, newStatus, reason);
      onLogResolved?.();
    } catch (err) {
      console.error("[Kanban] Erro ao registrar reprovação:", err);
      const originalLog = logs.find((l) => l.id === logId);
      if (originalLog) {
        setLogs((prev) =>
          prev.map((l) => (l.id === logId ? originalLog : l))
        );
      }
      throw err;
    }
  };

  return (
    <div className="w-full">
      {/* Barra de Filtros Moderna */}
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Controles de Filtro */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Campo de Busca Polido */}
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pl-9 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 transition-all shadow-xs"
                placeholder="Buscar por solicitante, cliente, plataforma ou problema..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Dropdown: Tipo Dinâmico */}
            <select
              className="bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-3.5 py-2 cursor-pointer focus:outline-none focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 transition-all shadow-xs"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {displayedCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Dropdown: Tag */}
            <select
              className="bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-3.5 py-2 cursor-pointer focus:outline-none focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 transition-all shadow-xs max-w-[170px]"
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
              className="bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-3.5 py-2 cursor-pointer focus:outline-none focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 transition-all shadow-xs max-w-[180px]"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors cursor-pointer"
                title="Limpar todos os filtros"
              >
                <X size={14} />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>

          {/* Chips de filtros rápidos e Totalizador */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-xs">
              <span className="text-slate-500 dark:text-slate-400">Total:</span>
              <strong className="text-slate-900 dark:text-white font-bold">{filteredLogs.length}</strong>
            </div>

            {displayedCategories.map((cat) => {
              const IconComp = getCategoryIconComponent(cat.icon);
              const isSelected =
                filterType === cat.id ||
                filterType === cat.slug ||
                (cat.slug === "technical_action" && filterType === "technical");
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterType(isSelected ? "" : cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? "ring-1"
                      : "bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#161f33] text-slate-700 dark:text-slate-300"
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${cat.color}15`,
                          color: cat.color,
                          borderColor: cat.color,
                          boxShadow: `0 0 0 1px ${cat.color}40`,
                        }
                      : undefined
                  }
                  title={`Filtrar por ${cat.name}`}
                >
                  <IconComp
                    size={13}
                    style={{ color: isSelected ? cat.color : undefined }}
                    className={isSelected ? "" : "text-slate-400 dark:text-slate-500"}
                  />
                  <span>{cat.name}:</span>
                  <strong className="font-bold">{count}</strong>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid das 5 Colunas do Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 items-start min-h-[calc(100vh-270px)]">
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
              className={`rounded-2xl flex flex-col h-[calc(100vh-270px)] min-h-[500px] max-h-[calc(100vh-270px)] overflow-hidden shadow-xs transition-all duration-200 ${
                isOver
                  ? "border-2 border-dashed border-brand-card-selected-border dark:border-sky-500 bg-brand-card-selected-bg dark:bg-sky-950/30"
                  : "bg-slate-100/75 dark:bg-[#111726]/60 border border-slate-200/80 dark:border-slate-800"
              }`}
            >
              {/* Cabeçalho da Coluna */}
              <div className="flex items-center justify-between p-3.5 pb-3 border-b border-slate-200/80 dark:border-slate-800 shrink-0 gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${col.dotColor}`} />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {col.title}
                  </span>
                  {col.isDefault && (
                    <span
                      title="Coluna padrão onde novos chamados técnicos e implementações são inseridos"
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0"
                    >
                      Padrão
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {col.id === "finalizadas" && (
                    <div className="inline-flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg text-[10px] font-semibold border border-slate-300/50 dark:border-slate-700/60 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setFinishedFilter("hoje")}
                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                          finishedFilter === "hoje"
                            ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        title="Exibir apenas relatórios finalizados hoje"
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinishedFilter("todos")}
                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                          finishedFilter === "todos"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        title="Exibir todos os relatórios finalizados"
                      >
                        Todos
                      </button>
                    </div>
                  )}

                  <span
                    className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 text-xs font-semibold shadow-xs"
                    title={
                      col.id === "finalizadas" && finishedFilter === "hoje"
                        ? `${cardsInCol.length} finalizado(s) hoje de ${totalFinalizedCount} no total`
                        : undefined
                    }
                  >
                    {cardsInCol.length}
                  </span>
                </div>
              </div>

              {/* Slot / Feedback de Dropzone quando arrastando sobre */}
              {isOver && (
                <div className="mx-3 mt-3 py-2.5 px-3 rounded-xl border border-dashed border-brand-card-selected-border dark:border-sky-500 bg-brand-filter-bg-hover dark:bg-sky-950/50 text-brand-filter-text dark:text-sky-200 text-xs font-semibold text-center flex items-center justify-center gap-1.5 shrink-0 animate-pulse">
                  <span>Solte para mover para {col.title}</span>
                </div>
              )}

              {/* Área de drop (Cards): manter rolagem independente */}
              <div
                onDragOver={(e) => handleDragOver(col.id, e)}
                onDrop={(e) => handleDrop(col.id, e)}
                className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0"
              >
                {cardsInCol.length === 0 && !isOver ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-slate-200/90 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 my-auto min-h-[160px]">
                    <EmptyIcon size={26} className="text-slate-400 dark:text-slate-500 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Nenhum chamado nesta etapa
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {col.id === "backlog"
                        ? "Novos itens aparecerão aqui"
                        : col.id === "validacao"
                        ? "Aguardando validação da equipe ou solicitante"
                        : col.id === "finalizadas"
                        ? finishedFilter === "hoje" && totalFinalizedCount > 0
                          ? `Nenhum chamado finalizado hoje (${totalFinalizedCount} no total). Alterne para 'Todos' para ver o histórico.`
                          : "Chamados finalizados e aprovados aparecerão aqui"
                        : "Arraste um card para cá"}
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

      {/* Modal de Justificativa Obrigatória de Reprovação de Validação */}
      {rejectionModalData && (
        <ValidationRejectionModal
          isOpen={rejectionModalData.isOpen}
          targetColumnTitle={rejectionModalData.targetColumnTitle}
          cardTitle={rejectionModalData.cardTitle}
          onClose={() => setRejectionModalData(null)}
          onConfirm={handleConfirmRejection}
        />
      )}

      {/* Toast Flutuante de Alerta de Validação Obrigatória */}
      {validationWarning && (
        <div className="fixed top-5 right-5 z-50 max-w-md p-4 bg-purple-950/95 text-white rounded-2xl shadow-2xl border border-purple-500/50 flex items-start gap-3 animate-fade-in backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-purple-800 text-purple-200 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldAlert size={18} />
          </div>
          <div className="flex-1 text-xs leading-relaxed">
            <strong className="block font-bold text-sm text-purple-100 mb-0.5">
              Validação Obrigatória
            </strong>
            {validationWarning}
          </div>
          <button
            type="button"
            onClick={() => setValidationWarning(null)}
            className="text-purple-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Modal de Detalhes Completo ao Clicar no Card */}
      {selectedLogForModal && (
        <ReportDetailsModal
          log={selectedLogForModal}
          onClose={() => setSelectedLogForModal(null)}
          onRefresh={async () => {
            onLogResolved?.();
            try {
              const updatedList = await api.worklogs.getTechnical();
              setLogs(updatedList);
              const reloaded = updatedList.find((x) => x.id === selectedLogForModal.id);
              if (reloaded) {
                setSelectedLogForModal(reloaded);
              }
            } catch (err) {
              console.error("[Kanban] Erro ao sincronizar modal após refresh:", err);
            }
          }}
        />
      )}
    </div>
  );
};
