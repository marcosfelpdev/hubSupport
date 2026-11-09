import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { prisma } from "../../lib/prisma";
import { uploadFileFromDisk, uploadBuffer, fileExists, deleteFile } from "../services/r2Storage";
import { authenticateToken, requireTechnicianOrAdmin, requireTechnicianManagerOrAdmin, requireAdmin } from "../auth";
import { processAiReportJob } from "../../lib/report-processor";

const router = Router();

const defaultWorkLogInclude = {
  user: {
    select: { id: true, name: true, email: true, role: true },
  },
  assignedTo: {
    select: { id: true, name: true, email: true, role: true },
  },
  tag: true,
  aiReport: true,
  client: {
    select: { id: true, name: true },
  },
  statusHistory: {
    include: {
      changedBy: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
};


const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const RECORDINGS_DIR = path.join(process.cwd(), "storage", "recordings");
const TEMP_DIR = path.join(process.cwd(), "storage", "temp");

// Garante que os diretórios existam
if (!fsSync.existsSync(UPLOAD_DIR)) {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fsSync.existsSync(RECORDINGS_DIR)) {
  fsSync.mkdirSync(RECORDINGS_DIR, { recursive: true });
}
if (!fsSync.existsSync(TEMP_DIR)) {
  fsSync.mkdirSync(TEMP_DIR, { recursive: true });
}

// Configuração do Multer com armazenamento temporário em disco para evitar OOM no Render
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${cleanName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // Limite máximo de 1GB (1024MB)
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
        include: defaultWorkLogInclude,
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
        include: defaultWorkLogInclude,
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
        include: defaultWorkLogInclude,
        orderBy: {
          createdAt: "desc",
        },
      });
      res.json(logs);
      return;
    }

        // Filtro por período de datas ou todos os atendimentos por padrão
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;

    const whereClause: any = {};

    if (startDateParam || endDateParam) {
      whereClause.createdAt = {};
      if (startDateParam) {
        const [y, m, d] = startDateParam.split("-").map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        whereClause.createdAt.gte = start;
      }
      if (endDateParam) {
        const [y, m, d] = endDateParam.split("-").map(Number);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    } else if (type === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      whereClause.createdAt = {
        gte: today,
        lt: tomorrow,
      };
    }

    const logs = await prisma.workLog.findMany({
      where: whereClause,
      include: defaultWorkLogInclude,
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
        include: defaultWorkLogInclude,
      }),
      // 2. Últimos relatórios marcados como Solucionado
      prisma.workLog.findMany({
        where: { status: "Solucionado" },
        take: 25,
        orderBy: { createdAt: "desc" },
        include: defaultWorkLogInclude,
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
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const tempFilesToClean: string[] = [];

    // Rastreia todos os arquivos gravados temporariamente no disco para limpeza garantida
    if (files?.media) {
      for (const file of files.media) {
        if (file.path) tempFilesToClean.push(file.path);
      }
    }
    if (files?.recordedVideo) {
      for (const file of files.recordedVideo) {
        if (file.path) tempFilesToClean.push(file.path);
      }
    }

    try {
      const user = req.user!;
      const {
        title,
        requester,
        clientOrOffice,
        reportedProblem,
        description,
        actionTaken,
        status = "Realizado",
        technicalAction,
        implementation,
        tagId,
        clientId,
      } = req.body;

      const finalTitle = (title || "").trim();
      const finalDescription = (reportedProblem || description || "").trim();
      const cleanTagId = tagId && typeof tagId === "string" && tagId.trim() !== "" ? tagId.trim() : null;

      if (
        !finalTitle ||
        !requester?.trim() ||
        !clientOrOffice?.trim() ||
        !finalDescription ||
        !cleanTagId
      ) {
        res.status(400).json({
          error: "Por favor, preencha todos os campos obrigatórios (título, solicitante, escritório/cliente, descrição e tag).",
        });
        return;
      }

      // Processar mídias adicionais via streaming do disco para o R2 (RAM constante)
      const mediaPaths: string[] = [];
      if (files?.media) {
        for (const file of files.media) {
          const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `uploads/${Date.now()}-${cleanName}`;
          await uploadFileFromDisk(file.path, key, file.mimetype || "application/octet-stream");
          mediaPaths.push(`/${key}`);
        }
      }

      // Processar vídeo gravado via streaming do disco para o R2 (RAM constante)
      let savedRecordingPath: string | null = null;
      if (files?.recordedVideo && files.recordedVideo[0]) {
        const videoFile = files.recordedVideo[0];
        const cleanName = videoFile.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `storage/recordings/${Date.now()}-${cleanName}`;
        await uploadFileFromDisk(videoFile.path, key, videoFile.mimetype || "video/webm");
        savedRecordingPath = key;
      }

      const isTechnicalAction =
        technicalAction === "on" || technicalAction === "true" || technicalAction === true;
      const isImplementation =
        implementation === "on" || implementation === "true" || implementation === true;

      // Se for ação técnica ou implementação, o chamado destina-se à equipe técnica
      // e deve obrigatoriamente iniciar na coluna "Backlog" do Kanban
      const finalStatus = isTechnicalAction || isImplementation ? "Backlog" : status.trim();

      // Resolve clientId caso fornecido diretamente ou correspondente ao nome do cliente
      let resolvedClientId = clientId && typeof clientId === "string" && clientId.trim() ? clientId.trim() : null;
      if (!resolvedClientId && clientOrOffice && clientOrOffice.trim()) {
        const matchedClient = await prisma.client.findFirst({
          where: { name: { equals: clientOrOffice.trim(), mode: "insensitive" } },
          select: { id: true },
        });
        if (matchedClient) {
          resolvedClientId = matchedClient.id;
        }
      }

      const newLog = await prisma.workLog.create({
        data: {
          title: finalTitle,
          requester: requester.trim(),
          clientOrOffice: clientOrOffice.trim(),
          reportedProblem: finalDescription,
          actionTaken: (actionTaken || "").trim(),
          status: finalStatus,
          technicalAction: isTechnicalAction,
          implementation: isImplementation,
          media: JSON.stringify(mediaPaths),
          userId: user.id,
          tagId: cleanTagId,
          clientId: resolvedClientId,
        },
      });

      // Registra evento de criação na linha do tempo de status
      await prisma.workLogStatusHistory.create({
        data: {
          workLogId: newLog.id,
          fromStatus: "Registro Inicial",
          toStatus: finalStatus,
          changedById: user.id,
        },
      });

      // Se não houver gravação de tela mas houver um vídeo anexado nas mídias, associa como vídeo da análise
      if (!savedRecordingPath && files?.media) {
        const videoMedia = files.media.find((f) => (f.mimetype || "").startsWith("video/"));
        if (videoMedia) {
          const cleanName = videoMedia.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `storage/recordings/${Date.now()}-${cleanName}`;
          await uploadFileFromDisk(videoMedia.path, key, videoMedia.mimetype || "video/webm");
          savedRecordingPath = key;
        }
      }

      // Cria AiReport e dispara processamento em segundo plano (com gravação ou com formulário + mídias)
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
          console.error(`[WorkLog] Erro no job de relatório para ${newLog.id}:`, err);
        });
      });

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
              title: `Novo chamado: ${finalTitle}`,
              message: `${user.name} registrou o atendimento "${finalTitle}" (${typeLabel}) para "${clientOrOffice.trim()}".`,
              read: false,
            })),
          });
        }
      }

      res.status(201).json({ success: true, id: newLog.id, logId: newLog.id });
    } catch (error) {
      console.error("[WorkLogs] Erro ao criar atendimento:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Erro interno ao salvar atendimento.",
      });
    } finally {
      // Limpeza imediata de todos os arquivos temporários no disco do servidor
      for (const tempPath of tempFilesToClean) {
        try {
          if (fsSync.existsSync(tempPath)) {
            fsSync.unlinkSync(tempPath);
          }
        } catch (cleanupErr) {
          console.warn(`[WorkLogs] Falha ao limpar arquivo temporário ${tempPath}:`, cleanupErr);
        }
      }
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

      if (existing.status !== "Solucionado") {
        await prisma.$transaction([
          prisma.workLog.update({
            where: { id },
            data: {
              status: "Solucionado",
            },
          }),
          prisma.workLogStatusHistory.create({
            data: {
              workLogId: id,
              fromStatus: existing.status,
              toStatus: "Solucionado",
              changedById: req.user!.id,
            },
          }),
        ]);
      }

      const history = await prisma.workLogStatusHistory.findMany({
        where: { workLogId: id },
        include: {
          changedBy: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, status: "Solucionado", history });
    } catch (error) {
      console.error("[WorkLogs] Erro ao solucionar atendimento:", error);
      res.status(500).json({ error: "Erro ao solucionar atendimento." });
    }
  }
);


// PATCH /api/worklogs/:id/assign
router.patch(
  "/:id/assign",
  authenticateToken,
  requireTechnicianManagerOrAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { assignedToId } = req.body;

      const existing = await prisma.workLog.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({ error: "Atendimento não encontrado." });
        return;
      }

      let targetUserId: string | null = null;
      if (assignedToId && typeof assignedToId === "string" && assignedToId.trim() !== "") {
        const userExists = await prisma.user.findUnique({
          where: { id: assignedToId.trim() },
          select: { id: true, name: true, email: true, role: true },
        });

        if (!userExists) {
          res.status(400).json({ error: "Usuário responsável não encontrado." });
          return;
        }
        targetUserId = userExists.id;
      }

      const updated = await prisma.workLog.update({
        where: { id },
        data: {
          assignedToId: targetUserId,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      res.json({
        success: true,
        assignedTo: updated.assignedTo,
        assignedToId: updated.assignedToId,
      });
    } catch (error) {
      console.error("[WorkLogs] Erro ao atribuir responsável:", error);
      res.status(500).json({ error: "Erro ao atribuir responsável ao atendimento." });
    }
  }
);

// PATCH /api/worklogs/:id/status
router.patch(
  "/:id/status",
  authenticateToken,
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

      const newStatus = status.trim();
      const currentStatus = existing.status;

      if (currentStatus !== newStatus) {
        await prisma.$transaction([
          prisma.workLog.update({
            where: { id },
            data: {
              status: newStatus,
            },
          }),
          prisma.workLogStatusHistory.create({
            data: {
              workLogId: id,
              fromStatus: currentStatus,
              toStatus: newStatus,
              changedById: req.user!.id,
            },
          }),
        ]);
      }

      const history = await prisma.workLogStatusHistory.findMany({
        where: { workLogId: id },
        include: {
          changedBy: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, status: newStatus, history });
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

      const workLog = await prisma.workLog.findUnique({
        where: { id },
        include: { aiReport: true },
      });

      if (!workLog) {
        res.status(404).json({ error: "Atendimento não encontrado." });
        return;
      }

      if (workLog.aiReport && workLog.aiReport.status === "processing") {
        res.status(400).json({
          error: "O relatório já está sendo processado no momento. Por favor, aguarde alguns instantes.",
        });
        return;
      }

      // Se houver vídeo registrado, valida se o arquivo ainda existe no storage
      if (workLog.aiReport?.videoPath) {
        const exists = await fileExists(workLog.aiReport.videoPath);
        if (!exists) {
          console.warn(`[WorkLogs] Vídeo ${workLog.aiReport.videoPath} não encontrado no storage. Gerando com base no formulário e mídias.`);
          await prisma.aiReport.update({
            where: { workLogId: id },
            data: { videoPath: null },
          });
        }
      }

      await prisma.aiReport.upsert({
        where: { workLogId: id },
        create: {
          workLogId: id,
          status: "pending",
          errorMessage: null,
          startedAt: new Date(),
        },
        update: {
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

// POST /api/worklogs/:id/generate-ai-report
router.post(
  "/:id/generate-ai-report",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const workLog = await prisma.workLog.findUnique({
        where: { id },
        include: { aiReport: true },
      });

      if (!workLog) {
        res.status(404).json({ error: "Atendimento não encontrado." });
        return;
      }

      if (workLog.aiReport && workLog.aiReport.status === "processing") {
        res.status(400).json({
          error: "O relatório já está sendo processado no momento. Por favor, aguarde alguns instantes.",
        });
        return;
      }

      // Cria ou atualiza registro de AiReport para pending
      await prisma.aiReport.upsert({
        where: { workLogId: id },
        create: {
          workLogId: id,
          status: "pending",
          startedAt: new Date(),
          errorMessage: null,
        },
        update: {
          status: "pending",
          startedAt: new Date(),
          errorMessage: null,
        },
      });

      // Dispara job assíncrono em segundo plano
      setImmediate(() => {
        processAiReportJob(id).catch((err) => {
          console.error(`[WorkLog] Erro no job de geração de relatório para ${id}:`, err);
        });
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[WorkLogs] Erro ao disparar geração de relatório de IA:", error);
      res.status(500).json({ error: "Erro ao iniciar processamento de IA." });
    }
  }
);


// DELETE /api/worklogs/:id (Administradores e Técnicos)
router.delete(
  "/:id",
  authenticateToken,
  requireTechnicianOrAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const workLog = await prisma.workLog.findUnique({
        where: { id },
        include: {
          aiReport: true,
        },
      });

      if (!workLog) {
        res.status(404).json({ error: "Atendimento não encontrado." });
        return;
      }

      // 1. Exclui arquivos associados (gravação e PDF) do R2 ou disco local
      if (workLog.aiReport?.videoPath) {
        await deleteFile(workLog.aiReport.videoPath);
      }
      if (workLog.aiReport?.pdfPath) {
        await deleteFile(workLog.aiReport.pdfPath);
      }

      // 2. Exclui mídias anexadas (se houver)
      if (workLog.media) {
        try {
          const mediaUrls = JSON.parse(workLog.media);
          if (Array.isArray(mediaUrls)) {
            for (const mediaUrl of mediaUrls) {
              const cleanKey = typeof mediaUrl === "string" ? mediaUrl.replace(/^\/+/, "") : "";
              if (cleanKey) {
                await deleteFile(cleanKey);
              }
            }
          }
        } catch {}
      }

      // 3. Remove relacionamentos dependentes no banco
      await prisma.workLogStatusHistory.deleteMany({ where: { workLogId: id } });
      await prisma.aiReport.deleteMany({ where: { workLogId: id } });
      await prisma.notification.deleteMany({ where: { workLogId: id } });

      // 4. Remove o atendimento
      await prisma.workLog.delete({ where: { id } });

      console.log(`[WorkLogs] Atendimento ${id} excluído com sucesso por ${req.user?.name} (${req.user?.email})`);
      res.json({ success: true, message: "Atendimento e relatórios excluídos com sucesso." });
    } catch (error) {
      console.error("[WorkLogs] Erro ao excluir atendimento:", error);
      res.status(500).json({ error: "Erro ao excluir o atendimento." });
    }
  }
);

export default router;
