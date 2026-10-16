"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// Helper para validar se o usuário logado é ADMIN
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id && !session?.user?.email) {
    throw new Error("Não autorizado. Faça login para continuar.");
  }

  const currentUser = await prisma.user.findFirst({
    where: {
      OR: [
        ...(session.user.id ? [{ id: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }

  return currentUser;
}

export async function getEmployees() {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) return [];

  const employees = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      _count: {
        select: { workLogs: true },
      },
    },
    orderBy: [
      { role: "asc" }, // ADMIN antes de USER
      { name: "asc" },
    ],
  });

  return employees;
}

export async function createEmployee(formData: FormData) {
  try {
    await requireAdmin();

    const name = formData.get("name") as string;
    const email = (formData.get("email") as string)?.toLowerCase().trim();
    const password = formData.get("password") as string;
    const role = (formData.get("role") as string) || "USER";

    if (!name?.trim() || !email || !password?.trim()) {
      return { error: "Nome, e-mail e senha são obrigatórios." };
    }

    if (password.length < 6) {
      return { error: "A senha deve ter pelo menos 6 caracteres." };
    }

    // Verificar se e-mail já está em uso
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return { error: "Já existe um funcionário cadastrado com este e-mail." };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name: name.trim(),
        email,
        password: hashedPassword,
        role,
        active: true,
      },
    });

    revalidatePath("/dashboard/funcionarios");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar funcionário:", error);
    return {
      error: error instanceof Error ? error.message : "Erro ao criar funcionário.",
    };
  }
}

export async function updateEmployee(formData: FormData) {
  try {
    await requireAdmin();

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const password = formData.get("password") as string;
    const activeRaw = formData.get("active") as string;
    const role = (formData.get("role") as string) || "USER";

    if (!id || !name?.trim()) {
      return { error: "ID e Nome são obrigatórios." };
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return { error: "Funcionário não encontrado." };
    }

    const updateData: {
      name: string;
      active: boolean;
      role: string;
      password?: string;
    } = {
      name: name.trim(),
      active: activeRaw === "true" || activeRaw === "on",
      role,
    };

    // Atualiza a senha apenas se fornecida
    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return { error: "A nova senha deve ter no mínimo 6 caracteres." };
      }
      updateData.password = await bcrypt.hash(password.trim(), 12);
    }

    // Não permite alterar o email!

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/dashboard/funcionarios");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar funcionário:", error);
    return {
      error: error instanceof Error ? error.message : "Erro ao atualizar funcionário.",
    };
  }
}

export async function deleteEmployee(id: string) {
  try {
    const admin = await requireAdmin();

    if (id === admin.id) {
      return { error: "Você não pode excluir sua própria conta de administrador." };
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return { error: "Funcionário não encontrado." };
    }

    await prisma.user.delete({
      where: { id },
    });

    revalidatePath("/dashboard/funcionarios");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir funcionário:", error);
    return {
      error: error instanceof Error ? error.message : "Erro ao excluir funcionário.",
    };
  }
}
