import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogIn, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xs text-white mx-auto mb-3.5">
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            HubSupport
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Log de Atendimentos — Equipe de Suporte
          </p>
        </div>

        {/* Central Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-7 sm:p-8">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Entrar no sistema
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Informe suas credenciais para acessar o painel de atendimento
            </p>
          </div>

          {error && (
            <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3.5 flex items-center gap-2.5 animate-fade-in shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none disabled:bg-slate-50"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 outline-none disabled:bg-slate-50"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl py-3 px-6 text-sm shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-5 mt-6 text-center">
            <p className="text-xs text-slate-400">
              Acesso restrito à equipe de suporte autorizada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
