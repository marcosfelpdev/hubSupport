import { prisma } from "@/lib/prisma";
import { analyzeRecordingWithGemini, WorkLogContext } from "./gemini";
import { generateReportPdf } from "./pdf-generator";
import { revalidatePath } from "next/cache";

export async function processAiReportJob(workLogId: string) {
  console.log(`[ReportProcessor] Iniciando processamento do relatório para WorkLog: ${workLogId}`);

  const workLog = await prisma.workLog.findUnique({
    where: { id: workLogId },
    include: {
      user: { select: { name: true, email: true } },
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
      },
    });

    console.log(`[ReportProcessor] Relatório gerado com sucesso para WorkLog: ${workLogId}`);
    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/tecnico");
    } catch {
      // revalidatePath pode falhar se executado fora de request context
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[ReportProcessor] Erro ao processar relatório para WorkLog ${workLogId}:`, err);

    let safeMessage = "Falha ao processar a gravação com a inteligência artificial.";
    if (err.message) {
      if (err.message.includes("GEMINI_API_KEY")) {
        safeMessage = "Chave da API do Gemini não configurada no servidor.";
      } else if (err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429")) {
        safeMessage = "Limite de requisições da API atingido. Tente novamente mais tarde.";
      } else if (err.message.includes("high demand") || err.message.includes("503") || err.message.includes("UNAVAILABLE")) {
        safeMessage = "Os servidores do Gemini estão com alta demanda temporária. Tente novamente em instantes.";
      } else if (err.message.includes("not found") || err.message.includes("não encontrado")) {
        safeMessage = "Arquivo de gravação não encontrado no servidor.";
      } else if (err.message.includes("vazio") || err.message.includes("0 bytes")) {
        safeMessage = "O arquivo de gravação está vazio ou corrompido.";
      } else {
        // Tenta extrair mensagem limpa se for um erro JSON da API
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error?.message) {
            safeMessage = parsed.error.message.replace(/\s+/g, " ").trim().slice(0, 180);
          } else {
            safeMessage = err.message.slice(0, 180);
          }
        } catch {
          safeMessage = err.message.slice(0, 180);
        }
      }
    }

    await prisma.aiReport.update({
      where: { workLogId },
      data: {
        status: "failed",
        errorMessage: safeMessage,
        completedAt: new Date(),
      },
    });

    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/tecnico");
    } catch {
      // ignore
    }
  }
}
