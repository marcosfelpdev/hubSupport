import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, Smartphone, X } from "lucide-react";
import type { PhoneCardItem } from "../../services/api";

export interface PhoneCardFormModalProps {
  open: boolean;
  editingCard: PhoneCardItem | null;
  saving: boolean;
  error: string | null;
  onSubmit: (values: { name: string; description: string }) => void | Promise<void>;
  onClose: () => void;
}

export default function PhoneCardFormModal({
  open,
  editingCard,
  saving,
  error,
  onSubmit,
  onClose,
}: PhoneCardFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editingCard?.name ?? "");
      setDescription(editingCard?.description ?? "");
      setValidationError(null);
    }
  }, [open, editingCard]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const isEditing = Boolean(editingCard);
  const displayedError = validationError || error;

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("Informe um nome válido para o card.");
      return;
    }

    setValidationError(null);
    onSubmit({
      name: trimmedName,
      description: description.trim(),
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-card-form-title"
        className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-7 max-w-md w-full animate-scale-in flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-accent dark:bg-white text-brand-accent-foreground dark:text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="phone-card-form-title"
                className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
              >
                {isEditing ? "Editar Card" : "Novo Card"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isEditing
                  ? "Atualize a identificação deste aparelho."
                  : "Cadastre um card para parear e localizar um celular."}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Fechar modal"
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inline error */}
        {displayedError && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{displayedError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label
              htmlFor="phone-card-name-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Nome do Card <span className="text-rose-500">*</span>
            </label>
            <input
              id="phone-card-name-input"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              maxLength={120}
              disabled={saving}
              placeholder="Ex: Celular Bancada 01"
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="phone-card-description-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Descrição{" "}
              <span className="text-xs text-slate-400 normal-case font-normal">
                (Opcional)
              </span>
            </label>
            <textarea
              id="phone-card-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              disabled={saving}
              placeholder="Ex: Samsung Galaxy A54 — uso do suporte técnico"
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none resize-none disabled:opacity-60"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-brand-accent dark:bg-white hover:bg-brand-accent-hover dark:hover:bg-slate-100 text-brand-accent-foreground dark:text-slate-900 font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>{isEditing ? "Salvar Alterações" : "Criar Card"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
