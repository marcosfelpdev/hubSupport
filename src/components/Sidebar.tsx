import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon, Building2 } from "lucide-react";

interface User {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export default function Sidebar({ user }: { user: User }) {
  const { pathname } = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { isRecording } = useScreenRecording();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const isTechnician = user.role === "TECHNICIAN" || user.role === "ADMIN";
  const isAdmin = user.role === "ADMIN";

  const getRoleLabel = () => {
    switch (user.role) {
      case "ADMIN":
        return "👑 Administrador";
      case "MANAGER":
        return "🧑‍💼 Gestor";
      case "TECHNICIAN":
        return "🔧 Técnico";
      case "SUPPORT":
        return "🎧 Suporte";
      default:
        return "👤 Colaborador";
    }
  };

  const navGroups = [
    {
      title: "OPERAÇÃO",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard",
          exact: true,
          icon: (
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          ),
        },
        {
          href: "/dashboard/atendimentos",
          label: "Atendimentos",
          exact: false,
          icon: (
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "GESTÃO",
      items: [
        ...(isTechnician
          ? [
              {
                href: "/dashboard/tecnico",
                label: "Painel Técnico",
                exact: false,
                icon: (
                  <svg
                    className="w-5 h-5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                ),
              },
            ]
          : []),
        {
          href: "/dashboard/clientes",
          label: "Clientes",
          exact: false,
          icon: <Building2 className="w-5 h-5 shrink-0" />,
        },
        ...(isAdmin
          ? [
              {
                href: "/dashboard/funcionarios",
                label: "Funcionários",
                exact: false,
                icon: (
                  <svg
                    className="w-5 h-5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
              },
            ]
          : []),
        {
          href: "/dashboard/configuracoes",
          label: "Configurações",
          exact: false,
          icon: (
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop com transição de opacidade (fade in / fade out) */}
      <div
        className={`fixed inset-0 bg-slate-950/20 dark:bg-black/50 backdrop-blur-[0.5px] z-40 transition-opacity duration-300 ease-in-out pointer-events-none ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Barra lateral retrátil fixa à esquerda com sobreposição ao expandir */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed top-0 bottom-0 left-0 z-50 h-screen bg-[#f8f9fa] dark:bg-[#0b0f19] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 overflow-x-hidden select-none transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isHovered
            ? "w-64 shadow-2xl border-r-slate-300/80 dark:border-r-slate-700/80"
            : "w-[72px] shadow-none"
        }`}
      >
        {/* Topo: Logo da Marca e Navegação */}
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          {/* Header da Marca */}
          <div className="flex items-center min-h-[40px]">
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xs text-white shrink-0 mx-auto"
              title={!isHovered ? "HubSupport - Portal da Equipe" : undefined}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            {isHovered && (
              <div className="ml-3 min-w-0 overflow-hidden whitespace-nowrap animate-fade-in">
                <h1 className="text-slate-900 dark:text-white font-bold text-base tracking-tight leading-none truncate">
                  HubSupport
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
                  Portal da Equipe
                </p>
              </div>
            )}
          </div>

          {/* Indicador de Gravação de Tela Ativa */}
          {isRecording && (
            <div className="mt-3">
              {isHovered ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold shadow-xs animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
                  <span className="truncate">Gravando tela: navegação travada</span>
                </div>
              ) : (
                <div
                  className="w-10 h-10 mx-auto rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-xs cursor-help"
                  title="Gravando tela: navegação travada"
                >
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Seções de Navegação */}
          <div className="mt-5 space-y-4 overflow-y-auto flex-1 pr-0.5">
            {navGroups.map((group, groupIdx) => (
              <div key={group.title}>
                {isHovered ? (
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1.5 animate-fade-in">
                    {group.title}
                  </p>
                ) : groupIdx > 0 ? (
                  <div className="my-2.5 border-t border-slate-200/80 dark:border-slate-800 mx-1" />
                ) : null}
                <nav className="space-y-1.5">
                  {group.items.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname?.startsWith(item.href);

                    const isBlocked = isRecording && !isActive;

                    return (
                      <Link
                        key={item.href}
                        to={isBlocked ? "#" : item.href}
                        onClick={(e) => {
                          if (isBlocked) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        tabIndex={isBlocked ? -1 : 0}
                        aria-disabled={isBlocked}
                        title={
                          isBlocked
                            ? "Acesso bloqueado durante a gravação de tela. Finalize a gravação para trocar de aba."
                            : !isHovered
                            ? item.label
                            : undefined
                        }
                        className={`transition-all ${
                          isHovered
                            ? "w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-sm font-medium"
                            : "w-10 h-10 mx-auto rounded-xl flex items-center justify-center p-0"
                        } ${
                          isBlocked
                            ? "opacity-40 cursor-not-allowed pointer-events-none text-slate-400 dark:text-slate-500"
                            : isActive
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 group"
                        }`}
                      >
                        <span
                          className={`shrink-0 transition-colors flex items-center justify-center ${
                            isActive
                              ? "text-white dark:text-slate-900"
                              : isBlocked
                              ? "text-slate-300 dark:text-slate-600"
                              : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                          }`}
                        >
                          {item.icon}
                        </span>
                        {isHovered && <span className="flex-1 truncate">{item.label}</span>}
                        {isHovered && isBlocked && (
                          <svg
                            className="w-3.5 h-3.5 text-slate-400 opacity-70 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé da Sidebar: Tema, Perfil do Usuário e Logout */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
          {/* Alternador de Tema Claro / Escuro */}
          {!isHovered ? (
            <button
              type="button"
              id="btn-theme-toggle-compact"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro"}
              className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 mb-2.5 transition-all cursor-pointer shadow-2xs"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl flex items-center justify-between border border-slate-200/80 dark:border-slate-800 mb-2.5 shadow-2xs animate-fade-in">
              <button
                type="button"
                id="btn-theme-light"
                onClick={() => setTheme("light")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Claro</span>
              </button>
              <button
                type="button"
                id="btn-theme-dark"
                onClick={() => setTheme("dark")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Escuro</span>
              </button>
            </div>
          )}

          {/* Card de Usuário */}
          {!isHovered ? (
            <div
              title={`${user.name || "Usuário"} (${getRoleLabel().replace(/^[^\s]+\s/, "")})`}
              className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs mb-2 cursor-default ${
                user.role === "ADMIN"
                  ? "bg-gradient-to-br from-amber-500 to-amber-600"
                  : user.role === "MANAGER"
                  ? "bg-gradient-to-br from-purple-500 to-purple-600"
                  : user.role === "TECHNICIAN"
                  ? "bg-gradient-to-br from-sky-500 to-sky-600"
                  : "bg-gradient-to-br from-indigo-500 to-indigo-600"
              }`}
            >
              {initials}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-xl p-2.5 shadow-xs flex items-center gap-2.5 mb-2 animate-fade-in">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs ${
                  user.role === "ADMIN"
                    ? "bg-gradient-to-br from-amber-500 to-amber-600"
                    : user.role === "MANAGER"
                    ? "bg-gradient-to-br from-purple-500 to-purple-600"
                    : user.role === "TECHNICIAN"
                    ? "bg-gradient-to-br from-sky-500 to-sky-600"
                    : "bg-gradient-to-br from-indigo-500 to-indigo-600"
                }`}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-snug">
                  {user.name || "Usuário"}
                </p>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 leading-none mt-0.5 ${
                    user.role === "ADMIN"
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                      : user.role === "MANAGER"
                      ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60"
                      : user.role === "TECHNICIAN"
                      ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60"
                      : user.role === "SUPPORT"
                      ? "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/60"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                  }`}
                >
                  {getRoleLabel()}
                </span>
              </div>
            </div>
          )}

          {/* Botão de Logout */}
          <button
            id="btn-sidebar-logout"
            onClick={handleLogout}
            disabled={loggingOut || isRecording}
            className={`flex items-center justify-center transition-all cursor-pointer border border-transparent disabled:opacity-40 disabled:cursor-not-allowed ${
              isHovered
                ? "w-full gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-xl hover:border-slate-200 dark:hover:border-slate-800"
                : "w-10 h-10 mx-auto text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-xl"
            }`}
            title={
              isRecording
                ? "Finalize a gravação de tela antes de sair da conta"
                : !isHovered
                ? "Sair da conta"
                : undefined
            }
          >
            {loggingOut ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 dark:border-t-slate-300 rounded-full animate-spin" />
            ) : (
              <>
                <svg
                  className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {isHovered && <span>Sair da conta</span>}
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
