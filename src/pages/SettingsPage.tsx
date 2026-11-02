import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TagItem, api } from "@/services/api";
import TagBadge from "@/components/TagBadge";
import {
  Tag as TagIcon,
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  HelpCircle,
  Layers,
  X,
} from "lucide-react";

const PRESET_COLORS = [
  { label: "Azul", hex: "#3b82f6" },
  { label: "Âmbar / Laranja", hex: "#f59e0b" },
  { label: "Verde Esmeralda", hex: "#10b981" },
  { label: "Vermelho Coral", hex: "#ef4444" },
  { label: "Índigo", hex: "#6366f1" },
  { label: "Roxo", hex: "#8b5cf6" },
  { label: "Ciano", hex: "#06b6d4" },
  { label: "Rosa", hex: "#ec4899" },
  { label: "Ardósia", hex: "#64748b" },
];

export default function SettingsPage() {
  const [activeTab] = useState<"form_format">("form_format");
  const [tags, setTags] = useState<TagItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado para criação / edição de tag
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Estado para confirmação de exclusão
  const [deletingTag, setDeletingTag] = useState<TagItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.tags.getAll();
      setTags(data);
    } catch (err) {
      console.error("[SettingsPage] Erro ao carregar tags:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar tags do sistema.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingTag(null);
    setTagName("");
    setTagColor("#3b82f6");
    setModalError(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(tag: TagItem) {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || "#3b82f6");
    setModalError(null);
    setIsModalOpen(true);
  }

  async function handleSaveTag(e: React.FormEvent) {
    e.preventDefault();
    if (!tagName.trim()) {
      setModalError("Por favor, informe o nome da tag.");
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      if (editingTag) {
        await api.tags.update(editingTag.id, {
          name: tagName.trim(),
          color: tagColor,
        });
        setSuccessMessage(`Tag "${tagName.trim()}" atualizada com sucesso!`);
      } else {
        await api.tags.create({
          name: tagName.trim(),
          color: tagColor,
        });
        setSuccessMessage(`Tag "${tagName.trim()}" criada com sucesso!`);
      }

      setIsModalOpen(false);
      await fetchTags();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro ao salvar tag.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingTag) return;
    try {
      setIsDeleting(true);
      await api.tags.delete(deletingTag.id);
      setSuccessMessage(`Tag "${deletingTag.name}" removida com sucesso.`);
      setDeletingTag(null);
      await fetchTags();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao remover tag.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Header da Página (conforme vídeo Team & Workspace Settings) */}
      <header className="mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Configurações
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Personalize o formato dos formulários, tags de contexto e preferências operacionais.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 mt-6">
          <button
            type="button"
            className="flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 border-slate-900 dark:border-white text-slate-900 dark:text-white -mb-px transition-colors"
          >
            <Layers className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <span>Formato de Formulário</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ml-1">
              Tags Mestre
            </span>
          </button>
        </div>
      </header>

      {/* Alertas */}
      {successMessage && (
        <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 rounded-xl p-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fade-in shadow-2xs">
          <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 rounded-xl p-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fade-in shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Conteúdo da Aba: Formato de Formulário (Tags Mestre) */}
      <div className="flex flex-col gap-6">
        {/* Banner explicativo de contexto */}
        <div className="bg-slate-50/80 dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs mt-0.5">
            <HelpCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight mb-1">
              Tags Mestre para Contextualização de Plataformas
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              O sistema de tags adiciona contexto imediato aos atendimentos quando o atendente oferece suporte a mais de uma plataforma ou sistema.
              Cada chamado aceita <strong className="text-slate-900 dark:text-white font-semibold">apenas uma tag de plataforma</strong> por vez, garantindo organização clara e identificação instantânea da plataforma tratada.
            </p>
          </div>
        </div>

        {/* Gerenciamento das Tags */}
        <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {/* Top Bar da Seção de Tags */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs">
                <TagIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Tags Cadastradas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {tags.length} {tags.length === 1 ? "tag configurada" : "tags configuradas"} no workspace
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Tag</span>
            </button>
          </div>

          {/* Estado de Carregamento */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 dark:text-slate-400">
              <div className="w-7 h-7 border-2 border-slate-200 dark:border-slate-700 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Carregando tags...</span>
            </div>
          )}

          {/* Lista Vazia */}
          {!isLoading && tags.length === 0 && (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 mx-auto mb-3 shadow-2xs">
                <TagIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Nenhuma tag cadastrada ainda
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4 leading-relaxed">
                Crie tags para representar as plataformas ou sistemas aos quais sua equipe presta suporte (ex: Plataforma Web, Sistema ERP, App Mobile).
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Primeira Tag</span>
              </button>
            </div>
          )}

          {/* Grid / Tabela de Tags Cadastradas */}
          {!isLoading && tags.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tags.map((tag) => {
                const count = tag._count?.workLogs || 0;
                return (
                  <div
                    key={tag.id}
                    className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#161f33]/50 transition-colors"
                  >
                    {/* Tag badge & Color info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <TagBadge name={tag.name} color={tag.color} size="lg" />
                      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-200 dark:border-slate-700"
                          style={{ backgroundColor: tag.color }}
                        />
                        <code className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{tag.color}</code>
                      </div>
                    </div>

                    {/* Meta info & Actions */}
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white font-semibold">{count}</strong>{" "}
                        {count === 1 ? "atendimento" : "atendimentos"}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tag)}
                          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Editar tag"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTag(tag)}
                          className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Excluir tag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação / Edição de Tag */}
      {isModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isSubmitting && setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 max-w-lg w-full flex flex-col gap-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {editingTag ? "Editar Tag de Plataforma" : "Nova Tag de Plataforma"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Defina o nome da plataforma e a cor de destaque para categorização nos atendimentos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTag} className="flex flex-col gap-4">
              {/* Campo Nome da Tag */}
              <div>
                <label
                  htmlFor="tagName"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Nome da Tag / Plataforma <span className="text-rose-500">*</span>
                </label>
                <input
                  id="tagName"
                  type="text"
                  className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800"
                  placeholder="Ex: Plataforma Web, Sistema ERP, App Mobile..."
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  autoFocus
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Campo Cor da Tag */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Cor de Destaque
                </label>

                {/* Cores pré-definidas */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((preset) => {
                    const isSelected = tagColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setTagColor(preset.hex)}
                        title={preset.label}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all cursor-pointer ${
                          isSelected
                            ? "ring-2 ring-slate-900 dark:ring-white ring-offset-2 dark:ring-offset-slate-900 scale-110 shadow-xs"
                            : "hover:scale-105 border border-black/10 shadow-2xs"
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Seletor Customizado */}
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b0f19] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="w-28 bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs uppercase font-mono shadow-xs outline-none"
                  />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Hexadecimal personalizado
                  </span>
                </div>
              </div>

              {/* Pré-visualização da Tag */}
              <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Prévia da Tag:
                </span>
                <div className="flex items-center gap-3">
                  <TagBadge name={tagName.trim() || "Nome da Tag"} color={tagColor} size="lg" />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Exibição com dot colorido e badge translúcido
                  </span>
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2.5 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-xl px-5 py-2.5 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : editingTag ? (
                    "Atualizar Tag"
                  ) : (
                    "Criar Tag"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingTag && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isDeleting && setDeletingTag(null)}
        >
          <div
            className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full flex flex-col gap-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Remover Tag de Plataforma
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Deseja realmente excluir a tag <strong className="text-slate-900 dark:text-white">{deletingTag.name}</strong>?
            </p>

            {deletingTag._count && deletingTag._count.workLogs > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-300 leading-snug">
                ⚠️ Esta tag está atualmente vinculada a <strong>{deletingTag._count.workLogs}</strong> atendimento(s).
                Ao remover, os formulários existentes permanecerão salvos, apenas com o campo de tag desvinculado.
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingTag(null)}
                disabled={isDeleting}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  "Confirmar Exclusão"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
