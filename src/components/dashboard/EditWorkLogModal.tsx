import React, { useState, useEffect } from "react";
import { X, Check, Loader2, Edit3 } from "lucide-react";
import { WorkLogItem, api } from "@/services/api";

interface EditWorkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  workLog: {
    id: string;
    title?: string | null;
    requester: string;
    clientOrOffice: string;
    reportedProblem: string;
    actionTaken?: string | null;
    [key: string]: any;
  };
  onSaveSuccess: (updated: WorkLogItem) => void;
}

export const EditWorkLogModal: React.FC<EditWorkLogModalProps> = ({
  isOpen,
  onClose,
  workLog,
  onSaveSuccess,
}) => {
  const [title, setTitle] = useState(workLog.title || "");
  const [requester, setRequester] = useState(workLog.requester || "");
  const [clientOrOffice, setClientOrOffice] = useState(workLog.clientOrOffice || "");
  const [reportedProblem, setReportedProblem] = useState(workLog.reportedProblem || "");
  const [actionTaken, setActionTaken] = useState(workLog.actionTaken || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(workLog.title || "");
      setRequester(workLog.requester || "");
      setClientOrOffice(workLog.clientOrOffice || "");
      setReportedProblem(workLog.reportedProblem || "");
      setActionTaken(workLog.actionTaken || "");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, workLog]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !requester.trim() || !clientOrOffice.trim() || !reportedProblem.trim()) {
      setErrorMessage("Por favor, preencha todos os campos obrigatórios (título, solicitante, cliente e descrição).");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await api.worklogs.update(workLog.id, {
        title: title.trim(),
        requester: requester.trim(),
        clientOrOffice: clientOrOffice.trim(),
        reportedProblem: reportedProblem.trim(),
        actionTaken: actionTaken.trim(),
      });

      if (res.success && res.workLog) {
        onSaveSuccess(res.workLog);
        onClose();
      } else {
        setErrorMessage("Não foi possível salvar as alterações.");
      }
    } catch (err) {
      console.error("Erro ao atualizar atendimento:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao atualizar atendimento."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-filter-bg dark:bg-sky-950/50 text-brand-action-sky dark:text-sky-400 border border-brand-filter-border dark:border-sky-800/80 flex items-center justify-center shrink-0 shadow-2xs">
              <Edit3 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Editar Relatório / Atendimento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Altere os dados do atendimento. A alteração ficará documentada no histórico.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Título do Atendimento <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-focus-sky dark:focus:border-sky-500 focus:ring-1 focus:ring-brand-focus-sky dark:focus:ring-sky-500 transition-all shadow-xs"
              placeholder="Ex: Ajuste de prompt do assistente"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Solicitante <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-focus-sky dark:focus:border-sky-500 focus:ring-1 focus:ring-brand-focus-sky dark:focus:ring-sky-500 transition-all shadow-xs"
                placeholder="Nome da pessoa"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Cliente / Escritório <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={clientOrOffice}
                onChange={(e) => setClientOrOffice(e.target.value)}
                className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-focus-sky dark:focus:border-sky-500 focus:ring-1 focus:ring-brand-focus-sky dark:focus:ring-sky-500 transition-all shadow-xs"
                placeholder="Empresa ou departamento"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Descrição / Problema Relatado <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={reportedProblem}
              onChange={(e) => setReportedProblem(e.target.value)}
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-focus-sky dark:focus:border-sky-500 focus:ring-1 focus:ring-brand-focus-sky dark:focus:ring-sky-500 transition-all shadow-xs resize-none"
              placeholder="Detalhes do problema ou demanda..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Ação Realizada / Solução Técnica
            </label>
            <textarea
              rows={3}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-focus-sky dark:focus:border-sky-500 focus:ring-1 focus:ring-brand-focus-sky dark:focus:ring-sky-500 transition-all shadow-xs resize-none"
              placeholder="Descreva a solução aplicada ou desenvolvida..."
            />
          </div>

          {/* Rodapé de Ações */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-action-sky hover:bg-brand-action-sky-hover dark:bg-sky-600 dark:hover:bg-sky-500 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="shrink-0" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWorkLogModal;
