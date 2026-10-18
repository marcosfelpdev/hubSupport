"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Video, Square } from "lucide-react";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

    if (isRecording) {
      stopRecording();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setErrorMessage("Seu navegador não suporta captura de tela nativa.");
      return;
    }

    try {
      // 1. Captura a tela (com áudio do sistema se o usuário marcar/permitir)
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "monitor",
          },
          audio: true,
        });
      } catch (displayErr) {
        const err = displayErr as Error;
        if (err.name === "NotAllowedError") {
          console.log("Seleção de tela cancelada pelo suporte.");
          return;
        }
        // Fallback: tenta capturar apenas o vídeo se falhou pelo áudio do sistema
        console.warn("Falha ao capturar com áudio do sistema, tentando vídeo:", displayErr);
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        } catch (retryErr) {
          const rErr = retryErr as Error;
          if (rErr.name === "NotAllowedError") {
            console.log("Seleção de tela cancelada pelo suporte.");
            return;
          }
          throw retryErr;
        }
      }

      displayStreamRef.current = displayStream;

      // 2. Captura o microfone do suporte para registrar sua fala durante o atendimento
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
        console.warn("Não foi possível acessar o microfone do suporte:", micErr);
      }

      // 3. Mixagem do áudio do sistema/chamada com o microfone do suporte usando AudioContext
      const displayAudioTracks = displayStream.getAudioTracks();
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
          console.warn("Erro ao mixar áudios via AudioContext, priorizando microfone:", mixErr);
          finalAudioTracks = [micAudioTracks[0]];
        }
      } else if (micAudioTracks.length > 0) {
        finalAudioTracks = [micAudioTracks[0]];
      } else if (displayAudioTracks.length > 0) {
        finalAudioTracks = [displayAudioTracks[0]];
      }

      // 4. Cria o stream final unindo a captura de tela e a faixa de áudio (mixada ou microfone)
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

      recorder.onstop = () => {
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

        const fileName = `gravacao-${new Date().toISOString().slice(0, 10)}-${Date.now()}.${extension}`;
        const videoFile = new File([videoBlob], fileName, {
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
        className={isRecording ? "" : "btn-secondary"}
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
          background: isRecording
            ? "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)"
            : "rgba(99, 102, 241, 0.08)",
          color: isRecording ? "#fca5a5" : "#a5b4fc",
          border: isRecording
            ? "1px solid rgba(239, 68, 68, 0.5)"
            : "1px solid rgba(99, 102, 241, 0.3)",
          boxShadow: isRecording
            ? "0 0 15px rgba(239, 68, 68, 0.25)"
            : "none",
        }}
        title={isRecording ? "Clique para finalizar a gravação" : "Gravar tela com áudio para gerar relatório automático com IA"}
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
    </div>
  );
}
