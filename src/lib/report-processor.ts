import { prisma } from "@/lib/prisma";
import { analyzeRecordingWithGemini, analyzeFormWithGemini, WorkLogContext } from "./gemini";
import { generateReportPdf } from "./pdf-generator";
import { downloadToTempFile } from "../server/services/r2Storage";
import os from "os";
import path from "path";
import fs from "fs";

export async function processAiReportJob(workLogId: string) {
  console.log(`[ReportProcessor] Iniciando processamento do relatório para WorkLog: ${workLogId}`);

  const workLog = await prisma.workLog.findUnique({
    where: { id: workLogId },
    include: {
      user: { select: { name: true, email: true } },
      tag: true,
      aiReport: true,
    },
  });

  if (!workLog) {
    console.error(`[ReportProcessor] WorkLog não encontrado: ${workLogId}`);
    return;
  }

  // Se ainda não existir registro AiReport, cria com status 'processing'
  if (!workLog.aiReport) {
    await prisma.aiReport.create({
      data: {
        workLogId,
        status: "processing",
        startedAt: new Date(),
        errorMessage: null,
      },
    });
  } else {
    // Atualiza status para 'processing'
    await prisma.aiReport.update({
      where: { workLogId },
      data: {
        status: "processing",
        startedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  try {
    const context: WorkLogContext = {
      title: workLog.title,
      requester: workLog.requester,
      clientOrOffice: workLog.clientOrOffice,
      reportedProblem: workLog.reportedProblem,
      actionTaken: workLog.actionTaken,
      status: workLog.status,
      technicalAction: workLog.technicalAction,
      implementation: workLog.implementation,
      platform: workLog.tag?.name,
      authorName: workLog.user.name,
      createdAt: workLog.createdAt,
    };

    let structuredData;

    // Se houver gravação de tela, usa análise com vídeo
    if (workLog.aiReport?.videoPath) {
      console.log(`[ReportProcessor] Enviando vídeo para Gemini AI...`);
      const ext = path.extname(workLog.aiReport.videoPath) || ".webm";
      const tempVideoPath = path.join(os.tmpdir(), `gemini-${workLogId}-${Date.now()}${ext}`);
      try {
        await downloadToTempFile(workLog.aiReport.videoPath, tempVideoPath);
        structuredData = await analyzeRecordingWithGemini(tempVideoPath, context);
      } finally {
        if (fs.existsSync(tempVideoPath)) {
          try {
            fs.unlinkSync(tempVideoPath);
          } catch {}
        }
      }
    } else {
      // Atendimento criado sem vídeo (análise das informações + imagens anexadas)
      console.log(`[ReportProcessor] Enviando dados do formulário e mídias para Gemini AI...`);
      let mediaUrls: string[] = [];
      try {
        if (workLog.media) {
          const parsed = JSON.parse(workLog.media);
          if (Array.isArray(parsed)) {
            mediaUrls = parsed;
          }
        }
      } catch {
        mediaUrls = [];
      }

      structuredData = await analyzeFormWithGemini(context, mediaUrls);
    }

    // 2. Geração do PDF profissional
    console.log(`[ReportProcessor] Gerando arquivo PDF vetorial...`);
    const pdfPath = await generateReportPdf({
      workLogId,
      data: structuredData,
      context,
    });

    // 3. Atualiza registro como concluído
    await prisma.aiReport.update({
      where: { workLogId },
      data: {
        status: "completed",
        pdfPath,
        structuredData: JSON.stringify(structuredData),
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    console.log(`[ReportProcessor] Relatório gerado com sucesso para WorkLog: ${workLogId}`);
  } catch (error) {
    console.error(`[ReportProcessor] Falha no processamento do relatório para WorkLog ${workLogId}:`, error);

    const errorMsg =
      error instanceof Error ? error.message : "Erro desconhecido durante o processamento do relatório.";

    await prisma.aiReport.update({
      where: { workLogId },
      data: {
        status: "failed",
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    });
  }
}
