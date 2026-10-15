import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWorkLogs } from "@/actions/worklog";
import WorkLogForm from "@/components/WorkLogForm";
import WorkLogFeed from "@/components/WorkLogFeed";
import { prisma } from "@/lib/prisma";

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
        maxWidth: "1400px",
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

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <StatCard
            label="Total Hoje"
            value={logs.length}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
            color="#6366f1"
          />
          <StatCard
            label="Realizados"
            value={logs.filter((l) => l.status === "Realizado" || l.status === "Já realizado").length}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
            color="#10b981"
          />
          <StatCard
            label="Em Andamento"
            value={logs.filter((l) => l.status === "Em andamento").length}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            color="#3b82f6"
          />
          <StatCard
            label="Aguardando Reunião"
            value={logs.filter((l) => l.status === "Aguardando reunião").length}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
            color="#f59e0b"
          />
        </div>

        {/* Main layout: Form + Feed */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: "1.5rem",
            alignItems: "start",
          }}
        >
          {/* Left: Form */}
          <div style={{ position: "sticky", top: "1.5rem" }}>
            <WorkLogForm />
          </div>

          {/* Right: Feed */}
          <div>
            <WorkLogFeed logs={logs} currentUserId={dbUser.id} />
          </div>
        </div>
      </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  isText = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  isText?: boolean;
}) {
  return (
    <div
      className="card animate-fade-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "10px",
          background: `${color}20`,
          border: `1px solid ${color}35`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.125rem" }}>
          {label}
        </p>
        <p
          style={{
            fontSize: isText ? "0.95rem" : "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
