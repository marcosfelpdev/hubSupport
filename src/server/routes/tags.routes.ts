import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authenticateToken } from "../auth";

const router = Router();

// GET /api/tags - Lista todas as tags cadastradas com contagem de chamados
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { workLogs: true },
        },
      },
    });

    res.json(tags);
  } catch (error) {
    console.error("[Tags] Erro ao buscar tags:", error);
    res.status(500).json({ error: "Erro ao buscar tags." });
  }
});

// POST /api/tags - Criação de nova tag
router.post("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color = "#3b82f6" } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "O nome da tag é obrigatório." });
      return;
    }

    const trimmedName = name.trim();

    // Validação de unicidade
    const existing = await prisma.tag.findUnique({
      where: { name: trimmedName },
    });

    if (existing) {
      res.status(400).json({ error: "Já existe uma tag com este nome." });
      return;
    }

    const newTag = await prisma.tag.create({
      data: {
        name: trimmedName,
        color: color && typeof color === "string" ? color.trim() : "#3b82f6",
      },
      include: {
        _count: {
          select: { workLogs: true },
        },
      },
    });

    res.status(201).json({ success: true, tag: newTag });
  } catch (error) {
    console.error("[Tags] Erro ao criar tag:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno ao cadastrar tag.",
    });
  }
});

// PUT /api/tags/:id - Edição de tag existente
router.put("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "O nome da tag é obrigatório." });
      return;
    }

    const trimmedName = name.trim();

    const tag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      res.status(404).json({ error: "Tag não encontrada." });
      return;
    }

    // Se o nome foi alterado, checa duplicidade
    if (tag.name.toLowerCase() !== trimmedName.toLowerCase()) {
      const duplicate = await prisma.tag.findUnique({
        where: { name: trimmedName },
      });
      if (duplicate && duplicate.id !== id) {
        res.status(400).json({ error: "Já existe outra tag com este nome." });
        return;
      }
    }

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: {
        name: trimmedName,
        ...(color && typeof color === "string" ? { color: color.trim() } : {}),
      },
      include: {
        _count: {
          select: { workLogs: true },
        },
      },
    });

    res.json({ success: true, tag: updatedTag });
  } catch (error) {
    console.error("[Tags] Erro ao atualizar tag:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno ao atualizar tag.",
    });
  }
});

// DELETE /api/tags/:id - Remoção de tag
router.delete("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      res.status(404).json({ error: "Tag não encontrada." });
      return;
    }

    await prisma.tag.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Tags] Erro ao excluir tag:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno ao excluir tag.",
    });
  }
});

export default router;

