import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../../lib/prisma";
import { authenticateToken } from "../auth";
import { getFileStream } from "../services/r2Storage";

const router = Router();

// GET /api/reports/:id/download
router.get("/:id/download", authenticateToken, async (req: Request, res: Response): Promise<void> => {
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

    if (!workLog.aiReport || workLog.aiReport.status !== "completed" || !workLog.aiReport.pdfPath) {
      res.status(404).json({ error: "O relatório em PDF ainda não está disponível para este atendimento." });
      return;
    }

    const rawPdfPath = workLog.aiReport.pdfPath;
    const clientSafeName = workLog.clientOrOffice.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const downloadFileName = `relatorio-${clientSafeName}-${workLog.id.slice(0, 8)}.pdf`;

    const isInline = req.query.view === "inline";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${isInline ? "inline" : "attachment"}; filename="${downloadFileName}"`);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

    try {
      const fileInfo = await getFileStream(rawPdfPath);
      if (fileInfo.contentLength) {
        res.setHeader("Content-Length", fileInfo.contentLength);
      }
      fileInfo.stream.pipe(res);
    } catch (err) {
      res.status(404).json({ error: "O arquivo PDF do relatório não foi encontrado." });
    }
  } catch (error) {
    console.error("[Reports] Erro no download do relatório PDF:", error);
    res.status(500).json({ error: "Erro interno ao processar download do relatório." });
  }
});

// GET /api/reports/:id/recording
router.get("/:id/recording", authenticateToken, async (req: Request, res: Response): Promise<void> => {
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

    if (!workLog.aiReport || !workLog.aiReport.videoPath) {
      res.status(404).json({ error: "Nenhuma gravação de tela associada a este atendimento." });
      return;
    }

    const rawVideoPath = workLog.aiReport.videoPath;
    const ext = path.extname(rawVideoPath).toLowerCase() || ".webm";
    const mimeType = ext === ".mp4" ? "video/mp4" : "video/webm";

    const clientSafeName = workLog.clientOrOffice.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const downloadFileName = `gravacao-${clientSafeName}-${workLog.id.slice(0, 8)}${ext}`;

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadFileName}"`);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

    try {
      const range = req.headers.range;
      const fileInfo = await getFileStream(rawVideoPath, range);
      res.status(fileInfo.statusCode || 200);
      if (fileInfo.contentRange) {
        res.setHeader("Content-Range", fileInfo.contentRange);
      }
      if (fileInfo.contentLength) {
        res.setHeader("Content-Length", fileInfo.contentLength);
      }
      res.setHeader("Accept-Ranges", "bytes");
      fileInfo.stream.pipe(res);
    } catch (err) {
      res.status(404).json({ error: "O arquivo de gravação não foi encontrado." });
    }
  } catch (error) {
    console.error("[Reports] Erro no download da gravação de tela:", error);
    res.status(500).json({ error: "Erro interno ao processar download da gravação." });
  }
});

export default router;
