import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ClientProfileData, WorkLogItem, AgendaEventItem, resolveApiUrl } from "@/services/api";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  FileCheck,
  Eye,
  Paperclip,
  Download,
  Video,
} from "lucide-react";
import TagBadge from "@/components/TagBadge";
import { getStatusPill } from "@/components/ReportCardMinimized";
import { ReportDetailsModal } from "@/components/dashboard/ReportDetailsModal";
import MediaGalleryModal from "@/components/MediaGalleryModal";
import { MeetingCompletionModal } from "@/components/dashboard/MeetingCompletionModal";

function parseMediaList(mediaRaw?: string | null): string[] {
  if (!mediaRaw) return [];
  try {
    const parsed = JSON.parse(mediaRaw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    if (typeof parsed === "string") {
      return [parsed];
    }
  } catch {
    if (typeof mediaRaw === "string" && mediaRaw.trim()) {
      return mediaRaw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

const isImageFile = (url: string) => /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);
const isVideoFile = (url: string) => /\.(mp4|webm|ogg|mov)$/i.test(url);
const isPdfFile = (url: string) => /\.pdf$/i.test(url);

function getFileName(url: string) {
  try {
    const cleaned = url.split("?")[0].split("#")[0];
    const name = cleaned.substring(cleaned.lastIndexOf("/") + 1);
    return decodeURIComponent(name.replace(/^\d+-/, ""));
  } catch {
    return "arquivo";
  }
}

function formatDate(dateValue?: string) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) {
      // Se for apenas string no formato "YYYY-MM-DD"
      const [year, month, day] = dateValue.split("-");
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return dateValue;
    }
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateValue;
  }
}

function formatDateTime(dateValue?: string) {
  if (!dateValue) return "—";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return dateValue;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateValue;
  }
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

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<ClientProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de Detalhes do Relatório / Atendimento
  const [selectedLog, setSelectedLog] = useState<WorkLogItem | null>(null);

  // Estados de Ata de Reunião
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Set<string>>(new Set());
  const [completingMeeting, setCompletingMeeting] = useState<AgendaEventItem | null>(null);

  // Galeria de Mídias
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const toggleMeetingExpanded = (meetingId: string) => {
    setExpandedMeetingIds((prev) => {
      const next = new Set(prev);
      if (next.has(meetingId)) {
        next.delete(meetingId);
      } else {
        next.add(meetingId);
      }
      return next;
    });
  };

  const openGalleryForMedia = (urls: string[], index = 0) => {
    setGalleryUrls(urls.map((u) => resolveApiUrl(u)));
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const fetchClientProfile = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.clients.getById(id);
      setData(res);
    } catch (err) {
      console.error("[ClientProfilePage] Erro ao carregar perfil do cliente:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os dados deste cliente."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClientProfile();
  }, [fetchClientProfile]);

  if (loading) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
        <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-slate-700 dark:text-slate-300 animate-spin" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Carregando perfil e histórico do cliente...
          </span>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-2xl p-6 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-rose-900 dark:text-rose-200 text-base">
                Falha ao carregar cliente
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                {error || "Cliente não encontrado ou removido."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/clientes"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar para Clientes</span>
            </Link>
            <button
              onClick={fetchClientProfile}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const { client, events = [], workLogs = [], stats } = data;

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in space-y-8">
      {/* ================= 1. CABEÇALHO COM BOTÃO VOLTAR E TÍTULO HIERÁRQUICO ================= */}
      <div>
        {/* Topo: Botão de voltar */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard/clientes")}
            className="group inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer py-1 px-1 -ml-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Voltar para Clientes</span>
          </button>
        </div>

        {/* Logo abaixo: Span "Cliente" */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Cliente</span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Cadastrado em {formatDate(client.createdAt)}
          </span>
        </div>

        {/* Logo abaixo do span: Nome do Cliente em Destaque */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(client.name)}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {client.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Histórico centralizado de chamados, atendimentos e reuniões de alinhamento
              </p>
            </div>
          </div>
        </div>

        {/* Mini Cards de Métricas SaaS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Total de Chamados</span>
              <MessageSquare className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalWorkLogs ?? workLogs.length}
            </p>
          </div>

          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Solucionados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats?.solvedWorkLogs ?? workLogs.filter((w) => w.status === "Solucionado").length}
            </p>
          </div>

          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Em Andamento</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats?.pendingWorkLogs ?? workLogs.filter((w) => w.status !== "Solucionado").length}
            </p>
          </div>

          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Reuniões</span>
              <Calendar className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-violet-600 dark:text-violet-400">
              {stats?.totalEvents ?? events.length}
            </p>
          </div>
        </div>
      </div>

      {/* ================= 2. ÁREA DE HISTÓRICO DE REUNIÕES & AGENDA ================= */}
      <section className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Título da seção */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/80 dark:border-violet-800/60 flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Histórico de Reuniões & Agenda
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Alinhamentos e compromissos agendados com a equipe
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/60">
            {events.length} {events.length === 1 ? "reunião" : "reuniões"}
          </span>
        </div>

        {/* Lista de Reuniões */}
        {events.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-2.5 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              Nenhuma reunião registrada
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Compromissos agendados na Agenda Compartilhada vinculados a este cliente serão exibidos aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#0b0f19]/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Data & Hora</th>
                  <th className="px-6 py-3.5">Título da Reunião</th>
                  <th className="px-6 py-3.5">Responsável</th>
                  <th className="px-6 py-3.5">Categoria</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Ata da Reunião</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {events.map((evt) => {
                  const isCompleted = evt.completed;
                  const employeeName = evt.employee?.name || evt.createdBy?.name || "Não atribuído";
                  const mediaList = parseMediaList(evt.media);
                  const hasAta = Boolean(evt.notes || mediaList.length > 0);
                  const isExpanded = expandedMeetingIds.has(evt.id);

                  return (
                    <React.Fragment key={evt.id}>
                      <tr
                        className={`hover:bg-slate-50/60 dark:hover:bg-[#161f33]/40 transition-colors ${
                          isExpanded ? "bg-slate-50/50 dark:bg-[#161f33]/30" : ""
                        }`}
                      >
                        {/* Data & Hora */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                              {formatDate(evt.date)}
                            </span>
                            {evt.time && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{evt.time}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Título da Reunião */}
                        <td className="px-6 py-4">
                          <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                            {evt.title}
                          </span>
                        </td>

                        {/* Responsável */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {getInitials(employeeName)}
                            </div>
                            <span className="text-xs text-slate-700 dark:text-slate-300">
                              {employeeName}
                            </span>
                          </div>
                        </td>

                        {/* Categoria */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                            {evt.category || "Reunião"}
                          </span>
                        </td>

                        {/* Badge de Status: Concluída ou Pendente */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Concluída</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </td>

                        {/* Ação: Ver Ata da Reunião */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {isCompleted ? (
                            <button
                              type="button"
                              onClick={() => toggleMeetingExpanded(evt.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-all cursor-pointer shadow-2xs ${
                                isExpanded
                                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                  : hasAta
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                              title={isExpanded ? "Ocultar detalhes da ata" : "Visualizar ata e evidências"}
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>{isExpanded ? "Ocultar Ata" : "Ver Ata da Reunião"}</span>
                              {mediaList.length > 0 && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    isExpanded
                                      ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                                      : "bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200"
                                  }`}
                                  title={`${mediaList.length} arquivo(s) anexado(s)`}
                                >
                                  {mediaList.length}
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCompletingMeeting(evt)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors cursor-pointer shadow-2xs"
                              title="Registrar ata e concluir reunião"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Concluir Reunião</span>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Linha Expansível da Ata */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-[#0c101b]/70 border-b border-slate-200 dark:border-slate-800 animate-fade-in">
                          <td colSpan={6} className="px-6 py-5">
                            <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                              {/* Header do Card da Ata */}
                              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center shrink-0">
                                    <FileCheck className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                                        Ata Oficial da Reunião
                                      </h4>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                        Concluída
                                      </span>
                                    </div>
                                    {evt.completedAt && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span>Registrada em {formatDateTime(evt.completedAt)}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {mediaList.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openGalleryForMedia(mediaList, 0)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Ver Galeria ({mediaList.length})</span>
                                  </button>
                                )}
                              </div>

                              {/* Resumo / O que foi realizado */}
                              <div className="space-y-1.5">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                  Resumo dos Tópicos & Decisões Tomadas:
                                </span>
                                {evt.notes ? (
                                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-slate-800/80 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-normal">
                                    {evt.notes}
                                  </div>
                                ) : (
                                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 italic">
                                    Nenhum texto de ata foi registrado para esta reunião.
                                  </div>
                                )}
                              </div>

                              {/* Mídias e Arquivos Anexados */}
                              {mediaList.length > 0 && (
                                <div className="space-y-2 pt-1">
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                    Arquivos & Mídias Anexadas ({mediaList.length}):
                                  </span>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {mediaList.map((mediaUrl, mIdx) => {
                                      const fullUrl = resolveApiUrl(mediaUrl);
                                      const isImg = isImageFile(mediaUrl);
                                      const fileName = getFileName(mediaUrl);

                                      return (
                                        <div
                                          key={mIdx}
                                          className="group relative bg-slate-50/80 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
                                        >
                                          <div
                                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                                            onClick={() => openGalleryForMedia(mediaList, mIdx)}
                                          >
                                            {isImg ? (
                                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200/80 dark:border-slate-700">
                                                <img
                                                  src={fullUrl}
                                                  alt={fileName}
                                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                  loading="lazy"
                                                />
                                              </div>
                                            ) : (
                                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 border border-slate-200/80 dark:border-slate-700">
                                                {isVideoFile(mediaUrl) ? (
                                                  <Video className="w-4 h-4 text-indigo-500" />
                                                ) : isPdfFile(mediaUrl) ? (
                                                  <FileText className="w-4 h-4 text-rose-500" />
                                                ) : (
                                                  <Paperclip className="w-4 h-4 text-slate-500" />
                                                )}
                                              </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                              <p
                                                className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                                                title={fileName}
                                              >
                                                {fileName}
                                              </p>
                                              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                <Eye className="w-2.5 h-2.5" />
                                                Clique para visualizar
                                              </span>
                                            </div>
                                          </div>

                                          <a
                                            href={fullUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                                            title="Baixar arquivo original"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================= 3. LISTA DE ATENDIMENTOS E CHAMADOS REALIZADOS ================= */}
      <section className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Título da seção */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center shrink-0 shadow-2xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Atendimentos e Chamados Realizados
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Histórico detalhado com relatórios gerados por IA, vídeos e diagnósticos
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
            {workLogs.length} {workLogs.length === 1 ? "chamado" : "chamados"}
          </span>
        </div>

        {/* Lista de Chamados */}
        {workLogs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-2.5 shadow-2xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              Nenhum chamado registrado para este cliente
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Chamados e relatórios criados com o nome deste cliente serão vinculados e catalogados aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#0b0f19]/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Chamado / Problema</th>
                  <th className="px-6 py-3.5">Solicitante</th>
                  <th className="px-6 py-3.5">Plataforma / Tag</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Data de Registro</th>
                  <th className="px-6 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workLogs.map((log) => {
                  const statusPill = getStatusPill(log.status);
                  const title = log.title?.trim() || log.reportedProblem?.trim() || "Atendimento Geral";
                  const hasAiReport = !!log.aiReport;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#161f33]/50 transition-colors cursor-pointer group"
                    >
                      {/* Título do Chamado */}
                      <td className="px-6 py-4 max-w-md">
                        <div className="flex items-start gap-2.5">
                          {hasAiReport && (
                            <span
                              title="Relatório com IA & Gravação de Tela"
                              className="mt-0.5 p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                              {title}
                            </span>
                            {log.reportedProblem && log.title && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {log.reportedProblem}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Solicitante */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {getInitials(log.requester || "User")}
                          </div>
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {log.requester || "Não informado"}
                          </span>
                        </div>
                      </td>

                      {/* Tag de Plataforma */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.tag ? (
                          <TagBadge name={log.tag.name} color={log.tag.color} size="sm" />
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusPill.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusPill.dotClass}`} />
                          <span>{statusPill.label}</span>
                        </span>
                      </td>

                      {/* Data */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(log.createdAt)}
                      </td>

                      {/* Botão para abrir o modal de detalhes */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium text-xs transition-colors cursor-pointer group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================= MODAL: DETALHES DO ATENDIMENTO ================= */}
      {selectedLog && (
        <ReportDetailsModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onRefresh={fetchClientProfile}
        />
      )}

      {/* ================= MODAL: GALERIA DE MÍDIAS DA ATA ================= */}
      <MediaGalleryModal
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        mediaUrls={galleryUrls}
        initialIndex={galleryIndex}
      />

      {/* ================= MODAL: CONCLUSÃO DE REUNIÃO & REGISTRO DE ATA ================= */}
      <MeetingCompletionModal
        event={completingMeeting}
        isOpen={!!completingMeeting}
        onClose={() => setCompletingMeeting(null)}
        onCompleted={() => {
          fetchClientProfile();
          setCompletingMeeting(null);
        }}
      />
    </main>
  );
}
