"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

interface User {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
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

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: "none",
                    color: isActive ? "#ffffff" : "var(--text-secondary)",
                    backgroundColor: isActive ? "rgba(99, 102, 241, 0.16)" : "transparent",
                    border: isActive
                      ? "1px solid rgba(99, 102, 241, 0.3)"
                      : "1px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <span
                    style={{
                      color: isActive ? "#818cf8" : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
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
                color: user.role === "ADMIN" ? "#fbbf24" : "#94a3b8",
                display: "inline-block",
              }}
            >
              {user.role === "ADMIN" ? "👑 Administrador" : "👤 Colaborador"}
            </span>
          </div>
        </div>

        <button
          id="btn-sidebar-logout"
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn-ghost"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "0.5rem",
            fontSize: "0.825rem",
            color: "var(--text-muted)",
          }}
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
