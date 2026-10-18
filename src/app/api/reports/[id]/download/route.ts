import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json(
        { error: "Não autorizado. Faça login para baixar o relatório." },
        { status: 401 }
      );
    }

    const { id: workLogId } = await params;

    if (!workLogId) {
      return NextResponse.json(
        { error: "Identificador do atendimento inválido." },
        { status: 400 }
      );
    }

    const workLog = await prisma.workLog.findUnique({
      where: { id: workLogId },
      include: {
        aiReport: true,
      },
    });

    if (!workLog) {
      return NextResponse.json(
        { error: "Atendimento não encontrado." },
        { status: 404 }
      );
    }

    if (!workLog.aiReport || workLog.aiReport.status !== "completed" || !workLog.aiReport.pdfPath) {
      return NextResponse.json(
        { error: "O relatório em PDF ainda não está disponível para este atendimento." },
        { status: 404 }
      );
    }

    const rawPdfPath = workLog.aiReport.pdfPath;
    const pdfFilePath = path.isAbsolute(rawPdfPath)
      ? rawPdfPath
      : path.join(process.cwd(), rawPdfPath);

    try {
      await fs.access(pdfFilePath);
    } catch {
      return NextResponse.json(
        { error: "O arquivo PDF do relatório não foi encontrado no servidor." },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(pdfFilePath);
    const clientSafeName = workLog.clientOrOffice.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const downloadFileName = `relatorio-${clientSafeName}-${workLog.id.slice(0, 8)}.pdf`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFileName}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Erro na rota de download de relatório:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar download do relatório." },
      { status: 500 }
    );
  }
}
