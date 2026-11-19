import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authenticateToken, requireAdmin } from "../auth";

const router = Router();

// Função auxiliar para gerar slug amigável
function generateSlug(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "categoria_" + Date.now();
}

// GET /api/categories - Lista categorias (ativas por padrão, ou todas se admin solicitar ?all=true)
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const showAll = req.query.all === "true" && req.user?.role === "ADMIN";

    const categories = await prisma.workLogCategory.findMany({
      where: showAll ? undefined : { active: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { workLogs: true },
        },
      },
    });

    res.json(categories);
  } catch (error) {
    console.error("[Categories] Erro ao listar categorias:", error);
    res.status(500).json({ error: "Erro ao buscar categorias de atendimento." });
  }
});

// GET /api/categories/:id - Detalhes de uma categoria
router.get("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const category = await prisma.workLogCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { workLogs: true },
        },
      },
    });

    if (!category) {
      res.status(404).json({ error: "Categoria de atendimento não encontrada." });
      return;
    }

    res.json(category);
  } catch (error) {
    console.error("[Categories] Erro ao buscar categoria:", error);
    res.status(500).json({ error: "Erro ao buscar detalhes da categoria." });
  }
});

// POST /api/categories - Criação de categoria (Apenas ADMIN)
router.post("/", authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      subtitle,
      icon = "cog",
      color = "#3b82f6",
      notifyRole,
      targetKanban = true,
      lockStatus = true,
      targetStatus = "Backlog",
      active = true,
      order,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "O nome da categoria é obrigatório." });
      return;
    }

    const trimmedName = name.trim();

    // Gerar slug único
    let slug = generateSlug(trimmedName);
    const existingSlug = await prisma.workLogCategory.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}_${Date.now().toString(36)}`;
    }

    // Se order não for fornecido, colocar no fim
    let finalOrder = typeof order === "number" ? order : 0;
    if (order === undefined || order === null) {
      const last = await prisma.workLogCategory.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      finalOrder = (last?.order ?? 0) + 1;
    }

    const category = await prisma.workLogCategory.create({
      data: {
        slug,
        name: trimmedName,
        subtitle: subtitle && typeof subtitle === "string" ? subtitle.trim() : null,
        icon: icon || "cog",
        color: color || "#3b82f6",
        notifyRole: notifyRole || null,
        targetKanban: Boolean(targetKanban),
        lockStatus: Boolean(lockStatus),
        targetStatus: targetStatus || "Backlog",
        active: active !== undefined ? Boolean(active) : true,
        order: finalOrder,
      },
      include: {
        _count: {
          select: { workLogs: true },
        },
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error("[Categories] Erro ao criar categoria:", error);
    res.status(500).json({ error: "Erro ao criar categoria de atendimento." });
  }
});

// PUT /api/categories/:id - Atualização de categoria (Apenas ADMIN)
router.put("/:id", authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      name,
      subtitle,
      icon,
      color,
      notifyRole,
      targetKanban,
      lockStatus,
      targetStatus,
      active,
      order,
    } = req.body;

    const existing = await prisma.workLogCategory.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Categoria de atendimento não encontrada." });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "O nome da categoria não pode ser vazio." });
        return;
      }
      updateData.name = name.trim();
    }

    if (subtitle !== undefined) {
      updateData.subtitle = typeof subtitle === "string" && subtitle.trim() ? subtitle.trim() : null;
    }

    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (notifyRole !== undefined) updateData.notifyRole = notifyRole || null;
    if (targetKanban !== undefined) updateData.targetKanban = Boolean(targetKanban);
    if (lockStatus !== undefined) updateData.lockStatus = Boolean(lockStatus);
    if (targetStatus !== undefined) updateData.targetStatus = targetStatus || "Backlog";
    if (active !== undefined) updateData.active = Boolean(active);
    if (order !== undefined) updateData.order = Number(order);

    const updated = await prisma.workLogCategory.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { workLogs: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("[Categories] Erro ao atualizar categoria:", error);
    res.status(500).json({ error: "Erro ao atualizar categoria de atendimento." });
  }
});

// DELETE /api/categories/:id - Exclusão de categoria (Apenas ADMIN)
router.delete("/:id", authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.workLogCategory.findUnique({
      where: { id },
      include: { _count: { select: { workLogs: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: "Categoria de atendimento não encontrada." });
      return;
    }

    // Se houver chamados vinculados e não foi forçado, desvincula com SetNull
    await prisma.workLogCategory.delete({
      where: { id },
    });

    res.json({ message: "Categoria excluída com sucesso.", id });
  } catch (error) {
    console.error("[Categories] Erro ao excluir categoria:", error);
    res.status(500).json({ error: "Erro ao excluir categoria de atendimento." });
  }
});

export default router;
