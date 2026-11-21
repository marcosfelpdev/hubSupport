/**
 * Teste End-to-End (E2E) Automatizado:
 * Verificação da Trava Obrigatória de Mídia em Atendimentos / Relatórios.
 * 
 * Regra de Negócio:
 * "Sempre deve haver uma mídia anexada nos relatórios que forem criados,
 * gravações também contam como mídias anexadas."
 * 
 * Cenários Testados:
 * 1. POST /api/worklogs SEM mídia e SEM gravação de tela -> Deve retornar HTTP 400 com mensagem da trava.
 * 2. POST /api/worklogs COM arquivo de mídia (imagem/print) -> Deve aceitar validação e retornar HTTP 201.
 * 3. POST /api/worklogs COM gravação de tela (recordedVideo) -> Deve aceitar validação e retornar HTTP 201.
 * 4. Limpeza completa dos dados gerados após a execução dos testes.
 */

import "dotenv/config";
import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import { deleteFile } from "../src/server/services/r2Storage";
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
    console.log(`  ✅ [PASS] ${testName}`);
    console.log(`         -> Evidência: ${evidence}`);
  } else {
    testResults.push({
      testName,
      passed: false,
      evidence,
      error: "Falha de asserção: esperado verdadeiro, obtido falso",
    });
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`         -> Evidência: ${evidence}`);
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string, detail?: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  const evidence = `${detail || testName} => Esperado: ${JSON.stringify(expected)}, Obtido: ${JSON.stringify(actual)}`;
  if (isMatch) {
    testResults.push({ testName, passed: true, evidence });
    console.log(`  ✅ [PASS] ${testName}`);
    console.log(`         -> Evidência: ${evidence}`);
  } else {
    testResults.push({
      testName,
      passed: false,
      evidence,
      error: `Divergência: esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`,
    });
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`         -> Evidência: ${evidence}`);
  }
}

async function runTests() {
  console.log("\n================================================================================");
  console.log("   TESTE E2E: VALIDAÇÃO DA TRAVA OBRIGATÓRIA DE MÍDIA / GRAVAÇÃO EM WORKLOGS");
  console.log("================================================================================\n");

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor HTTP de testes inicializado na porta ${port} (${baseUrl})\n`);

  const createdWorkLogIds: string[] = [];
  const createdUploadedKeys: string[] = [];
  const createdLocalFilePaths: string[] = [];

  try {
    // -------------------------------------------------------------
    // FASE 0: Autenticação e Carga de Dependências (Admin, Tag, Client)
    // -------------------------------------------------------------
    console.log("--> [FASE 0] Preparando dependências de teste (Admin, Tag, Cliente)...");

    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", active: true },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "QA Admin Mandatory Media",
          email: `qa.mandatory.media.${Date.now()}@hubsupport.test`,
          password: "hashed_test_password_123",
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

    assert(Boolean(authToken && authToken.length > 20), "Geração de Token JWT de Autenticação", `Token gerado para ${adminUser.name}`);

    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
    };

    let testTag = await prisma.tag.findFirst();
    if (!testTag) {
      testTag = await prisma.tag.create({
        data: {
          name: `Tag QA ${Date.now()}`,
          color: "#10b981",
        },
      });
    }

    let testClient = await prisma.client.findFirst();
    if (!testClient) {
      testClient = await prisma.client.create({
        data: {
          name: `Cliente QA Teste ${Date.now()}`,
        },
      });
    }

    // -------------------------------------------------------------
    // CENÁRIO 1: POST /api/worklogs SEM mídias e SEM gravador de vídeo
    // DEVE retornar HTTP 400 com mensagem explicativa da trava obrigatória
    // -------------------------------------------------------------
    console.log("\n--> [CENÁRIO 1] Testando envio SEM mídias e SEM gravação de tela...");

    const uniqueTitle1 = `[QA TEST] Falha de Impressão Sem Mídia ${Date.now()}`;
    const formDataNoMedia = new FormData();
    formDataNoMedia.append("title", uniqueTitle1);
    formDataNoMedia.append("requester", "Mariana QA Tester");
    formDataNoMedia.append("clientOrOffice", testClient.name);
    formDataNoMedia.append("tagId", testTag.id);
    formDataNoMedia.append(
      "reportedProblem",
      "Tentativa de registrar atendimento sem nenhum anexo ou gravação de tela para validar bloqueio."
    );

    const res1 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formDataNoMedia,
    });

    const data1 = await res1.json();

    assertEqual(res1.status, 400, "Cenário 1: Status HTTP 400 para requisição sem mídia", `Status HTTP recebido: ${res1.status}`);
    assert(
      typeof data1.error === "string" &&
        data1.error.includes("Trava obrigatória: É necessário anexar ao menos uma mídia"),
      "Cenário 1: Mensagem de erro reflete a trava de mídia obrigatória",
      `Mensagem recebida: "${data1.error}"`
    );

    // Verificação de garantia no banco de dados (nenhum WorkLog foi criado)
    const checkDbLog1 = await prisma.workLog.findFirst({
      where: { title: uniqueTitle1 },
    });
    assert(checkDbLog1 === null, "Cenário 1: Nenhum registro inserido no SQLite para requisição rejeitada", `Busca retornou null`);

    // -------------------------------------------------------------
    // CENÁRIO 2: POST /api/worklogs COM arquivo de imagem/mídia anexado
    // DEVE aceitar a validação de mídia e retornar HTTP 201 com WorkLog criado
    // -------------------------------------------------------------
    console.log("\n--> [CENÁRIO 2] Testando envio COM arquivo de imagem anexado...");

    const uniqueTitle2 = `[QA TEST] Chamado Com Print de Erro ${Date.now()}`;
    const dummyImageBuffer = Buffer.from(
      "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    );

    const formDataWithImage = new FormData();
    formDataWithImage.append("title", uniqueTitle2);
    formDataWithImage.append("requester", "Mariana QA Tester");
    formDataWithImage.append("clientOrOffice", testClient.name);
    formDataWithImage.append("tagId", testTag.id);
    formDataWithImage.append(
      "reportedProblem",
      "Chamado registrado com imagem anexada comprovando o erro em tela."
    );
    formDataWithImage.append(
      "media",
      new Blob([dummyImageBuffer], { type: "image/png" }),
      "evidencia_erro_qa.png"
    );

    const res2 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formDataWithImage,
    });

    const data2 = await res2.json();

    assertEqual(res2.status, 201, "Cenário 2: Status HTTP 201 para chamado com imagem anexada", `Status HTTP recebido: ${res2.status}`);
    assertEqual(data2.success, true, "Cenário 2: Resposta contém success = true");
    assert(Boolean(data2.id), "Cenário 2: ID do WorkLog retornado pela API", `ID gerado: ${data2.id}`);

    const logId2 = data2.id;
    if (logId2) {
      createdWorkLogIds.push(logId2);

      // Verificação direta no banco SQLite
      const dbLog2 = await prisma.workLog.findUnique({
        where: { id: logId2 },
      });

      assert(Boolean(dbLog2), "Cenário 2: WorkLog persistido com sucesso no banco SQLite", `Registro id: ${dbLog2?.id}`);
      
      const mediaList2: string[] = JSON.parse(dbLog2?.media || "[]");
      assert(
        mediaList2.length >= 1,
        "Cenário 2: Campo media do WorkLog contém ao menos 1 anexo registrado",
        `Arquivos em media: ${JSON.stringify(mediaList2)}`
      );

      for (const m of mediaList2) {
        createdUploadedKeys.push(m.replace(/^\//, ""));
        createdLocalFilePaths.push(path.join(process.cwd(), m.replace(/^\//, "")));
      }
    }

    // -------------------------------------------------------------
    // CENÁRIO 3: POST /api/worklogs COM gravação de tela (recordedVideo)
    // Gravação conta como mídia anexada: DEVE passar com HTTP 201
    // -------------------------------------------------------------
    console.log("\n--> [CENÁRIO 3] Testando envio COM gravação de tela (recordedVideo)...");

    const uniqueTitle3 = `[QA TEST] Chamado Com Gravação de Tela ${Date.now()}`;
    const dummyVideoBuffer = Buffer.from(
      "\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04\x42\xf3\x81\x08TEST_RECORDING_CHUNK"
    );

    const formDataWithVideo = new FormData();
    formDataWithVideo.append("title", uniqueTitle3);
    formDataWithVideo.append("requester", "Mariana QA Tester");
    formDataWithVideo.append("clientOrOffice", testClient.name);
    formDataWithVideo.append("tagId", testTag.id);
    formDataWithVideo.append(
      "reportedProblem",
      "Chamado registrado exclusivamente com gravação de tela demonstrando o fluxo operacional."
    );
    formDataWithVideo.append(
      "recordedVideo",
      new Blob([dummyVideoBuffer], { type: "video/webm" }),
      "gravacao_procedimento_qa.webm"
    );

    const res3 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formDataWithVideo,
    });

    const data3 = await res3.json();

    assertEqual(res3.status, 201, "Cenário 3: Status HTTP 201 para chamado com gravação de tela", `Status HTTP recebido: ${res3.status}`);
    assertEqual(data3.success, true, "Cenário 3: Resposta contém success = true");
    assert(Boolean(data3.id), "Cenário 3: ID do WorkLog retornado pela API", `ID gerado: ${data3.id}`);

    const logId3 = data3.id;
    if (logId3) {
      createdWorkLogIds.push(logId3);

      // Verificação do WorkLog e do registro correspondente de AiReport
      const dbLog3 = await prisma.workLog.findUnique({
        where: { id: logId3 },
        include: { aiReport: true },
      });

      assert(Boolean(dbLog3), "Cenário 3: WorkLog persistido com sucesso no banco SQLite", `Registro id: ${dbLog3?.id}`);
      assert(
        Boolean(dbLog3?.aiReport?.videoPath && dbLog3.aiReport.videoPath.includes("gravacao_procedimento_qa")),
        "Cenário 3: AiReport associado contém o videoPath apontando para a gravação de tela",
        `videoPath registrado: ${dbLog3?.aiReport?.videoPath}`
      );

      if (dbLog3?.aiReport?.videoPath) {
        createdUploadedKeys.push(dbLog3.aiReport.videoPath);
        createdLocalFilePaths.push(path.join(process.cwd(), dbLog3.aiReport.videoPath));
      }
    }

    // -------------------------------------------------------------
    // CENÁRIO 4: POST /api/worklogs COM ambos (mídia + gravação de tela)
    // Cobertura extra: Múltiplas mídias e gravação simultânea
    // -------------------------------------------------------------
    console.log("\n--> [CENÁRIO 4 - EXTRA] Testando envio com AMBOS (imagem e gravação de tela)...");

    const uniqueTitle4 = `[QA TEST] Chamado Com Mídia e Vídeo Juntos ${Date.now()}`;
    const formDataCombined = new FormData();
    formDataCombined.append("title", uniqueTitle4);
    formDataCombined.append("requester", "Mariana QA Tester");
    formDataCombined.append("clientOrOffice", testClient.name);
    formDataCombined.append("tagId", testTag.id);
    formDataCombined.append(
      "reportedProblem",
      "Chamado registrado com imagem e gravação de tela em simultâneo."
    );
    formDataCombined.append(
      "media",
      new Blob([dummyImageBuffer], { type: "image/png" }),
      "screenshot_anexo_qa.png"
    );
    formDataCombined.append(
      "recordedVideo",
      new Blob([dummyVideoBuffer], { type: "video/webm" }),
      "video_passo_a_passo_qa.webm"
    );

    const res4 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formDataCombined,
    });

    const data4 = await res4.json();

    assertEqual(res4.status, 201, "Cenário 4: Status HTTP 201 para envio combinado de mídia e gravação", `Status: ${res4.status}`);
    if (data4.id) {
      createdWorkLogIds.push(data4.id);
      const dbLog4 = await prisma.workLog.findUnique({
        where: { id: data4.id },
        include: { aiReport: true },
      });
      if (dbLog4?.aiReport?.videoPath) {
        createdUploadedKeys.push(dbLog4.aiReport.videoPath);
        createdLocalFilePaths.push(path.join(process.cwd(), dbLog4.aiReport.videoPath));
      }
      const mediaList4: string[] = JSON.parse(dbLog4?.media || "[]");
      for (const m of mediaList4) {
        createdUploadedKeys.push(m.replace(/^\//, ""));
        createdLocalFilePaths.push(path.join(process.cwd(), m.replace(/^\//, "")));
      }
    }

  } finally {
    // -------------------------------------------------------------
    // LIMPEZA GARANTIDA: Remoção dos registros criados no SQLite e arquivos
    // -------------------------------------------------------------
    console.log("\n🧹 Executando limpeza dos dados criados durante os testes...");

    // Pequena pausa para garantir que os handlers em segundo plano não colidam
    await new Promise((resolve) => setTimeout(resolve, 500));

    for (const workLogId of createdWorkLogIds) {
      try {
        await prisma.aiReport.deleteMany({ where: { workLogId } });
        await prisma.workLogStatusHistory.deleteMany({ where: { workLogId } });
        await prisma.workLogNote.deleteMany({ where: { workLogId } });
        await prisma.notification.deleteMany({ where: { workLogId } });
        await prisma.workLog.delete({ where: { id: workLogId } });
        console.log(`  🗑️ WorkLog ${workLogId} e registros filhos removidos do SQLite.`);
      } catch (cleanupErr) {
        console.warn(`  ⚠️ Aviso ao remover WorkLog ${workLogId}:`, cleanupErr);
      }
    }

    // Limpeza de arquivos no storage (R2 e/ou disco local)
    for (const key of createdUploadedKeys) {
      try {
        await deleteFile(key);
      } catch {}
    }

    for (const localPath of createdLocalFilePaths) {
      try {
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch {}
    }

    server.close();
    console.log("🛑 Servidor HTTP de testes encerrado com sucesso.");
  }

  // -------------------------------------------------------------
  // RELATÓRIO CONSOLIDADO
  // -------------------------------------------------------------
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log("\n================================================================================");
  console.log(`   RELATÓRIO CONSOLIDADO: ${passed}/${total} TESTES APROVADOS (${failed} FALHAS)`);
  console.log("================================================================================\n");

  if (failed > 0) {
    console.error("❌ Ocorreram falhas durante os testes:");
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(` - ${r.testName}: ${r.error} (${r.evidence})`);
      });
    process.exit(1);
  } else {
    console.log("🎉 Todos os cenários da trava obrigatória de mídia foram verificados e aprovados com 100% de sucesso!");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("💥 Erro fatal durante a execução dos testes E2E:", err);
  process.exit(1);
});
