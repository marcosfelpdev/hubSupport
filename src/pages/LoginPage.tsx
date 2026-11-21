import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogIn, AlertCircle } from "lucide-react";
import RelixLogo from "@/components/common/RelixLogo";

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
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#090d16] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <RelixLogo variant="full" height={48} className="mb-2" />
          <h1 className="sr-only">Relix</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acesse sua conta no Relix
          </p>
        </div>

        {/* Central Card */}
        <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-7 sm:p-8">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Entrar no sistema
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Informe suas credenciais para acessar o painel de atendimento
            </p>
          </div>

          {error && (
            <div className="mb-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl p-3.5 flex items-center gap-2.5 animate-fade-in shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800"
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
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800"
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
              className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-xl py-3 px-6 text-sm shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
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

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-6 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Acesso restrito à equipe de suporte autorizada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
