
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

  return (
    <header
      style={{
        height: "58px",
        position: "sticky",
        top: 0,
        zIndex: 35,
        backgroundColor: "rgba(8, 12, 22, 0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
      }}
    >
      {/* Lado esquerdo: Indicador discreto */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {user.role === "TECHNICIAN" && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              fontSize: "0.72rem",
              fontWeight: 600,
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.25)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#38bdf8",
                boxShadow: "0 0 6px #38bdf8",
              }}
            />
            Equipe Técnica Online
          </span>
        )}

        {isRecording && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.2rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#fca5a5",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              boxShadow: "0 0 12px rgba(239, 68, 68, 0.25)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                boxShadow: "0 0 8px #ef4444",
                animation: "pulse 1.5s infinite",
              }}
            />
            Gravação em andamento (navegação bloqueada)
          </span>
        )}
      </div>

      {/* Lado direito: Notificações (Sino na parte superior direita) */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {isTechnician && <NotificationBell />}
      </div>
    </header>
  );
}
