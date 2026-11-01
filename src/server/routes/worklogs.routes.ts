import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { prisma } from "../../lib/prisma";
import { authenticateToken, requireTechnicianOrAdmin } from "../auth";
import { processAiReportJob } from "../../lib/report-processor";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const RECORDINGS_DIR = path.join(process.cwd(), "storage", "recordings");

// Garante que os diretórios existam
if (!fsSync.existsSync(UPLOAD_DIR)) {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fsSync.existsSync(RECORDINGS_DIR)) {
  fsSync.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// Configuração do Multer com armazenamento customizado
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "recordedVideo") {
      cb(null, RECORDINGS_DIR);
    } else {
      cb(null, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${cleanName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Limite máximo de 100MB
  },
});

// GET /api/worklogs
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const type = req.query.type as string;

    if (type === "technical") {
      const logs = await prisma.workLog.findMany({
        where: {
          OR: [{ technicalAction: true }, { implementation: true }],
          user: {
            role: { not: "TECHNICIAN" },
          },
        },
        include: {
          user: {
            select: { name: true, email: true, role: true },
          },
          tag: true,
          aiReport: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      res.json(logs);
      return;
    }

    if (type === "recent") {
      const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const limit = isNaN(rawLimit) ? 25 : Math.min(Math.max(rawLimit, 1), 100);
      const logs = await prisma.workLog.findMany({
        take: limit,
        include: {
          user: {
            select: { name: true, email: true, role: true },
          },
          tag: true,
          aiReport: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      res.json(logs);
      return;
    }

    if (type === "solved" || type === "solved_technical") {
      const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const limit = isNaN(rawLimit) ? 25 : Math.min(Math.max(rawLimit, 1), 100);
      const logs = await prisma.workLog.findMany({
        where: {
          status: "Solucionado",
        },
        take: limit,
        include: {
          user: {
            select: { name: true, email: true, role: true },
          },
          tag: true,
          aiReport: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      res.json(logs);
      return;
    }

    // Padrão: atendimentos do dia atual
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
          select: { name: true, email: true, role: true },
        },
        tag: true,
        aiReport: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(logs);
  } catch (error) {
    console.error("[WorkLogs] Erro ao buscar atendimentos:", error);
    res.status(500).json({ error: "Erro ao buscar atendimentos." });
  }
});

// GET /api/worklogs/dashboard-summary
router.get("/dashboard-summary", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [recentLogs, solvedLogs, totalCount, solvedCount, todayCount, technicalCount] = await Promise.all([
      // 1. Últimos atendimentos registrados (geral)
      prisma.workLog.findMany({
        take: 25,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { name: true, email: true, role: true },
          },
          tag: true,
          aiReport: true,
        },
      }),
      // 2. Últimos relatórios marcados como Solucionado
      prisma.workLog.findMany({
        where: { status: "Solucionado" },
        take: 25,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { name: true, email: true, role: true },
          },
          tag: true,
          aiReport: true,
        },
      }),
      prisma.workLog.count(),
      prisma.workLog.count({ where: { status: "Solucionado" } }),
      prisma.workLog.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.workLog.count({ where: { OR: [{ technicalAction: true }, { implementation: true }] } }),
    ]);

    res.json({
      recentLogs,
      solvedLogs,
      stats: {
        total: totalCount,
        solved: solvedCount,
        today: todayCount,
        technical: technicalCount,
        inProgress: totalCount - solvedCount,
      },
    });
  } catch (error) {
    console.error("[WorkLogs] Erro ao buscar resumo do dashboard:", error);
    res.status(500).json({ error: "Erro ao carregar dados do dashboard." });
  }
});

// POST /api/worklogs
router.post(
  "/",
  authenticateToken,
  upload.fields([
    { name: "media", maxCount: 10 },
    { name: "recordedVideo", maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const {
        requester,
        clientOrOffice,
        reportedProblem,
        actionTaken,
        status = "Realizado",
        technicalAction,
        implementation,
        tagId,
      } = req.body;

      if (
        !requester?.trim() ||
        !clientOrOffice?.trim() ||
        !reportedProblem?.trim() ||
        !actionTaken?.trim()
      ) {
        res.status(400).json({ error: "Por favor, preencha todos os campos obrigatórios." });
        return;
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      // Processar mídias adicionais
      const mediaPaths: string[] = [];
      if (files?.media) {
        for (const file of files.media) {
          mediaPaths.push(`/uploads/${file.filename}`);
        }
      }

      // Processar vídeo gravado
      let savedRecordingPath: string | null = null;
      if (files?.recordedVideo && files.recordedVideo[0]) {
        savedRecordingPath = path.join(RECORDINGS_DIR, files.recordedVideo[0].filename);
      }

      const isTechnicalAction =
        technicalAction === "on" || technicalAction === "true" || technicalAction === true;
      const isImplementation =
        implementation === "on" || implementation === "true" || implementation === true;

      const cleanTagId = tagId && typeof tagId === "string" && tagId.trim() !== "" ? tagId.trim() : null;

      const newLog = await prisma.workLog.create({
        data: {
          requester: requester.trim(),
          clientOrOffice: clientOrOffice.trim(),
          reportedProblem: reportedProblem.trim(),
          actionTaken: actionTaken.trim(),
          status: status.trim(),
          technicalAction: isTechnicalAction,
          implementation: isImplementation,
          media: JSON.stringify(mediaPaths),
          userId: user.id,
          tagId: cleanTagId,
        },
      });

      // Se houver gravação, cria AiReport e dispara processamento em background
      if (savedRecordingPath) {
        await prisma.aiReport.create({
          data: {
            workLogId: newLog.id,
            status: "pending",
            videoPath: savedRecordingPath,
            startedAt: new Date(),
          },
        });

        setImmediate(() => {
          processAiReportJob(newLog.id).catch((err) => {
            console.error(`[WorkLog] Erro no job em segundo plano para ${newLog.id}:`, err);
          });
        });
      }

      // Se ação técnica/implementação, cria notificação para os técnicos
      if (isTechnicalAction || isImplementation) {
        const technicians = await prisma.user.findMany({
          where: {
            role: "TECHNICIAN",
            active: true,
          },
          select: { id: true },
        });

        if (technicians.length > 0) {
          const typeLabel =
            isTechnicalAction && isImplementation
              ? "Ação Técnica & Implementação"
              : isTechnicalAction
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

      res.status(201).json({ success: true, logId: newLog.id });
    } catch (error) {
      console.error("[WorkLogs] Erro ao criar atendimento:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Erro interno ao salvar atendimento.",
      });
    }
  }
);

// PATCH /api/worklogs/:id/resolve
router.patch(
  "/:id/resolve",
  authenticateToken,
  requireTechnicianOrAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.workLog.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({ error: "Atendimento não encontrado." });
        return;
      }

      const updated = await prisma.workLog.update({
        where: { id },
        data: {
          status: "Solucionado",
        },
      });

      res.json({ success: true, status: updated.status });
    } catch (error) {
      console.error("[WorkLogs] Erro ao solucionar atendimento:", error);
      res.status(500).json({ error: "Erro ao solucionar atendimento." });
    }
  }
);

// PATCH /api/worklogs/:id/status
router.patch(
  "/:id/status",
  authenticateToken,
  requireTechnicianOrAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status || typeof status !== "string") {
        res.status(400).json({ error: "Status inválido ou não informado." });
        return;
      }

      const existing = await prisma.workLog.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({ error: "Atendimento não encontrado." });
        return;
      }

      const updated = await prisma.workLog.update({
        where: { id },
        data: {
          status: status.trim(),
        },
      });

      res.json({ success: true, status: updated.status });
    } catch (error) {
      console.error("[WorkLogs] Erro ao atualizar status:", error);
      res.status(500).json({ error: "Erro ao atualizar status do atendimento." });
    }
  }
);

// POST /api/worklogs/:id/retry-ai
router.post(
  "/:id/retry-ai",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const report = await prisma.aiReport.findUnique({
        where: { workLogId: id },
      });

      if (!report || !report.videoPath) {
        res.status(404).json({ error: "Gravação de vídeo não encontrada para este atendimento." });
        return;
      }

      if (report.status === "processing") {
        res.status(400).json({
          error: "O relatório já está sendo processado no momento. Por favor, aguarde alguns instantes.",
        });
        return;
      }

      try {
        const stats = await fs.stat(report.videoPath);
        if (stats.size === 0) {
          res.status(400).json({ error: "O arquivo de gravação associado está vazio (0 bytes)." });
          return;
        }
      } catch {
        res.status(404).json({ error: "O arquivo de gravação não foi encontrado no servidor." });
        return;
      }

      await prisma.aiReport.update({
        where: { workLogId: id },
        data: {
          status: "pending",
          errorMessage: null,
          startedAt: new Date(),
        },
      });

      setImmediate(() => {
        processAiReportJob(id).catch((err) => {
          console.error(`[WorkLog] Erro no retry do relatório ${id}:`, err);
        });
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[WorkLogs] Erro ao reiniciar relatório de IA:", error);
      res.status(500).json({ error: "Erro ao reiniciar processamento de IA." });
    }
  }
);

// GET /api/worklogs/:id/ai-status
router.get(
  "/:id/ai-status",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const report = await prisma.aiReport.findUnique({
        where: { workLogId: id },
        select: {
          id: true,
          status: true,
          errorMessage: true,
          pdfPath: true,
          videoPath: true,
          completedAt: true,
          startedAt: true,
        },
      });

      if (!report) {
        res.status(404).json({ error: "Relatório de IA não encontrado." });
        return;
      }

      res.json(report);
    } catch (error) {
      console.error("[WorkLogs] Erro ao consultar status da IA:", error);
      res.status(500).json({ error: "Erro ao consultar status da IA." });
    }
  }
);

export default router;
