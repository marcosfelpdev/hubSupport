import { prisma } from "@/lib/prisma";
import { analyzeRecordingWithGemini, WorkLogContext } from "./gemini";
import { generateReportPdf } from "./pdf-generator";

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

  if (!workLog.aiReport || !workLog.aiReport.videoPath) {
    console.error(`[ReportProcessor] AiReport ou videoPath não encontrado para WorkLog: ${workLogId}`);
    return;
  }

  // Atualiza status para 'processing'
  await prisma.aiReport.update({
    where: { workLogId },
    data: {
      status: "processing",
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  try {
    const context: WorkLogContext = {
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

    // 1. Análise multimodal com Gemini AI
    console.log(`[ReportProcessor] Enviando para Gemini AI...`);
    const structuredData = await analyzeRecordingWithGemini(
      workLog.aiReport.videoPath,
      context
    );

    // 2. Geração do PDF profissional
    console.log(`[ReportProcessor] Gerando arquivo PDF...`);
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
