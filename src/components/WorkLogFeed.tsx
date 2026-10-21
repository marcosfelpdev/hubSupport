
export interface WorkLog {
  id: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  media: string;
  createdAt: Date;
  userId: string;
  user: {
    name: string;
    email: string;
  };
  aiReport?: {
    id: string;
    status: string;
    videoPath?: string | null;
    pdfPath?: string | null;
    structuredData?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | string | null;
    completedAt?: Date | string | null;
  } | null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return formatTime(date);
}

const avatarColors = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function getAvatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "Solucionado":
      return {
        label: "Solucionado",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.15)",
        border: "rgba(16, 185, 129, 0.35)",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      };
    case "Realizado":
    case "Já realizado":
      return {
        label: "Já realizado",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.3)",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      };
    case "Em andamento":
      return {
        label: "Em andamento",
        color: "#60a5fa",
        bg: "rgba(59, 130, 246, 0.12)",
        border: "rgba(59, 130, 246, 0.3)",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      };
    case "Aguardando reunião":
      return {
        label: "Aguardando reunião",
        color: "#fbbf24",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.3)",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      };
    case "Não foi possível realizar":
      return {
        label: "Não foi possível realizar",
        color: "#f87171",
        bg: "rgba(239, 68, 68, 0.12)",
        border: "rgba(239, 68, 68, 0.3)",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
      };
    default:
      return {
        label: status || "Registrado",
        color: "#818cf8",
        bg: "rgba(99, 102, 241, 0.12)",
        border: "rgba(99, 102, 241, 0.25)",
        icon: null,
      };
  }
}

export default function WorkLogFeed({
  logs,
  currentUserId,
}: {
  logs: WorkLog[];
  currentUserId: string;
}) {
  return (
    <div className="animate-fade-in">
      {/* Feed header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <h2
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Feed de Atendimentos
          </h2>
          {logs.length > 0 && (
            <span className="badge badge-accent">
              {logs.length} {logs.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Atualizado automaticamente
        </span>
      </div>

      {/* Empty state */}
      {logs.length === 0 && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem 1.5rem",
            borderStyle: "dashed",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              color: "#6366f1",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            Nenhum atendimento registrado hoje
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Preencha o formulário ao lado para registrar o primeiro chamado do dia.
          </p>
        </div>
      )}

      {/* Log entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {logs.map((log, index) => {
          const isOwn = log.userId === currentUserId;
          const avatarColor = getAvatarColor(log.userId);
          const statusConfig = getStatusBadgeConfig(log.status);

          return (
            <div
              key={log.id}
              className="card card-hover animate-fade-in"
              style={{
                animationDelay: `${index * 0.05}s`,
                borderColor: isOwn ? "rgba(99,102,241,0.25)" : "var(--border)",
                position: "relative",
              }}
            >
              {/* Header row: Author + Badges */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.875rem",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                {/* Author Info */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <div
                    className="avatar"
                    style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}aa)` }}
                  >
                    {getInitials(log.user.name)}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {log.user.name}
                      </p>
                      {isOwn && (
                        <span className="badge badge-accent" style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}>
                          Você
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Registrado {formatRelative(log.createdAt)} • {formatTime(log.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: statusConfig.color,
                    background: statusConfig.bg,
                    border: `1px solid ${statusConfig.border}`,
                  }}
                >
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </div>

              {/* Meta tags: Solicitante & Escritório/Cliente */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.875rem",
                }}
              >
                {/* Solicitante */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "6px",
                    fontSize: "0.78rem",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Solicitante:</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{log.requester}</span>
                </div>

                {/* Escritório / Cliente */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    background: "rgba(99, 102, 241, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "6px",
                    fontSize: "0.78rem",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span style={{ color: "#a5b4fc", fontSize: "0.72rem" }}>Local/Cliente:</span>
                  <span style={{ color: "#e0e7ff", fontWeight: 600 }}>{log.clientOrOffice}</span>
                </div>
              </div>

              {/* Sections: Problema Relatado & Ação Realizada */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {/* Problema relatado */}
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.625rem 0.875rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#f87171",
                      marginBottom: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Problema relatado
                  </p>
                  <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {log.reportedProblem}
                  </p>
                </div>

                {/* Ação realizada */}
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.625rem 0.875rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#34d399",
                      marginBottom: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Ação realizada
                  </p>
                  <p style={{ fontSize: "0.825rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                    {log.actionTaken}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
