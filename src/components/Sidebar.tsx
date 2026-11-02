import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export default function Sidebar({ user }: { user: User }) {
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const { isRecording } = useScreenRecording();
  const { logout } = useAuth();

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

  const navGroups = [
    {
      title: "OPERAÇÃO",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard",
          exact: true,
          icon: (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                ),
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                href: "/dashboard/funcionarios",
                label: "Funcionários",
                exact: false,
                icon: (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 bg-[#f8f9fa] border-r border-slate-200 flex flex-col justify-between p-4 z-40 shrink-0">
      {/* Top: Logo, Workspace & Navigation */}
      <div className="flex flex-col min-h-0">
        {/* Header da Marca */}
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xs text-white shrink-0">
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
          <div>
            <h1 className="text-slate-900 font-bold text-base tracking-tight leading-none">HubSupport</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Portal da Equipe</p>
          </div>
        </div>

        {/* Card / Pill Seletor de Cliente / Escritório (Vídeo 00:01) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-xs flex items-center justify-between mt-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium text-slate-700 truncate">Matriz Principal • SP</span>
          </div>
          <svg
            className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Indicador de Gravação de Tela Ativa */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold mt-3 shadow-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
            <span className="truncate">Gravando tela: navegação travada</span>
          </div>
        )}

        {/* Seções de Navegação */}
        <div className="mt-5 space-y-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                {group.title}
              </p>
              <nav className="space-y-1">
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
                          : undefined
                      }
                      className={`rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all text-sm font-medium ${
                        isBlocked
                          ? "opacity-40 cursor-not-allowed pointer-events-none text-slate-400"
                          : isActive
                          ? "bg-slate-900 text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 group"
                      }`}
                    >
                      <span
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? "text-white"
                            : isBlocked
                            ? "text-slate-300"
                            : "text-slate-400 group-hover:text-slate-700"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isBlocked && (
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

      {/* Rodapé da Sidebar: Usuário logado e Logout */}
      <div className="pt-3 border-t border-slate-200/80">
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-xs flex items-center gap-2.5 mb-2">
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
            <p className="text-sm font-semibold text-slate-900 truncate leading-snug">
              {user.name || "Usuário"}
            </p>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 leading-none mt-0.5 ${
                user.role === "ADMIN"
                  ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                  : user.role === "MANAGER"
                  ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                  : user.role === "TECHNICIAN"
                  ? "bg-sky-50 text-sky-700 border border-sky-200/60"
                  : user.role === "SUPPORT"
                  ? "bg-cyan-50 text-cyan-700 border border-cyan-200/60"
                  : "bg-slate-100 text-slate-600 border border-slate-200/60"
              }`}
            >
              {user.role === "ADMIN"
                ? "👑 Administrador"
                : user.role === "MANAGER"
                ? "🧑‍💼 Gestor"
                : user.role === "TECHNICIAN"
                ? "🔧 Técnico"
                : user.role === "SUPPORT"
                ? "🎧 Suporte"
                : "👤 Colaborador"}
            </span>
          </div>
        </div>

        <button
          id="btn-sidebar-logout"
          onClick={handleLogout}
          disabled={loggingOut || isRecording}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isRecording ? "Finalize a gravação de tela antes de sair da conta" : undefined}
        >
          {loggingOut ? (
            <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          ) : (
            <>
              <svg
                className="w-4 h-4 text-slate-500 shrink-0"
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
              <span>Sair da conta</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
