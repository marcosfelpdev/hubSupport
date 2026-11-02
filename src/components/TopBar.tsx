import NotificationBell from "./NotificationBell";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";

interface User {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export default function TopBar({ user }: { user: User }) {
  const { isRecording } = useScreenRecording();
  const isTechnician = user.role === "TECHNICIAN" || user.role === "ADMIN";

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header className="h-14 sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      {/* Esquerda / Centro: Indicadores e Busca rápida */}
      <div className="flex items-center gap-3">
        {/* Indicador discreto da equipe técnica */}
        {user.role === "TECHNICIAN" && (
          <span className="bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            Equipe Técnica Online
          </span>
        )}

        {/* Indicador de Gravação ativa */}
        {isRecording && (
          <span className="bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 shadow-2xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            Gravação em andamento
          </span>
        )}

        {/* Campo de busca rápida / Seletor de contexto (CloudNexus Quick Search Pill) */}
        <div className="bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-500 flex items-center gap-2 max-w-sm w-72 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs group">
          <svg
            className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="truncate">Buscar chamados, relatórios...</span>
          <kbd className="ml-auto font-sans text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400 font-semibold shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Direita: Notificações e Perfil */}
      <div className="flex items-center gap-3">
        {/* Notificações para técnicos e admins */}
        {isTechnician && <NotificationBell />}

        {/* Separador sutil */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Perfil Mini */}
        <div className="flex items-center gap-2.5 pl-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs ${
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
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
              {user.name || "Usuário"}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              {user.role === "ADMIN"
                ? "Administrador"
                : user.role === "MANAGER"
                ? "Gestor"
                : user.role === "TECHNICIAN"
                ? "Técnico"
                : user.role === "SUPPORT"
                ? "Suporte"
                : "Colaborador"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
