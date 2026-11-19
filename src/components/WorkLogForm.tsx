import { useState, useTransition, useEffect, useRef, useMemo, useCallback } from "react";
import { api, TagItem, ClientItem } from "@/services/api";
import { ClientCombobox } from "@/components/ClientCombobox";
import { hexToRgba } from "@/components/TagBadge";
import {
  Video,
  FileText,
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
  Rocket,
} from "lucide-react";
import {
  InlineMediaEditor,
  InlineMediaEditorRef,
} from "@/components/common/InlineMediaEditor";
import {
  AttachedMediaItem,
  InterleavedBlock,
  createAttachedMediaItem,
  truncateMiddle,
} from "@/lib/inline-media-parser";

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
  const [isPrompt, setIsPrompt] = useState(false);
  const [isIdea, setIsIdea] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("Realizado");
  const isTechnicalOrImplementation = technicalAction || implementation || isPrompt || isIdea;

  // Mídias Anexadas e Sincronização Bidirecional
  const [attachedMedia, setAttachedMedia] = useState<AttachedMediaItem[]>([]);
  const [insertedMediaIds, setInsertedMediaIds] = useState<Set<string>>(new Set());
  const [descriptionText, setDescriptionText] = useState<string>("");
  const [interleavedBlocks, setInterleavedBlocks] = useState<InterleavedBlock[]>([]);
  const editorRef = useRef<InlineMediaEditorRef>(null);

  const mediaMap = useMemo(() => {
    const map = new Map<string, AttachedMediaItem>();
    for (const item of attachedMedia) {
      map.set(item.id, item);
    }
    return map;
  }, [attachedMedia]);

  const attachedMediaRef = useRef<AttachedMediaItem[]>([]);
  attachedMediaRef.current = attachedMedia;

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRecordedVideo, setActiveRecordedVideo] = useState<File | null>(recordedVideo);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  // Tags Mestre para Contextualização de Plataformas
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [loadingTags, setLoadingTags] = useState(true);

  // Clientes Cadastrados
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      try {
        const [tagsData, clientsData] = await Promise.all([
          api.tags.getAll().catch((err) => {
            console.error("[WorkLogForm] Erro ao carregar tags:", err);
            return [] as TagItem[];
          }),
          api.clients.getAll().catch((err) => {
            console.error("[WorkLogForm] Erro ao carregar clientes:", err);
            return [] as ClientItem[];
          }),
        ]);
        if (mounted) {
          setTags(tagsData);
          setClients(clientsData);
        }
      } catch (err) {
        console.error("[WorkLogForm] Erro ao carregar dados iniciais:", err);
      } finally {
        if (mounted) setLoadingTags(false);
      }
    }
    loadInitialData();
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

  // Limpeza de URLs de visualização ao desmontar o componente
  useEffect(() => {
    return () => {
      attachedMediaRef.current.forEach((item) => {
        if (item.previewUrl && typeof URL !== "undefined") {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  function handleDiscardVideo() {
    if (confirm("Deseja realmente remover esta gravação de tela?")) {
      setActiveRecordedVideo(null);
      onDiscardRecording?.();
    }
  }

  const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB (1024 MB)

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function addFiles(newFiles: File[]) {
    const oversizedFiles = newFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      setMessage({
        type: "error",
        text: `O arquivo "${oversizedFiles[0].name}" (${formatBytes(oversizedFiles[0].size)}) excede o limite máximo permitido de 1GB.`,
      });
      return;
    }

    setAttachedMedia((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const newItems: AttachedMediaItem[] = [];
      for (const file of newFiles) {
        if (!existingKeys.has(`${file.name}_${file.size}`)) {
          newItems.push(createAttachedMediaItem(file));
        }
      }
      return [...prev, ...newItems];
    });
  }

  const handleMediaAdded = useCallback((item: AttachedMediaItem) => {
    if (item.size > MAX_FILE_SIZE_BYTES) {
      setMessage({
        type: "error",
        text: `O arquivo "${item.name}" (${formatBytes(item.size)}) excede o limite máximo permitido de 1GB.`,
      });
      editorRef.current?.removeChip(item.id);
      if (item.previewUrl && typeof URL !== "undefined") {
        URL.revokeObjectURL(item.previewUrl);
      }
      return;
    }

    setAttachedMedia((prev) => {
      if (prev.some((m) => m.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const handleEditorChange = useCallback(
    (plainText: string, interleaved: InterleavedBlock[], ids: Set<string>) => {
      setDescriptionText(plainText);
      setInterleavedBlocks(interleaved);
      setInsertedMediaIds(new Set(ids));
    },
    []
  );

  function removeMediaItem(idToRemove: string) {
    const item = attachedMedia.find((m) => m.id === idToRemove);
    if (item) {
      editorRef.current?.removeChip(item.id);
      if (item.previewUrl && typeof URL !== "undefined") {
        URL.revokeObjectURL(item.previewUrl);
      }
      setAttachedMedia((prev) => prev.filter((m) => m.id !== idToRemove));
    }
  }

  function removeAllMediaItems() {
    attachedMedia.forEach((item) => {
      editorRef.current?.removeChip(item.id);
      if (item.previewUrl && typeof URL !== "undefined") {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setAttachedMedia([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

    // Ignora drop interno de mídias já existentes na dropzone inferior
    const internalMediaId = e.dataTransfer.getData("application/x-hubsupport-media-id");
    if (internalMediaId) return;

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    if (!selectedClient) {
      setMessage({
        type: "error",
        text: "Por favor, selecione um escritório ou cliente cadastrado.",
      });
      return;
    }

    const plainText = (editorRef.current?.getPlainText() || descriptionText).trim();
    const interleaved = editorRef.current?.getInterleaved() || interleavedBlocks;

    if (!plainText && interleaved.length === 0) {
      setMessage({
        type: "error",
        text: "Por favor, preencha a descrição do atendimento.",
      });
      editorRef.current?.focus();
      return;
    }

    if (!selectedTagId) {
      setMessage({
        type: "error",
        text: "Por favor, selecione uma tag de plataforma obrigatória.",
      });
      return;
    }

    if (activeRecordedVideo && activeRecordedVideo.size > MAX_FILE_SIZE_BYTES) {
      setMessage({
        type: "error",
        text: `A gravação de tela (${formatBytes(activeRecordedVideo.size)}) excede o limite máximo permitido de 1GB.`,
      });
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    const finalStatus = isTechnicalOrImplementation ? "Backlog" : selectedStatus;
    formData.set("technicalAction", technicalAction ? "on" : "off");
    formData.set("implementation", implementation ? "on" : "off");
    formData.set("isPrompt", isPrompt ? "on" : "off");
    formData.set("isIdea", isIdea ? "on" : "off");
    formData.set("status", finalStatus);
    formData.set("tagId", selectedTagId);
    formData.set("clientId", selectedClient.id);
    formData.set("clientOrOffice", selectedClient.name);
    formData.set("actionTaken", "");
    formData.set("reportedProblem", plainText);
    formData.set("descriptionInterleaved", JSON.stringify(interleaved));
    formData.delete("media");

    attachedMedia.forEach((item) => {
      formData.append("media", item.file);
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
        setIsPrompt(false);
        setIsIdea(false);
        setSelectedStatus("Realizado");
        setSelectedTagId(null);
        setSelectedClient(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        attachedMedia.forEach((item) => {
          if (item.previewUrl && typeof URL !== "undefined") {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        setAttachedMedia([]);
        setInsertedMediaIds(new Set());
        setDescriptionText("");
        setInterleavedBlocks([]);
        editorRef.current?.clear();
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
    <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 shrink-0 shadow-2xs">
          <PlusCircle className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Novo Atendimento
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Preencha os dados do chamado e suporte prestado
          </p>
        </div>
      </div>

      {/* Video gravado anexado (se houver) */}
      {activeRecordedVideo && (
        <div className="mb-6 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-4 flex flex-col gap-3 transition-all">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Gravação de tela anexada
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 inline-flex items-center gap-1 shadow-2xs">
                    <Sparkles className="w-3 h-3" /> Relatório com Gemini AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {activeRecordedVideo.name} &bull; {formatBytes(activeRecordedVideo.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideoPreview((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
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
              ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200"
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
            <label htmlFor="title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Título <span className="text-rose-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:cursor-not-allowed"
              placeholder="Ex: Erro ao sincronizar API de faturamento"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="status" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Status <span className="text-rose-500">*</span>
              </label>
              {isTechnicalOrImplementation && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Fixo em Backlog
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
                    ? "bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-medium cursor-not-allowed"
                    : "bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white cursor-pointer"
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
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
                {isTechnicalOrImplementation ? (
                  <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Linha 2: Solicitante e Escritório / Cliente lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="requester" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Solicitante <span className="text-rose-500">*</span>
            </label>
            <input
              id="requester"
              name="requester"
              type="text"
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:cursor-not-allowed"
              placeholder="Nome de quem solicitou o suporte"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="clientOrOffice" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Escritório / Cliente <span className="text-rose-500">*</span>
            </label>
            <ClientCombobox
              id="clientOrOffice"
              clients={clients}
              selectedClient={selectedClient}
              onSelectClient={(c) => {
                setSelectedClient(c);
                if (c && message?.text?.includes("cliente")) {
                  setMessage(null);
                }
              }}
              disabled={isPending}
              required
            />
          </div>
        </div>

        {/* Descrição com Editor Multimodal Inline */}
        <div>
          <label htmlFor="reportedProblem" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Descrição <span className="text-rose-500">*</span>
          </label>
          <InlineMediaEditor
            ref={editorRef}
            id="reportedProblem"
            mediaMap={mediaMap}
            onMediaAdded={handleMediaAdded}
            onChange={handleEditorChange}
            disabled={isPending}
            placeholder="Descreva a solicitação, incidente e ações tomadas..."
            minHeight="120px"
          />
        </div>

        {/* Anexo de Mídia - Drag and Drop e Sincronização */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Anexar Mídia <span className="text-slate-400 dark:text-slate-500 lowercase font-normal">(opcional)</span>
            </label>
            {attachedMedia.length > 0 && (
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {attachedMedia.length} {attachedMedia.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}
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
                ? "border-slate-900 dark:border-slate-400 bg-slate-100/80 dark:bg-slate-800/80 shadow-xs"
                : "border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-[#0b0f19]/40 hover:bg-slate-50 dark:hover:bg-[#0b0f19]/70"
            } ${isPending ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-2xs ${
                isDraggingOver ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <UploadCloud className="w-5 h-5" />
            </div>

            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {isDraggingOver ? (
                  <span className="text-slate-900 dark:text-white font-semibold">Solte os arquivos para anexar</span>
                ) : (
                  <>
                    Arraste e solte arquivos aqui ou{" "}
                    <span className="text-slate-900 dark:text-white font-semibold underline underline-offset-2">
                      procure no dispositivo
                    </span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Imagens, documentos ou vídeos (até 1GB por arquivo)
              </p>
            </div>
          </div>

          {/* Lista de arquivos selecionados em Grid Quadrado */}
          {attachedMedia.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Arquivos prontos para envio: ({attachedMedia.length})
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAllMediaItems();
                  }}
                  className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Remover todos
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {attachedMedia.map((item) => {
                  const ext = item.name.lastIndexOf(".") !== -1
                    ? item.name.slice(item.name.lastIndexOf(".") + 1).toUpperCase()
                    : "";

                  return (
                    <div
                      key={item.id}
                      draggable={!isPending}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-hubsupport-media-id", item.id);
                        e.dataTransfer.effectAllowed = "copyMove";
                      }}
                      className={`aspect-square rounded-xl overflow-hidden relative border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 shadow-2xs group transition-all select-none ${
                        isPending
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-grab active:cursor-grabbing hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-xs"
                      }`}
                      title={
                        isPending
                          ? undefined
                          : `${item.name} (${formatBytes(item.size)}) - Arraste para o campo de descrição`
                      }
                    >
                      {/* Miniatura ou Ícone */}
                      {item.mimeType.startsWith("image/") && item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-slate-400 dark:text-slate-500 pointer-events-none pb-6">
                          {item.mimeType.startsWith("video/") ? (
                            <Video className="w-6 h-6 text-slate-500 dark:text-slate-400 mb-1" />
                          ) : (
                            <FileText className="w-6 h-6 text-slate-500 dark:text-slate-400 mb-1" />
                          )}
                          {ext && (
                            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider bg-slate-200/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded">
                              {ext}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Floating badge No texto */}
                      {insertedMediaIds.has(item.id) && (
                        <div className="absolute top-1.5 left-1.5 z-10 bg-indigo-600/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 backdrop-blur-xs select-none">
                          <span>✓</span>
                          <span>No texto</span>
                        </div>
                      )}

                      {/* Floating remove button */}
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMediaItem(item.id);
                        }}
                        disabled={isPending}
                        title="Remover este arquivo"
                        className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-md bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Floating bottom gradient with truncated name and size */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-1.5 pt-4 text-left pointer-events-none">
                        <p className="text-[10px] font-medium text-white truncate leading-tight" title={item.name}>
                          {truncateMiddle(item.name, 14)}
                        </p>
                        <span className="text-[9px] text-white/75">{formatBytes(item.size)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Seleção de Tag Mestre (Contexto / Plataforma) - OBRIGATÓRIA */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Tag de Plataforma <span className="text-rose-500">*</span>{" "}
              <span className="text-slate-400 dark:text-slate-500 lowercase font-normal">(obrigatório - selecione 1 tag)</span>
            </label>
            {selectedTagId && (
              <button
                type="button"
                onClick={() => setSelectedTagId(null)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Limpar seleção
              </button>
            )}
          </div>

          <div
            className={`p-3 bg-slate-50/70 dark:bg-[#0b0f19]/60 border rounded-xl min-h-[52px] flex flex-wrap items-center gap-2 transition-all ${
              !selectedTagId && message?.type === "error"
                ? "border-rose-300 dark:border-rose-700 ring-2 ring-rose-100 dark:ring-rose-950/40"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            {loadingTags ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">Carregando tags...</span>
            ) : tags.length === 0 ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
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
                        ? "ring-2 ring-slate-900 dark:ring-white shadow-xs scale-[1.02]"
                        : "border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] hover:bg-slate-50 dark:hover:bg-[#161f33] text-slate-700 dark:text-slate-300 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
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

        {/* Checklist: Categorias de Chamado (Ação Técnica, Implementação, Prompt, Ideia) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/70 dark:bg-[#0b0f19]/60 border border-slate-200 dark:border-slate-800 rounded-xl">
          {/* Card 1: Ação Técnica (Âmbar) */}
          <button
            type="button"
            onClick={() => setTechnicalAction((prev) => !prev)}
            disabled={isPending}
            className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer select-none ${
              technicalAction
                ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-xs ring-1 ring-amber-300 dark:ring-amber-800"
                : "bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-[#161f33]"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  technicalAction ? "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <Cog className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">Ação Técnica</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Demanda técnica / dev</span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                technicalAction
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              }`}
            >
              {technicalAction && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Card 2: Implementação (Azul) */}
          <button
            type="button"
            onClick={() => setImplementation((prev) => !prev)}
            disabled={isPending}
            className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer select-none ${
              implementation
                ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-xs ring-1 ring-blue-300 dark:ring-blue-800"
                : "bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-[#161f33]"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  implementation ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <Rocket className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">Implementação</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Novas features / setup</span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                implementation
                  ? "bg-blue-500 border-blue-500 text-white"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              }`}
            >
              {implementation && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Card 3: Prompt (Esmeralda) */}
          <button
            type="button"
            onClick={() => setIsPrompt((prev) => !prev)}
            disabled={isPending}
            className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer select-none ${
              isPrompt
                ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 shadow-xs ring-1 ring-emerald-300 dark:ring-emerald-800"
                : "bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-[#161f33]"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  isPrompt
                    ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">Prompt</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Engenharia / Ajuste de prompt de IA</span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                isPrompt
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              }`}
            >
              {isPrompt && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Card 4: Ideia (Violeta) */}
          <button
            type="button"
            onClick={() => setIsIdea((prev) => !prev)}
            disabled={isPending}
            className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer select-none ${
              isIdea
                ? "bg-violet-50/90 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800 text-violet-900 dark:text-violet-200 shadow-xs ring-1 ring-violet-300 dark:ring-violet-800"
                : "bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-[#161f33]"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  isIdea
                    ? "bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">Ideia</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Sugestão de melhoria / Inovação</span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                isIdea
                  ? "bg-violet-500 border-violet-500 text-white"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              }`}
            >
              {isIdea && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>
        </div>

        {/* Submit */}
        <button
          id="btn-submit-log"
          type="submit"
          disabled={isPending}
          className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-xl py-3 px-6 text-sm shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-1"
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