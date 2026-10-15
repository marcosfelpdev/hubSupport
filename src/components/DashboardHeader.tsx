"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

interface User {
  name?: string | null;
  email?: string | null;
  id?: string | null;
}

export default function DashboardHeader({ user }: { user: User }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header
      className="glass"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 1.5rem",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
              background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
            }}
          >
            <svg
              width="18"
              height="18"
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
                fontSize: "1rem",
                background: "linear-gradient(135deg, #6366f1, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              HubSupport
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                display: "block",
                marginTop: "-2px",
              }}
            >
              Log de Atendimentos
            </span>
          </div>
        </div>

        {/* Nav center - timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <CurrentTime />
        </div>

        {/* User area */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {user.name}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {user.email}
            </span>
          </div>
          <div className="avatar">{initials}</div>
          <button
            id="btn-logout"
            onClick={handleLogout}
            disabled={loggingOut}
            className="btn-ghost"
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
          >
            {loggingOut ? (
              <div className="spinner" style={{ borderTopColor: "var(--text-secondary)" }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

function CurrentTime() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  if (typeof window !== "undefined") {
    setTimeout(() => {
      setTime(
        new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
    }, 30000);
  }

  return <span>{time}</span>;
}
