import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTechnicalWorkLogs } from "@/actions/worklog";
import TechnicianDashboardClient from "./TechnicianDashboardClient";

export const dynamic = "force-dynamic";

export default async function TechnicianPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        ...(session.user.id ? [{ id: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  // Apenas técnicos e administradores têm acesso a esta tela
  if (dbUser.role !== "TECHNICIAN" && dbUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Busca os relatórios com Ação Técnica / Implementação criados por outros cargos
  const logs = await getTechnicalWorkLogs();

  // Funcionários para o filtro
  const employees = await prisma.user.findMany({
    where: { active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main
      className="animate-fade-in"
      style={{
        maxWidth: "1600px",
        padding: "2rem 2.5rem",
        width: "100%",
      }}
    >
      {/* Cabeçalho da página */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Painel de Atendimentos Técnicos
          </h1>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            🔧 Equipe Técnica
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textTransform: "capitalize" }}>
          {today} &bull; Relatórios marcados para ação técnica ou implementação
        </p>
      </div>

      <TechnicianDashboardClient
        logs={logs}
        currentUserId={dbUser.id}
        employees={employees}
      />
    </main>
  );
}
