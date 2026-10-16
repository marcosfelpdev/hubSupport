import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWorkLogs } from "@/actions/worklog";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Verifica se o usuário da sessão existe no banco de dados (previne sessão órfã pós reset)
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

  const logs = await getWorkLogs();

  // Busca todos os funcionários ativos para o filtro
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
      }}
    >
        {/* Page title */}
        <div style={{ marginBottom: "2rem" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "0.25rem",
            }}
          >
            Dashboard de Atendimentos
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textTransform: "capitalize" }}>
            {today}
          </p>
        </div>

        <DashboardClient logs={logs} currentUserId={dbUser.id} employees={employees} />
      </main>
  );
}
