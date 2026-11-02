"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Cog, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { api } from "@/services/api";
import ReportCardMinimized from "@/components/ReportCardMinimized";
import MediaGalleryModal from "@/components/MediaGalleryModal";
import WorkLogDetailContent from "@/components/dashboard/WorkLogDetailContent";
import PdfViewerModal from "@/components/dashboard/PdfViewerModal";

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
  onRefresh?: () => void;
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
      badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  if (norm === "em progresso" || norm === "em andamento") {
    return {
      label: "Em andamento",
      badgeClass: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
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
      badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      dotClass: "bg-amber-500",
    };
  }

  if (norm === "não foi possível realizar" || norm === "não realizado") {
    return {
      label: "Não foi possível realizar",
      badgeClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
      dotClass: "bg-rose-500",
    };
  }

  return {
    label: status || "Registrado",
    badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  };
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
  onRefresh,
}: TechnicianDashboardProps) {
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("id");

  const [logs, setLogs] = useState<TechnicalWorkLog[]>(initialLogs);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(requestedId || null);
  const [isPending, startTransition] = useTransition();
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pdfViewerLog, setPdfViewerLog] = useState<TechnicalWorkLog | null>(null);

  const fetchLogs = onRefresh || onLogResolved;

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

  return (
    <div className="w-full">
      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center shadow-xs">
        <input
          type="text"
          className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs rounded-xl px-3 py-2 outline-none focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 transition-colors shadow-2xs max-w-[200px] flex-1"
          placeholder="Pesquisar por solicitante"
          value={filters.requester}
          onChange={(e) => setFilters({ ...filters, requester: e.target.value })}
        />
        <input
          type="text"
          className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs rounded-xl px-3 py-2 outline-none focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 transition-colors shadow-2xs max-w-[220px] flex-1"
          placeholder="Pesquisar por escritório/cliente"
          value={filters.clientOrOffice}
          onChange={(e) => setFilters({ ...filters, clientOrOffice: e.target.value })}
        />
        <input
          type="date"
          className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs rounded-xl px-3 py-2 outline-none focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 transition-colors shadow-2xs max-w-[180px] flex-1 [color-scheme:light] dark:[color-scheme:dark]"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
        />
        <select
          className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
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
          className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
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
          className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">Todos os tipos</option>
          <option value="technical">Ação Técnica</option>
          <option value="implementation">Implementação</option>
        </select>
        <select
          className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:bg-white dark:focus:bg-[#0b0f19] focus:border-slate-900 dark:focus:border-slate-400 transition-colors shadow-2xs max-w-[200px] flex-1 cursor-pointer"
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
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 max-h-[calc(100vh-270px)] overflow-y-auto p-1 pr-1.5">
          {filteredLogs.length === 0 ? (
            <div className="bg-white dark:bg-[#111726] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center py-12 px-4 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <Cog size={20} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
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
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs min-h-[calc(100vh-270px)] max-h-[calc(100vh-270px)] overflow-y-auto relative">
          {selectedLog ? (
            <div className="flex flex-col gap-5 animate-fade-in">
              {/* Alerta de Feedback de Ação */}
              {actionFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fade-in ${
                    actionFeedback.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900"
                  }`}
                >
                  {actionFeedback.type === "success" ? (
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{actionFeedback.text}</span>
                </div>
              )}

              <WorkLogDetailContent
                log={selectedLog}
                onRefresh={fetchLogs}
                onOpenPdfModal={(_id) => setPdfViewerLog(selectedLog)}
                onOpenMediaModal={(_log) => openMediaModal(selectedLog)}
                footerActions={
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-5 mt-2 flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">
                        Resolução Técnica
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Quando o chamado for atendido e resolvido, defina-o como solucionado.
                      </p>
                    </div>
                    <div>
                      {selectedLog.status === "Solucionado" ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-xs shadow-2xs">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                          <span>Solucionado</span>
                        </div>
                      ) : (
                        <button
                          id="btn-solucionado"
                          onClick={() => handleMarkSolved(selectedLog.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                }
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 text-slate-400 dark:text-slate-500">
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

      {/* Modal Visualizador de PDF Estilo Gemini */}
      <PdfViewerModal
        log={pdfViewerLog}
        isOpen={!!pdfViewerLog}
        onClose={() => setPdfViewerLog(null)}
      />
    </div>
  );
}
