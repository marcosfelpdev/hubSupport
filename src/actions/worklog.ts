"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

async function saveUploadedFile(file: File): Promise<string> {
  await ensureUploadDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, buffer);
  return `/uploads/${fileName}`;
}

export async function createWorkLog(formData: FormData) {
  try {
    const session = await auth();

    if (!session?.user?.id && !session?.user?.email) {
      return { error: "Não autorizado. Por favor, faça login novamente." };
    }

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
    const technicalAction = formData.get("technicalAction") === "on";
    const implementation = formData.get("implementation") === "on";

    if (!requester?.trim() || !clientOrOffice?.trim() || !reportedProblem?.trim() || !actionTaken?.trim()) {
      return { error: "Por favor, preencha todos os campos obrigatórios." };
    }

    // Processar arquivos de mídia
    const mediaFiles = formData.getAll("media") as File[];
    const mediaPaths: string[] = [];

    for (const file of mediaFiles) {
      if (file && file.size > 0) {
        const savedPath = await saveUploadedFile(file);
        mediaPaths.push(savedPath);
      }
    }

    const newLog = await prisma.workLog.create({
      data: {
        requester: requester.trim(),
        clientOrOffice: clientOrOffice.trim(),
        reportedProblem: reportedProblem.trim(),
        actionTaken: actionTaken.trim(),
        status: status.trim(),
        technicalAction,
        implementation,
        media: JSON.stringify(mediaPaths),
        userId: user.id,
      },
    });

    // Se marcado como Ação Técnica e/ou Implementação, notifica todos os usuários do cargo técnico
    if (technicalAction || implementation) {
      const technicians = await prisma.user.findMany({
        where: {
          role: "TECHNICIAN",
          active: true,
        },
        select: { id: true },
      });

      if (technicians.length > 0) {
        const typeLabel =
          technicalAction && implementation
            ? "Ação Técnica & Implementação"
            : technicalAction
              ? "Ação Técnica"
              : "Implementação";

        await prisma.notification.createMany({
          data: technicians.map((tech) => ({
            userId: tech.id,
            workLogId: newLog.id,
            title: `Novo chamado: ${typeLabel}`,
            message: `${user.name} registrou um atendimento para "${clientOrOffice.trim()}" que requer atuação técnica.`,
            read: false,
          })),
        });
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/tecnico");
    return { success: true, logId: newLog.id };
  } catch (error) {
    console.error("Erro ao registrar atendimento:", error);
    return {
      error: error instanceof Error ? error.message : "Erro interno ao salvar atendimento.",
    };
  }
}

export async function getWorkLogs() {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) return [];

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

// Busca apenas os relatórios que foram criados por outros cargos e marcados como Ação Técnica e/ou Implementação
export async function getTechnicalWorkLogs() {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) return [];

  const logs = await prisma.workLog.findMany({
    where: {
      OR: [
        { technicalAction: true },
        { implementation: true },
      ],
      user: {
        role: { not: "TECHNICIAN" },
      },
    },
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return logs;
}

// Define o relatório como Solucionado pela equipe técnica
export async function resolveWorkLog(workLogId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return { error: "Não autorizado. Por favor, faça login novamente." };
    }

    const existing = await prisma.workLog.findUnique({
      where: { id: workLogId },
    });

    if (!existing) {
      return { error: "Atendimento não encontrado." };
    }

    const updated = await prisma.workLog.update({
      where: { id: workLogId },
      data: {
        status: "Solucionado",
      },
    });

    revalidatePath("/dashboard/tecnico");
    revalidatePath("/dashboard");
    return { success: true, status: updated.status };
  } catch (error) {
    console.error("Erro ao solucionar atendimento:", error);
    return {
      error: error instanceof Error ? error.message : "Erro ao solucionar atendimento.",
    };
  }
}
