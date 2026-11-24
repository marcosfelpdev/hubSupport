"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Loader2,
  Video,
  AlertCircle,
} from "lucide-react";
import { api, WorkLogItem } from "@/services/api";
import { WorkLogDetailData } from "@/components/dashboard/WorkLogDetailContent";

export interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  log?: WorkLogItem | WorkLogDetailData | null;
  videoUrl?: string | null;
  title?: string;
  clientName?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  onClose,
  log,
  videoUrl,
  title,
  clientName,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados de reprodução
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState<boolean>(false);

  // Determina URL de visualização inline e URL de download
  const { streamUrl, downloadUrl } = useMemo(() => {
    if (videoUrl) {
      return { streamUrl: videoUrl, downloadUrl: videoUrl };
    }
    if (log?.id) {
      return {
        streamUrl: api.worklogs.getViewRecordingUrl(log.id),
        downloadUrl: api.worklogs.getDownloadRecordingUrl(log.id),
      };
    }
    return { streamUrl: "", downloadUrl: "" };
  }, [videoUrl, log?.id]);

  const displayTitle = useMemo(() => {
    if (title) return title;
    if (log?.title) return log.title;
    if (log?.clientOrOffice) return `Gravação • ${log.clientOrOffice}`;
    return "Gravação de Tela";
  }, [title, log?.title, log?.clientOrOffice]);

  const displayClient = useMemo(() => {
    if (clientName) return clientName;
    if (log?.clientOrOffice) return log.clientOrOffice;
    return "";
  }, [clientName, log?.clientOrOffice]);

  const formattedDate = useMemo(() => {
    if (!log?.createdAt) return "";
    try {
      return new Date(log.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [log?.createdAt]);

  // Reseta estados quando o modal abre ou a URL muda
  useEffect(() => {
    if (isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBufferedTime(0);
      setIsBuffering(true);
      setHasError(false);
      setShowControls(true);
    }
  }, [isOpen, streamUrl]);

  // Sincroniza listener de Fullscreen nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Ocultação automática de controles após 2.5s sem interação enquanto o vídeo estiver tocando
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying]);

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[VideoPlayer] Autoplay prevenido ou erro ao iniciar:", err);
          setIsPlaying(false);
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Pular 5 segundos para trás ou frente
  const seekRelative = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.currentTime + delta, videoRef.current.duration || Infinity));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  // Alterar volume
  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  // Alterar velocidade de reprodução
  const cyclePlaybackRate = () => {
    if (!videoRef.current) return;
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const nextRate = rates[nextIndex];
    videoRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  // Toggle Tela Cheia
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Seek na linha do tempo
  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * (duration || 0);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Suporte a atalhos de teclado (Space, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, M, F, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora atalhos caso o foco esteja em algum input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handleVolumeChange(volume + 0.1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleVolumeChange(volume - 0.1);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, togglePlay, seekRelative, toggleMute, volume]);

  // Atualização de buffer e tempo do vídeo
  const handleTimeUpdate = () => {
    if (!videoRef.current || isDraggingSeek) return;
    setCurrentTime(videoRef.current.currentTime);

    // Atualiza buffer
    if (videoRef.current.buffered.length > 0) {
      try {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBufferedTime(bufferedEnd);
      } catch {
        // ignore
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isFinite(dur) && !isNaN(dur)) {
      setDuration(dur);
    }
    setIsBuffering(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 dark:bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl w-full flex flex-col shadow-2xl shadow-slate-900/40 overflow-hidden transition-all duration-300 relative max-w-4xl max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================
           Header Superior com Identidade Relix
           ============================================================ */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] flex items-center justify-between gap-4 shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Video size={16} />
            </div>
            <div className="min-w-0">
              <h4
                className="text-sm font-bold text-slate-900 dark:text-white truncate"
                title={displayTitle}
              >
                {displayTitle}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {displayClient && <span>{displayClient}</span>}
                {formattedDate && <span> • Gravado em {formattedDate}</span>}
                {log?.tag && (
                  <span className="ml-1 text-slate-400 dark:text-slate-500">
                    • {log.tag.name}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Ações da Barra Superior */}
          <div className="flex items-center gap-2 shrink-0">
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-[#1c273e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Baixar arquivo original de gravação"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Baixar Gravação</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar reprodutor de vídeo (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ============================================================
           Palco Central do Player (Aspect-Video com Controls Overlay)
           ============================================================ */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          className={`relative w-full bg-black flex items-center justify-center overflow-hidden group select-none ${
            isFullscreen ? "h-screen w-screen" : "aspect-video max-h-[70vh]"
          }`}
        >
          {/* Elemento de Vídeo */}
          {streamUrl ? (
            <video
              ref={videoRef}
              src={streamUrl}
              preload="metadata"
              playsInline
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => {
                setIsBuffering(false);
                setIsPlaying(true);
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                setShowControls(true);
              }}
              onError={() => {
                setHasError(true);
                setIsBuffering(false);
              }}
              className="w-full h-full object-contain cursor-pointer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-8 text-center">
              <AlertCircle size={36} className="text-amber-500" />
              <p className="text-sm font-medium">Nenhum vídeo disponível para reprodução.</p>
            </div>
          )}

          {/* Estado de Erro */}
          {hasError && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center text-white gap-3 z-20">
              <AlertCircle size={40} className="text-rose-500" />
              <p className="text-sm font-semibold">Não foi possível reproduzir este vídeo na plataforma.</p>
              <p className="text-xs text-slate-400 max-w-sm">
                O arquivo pode estar corrompido ou o navegador não suporta este codec diretamente.
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/20"
                >
                  <Download size={14} />
                  <span>Baixar arquivo para assistir localmente</span>
                </a>
              )}
            </div>
          )}

          {/* Spinner de Buffering */}
          {isBuffering && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10">
              <div className="p-3.5 rounded-full bg-black/70 backdrop-blur-xs border border-white/10 shadow-xl">
                <Loader2 size={32} className="text-white animate-spin" />
              </div>
            </div>
          )}

          {/* Overlay de Play Central (aparece quando pausado) */}
          {!isPlaying && !isBuffering && !hasError && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/40 transition-colors z-10 cursor-pointer group"
              aria-label="Reproduzir vídeo"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-2xl transform group-hover:scale-105 active:scale-95 transition-all pl-1">
                <Play size={28} className="fill-slate-900" />
              </div>
            </button>
          )}

          {/* ============================================================
             Barra de Controles Customizada (Bottom Floating Overlay)
             ============================================================ */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-30 flex flex-col gap-2 ${
              showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Scrubber / Linha do Tempo */}
            <div
              ref={progressBarRef}
              onClick={handleSeek}
              className="w-full h-2 bg-white/20 hover:h-2.5 rounded-full cursor-pointer relative flex items-center transition-all duration-150 group/timeline"
              title="Avançar / Retroceder na gravação"
            >
              {/* Barra de Buffer */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(0, bufferPercent))}%` }}
              />

              {/* Barra de Progresso Real */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-brand-accent dark:bg-white rounded-full transition-all duration-75 relative flex items-center justify-end"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              >
                {/* Thumb / Bolinha indicadora no hover */}
                <div className="w-3.5 h-3.5 bg-white text-slate-900 rounded-full shadow-md transform translate-x-1.5 opacity-0 group-hover/timeline:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Linha de Controles Inferiores */}
            <div className="flex items-center justify-between gap-3 text-white text-xs">
              {/* Grupo Esquerdo: Play/Pause, -5s, +5s, Tempo, Volume */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
                </button>

                {/* Voltar 5s */}
                <button
                  type="button"
                  onClick={() => seekRelative(-5)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  title="Voltar 5 segundos (Seta esquerda)"
                >
                  <RotateCcw size={16} />
                </button>

                {/* Avançar 5s */}
                <button
                  type="button"
                  onClick={() => seekRelative(5)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  title="Avançar 5 segundos (Seta direita)"
                >
                  <RotateCw size={16} />
                </button>

                {/* Volume e Mute */}
                <div className="flex items-center gap-1.5 group/volume">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                    title={isMuted ? "Desmutar (M)" : "Mutar (M)"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={17} className="text-rose-400" />
                    ) : volume < 0.5 ? (
                      <Volume1 size={17} />
                    ) : (
                      <Volume2 size={17} />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-14 sm:w-18 h-1 bg-white/30 hover:bg-white/50 rounded-lg appearance-none cursor-pointer accent-white"
                    title="Volume (Seta cima / baixo)"
                  />
                </div>

                {/* Tempo: Atual / Duração */}
                <span className="text-[11px] font-mono text-slate-300 ml-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Grupo Direito: Velocidade, Tela Cheia */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Seletor de Velocidade */}
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-mono font-semibold transition-colors cursor-pointer"
                  title="Alternar velocidade de reprodução"
                >
                  {playbackRate}x
                </button>

                {/* Botão Tela Cheia */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
                >
                  {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VideoPlayerModal;
