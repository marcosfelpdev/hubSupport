import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";
import { api, NotificationItem } from "@/services/api";

function formatRelativeTime(date: Date | string) {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);

  if (diffInMinutes < 1) return "agora mesmo";
  if (diffInMinutes < 60) return `há ${diffInMinutes}min`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `há ${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `há ${diffInDays}d`;
}

// Reproduz um som suave e moderno de notificação (dois tons harmônicos)
function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Desbloqueia caso esteja suspenso
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // 1º Tom (E5 - 659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);

    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.28);

    // 2º Tom mais agudo e brilhante (A5 - 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08);

    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.08);
    gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn("Não foi possível reproduzir som de notificação:", err);
  }
}

export default function NotificationBell() {
  const { isRecording } = useScreenRecording();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousUnreadRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);
  const navigate = useNavigate();

  async function fetchNotifications(isFirst = false) {
    try {
      const data = await api.notifications.getAll();
      if (data) {
        const count = data.unreadCount;

        // Se houver novas notificações não lidas (após a carga inicial), toca o som
        if (!isFirst && !isInitialLoadRef.current && previousUnreadRef.current !== null) {
          if (count > previousUnreadRef.current) {
            playNotificationSound();
          }
        }

        previousUnreadRef.current = count;
        setNotifications(data.notifications);
        setUnreadCount(count);
        isInitialLoadRef.current = false;
      }
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    }
  }

  // Polling a cada 10 segundos para atualização em tempo real
  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleNotificationClick(item: NotificationItem) {
    if (isRecording) {
      alert("Uma gravação de tela está em andamento. Finalize a gravação antes de navegar para outro chamado.");
      return;
    }

    if (!item.read) {
      await api.notifications.markAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setIsOpen(false);
    if (item.workLogId) {
      navigate(`/dashboard/tecnico?id=${item.workLogId}`);
    } else {
      navigate(`/dashboard/tecnico`);
    }
  }

  async function handleMarkAllAsRead() {
    setLoading(true);
    await api.notifications.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setLoading(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão de Sino */}
      <button
        id="btn-notifications-bell"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notificações"
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          isOpen
            ? "bg-slate-100 text-slate-900 border border-slate-300"
            : "bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 shadow-2xs"
        }`}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge contador */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isOpen && (
        <div className="animate-fade-in absolute top-[calc(100%+8px)] right-0 w-88 max-h-[480px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header do Dropdown */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">
                Notificações
              </span>
              {unreadCount > 0 && (
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200/60">
                  {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Testar som de notificação"
                onClick={(e) => {
                  e.stopPropagation();
                  playNotificationSound();
                }}
                className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <span>Som</span>
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Marcar lidas
                </button>
              )}
            </div>
          </div>

          {/* Lista de Notificações */}
          <div className="overflow-y-auto max-h-[380px] p-2 flex flex-col gap-1.5">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-400 text-xs">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                Nenhuma notificação no momento
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-xl cursor-pointer transition-all flex gap-3 items-start border ${
                    item.read
                      ? "bg-transparent hover:bg-slate-50 border-transparent text-slate-600"
                      : "bg-indigo-50/40 hover:bg-indigo-50/80 border-indigo-100 text-slate-900"
                  }`}
                >
                  {/* Ícone de status */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      item.workLog?.technicalAction
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {item.workLog?.technicalAction ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="9" y1="18" x2="15" y2="18" />
                        <line x1="10" y1="22" x2="14" y2="22" />
                        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate leading-snug ${
                          item.read ? "font-medium text-slate-700" : "font-semibold text-slate-900"
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    {item.workLog && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {item.workLog.clientOrOffice}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.workLog.status === "Solucionado"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {item.workLog.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
