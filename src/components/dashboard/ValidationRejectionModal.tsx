import React, { useState, useEffect } from "react";
import { AlertTriangle, X, Check, Loader2 } from "lucide-react";

interface ValidationRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  targetColumnTitle: string;
  cardTitle?: string;
}

export const ValidationRejectionModal: React.FC<ValidationRejectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetColumnTitle,
  cardTitle,
}) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason || cleanReason.length < 3) {
      setErrorMessage("Por favor, informe uma justificativa válida com pelo menos 3 caracteres.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirm(cleanReason);
      onClose();
    } catch (err) {
      console.error("Erro ao registrar motivo da reprovação:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao registrar o motivo da reprovação."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between p-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Justificar Reprovação da Validação
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Retornando chamado para <strong>{targetColumnTitle}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Cancelar e manter em validação"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {cardTitle && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                Atendimento:
              </span>
              <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{cardTitle}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Motivo da reprovação <span className="text-rose-500">* (obrigatório)</span>
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Descreva detalhadamente o que impediu a aprovação da solução para que o responsável saiba exatamente o que corrigir..."
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-xs resize-none"
              autoFocus
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Esta nota ficará anexada permanentemente ao histórico do chamado como justificativa da recusa.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Rodapé com Ações */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar (Manter na Validação)
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  <span>Salvando nota...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="shrink-0" />
                  <span>Confirmar Reprovação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ValidationRejectionModal;
