import { useState, useTransition, useEffect, useRef } from "react";
import { api, TagItem } from "@/services/api";
import { hexToRgba } from "@/components/TagBadge";
import { Video, Trash2, Sparkles, Play, Eye, Check, UploadCloud, X, Paperclip, Cog, Lightbulb } from "lucide-react";

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

    formData.set("technicalAction", technicalAction ? "on" : "off");
    formData.set("implementation", implementation ? "on" : "off");
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
    <div
      className="card animate-fade-in"
      style={{
        borderColor: "rgba(99,102,241,0.2)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginBottom: "1.25rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#818cf8",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Novo Atendimento
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Preencha os dados do suporte prestado
          </p>
        </div>
      </div>

      {/* Video gravado anexado (se houver) */}
      {activeRecordedVideo && (
        <div
          style={{
            marginBottom: "1.25rem",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "8px",
            padding: "0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: "rgba(99, 102, 241, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#818cf8",
                }}
              >
                <Video size={16} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    Gravação de tela anexada
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "4px",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <Sparkles size={10} /> Relatório com Gemini
                  </span>
                </div>
                <span style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                  {activeRecordedVideo.name} &bull; {formatBytes(activeRecordedVideo.size)}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideoPreview((prev) => !prev)}
                  className="btn-ghost"
                  style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                  title={showVideoPreview ? "Ocultar prévia" : "Ver prévia do vídeo"}
                >
                  <Eye size={13} />
                  {showVideoPreview ? "Ocultar" : "Prévia"}
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscardVideo}
                disabled={isPending}
                className="btn-ghost"
                style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem", color: "#f87171" }}
                title="Remover vídeo gravado"
              >
                <Trash2 size={13} />
                Remover
              </button>
            </div>
          </div>

          {showVideoPreview && previewUrl && (
            <div
              style={{
                borderRadius: "6px",
                overflow: "hidden",
                background: "#000",
                maxHeight: "220px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <video
                src={previewUrl}
                controls
                style={{ width: "100%", maxHeight: "220px", objectFit: "contain" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {message && (
        <div
          className={`alert animate-fade-in ${message.type === "success" ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: "1rem" }}
        >
          {message.type === "success" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Linha 1: Título e Status lado a lado */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div>
            <label htmlFor="title">
              Título <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              className="input-dark"
              placeholder="Ex: Erro ao sincronizar API de faturamento"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="status">
              Status <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="status"
                name="status"
                className="input-dark"
                defaultValue="Realizado"
                disabled={isPending}
                style={{
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                  paddingRight: "2.5rem",
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: "absolute",
                  right: "0.875rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--text-muted)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Linha 2: Solicitante e Escritório / Cliente lado a lado */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div>
            <label htmlFor="requester">
              Solicitante <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="requester"
              name="requester"
              type="text"
              className="input-dark"
              placeholder="Nome de quem solicitou o suporte"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="clientOrOffice">
              Escritório / Cliente <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="clientOrOffice"
              name="clientOrOffice"
              type="text"
              className="input-dark"
              placeholder="Ex: Matriz SP / Filial RJ / Cliente X"
              required
              disabled={isPending}
            />
          </div>
        </div>

        {/* Descrição (antigo Problema relatado; ação realizada agora integrada) */}
        <div>
          <label htmlFor="reportedProblem">
            Descrição <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            id="reportedProblem"
            name="reportedProblem"
            className="input-dark"
            placeholder="Descreva a solicitação, incidente e ações tomadas..."
            rows={4}
            required
            disabled={isPending}
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {/* Seleção de Tag Mestre (Contexto / Plataforma) - OBRIGATÓRIA */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)", margin: 0 }}>
              Tag de Plataforma <span style={{ color: "#ef4444" }}>*</span>{" "}
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 400 }}>(obrigatório - selecione 1 tag)</span>
            </label>
            {selectedTagId && (
              <button
                type="button"
                onClick={() => setSelectedTagId(null)}
                className="btn-ghost"
                style={{ fontSize: "0.72rem", padding: "0.1rem 0.4rem", color: "var(--text-muted)" }}
              >
                Limpar seleção
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              background: "rgba(15, 23, 42, 0.5)",
              border: !selectedTagId && message?.type === "error" ? "1px solid rgba(239, 68, 68, 0.6)" : "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.75rem 0.875rem",
              minHeight: "48px",
              alignItems: "center",
            }}
          >
            {loadingTags ? (
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Carregando tags...</span>
            ) : tags.length === 0 ? (
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Nenhuma tag configurada. Acesse <strong>Configurações</strong> na barra lateral para cadastrar tags de plataforma.
              </span>
            ) : (
              tags.map((tag) => {
                const isSelected = selectedTagId === tag.id;
                const bg = isSelected ? hexToRgba(tag.color, 0.28) : hexToRgba(tag.color, 0.12);
                const border = isSelected ? `2px solid ${tag.color}` : `1px solid ${hexToRgba(tag.color, 0.35)}`;

                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => setSelectedTagId(isSelected ? null : tag.id)}
                    title={isSelected ? `Tag selecionada: ${tag.name} (clique para desmarcar)` : `Selecionar ${tag.name}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.3rem 0.7rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: tag.color,
                      backgroundColor: bg,
                      border: border,
                      boxShadow: isSelected ? `0 0 10px ${hexToRgba(tag.color, 0.4)}` : "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      lineHeight: 1.2,
                    }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                    <span>{tag.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Checklist: Ação Técnica / Implementação */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            background: "rgba(15, 23, 42, 0.5)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "0.875rem",
          }}
        >
          <button
            type="button"
            onClick={() => setTechnicalAction((prev) => !prev)}
            disabled={isPending}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 0.875rem",
              borderRadius: "6px",
              border: technicalAction
                ? `1px solid #f59e0b`
                : "1px solid rgba(245, 158, 11, 0.3)",
              background: technicalAction ? "rgba(245, 158, 11, 0.15)" : "transparent",
              color: technicalAction ? "#fbbf24" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            <Cog size={15} strokeWidth={2} />
            <span>Ação Técnica</span>
          </button>
          <button
            type="button"
            onClick={() => setImplementation((prev) => !prev)}
            disabled={isPending}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 0.875rem",
              borderRadius: "6px",
              border: implementation
                ? `1px solid #3b82f6`
                : "1px solid rgba(59, 130, 246, 0.3)",
              background: implementation ? "rgba(59, 130, 246, 0.15)" : "transparent",
              color: implementation ? "#60a5fa" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            <Lightbulb size={15} strokeWidth={2} />
            <span>Implementação</span>
          </button>
        </div>

        {/* Anexo de Mídia - Drag and Drop */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)", margin: 0 }}>
              Anexar Mídia <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 400 }}>(opcional)</span>
            </label>
            {mediaFiles.length > 0 && (
              <span style={{ fontSize: "0.75rem", color: "#818cf8", fontWeight: 600 }}>
                {mediaFiles.length} {mediaFiles.length === 1 ? "arquivo" : "arquivos"}
              </span>
            )}
          </div>

          {/* Input oculto acionado pelo clique na dropzone */}
          <input
            ref={fileInputRef}
            id="media"
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
            disabled={isPending}
            onChange={handleFileInputChange}
            style={{ display: "none" }}
          />

          {/* Área de Drop / Arrastar e Soltar */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "1.25rem 1rem",
              border: isDraggingOver
                ? "2px dashed #818cf8"
                : "1.5px dashed rgba(99, 102, 241, 0.35)",
              borderRadius: "8px",
              backgroundColor: isDraggingOver
                ? "rgba(99, 102, 241, 0.15)"
                : "rgba(15, 23, 42, 0.4)",
              boxShadow: isDraggingOver ? "0 0 16px rgba(99, 102, 241, 0.3)" : "none",
              cursor: isPending ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "0.5rem",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: isDraggingOver ? "rgba(99, 102, 241, 0.25)" : "rgba(99, 102, 241, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDraggingOver ? "#c7d2fe" : "#818cf8",
                transition: "all 0.2s ease",
              }}
            >
              <UploadCloud size={20} />
            </div>

            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                {isDraggingOver ? (
                  <span style={{ color: "#a5b4fc", fontWeight: 600 }}>Solte os arquivos aqui</span>
                ) : (
                  <>
                    Arraste e solte arquivos aqui ou{" "}
                    <span style={{ color: "#818cf8", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                      procure no dispositivo
                    </span>
                  </>
                )}
              </p>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0.25rem 0 0 0" }}>
                Imagens, documentos ou vídeos (até 100MB por arquivo)
              </p>
            </div>
          </div>

          {/* Lista de arquivos selecionados */}
          {mediaFiles.length > 0 && (
            <div style={{ marginTop: "0.625rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0.15rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Arquivos prontos para upload:
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMediaFiles([]);
                  }}
                  className="btn-ghost"
                  style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", color: "#f87171" }}
                >
                  Remover todos
                </button>
              </div>

              {mediaFiles.map((file, idx) => (
                <div
                  key={`${file.name}_${idx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.75rem",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
                    <Paperclip size={14} color="#818cf8" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-primary)",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
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
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "4px",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <X size={14} />
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
          className="btn-primary"
          disabled={isPending}
          style={{ width: "100%", justifyContent: "center", padding: "0.75rem", marginTop: "0.25rem" }}
        >
          {isPending ? (
            <>
              <div className="spinner" />
              Salvando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Salvar
            </>
          )}
        </button>
      </form>
    </div>
  );
}
