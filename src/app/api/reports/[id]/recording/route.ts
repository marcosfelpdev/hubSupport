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
        { error: "Não autorizado. Faça login para baixar a gravação." },
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

    if (!workLog.aiReport || !workLog.aiReport.videoPath) {
      return NextResponse.json(
        { error: "Nenhuma gravação de tela associada a este atendimento." },
        { status: 404 }
      );
    }

    const rawVideoPath = workLog.aiReport.videoPath;
    const videoFilePath = path.isAbsolute(rawVideoPath)
      ? rawVideoPath
      : path.join(process.cwd(), rawVideoPath);

    try {
      await fs.access(videoFilePath);
    } catch {
      return NextResponse.json(
        { error: "O arquivo de gravação não foi encontrado no servidor." },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(videoFilePath);
    const ext = path.extname(videoFilePath).toLowerCase() || ".webm";
    const mimeType = ext === ".mp4" ? "video/mp4" : "video/webm";

    const clientSafeName = workLog.clientOrOffice.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const downloadFileName = `gravacao-${clientSafeName}-${workLog.id.slice(0, 8)}${ext}`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${downloadFileName}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Erro na rota de download da gravação:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar download da gravação." },
      { status: 500 }
    );
  }
}
