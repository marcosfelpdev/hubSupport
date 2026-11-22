import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TagItem, WorkLogCategoryItem, api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import TagBadge from "@/components/TagBadge";
import CategoryIconPicker, { getCategoryIconComponent } from "@/components/CategoryIconPicker";
import ThemeSettingsSection from "@/components/settings/ThemeSettingsSection";
import {
  Tag as TagIcon,
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  HelpCircle,
  Layers,
  LayoutGrid,
  X,
  Bell,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sliders,
  Palette,
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
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<"appearance" | "tags" | "categories">("appearance");
  const [tags, setTags] = useState<TagItem[]>([]);
  const [categories, setCategories] = useState<WorkLogCategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado para criação / edição de tag
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Estado para confirmação de exclusão de tag
  const [deletingTag, setDeletingTag] = useState<TagItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado para criação / edição de categoria
  const [editingCategory, setEditingCategory] = useState<WorkLogCategoryItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSubtitle, setCatSubtitle] = useState("");
  const [catIcon, setCatIcon] = useState("cog");
  const [catColor, setCatColor] = useState("#3b82f6");
  const [catNotifyRole, setCatNotifyRole] = useState("TECHNICIAN");
  const [catTargetKanban, setCatTargetKanban] = useState(true);
  const [catLockStatus, setCatLockStatus] = useState(true);
  const [catTargetStatus, setCatTargetStatus] = useState("Backlog");
  const [catActive, setCatActive] = useState(true);
  const [catOrder, setCatOrder] = useState(1);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);

  // Estado para confirmação de exclusão de categoria
  const [deletingCategory, setDeletingCategory] = useState<WorkLogCategoryItem | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  useEffect(() => {
    fetchTags();
    if (isAdmin) {
      fetchCategories();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && activeTab === "categories") {
      setActiveTab("appearance");
    }
  }, [isAdmin, activeTab]);

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

  async function fetchCategories() {
    try {
      setIsCategoriesLoading(true);
      setError(null);
      const data = await api.categories.getAll(true);
      setCategories(data);
    } catch (err) {
      console.error("[SettingsPage] Erro ao carregar categorias:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar categorias de atendimento.");
    } finally {
      setIsCategoriesLoading(false);
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

  function handleOpenCreateCategory() {
    setEditingCategory(null);
    setCatName("");
    setCatSubtitle("");
    setCatIcon("cog");
    setCatColor("#3b82f6");
    setCatNotifyRole("TECHNICIAN");
    setCatTargetKanban(true);
    setCatLockStatus(true);
    setCatTargetStatus("Backlog");
    setCatActive(true);
    setCatOrder(categories.length + 1);
    setCategoryModalError(null);
    setIsCategoryModalOpen(true);
  }

  function handleOpenEditCategory(cat: WorkLogCategoryItem) {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSubtitle(cat.subtitle || "");
    setCatIcon(cat.icon || "cog");
    setCatColor(cat.color || "#3b82f6");
    setCatNotifyRole(cat.notifyRole || "");
    setCatTargetKanban(Boolean(cat.targetKanban));
    setCatLockStatus(Boolean(cat.lockStatus));
    setCatTargetStatus(cat.targetStatus || "Backlog");
    setCatActive(cat.active !== false);
    setCatOrder(cat.order || 0);
    setCategoryModalError(null);
    setIsCategoryModalOpen(true);
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) {
      setCategoryModalError("Por favor, informe o nome da categoria.");
      return;
    }

    try {
      setIsSubmittingCategory(true);
      setCategoryModalError(null);

      const payload = {
        name: catName.trim(),
        subtitle: catSubtitle.trim() || null,
        icon: catIcon,
        color: catColor,
        notifyRole: catNotifyRole || null,
        targetKanban: catTargetKanban,
        lockStatus: catLockStatus,
        targetStatus: catLockStatus ? catTargetStatus.trim() || "Backlog" : null,
        active: catActive,
        order: Number(catOrder) || 0,
      };

      if (editingCategory) {
        await api.categories.update(editingCategory.id, payload);
        setSuccessMessage(`Categoria "${catName.trim()}" atualizada com sucesso!`);
      } else {
        await api.categories.create(payload);
        setSuccessMessage(`Categoria "${catName.trim()}" criada com sucesso!`);
      }

      setIsCategoryModalOpen(false);
      await fetchCategories();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err) {
      console.error("[SettingsPage] Erro ao salvar categoria:", err);
      setCategoryModalError(err instanceof Error ? err.message : "Erro ao salvar categoria.");
    } finally {
      setIsSubmittingCategory(false);
    }
  }

  async function handleConfirmDeleteCategory() {
    if (!deletingCategory) return;
    try {
      setIsDeletingCategory(true);
      await api.categories.delete(deletingCategory.id);
      setSuccessMessage(`Categoria "${deletingCategory.name}" removida com sucesso.`);
      setDeletingCategory(null);
      await fetchCategories();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao remover categoria.");
    } finally {
      setIsDeletingCategory(false);
    }
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Header da Página */}
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
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === "appearance"
                ? "border-brand-accent text-brand-accent dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Aparência</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ml-1">
              Temas
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tags")}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === "tags"
                ? "border-brand-accent text-brand-accent dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Formato de Formulário</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ml-1">
              Tags Mestre
            </span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                activeTab === "categories"
                  ? "border-brand-accent text-brand-accent dark:border-white dark:text-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Categorias de Atendimento</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ml-1">
                Admin
              </span>
            </button>
          )}
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

      {/* Conteúdo da Aba: Aparência */}
      {activeTab === "appearance" && <ThemeSettingsSection />}

      {/* Conteúdo da Aba: Formato de Formulário (Tags Mestre) */}
      {activeTab === "tags" && (
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
                className="bg-brand-accent dark:bg-slate-800 hover:bg-brand-accent-hover dark:hover:bg-slate-700 text-brand-accent-foreground dark:text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Tag</span>
              </button>
            </div>

            {/* Estado de Carregamento */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 dark:text-slate-400">
                <div className="w-7 h-7 border-2 border-slate-200 dark:border-slate-700 border-t-brand-accent dark:border-t-slate-200 rounded-full animate-spin" />
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
                  className="bg-brand-accent dark:bg-slate-800 hover:bg-brand-accent-hover dark:hover:bg-slate-700 text-brand-accent-foreground dark:text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
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
      )}

      {/* Conteúdo da Aba: Categorias de Atendimento (Apenas Admin) */}
      {activeTab === "categories" && isAdmin && (
        <div className="flex flex-col gap-6">
          {/* Banner explicativo */}
          <div className="bg-slate-50/80 dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs mt-0.5">
              <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight mb-1">
                Categorias de Atendimento e Tipos de Demanda
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Configure os tipos de atendimento que sua equipe pode selecionar ao abrir um chamado. Cada categoria pode ter seu próprio ícone, cor, função notificada automaticamente (ex: Técnicos), trava de status inicial (como &quot;Backlog&quot;) e direcionamento para o Kanban. O formulário opera em seleção única (comutador rádio).
              </p>
            </div>
          </div>

          {/* Gerenciamento das Categorias */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Top Bar da Seção de Categorias */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs">
                  <LayoutGrid className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Categorias Cadastradas
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {categories.length} {categories.length === 1 ? "categoria ativa/configurada" : "categorias ativas/configuradas"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateCategory}
                className="bg-brand-action-blue hover:bg-brand-action-blue-hover dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Categoria</span>
              </button>
            </div>

            {/* Estado de Carregamento */}
            {isCategoriesLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 dark:text-slate-400">
                <div className="w-7 h-7 border-2 border-slate-200 dark:border-slate-700 border-t-brand-action-blue dark:border-t-blue-400 rounded-full animate-spin" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Carregando categorias...</span>
              </div>
            )}

            {/* Lista Vazia */}
            {!isCategoriesLoading && categories.length === 0 && (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 mx-auto mb-3 shadow-2xs">
                  <LayoutGrid className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  Nenhuma categoria cadastrada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4 leading-relaxed">
                  Crie sua primeira categoria de atendimento (ex: Ação Técnica, Prompt, Ideia, Suporte N2).
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateCategory}
                  className="bg-brand-action-blue hover:bg-brand-action-blue-hover dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Primeira Categoria</span>
                </button>
              </div>
            )}

            {/* Grade / Tabela de Categorias */}
            {!isCategoriesLoading && categories.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.map((cat) => {
                  const IconComp = getCategoryIconComponent(cat.icon);
                  const count = cat._count?.workLogs || 0;

                  return (
                    <div
                      key={cat.id}
                      className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#161f33]/50 transition-colors"
                    >
                      {/* Card Preview & Meta */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            borderColor: `${cat.color}40`,
                            color: cat.color,
                          }}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {cat.name}
                            </span>
                            {!cat.active && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                                <EyeOff className="w-3 h-3" /> Inativa
                              </span>
                            )}
                          </div>
                          {cat.subtitle && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {cat.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Configurações da Categoria */}
                      <div className="flex items-center gap-3 sm:gap-5 shrink-0 flex-wrap justify-end">
                        {/* Notificação */}
                        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Bell className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {cat.notifyRole
                              ? cat.notifyRole === "TECHNICIAN"
                                ? "Técnicos"
                                : cat.notifyRole === "ADMIN"
                                ? "Admins"
                                : cat.notifyRole === "MANAGER"
                                ? "Gestores"
                                : cat.notifyRole
                              : "Sem notificação"}
                          </span>
                        </div>

                        {/* Trava de Status */}
                        <div className="hidden lg:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          {cat.lockStatus ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-medium text-[11px]">
                              <Lock className="w-3 h-3" /> Fixo em {cat.targetStatus || "Backlog"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                              <Unlock className="w-3 h-3" /> Status Livre
                            </span>
                          )}
                        </div>

                        {/* Contagem de Chamados */}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-white font-semibold">{count}</strong>{" "}
                          {count === 1 ? "chamado" : "chamados"}
                        </span>

                        {/* Ações */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCategory(cat)}
                            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Editar categoria"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCategory(cat)}
                            className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Excluir categoria"
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
      )}

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
                  className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800"
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
                    className="w-28 bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-brand-focus-border dark:focus:border-slate-400 focus:ring-1 focus:ring-brand-focus-ring dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs uppercase font-mono shadow-xs outline-none"
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
                  className="bg-brand-accent dark:bg-slate-800 hover:bg-brand-accent-hover dark:hover:bg-slate-700 text-brand-accent-foreground dark:text-white font-semibold rounded-xl px-5 py-2.5 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
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
                className="bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700 text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
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

      {/* Modal de Criação / Edição de Categoria */}
      {isCategoryModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isSubmittingCategory && setIsCategoryModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 max-w-xl w-full flex flex-col gap-5 max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {editingCategory ? "Editar Categoria de Atendimento" : "Nova Categoria de Atendimento"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Personalize nome, subtítulo, ícone, cor e regras de fluxo do chamado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingCategory && setIsCategoryModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {categoryModalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{categoryModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
              {/* Preview do Card */}
              <div className="p-3 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Prévia no Formulário (Grade 2 Colunas)
                </span>
                <div
                  className="flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all"
                  style={{
                    backgroundColor: `${catColor}10`,
                    borderColor: `${catColor}50`,
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${catColor}20`,
                        borderColor: `${catColor}40`,
                        color: catColor,
                      }}
                    >
                      {React.createElement(getCategoryIconComponent(catIcon), { className: "w-4 h-4" })}
                    </div>
                    <div className="text-left min-w-0">
                      <span className="block font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {catName.trim() || "Nome da Categoria"}
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {catSubtitle.trim() || "Subtítulo explicativo"}
                      </span>
                    </div>
                  </div>
                  <div
                    className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 text-white"
                    style={{
                      backgroundColor: catColor,
                      borderColor: catColor,
                    }}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              </div>

              {/* Nome & Subtítulo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nome da Categoria *
                  </label>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Ex: Ação Técnica, Prompt, Infra"
                    className="w-full text-xs sm:text-sm bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-focus-blue dark:focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Subtítulo do Card
                  </label>
                  <input
                    type="text"
                    value={catSubtitle}
                    onChange={(e) => setCatSubtitle(e.target.value)}
                    placeholder="Ex: Demanda técnica / dev"
                    className="w-full text-xs sm:text-sm bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-focus-blue dark:focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Seletor de Ícone */}
              <CategoryIconPicker
                selectedIcon={catIcon}
                onSelect={(k) => setCatIcon(k)}
                accentColor={catColor}
              />

              {/* Seletor de Cor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Cor Temática
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {PRESET_COLORS.map((preset) => {
                    const isSelected = catColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setCatColor(preset.hex)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-900 dark:ring-white"
                            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Automação: Função a Notificar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notificar Função ao Criar Atendimento
                </label>
                <select
                  value={catNotifyRole}
                  onChange={(e) => setCatNotifyRole(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-focus-blue dark:focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Nenhuma notificação automática</option>
                  <option value="TECHNICIAN">Técnicos (TECHNICIAN)</option>
                  <option value="ADMIN">Administradores (ADMIN)</option>
                  <option value="MANAGER">Gestores (MANAGER)</option>
                  <option value="USER">Colaboradores (USER)</option>
                </select>
              </div>

              {/* Switches de Fluxo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0b0f19]/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catTargetKanban}
                    onChange={(e) => setCatTargetKanban(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-brand-action-blue text-brand-action-blue focus:ring-brand-focus-blue dark:accent-blue-600 dark:text-blue-600 dark:focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                      Exibir no Kanban Técnico
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      Direciona chamados desta categoria para o quadro técnico.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0b0f19]/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catLockStatus}
                    onChange={(e) => setCatLockStatus(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-brand-action-blue text-brand-action-blue focus:ring-brand-focus-blue dark:accent-blue-600 dark:text-blue-600 dark:focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                      Travar Status Inicial
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      Impede escolha de status livre no formulário.
                    </span>
                  </div>
                </label>
              </div>

              {/* Status Forçado quando lockStatus for true */}
              {catLockStatus && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Status Obrigatório Fixado
                  </label>
                  <input
                    type="text"
                    value={catTargetStatus}
                    onChange={(e) => setCatTargetStatus(e.target.value)}
                    placeholder="Backlog"
                    className="w-full text-xs sm:text-sm bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-focus-blue dark:focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Ativo no formulário */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0b0f19]/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catActive}
                  onChange={(e) => setCatActive(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-action-blue text-brand-action-blue focus:ring-brand-focus-blue dark:accent-blue-600 dark:text-blue-600 dark:focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Categoria ativa e visível no formulário de atendimento
                </span>
              </label>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={isSubmittingCategory}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCategory}
                  className="bg-brand-action-blue hover:bg-brand-action-blue-hover dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-xl px-5 py-2 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmittingCategory ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : editingCategory ? (
                    "Atualizar Categoria"
                  ) : (
                    "Criar Categoria"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmação de Exclusão de Categoria */}
      {deletingCategory && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isDeletingCategory && setDeletingCategory(null)}
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
                  Remover Categoria de Atendimento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Deseja realmente excluir a categoria <strong className="text-slate-900 dark:text-white">{deletingCategory.name}</strong>?
            </p>

            {deletingCategory._count && deletingCategory._count.workLogs > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-300 leading-snug">
                ⚠️ Esta categoria está vinculada a <strong>{deletingCategory._count.workLogs}</strong> atendimento(s).
                Ao remover, os atendimentos existentes serão preservados, com o vínculo desassociado de forma segura.
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                disabled={isDeletingCategory}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                disabled={isDeletingCategory}
                className="bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700 text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isDeletingCategory ? (
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
