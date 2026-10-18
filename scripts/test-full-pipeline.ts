import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { analyzeRecordingWithGemini, WorkLogContext } from "../src/lib/gemini";
import { processAiReportJob } from "../src/lib/report-processor";

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile();
}

async function runTests() {
  console.log("=== INICIANDO TESTES DO FLUXO GEMINI + PDF ===");

  const dummyContext: WorkLogContext = {
    requester: "Testador Unitário",
    clientOrOffice: "Matriz Central",
    reportedProblem: "Falha de conexão com a impressora de rede",
    actionTaken: "Reiniciado spooler e reconfigurado IP fixo",
    status: "Pendente",
    technicalAction: true,
    implementation: false,
    authorName: "Suporte N2",
    createdAt: new Date(),
  };

  // Teste 1: Arquivo inexistente
  console.log("\n[Teste 1] Validação de arquivo inexistente...");
  try {
    await analyzeRecordingWithGemini("storage/recordings/arquivo_inexistente_123.webm", dummyContext);
    console.error("FAIL: Deveria ter lançado erro para arquivo inexistente!");
  } catch (err: any) {
    console.log("PASS: Erro capturado corretamente:", err.message);
  }

  // Teste 2: Arquivo vazio (0 bytes)
  console.log("\n[Teste 2] Validação de arquivo vazio (0 bytes)...");
  const emptyFilePath = path.join(process.cwd(), "storage", "recordings", "empty_test.webm");
  fs.writeFileSync(emptyFilePath, Buffer.alloc(0));
  try {
    await analyzeRecordingWithGemini(emptyFilePath, dummyContext);
    console.error("FAIL: Deveria ter lançado erro para arquivo vazio!");
  } catch (err: any) {
    console.log("PASS: Erro capturado corretamente:", err.message);
  } finally {
    if (fs.existsSync(emptyFilePath)) fs.unlinkSync(emptyFilePath);
  }

  // Teste 3: Formato / extensão inválida
  console.log("\n[Teste 3] Validação de formato/extensão não suportada...");
  const invalidExtPath = path.join(process.cwd(), "storage", "recordings", "test_invalid.txt");
  fs.writeFileSync(invalidExtPath, "not a video");
  try {
    await analyzeRecordingWithGemini(invalidExtPath, dummyContext);
    console.error("FAIL: Deveria ter lançado erro para formato inválido!");
  } catch (err: any) {
    console.log("PASS: Erro capturado corretamente:", err.message);
  } finally {
    if (fs.existsSync(invalidExtPath)) fs.unlinkSync(invalidExtPath);
  }

  // Teste 4: Execução completa do job em atendimento real do banco de dados
  console.log("\n[Teste 4] Processamento completo via processAiReportJob...");
  const logsWithAiReport = await prisma.workLog.findMany({
    where: { aiReport: { isNot: null } },
    select: { id: true, requester: true, aiReport: true },
  });
  console.log("WorkLogs com aiReport no banco:", logsWithAiReport.map(l => ({ id: l.id, requester: l.requester, status: l.aiReport?.status })));

  const targetLog = logsWithAiReport[logsWithAiReport.length - 1];
  if (!targetLog) {
    throw new Error("Nenhum WorkLog com aiReport encontrado no banco!");
  }
  const workLogId = targetLog.id;
  console.log(`Disparando processAiReportJob para WorkLog ID: ${workLogId}...`);

  await processAiReportJob(workLogId);

  // Consulta o registro atualizado no banco
  const updatedReport = await prisma.aiReport.findUnique({
    where: { workLogId },
  });

  console.log("\nResultado no Banco de Dados:");
  console.log("- Status:", updatedReport?.status);
  console.log("- PDF Path:", updatedReport?.pdfPath);
  console.log("- Erro:", updatedReport?.errorMessage);
  console.log("- CompletedAt:", updatedReport?.completedAt);

  if (updatedReport?.status === "completed" && updatedReport.pdfPath) {
    const fullPdfPath = path.isAbsolute(updatedReport.pdfPath)
      ? updatedReport.pdfPath
      : path.join(process.cwd(), updatedReport.pdfPath);

    if (fs.existsSync(fullPdfPath)) {
      const stats = fs.statSync(fullPdfPath);
      const fd = fs.openSync(fullPdfPath, "r");
      const headerBuf = Buffer.alloc(5);
      fs.readSync(fd, headerBuf, 0, 5, 0);
      fs.closeSync(fd);
      const header = headerBuf.toString("ascii");

      console.log(`- PDF existe no disco: SIM (${stats.size} bytes)`);
      console.log(`- Header do PDF: "${header}" (válido: ${header === "%PDF-"})`);

      if (stats.size > 1000 && header === "%PDF-") {
        console.log("\nPASS: Pipeline completo validado com sucesso!");
      } else {
        console.error("FAIL: PDF gerado não atende aos critérios de integridade.");
      }
    } else {
      console.error(`FAIL: Arquivo PDF não encontrado em ${fullPdfPath}`);
    }
  } else {
    console.error("FAIL: Status do relatório não é 'completed' ou pdfPath está ausente.");
  }
}

runTests()
  .catch((err) => console.error("Erro fatal nos testes:", err))
  .finally(() => prisma.$disconnect());
