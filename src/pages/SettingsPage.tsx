import React, { useEffect, useState } from "react";
import { TagItem, api } from "@/services/api";
import TagBadge, { hexToRgba } from "@/components/TagBadge";
import {
  Settings,
  Tag as TagIcon,
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  Layers,
  HelpCircle,
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
    <main
      className="animate-fade-in"
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "2rem 2.5rem",
        width: "100%",
      }}
    >
      {/* Header da Página */}
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(129, 140, 248, 0.1))",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#818cf8",
            }}
          >
            <Settings size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Configurações
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Personalize o formato dos formulários, tags de contexto e preferências operacionais.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            borderBottom: "1px solid var(--border)",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            className="btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.25rem",
              borderBottom: activeTab === "form_format" ? "2px solid #6366f1" : "2px solid transparent",
              borderRadius: "0",
              color: activeTab === "form_format" ? "#ffffff" : "var(--text-secondary)",
              fontWeight: activeTab === "form_format" ? 600 : 500,
              fontSize: "0.875rem",
              backgroundColor: "transparent",
            }}
          >
            <Layers size={16} color={activeTab === "form_format" ? "#818cf8" : "currentColor"} />
            Formato de Formulário
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                backgroundColor: "rgba(99, 102, 241, 0.15)",
                color: "#818cf8",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                marginLeft: "0.25rem",
              }}
            >
              Tags Mestre
            </span>
          </button>
        </div>
      </header>

      {/* Alertas */}
      {successMessage && (
        <div
          className="alert alert-success animate-fade-in"
          style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Check size={18} />
          {successMessage}
        </div>
      )}

      {error && (
        <div
          className="alert alert-error animate-fade-in"
          style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Conteúdo da Aba: Formato de Formulário (Tags Mestre) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        {/* Banner explicativo de contexto */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#818cf8",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            <HelpCircle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              Tags Mestre para Contextualização de Plataformas
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              O sistema de tags adiciona contexto imediato aos atendimentos quando o atendente oferece suporte a mais de uma plataforma ou sistema.
              Cada chamado aceita <strong>apenas uma tag pai</strong> por vez, garantindo organização clara e identificação instantânea da plataforma tratada.
            </p>
          </div>
        </div>

        {/* Gerenciamento das Tags */}
        <div
          className="card"
          style={{
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Top Bar da Seção de Tags */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(99, 102, 241, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#818cf8",
                }}
              >
                <TagIcon size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                  Tags Cadastradas
                </h2>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                  {tags.length} {tags.length === 1 ? "tag configurada" : "tags configuradas"} no sistema
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.85rem",
                padding: "0.55rem 1rem",
              }}
            >
              <Plus size={16} />
              Nova Tag de Plataforma
            </button>
          </div>

          {/* Estado de Carregamento */}
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem", gap: "0.75rem" }}>
              <div className="spinner" style={{ width: "28px", height: "28px" }} />
              <span style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>Carregando tags...</span>
            </div>
          )}

          {/* Lista Vazia */}
          {!isLoading && tags.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "3.5rem 1.5rem",
                border: "1px dashed var(--border)",
                borderRadius: "8px",
                background: "rgba(15, 23, 42, 0.3)",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "rgba(99, 102, 241, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#818cf8",
                  margin: "0 auto 1rem",
                }}
              >
                <TagIcon size={24} />
              </div>
              <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                Nenhuma tag cadastrada ainda
              </p>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 1.25rem" }}>
                Crie tags para representar as plataformas ou sistemas aos quais sua equipe presta suporte (ex: Plataforma Web, Sistema ERP, App Mobile).
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn btn-primary"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
              >
                <Plus size={15} style={{ marginRight: "0.35rem" }} />
                Cadastrar Primeira Tag
              </button>
            </div>
          )}

          {/* Grid / Tabela de Tags Cadastradas */}
          {!isLoading && tags.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "1rem",
              }}
            >
              {tags.map((tag) => {
                const count = tag._count?.workLogs || 0;
                return (
                  <div
                    key={tag.id}
                    style={{
                      backgroundColor: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "1rem 1.15rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.875rem",
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    {/* Linha Superior: Visual Badge e Ações */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <TagBadge name={tag.name} color={tag.color} size="lg" />

                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tag)}
                          className="btn-ghost"
                          title="Editar tag"
                          style={{
                            padding: "0.35rem",
                            borderRadius: "6px",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTag(tag)}
                          className="btn-ghost"
                          title="Excluir tag"
                          style={{
                            padding: "0.35rem",
                            borderRadius: "6px",
                            color: "#f87171",
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Linha Inferior: Metadados (Cor e Total de Atendimentos) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                        paddingTop: "0.625rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: tag.color,
                            display: "inline-block",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                          }}
                        />
                        <code style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{tag.color}</code>
                      </div>

                      <span>
                        <strong style={{ color: "var(--text-primary)" }}>{count}</strong>{" "}
                        {count === 1 ? "atendimento" : "atendimentos"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação / Edição de Tag */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={() => !isSubmitting && setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderRadius: "0.875rem",
              width: "100%",
              maxWidth: "500px",
              padding: "1.75rem",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                {editingTag ? "Editar Tag de Plataforma" : "Nova Tag de Plataforma"}
              </h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                Defina o nome da plataforma e a cor de destaque que será exibida no formulário e relatórios.
              </p>
            </div>

            {modalError && (
              <div
                className="alert alert-error"
                style={{ fontSize: "0.825rem", padding: "0.625rem 0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <AlertCircle size={16} />
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveTag} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Campo Nome da Tag */}
              <div>
                <label htmlFor="tagName" style={{ display: "block", fontSize: "0.825rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
                  Nome da Tag / Plataforma <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="tagName"
                  type="text"
                  className="input-dark"
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
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                  Cor de Destaque
                </label>

                {/* Cores pré-definidas */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  {PRESET_COLORS.map((preset) => {
                    const isSelected = tagColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setTagColor(preset.hex)}
                        title={preset.label}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          backgroundColor: preset.hex,
                          border: isSelected ? "2.5px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.2)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          boxShadow: isSelected ? `0 0 10px ${preset.hex}` : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isSelected && <Check size={16} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>

                {/* Seletor Customizado */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    style={{
                      width: "42px",
                      height: "36px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      padding: "2px",
                    }}
                  />
                  <input
                    type="text"
                    className="input-dark"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    placeholder="#3b82f6"
                    style={{ maxWidth: "120px", textTransform: "uppercase", fontSize: "0.825rem" }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Cor personalizada em hexadecimal
                  </span>
                </div>
              </div>

              {/* Pré-visualização da Tag */}
              <div
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.7)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "0.875rem 1rem",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-muted)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Pré-visualização no Formulário:
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <TagBadge name={tagName.trim() || "Nome da Tag"} color={tagColor} size="lg" />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    (Texto com padding colorido, conforme padrão visual)
                  </span>
                </div>
              </div>

              {/* Botões do Modal */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.85rem", padding: "0.55rem 1rem" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ fontSize: "0.85rem", padding: "0.55rem 1.25rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner" style={{ width: "14px", height: "14px" }} />
                      Salvando...
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
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingTag && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={() => !isDeleting && setDeletingTag(null)}
        >
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderRadius: "0.875rem",
              width: "100%",
              maxWidth: "460px",
              padding: "1.75rem",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#f87171" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={18} />
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Remover Tag de Plataforma
              </h3>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Deseja realmente excluir a tag <strong>{deletingTag.name}</strong>?
            </p>

            {deletingTag._count && deletingTag._count.workLogs > 0 ? (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "#fbbf24",
                  background: "rgba(245, 158, 11, 0.1)",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                }}
              >
                ⚠️ Esta tag está atualmente vinculada a <strong>{deletingTag._count.workLogs}</strong> atendimento(s).
                Ao remover, os formulários existentes permanecerão salvos, apenas com o campo de tag desvinculado.
              </p>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setDeletingTag(null)}
                disabled={isDeleting}
                className="btn btn-secondary"
                style={{ fontSize: "0.85rem" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn"
                style={{
                  fontSize: "0.85rem",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {isDeleting ? (
                  <>
                    <div className="spinner" style={{ width: "14px", height: "14px" }} />
                    Excluindo...
                  </>
                ) : (
                  "Confirmar Exclusão"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

