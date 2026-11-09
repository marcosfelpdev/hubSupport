import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Building2,
  UploadCloud,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  FileText,
} from "lucide-react";
import { api, AgendaEventItem } from "../../services/api";

export interface MeetingCompletionModalProps {
  event: AgendaEventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (updatedEvent: AgendaEventItem) => void;
}

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateValue?: string): string {
  if (!dateValue) return "—";
  try {
    const parts = dateValue.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  } catch {}
  return dateValue;
}

export const MeetingCompletionModal: React.FC<MeetingCompletionModalProps> = ({
  event,
  isOpen,
  onClose,
  onCompleted,
}) => {
  const [notes, setNotes] = useState<string>("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && event) {
      setNotes(event.notes || "");
      setMediaFiles([]);
      setIsDraggingOver(false);
      setErrorMessage(null);
      setIsSubmitting(false);

      // Trava scroll do body
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Foco inicial no textarea
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 80);

      return () => {
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
      };
    }
  }, [isOpen, event]);

  // Tecla Escape para fechar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !event) return null;

  function addFiles(newFiles: File[]) {
    const oversizedFiles = newFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      setErrorMessage(
        `O arquivo "${oversizedFiles[0].name}" (${formatBytes(
          oversizedFiles[0].size
        )}) excede o limite máximo permitido de 1GB.`
      );
      return;
    }

    setErrorMessage(null);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }
      mediaFiles.forEach((file) => {
        formData.append("media", file);
      });

      const res = await api.agenda.completeWithNotes(event.id, formData);
      if (res && res.success && res.event) {
        onCompleted(res.event);
        onClose();
      } else {
        throw new Error("Não foi possível confirmar a conclusão da reunião.");
      }
    } catch (err) {
      console.error("[MeetingCompletionModal] Erro ao concluir reunião:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Erro ao salvar ata da reunião. Verifique a conexão e tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const responsibleName = event.employee?.name || event.createdBy?.name || null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-completion-title"
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= HEADER DO MODAL ================= */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0c101b]/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Concluir Compromisso
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Registro de Ata & Evidências
                  </span>
                </div>
                <h3
                  id="modal-completion-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug"
                >
                  Concluir Reunião & Registrar Ata
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
              title="Fechar janela (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Destaque do Título da Reunião */}
          <div className="mt-3.5 p-3 rounded-xl bg-white dark:bg-[#161f33] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 break-words line-clamp-2">
              {event.title}
            </div>

            {/* Chips de contexto */}
            <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md font-medium text-slate-700 dark:text-slate-300">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{formatDate(event.date)}</span>
              </span>

              {event.time && (
                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md font-medium text-slate-700 dark:text-slate-300">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{event.time}</span>
                </span>
              )}

              {event.category && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded-md font-medium">
                  <Tag className="w-3 h-3 text-indigo-500" />
                  <span>{event.category}</span>
                </span>
              )}

              {event.client && (
                <span
                  className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 px-2 py-0.5 rounded-md font-medium"
                  title={`Cliente: ${event.client.name}`}
                >
                  <Building2 className="w-3 h-3 text-blue-500" />
                  <span className="truncate max-w-[140px]">{event.client.name}</span>
                </span>
              )}

              {responsibleName && (
                <span
                  className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md font-medium text-slate-700 dark:text-slate-300"
                  title={`Responsável: ${responsibleName}`}
                >
                  <User className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[130px]">{responsibleName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ================= FORMULÁRIO DO MODAL ================= */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 flex flex-col gap-5">
          {/* Mensagem de Erro se houver */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-fade-in shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold block">Não foi possível concluir:</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Campo 1: Textarea da Ata da Reunião */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="meeting-notes"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Ata da Reunião / Relatório de Alinhamento</span>
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Opcional / Recomendado
              </span>
            </div>

            <textarea
              id="meeting-notes"
              ref={textareaRef}
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="O que foi realizado durante a reunião? Descreva os tópicos abordados, decisões tomadas e alinhamentos..."
              className="w-full px-3.5 py-3 text-xs sm:text-sm bg-slate-50/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-300 focus:bg-white dark:focus:bg-[#111726] focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-300 transition-all resize-y min-h-[120px]"
            />
          </div>

          {/* Campo 2: Anexar Mídias - Idêntico ao WorkLogForm */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Anexar Mídias / Documentos{" "}
                <span className="text-slate-400 dark:text-slate-500 lowercase font-normal">
                  (opcional)
                </span>
              </label>
              {mediaFiles.length > 0 && (
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {mediaFiles.length}{" "}
                  {mediaFiles.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              id="meeting-media"
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              disabled={isSubmitting}
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
              } ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-2xs ${
                  isDraggingOver
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <UploadCloud className="w-5 h-5" />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {isDraggingOver ? (
                    <span className="text-slate-900 dark:text-white font-semibold">
                      Solte os arquivos para anexar
                    </span>
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
                  Imagens, vídeos, PDFs ou documentos (até 1GB por arquivo)
                </p>
              </div>
            </div>

            {/* Lista de arquivos selecionados */}
            {mediaFiles.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Arquivos prontos para envio:
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMediaFiles([]);
                    }}
                    className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    Remover todos
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {mediaFiles.map((file, idx) => (
                    <div
                      key={`${file.name}_${idx}`}
                      className="bg-white dark:bg-[#161f33] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Paperclip className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
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
                        disabled={isSubmitting}
                        title="Remover este arquivo"
                        className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= RODAPÉ DE AÇÕES ================= */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando ata...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Concluir e Salvar Ata</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingCompletionModal;
