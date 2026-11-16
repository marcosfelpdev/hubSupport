import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authenticateToken, requireTechnicianOrAdmin } from "../auth";

const router = Router();

// GET /api/clients - Lista todos os clientes com contagem de atendimentos e reuniões
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        manager: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: {
            workLogs: true,
            events: true,
          },
        },
      },
    });

    // Calcula contagem retroativa baseada em clientOrOffice caso ainda não esteja associado por chave estrangeira
    const enrichedClients = await Promise.all(
      clients.map(async (c) => {
        const [totalWorklogs, totalEvents] = await Promise.all([
          prisma.workLog.count({
            where: {
              OR: [
                { clientId: c.id },
                { clientOrOffice: { equals: c.name, mode: "insensitive" } },
              ],
            },
          }),
          prisma.agendaEvent.count({
            where: {
              OR: [
                { clientId: c.id },
                { title: { contains: c.name, mode: "insensitive" } },
              ],
            },
          }),
        ]);

        return {
          ...c,
          _count: {
            workLogs: totalWorklogs,
            events: totalEvents,
          },
        };
      })
    );

    res.json(enrichedClients);
  } catch (error) {
    console.error("[Clients] Erro ao buscar clientes:", error);
    res.status(500).json({ error: "Erro ao buscar clientes." });
  }
});

// POST /api/clients - Criação de cliente (nome e gestor opcional)
router.post("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, managerId } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Por favor, informe o nome do cliente." });
      return;
    }

    const cleanName = name.trim();

    let cleanManagerId: string | null = null;
    if (managerId !== undefined && managerId !== null && typeof managerId === "string" && managerId.trim() !== "") {
      cleanManagerId = managerId.trim();
      const managerUser = await prisma.user.findUnique({
        where: { id: cleanManagerId },
      });
      if (!managerUser) {
        res.status(400).json({ error: "Gestor informado não encontrado." });
        return;
      }
    }

    // Validação de unicidade case-insensitive
    const existing = await prisma.client.findFirst({
      where: {
        name: { equals: cleanName, mode: "insensitive" },
      },
    });

    if (existing) {
      res.status(409).json({ error: "Já existe um cliente cadastrado com este nome." });
      return;
    }

    const newClient = await prisma.client.create({
      data: {
        name: cleanName,
        ...(cleanManagerId ? { managerId: cleanManagerId } : {}),
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Vincula retroativamente atendimentos existentes com o mesmo nome
    await prisma.workLog.updateMany({
      where: {
        clientOrOffice: { equals: cleanName, mode: "insensitive" },
        clientId: null,
      },
      data: {
        clientId: newClient.id,
      },
    });

    // Vincula retroativamente compromissos na agenda que mencionam o cliente
    await prisma.agendaEvent.updateMany({
      where: {
        title: { contains: cleanName, mode: "insensitive" },
        clientId: null,
      },
      data: {
        clientId: newClient.id,
      },
    });

    res.status(201).json({ success: true, client: newClient });
  } catch (error) {
    console.error("[Clients] Erro ao cadastrar cliente:", error);
    res.status(500).json({ error: "Erro interno ao cadastrar cliente." });
  }
});

// GET /api/clients/:id - Detalhes do perfil do cliente com histórico de reuniões e atendimentos
router.get("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: "Cliente não encontrado." });
      return;
    }

    // Busca reuniões da agenda associadas ao cliente
    const events = await prisma.agendaEvent.findMany({
      where: {
        OR: [
          { clientId: client.id },
          { title: { contains: client.name, mode: "insensitive" } },
        ],
      },
      orderBy: [{ date: "desc" }, { time: "desc" }],
      include: {
        employee: {
          select: { id: true, name: true, email: true, role: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Busca histórico de atendimentos e chamados realizados para este cliente
    const workLogs = await prisma.workLog.findMany({
      where: {
        OR: [
          { clientId: client.id },
          { clientOrOffice: { equals: client.name, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        tag: true,
        aiReport: true,
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    res.json({
      client,
      events,
      workLogs,
      stats: {
        totalWorkLogs: workLogs.length,
        totalEvents: events.length,
        solvedWorkLogs: workLogs.filter((w) => w.status === "Solucionado").length,
        pendingWorkLogs: workLogs.filter((w) => w.status !== "Solucionado").length,
      },
    });
  } catch (error) {
    console.error("[Clients] Erro ao obter perfil do cliente:", error);
    res.status(500).json({ error: "Erro ao buscar histórico do cliente." });
  }
});

// PUT /api/clients/:id - Atualiza dados do cliente (nome e/ou gestor pessoal)
router.put("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, managerId } = req.body;

    const existingClient = await prisma.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      res.status(404).json({ error: "Cliente não encontrado." });
      return;
    }

    let cleanName: string | undefined = undefined;
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "Nome do cliente inválido." });
        return;
      }
      cleanName = name.trim();

      // Valida duplicidade de nome excluindo o próprio cliente
      if (cleanName !== existingClient.name) {
        const duplicate = await prisma.client.findFirst({
          where: {
            id: { not: id },
            name: { equals: cleanName, mode: "insensitive" },
          },
        });

        if (duplicate) {
          res.status(409).json({ error: "Já existe outro cliente cadastrado com este nome." });
          return;
        }
      }
    }

    let cleanManagerId: string | null | undefined = undefined;
    if (managerId !== undefined) {
      if (managerId === null || (typeof managerId === "string" && managerId.trim() === "")) {
        cleanManagerId = null;
      } else if (typeof managerId === "string") {
        const trimmedId = managerId.trim();
        const user = await prisma.user.findUnique({
          where: { id: trimmedId },
        });
        if (!user) {
          res.status(400).json({ error: "Gestor informado não encontrado." });
          return;
        }
        cleanManagerId = trimmedId;
      } else {
        res.status(400).json({ error: "ID do gestor inválido." });
        return;
      }
    }

    // Se o nome foi alterado, atualiza referências retroativas em atendimentos
    if (cleanName && cleanName !== existingClient.name) {
      await prisma.workLog.updateMany({
        where: {
          OR: [
            { clientId: existingClient.id },
            { clientOrOffice: { equals: existingClient.name, mode: "insensitive" } },
          ],
        },
        data: {
          clientOrOffice: cleanName,
          clientId: existingClient.id,
        },
      });

      await prisma.agendaEvent.updateMany({
        where: { clientId: existingClient.id },
        data: {
          clientId: existingClient.id,
        },
      });
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(cleanName !== undefined ? { name: cleanName } : {}),
        ...(cleanManagerId !== undefined ? { managerId: cleanManagerId } : {}),
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.json({ success: true, client: updated });
  } catch (error) {
    console.error("[Clients] Erro ao atualizar cliente:", error);
    res.status(500).json({ error: "Erro interno ao atualizar cliente." });
  }
});

// DELETE /api/clients/:id - Remoção de cliente (apenas administradores ou técnicos)
router.delete(
  "/:id",
  authenticateToken,
  requireTechnicianOrAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.client.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({ error: "Cliente não encontrado." });
        return;
      }

      await prisma.client.delete({
        where: { id },
      });

      res.json({ success: true, message: "Cliente removido com sucesso." });
    } catch (error) {
      console.error("[Clients] Erro ao excluir cliente:", error);
      res.status(500).json({ error: "Erro interno ao excluir cliente." });
    }
  }
);

export default router;

