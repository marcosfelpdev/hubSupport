"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Video,
  Square,
  Volume2,
  VolumeX,
  AlertTriangle,
  Monitor,
  RefreshCw,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";
import fixWebmDuration from "fix-webm-duration";

interface ScreenRecorderButtonProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
}

export default function ScreenRecorderButton({
  onRecordingComplete,
  disabled = false,
}: ScreenRecorderButtonProps) {
  const { setIsRecording: setGlobalIsRecording } = useScreenRecording();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados da trava de áudio do sistema
  const [showAudioRequiredModal, setShowAudioRequiredModal] = useState(false);
  const [audioBlockReason, setAudioBlockReason] = useState<"not_enabled" | "window_selected" | "general">("not_enabled");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Determina o formato de gravação suportado pelo navegador
  const getSupportedMimeType = useCallback(() => {
    if (typeof window === "undefined" || !window.MediaRecorder) {
      return { mimeType: "video/webm", extension: "webm" };
    }

    const types = [
      { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
      { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
      { mimeType: "video/webm", extension: "webm" },
      { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
      { mimeType: "video/mp4", extension: "mp4" },
    ];

    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t.mimeType)) {
        return t;
      }
    }

    return { mimeType: "", extension: "webm" };
  }, []);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      displayStreamRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      micStreamRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    setGlobalIsRecording(false);
  }, [setGlobalIsRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Erro ao parar MediaRecorder:", err);
      }
    }
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    setShowAudioRequiredModal(false);

    if (isRecording) {
      stopRecording();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setErrorMessage("Seu navegador não suporta captura de tela nativa.");
      return;
    }

    try {
      // 1. Captura a tela com diretivas otimizadas para Chromium (Chrome, Edge):
      // - displaySurface: "monitor" prioriza a aba 'Tela inteira'
      // - systemAudio: "include" instrui o navegador a marcar e requerer o áudio do sistema
      // - selfBrowserSurface: "exclude" previne capturar a aba do HubSupport em loop
      const displayOptions: DisplayMediaStreamOptions & Record<string, unknown> = {
        video: {
          displaySurface: "monitor",
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        systemAudio: "include",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        monitorTypeSurfaces: "include",
      };

      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
      } catch (displayErr) {
        const err = displayErr as Error;
        if (err.name === "NotAllowedError") {
          console.log("Seleção de tela cancelada pelo suporte.");
          return;
        }
        console.error("Erro ao solicitar captura de tela:", displayErr);
        setErrorMessage(err.message || "Não foi possível abrir o seletor de tela.");
        return;
      }

      // =========================================================================
      // TRAVA DE SEGURANÇA: ÁUDIO DO SISTEMA OBRIGATÓRIO PARA TRANSCRIÇÃO DE IA
      // Se o operador não ativou a chave "Compartilhar com áudio do sistema"
      // ou selecionou uma janela individual sem áudio, a gravação é travada na hora!
      // =========================================================================
      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length === 0) {
        const videoTrack = displayStream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings?.();
        const surface = settings?.displaySurface;

        // Finaliza imediatamente todas as trilhas abertas para não manter a gravação ativa
        displayStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        displayStreamRef.current = null;

        if (surface === "window") {
          setAudioBlockReason("window_selected");
        } else {
          setAudioBlockReason("not_enabled");
        }

        setShowAudioRequiredModal(true);
        return;
      }

      displayStreamRef.current = displayStream;

      // 2. Captura o microfone do suporte para registrar sua fala durante o atendimento (opcional)
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        micStreamRef.current = micStream;
      } catch (micErr) {
        console.warn("Não foi possível acessar o microfone do suporte (gravando apenas som do sistema):", micErr);
      }

      // 3. Mixagem do áudio do sistema com o microfone do suporte usando AudioContext
      const micAudioTracks = micStream ? micStream.getAudioTracks() : [];
      let finalAudioTracks: MediaStreamTrack[] = [];

      if (displayAudioTracks.length > 0 && micAudioTracks.length > 0) {
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;

          if (audioCtx.state === "suspended") {
            await audioCtx.resume();
          }

          const destination = audioCtx.createMediaStreamDestination();

          const displaySource = audioCtx.createMediaStreamSource(
            new MediaStream([displayAudioTracks[0]])
          );
          displaySource.connect(destination);

          const micSource = audioCtx.createMediaStreamSource(
            new MediaStream([micAudioTracks[0]])
          );
          micSource.connect(destination);

          finalAudioTracks = destination.stream.getAudioTracks();
        } catch (mixErr) {
          console.warn("Erro ao mixar áudios via AudioContext, priorizando áudio do sistema:", mixErr);
          finalAudioTracks = [displayAudioTracks[0]];
        }
      } else {
        // Sem microfone, utiliza o áudio do sistema garantido pela trava
        finalAudioTracks = [displayAudioTracks[0]];
      }

      // 4. Cria o stream final unindo a captura de tela e a faixa de áudio garantida
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...finalAudioTracks,
      ]);

      streamRef.current = combinedStream;
      chunksRef.current = [];

      const { mimeType, extension } = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

      const recorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setGlobalIsRecording(false);
        cleanupStream();

        if (chunksRef.current.length === 0) {
          setErrorMessage("Nenhum dado de vídeo foi capturado.");
          return;
        }

        const actualMime = recorder.mimeType || mimeType || "video/webm";
        const videoBlob = new Blob(chunksRef.current, { type: actualMime });

        if (videoBlob.size === 0) {
          setErrorMessage("O vídeo gravado está vazio.");
          return;
        }

        const durationMs = Math.max(1000, Date.now() - (recordingStartTimeRef.current || Date.now()));
        let finalBlob: Blob = videoBlob;

        if (extension === "webm") {
          try {
            finalBlob = await fixWebmDuration(videoBlob, durationMs, { logger: false });
          } catch (err) {
            console.warn("[ScreenRecorder] Falha ao injetar duração no WebM, usando blob original:", err);
          }
        }

        const fileName = `gravacao-${new Date().toISOString().slice(0, 10)}-${Date.now()}.${extension}`;
        const videoFile = new File([finalBlob], fileName, {
          type: actualMime,
          lastModified: Date.now(),
        });

        // Dispara o callback para anexar ao formulário e abrir o modal
        onRecordingComplete(videoFile);
      };

      // Listener para caso o usuário cancele o compartilhamento pela barra flutuante do SO/navegador
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopRecording();
        };
      }

      // Inicia a gravação capturando chunks a cada 1 segundo
      recorder.start(1000);
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setGlobalIsRecording(true);
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      cleanupStream();
      setIsRecording(false);
      setGlobalIsRecording(false);
      const error = err as Error;
      if (error.name === "NotAllowedError") {
        console.log("Gravação cancelada pelo usuário.");
      } else {
        console.error("Erro ao iniciar gravação de tela:", err);
        setErrorMessage(error.message || "Não foi possível iniciar a gravação.");
      }
    }
  };

  useEffect(() => {
    return () => {
      cleanupStream();
      setGlobalIsRecording(false);
    };
  }, [cleanupStream, setGlobalIsRecording]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSec % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
      <button
        type="button"
        id="btn-screen-recording"
        onClick={startRecording}
        disabled={disabled}
        className={isRecording ? "" : "brand-recorder-btn"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.625rem 1rem",
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          ...(isRecording
            ? {
                background:
                  "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                boxShadow: "0 0 15px rgba(239, 68, 68, 0.25)",
              }
            : {
                boxShadow: "none",
              }),
        }}
        title={isRecording ? "Clique para finalizar a gravação" : "Gravar tela com áudio obrigatório para gerar relatório automático com IA"}
      >
        {isRecording ? (
          <>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                boxShadow: "0 0 8px #ef4444",
                animation: "pulse 1.5s infinite",
              }}
            />
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
              {formatTimer(elapsedSeconds)}
            </span>
            <span style={{ marginLeft: "0.25rem" }}>Finalizar Gravação</span>
            <Square size={14} fill="#ef4444" stroke="#ef4444" />
          </>
        ) : (
          <>
            <Video size={16} strokeWidth={2} />
            <span>Gravação de Tela</span>
          </>
        )}
      </button>

      {/* Indicador de áudio ativo em tempo real durante a gravação */}
      {isRecording && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "#34d399",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            padding: "0.2rem 0.5rem",
            borderRadius: "6px",
            marginTop: "0.2rem",
          }}
          title="Áudio do sistema sendo gravado com sucesso para transcrição da IA"
        >
          <Volume2 size={12} style={{ animation: "pulse 1.5s infinite" }} />
          <span>Áudio do sistema ativo</span>
        </div>
      )}

      {errorMessage && (
        <span
          style={{
            color: "#f87171",
            fontSize: "0.75rem",
            marginTop: "0.25rem",
          }}
        >
          {errorMessage}
        </span>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE TRAVA DE SEGURANÇA: ÁUDIO DO SISTEMA OBRIGATÓRIO               */}
      {/* ========================================================================= */}
      {showAudioRequiredModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowAudioRequiredModal(false)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6 sm:p-7 overflow-hidden text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Efeito sutil de brilho no topo */}
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Botão fechar */}
            <button
              type="button"
              onClick={() => setShowAudioRequiredModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>

            {/* Cabeçalho */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 shadow-inner">
                <VolumeX size={26} strokeWidth={2.2} />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-1.5">
                  <AlertTriangle size={12} />
                  Trava de Segurança de Gravação
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Áudio do Sistema Obrigatório
                </h3>
              </div>
            </div>

            {/* Explicação da trava */}
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              A gravação <strong>não foi iniciada</strong> porque o som da reunião não foi compartilhado. Para que a inteligência artificial (Gemini) consiga transcrever os diálogos dos participantes e gerar o relatório do atendimento, o áudio do sistema é indispensável.
            </p>

            {/* Alerta específico se selecionou Janela */}
            {audioBlockReason === "window_selected" && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2 mb-4 leading-relaxed">
                <Monitor size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span>
                  <strong>Atenção:</strong> Você selecionou uma <em>Janela individual</em>. No Windows, os navegadores só transmitem o áudio do sistema ao escolher a aba <strong>&ldquo;Tela inteira&rdquo;</strong>.
                </span>
              </div>
            )}

            {/* Reprodução Visual do Diálogo do Navegador */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 mb-5 shadow-inner">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
                Como habilitar na janela do navegador:
              </span>

              {/* Caixa simulando a barra inferior do seletor */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-blue-500/50 shadow-md">
                <div className="flex items-center gap-2 text-slate-200 text-xs sm:text-sm font-semibold">
                  <Volume2 size={18} className="text-blue-400 shrink-0" />
                  <span>Compartilhar com áudio do sistema</span>
                </div>
                {/* Switch ativo simulado */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-400 hidden sm:inline">ATIVAR</span>
                  <div className="w-10 h-5 bg-blue-600 rounded-full relative p-0.5 shadow-sm transition-all flex items-center justify-end pr-0.5">
                    <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-amber-300/90 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Escolha <strong>Tela inteira</strong> e marque a chave acima no canto inferior esquerdo.</span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAudioRequiredModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAudioRequiredModal(false);
                  startRecording();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>Tentar Novamente</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
