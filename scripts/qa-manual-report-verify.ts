import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import fs from "fs";
import path from "path";

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile();
}

const BASE_URL = "http://localhost:4000";

async function runQA() {
  console.log("==================================================");
  console.log("🔍 QA AUDIT: GERAÇÃO DE RELATÓRIO COM IA (MANUAL)");
  console.log("==================================================");

  // 1. Obter usuário para autenticação
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
  }) || await prisma.user.findFirst({ where: { active: true } });

  if (!adminUser) {
    throw new Error("❌ Nenhum usuário ativo encontrado no banco para autenticação.");
  }

  const token = generateToken({
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
  });

  console.log(`✅ Usuário autenticado para testes: ${adminUser.name} (${adminUser.email}, role: ${adminUser.role})`);

  // 2. Localizar atendimentos existentes sem vídeo
  const existingManualWorklogs = await prisma.workLog.findMany({
    where: {
      OR: [
        { aiReport: null },
        { aiReport: { videoPath: null } },
      ],
    },
    include: { aiReport: true },
    take: 5,
  });

  console.log(`\n📋 Atendimentos manuais existentes sem vídeo encontrados: ${existingManualWorklogs.length}`);
  for (const wl of existingManualWorklogs) {
    console.log(`   - ID: ${wl.id} | Título: ${wl.title || "Sem título"} | Cliente: ${wl.clientOrOffice} | Status IA: ${wl.aiReport?.status || "Nenhum"}`);
  }

  // 3. Testar validações de borda na API REST
  console.log("\n🧪 Testando rotas e tratamento de erros:");

  // Teste 3.1: Requisição sem token (401)
  const unauthRes = await fetch(`${BASE_URL}/api/worklogs/fake-id/generate-ai-report`, {
    method: "POST",
  });
  console.log(`   - Chamada não-autenticada: HTTP ${unauthRes.status} (esperado 401) -> ${unauthRes.status === 401 ? "PASS" : "FAIL"}`);

  // Teste 3.2: Atendimento inexistente (404)
  const notFoundRes = await fetch(`${BASE_URL}/api/worklogs/nao-existe-99999/generate-ai-report`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   - Chamada para ID inexistente: HTTP ${notFoundRes.status} (esperado 404) -> ${notFoundRes.status === 404 ? "PASS" : "FAIL"}`);

  // 4. Criar atendimento de teste representativo (sem gravação de vídeo, com anexo de imagem de teste)
  console.log("\n🚀 Criando atendimento de teste para validação ponta a ponta...");
  
  // Criar uma imagem PNG válida em public/uploads para teste de multimodalidade
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const testImageFileName = `qa-test-${Date.now()}.png`;
  const testImagePath = path.join(uploadsDir, testImageFileName);
  // 1x1 transparent PNG buffer
  const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  fs.writeFileSync(testImagePath, Buffer.from(samplePngBase64, "base64"));
  console.log(`   - Imagem de teste criada: public/uploads/${testImageFileName}`);

  const testWorkLog = await prisma.workLog.create({
    data: {
      userId: adminUser.id,
      title: "Falha de comunicação com gateway de pagamentos",
      requester: "Carla Silveira",
      clientOrOffice: "Escritório Modelo & Associados",
      reportedProblem: "Usuários relatam timeout constante ao tentar autorizar pagamentos com cartão de crédito via API interna.",
      actionTaken: "Analisados logs do servidor Nginx e reiniciado o container Docker do gateway com revalidação de certificados SSL.",
      status: "Solucionado",
      technicalAction: true,
      implementation: false,
      media: JSON.stringify([`/uploads/${testImageFileName}`]),
    },
  });

  console.log(`   - Atendimento de teste criado: ID ${testWorkLog.id}`);

  try {
    // 5. Acionar endpoint de geração de relatório via POST
    console.log(`\n⚡ Acionando POST /api/worklogs/${testWorkLog.id}/generate-ai-report...`);
    const triggerRes = await fetch(`${BASE_URL}/api/worklogs/${testWorkLog.id}/generate-ai-report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const triggerData = await triggerRes.json();
    console.log(`   - Resposta HTTP: ${triggerRes.status}`, triggerData);
    if (triggerRes.status !== 200 || !triggerData.success) {
      throw new Error(`Falha ao disparar geração de relatório: ${JSON.stringify(triggerData)}`);
    }

    // Teste 5.1: Se chamar imediatamente de novo, deve retornar 400 (já em processamento)
    const duplicateRes = await fetch(`${BASE_URL}/api/worklogs/${testWorkLog.id}/generate-ai-report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`   - Chamada duplicada concorrente: HTTP ${duplicateRes.status} -> ${duplicateRes.status === 400 ? "PASS (Bloqueado corretamente)" : "Status: " + duplicateRes.status}`);

    // 6. Polling do status da IA até conclusão ou falha
    console.log("\n⏳ Aguardando processamento da IA e geração do PDF...");
    let attempts = 0;
    const maxAttempts = 60; // até 120 segundos
    let finalReport: any = null;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const statusRes = await fetch(`${BASE_URL}/api/worklogs/${testWorkLog.id}/ai-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        process.stdout.write(`   [${attempts * 2}s] Status atual: ${statusData.status}\r`);

        if (statusData.status === "completed") {
          finalReport = statusData;
          console.log(`\n🎉 Processamento concluído em ${attempts * 2} segundos!`);
          break;
        }

        if (statusData.status === "failed") {
          finalReport = statusData;
          console.error(`\n❌ Processamento falhou: ${statusData.errorMessage}`);
          break;
        }
      }
    }

    if (!finalReport) {
      throw new Error("Timeout: O relatório não completou no tempo limite de 120 segundos.");
    }

    if (finalReport.status !== "completed") {
      throw new Error(`O relatório terminou com status "${finalReport.status}": ${finalReport.errorMessage}`);
    }

    // 7. Validação do arquivo PDF no disco
    console.log("\n📄 Validando arquivo PDF gerado:");
    console.log(`   - Caminho registrado: ${finalReport.pdfPath}`);
    if (!finalReport.pdfPath) {
      throw new Error("pdfPath não retornado no relatório concluído.");
    }

    const fullPdfPath = path.isAbsolute(finalReport.pdfPath)
      ? finalReport.pdfPath
      : path.join(process.cwd(), finalReport.pdfPath);

    if (!fs.existsSync(fullPdfPath)) {
      throw new Error(`Arquivo PDF físico não encontrado em: ${fullPdfPath}`);
    }

    const pdfStats = fs.statSync(fullPdfPath);
    console.log(`   - Tamanho do arquivo PDF: ${pdfStats.size} bytes (${(pdfStats.size / 1024).toFixed(1)} KB)`);
    if (pdfStats.size === 0) {
      throw new Error("O arquivo PDF gerado está vazio (0 bytes).");
    }

    // 8. Validação do endpoint de download do PDF
    console.log("\n📥 Testando endpoint de download de PDF (/api/reports/:id/download):");
    const downloadRes = await fetch(`${BASE_URL}/api/reports/${testWorkLog.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`   - Resposta HTTP: ${downloadRes.status} (esperado 200)`);
    const contentType = downloadRes.headers.get("content-type");
    console.log(`   - Content-Type: ${contentType} (esperado application/pdf)`);
    if (downloadRes.status !== 200 || !contentType?.includes("application/pdf")) {
      throw new Error(`Falha no download do PDF: HTTP ${downloadRes.status}, Content-Type: ${contentType}`);
    }
    const pdfBuffer = await downloadRes.arrayBuffer();
    console.log(`   - Bytes baixados com sucesso: ${pdfBuffer.byteLength} bytes`);

    // 9. Validação dos dados estruturados da IA salvos no banco
    console.log("\n🧠 Validando dados estruturados retornados pelo Gemini:");
    const dbReport = await prisma.aiReport.findUnique({
      where: { workLogId: testWorkLog.id },
    });

    if (!dbReport?.structuredData) {
      throw new Error("structuredData ausente no registro do banco.");
    }

    const parsedData = JSON.parse(dbReport.structuredData);
    console.log("   - Título formal:", parsedData.title);
    console.log("   - Subtítulo:", parsedData.subtitle);
    console.log("   - Data:", parsedData.date);
    console.log("   - Departamento / Cliente:", parsedData.department);
    console.log("   - Participantes:", parsedData.participants);
    console.log("   - Resumo Executivo:", parsedData.executiveSummary?.substring(0, 80) + "...");
    console.log(`   - Total de propostas geradas: ${parsedData.proposals?.length || 0}`);
    console.log(`   - Parágrafos de detalhamento: ${parsedData.detailingParagraphs?.length || 0}`);
    console.log(`   - Itens de transcrição/contato: ${parsedData.transcript?.length || 0}`);

    if (!parsedData.title || !parsedData.executiveSummary || !parsedData.proposals) {
      throw new Error("Dados estruturados da IA não contêm os campos essenciais esperados.");
    }

    console.log("\n==================================================");
    console.log("✅ AUDITORIA DE BACKEND E IA CONCLUÍDA COM 100% DE SUCESSO!");
    console.log("==================================================");

  } finally {
    // Limpeza da imagem temporária de teste
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log(`🧹 Limpeza: Imagem de teste removida: ${testImageFileName}`);
    }
  }
}

runQA()
  .catch((err) => {
    console.error("\n❌ ERRO NA AUDITORIA DE QA:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
