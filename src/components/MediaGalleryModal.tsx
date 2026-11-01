"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download, FileText, Video } from "lucide-react";

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrls: string[];
  initialIndex?: number;
}

const isImage = (url: string) => {
  return /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
};

const isVideo = (url: string) => {
  return /\.(mp4|webm|ogg|mov)$/i.test(url);
};

export default function MediaGalleryModal({
  isOpen,
  onClose,
  mediaUrls,
  initialIndex = 0,
}: MediaGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < mediaUrls.length - 1;

  const handlePrev = () => {
    if (canGoPrev) setCurrentIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (canGoNext) setCurrentIndex((prev) => prev + 1);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (currentIndex < mediaUrls.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, currentIndex, mediaUrls.length]);

  if (!isOpen || mediaUrls.length === 0) return null;

  const activeUrl = mediaUrls[currentIndex] || mediaUrls[0];

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header da Galeria */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Mídias Anexadas
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs">
              {currentIndex + 1} de {mediaUrls.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Baixar arquivo original"
            >
              <Download size={14} />
              <span>Baixar Arquivo</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Palco Central: Seta Esquerda + Mídia + Seta Direita */}
        <div className="w-full flex-1 min-h-[280px] max-h-[60vh] flex items-center justify-center gap-3 sm:gap-4 my-4">
          {mediaUrls.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              disabled={!canGoPrev}
              aria-label="Mídia anterior"
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs p-2.5 rounded-full disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 active:scale-95"
              title={canGoPrev ? "Mídia anterior (Seta esquerda)" : "Primeira mídia"}
            >
              <ChevronLeft size={24} />
            </button>
          )}

          <div className="flex-1 h-full min-h-[260px] flex items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs p-2 sm:p-4 overflow-hidden relative">
            {isImage(activeUrl) ? (
              <img
                src={activeUrl}
                alt={`Mídia ${currentIndex + 1}`}
                className="max-h-full max-w-full object-contain rounded-xl select-none shadow-xs"
              />
            ) : isVideo(activeUrl) ? (
              <video
                src={activeUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-xl bg-black"
              />
            ) : (
              <div className="p-6 text-center flex flex-col items-center gap-2">
                <FileText size={44} className="text-slate-400 mx-auto mb-1" />
                <p className="text-sm font-semibold text-slate-800">Arquivo anexado</p>
                <p className="text-xs text-slate-500 break-all max-w-xs">{activeUrl}</p>
                <a
                  href={activeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  <Download size={14} />
                  <span>Baixar Arquivo</span>
                </a>
              </div>
            )}
          </div>

          {mediaUrls.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Próxima mídia"
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs p-2.5 rounded-full disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 active:scale-95"
              title={canGoNext ? "Próxima mídia (Seta direita)" : "Última mídia"}
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        {/* Rail de Miniaturas Inferior */}
        {mediaUrls.length > 1 && (
          <div className="flex items-center justify-center gap-2.5 pt-2 max-w-full overflow-x-auto shrink-0 px-2">
            {mediaUrls.map((url, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border transition-all shrink-0 cursor-pointer relative bg-white ${
                    isSelected
                      ? "ring-2 ring-slate-900 border-slate-900 shadow-md scale-105 opacity-100"
                      : "border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-400"
                  }`}
                  title={`Ir para mídia ${idx + 1}`}
                >
                  {isImage(url) ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : isVideo(url) ? (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <Video size={16} />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <FileText size={16} />
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0.5 right-1 text-[9px] font-bold px-1 rounded ${
                      isSelected
                        ? "bg-slate-900 text-white"
                        : "bg-white/90 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

