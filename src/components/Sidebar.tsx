import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useScreenRecording } from "@/contexts/ScreenRecordingContext";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export default function Sidebar({ user }: { user: User }) {
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const { isRecording } = useScreenRecording();
  const { logout } = useAuth();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const isTechnician = user.role === "TECHNICIAN" || user.role === "ADMIN";
  const isAdmin = user.role === "ADMIN";

  const navItems = [
    {
      href: "/dashboard",
      label: "Atendimentos",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      exact: true,
    },
    ...(isTechnician
      ? [
          {
            href: "/dashboard/tecnico",
            label: "Painel Técnico",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            ),
            exact: false,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/dashboard/funcionarios",
            label: "Funcionários",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
            exact: false,
          },
        ]
      : []),
  ];

  return (
    <aside
      style={{
        width: "260px",
        height: "100vh",
        position: "sticky",
        top: 0,
        backgroundColor: "#080c16",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "1.25rem 1rem",
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Top: Logo & Nav */}
      <div>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.5rem 0.5rem 1.5rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <span
              style={{
                fontWeight: 700,
                fontSize: "1.05rem",
                background: "linear-gradient(135deg, #818cf8, #c084fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.01em",
                display: "block",
              }}
            >
              HubSupport
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                display: "block",
                marginTop: "-1px",
              }}
            >
              Portal da Equipe
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <div>
          {isRecording && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.625rem",
                borderRadius: "6px",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
                fontSize: "0.72rem",
                fontWeight: 600,
                marginBottom: "0.875rem",
                lineHeight: 1.3,
                boxShadow: "0 0 10px rgba(239, 68, 68, 0.15)",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 8px #ef4444",
                  flexShrink: 0,
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span>Gravando tela: outras abas bloqueadas</span>
            </div>
          )}

          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
              padding: "0 0.5rem 0.5rem",
            }}
          >
            Menu Principal
          </p>

          <nav style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);

              // Bloqueia acesso às outras abas quando a gravação estiver em andamento
              const isBlocked = isRecording && !isActive;

              return (
                <Link
                  key={item.href}
                  to={isBlocked ? "#" : item.href}
                  onClick={(e) => {
                    if (isBlocked) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  tabIndex={isBlocked ? -1 : 0}
                  aria-disabled={isBlocked}
                  title={
                    isBlocked
                      ? "Acesso bloqueado durante a gravação de tela. Finalize a gravação para trocar de aba."
                      : undefined
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: "none",
                    color: isBlocked
                      ? "rgba(148, 163, 184, 0.35)"
                      : isActive
                        ? "#ffffff"
                        : "var(--text-secondary)",
                    backgroundColor: isActive ? "rgba(99, 102, 241, 0.16)" : "transparent",
                    border: isActive
                      ? "1px solid rgba(99, 102, 241, 0.3)"
                      : "1px solid transparent",
                    opacity: isBlocked ? 0.38 : 1,
                    cursor: isBlocked ? "not-allowed" : "pointer",
                    pointerEvents: isBlocked ? "none" : "auto",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive && !isBlocked) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive && !isBlocked) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <span
                    style={{
                      color: isBlocked
                        ? "rgba(148, 163, 184, 0.3)"
                        : isActive
                          ? "#818cf8"
                          : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isBlocked && (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ opacity: 0.6, flexShrink: 0 }}
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom: Current User Info & Logout */}
      <div
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          paddingTop: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.5rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            marginBottom: "0.75rem",
          }}
        >
          <div
            className="avatar"
            style={{
              width: "36px",
              height: "36px",
              background: user.role === "ADMIN"
                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                : "linear-gradient(135deg, #6366f1, #7c3aed)",
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <p
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name}
              </p>
            </div>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              color:
                user.role === "ADMIN"
                  ? "#fbbf24"
                  : user.role === "MANAGER"
                    ? "#a855f7"
                    : user.role === "TECHNICIAN"
                      ? "#38bdf8"
                      : user.role === "SUPPORT"
                        ? "#22d3ee"
                        : "#94a3b8",
              display: "inline-block",
            }}
          >
            {user.role === "ADMIN"
              ? "👑 Administrador"
              : user.role === "MANAGER"
                ? "🧑‍💼 Gestor"
                : user.role === "TECHNICIAN"
                  ? "🔧 Técnico"
                  : user.role === "SUPPORT"
                    ? "🎧 Suporte"
                    : "👤 Colaborador"}
          </span>
          </div>
        </div>

        <button
          id="btn-sidebar-logout"
          onClick={handleLogout}
          disabled={loggingOut || isRecording}
          className="btn-ghost"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "0.5rem",
            fontSize: "0.825rem",
            color: isRecording ? "rgba(148, 163, 184, 0.35)" : "var(--text-muted)",
            opacity: isRecording ? 0.4 : 1,
            cursor: isRecording ? "not-allowed" : "pointer",
          }}
          title={isRecording ? "Finalize a gravação de tela antes de sair da conta" : undefined}
        >
          {loggingOut ? (
            <div className="spinner" style={{ width: "14px", height: "14px", borderTopColor: "var(--text-muted)" }} />
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair da conta
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
