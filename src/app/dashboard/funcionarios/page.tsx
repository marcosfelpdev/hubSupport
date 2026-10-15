import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEmployees } from "@/actions/employees";
import EmployeesManager from "@/components/EmployeesManager";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage() {
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

  const employees = await getEmployees();

  return (
    <EmployeesManager
      initialEmployees={employees}
      currentUser={{
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      }}
    />
  );
}
