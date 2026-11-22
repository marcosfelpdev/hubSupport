import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  PhoneCardItem,
  PhonePairingCodeResponse,
} from "../../services/api";

const PAIRING_TTL_MS = 5 * 60 * 1000;

export interface PairingCodeModalProps {
  card: PhoneCardItem | null;
  pairingData: PhonePairingCodeResponse | null;
  loading: boolean;
  error: string | null;
  pairedJustNow: boolean;
  onRegenerate: () => void;
  onClose: () => void;
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function PairingCodeModal({
  card,
  pairingData,
  loading,
  error,
  pairedJustNow,
  onRegenerate,
  onClose,
}: PairingCodeModalProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [copied, setCopied] = useState(false);

  // Atualiza contador regressivo em tempo real
  useEffect(() => {
    if (!card || !pairingData || pairedJustNow) return;

    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, [card, pairingData, pairedJustNow]);

  // Reseta estado "Copiado!" quando gera novo código ou fecha
  useEffect(() => {
    setCopied(false);
  }, [pairingData?.code, card?.id]);

  // Fechamento por ESC
  useEffect(() => {
    if (!card) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [card, loading, onClose]);

  const { remainingMs, progressPercent, isExpired } = useMemo(() => {
    if (!pairingData) {
      return { remainingMs: 0, progressPercent: 0, isExpired: false };
    }
    const expiresAtMs = new Date(pairingData.expiresAt).getTime();
    if (Number.isNaN(expiresAtMs)) {
      return { remainingMs: 0, progressPercent: 0, isExpired: true };
    }
    const rem = Math.max(0, expiresAtMs - nowMs);
    const pct = Math.min(100, Math.max(0, (rem / PAIRING_TTL_MS) * 100));
    return {
      remainingMs: rem,
      progressPercent: pct,
      isExpired: rem <= 0,
    };
  }, [pairingData, nowMs]);

  if (!card || typeof document === "undefined") {
    return null;
  }

  async function handleCopyCode() {
    if (!pairingData?.code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pairingData.code);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = pairingData.code;
        tempInput.style.position = "fixed";
        tempInput.style.opacity = "0";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        tempInput.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silencioso caso o navegador bloqueie área de transferência
    }
  }

  const isReplacingDevice = Boolean(card.pairedDeviceId) && !pairedJustNow;
  const formattedCode = pairingData?.code
    ? `${pairingData.code.slice(0, 3)} ${pairingData.code.slice(3)}`
    : "";

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={() => !loading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-modal-title"
        className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-7 max-w-md w-full animate-scale-in flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {pairedJustNow ? (
          /* Estado de Sucesso Automático */
          <div className="flex flex-col items-center text-center py-3 gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h2
                id="pairing-modal-title"
                className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Dispositivo pareado com sucesso!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                O celular foi conectado ao card{" "}
                <strong className="text-slate-900 dark:text-white font-semibold">
                  {card.name}
                </strong>{" "}
                e já está pronto para receber comandos de localização e vibração.
              </p>
            </div>

            <div className="w-full pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Estado de Geração e Exibição do Código */
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand-accent dark:bg-white text-brand-accent-foreground dark:text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="pairing-modal-title"
                    className="text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate"
                  >
                    {isReplacingDevice ? "Trocar Dispositivo" : "Parear Dispositivo"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Card:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {card.name}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                aria-label="Fechar modal"
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso de substituição */}
            {isReplacingDevice && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs rounded-xl p-3 leading-relaxed">
                Ao confirmar o novo pareamento no celular, o aparelho vinculado anteriormente será desvinculado automaticamente.
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Conteúdo do Código */}
            {loading && !pairingData ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-brand-accent dark:text-slate-300" />
                <span className="text-xs font-medium">
                  Gerando código de 6 dígitos...
                </span>
              </div>
            ) : pairingData ? (
              <div className="flex flex-col gap-4">
                {/* Bloco do Código */}
                <div
                  className={`rounded-2xl border px-4 py-6 text-center transition-colors ${
                    isExpired
                      ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                      : "bg-slate-50 dark:bg-[#0b0f19] border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Código de pareamento
                  </p>
                  <div
                    className={`tracking-[0.25em] font-mono text-4xl font-bold select-all pl-[0.25em] ${
                      isExpired
                        ? "text-slate-400 dark:text-slate-600 line-through"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {formattedCode}
                  </div>

                  {/* Botão Copiar */}
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      disabled={isExpired || loading}
                      onClick={handleCopyCode}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        copied
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                          : "bg-white dark:bg-[#111726] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar código</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Contador regressivo + barra de progresso */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{isExpired ? "Código expirado" : "Expira em"}</span>
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        isExpired
                          ? "text-rose-600 dark:text-rose-400"
                          : remainingMs < 60_000
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {formatCountdown(remainingMs)}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
                        isExpired
                          ? "bg-rose-500"
                          : remainingMs < 60_000
                            ? "bg-amber-500"
                            : "bg-brand-accent dark:bg-white"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Aviso de expiração ou instrução */}
                {isExpired ? (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>
                      Este código expirou. Clique em{" "}
                      <strong>Gerar novo código</strong> para continuar o pareamento.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed px-2">
                    Digite este código no app Relix Mobile no celular. O pareamento será confirmado automaticamente.
                  </p>
                )}
              </div>
            ) : null}

            {/* Rodapé */}
            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={onRegenerate}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50 ${
                  isExpired || !pairingData
                    ? "bg-brand-accent dark:bg-white hover:bg-brand-accent-hover dark:hover:bg-slate-100 text-brand-accent-foreground dark:text-slate-900 shadow-xs"
                    : "border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                <span>Gerar novo código</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
