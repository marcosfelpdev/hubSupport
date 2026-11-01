"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Cog, Lightbulb, CheckCircle2, Paperclip, AlertCircle, FileText } from "lucide-react";
import { api } from "@/services/api";
import AiReportSection from "@/components/AiReportSection";
import TagBadge from "@/components/TagBadge";
import ReportCardMinimized from "@/components/ReportCardMinimized";
import MediaGalleryModal from "@/components/MediaGalleryModal";

export interface TechnicalWorkLog {
  id: string;
  title?: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken?: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  media: string;
  tagId?: string | null;
  tag?: {
    id: string;
    name: string;
    color: string;
  } | null;
  createdAt: Date | string;
  userId: string;
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
  aiReport?: {
    id: string;
    status: string;
    videoPath?: string | null;
    pdfPath?: string | null;
    structuredData?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | string | null;
    completedAt?: Date | string | null;
  } | null;
}

interface TechnicianDashboardProps {
  logs: any[];
  currentUserId: string;
  employees: { name: string }[];
  onLogResolved?: () => void;
}

const avatarColors = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function getAvatarColor(userId?: string) {
  if (!userId) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name?: string) {
  if (!name) return "US";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusPillConfig(status: string) {
  const norm = (status || "").toLowerCase().trim();

  if (
    norm === "solucionado" ||
    norm === "finalizadas" ||
    norm === "finalizado" ||
    norm === "concluído" ||
    norm === "concluido" ||
    norm === "realizado" ||
    norm === "já realizado"
  ) {
    return {
      label: "Solucionado",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dotClass: "bg-emerald-500",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em andamento",
      badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
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
      label: "Aguardando reunião",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
      dotClass: "bg-amber-500",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não foi possível realizar",
      badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
      dotClass: "bg-rose-500",
    };
  }

  return {
    label: status || "Registrado",
    badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
    dotClass: "bg-slate-400",
  };
}

function formatDate(date: Date | string) {
  try {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function getMediaPaths(log: TechnicalWorkLog): string[] {
  try {
    return JSON.parse(log.media || "[]");
  } catch {
    return [];
  }
}

export default function TechnicianDashboardClient({
  logs: initialLogs,
  employees,
  onLogResolved,
}: TechnicianDashboardProps) {
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("id");

  const [logs, setLogs] = useState<TechnicalWorkLog[]>(initialLogs);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(requestedId || null);
  const [isPending, startTransition] = useTransition();
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sincroniza caso initialLogs mude
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // Se houver id no query param, seleciona automaticamente
  useEffect(() => {
    if (requestedId) {
      setSelectedLogId(requestedId);
    }
  }, [requestedId]);

  const [filters, setFilters] = useState({
    requester: "",
    clientOrOffice: "",
    date: "",
    status: "",
    employee: "",
    type: "", // 'technical', 'implementation' ou ''
    tag: "",
  });

  // Media Modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaCurrentIndex, setMediaCurrentIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState<string[]>([]);

  const tagOptions = useMemo(() => {
    const unique = Array.from(new Set(logs.map((l) => l.tag?.name).filter(Boolean)));
    unique.sort();
    return unique;
  }, [logs]);

  const employeeOptions = useMemo(() => {
    const unique = Array.from(new Set(employees.map((e) => e.name).filter(Boolean)));
    unique.sort();
    return unique;
  }, [employees]);

  const statusOptions = useMemo(() => {
    const list = Array.from(new Set(logs.map((l) => l.status).filter(Boolean)));
    if (!list.includes("Solucionado")) list.push("Solucionado");
    return list;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesRequester = filters.requester
        ? log.requester.toLowerCase().includes(filters.requester.toLowerCase())
        : true;
      const matchesClient = filters.clientOrOffice
        ? log.clientOrOffice.toLowerCase().includes(filters.clientOrOffice.toLowerCase())
        : true;
      const matchesDate = filters.date
        ? new Date(log.createdAt).toISOString().split("T")[0] === filters.date
        : true;
      const matchesStatus = filters.status ? log.status === filters.status : true;
      const matchesEmployee = filters.employee ? log.user.name === filters.employee : true;
      const matchesType =
        filters.type === "technical"
          ? log.technicalAction
          : filters.type === "implementation"
            ? log.implementation
            : true;

      const matchesTag = filters.tag ? log.tag?.name === filters.tag : true;
      return matchesRequester && matchesClient && matchesDate && matchesStatus && matchesEmployee && matchesType && matchesTag;
    });
  }, [logs, filters]);

  const validSelectedLogId = useMemo(() => {
    if (!selectedLogId) return filteredLogs.length > 0 ? filteredLogs[0].id : null;
    if (filteredLogs.find((l) => l.id === selectedLogId)) return selectedLogId;
    return filteredLogs.length > 0 ? filteredLogs[0].id : null;
  }, [selectedLogId, filteredLogs]);

  const selectedLog = logs.find((log) => log.id === validSelectedLogId);

  function openMediaModal(log: TechnicalWorkLog, startIndex = 0) {
    const paths = getMediaPaths(log);
    setMediaItems(paths);
    setMediaCurrentIndex(startIndex);
    setMediaModalOpen(true);
  }

  // Handler para marcar o atendimento como Solucionado
  async function handleMarkSolved(logId: string) {
    setActionFeedback(null);
    startTransition(async () => {
      try {
        const res = await api.worklogs.resolve(logId);
        onLogResolved?.();
        if (res.error) {
          setActionFeedback({ type: "error", text: res.error });
          return;
        }

        // Atualização imediata no estado local
        setLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, status: "Solucionado" } : l))
        );

        setActionFeedback({
          type: "success",
          text: "Atendimento marcado como solucionado com sucesso!",
        });

        setTimeout(() => setActionFeedback(null), 4000);
      } catch (err) {
        console.error("Erro ao solucionar atendimento:", err);
        setActionFeedback({
          type: "error",
          text: "Falha ao definir como solucionado. Tente novamente.",
        });
      }
    });
  }

  const selectedStatusPill = selectedLog ? getStatusPillConfig(selectedLog.status) : null;

  return (
    <div className="w-full">
      {/* Barra de Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center shadow-xs">
        <input
          type="text"
          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none focus:border-slate-900 transition-colors shadow-2xs max-w-[200px] flex-1"
          placeholder="Pesquisar por solicitante"
          value={filters.requester}
          onChange={(e) => setFilters({ ...filters, requester: e.target.value })}
        />
        <input
          type="text"
          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none focus:border-slate-900 transition-colors shadow-2xs max-w-[220px] flex-1"
          placeholder="Pesquisar por escritório/cliente"
          value={filters.clientOrOffice}
          onChange={(e) => setFilters({ ...filters, clientOrOffice: e.target.value })}
        />
        <input
          type="date"
          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none focus:border-slate-900 transition-colors shadow-2xs max-w-[180px] flex-1"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
        />
        <select
          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none focus:border-slate-900 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Todos os status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {getStatusPillConfig(status).label}
            </option>
          ))}
        </select>
        <select
          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none focus:border-slate-900 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
          value={filters.tag}
          onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
        >
          <option value="">Todas as plataformas / tags</option>
          {tagOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none focus:border-slate-900 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">Todos os tipos</option>
          <option value="technical">Ação Técnica</option>
          <option value="implementation">Implementação</option>
        </select>
        <select
          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none focus:border-slate-900 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
          value={filters.employee}
          onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
        >
          <option value="">Todos os autores</option>
          {employeeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid Principal: Cards minimizados ao lado (esquerda) e Card expandido ao lado (direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-h-[calc(100vh-280px)]">
        {/* Coluna Esquerda: Cards minimizados */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl text-center py-12 px-4 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <Cog size={20} />
              </div>
              <p className="text-slate-500 text-xs font-medium">
                Nenhum chamado técnico encontrado
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = log.id === validSelectedLogId;
              return (
                <ReportCardMinimized
                  key={log.id}
                  id={`card-tech-${log.id}`}
                  log={log}
                  isSelected={isSelected}
                  onClick={() => setSelectedLogId(log.id)}
                />
              );
            })
          )}
        </div>

        {/* Coluna Central / Direita: Card expandido */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs min-h-[calc(100vh-270px)] max-h-[calc(100vh-270px)] overflow-y-auto relative">
          {selectedLog ? (
            <div className="flex flex-col gap-5 animate-fade-in">
              {/* Alerta de Feedback de Ação */}
              {actionFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fade-in ${
                    actionFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {actionFeedback.type === "success" ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <span>{actionFeedback.text}</span>
                </div>
              )}

              {/* Topo do card expandido */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                    style={{ backgroundColor: getAvatarColor(selectedLog.userId) }}
                  >
                    {getInitials(selectedLog.user.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 leading-tight">
                        {selectedLog.user.name}
                      </p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {selectedLog.user.role === "ADMIN"
                          ? "Administrador"
                          : selectedLog.user.role === "SUPPORT"
                            ? "Suporte"
                            : selectedLog.user.role === "MANAGER"
                              ? "Gestor"
                              : "Colaborador"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Registrado em {formatDate(selectedLog.createdAt)} às{" "}
                      {new Date(selectedLog.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Master Tag */}
                  {selectedLog.tag && (
                    <TagBadge name={selectedLog.tag.name} color={selectedLog.tag.color} size="md" />
                  )}

                  {/* Tags Ação Técnica / Implementação */}
                  {selectedLog.technicalAction && (
                    <div
                      title="Ação Técnica"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-2xs"
                    >
                      <Cog size={12} />
                      <span>Ação Técnica</span>
                    </div>
                  )}
                  {selectedLog.implementation && (
                    <div
                      title="Implementação"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold shadow-2xs"
                    >
                      <Lightbulb size={12} />
                      <span>Implementação</span>
                    </div>
                  )}

                  {selectedStatusPill && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs ${selectedStatusPill.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedStatusPill.dotClass}`} />
                      <span>{selectedStatusPill.label}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Título do Chamado (se houver) */}
              {selectedLog.title && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Título do Atendimento
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedLog.title}
                  </h3>
                </div>
              )}

              {/* Solicitante & Escritório */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Solicitante
                  </span>
                  <p className="text-xs font-semibold text-slate-800">
                    {selectedLog.requester || "Não informado"}
                  </p>
                </div>
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Escritório / Cliente
                  </span>
                  <p className="text-xs font-semibold text-slate-800">
                    {selectedLog.clientOrOffice || "Não informado"}
                  </p>
                </div>
              </div>

              {/* Botão Mídia (se houver) */}
              {getMediaPaths(selectedLog).length > 0 && (
                <div>
                  <button
                    onClick={() => openMediaModal(selectedLog)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                  >
                    <Paperclip size={14} className="text-slate-500" />
                    <span>Visualizar Mídias ({getMediaPaths(selectedLog).length})</span>
                  </button>
                </div>
              )}

              {/* Seção Relatório de IA */}
              <AiReportSection
                workLogId={selectedLog.id}
                initialReport={selectedLog.aiReport}
              />

              {/* Detalhes do Chamado */}
              <div className="space-y-4">
                {/* Problema relatado */}
                <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">
                    <AlertCircle size={14} />
                    <span>Descrição do Problema</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {selectedLog.reportedProblem || "Nenhuma descrição fornecida."}
                  </p>
                </div>

                {/* Ação realizada (se houver histórico) */}
                {selectedLog.actionTaken && selectedLog.actionTaken.trim() !== "" && (
                  <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">
                      <CheckCircle2 size={14} />
                      <span>Ação Realizada pelo Autor</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {selectedLog.actionTaken}
                    </p>
                  </div>
                )}
              </div>

              {/* SEÇÃO DE AÇÃO TÉCNICA: BOTÃO "SOLUCIONADO" */}
              <div className="border-t border-slate-200 pt-5 mt-2 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-0.5">
                    Resolução Técnica
                  </h4>
                  <p className="text-xs text-slate-500">
                    Quando o chamado for atendido e resolvido, defina-o como solucionado.
                  </p>
                </div>

                <div>
                  {selectedLog.status === "Solucionado" ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-xs shadow-2xs">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>Solucionado</span>
                    </div>
                  ) : (
                    <button
                      id="btn-solucionado"
                      onClick={() => handleMarkSolved(selectedLog.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      <span>Marcar como Solucionado</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 text-slate-400">
              <FileText size={36} className="opacity-30 mb-2" />
              <p className="text-xs font-medium">
                Selecione um chamado ao lado para visualizar os detalhes completos e a opção de solucioná-lo
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal / Visualizador de Mídias Anexadas */}
      <MediaGalleryModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        mediaUrls={mediaItems}
        initialIndex={mediaCurrentIndex}
      />
    </div>
  );
}
