"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createWorkLog(formData: FormData) {
  try {
    const session = await auth();

    if (!session?.user?.id && !session?.user?.email) {
      return { error: "Não autorizado. Por favor, faça login novamente." };
    }

    // Busca o usuário real no banco pelo ID ou pelo email para garantir que o foreign key exista
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
    });

    if (!user) {
      return { error: "Sessão inválida ou expirada. Por favor, faça login novamente." };
    }

    const requester = formData.get("requester") as string;
    const clientOrOffice = formData.get("clientOrOffice") as string;
    const reportedProblem = formData.get("reportedProblem") as string;
    const actionTaken = formData.get("actionTaken") as string;
    const status = (formData.get("status") as string) || "Realizado";

    if (!requester?.trim() || !clientOrOffice?.trim() || !reportedProblem?.trim() || !actionTaken?.trim()) {
      return { error: "Por favor, preencha todos os campos obrigatórios." };
    }

    await prisma.workLog.create({
      data: {
        requester: requester.trim(),
        clientOrOffice: clientOrOffice.trim(),
        reportedProblem: reportedProblem.trim(),
        actionTaken: actionTaken.trim(),
        status: status.trim(),
        userId: user.id,
      },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao registrar atendimento:", error);
    return {
      error: error instanceof Error ? error.message : "Erro interno ao salvar atendimento.",
    };
  }
}

export async function getWorkLogs() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const logs = await prisma.workLog.findMany({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return logs;
}
