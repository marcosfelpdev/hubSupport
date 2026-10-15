"use client";

import { useState, useTransition } from "react";
import { createEmployee, updateEmployee, deleteEmployee } from "@/actions/employees";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
  _count?: {
    workLogs: number;
  };
}

interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

const avatarColors = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function EmployeesManager({
  initialEmployees,
  currentUser,
}: {
  initialEmployees: Employee[];
  currentUser: CurrentUser;
}) {
  const isAdmin = currentUser.role === "ADMIN";
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  }

  // Filtragem
  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    return (
      emp.name.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      (emp.role === "ADMIN" ? "administrador" : "colaborador").includes(term)
    );
  });

  // Handler: Criar Funcionário
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createEmployee(formData);
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      setIsCreateOpen(false);
      showSuccess("Funcionário cadastrado com sucesso!");
      // Atualiza lista local
      window.location.reload();
    });
  }

  // Handler: Editar Funcionário
  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    if (!editingEmployee) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("id", editingEmployee.id);

    startTransition(async () => {
      const result = await updateEmployee(formData);
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      setEditingEmployee(null);
      showSuccess("Funcionário atualizado com sucesso!");
      window.location.reload();
    });
  }

  // Handler: Excluir Funcionário
  async function handleDeleteConfirm() {
    if (!deletingEmployee) return;
    setActionError(null);

    startTransition(async () => {
      const result = await deleteEmployee(deletingEmployee.id);
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      setDeletingEmployee(null);
      showSuccess("Funcionário excluído com sucesso.");
      window.location.reload();
    });
  }

  return (
    <div className="animate-fade-in" style={{ padding: "2rem 2.5rem" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "0.25rem",
            }}
          >
            Gerenciamento de Funcionários
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Acessos de login e equipe de atendimento do HubSupport
          </p>
        </div>

        {/* Action button */}
        {isAdmin && (
          <button
            id="btn-open-create-employee"
            onClick={() => {
              setActionError(null);
              setIsCreateOpen(true);
            }}
            className="btn-primary"
            style={{ padding: "0.65rem 1.25rem" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo Funcionário
          </button>
        )}
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: "1.5rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {actionSuccess}
        </div>
      )}

      {/* Search and Summary bar */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
          padding: "0.875rem 1.25rem",
        }}
      >
        <div style={{ position: "relative", width: "100%", maxWidth: "360px" }}>
          <input
            type="text"
            className="input-dark"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: "2.25rem" }}
          />
          <div
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.85rem" }}>
          <span style={{ color: "var(--text-muted)" }}>
            Total: <strong style={{ color: "var(--text-primary)" }}>{employees.length}</strong> funcionários
          </span>
          <span className="badge badge-success">
            {employees.filter((e) => e.active).length} Ativos
          </span>
          {employees.some((e) => !e.active) && (
            <span
              className="badge"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              {employees.filter((e) => !e.active).length} Inativos
            </span>
          )}
        </div>
      </div>

      {/* Lista de Funcionários — Modelo idêntico à imagem de referência */}
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          borderRadius: "0.75rem",
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
        }}
      >
        {filteredEmployees.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            Nenhum funcionário encontrado.
          </div>
        ) : (
          filteredEmployees.map((emp, index) => {
            const isMe = emp.id === currentUser.id || emp.email === currentUser.email;
            const avatarBg = getAvatarColor(emp.id);

            return (
              <div
                key={emp.id}
                className="employee-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.8fr) minmax(220px, 2fr) minmax(80px, 0.8fr) minmax(130px, 1fr) minmax(100px, 0.8fr) 100px",
                  alignItems: "center",
                  padding: "1rem 1.5rem",
                  borderBottom:
                    index === filteredEmployees.length - 1
                      ? "none"
                      : "1px solid rgba(255, 255, 255, 0.05)",
                  backgroundColor: !emp.active
                    ? "rgba(15, 23, 42, 0.4)"
                    : "transparent",
                  transition: "background-color 0.15s ease",
                }}
              >
                {/* 1. Avatar & Nome */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div
                    className="avatar"
                    style={{
                      width: "40px",
                      height: "40px",
                      background: `linear-gradient(135deg, ${avatarBg}, ${avatarBg}aa)`,
                      opacity: emp.active ? 1 : 0.5,
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    {getInitials(emp.name)}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <span
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: emp.active ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        {emp.name}
                      </span>
                      {isMe && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            color: "#818cf8",
                          }}
                        >
                          (você)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. E-mail */}
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {emp.email}
                </div>

                {/* 3. Traço / Telefone (Conforme layout da imagem) */}
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  —
                </div>

                {/* 4. Cargo / Perfil */}
                <div>
                  <span
                    style={{
                      fontSize: "0.825rem",
                      fontWeight: 500,
                      color: emp.role === "ADMIN" ? "#fbbf24" : "var(--text-secondary)",
                    }}
                  >
                    {emp.role === "ADMIN" ? "Administrador" : "Colaborador"}
                  </span>
                </div>

                {/* 5. Status (Bolinha + Ativo / Inativo) */}
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      fontSize: "0.825rem",
                      fontWeight: 500,
                      color: emp.active ? "#60a5fa" : "#94a3b8",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: emp.active ? "#3b82f6" : "#64748b",
                        boxShadow: emp.active ? "0 0 6px rgba(59, 130, 246, 0.6)" : "none",
                      }}
                    />
                    {emp.active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {/* 6. Ações (Editar e Excluir na lateral direita) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                  {isAdmin ? (
                    <>
                      {/* Botão Editar */}
                      <button
                        title="Editar funcionário"
                        onClick={() => {
                          setActionError(null);
                          setEditingEmployee(emp);
                        }}
                        style={{
                          background: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.2)";
                          e.currentTarget.style.color = "#818cf8";
                          e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                          e.currentTarget.style.color = "var(--text-secondary)";
                          e.currentTarget.style.borderColor = "var(--border)";
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      {/* Botão Excluir (Não permite excluir a si mesmo) */}
                      {!isMe && (
                        <button
                          title="Excluir funcionário"
                          onClick={() => {
                            setActionError(null);
                            setDeletingEmployee(emp);
                          }}
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            width: "32px",
                            height: "32px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                            e.currentTarget.style.color = "#f87171";
                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                            e.currentTarget.style.color = "var(--text-secondary)";
                            e.currentTarget.style.borderColor = "var(--border)";
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>—</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODAL: CRIAR FUNCIONÁRIO ================= */}
      {isCreateOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "#0d1322",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1.25rem",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Novo Funcionário
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Nome */}
              <div>
                <label htmlFor="create-name">Nome Completo *</label>
                <input
                  id="create-name"
                  name="name"
                  type="text"
                  className="input-dark"
                  placeholder="Ex: Amanda Silva"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="create-email">E-mail de Acesso *</label>
                <input
                  id="create-email"
                  name="email"
                  type="email"
                  className="input-dark"
                  placeholder="exemplo@hubsupport.com"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="create-password">Senha Inicial *</label>
                <input
                  id="create-password"
                  name="password"
                  type="password"
                  className="input-dark"
                  placeholder="Mínimo 6 caracteres"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-create-employee"
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={isPending}
                >
                  {isPending ? "Cadastrando..." : "Cadastrar Funcionário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDITAR FUNCIONÁRIO ================= */}
      {editingEmployee && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "#0d1322",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1.25rem",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Editar Funcionário
              </h2>
              <button
                onClick={() => setEditingEmployee(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Nome */}
              <div>
                <label htmlFor="edit-name">Nome *</label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  className="input-dark"
                  defaultValue={editingEmployee.name}
                  required
                  disabled={isPending}
                />
              </div>

              {/* Email (NÃO PODE SER ALTERADO) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="edit-email">E-mail</label>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Não pode ser alterado</span>
                </div>
                <input
                  id="edit-email"
                  type="email"
                  className="input-dark"
                  value={editingEmployee.email}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>

              {/* Nova Senha */}
              <div>
                <label htmlFor="edit-password">Nova Senha</label>
                <input
                  id="edit-password"
                  name="password"
                  type="password"
                  className="input-dark"
                  placeholder="Deixe em branco para manter a atual"
                  disabled={isPending}
                />
              </div>

              {/* Status Ativar / Inativar */}
              <div>
                <label htmlFor="edit-active">Status do Acesso</label>
                <select
                  id="edit-active"
                  name="active"
                  className="input-dark"
                  defaultValue={editingEmployee.active ? "true" : "false"}
                  disabled={isPending}
                  style={{ cursor: "pointer" }}
                >
                  <option value="true">● Ativo (Pode fazer login)</option>
                  <option value="false">○ Inativo (Acesso bloqueado)</option>
                </select>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-edit-employee"
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={isPending}
                >
                  {isPending ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXCLUIR FUNCIONÁRIO ================= */}
      {deletingEmployee && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "#0d1322",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1rem",
                  color: "#ef4444",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                Excluir Funcionário?
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Tem certeza que deseja excluir <strong>{deletingEmployee.name}</strong> ({deletingEmployee.email})?
                Esta ação removerá o acesso e todos os dados associados permanentemente do sistema.
              </p>
            </div>

            {actionError && (
              <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                {actionError}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="btn-ghost"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-delete-employee"
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                style={{
                  flex: 1,
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  padding: "0.625rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                {isPending ? "Excluindo..." : "Excluir Definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
