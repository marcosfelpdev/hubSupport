import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirecionamento de retorno pós-login ou default /dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "E-mail ou senha inválidos. Tente novamente.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at top, rgba(99,102,241,0.12) 0%, #030712 60%)",
        padding: "1rem",
      }}
    >
      {/* Background mesh */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(167,139,250,0.06) 0%, transparent 40%),
            radial-gradient(circle at 60% 80%, rgba(99,102,241,0.05) 0%, transparent 40%)
          `,
          pointerEvents: "none",
        }}
      />

      <div
        className="animate-fade-in"
        style={{ width: "100%", maxWidth: "400px", position: "relative" }}
      >
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              boxShadow: "0 8px 32px rgba(99,102,241,0.35)",
            }}
          >
            <svg
              width="28"
              height="28"
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
          <h1
            className="gradient-text"
            style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}
          >
            HubSupport
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Log de Atendimentos — Equipe de Suporte
          </p>
        </div>

        {/* Card */}
        <div
          className="glass"
          style={{
            borderRadius: "1rem",
            padding: "2rem",
            boxShadow:
              "0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)",
          }}
        >
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "1.5rem",
            }}
          >
            Entrar no sistema
          </h2>

          {error && (
            <div className="alert alert-error animate-fade-in" style={{ marginBottom: "1rem" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                className="input-dark"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                className="input-dark"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="btn-login"
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem", padding: "0.75rem" }}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Entrando...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="divider" />

          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Acesso restrito à equipe de suporte autorizada.
          </p>
        </div>
      </div>
    </div>
  );
}
