import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authenticateToken } from "../auth";

const router = Router();

// GET /api/notifications
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      include: {
        workLog: {
          select: {
            id: true,
            requester: true,
            clientOrOffice: true,
            technicalAction: true,
            implementation: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        read: false,
      },
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("[Notifications] Erro ao buscar notificações:", error);
    res.status(500).json({ error: "Erro ao buscar notificações." });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Notifications] Erro ao marcar notificação como lida:", error);
    res.status(500).json({ error: "Erro ao marcar notificação como lida." });
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        read: false,
      },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Notifications] Erro ao marcar todas as notificações como lidas:", error);
    res.status(500).json({ error: "Erro ao marcar todas as notificações como lidas." });
  }
});

export default router;
