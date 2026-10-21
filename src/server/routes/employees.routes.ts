import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { authenticateToken, requireAdmin } from "../auth";

const router = Router();

// GET /api/employees
// Se ADMIN: retorna detalhes completos + contagem de worklogs
// Se não ADMIN: retorna apenas nomes e IDs dos ativos para preenchimento de filtros
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (user.role === "ADMIN") {
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
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });
      res.json(employees);
      return;
    }

    // Para usuários comuns: apenas ativos para filtros
    const employees = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });
    res.json(employees);
  } catch (error) {
    console.error("[Employees] Erro ao buscar funcionários:", error);
    res.status(500).json({ error: "Erro ao buscar funcionários." });
  }
});

// POST /api/employees
router.post("/", authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = "USER" } = req.body;

    if (!name?.trim() || !email || !password?.trim()) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      res.status(400).json({ error: "Já existe um funcionário cadastrado com este e-mail." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newEmployee = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role,
        active: true,
      },
    });

    res.status(201).json({ success: true, id: newEmployee.id });
  } catch (error) {
    console.error("[Employees] Erro ao criar funcionário:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao criar funcionário.",
    });
  }
});

// PUT /api/employees/:id
router.put("/:id", authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, password, active, role = "USER" } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Nome é obrigatório." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      res.status(404).json({ error: "Funcionário não encontrado." });
      return;
    }

    const updateData: {
      name: string;
      active: boolean;
      role: string;
      password?: string;
    } = {
      name: name.trim(),
      active: active === true || active === "true" || active === "on",
      role,
    };

    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
        return;
      }
      updateData.password = await bcrypt.hash(password.trim(), 12);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Employees] Erro ao atualizar funcionário:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao atualizar funcionário.",
    });
  }
});

// DELETE /api/employees/:id
router.delete("/:id", authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminUser = req.user!;

    if (id === adminUser.id) {
      res.status(400).json({ error: "Você não pode excluir sua própria conta de administrador." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      res.status(404).json({ error: "Funcionário não encontrado." });
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Employees] Erro ao excluir funcionário:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao excluir funcionário.",
    });
  }
});

export default router;
