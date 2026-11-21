import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Copy,
  Download,
  QrCode,
  Smartphone,
  X,
} from "lucide-react";
import { resolveApiUrl } from "@/services/api";

interface AppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppDownloadModal({
  isOpen,
  onClose,
}: AppDownloadModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rawUrl = resolveApiUrl("/api/phone-finder/apk");
  const downloadUrl =
    rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : typeof window !== "undefined"
      ? `${window.location.origin}${rawUrl}`
      : rawUrl;

  const isLocalhostUrl =
    downloadUrl.includes("://localhost") || downloadUrl.includes("://127.0.0.1");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-download-modal-title"
        className="w-full max-w-md bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900">
              <QrCode className="w-4 h-4" />
            </span>
            <div>
              <h2
                id="app-download-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white leading-tight"
              >
                Instalar Relix Mobile
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Relix Mobile • Android 8.0+
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 flex flex-col items-center text-center gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <QRCodeSVG
              value={downloadUrl}
              size={196}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              <span>Aponte a câmera do celular para baixar o APK</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
              Instale o aplicativo Relix Mobile no celular e digite o código de 6 dígitos
              gerado em qualquer card desta tela.
            </p>
          </div>

          {isLocalhostUrl && (
            <div className="w-full text-left text-[11px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 rounded-xl px-3 py-2">
              Você está acessando via <strong>localhost</strong>. Para escanear
              pelo celular, abra o Relix na URL de produção ou pelo IP da
              rede local.
            </div>
          )}

          {/* Ações */}
          <div className="w-full flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Link copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar link</span>
                </>
              )}
            </button>

            <a
              href={downloadUrl}
              download="relix-mobile.apk"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar APK</span>
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
