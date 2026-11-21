import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Loader2,
  MoreVertical,
  Pencil,
  QrCode,
  Radio,
  Smartphone,
  Trash2,
  Unlink,
  Vibrate,
} from "lucide-react";
import type {
  PhoneCardItem,
  PhoneCommandFeedback,
} from "../../services/api";

export type PhoneDispatchAction = "locate" | "vibrate";

export interface PhoneCardTileProps {
  card: PhoneCardItem;
  dispatchingAction: PhoneDispatchAction | null;
  feedback: PhoneCommandFeedback | null;
  onEdit: (card: PhoneCardItem) => void;
  onPair: (card: PhoneCardItem) => void;
  onUnpair: (card: PhoneCardItem) => void;
  onDelete: (card: PhoneCardItem) => void;
  onLocate: (card: PhoneCardItem) => void;
  onVibrate: (card: PhoneCardItem) => void;
}

function getPresenceBadge(status: PhoneCardItem["status"]) {
  switch (status) {
    case "online":
      return {
        label: "Online",
        className:
          "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
        dotClassName: "bg-emerald-500 animate-pulse",
      };
    case "offline":
      return {
        label: "Offline",
        className:
          "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
        dotClassName: "bg-amber-500",
      };
    default:
      return {
        label: "Não pareado",
        className:
          "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
        dotClassName: "bg-slate-400 dark:bg-slate-500",
      };
  }
}

function renderBatteryTelemetry(battery: PhoneCardItem["battery"]) {
  if (!battery) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-medium"
        title="Aguardando telemetria de bateria do aparelho"
      >
        <Battery className="w-4 h-4 shrink-0" />
        <span>Sem telemetria</span>
      </span>
    );
  }

  const level = Math.max(0, Math.min(100, Math.round(battery.level)));
  const isCharging = battery.isCharging;

  let colorClass = "text-emerald-600 dark:text-emerald-400";
  if (!isCharging) {
    if (level <= 20) {
      colorClass = "text-rose-600 dark:text-rose-400";
    } else if (level <= 60) {
      colorClass = "text-amber-600 dark:text-amber-400";
    }
  }

  const Icon = isCharging
    ? BatteryCharging
    : level > 60
      ? BatteryFull
      : level > 20
        ? BatteryMedium
        : BatteryLow;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${colorClass}`}
      title={
        isCharging
          ? `Bateria em ${level}% (carregando)`
          : `Bateria em ${level}%`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{level}%</span>
      {isCharging && (
        <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
          Carregando
        </span>
      )}
    </span>
  );
}

export default function PhoneCardTile({
  card,
  dispatchingAction,
  feedback,
  onEdit,
  onPair,
  onUnpair,
  onDelete,
  onLocate,
  onVibrate,
}: PhoneCardTileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const isPaired = card.status !== "unpaired";
  const isDispatching = dispatchingAction !== null;
  const presence = getPresenceBadge(card.status);
  const formattedVersion = card.appVersionName
    ? card.appVersionName.startsWith("v")
      ? card.appVersionName
      : `v${card.appVersionName}`
    : null;

  return (
    <article className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col p-5 gap-4">
      {/* Cabeçalho do Card */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
              card.status === "online"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60"
                : card.status === "offline"
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
          >
            <Smartphone className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {card.name}
              </h3>
            </div>
            {card.description ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                {card.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-1">
                Sem descrição
              </p>
            )}
          </div>
        </div>

        {/* Badge de presença + Menu de ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${presence.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${presence.dotClassName}`} />
            <span>{presence.label}</span>
          </span>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={`Ações do card ${card.name}`}
              aria-expanded={menuOpen}
              title="Gerenciar card"
              className="p-1.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-20 animate-scale-in">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(card);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  <span>Editar card</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onPair(card);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isPaired ? "Trocar aparelho" : "Parear dispositivo"}</span>
                </button>

                {isPaired && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onUnpair(card);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Desvincular</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(card);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir card</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Faixa de Telemetria (quando pareado) ou Orientação (quando não pareado) */}
      {isPaired ? (
        <div className="bg-slate-50/80 dark:bg-[#0b0f19]/70 border border-slate-100 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
          {renderBatteryTelemetry(card.battery)}

          <div className="flex items-center gap-2 flex-wrap">
            {formattedVersion && (
              <span
                className="px-2 py-0.5 rounded-md font-mono text-[11px] font-medium bg-white dark:bg-[#111726] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80"
                title="Versão do app instalada no aparelho"
              >
                {formattedVersion}
              </span>
            )}

            {card.hasPushToken ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60"
                title="Notificações push (FCM) ativas para acordar o aparelho mesmo offline"
              >
                <Bell className="w-3 h-3" />
                <span>Push ativo</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700"
                title="Operando somente via conexão em tempo real (sem token FCM)"
              >
                <Radio className="w-3 h-3" />
                <span>Tempo real</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50/80 dark:bg-[#0b0f19]/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
          Aguardando pareamento com um celular via código de 6 dígitos.
        </div>
      )}

      {/* Rodapé de Ações */}
      <div className="mt-auto pt-1 flex flex-col gap-2.5">
        {!isPaired ? (
          <button
            type="button"
            onClick={() => onPair(card)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Parear Dispositivo</span>
          </button>
        ) : (
          /* REGRA CRÍTICA: Localizar e Vibrar SEMPRE habilitados em online OU offline; só desabilitados durante isDispatching */
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isDispatching}
              onClick={() => onLocate(card)}
              className="py-2.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {dispatchingAction === "locate" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <BellRing className="w-4 h-4 shrink-0" />
                  <span>Localizar</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isDispatching}
              onClick={() => onVibrate(card)}
              className="py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {dispatchingAction === "vibrate" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Vibrate className="w-4 h-4 shrink-0" />
                  <span>Vibrar</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Feedback inline do último comando */}
        {feedback && (
          <div
            role="status"
            className={`rounded-xl px-3 py-2 text-xs font-medium border flex items-start gap-2 animate-fade-in ${
              feedback.status === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                : feedback.status === "timeout"
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
            }`}
          >
            {feedback.status === "success" ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ) : feedback.status === "timeout" ? (
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{feedback.message}</span>
          </div>
        )}
      </div>
    </article>
  );
}
