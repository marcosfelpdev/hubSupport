import React, { useState, useEffect, useMemo, useTransition, useRef } from "react";
import {
  Copy,
  CheckCircle2,
  FileText,
  Sparkles,
  Video,
  Paperclip,
  Eye,
  MessageSquareText,
  Loader2,
  Clock,
  AlertTriangle,
  RotateCw,
  Cog,
  Lightbulb,
  ChevronDown,
  Check,
  History,
  ArrowRight,
  UserPlus,
  UserMinus,
  Users,
  Search,
  UserCheck,
  Trash2,
} from "lucide-react";
import { WorkLogItem, WorkLogStatusHistoryItem, EmployeeItem, api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import TagBadge from "@/components/TagBadge";
import { formatReportAsText, copyToClipboard } from "@/lib/report-formatter";

export interface StructuredReportData {
  title?: string;
  subtitle?: string;
  date?: string;
  department?: string;
  participants?: string;
  platformAnalyzed?: string;
  executiveSummary?: string;
  proposals?: Array<{
    item: string;
    description: string;
    category?: string;
    priority?: string;
  }>;
  detailingTopic?: string;
  detailingParagraphs?: string[];
  referrals?: string;
  transcript?: Array<{
    speaker: string;
    role?: string;
    timestamp?: string;
    text: string;
  }>;
}

export interface StatusPillConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Interface flexível para acomodar tanto WorkLogItem quanto variações de dashboards de técnicos.
 */
export interface WorkLogDetailData {
  id: string;
  title?: string | null;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken?: string | null;
  status: string;
  technicalAction?: boolean;
  implementation?: boolean;
  media?: string | null;
  userId?: string;
  tagId?: string | null;
  tag?: {
    id?: string;
    name: string;
    color: string;
  } | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  user?: {
    name: string;
    email: string;
    role?: string | null;
  };
  statusHistory?: WorkLogStatusHistoryItem[];
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email?: string;
    role?: string | null;
  } | null;
  aiReport?: {
    id?: string;
    status: string;
    errorMessage?: string | null;
    pdfPath?: string | null;
    videoPath?: string | null;
    structuredData?: string | null;
    completedAt?: Date | string | null;
    startedAt?: Date | string | null;
  } | null;
}

export interface WorkLogDetailContentProps {
  log: WorkLogDetailData;
  onRefresh?: () => void;
  onClose?: () => void;
  onDelete?: (deletedId: string) => void;
  headerAction?: React.ReactNode;
  footerActions?: React.ReactNode;
  onOpenPdfModal?: (logId: string) => void;
  onOpenMediaModal?: (log: WorkLogItem | WorkLogDetailData) => void;
}

export const WORKLOG_STATUS_OPTIONS = [
  "Realizado",
  "Em andamento",
  "Solucionado",
  "Aguardando reunião",
  "Não foi possível realizar",
  "Backlog",
] as const;

export function getStatusPill(status: string): StatusPillConfig {
  const norm = (status || "").toLowerCase().trim();

  if (
    norm === "solucionado" ||
    norm === "finalizadas" ||
    norm === "finalizado" ||
    norm === "concluído" ||
    norm === "concluido"
  ) {
    return {
      label: "Solucionado",
      badgeClass:
        "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  if (norm === "realizado" || norm === "já realizado" || norm === "ja realizado") {
    return {
      label: norm.includes("já") || norm.includes("ja") ? "Já realizado" : "Realizado",
      badgeClass:
        "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: norm === "em progresso" ? "Em progresso" : "Em andamento",
      badgeClass:
        "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
      dotClass: "bg-sky-500",
    };
  }

  if (
    norm === "pendências" ||
    norm === "pendencias" ||
    norm === "pendente" ||
    norm === "aguardando reunião" ||
    norm === "aguardando reuniao"
  ) {
    return {
      label: norm.includes("reuni") ? "Aguardando reunião" : "Pendência",
      badgeClass:
        "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      dotClass: "bg-amber-500",
    };
  }

  if (
    norm === "não foi possível realizar" ||
    norm === "nao foi possivel realizar" ||
    norm === "não realizado" ||
    norm === "nao realizado"
  ) {
    return {
      label:
        norm.includes("possível") || norm.includes("possivel")
          ? "Não foi possível realizar"
          : "Não realizado",
      badgeClass:
        "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
      dotClass: "bg-rose-500",
    };
  }

  if (norm === "backlog") {
    return {
      label: "Backlog",
      badgeClass:
        "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
      dotClass: "bg-indigo-500",
    };
  }

  return {
    label: status || "Registrado",
    badgeClass:
      "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  };
}

export function getRoleBadge(role?: string | null) {
  const normRole = (role || "").toUpperCase();
  switch (normRole) {
    case "ADMIN":
      return {
        label: "Administrador",
        className:
          "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60",
        dotColor: "bg-amber-500",
      };
    case "SUPPORT":
      return {
        label: "Suporte",
        className:
          "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60",
        dotColor: "bg-sky-500",
      };
    case "TECHNICIAN":
      return {
        label: "Técnico",
        className:
          "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60",
        dotColor: "bg-purple-500",
      };
    case "MANAGER":
      return {
        label: "Gestor",
        className:
          "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60",
        dotColor: "bg-indigo-500",
      };
    case "USER":
    default:
      return {
        label: "Colaborador",
        className:
          "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        dotColor: "bg-slate-500",
      };
  }
}

const AVATAR_BG_COLORS = [
  "bg-indigo-600 text-white",
  "bg-sky-600 text-white",
  "bg-emerald-600 text-white",
  "bg-violet-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
  "bg-teal-600 text-white",
  "bg-blue-600 text-white",
];

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColorClass(str?: string | null): string {
  if (!str) return "bg-indigo-600 text-white";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

export function formatTimelineDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeFormatted = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateFormatted} às ${timeFormatted}`;
  } catch {
    return String(dateStr);
  }
}

export function parseMediaPaths(media?: string | null): string[] {
  if (!media) return [];
  try {
    const parsed = JSON.parse(media);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const WorkLogDetailContent: React.FC<WorkLogDetailContentProps> = ({
  log,
  onRefresh,
  onClose,
  onDelete,
  headerAction,
  footerActions,
  onOpenPdfModal,
  onOpenMediaModal,
}) => {
  const { user: currentUser } = useAuth();

    const currentUserRole = currentUser?.role?.toUpperCase();
  const isAdmin = currentUserRole === "ADMIN";
  const canDelete = currentUserRole === "ADMIN" || currentUserRole === "TECHNICIAN";
  const canAssign =
    currentUserRole === "ADMIN" ||
    currentUserRole === "MANAGER" ||
    currentUserRole === "TECHNICIAN";

  // Estados para exclusão administrativa
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Estado e handler para copiar texto do relatório
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  const handleCopyReportText = async () => {
    const textToCopy = formatReportAsText(structured, {
      title: log.title,
      requester: log.requester,
      clientOrOffice: log.clientOrOffice,
      reportedProblem: log.reportedProblem,
      actionTaken: log.actionTaken,
      status: currentStatus,
      createdAt: log.createdAt,
    });
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }
  };


  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await api.worklogs.delete(log.id);
      setShowDeleteModal(false);
      onDelete?.(log.id);
      onRefresh?.();
      onClose?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir atendimento.");
      setIsDeleting(false);
    }
  };

  // Estado local do relatório de IA para suportar polling e geração sob demanda
  const [currentAiReport, setCurrentAiReport] = useState(log.aiReport ?? null);
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [generateFeedback, setGenerateFeedback] = useState<string | null>(null);
  const [isRetrying, startRetryTransition] = useTransition();
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  // Estados locais para alteração interativa de status e auditoria
  const [currentStatus, setCurrentStatus] = useState<string>(log.status);
  const [currentHistory, setCurrentHistory] = useState<WorkLogStatusHistoryItem[]>(
    log.statusHistory || []
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Estados locais para atribuição de responsável técnico
  const [currentAssignee, setCurrentAssignee] = useState(log.assignedTo || null);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState<boolean>(false);
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const assignDropdownRef = useRef<HTMLDivElement>(null);

  // Sincroniza estado quando o atendimento muda
  useEffect(() => {
    setCurrentAiReport(log.aiReport ?? null);
    setGenerateFeedback(null);
    setRetryFeedback(null);
    setCurrentStatus(log.status);
    setCurrentHistory(log.statusHistory || []);
    setStatusError(null);
    setStatusMenuOpen(false);
    setCurrentAssignee(log.assignedTo || null);
    setAssignError(null);
    setAssignDropdownOpen(false);
    setEmployeeSearch("");
  }, [log.id, log.status, log.statusHistory, log.aiReport, log.assignedTo]);

  // Carrega lista de funcionários para o dropdown de atribuição
  useEffect(() => {
    if (!canAssign) return;
    let isMounted = true;
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const data = typeof api.employees.list === "function"
          ? await api.employees.list()
          : await api.employees.getAll();
        if (isMounted) {
          setEmployees(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Erro ao carregar colaboradores para atribuição:", err);
      } finally {
        if (isMounted) {
          setIsLoadingEmployees(false);
        }
      }
    };

    fetchEmployees();

    return () => {
      isMounted = false;
    };
  }, [canAssign]);

  // Fecha o dropdown de atribuição ao clicar fora ou apertar Escape
  useEffect(() => {
    if (!assignDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        assignDropdownRef.current &&
        !assignDropdownRef.current.contains(event.target as Node)
      ) {
        setAssignDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAssignDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [assignDropdownOpen]);

  const handleAssign = async (targetUserId: string | null) => {
    setAssignDropdownOpen(false);
    setIsAssigning(true);
    setAssignError(null);

    try {
      const res = await api.worklogs.assign(log.id, targetUserId);
      if (res.success) {
        setCurrentAssignee(res.assignedTo || null);
        onRefresh?.();
      } else {
        setAssignError(res.error || "Não foi possível atualizar o responsável pelo atendimento.");
      }
    } catch (err) {
      console.error("Erro ao atribuir responsável:", err);
      setAssignError(
        err instanceof Error ? err.message : "Erro ao atualizar responsável pelo atendimento."
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.role && e.role.toLowerCase().includes(q))
    );
  }, [employees, employeeSearch]);

  // Fecha o dropdown ao clicar fora ou apertar Escape
  useEffect(() => {
    if (!statusMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setStatusMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [statusMenuOpen]);

  const handleSelectStatus = async (newStatus: string) => {
    setStatusMenuOpen(false);
    const normCurrent = (currentStatus || "").toLowerCase().trim();
    const normNew = (newStatus || "").toLowerCase().trim();

    if (normCurrent === normNew) {
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError(null);

    try {
      const res = await api.worklogs.updateStatus(log.id, newStatus);
      if (res.success) {
        setCurrentStatus(res.status || newStatus);
        if (res.history) {
          setCurrentHistory(res.history);
        }
        onRefresh?.();
      } else {
        setStatusError(res.error || "Não foi possível atualizar o status.");
      }
    } catch (err) {
      console.error("Erro ao atualizar status do atendimento:", err);
      setStatusError(
        err instanceof Error ? err.message : "Erro ao atualizar status do atendimento."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Polling leve enquanto o relatório estiver pendente ou em processamento
  useEffect(() => {
    const status = currentAiReport?.status;
    if (!status || (status !== "pending" && status !== "processing")) {
      return;
    }

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const updated = await api.worklogs.getAiStatus(log.id);
        if (updated && isMounted) {
          setCurrentAiReport((prev) => ({
            ...prev,
            ...updated,
          }));
          if (updated.status === "completed" || updated.status === "failed") {
            onRefresh?.();
          }
        }
      } catch (err) {
        console.error("Erro ao verificar status do relatório de IA:", err);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [log.id, currentAiReport?.status, onRefresh]);

  // Extrai lista de mídias anexadas
  const mediaPaths = useMemo(() => parseMediaPaths(log.media), [log.media]);

  // Faz o parse seguro do structuredData
  const structured: StructuredReportData | null = useMemo(() => {
    if (!currentAiReport?.structuredData) return null;
    try {
      return JSON.parse(currentAiReport.structuredData);
    } catch {
      return null;
    }
  }, [currentAiReport?.structuredData]);

  const isSolved = useMemo(() => {
    const norm = (currentStatus || "").toLowerCase().trim();
    return (
      norm === "solucionado" ||
      norm === "finalizadas" ||
      norm === "finalizado" ||
      norm === "concluído" ||
      norm === "concluido" ||
      norm === "realizado" ||
      norm === "já realizado" ||
      norm === "ja realizado"
    );
  }, [currentStatus]);

  const statusPill = useMemo(() => getStatusPill(currentStatus), [currentStatus]);
  const hasPdf = !!currentAiReport?.pdfPath;
  const hasVideo = !!currentAiReport?.videoPath;

  // Constrói itens da linha do tempo garantindo evento de criação e ordenação decrescente
  const timelineItems = useMemo(() => {
    const list = [...currentHistory];
    const hasInitial = list.some(
      (item) =>
        item.fromStatus.toLowerCase() === "registro inicial" ||
        item.fromStatus.toLowerCase() === "criação" ||
        item.fromStatus.toLowerCase() === "criacao"
    );

    if (!hasInitial) {
      list.push({
        id: `initial-${log.id}`,
        workLogId: log.id,
        fromStatus: "Registro Inicial",
        toStatus: list.length > 0 ? list[list.length - 1].fromStatus : currentStatus,
        changedById: log.userId || "",
        changedBy: {
          id: log.userId || "",
          name: log.user?.name || "Autor do Atendimento",
          role: log.user?.role || "USER",
        },
        createdAt:
          typeof log.createdAt === "string"
            ? log.createdAt
            : new Date(log.createdAt).toISOString(),
      });
    }

    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [currentHistory, log.id, log.userId, log.user, log.createdAt, currentStatus]);

  const formattedDate = useMemo(() => {
    if (!log.createdAt) return "";
    try {
      const d = new Date(log.createdAt);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(log.createdAt);
    }
  }, [log.createdAt]);

  const handleGenerateReport = () => {
    setGenerateFeedback(null);
    startGeneratingTransition(async () => {
      try {
        await api.worklogs.generateAiReport(log.id);
        setCurrentAiReport({
          id: `ai-${log.id}`,
          status: "pending",
        });
        onRefresh?.();
      } catch (err) {
        setGenerateFeedback(
          err instanceof Error ? err.message : "Erro ao solicitar geração de relatório com IA."
        );
      }
    });
  };

  const handleRetry = () => {
    setRetryFeedback(null);
    startRetryTransition(async () => {
      try {
        await api.worklogs.retryAi(log.id);
        setCurrentAiReport((prev) =>
          prev
            ? {
                ...prev,
                status: "pending",
                errorMessage: null,
              }
            : { status: "pending" }
        );
        onRefresh?.();
      } catch (err) {
        setRetryFeedback(err instanceof Error ? err.message : "Erro ao tentar novamente.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 text-xs sm:text-sm">
      {/* 1. Header do Chamado */}
      <div className="flex items-start sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isSolved
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {isSolved ? <CheckCircle2 size={20} /> : <FileText size={20} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug truncate max-w-full">
                {log.title || log.clientOrOffice}
              </h3>

              {/* Seletor Interativo de Status com Dropdown */}
              <div className="relative inline-block" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => !isUpdatingStatus && setStatusMenuOpen((prev) => !prev)}
                  disabled={isUpdatingStatus}
                  aria-haspopup="listbox"
                  aria-expanded={statusMenuOpen}
                  title="Clique para alterar o status deste atendimento"
                  className={`group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-75 disabled:cursor-wait select-none focus:outline-hidden focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500/60 ${statusPill.badgeClass}`}
                >
                  {isUpdatingStatus ? (
                    <Loader2 size={12} className="animate-spin text-current shrink-0" />
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-transform group-hover:scale-125 ${statusPill.dotClass}`}
                    />
                  )}
                  <span>{statusPill.label}</span>
                  <ChevronDown
                    size={12}
                    className={`opacity-60 group-hover:opacity-100 transition-transform duration-200 shrink-0 ${
                      statusMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Popover Dropdown de Seleção de Status */}
                {statusMenuOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 mt-1.5 w-56 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
                  >
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Alterar status para
                    </div>
                    <div className="space-y-0.5">
                      {WORKLOG_STATUS_OPTIONS.map((opt) => {
                        const optPill = getStatusPill(opt);
                        const isCurrent =
                          (currentStatus || "").toLowerCase().trim() ===
                          opt.toLowerCase().trim();

                        return (
                          <button
                            key={opt}
                            type="button"
                            role="option"
                            aria-selected={isCurrent}
                            onClick={() => handleSelectStatus(opt)}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                              isCurrent
                                ? "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white font-semibold"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${optPill.dotClass}`}
                              />
                              <span className="truncate">{opt}</span>
                            </div>
                            {isCurrent && (
                              <Check
                                size={13}
                                className="text-emerald-600 dark:text-emerald-400 shrink-0"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {log.tag && (
                <TagBadge name={log.tag.name} color={log.tag.color} size="sm" />
              )}

              {log.technicalAction && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800 shrink-0">
                  <Cog size={11} />
                  Ação Técnica
                </span>
              )}

              {log.implementation && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 shrink-0">
                  <Lightbulb size={11} />
                  Implementação
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
              {log.title && (
                <span className="inline-flex items-center gap-1">
                  <span>Cliente:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                    {log.clientOrOffice}
                  </strong>
                  <span className="text-slate-300 dark:text-slate-600 ml-1">•</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1">
                <span>Solicitante:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                  {log.requester}
                </strong>
                <span className="text-slate-300 dark:text-slate-600 ml-1">•</span>
              </span>

              <span className="inline-flex items-center gap-1">
                <span>Registrado em:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {formattedDate}
                </span>
              </span>

              {log.tag && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span>Plataforma:</span>
                    <strong style={{ color: log.tag.color }} className="font-semibold">
                      {log.tag.name}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
          {canDelete && (
            <button
              type="button"
              id="btn-delete-worklog"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              disabled={isDeleting}
              title="Excluir este atendimento permanentemente"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={13} className="shrink-0" />
              <span className="hidden sm:inline">Excluir</span>
            </button>
          )}
          {headerAction && (
            <div>
              {headerAction}
            </div>
          )}
        </div>
      </div>

      {/* Barra de Atribuição / Responsável Técnico */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 sm:py-2.5 rounded-xl bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs transition-all duration-200">
          {/* Lado Esquerdo: Identificação do Responsável ou Estado Vazio */}
          <div className="flex items-center gap-3 min-w-0">
            {currentAssignee ? (
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-2xs select-none ${getAvatarColorClass(
                  currentAssignee.name
                )}`}
              >
                {getInitials(currentAssignee.name)}
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shrink-0 shadow-2xs">
                <UserPlus size={18} />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Responsável Técnico
                </span>
                {currentAssignee && currentUser && currentAssignee.id === currentUser.id && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-[10px] font-bold tracking-tight">
                    Você
                  </span>
                )}
              </div>

              {currentAssignee ? (
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {currentAssignee.name}
                  </span>

                  {(() => {
                    const roleCfg = getRoleBadge(currentAssignee.role);
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${roleCfg.className}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${roleCfg.dotColor}`} />
                        <span>{roleCfg.label}</span>
                      </span>
                    );
                  })()}

                  {currentAssignee.email && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:inline truncate">
                      ({currentAssignee.email})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                  Sem responsável atribuído
                </span>
              )}
            </div>
          </div>

          {/* Lado Direito: Ações (Assumir Tarefa, Dropdown Atribuir/Alterar, Desatribuir) */}
          {canAssign && (
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center shrink-0">
            {/* Botão de 1 clique: Assumir Tarefa quando não atribuído ou atribuído a outro */}
            {(!currentAssignee || (currentUser && currentAssignee.id !== currentUser.id)) && currentUser && (
              <button
                type="button"
                onClick={() => handleAssign(currentUser.id)}
                disabled={isAssigning}
                title="Assumir este atendimento imediatamente com 1 clique"
                className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs inline-flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {isAssigning ? (
                  <Loader2 size={14} className="animate-spin text-white shrink-0" />
                ) : (
                  <UserCheck size={14} className="text-indigo-400 dark:text-cyan-400 shrink-0" />
                )}
                <span>Assumir Tarefa</span>
              </button>
            )}

            {/* Dropdown de Atribuição (Atribuir a... / Alterar) */}
            <div className="relative" ref={assignDropdownRef}>
              <button
                type="button"
                onClick={() => setAssignDropdownOpen((prev) => !prev)}
                disabled={isAssigning}
                aria-haspopup="listbox"
                aria-expanded={assignDropdownOpen}
                title={currentAssignee ? "Alterar técnico responsável" : "Designar membro da equipe"}
                className="bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-2xs inline-flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <Users size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span>{currentAssignee ? "Alterar" : "Atribuir a..."}</span>
                <ChevronDown
                  size={13}
                  className={`opacity-60 transition-transform duration-200 shrink-0 ${
                    assignDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Popover Dropdown */}
              {assignDropdownOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
                >
                  <div className="px-2 py-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Designar Responsável
                    </span>
                    {isLoadingEmployees && (
                      <Loader2 size={12} className="animate-spin text-slate-400" />
                    )}
                  </div>

                  {/* Input de filtro */}
                  {employees.length > 5 && (
                    <div className="relative mb-2">
                      <Search
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        placeholder="Buscar membro da equipe..."
                        className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Lista de colaboradores */}
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {isLoadingEmployees && employees.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Carregando equipe...
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        Nenhum colaborador encontrado.
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isAssigned = currentAssignee?.id === emp.id;
                        const isSelf = currentUser?.id === emp.id;
                        const roleCfg = getRoleBadge(emp.role);

                        return (
                          <button
                            key={emp.id}
                            type="button"
                            role="option"
                            aria-selected={isAssigned}
                            onClick={() => handleAssign(emp.id)}
                            className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                              isAssigned
                                ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${getAvatarColorClass(
                                  emp.name
                                )}`}
                              >
                                {getInitials(emp.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate">{emp.name}</span>
                                  {isSelf && (
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                      (Você)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                                  <span>{roleCfg.label}</span>
                                  {emp.email && <span>• {emp.email}</span>}
                                </div>
                              </div>
                            </div>

                            {isAssigned && (
                              <Check
                                size={14}
                                className="text-indigo-600 dark:text-indigo-400 shrink-0"
                              />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Opção de desatribuir se houver responsável */}
                  {currentAssignee && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleAssign(null)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
                      >
                        <UserMinus size={13} className="shrink-0" />
                        <span>Remover responsável atual</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botão de Desatribuir direto na barra se já houver responsável */}
            {currentAssignee && (
              <button
                type="button"
                onClick={() => handleAssign(null)}
                disabled={isAssigning}
                title="Remover atribuição (retornar para a fila geral sem responsável)"
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait inline-flex items-center gap-1.5 active:scale-[0.98]"
              >
                {isAssigning ? (
                  <Loader2 size={13} className="animate-spin shrink-0" />
                ) : (
                  <UserMinus size={13} className="shrink-0" />
                )}
                <span className="hidden sm:inline">Desatribuir</span>
              </button>
            )}
          </div>
          )}
        </div>

        {/* Feedback de erro ao atribuir */}
        {assignError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3.5 py-2 animate-in fade-in duration-200">
            <AlertTriangle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{assignError}</span>
          </div>
        )}
      </div>

      {/* Alerta de erro na atualização de status */}
      {statusError && (
        <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3.5 py-2 animate-in fade-in duration-200">
          <AlertTriangle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">{statusError}</span>
        </div>
      )}

      {/* 2. Grid de 2 Colunas Lado a Lado: Descrição & Solução */}
      <div
        className={`grid gap-3.5 ${
          log.actionTaken && log.actionTaken.trim() !== ""
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {/* Coluna 1: Descrição do Atendimento */}
        <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Descrição do Atendimento
            </span>
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
              {log.reportedProblem}
            </p>
          </div>
        </div>

        {/* Coluna 2: Solução / Ação Realizada (com ícone CheckCircle2 verde) */}
        {log.actionTaken && log.actionTaken.trim() !== "" && (
          <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Solução / Ação Realizada
              </span>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                {log.actionTaken}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Seção Rica de Relatório de IA ou Estados de Progresso / Fallback */}
      {structured ? (
        /* Card Estruturado com Acabamento Rico */
        <div className="bg-slate-50/60 dark:bg-[#0b0f19]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
          {/* Header do Card de IA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sparkles size={15} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {structured.title || "Relatório Executivo de IA"}
                </h4>
                {(structured.subtitle || (structured as any).objective) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {structured.subtitle || (structured as any).objective}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {/* Botão Copiar Texto do Relatório */}
              <button
                type="button"
                onClick={handleCopyReportText}
                id="btn-copy-report-text"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                title="Copiar texto formatado do relatório para a área de transferência"
              >
                {copiedReport ? (
                  <>
                    <Check size={13} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} className="text-slate-500 dark:text-slate-400" />
                    <span>Copiar Relatório</span>
                  </>
                )}
              </button>

{/* Botão Vídeo gravado */}
              {hasVideo && (
                <a
                  href={api.worklogs.getDownloadRecordingUrl(log.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150"
                  title="Baixar gravação em vídeo"
                >
                  <Video size={13} />
                  <span>Vídeo</span>
                </a>
              )}

              {/* Botão Visualizar Mídias Anexadas */}
              {mediaPaths.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenMediaModal?.(log)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                  title="Visualizar mídias e arquivos anexados a este atendimento"
                >
                  <Paperclip size={13} />
                  <span>Mídias ({mediaPaths.length})</span>
                </button>
              )}

              {/* Botão Visualizar PDF */}
              {hasPdf && (
                onOpenPdfModal ? (
                  <button
                    type="button"
                    onClick={() => onOpenPdfModal(log.id)}
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                    title="Visualizar o PDF oficial"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </button>
                ) : (
                  <a
                    href={api.worklogs.getViewReportUrl(log.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150"
                    title="Visualizar o PDF oficial em nova aba"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </a>
                )
              )}
            </div>
          </div>

          {/* Resumo Executivo */}
          {(structured.executiveSummary || (structured as any).summary) && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Resumo Executivo
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {structured.executiveSummary || (structured as any).summary}
              </p>
            </div>
          )}

          {/* Propostas & Melhorias Identificadas com Badges de Prioridade */}
          {structured.proposals && structured.proposals.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Propostas & Melhorias Identificadas
              </span>
              <div className="flex flex-col gap-2.5">
                {structured.proposals.map((prop, idx) => {
                  const pNorm = (prop.priority || "").toLowerCase().trim();
                  const isHighPriority =
                    pNorm === "alta" || pNorm === "high" || pNorm === "urgente";
                  const isMediumPriority =
                    pNorm === "média" || pNorm === "media" || pNorm === "medium";

                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-[#161f33] border border-slate-200 dark:border-slate-800 rounded-lg p-3 sm:p-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {prop.item}
                        </span>
                        {prop.priority && (
                          <span
                            className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full border ${
                              isHighPriority
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                : isMediumPriority
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            }`}
                          >
                            {prop.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {prop.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detalhamento Técnico */}
          {structured.detailingTopic && (
            <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Detalhamento: {structured.detailingTopic}
              </span>
              {structured.detailingParagraphs?.map((p, i) => (
                <p
                  key={i}
                  className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-1"
                >
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* Encaminhamentos */}
          {structured.referrals && (
            <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Encaminhamentos & Próximos Passos
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {structured.referrals}
              </p>
            </div>
          )}

          {/* Transcrição Relevante */}
          {structured.transcript && structured.transcript.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareText size={14} className="text-indigo-600 dark:text-indigo-400" />
                Trechos Relevantes da Transcrição
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {structured.transcript.map((line, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-[#161f33] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex flex-col gap-1 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {line.speaker} {line.role ? `(${line.role})` : ""}
                      </span>
                      {line.timestamp && <span>{line.timestamp}</span>}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800">
                      {line.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : currentAiReport?.status === "pending" ? (
        /* Estado Pendente */
        <div className="flex flex-col gap-3 p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-xl">
          <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <Clock size={16} className="text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
            <span className="font-medium">
              {currentAiReport.videoPath
                ? "A gravação foi recebida e está aguardando o início da análise pela inteligência artificial."
                : "O chamado foi recebido e está aguardando o início da análise pela inteligência artificial."}
            </span>
          </div>

          {hasVideo && (
            <div className="flex justify-end pt-1">
              <a
                href={api.worklogs.getDownloadRecordingUrl(log.id)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Baixar gravação de vídeo</span>
              </a>
            </div>
          )}
        </div>
      ) : currentAiReport?.status === "processing" ? (
        /* Estado Processando com Barra Animada */
        <div className="flex flex-col gap-3 p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl">
          <div className="flex items-center gap-2.5 text-xs text-indigo-950 dark:text-indigo-200 font-medium">
            <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {currentAiReport.videoPath
                ? "A IA está analisando o vídeo e estruturando o relatório executivo..."
                : "A IA está analisando as informações do chamado e estruturando o relatório..."}
            </span>
          </div>

          {/* Barra de Progresso Animada */}
          <div className="w-full h-1.5 bg-indigo-100/80 dark:bg-indigo-950/60 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-500 rounded-full animate-pulse" />
          </div>

          {hasVideo && (
            <div className="flex justify-end pt-1">
              <a
                href={api.worklogs.getDownloadRecordingUrl(log.id)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Baixar gravação</span>
              </a>
            </div>
          )}
        </div>
      ) : currentAiReport?.status === "failed" ? (
        /* Estado de Falha com Botão de Tentativa */
        <div className="flex flex-col gap-3 p-4 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-xl">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 leading-tight">
                Não foi possível gerar o relatório
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 leading-normal break-words">
                {currentAiReport.errorMessage ||
                  "Ocorreu um erro no processamento com a IA. Tente novamente."}
              </p>
              {retryFeedback && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                  {retryFeedback}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            {hasVideo && (
              <a
                href={api.worklogs.getDownloadRecordingUrl(log.id)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                title="Baixar gravação de vídeo original"
              >
                <Video size={13} className="text-slate-600 dark:text-slate-400" />
                <span>Baixar gravação</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-rose-950/40 hover:bg-rose-50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 shadow-xs transition-all cursor-pointer ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw
                size={13}
                className={isRetrying ? "animate-spin text-rose-600 dark:text-rose-400" : "text-rose-600 dark:text-rose-400"}
              />
              <span>{isRetrying ? "Reiniciando..." : "Tentar novamente"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Fallback: Banner Elegante Convidativo para Gerar IA Sob Demanda */
        <div className="bg-gradient-to-r from-indigo-50/70 via-sky-50/40 to-indigo-50/70 dark:from-indigo-950/25 dark:via-sky-950/15 dark:to-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100/70 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Relatório Executivo com IA
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Este atendimento foi registrado sem gravação de tela. Você pode solicitar a geração sob demanda de uma análise técnica executiva com base nas informações e mídias deste chamado.
                </p>
                {generateFeedback && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>{generateFeedback}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 active:scale-[0.98] shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Iniciando IA...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-white" />
                  <span>Gerar Relatório com IA</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Fallback de PDF e Mídias caso o relatório de IA não tenha structuredData mas tenha PDF ou anexos */}
      {!structured && (hasPdf || mediaPaths.length > 0) && (
        <div className="flex flex-col gap-3">
          {hasPdf && (
            <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Relatório PDF disponível
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Relatório oficial gerado para este atendimento
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                                <button
                  type="button"
                  onClick={handleCopyReportText}
                  id="btn-copy-fallback-report"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
                  title="Copiar dados do relatório"
                >
                  {copiedReport ? (
                    <>
                      <Check size={13} className="text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} className="text-slate-500 dark:text-slate-400" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                {hasVideo && (
                  <a
                    href={api.worklogs.getDownloadRecordingUrl(log.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all duration-150"
                  >
                    <Video size={13} />
                    <span>Vídeo</span>
                  </a>
                )}

                {onOpenPdfModal ? (
                  <button
                    type="button"
                    onClick={() => onOpenPdfModal(log.id)}
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150 shrink-0 cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </button>
                ) : (
                  <a
                    href={api.worklogs.getViewReportUrl(log.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs active:scale-98 transition-all duration-150 shrink-0"
                  >
                    <Eye size={14} />
                    <span>Visualizar PDF</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {mediaPaths.length > 0 && (
            <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <Paperclip size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {mediaPaths.length} mídia(s) anexada(s)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Imagens, capturas de tela e arquivos anexados
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenMediaModal?.(log)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-98 transition-all duration-150 cursor-pointer"
              >
                <Paperclip size={13} />
                <span>Ver Mídias ({mediaPaths.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Linha do Tempo: Histórico de Alterações de Status */}
      <div className="bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
        {/* Cabeçalho da Seção de Histórico */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
              <History size={14} />
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Histórico de Alterações de Status
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700/60">
              {timelineItems.length}
            </span>
          </div>
        </div>

        {/* Lista Vertical de Eventos com Linha Conectora */}
        <div className="flex flex-col max-h-72 overflow-y-auto pr-1">
          {timelineItems.map((item, idx) => {
            const isLast = idx === timelineItems.length - 1;
            const isInitial =
              item.fromStatus.toLowerCase() === "registro inicial" ||
              item.fromStatus.toLowerCase() === "criação" ||
              item.fromStatus.toLowerCase() === "criacao";

            const toPill = getStatusPill(item.toStatus);
            const fromPill = getStatusPill(item.fromStatus);
            const roleBadge = getRoleBadge(item.changedBy?.role);

            return (
              <div key={item.id} className="relative flex items-start gap-3 group">
                {/* Marcador Dot e Linha Vertical Conectora */}
                <div className="relative flex flex-col items-center shrink-0 self-stretch">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#0b0f19] shadow-2xs ${toPill.dotClass} ring-2 ring-slate-200 dark:ring-slate-700/80 z-10 mt-1 transition-transform group-hover:scale-115`}
                  />
                  {!isLast && (
                    <div className="w-0.5 bg-slate-200 dark:bg-slate-800 grow mt-1 mb-1" />
                  )}
                </div>

                {/* Conteúdo do Evento */}
                <div className={`flex-1 min-w-0 ${!isLast ? "pb-4" : "pb-1"}`}>
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {item.changedBy?.name || "Usuário"}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${roleBadge.className}`}
                    >
                      <span className={`w-1 h-1 rounded-full ${roleBadge.dotColor}`} />
                      <span>{roleBadge.label}</span>
                    </span>

                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium ml-auto flex items-center gap-1">
                      <Clock size={11} className="opacity-70" />
                      {formatTimelineDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Transição de Status Visual */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {isInitial ? (
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400">
                          Registro inicial como
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs ${toPill.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${toPill.dotClass}`} />
                          <span>{toPill.label}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs ${fromPill.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${fromPill.dotClass}`} />
                          <span>{fromPill.label}</span>
                        </span>
                        <ArrowRight
                          size={12}
                          className="text-slate-400 dark:text-slate-500 shrink-0"
                        />
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs ${toPill.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${toPill.dotClass}`} />
                          <span>{toPill.label}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Slot de Ações do Rodapé (ex: Marcar como Solucionado) */}
      {footerActions && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 flex-wrap">
          {footerActions}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão (Admin) */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                  Excluir Atendimento Permanentemente?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Tem certeza que deseja remover o atendimento{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    &quot;{log.title || log.clientOrOffice}&quot;
                  </strong>
                  ? Esta ação excluirá os relatórios, histórico e arquivos associados (Cloudflare R2 e banco). Esta operação não pode ser desfeita.
                </p>
                {deleteError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-2 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                    {deleteError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-worklog"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkLogDetailContent;
