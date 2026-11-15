/**
 * Integration Test:
 * Validação de persistência e consulta do campo `descriptionInterleaved`
 * na rota POST /api/worklogs e GET /api/worklogs.
 */

import "dotenv/config";
import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import type { Server } from "http";
import fs from "fs";
import path from "path";

interface TestResult {
  testName: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, testName: string, evidence: string) {
  if (condition) {
    testResults.push({ testName, passed: true, evidence });
    console.log(`  ✅ [PASS] ${testName}\n         -> ${evidence}`);
  } else {
    testResults.push({
      testName,
      passed: false,
      evidence,
      error: "Assertion failed: expected true but got false",
    });
    console.error(`  ❌ [FAIL] ${testName}\n         -> ${evidence}`);
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string, detail?: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  const evidence = `${detail || testName} => Esperado: ${JSON.stringify(expected)}, Obtido: ${JSON.stringify(actual)}`;
  if (isMatch) {
    testResults.push({ testName, passed: true, evidence });
    console.log(`  ✅ [PASS] ${testName}\n         -> ${evidence}`);
  } else {
    testResults.push({
      testName,
      passed: false,
      evidence,
      error: `Mismatch: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    });
    console.error(`  ❌ [FAIL] ${testName}\n         -> ${evidence}`);
  }
}

async function runTests() {
  console.log("\n================================================================================");
  console.log("   TESTE DE INTEGRAÇÃO: PERSISTÊNCIA DE descriptionInterleaved EM WORKLOGS");
  console.log("================================================================================\n");

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor HTTP de testes ativo na porta ${port} (${baseUrl})\n`);

  const createdWorkLogIds: string[] = [];
  const createdUploadedFiles: string[] = [];

  try {
    // -------------------------------------------------------------
    // FASE 0: Autenticação e Carga de Dependências (User, Tag, Client)
    // -------------------------------------------------------------
    console.log("--> [FASE 0] Preparando usuário, tag e cliente de teste...");

    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", active: true },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "Admin Worklogs Test",
          email: `admin.worklogs.${Date.now()}@hubsupport.test`,
          password: "hashed_password_123",
          role: "ADMIN",
        },
      });
    }

    const authToken = generateToken({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    });

    assert(Boolean(authToken && authToken.length > 20), "Geração de Token JWT", `Token JWT gerado para ${adminUser.name}`);

    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
    };

    // Garantir tag
    let testTag = await prisma.tag.findFirst();
    if (!testTag) {
      testTag = await prisma.tag.create({
        data: {
          name: `Tag Teste ${Date.now()}`,
          color: "#3b82f6",
        },
      });
    }

    // Garantir cliente
    let testClient = await prisma.client.findFirst();
    if (!testClient) {
      testClient = await prisma.client.create({
        data: {
          name: `Cliente Teste ${Date.now()}`,
        },
      });
    }

    // -------------------------------------------------------------
    // FASE 1: Criar WorkLog com descriptionInterleaved e mídias
    // -------------------------------------------------------------
    console.log("\n--> [FASE 1] POST /api/worklogs com blocos intercalados e arquivos de mídia...");

    const interleavedPayload = [
      { type: "text", content: "Erro na inicialização do serviço: " },
      {
        type: "media",
        mediaId: "med_img_1",
        filename: "screenshot_erro.png",
        mimeType: "image/png",
        fileIndex: 0,
      },
      { type: "text", content: "\nLogs obtidos no terminal do servidor:\n" },
      {
        type: "media",
        mediaId: "med_img_2",
        filename: "terminal_output.png",
        mimeType: "image/png",
        fileIndex: 1,
      },
      { type: "text", content: "\nApós reiniciar o container, o sistema voltou a responder normalmente." },
    ];

    const dummyPngBuffer1 = Buffer.from("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRTESTE_IMAGEM_1");
    const dummyPngBuffer2 = Buffer.from("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRTESTE_IMAGEM_2");

    const formData1 = new FormData();
    formData1.append("title", "Falha de Conexão com Gateway de Pagamento");
    formData1.append("requester", "Carlos Silveira");
    formData1.append("clientOrOffice", testClient.name);
    formData1.append("tagId", testTag.id);
    formData1.append(
      "reportedProblem",
      "Erro na inicialização do serviço: [Imagem: screenshot_erro.png]\nLogs obtidos no terminal do servidor:\n[Imagem: terminal_output.png]\nApós reiniciar o container, o sistema voltou a responder normalmente."
    );
    formData1.append("descriptionInterleaved", JSON.stringify(interleavedPayload));
    formData1.append("media", new Blob([dummyPngBuffer1], { type: "image/png" }), "screenshot_erro.png");
    formData1.append("media", new Blob([dummyPngBuffer2], { type: "image/png" }), "terminal_output.png");

    const res1 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formData1,
    });

    const data1 = await res1.json();
    assert(res1.status === 201, "Status 201 ao criar WorkLog com mídia intercalada", `Status retornado: ${res1.status}`);
    assert(data1.success === true, "Propriedade success: true retornada", `success: ${data1.success}`);
    assert(Boolean(data1.id), "ID do WorkLog retornado pela API", `ID gerado: ${data1.id}`);

    const logId1 = data1.id;
    createdWorkLogIds.push(logId1);

    // -------------------------------------------------------------
    // FASE 2: Verificação direta no SQLite via Prisma
    // -------------------------------------------------------------
    console.log("\n--> [FASE 2] Verificação no SQLite via Prisma...");

    const dbLog1 = await prisma.workLog.findUnique({
      where: { id: logId1 },
      select: {
        id: true,
        title: true,
        reportedProblem: true,
        descriptionInterleaved: true,
        media: true,
      },
    });

    assert(Boolean(dbLog1), "WorkLog localizado no banco SQLite", `Registro id: ${dbLog1?.id}`);
    assert(Boolean(dbLog1?.descriptionInterleaved), "Campo descriptionInterleaved não é nulo no banco", `descriptionInterleaved preenchido`);

    let parsedBlocks1: any[] = [];
    try {
      parsedBlocks1 = JSON.parse(dbLog1?.descriptionInterleaved || "[]");
    } catch (e) {
      console.error("Erro ao analisar descriptionInterleaved retornado do banco:", e);
    }

    assertEqual(parsedBlocks1.length, 5, "Total de blocos intercalados preservados", "5 blocos (3 texto, 2 mídia)");

    // Verificar bloco 0 (texto)
    assertEqual(parsedBlocks1[0].type, "text", "Bloco 0 é do tipo texto");
    assertEqual(parsedBlocks1[0].content, "Erro na inicialização do serviço: ", "Conteúdo do Bloco 0 preservado");

    // Verificar bloco 1 (mídia mapeada para storagePath)
    assertEqual(parsedBlocks1[1].type, "media", "Bloco 1 é do tipo mídia");
    assertEqual(parsedBlocks1[1].filename, "screenshot_erro.png", "Filename do Bloco 1 preservado");
    assert(
      Boolean(parsedBlocks1[1].storagePath && parsedBlocks1[1].storagePath.includes("screenshot_erro.png")),
      "Bloco 1 possui storagePath vinculado com o nome do arquivo",
      `storagePath: ${parsedBlocks1[1].storagePath}`
    );
    assert(
      Boolean(parsedBlocks1[1].mediaUrl && parsedBlocks1[1].mediaUrl === parsedBlocks1[1].storagePath),
      "Bloco 1 possui mediaUrl correspondente ao storagePath",
      `mediaUrl: ${parsedBlocks1[1].mediaUrl}`
    );

    // Verificar bloco 2 (texto)
    assertEqual(parsedBlocks1[2].type, "text", "Bloco 2 é do tipo texto");

    // Verificar bloco 3 (mídia mapeada para storagePath)
    assertEqual(parsedBlocks1[3].type, "media", "Bloco 3 é do tipo mídia");
    assertEqual(parsedBlocks1[3].filename, "terminal_output.png", "Filename do Bloco 3 preservado");
    assert(
      Boolean(parsedBlocks1[3].storagePath && parsedBlocks1[3].storagePath.includes("terminal_output.png")),
      "Bloco 3 possui storagePath vinculado com o nome do arquivo",
      `storagePath: ${parsedBlocks1[3].storagePath}`
    );

    // Rastrear arquivos para limpeza
    const savedMediaList: string[] = JSON.parse(dbLog1?.media || "[]");
    assertEqual(savedMediaList.length, 2, "Array media no WorkLog possui 2 itens");
    for (const p of savedMediaList) {
      createdUploadedFiles.push(path.join(process.cwd(), p.replace(/^\//, "")));
    }

    // -------------------------------------------------------------
    // FASE 3: Consulta via GET /api/worklogs
    // -------------------------------------------------------------
    console.log("\n--> [FASE 3] Consulta via GET /api/worklogs...");

    const getListRes = await fetch(`${baseUrl}/api/worklogs?limit=10`, {
      method: "GET",
      headers: authHeaders,
    });

    assert(getListRes.status === 200, "Status 200 em GET /api/worklogs", `Status: ${getListRes.status}`);
    const listData = await getListRes.json();
    assert(Array.isArray(listData), "GET /api/worklogs retorna array de atendimentos", `Qtd: ${listData.length}`);

    const foundInList = listData.find((log: any) => log.id === logId1);
    assert(Boolean(foundInList), "WorkLog criado está presente na listagem GET /api/worklogs", `ID ${logId1}`);
    assertEqual(
      foundInList?.descriptionInterleaved,
      dbLog1?.descriptionInterleaved,
      "GET /api/worklogs retorna descriptionInterleaved idêntico ao persistido"
    );

    // -------------------------------------------------------------
    // FASE 4: Consulta via GET /api/worklogs/:id
    // -------------------------------------------------------------
    console.log("\n--> [FASE 4] Consulta via GET /api/worklogs/:id...");

    const getSingleRes = await fetch(`${baseUrl}/api/worklogs/${logId1}`, {
      method: "GET",
      headers: authHeaders,
    });

    assert(getSingleRes.status === 200, "Status 200 em GET /api/worklogs/:id", `Status: ${getSingleRes.status}`);
    const singleData = await getSingleRes.json();
    assertEqual(singleData.id, logId1, "ID correto retornado em GET /api/worklogs/:id");
    assertEqual(
      singleData.descriptionInterleaved,
      dbLog1?.descriptionInterleaved,
      "descriptionInterleaved presente e intacto na rota GET /api/worklogs/:id"
    );

    // -------------------------------------------------------------
    // FASE 5: Matching por filename sem fileIndex
    // -------------------------------------------------------------
    console.log("\n--> [FASE 5] POST /api/worklogs com matching de mídia por filename (sem fileIndex)...");

    const filenameOnlyPayload = [
      { type: "text", content: "Evidência A: " },
      {
        type: "media",
        mediaId: "med_a",
        filename: "evidencia_a.png",
        mimeType: "image/png",
      },
      { type: "text", content: "\nEvidência B: " },
      {
        type: "media",
        mediaId: "med_b",
        filename: "evidencia_b.png",
        mimeType: "image/png",
      },
    ];

    const formData2 = new FormData();
    formData2.append("title", "Atendimento com matching por filename");
    formData2.append("requester", "Mariana Lima");
    formData2.append("clientOrOffice", testClient.name);
    formData2.append("tagId", testTag.id);
    formData2.append("reportedProblem", "Evidência A: [Imagem: evidencia_a.png]\nEvidência B: [Imagem: evidencia_b.png]");
    formData2.append("descriptionInterleaved", JSON.stringify(filenameOnlyPayload));
    formData2.append("media", new Blob([dummyPngBuffer1], { type: "image/png" }), "evidencia_a.png");
    formData2.append("media", new Blob([dummyPngBuffer2], { type: "image/png" }), "evidencia_b.png");

    const res2 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formData2,
    });

    const data2 = await res2.json();
    assert(res2.status === 201, "Status 201 ao criar chamado com matching por filename", `Status: ${res2.status}`);
    const logId2 = data2.id;
    createdWorkLogIds.push(logId2);

    const dbLog2 = await prisma.workLog.findUnique({
      where: { id: logId2 },
      select: { descriptionInterleaved: true, media: true },
    });

    const parsedBlocks2 = JSON.parse(dbLog2?.descriptionInterleaved || "[]");
    assert(
      Boolean(parsedBlocks2[1]?.storagePath && parsedBlocks2[1].storagePath.includes("evidencia_a.png")),
      "Mídia 1 associada corretamente ao caminho de evidencia_a.png",
      `storagePath: ${parsedBlocks2[1]?.storagePath}`
    );
    assert(
      Boolean(parsedBlocks2[3]?.storagePath && parsedBlocks2[3].storagePath.includes("evidencia_b.png")),
      "Mídia 2 associada corretamente ao caminho de evidencia_b.png",
      `storagePath: ${parsedBlocks2[3]?.storagePath}`
    );

    const savedMediaList2: string[] = JSON.parse(dbLog2?.media || "[]");
    for (const p of savedMediaList2) {
      createdUploadedFiles.push(path.join(process.cwd(), p.replace(/^\//, "")));
    }

    // -------------------------------------------------------------
    // FASE 6: Retrocompatibilidade (POST sem descriptionInterleaved)
    // -------------------------------------------------------------
    console.log("\n--> [FASE 6] POST /api/worklogs tradicional sem descriptionInterleaved...");

    const formData3 = new FormData();
    formData3.append("title", "Atendimento Clássico Texto Puro");
    formData3.append("requester", "Roberta Silva");
    formData3.append("clientOrOffice", testClient.name);
    formData3.append("tagId", testTag.id);
    formData3.append("reportedProblem", "Descrição clássica de problema sem nenhuma mídia inline.");

    const res3 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formData3,
    });

    const data3 = await res3.json();
    assert(res3.status === 201, "Status 201 em atendimento sem descriptionInterleaved", `Status: ${res3.status}`);
    const logId3 = data3.id;
    createdWorkLogIds.push(logId3);

    const dbLog3 = await prisma.workLog.findUnique({
      where: { id: logId3 },
      select: { descriptionInterleaved: true, reportedProblem: true },
    });

    assertEqual(
      dbLog3?.descriptionInterleaved,
      null,
      "descriptionInterleaved é null no banco para atendimentos sem mídia inline"
    );
    assertEqual(
      dbLog3?.reportedProblem,
      "Descrição clássica de problema sem nenhuma mídia inline.",
      "reportedProblem preservado normalmente"
    );

    // -------------------------------------------------------------
    // FASE 7: Fallback de reportedProblem quando omitido mas descriptionInterleaved enviado
    // -------------------------------------------------------------
    console.log("\n--> [FASE 7] Fallback de texto quando reportedProblem omitido...");

    const fallbackBlocks = [
      { type: "text", content: "Primeiro parágrafo do problema." },
      { type: "media", filename: "anexo.txt", mediaId: "med_f" },
      { type: "text", content: " Segundo parágrafo explicativo." },
    ];

    const formData4 = new FormData();
    formData4.append("title", "Chamado com Descrição apenas em Interleaved");
    formData4.append("requester", "Fábio Santos");
    formData4.append("clientOrOffice", testClient.name);
    formData4.append("tagId", testTag.id);
    formData4.append("descriptionInterleaved", JSON.stringify(fallbackBlocks));

    const res4 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formData4,
    });

    const data4 = await res4.json();
    assert(res4.status === 201, "Status 201 com extração automática de texto do interleaved", `Status: ${res4.status}`);
    const logId4 = data4.id;
    createdWorkLogIds.push(logId4);

    const dbLog4 = await prisma.workLog.findUnique({
      where: { id: logId4 },
      select: { reportedProblem: true, descriptionInterleaved: true },
    });

    assert(
      Boolean(dbLog4?.reportedProblem && dbLog4.reportedProblem.includes("Primeiro parágrafo do problema")),
      "reportedProblem populado a partir dos blocos textuais do interleaved",
      `reportedProblem: "${dbLog4?.reportedProblem}"`
    );

  } finally {
    // -------------------------------------------------------------
    // Limpeza do Ambiente de Teste
    // -------------------------------------------------------------
    console.log("\n🧹 Limpando dados criados durante os testes...");

    for (const workLogId of createdWorkLogIds) {
      try {
        await prisma.aiReport.deleteMany({ where: { workLogId } });
        await prisma.workLogStatusHistory.deleteMany({ where: { workLogId } });
        await prisma.notification.deleteMany({ where: { workLogId } });
        await prisma.workLog.delete({ where: { id: workLogId } });
      } catch (err) {
        console.warn(`Aviso ao excluir WorkLog ${workLogId}:`, err);
      }
    }

    for (const filePath of createdUploadedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }

    server.close();
    console.log("🛑 Servidor de testes encerrado.");
  }

  // -------------------------------------------------------------
  // Relatório Final
  // -------------------------------------------------------------
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log("\n================================================================================");
  console.log(`   RESULTADO FINAL DOS TESTES: ${passed}/${total} PASSADOS (${failed} FALHAS)`);
  console.log("================================================================================\n");

  if (failed > 0) {
    console.error("❌ Falhas detectadas nos testes:");
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(` - ${r.testName}: ${r.error} (${r.evidence})`);
      });
    process.exit(1);
  } else {
    console.log("🎉 Todos os testes de persistência e rotas REST passaram com sucesso!");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("💥 Erro fatal ao executar testes de integração:", err);
  process.exit(1);
});
