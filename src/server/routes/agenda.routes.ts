import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authenticateToken } from "../auth";

const router = Router();

// GET /api/agenda - Lista todos os compromissos compartilhados
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await prisma.agendaEvent.findMany({
      orderBy: [
        { date: "asc" },
        { time: "asc" },
      ],
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(events);
  } catch (error) {
    console.error("[Agenda] Erro ao listar eventos da agenda:", error);
    res.status(500).json({ error: "Erro ao buscar eventos da agenda." });
  }
});

// POST /api/agenda - Criação de novo compromisso na agenda compartilhada
router.post("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, date, time = "10:00", category = "Reunião", employeeId, clientId } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "O título do compromisso é obrigatório." });
      return;
    }

    if (!date || typeof date !== "string" || !date.trim()) {
      res.status(400).json({ error: "A data do compromisso é obrigatória." });
      return;
    }

    const user = req.user!;

    let resolvedClientId = clientId && typeof clientId === "string" && clientId.trim() ? clientId.trim() : null;
    if (!resolvedClientId && title) {
      const allClients = await prisma.client.findMany({ select: { id: true, name: true } });
      const matched = allClients.find((c) => title.toLowerCase().includes(c.name.toLowerCase()));
      if (matched) {
        resolvedClientId = matched.id;
      }
    }

    // Cria o evento na agenda
    const newEvent = await prisma.agendaEvent.create({
      data: {
        title: title.trim(),
        date: date.trim(),
        time: (time && typeof time === "string" ? time.trim() : "10:00"),
        category: (category && typeof category === "string" ? category.trim() : "Reunião"),
        completed: false,
        employeeId: employeeId && typeof employeeId === "string" && employeeId.trim() ? employeeId.trim() : null,
        createdById: user.id,
        clientId: resolvedClientId,
        notificationSent: false,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({ success: true, event: newEvent });
  } catch (error) {
    console.error("[Agenda] Erro ao criar compromisso:", error);
    res.status(500).json({ error: "Erro ao salvar compromisso na agenda." });
  }
});

// PATCH /api/agenda/:id - Atualização de status (concluído) ou dados do evento
router.patch("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { completed, title, date, time, category, employeeId, clientId } = req.body;

    const dataToUpdate: Record<string, unknown> = {};

    if (typeof completed === "boolean") {
      dataToUpdate.completed = completed;
    }

    if (title && typeof title === "string" && title.trim()) {
      dataToUpdate.title = title.trim();
    }

    if (date && typeof date === "string" && date.trim()) {
      dataToUpdate.date = date.trim();
    }

    if (time && typeof time === "string" && time.trim()) {
      dataToUpdate.time = time.trim();
    }

    if (category && typeof category === "string" && category.trim()) {
      dataToUpdate.category = category.trim();
    }

    if (employeeId !== undefined) {
      dataToUpdate.employeeId = employeeId && typeof employeeId === "string" && employeeId.trim() ? employeeId.trim() : null;
      // Reseta aviso de notificação se trocar funcionário
      dataToUpdate.notificationSent = false;
    }

    if (clientId !== undefined) {
      dataToUpdate.clientId = clientId && typeof clientId === "string" && clientId.trim() ? clientId.trim() : null;
    }

    const updatedEvent = await prisma.agendaEvent.update({
      where: { id },
      data: dataToUpdate,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error("[Agenda] Erro ao atualizar compromisso:", error);
    res.status(500).json({ error: "Erro ao atualizar compromisso." });
  }
});

// DELETE /api/agenda/:id - Remoção de compromisso
router.delete("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    await prisma.agendaEvent.delete({
      where: { id },
    });

    res.json({ success: true, message: "Compromisso removido com sucesso." });
  } catch (error) {
    console.error("[Agenda] Erro ao excluir compromisso:", error);
    res.status(500).json({ error: "Erro ao excluir compromisso." });
  }
});

export default router;

