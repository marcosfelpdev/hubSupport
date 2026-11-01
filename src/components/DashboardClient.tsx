import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Cog,
  Lightbulb,
  Plus,
  Search,
  Calendar,
  X,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import WorkLogForm from "@/components/WorkLogForm";
import ScreenRecorderButton from "@/components/ScreenRecorderButton";
import AiReportSection from "@/components/AiReportSection";
import TagBadge from "@/components/TagBadge";
import { WorkLog } from "@/components/WorkLogFeed";
import ReportCardMinimized from "@/components/ReportCardMinimized";
import MediaGalleryModal from "@/components/MediaGalleryModal";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";

interface DashboardProps {
  logs: any[];
  currentUserId: string;
  employees: { name: string }[];
  onLogCreated?: () => void;
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

function getAvatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < (userId || "").length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  if (!name) return "--";
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
      label: "Em progresso",
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
      label: "Não realizado",
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

function getMediaPaths(log: any): string[] {
  try {
    return JSON.parse(log.media || "[]");
  } catch {
    return [];
  }
}

export default function DashboardClient({
  logs,
  currentUserId,
  employees,
  onLogCreated,
}: DashboardProps) {
  const { isRecording } = useScreenRecording();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<File | null>(null);
  const [filters, setFilters] = useState({
    requester: "",
    clientOrOffice: "",
    date: "",
    status: "",
    employee: "",
    tag: "",
  });

  const handleRecordingComplete = (file: File) => {
    setRecordedVideo(file);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (recordedVideo) {
      if (
        confirm(
          "Você possui uma gravação de tela anexada. Deseja realmente fechar o formulário e descartar o vídeo?"
        )
      ) {
        setRecordedVideo(null);
        setIsModalOpen(false);
      }
    } else {
      setIsModalOpen(false);
    }
  };

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
    const unique = Array.from(new Set(logs.map((l) => l.status).filter(Boolean)));
    unique.sort();
    return unique;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesRequester = filters.requester
        ? log.requester?.toLowerCase().includes(filters.requester.toLowerCase())
        : true;
      const matchesClient = filters.clientOrOffice
        ? log.clientOrOffice?.toLowerCase().includes(filters.clientOrOffice.toLowerCase())
        : true;
      const matchesDate = filters.date
        ? new Date(log.createdAt).toISOString().split("T")[0] === filters.date
        : true;
      const matchesStatus = filters.status ? log.status === filters.status : true;
      const matchesEmployee = filters.employee ? log.user?.name === filters.employee : true;
      const matchesTag = filters.tag ? log.tag?.name === filters.tag : true;
      return matchesRequester && matchesClient && matchesDate && matchesStatus && matchesEmployee && matchesTag;
    });
  }, [logs, filters]);

  const validSelectedLogId = useMemo(() => {
    if (!selectedLogId) return filteredLogs.length > 0 ? filteredLogs[0].id : null;
    if (filteredLogs.find((l) => l.id === selectedLogId)) return selectedLogId;
    return filteredLogs.length > 0 ? filteredLogs[0].id : null;
  }, [selectedLogId, filteredLogs]);

  const selectedLog = logs.find((log) => log.id === validSelectedLogId);

  function openMediaModal(log: any, startIndex = 0) {
    const paths = getMediaPaths(log);
    setMediaItems(paths);
    setMediaCurrentIndex(startIndex);
    setMediaModalOpen(true);
  }

  const selectedLogStatusPill = selectedLog ? getStatusPillConfig(selectedLog.status) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de Ações Rápidas */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={isRecording}
          onClick={() => {
            if (isRecording) return;
            setRecordedVideo(null);
            setIsModalOpen(true);
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer ${
            isRecording ? "opacity-50 cursor-not-allowed" : ""
          }`}
          title={isRecording ? "Finalize a gravação de tela para abrir o formulário manualmente" : undefined}
        >
          <Plus size={16} />
          <span>Novo Atendimento</span>
        </button>

        <ScreenRecorderButton onRecordingComplete={handleRecordingComplete} />
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar por solicitante..."
            value={filters.requester}
            onChange={(e) => setFilters({ ...filters, requester: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
          />
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar por escritório/cliente..."
            value={filters.clientOrOffice}
            onChange={(e) => setFilters({ ...filters, clientOrOffice: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
          />
        </div>

        <div className="relative flex-1 min-w-[150px]">
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors cursor-pointer"
          />
        </div>

        <div className="flex-1 min-w-[160px]">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="">Todos os status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <select
            value={filters.tag}
            onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="">Todas as plataformas / tags</option>
            {tagOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <select
            value={filters.employee}
            onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="">Todos os funcionários</option>
            {employeeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {(filters.requester || filters.clientOrOffice || filters.date || filters.status || filters.tag || filters.employee) && (
          <button
            onClick={() =>
              setFilters({
                requester: "",
                clientOrOffice: "",
                date: "",
                status: "",
                employee: "",
                tag: "",
              })
            }
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Grid de Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna da Esquerda: Feed de Cards */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Clock size={28} className="opacity-40 text-slate-400" />
              <span>Nenhum atendimento encontrado para os filtros selecionados.</span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = log.id === validSelectedLogId;
              return (
                <ReportCardMinimized
                  key={log.id}
                  id={`card-daily-${log.id}`}
                  log={log}
                  isSelected={isSelected}
                  onClick={() => setSelectedLogId(log.id)}
                />
              );
            })
          )}
        </div>

        {/* Coluna da Direita: Detalhe Expandido do Atendimento */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs min-h-[calc(100vh-270px)] max-h-[calc(100vh-270px)] overflow-y-auto">
          {selectedLog ? (
            <div className="flex flex-col gap-5 animate-fade-in">
              {/* Header do Chamado */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                    style={{ backgroundColor: getAvatarColor(selectedLog.userId) }}
                  >
                    {getInitials(selectedLog.user?.name || "")}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">
                      {selectedLog.user?.name || "Usuário do sistema"}
                    </p>
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
                  {selectedLog.tag && (
                    <TagBadge name={selectedLog.tag.name} color={selectedLog.tag.color} size="md" />
                  )}
                  {selectedLogStatusPill && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs ${selectedLogStatusPill.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedLogStatusPill.dotClass}`} />
                      <span>{selectedLogStatusPill.label}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Título do Atendimento (se houver) */}
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

              {/* Informações Complementares: Solicitante, Escritório, Plataforma */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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

                {selectedLog.tag && (
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Plataforma
                    </span>
                    <div className="mt-0.5">
                      <TagBadge name={selectedLog.tag.name} color={selectedLog.tag.color} size="sm" />
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Anexo / Mídia */}
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

              {/* Descrição e Ação Tomada */}
              <div className="space-y-4">
                <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">
                    <AlertCircle size={14} />
                    <span>Descrição do Problema</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {selectedLog.reportedProblem || "Nenhuma descrição fornecida."}
                  </p>
                </div>

                {selectedLog.actionTaken && selectedLog.actionTaken.trim() !== "" && (
                  <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">
                      <CheckCircle2 size={14} />
                      <span>Ação Realizada</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {selectedLog.actionTaken}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 text-slate-400">
              <FileText size={36} className="opacity-30 mb-2" />
              <p className="text-xs">Selecione um atendimento para visualizar os detalhes completos</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Formulário de Criação */}
      {isModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={handleCloseModal}
        >
          <div
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto relative bg-white rounded-2xl shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute top-3.5 right-3.5 z-10 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg p-1.5 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={16} />
            </button>
            <WorkLogForm
              recordedVideo={recordedVideo}
              onDiscardRecording={() => setRecordedVideo(null)}
              onSuccess={() => {
                setIsModalOpen(false);
                setRecordedVideo(null);
                onLogCreated?.();
              }}
            />
          </div>
        </div>,
        document.body
      )}

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
