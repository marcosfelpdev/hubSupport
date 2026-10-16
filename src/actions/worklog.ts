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

    await prisma.workLog.create({
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
