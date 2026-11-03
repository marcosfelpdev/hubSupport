import { PrismaClient } from "@prisma/client";
import { deleteFile, isR2Configured } from "../src/server/services/r2Storage";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Inspecionando estado atual do banco de dados...");

  const userCount = await prisma.user.count();
  const tagCount = await prisma.tag.count();
  const workLogCount = await prisma.workLog.count();
  const aiReportCount = await prisma.aiReport.count();
  const statusHistoryCount = await prisma.workLogStatusHistory.count();
  const notificationCount = await prisma.notification.count();
  const agendaCount = await prisma.agendaEvent.count();

  console.log("Contagens antes da limpeza:", {
    users: userCount,
    tags: tagCount,
    workLogs: workLogCount,
    aiReports: aiReportCount,
    statusHistory: statusHistoryCount,
    notifications: notificationCount,
    agendaEvents: agendaCount,
  });

  // Limpeza de arquivos no R2 (se configurado) antes de remover os registros
  if (isR2Configured) {
    console.log("☁️  Removendo arquivos de gravações e relatórios do Cloudflare R2...");
    const reports = await prisma.aiReport.findMany({
      select: { videoPath: true, pdfPath: true },
    });
    for (const report of reports) {
      if (report.videoPath) {
        await deleteFile(report.videoPath);
      }
      if (report.pdfPath) {
        await deleteFile(report.pdfPath);
      }
    }
  }

  // Limpeza de tabelas transacionais de teste
  console.log("\n🧹 Limpando dados transacionais de teste no banco...");
  await prisma.workLogStatusHistory.deleteMany();
  await prisma.aiReport.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.agendaEvent.deleteMany();
  await prisma.workLog.deleteMany();

  console.log("✅ Tabelas de atendimentos, relatórios, notificações e eventos limpas!");

  // Limpeza de arquivos físicos locais em storage/ e public/uploads/
  const cleanDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    let removed = 0;
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        removed++;
      }
    }
    console.log(`🗑️  ${removed} arquivos removidos de ${dirPath}`);
  };

  cleanDir(path.join(process.cwd(), "storage", "recordings"));
  cleanDir(path.join(process.cwd(), "storage", "reports"));
  cleanDir(path.join(process.cwd(), "public", "uploads"));

  const finalWorkLogs = await prisma.workLog.count();
  const finalAiReports = await prisma.aiReport.count();
  console.log(`\n🎉 Banco e arquivos limpos com sucesso! WorkLogs: ${finalWorkLogs}, AiReports: ${finalAiReports}`);
  console.log(`👤 Usuários preservados: ${userCount}, Tags preservadas: ${tagCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
