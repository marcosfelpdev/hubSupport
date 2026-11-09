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

// POST /api/clients - Criação simples de cliente (apenas nome)
router.post("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Por favor, informe o nome do cliente." });
      return;
    }

    const cleanName = name.trim();

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

