import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { api, EmployeeItem } from "@/services/api";
import { ROLE_OPTIONS } from "@/lib/roles";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  Shield,
  Clock,
} from "lucide-react";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date | string;
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

const ROLE_METADATA: Record<
  string,
  { label: string; description: string; dotColor: string; badgeClasses: string }
> = {
  ADMIN: {
    label: "Administrador",
    description: "Acesso total, gestão de membros, tags e configurações.",
    dotColor: "bg-amber-500",
    badgeClasses: "bg-amber-50 text-amber-700 border-amber-200/80",
  },
  SUPPORT: {
    label: "Suporte",
    description: "Atendimento nível 1, abertura e registro de chamados.",
    dotColor: "bg-sky-500",
    badgeClasses: "bg-sky-50 text-sky-700 border-sky-200/80",
  },
  TECHNICIAN: {
    label: "Técnico",
    description: "Atendimento técnico e resolução de filas no Kanban.",
    dotColor: "bg-purple-500",
    badgeClasses: "bg-purple-50 text-purple-700 border-purple-200/80",
  },
  MANAGER: {
    label: "Gestor",
    description: "Acompanhamento de relatórios executivos e auditorias.",
    dotColor: "bg-indigo-500",
    badgeClasses: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  },
  USER: {
    label: "Colaborador",
    description: "Acesso padrão para consulta e acompanhamento de tarefas.",
    dotColor: "bg-slate-500",
    badgeClasses: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

function getRoleLabel(role: string) {
  const meta = ROLE_METADATA[role];
  if (meta) return meta.label;
  const opt = ROLE_OPTIONS.find((o) => o.value === role);
  return opt ? opt.label : role;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateValue: Date | string) {
  try {
    const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function EmployeesManager({
  initialEmployees,
  currentUser,
  onEmployeesChanged,
}: {
  initialEmployees: Employee[];
  currentUser: CurrentUser;
  onEmployeesChanged?: () => void;
}) {
  const isAdmin = currentUser.role === "ADMIN";
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  // Atualiza estado local quando initialEmployees mudar
  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState("SUPPORT");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editRole, setEditRole] = useState("USER");
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
      getRoleLabel(emp.role).toLowerCase().includes(term)
    );
  });

  // Handler: Criar Funcionário
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = createRole;

    startTransition(async () => {
      try {
        await api.employees.create({ name, email, password, role });
        setIsCreateOpen(false);
        showSuccess("Funcionário cadastrado com sucesso!");
        onEmployeesChanged?.();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erro ao cadastrar funcionário.");
      }
    });
  }

  // Handler: Editar Funcionário
  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    if (!editingEmployee) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const password = formData.get("password") as string;
    const role = editRole;
    const active = formData.get("active") === "true";

    startTransition(async () => {
      try {
        await api.employees.update(editingEmployee.id, { name, password, role, active });
        setEditingEmployee(null);
        showSuccess("Funcionário atualizado com sucesso!");
        onEmployeesChanged?.();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erro ao atualizar funcionário.");
      }
    });
  }

  // Handler: Excluir Funcionário
  async function handleDeleteConfirm() {
    if (!deletingEmployee) return;
    setActionError(null);

    startTransition(async () => {
      try {
        await api.employees.delete(deletingEmployee.id);
        setDeletingEmployee(null);
        showSuccess("Funcionário excluído com sucesso.");
        onEmployeesChanged?.();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erro ao excluir funcionário.");
      }
    });
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Membros da Equipe
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os colaboradores da equipe e seus respectivos níveis de permissão.
          </p>
        </div>

        {/* Action button */}
        {isAdmin && (
          <button
            id="btn-open-create-employee"
            type="button"
            onClick={() => {
              setActionError(null);
              setCreateRole("SUPPORT");
              setIsCreateOpen(true);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-4 py-2.5 text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Funcionário</span>
          </button>
        )}
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fade-in shadow-2xs">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search and Summary bar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 sm:px-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none"
            placeholder="Buscar por nome, e-mail ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Badges / Metrics */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
          <span className="text-slate-500 font-medium">
            Total: <strong className="text-slate-900 font-semibold">{employees.length}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {employees.filter((e) => e.active).length} Ativos
          </span>
          {employees.some((e) => !e.active) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              {employees.filter((e) => !e.active).length} Inativos
            </span>
          )}
        </div>
      </div>

      {/* Lista / Tabela de Funcionários — Modelo idêntico à imagem de referência */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-2xs">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Nenhum colaborador encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Verifique os termos de busca ou cadastre um novo funcionário na equipe.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Funcionário</th>
                  <th className="px-6 py-3.5">Cargo</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Data de Criação</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const isMe = emp.id === currentUser.id || emp.email === currentUser.email;
                  const roleMeta = ROLE_METADATA[emp.role] || {
                    label: getRoleLabel(emp.role),
                    dotColor: "bg-slate-500",
                    badgeClasses: "bg-slate-50 text-slate-700 border-slate-200",
                  };

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !emp.active ? "opacity-60 bg-slate-50/40" : ""
                      }`}
                    >
                      {/* 1. Avatar & Nome / Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {getInitials(emp.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                                {emp.name}
                              </span>
                              {isMe && (
                                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  você
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {emp.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Cargo (Badge em pill com dot) */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleMeta.badgeClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${roleMeta.dotColor}`} />
                          <span>{roleMeta.label}</span>
                        </span>
                      </td>

                      {/* 3. Status (Bolinha + Ativo / Inativo) */}
                      <td className="px-6 py-4">
                        {emp.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>Ativo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span>Inativo</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Data de Cadastro */}
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500 font-medium">
                          {formatDate(emp.createdAt)}
                        </span>
                      </td>

                      {/* 5. Ações */}
                      <td className="px-6 py-4 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Editar funcionário"
                              onClick={() => {
                                setActionError(null);
                                setEditingEmployee(emp);
                                setEditRole(emp.role);
                              }}
                              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {!isMe && (
                              <button
                                type="button"
                                title="Excluir funcionário"
                                onClick={() => {
                                  setActionError(null);
                                  setDeletingEmployee(emp);
                                }}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: CRIAR FUNCIONÁRIO (Estilo Invite Members do Vídeo) ================= */}
      {isCreateOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isPending && setIsCreateOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 border border-slate-200 max-w-md w-full animate-scale-in flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Cadastrar Funcionário
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preencha os dados e escolha o nível de acesso na plataforma.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isPending && setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {/* Nome */}
              <div>
                <label
                  htmlFor="create-name"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-name"
                  name="name"
                  type="text"
                  className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none"
                  placeholder="Ex: Amanda Silva"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="create-email"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  E-mail de Acesso <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-email"
                  name="email"
                  type="email"
                  className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none"
                  placeholder="exemplo@hubsupport.com"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Senha */}
              <div>
                <label
                  htmlFor="create-password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Senha Inicial <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-password"
                  name="password"
                  type="password"
                  className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none"
                  placeholder="Mínimo 6 caracteres"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Seleção de Cargo em Cartões Clean (vídeo 00:10 - 00:12) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Cargo e Nível de Acesso <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {ROLE_OPTIONS.map((opt) => {
                    const isSelected = createRole === opt.value;
                    const meta = ROLE_METADATA[opt.value];

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCreateRole(opt.value)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${meta?.dotColor || "bg-slate-400"}`}
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {opt.label}
                            </span>
                            <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                              {meta?.description}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                            isSelected
                              ? "bg-slate-900 border-slate-900 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl px-4 py-2 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-create-employee"
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-5 py-2 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    "Cadastrar Funcionário"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: EDITAR FUNCIONÁRIO ================= */}
      {editingEmployee && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isPending && setEditingEmployee(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 border border-slate-200 max-w-md w-full animate-scale-in flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Editar Funcionário
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atualize as permissões ou status da conta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isPending && setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="flex flex-col gap-4">
              {/* Nome */}
              <div>
                <label
                  htmlFor="edit-name"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none"
                  defaultValue={editingEmployee.name}
                  required
                  disabled={isPending}
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="edit-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    E-mail
                  </label>
                  <span className="text-[11px] text-slate-400">Não editável</span>
                </div>
                <input
                  id="edit-email"
                  type="email"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-xl px-3.5 py-2.5 text-sm cursor-not-allowed outline-none"
                  value={editingEmployee.email}
                  disabled
                />
              </div>

              {/* Nova Senha */}
              <div>
                <label
                  htmlFor="edit-password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Nova Senha <span className="text-slate-400 lowercase font-normal">(opcional)</span>
                </label>
                <input
                  id="edit-password"
                  name="password"
                  type="password"
                  className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none"
                  placeholder="Deixe em branco para manter a atual"
                  disabled={isPending}
                />
              </div>

              {/* Cargo Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Cargo
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                  {ROLE_OPTIONS.map((opt) => {
                    const isSelected = editRole === opt.value;
                    const meta = ROLE_METADATA[opt.value];

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditRole(opt.value)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${meta?.dotColor || "bg-slate-400"}`}
                          />
                          <span className="font-bold text-slate-900">{opt.label}</span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-slate-900 border-slate-900 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Ativo / Inativo */}
              <div>
                <label
                  htmlFor="edit-active"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Status de Acesso
                </label>
                <select
                  id="edit-active"
                  name="active"
                  className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs outline-none cursor-pointer"
                  defaultValue={editingEmployee.active ? "true" : "false"}
                  disabled={isPending}
                >
                  <option value="true">● Ativo (Acesso Liberado)</option>
                  <option value="false">○ Inativo (Acesso Bloqueado)</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl px-4 py-2 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-edit-employee"
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-5 py-2 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: EXCLUIR FUNCIONÁRIO ================= */}
      {deletingEmployee && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isPending && setDeletingEmployee(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 border border-slate-200 max-w-md w-full animate-scale-in flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Excluir Funcionário?
                </h2>
                <p className="text-xs text-slate-500">
                  Esta ação não poderá ser revertida.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza que deseja excluir <strong>{deletingEmployee.name}</strong> ({deletingEmployee.email})?
              Esta ação removerá o acesso do usuário ao sistema.
            </p>

            {actionError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-1 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl px-4 py-2 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-delete-employee"
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  "Excluir Definitivamente"
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
