"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface ScreenRecordingContextType {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

const ScreenRecordingContext = createContext<ScreenRecordingContextType>({
  isRecording: false,
  setIsRecording: () => {},
});

export function ScreenRecordingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isRecording, setIsRecording] = useState(false);

  // Previne recarregar ou fechar a página acidentalmente durante a gravação
  useEffect(() => {
    if (!isRecording) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Uma gravação de tela está em andamento. Se você sair agora, a gravação será perdida.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording]);

  return (
    <ScreenRecordingContext.Provider value={{ isRecording, setIsRecording }}>
      {children}
    </ScreenRecordingContext.Provider>
  );
}

export function useScreenRecording() {
  return useContext(ScreenRecordingContext);
}
