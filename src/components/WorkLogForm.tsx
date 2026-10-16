"use client";

import { useState, useTransition } from "react";
import { createWorkLog } from "@/actions/worklog";

const STATUS_OPTIONS = [
  { value: "Realizado", label: "Já realizado" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Aguardando reunião", label: "Aguardando reunião" },
  { value: "Não foi possível realizar", label: "Não foi possível realizar" },
] as const;

export default function WorkLogForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await createWorkLog(formData);
        if (result?.error) {
          setMessage({ type: "error", text: result.error });
          return;
        }
        form.reset();
        onSuccess?.();
        setMessage({ type: "success", text: "Atendimento registrado com sucesso!" });
      } catch (err) {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.",
        });
      }
    });
  }

  return (
    <div
      className="card animate-fade-in"
      style={{
        borderColor: "rgba(99,102,241,0.2)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginBottom: "1.25rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#818cf8",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Novo Atendimento
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Preencha os dados do suporte prestado
          </p>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`alert animate-fade-in ${message.type === "success" ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: "1rem" }}
        >
          {message.type === "success" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Solicitante */}
        <div>
          <label htmlFor="requester">
            Solicitante <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="requester"
            name="requester"
            type="text"
            className="input-dark"
            placeholder="Nome de quem solicitou o suporte"
            required
            disabled={isPending}
          />
        </div>

        {/* Escritório / Cliente */}
        <div>
          <label htmlFor="clientOrOffice">
            Escritório / Cliente <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="clientOrOffice"
            name="clientOrOffice"
            type="text"
            className="input-dark"
            placeholder="Ex: Matriz SP / Filial RJ / Cliente X"
            required
            disabled={isPending}
          />
        </div>

        {/* Status Dropdown */}
        <div>
          <label htmlFor="status">
            Status <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <select
              id="status"
              name="status"
              className="input-dark"
              defaultValue="Realizado"
              disabled={isPending}
              style={{
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                paddingRight: "2.5rem",
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div
              style={{
                position: "absolute",
                right: "0.875rem",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "var(--text-muted)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        {/* Problema relatado */}
        <div>
          <label htmlFor="reportedProblem">
            Problema relatado <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            id="reportedProblem"
            name="reportedProblem"
            className="input-dark"
            placeholder="Descreva a solicitação ou incidente relatado..."
            rows={3}
            required
            disabled={isPending}
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {/* Ação realizada */}
        <div>
          <label htmlFor="actionTaken">
            Ação realizada <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            id="actionTaken"
            name="actionTaken"
            className="input-dark"
            placeholder="Descreva o que foi feito para resolver ou dar encaminhamento..."
            rows={3}
            required
            disabled={isPending}
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {/* Submit */}
        <button
          id="btn-submit-log"
          type="submit"
          className="btn-primary"
          disabled={isPending}
          style={{ width: "100%", justifyContent: "center", padding: "0.75rem", marginTop: "0.25rem" }}
        >
          {isPending ? (
            <>
              <div className="spinner" />
              Salvando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Salvar
            </>
          )}
        </button>
      </form>
    </div>
  );
}