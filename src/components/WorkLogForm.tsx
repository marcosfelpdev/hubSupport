import { useState, useTransition, useEffect, useRef } from "react";
import { api, TagItem } from "@/services/api";
import { hexToRgba } from "@/components/TagBadge";
import {
  Video,
  Trash2,
  Sparkles,
  Eye,
  Check,
  UploadCloud,
  X,
  Paperclip,
  Cog,
  Lightbulb,
  Lock,
  ChevronDown,
  PlusCircle,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "Realizado", label: "Já realizado" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Aguardando reunião", label: "Aguardando reunião" },
  { value: "Não foi possível realizar", label: "Não foi possível realizar" },
] as const;

interface WorkLogFormProps {
  onSuccess?: () => void;
  recordedVideo?: File | null;
  onDiscardRecording?: () => void;
}

export default function WorkLogForm({
  onSuccess,
  recordedVideo = null,
  onDiscardRecording,
}: WorkLogFormProps = {}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [technicalAction, setTechnicalAction] = useState(false);
  const [implementation, setImplementation] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("Realizado");
  const isTechnicalOrImplementation = technicalAction || implementation;
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRecordedVideo, setActiveRecordedVideo] = useState<File | null>(recordedVideo);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  // Tags Mestre para Contextualização de Plataformas
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [loadingTags, setLoadingTags] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadTags() {
      try {
        const data = await api.tags.getAll();
        if (mounted) setTags(data);
      } catch (err) {
        console.error("[WorkLogForm] Erro ao carregar tags:", err);
      } finally {
        if (mounted) setLoadingTags(false);
      }
    }
    loadTags();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveRecordedVideo(recordedVideo);
  }, [recordedVideo]);

  useEffect(() => {
    if (activeRecordedVideo) {
      const url = URL.createObjectURL(activeRecordedVideo);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
      setShowVideoPreview(false);
    }
  }, [activeRecordedVideo]);

  function handleDiscardVideo() {
    if (confirm("Deseja realmente remover esta gravação de tela?")) {
      setActiveRecordedVideo(null);
      onDiscardRecording?.();
    }
  }

  function addFiles(newFiles: File[]) {
    setMediaFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const unique = newFiles.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
      return [...prev, ...unique];
    });
  }

  function removeFile(indexToRemove: number) {
    setMediaFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
    if (e.target) e.target.value = "";
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    if (!selectedTagId) {
      setMessage({
        type: "error",
        text: "Por favor, selecione uma tag de plataforma obrigatória.",
      });
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    const finalStatus = isTechnicalOrImplementation ? "Backlog" : selectedStatus;
    formData.set("technicalAction", technicalAction ? "on" : "off");
    formData.set("implementation", implementation ? "on" : "off");
    formData.set("status", finalStatus);
    formData.set("tagId", selectedTagId);
    formData.set("actionTaken", "");
    formData.delete("media");

    mediaFiles.forEach((file) => {
      formData.append("media", file);
    });

    if (activeRecordedVideo) {
      formData.append("recordedVideo", activeRecordedVideo);
    }

    startTransition(async () => {
      try {
        await api.worklogs.create(formData);
        form.reset();
        setTechnicalAction(false);
        setImplementation(false);
        setSelectedStatus("Realizado");
        setSelectedTagId(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMediaFiles([]);
        setActiveRecordedVideo(null);
        onSuccess?.();
        setMessage({
          type: "success",
          text: activeRecordedVideo
            ? "Atendimento registrado! O relatório com Gemini AI está sendo processado."
            : "Atendimento registrado com sucesso!",
        });
      } catch (err) {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.",
        });
      }
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0 shadow-2xs">
          <PlusCircle className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Novo Atendimento
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Preencha os dados do chamado e suporte prestado
          </p>
        </div>
      </div>

      {/* Video gravado anexado (se houver) */}
      {activeRecordedVideo && (
        <div className="mb-6 bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex flex-col gap-3 transition-all">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-900">
                    Gravação de tela anexada
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 shadow-2xs">
                    <Sparkles className="w-3 h-3" /> Relatório com Gemini AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {activeRecordedVideo.name} &bull; {formatBytes(activeRecordedVideo.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideoPreview((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title={showVideoPreview ? "Ocultar prévia" : "Ver prévia do vídeo"}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showVideoPreview ? "Ocultar" : "Prévia"}
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscardVideo}
                disabled={isPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                title="Remover vídeo gravado"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            </div>
          </div>

          {showVideoPreview && previewUrl && (
            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 max-h-56 flex justify-center mt-1">
              <video
                src={previewUrl}
                controls
                className="w-full max-h-56 object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {message && (
        <div
          className={`mb-6 rounded-xl p-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fade-in ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <X className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Linha 1: Título e Status lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="title" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Título <span className="text-rose-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
              placeholder="Ex: Erro ao sincronizar API de faturamento"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="status" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Status <span className="text-rose-500">*</span>
              </label>
              {isTechnicalOrImplementation && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-indigo-600" /> Fixo em Backlog
                </span>
              )}
            </div>
            <div className="relative">
              <select
                id="status"
                name="status"
                value={isTechnicalOrImplementation ? "Backlog" : selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={isPending || isTechnicalOrImplementation}
                className={`w-full appearance-none rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs pr-10 outline-none ${
                  isTechnicalOrImplementation
                    ? "bg-slate-100/80 border border-slate-200 text-slate-700 font-medium cursor-not-allowed"
                    : "bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 cursor-pointer"
                }`}
              >
                {isTechnicalOrImplementation ? (
                  <option value="Backlog">Backlog (Padrão para Equipe Técnica)</option>
                ) : (
                  STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                {isTechnicalOrImplementation ? (
                  <Lock className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </div>
            {isTechnicalOrImplementation && (
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                Chamados técnicos iniciam obrigatoriamente na coluna <strong className="text-slate-800">Backlog</strong> do Kanban.
              </p>
            )}
          </div>
        </div>

        {/* Linha 2: Solicitante e Escritório / Cliente lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="requester" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Solicitante <span className="text-rose-500">*</span>
            </label>
            <input
              id="requester"
              name="requester"
              type="text"
              className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
              placeholder="Nome de quem solicitou o suporte"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="clientOrOffice" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Escritório / Cliente <span className="text-rose-500">*</span>
            </label>
            <input
              id="clientOrOffice"
              name="clientOrOffice"
              type="text"
              className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
              placeholder="Ex: Matriz SP / Filial RJ / Cliente X"
              required
              disabled={isPending}
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label htmlFor="reportedProblem" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Descrição <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="reportedProblem"
            name="reportedProblem"
            rows={4}
            className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl p-3.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none resize-y leading-relaxed disabled:bg-slate-50 disabled:cursor-not-allowed"
            placeholder="Descreva a solicitação, incidente e ações tomadas..."
            required
            disabled={isPending}
          />
        </div>

        {/* Seleção de Tag Mestre (Contexto / Plataforma) - OBRIGATÓRIA */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Tag de Plataforma <span className="text-rose-500">*</span>{" "}
              <span className="text-slate-400 lowercase font-normal">(obrigatório - selecione 1 tag)</span>
            </label>
            {selectedTagId && (
              <button
                type="button"
                onClick={() => setSelectedTagId(null)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Limpar seleção
              </button>
            )}
          </div>

          <div
            className={`p-3 bg-slate-50/70 border rounded-xl min-h-[52px] flex flex-wrap items-center gap-2 transition-all ${
              !selectedTagId && message?.type === "error"
                ? "border-rose-300 ring-2 ring-rose-100"
                : "border-slate-200"
            }`}
          >
            {loadingTags ? (
              <span className="text-xs text-slate-500">Carregando tags...</span>
            ) : tags.length === 0 ? (
              <span className="text-xs text-slate-500">
                Nenhuma tag configurada. Acesse <strong>Configurações</strong> na barra lateral para cadastrar tags de plataforma.
              </span>
            ) : (
              tags.map((tag) => {
                const isSelected = selectedTagId === tag.id;
                const bgTint = isSelected ? hexToRgba(tag.color, 0.16) : hexToRgba(tag.color, 0.08);

                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => setSelectedTagId(isSelected ? null : tag.id)}
                    title={isSelected ? `Tag selecionada: ${tag.name} (clique para desmarcar)` : `Selecionar ${tag.name}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                      isSelected
                        ? "ring-2 ring-slate-900 shadow-xs scale-[1.02]"
                        : "border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs hover:border-slate-300"
                    }`}
                    style={{
                      backgroundColor: isSelected ? bgTint : undefined,
                      borderColor: isSelected ? tag.color : undefined,
                      color: isSelected ? tag.color : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Checklist: Ação Técnica / Implementação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
          <button
            type="button"
            onClick={() => setTechnicalAction((prev) => !prev)}
            disabled={isPending}
            className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer select-none ${
              technicalAction
                ? "bg-amber-50/90 border-amber-300 text-amber-900 shadow-xs ring-1 ring-amber-300"
                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  technicalAction ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Cog className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block font-semibold text-xs text-slate-900">Ação Técnica</span>
                <span className="block text-[11px] text-slate-500">Demanda técnica / dev</span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                technicalAction
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {technicalAction && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setImplementation((prev) => !prev)}
            disabled={isPending}
            className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer select-none ${
              implementation
                ? "bg-blue-50/90 border-blue-300 text-blue-900 shadow-xs ring-1 ring-blue-300"
                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  implementation ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block font-semibold text-xs text-slate-900">Implementação</span>
                <span className="block text-[11px] text-slate-500">Novas features / setup</span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                implementation
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {implementation && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>
        </div>

        {/* Anexo de Mídia - Drag and Drop */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Anexar Mídia <span className="text-slate-400 lowercase font-normal">(opcional)</span>
            </label>
            {mediaFiles.length > 0 && (
              <span className="text-xs font-semibold text-indigo-600">
                {mediaFiles.length} {mediaFiles.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            id="media"
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
            disabled={isPending}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-2 ${
              isDraggingOver
                ? "border-slate-900 bg-slate-100/80 shadow-xs"
                : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
            } ${isPending ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-2xs ${
                isDraggingOver ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              <UploadCloud className="w-5 h-5" />
            </div>

            <div>
              <p className="text-xs font-medium text-slate-700">
                {isDraggingOver ? (
                  <span className="text-slate-900 font-semibold">Solte os arquivos para anexar</span>
                ) : (
                  <>
                    Arraste e solte arquivos aqui ou{" "}
                    <span className="text-slate-900 font-semibold underline underline-offset-2">
                      procure no dispositivo
                    </span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Imagens, documentos ou vídeos (até 100MB por arquivo)
              </p>
            </div>
          </div>

          {/* Lista de arquivos selecionados */}
          {mediaFiles.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-medium text-slate-500">
                  Arquivos prontos para envio:
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMediaFiles([]);
                  }}
                  className="text-[11px] font-medium text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                >
                  Remover todos
                </button>
              </div>

              {mediaFiles.map((file, idx) => (
                <div
                  key={`${file.name}_${idx}`}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    disabled={isPending}
                    title="Remover este arquivo"
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          id="btn-submit-log"
          type="submit"
          disabled={isPending}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl py-3 px-6 text-sm shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-1"
        >
          {isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Salvar Atendimento</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
