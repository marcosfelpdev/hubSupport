/**
 * Integration Test Suite: WorkLog Client Combobox Association & QA Verification
 *
 * Valida o fluxo ponta a ponta:
 * 1. Existência e recuperação de clientes via GET /api/clients.
 * 2. Criação de WorkLog vinculando clientId e clientOrOffice via POST /api/worklogs.
 * 3. Validação de persistência e associação no perfil do cliente via GET /api/clients/:id.
 * 4. Validação de integridade e rejeição HTTP 400 quando clientOrOffice é omitido.
 * 5. Limpeza transacional pós-teste garantindo banco limpo.
 */

import "dotenv/config";
import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import type { Server } from "http";

interface TestResult {
  step: string;
  testName: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, step: string, testName: string, evidence: string) {
  if (condition) {
    testResults.push({ step, testName, passed: true, evidence });
    console.log(`  ✅ [PASS] [${step}] ${testName}\n         -> ${evidence}`);
  } else {
    testResults.push({
      step,
      testName,
      passed: false,
      evidence,
      error: "Assertion failed: expected true but got false",
    });
    console.error(`  ❌ [FAIL] [${step}] ${testName}\n         -> ${evidence}`);
  }
}

function assertEqual<T>(actual: T, expected: T, step: string, testName: string, detail?: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  const evidence = `${detail || testName} => Esperado: ${JSON.stringify(expected)}, Obtido: ${JSON.stringify(actual)}`;
  if (isMatch) {
    testResults.push({ step, testName, passed: true, evidence });
    console.log(`  ✅ [PASS] [${step}] ${testName}\n         -> ${evidence}`);
  } else {
    testResults.push({
      step,
      testName,
      passed: false,
      evidence,
      error: `Mismatch: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    });
    console.error(`  ❌ [FAIL] [${step}] ${testName}\n         -> ${evidence}`);
  }
}

async function runTestSuite() {
  console.log("\n================================================================================");
  console.log("   TESTE DE INTEGRAÇÃO & QA: WORKLOG CLIENT COMBOBOX & HISTÓRICO DO CLIENTE");
  console.log("================================================================================\n");

  // Iniciar servidor HTTP na porta efêmera (0)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor HTTP de testes ativo na porta ${port} (${baseUrl})\n`);

  // Identificadores para rastreamento e cleanup seguro
  const createdClientIds: string[] = [];
  const createdWorkLogIds: string[] = [];
  let createdTagId: string | null = null;
  let createdUserId: string | null = null;

  try {
    // -------------------------------------------------------------
    // FASE 0: Autenticação e Carga de Dependências (User, Tag, Client)
    // -------------------------------------------------------------
    console.log("--> [FASE 0] Preparando usuário, tag e cliente de teste...");

    let authUser = await prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "SUPPORT", "TECHNICIAN"] }, active: true },
    });

    if (!authUser) {
      authUser = await prisma.user.create({
        data: {
          name: "QA Tester Combobox",
          email: `qa.tester.combobox.${Date.now()}@hubsupport.test`,
          password: "hashed_password_qa",
          role: "ADMIN",
          active: true,
        },
      });
      createdUserId = authUser.id;
    }

    const authToken = generateToken({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      role: authUser.role,
    });

    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
    };

    let testTag = await prisma.tag.findFirst();

    if (!testTag) {
      testTag = await prisma.tag.create({
        data: {
          name: `Tag QA Combobox ${Date.now()}`,
          color: "#0284c7",
        },
      });
      createdTagId = testTag.id;
    }

    // a) Garantir cliente de teste existente
    const testClientName = `Cliente Teste Combobox QA ${Date.now()}`;
    const testClient = await prisma.client.create({
      data: {
        name: testClientName,
      },
    });
    createdClientIds.push(testClient.id);

    console.log(`  * Usuário de teste: ${authUser.name} (${authUser.role})`);
    console.log(`  * Tag de teste: ${testTag.name} (ID: ${testTag.id})`);
    console.log(`  * Cliente criado: ${testClient.name} (ID: ${testClient.id})\n`);

    // -------------------------------------------------------------
    // FASE 1: Testar GET /api/clients
    // -------------------------------------------------------------
    console.log("--> [FASE 1] Testando GET /api/clients...");

    const getClientsRes = await fetch(`${baseUrl}/api/clients`, {
      method: "GET",
      headers: authHeaders,
    });

    assert(
      getClientsRes.status === 200,
      "Fase 1",
      "GET /api/clients responde com status HTTP 200",
      `Status HTTP retornado: ${getClientsRes.status}`
    );

    const clientsList = await getClientsRes.json();
    assert(
      Array.isArray(clientsList),
      "Fase 1",
      "GET /api/clients retorna um array de clientes",
      `Quantidade de clientes retornados: ${clientsList.length}`
    );

    const foundClient = clientsList.find((c: any) => c.id === testClient.id);
    assert(
      Boolean(foundClient),
      "Fase 1",
      "Cliente de teste encontrado na listagem retornada por GET /api/clients",
      `Cliente ID ${testClient.id} presente na listagem`
    );

    assertEqual(
      foundClient?.name,
      testClient.name,
      "Fase 1",
      "Nome do cliente na listagem coincide com o cliente cadastrado"
    );

    // -------------------------------------------------------------
    // FASE 2: Testar POST /api/worklogs com clientId e clientOrOffice
    // -------------------------------------------------------------
    console.log("\n--> [FASE 2] Testando POST /api/worklogs com clientId e clientOrOffice...");

    const formData = new FormData();
    formData.append("title", "Atendimento de Teste Integração Combobox");
    formData.append("requester", "Coordenação QA");
    formData.append("clientOrOffice", testClient.name);
    formData.append("clientId", testClient.id);
    formData.append("reportedProblem", "Problema reportado com sucesso para validação do combobox.");
    formData.append("tagId", testTag.id);
    formData.append("status", "Em Andamento");

    const postWorkLogRes = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });

    assert(
      postWorkLogRes.status === 201,
      "Fase 2",
      "POST /api/worklogs retorna HTTP 201 Created",
      `Status HTTP retornado: ${postWorkLogRes.status}`
    );

    const postWorkLogData = await postWorkLogRes.json();
    assert(
      postWorkLogData.success === true,
      "Fase 2",
      "Resposta do POST indica success: true",
      `Resposta: ${JSON.stringify(postWorkLogData)}`
    );

    const createdWorkLogId = postWorkLogData.id || postWorkLogData.logId;
    assert(
      Boolean(createdWorkLogId),
      "Fase 2",
      "ID do WorkLog retornado pela rota POST /api/worklogs",
      `WorkLog ID gerado: ${createdWorkLogId}`
    );
    if (createdWorkLogId) createdWorkLogIds.push(createdWorkLogId);

    // Consulta detalhes do WorkLog via GET /api/worklogs/:id
    const getWorkLogRes = await fetch(`${baseUrl}/api/worklogs/${createdWorkLogId}`, {
      method: "GET",
      headers: authHeaders,
    });

    assert(
      getWorkLogRes.status === 200,
      "Fase 2",
      "GET /api/worklogs/:id retorna HTTP 200",
      `Status HTTP retornado: ${getWorkLogRes.status}`
    );

    const fetchedWorkLog = await getWorkLogRes.json();
    assertEqual(
      fetchedWorkLog.clientId,
      testClient.id,
      "Fase 2",
      "WorkLog persistido possui clientId exatamente igual ao ID do cliente selecionado",
      `clientId esperado: ${testClient.id}`
    );

    assertEqual(
      fetchedWorkLog.clientOrOffice,
      testClient.name,
      "Fase 2",
      "WorkLog persistido possui clientOrOffice exatamente igual ao nome do cliente selecionado",
      `clientOrOffice esperado: ${testClient.name}`
    );

    // -------------------------------------------------------------
    // FASE 3: Testar GET /api/clients/:id (Histórico do Cliente)
    // -------------------------------------------------------------
    console.log("\n--> [FASE 3] Testando GET /api/clients/:id (Histórico de Atendimentos)...");

    const getClientProfileRes = await fetch(`${baseUrl}/api/clients/${testClient.id}`, {
      method: "GET",
      headers: authHeaders,
    });

    assert(
      getClientProfileRes.status === 200,
      "Fase 3",
      "GET /api/clients/:id retorna HTTP 200",
      `Status HTTP retornado: ${getClientProfileRes.status}`
    );

    const clientProfile = await getClientProfileRes.json();
    assert(
      Boolean(clientProfile && clientProfile.client && clientProfile.workLogs),
      "Fase 3",
      "Estrutura da resposta do perfil do cliente contém client e workLogs",
      `Chaves retornadas: ${Object.keys(clientProfile).join(", ")}`
    );

    const workLogInHistory = clientProfile.workLogs.find(
      (w: any) => w.id === createdWorkLogId
    );
    assert(
      Boolean(workLogInHistory),
      "Fase 3",
      "WorkLog recém-criado consta no histórico do perfil do cliente (client.workLogs)",
      `WorkLog ID ${createdWorkLogId} localizado no histórico do cliente`
    );

    assertEqual(
      workLogInHistory?.clientId,
      testClient.id,
      "Fase 3",
      "WorkLog no histórico do cliente referencia o clientId correspondente"
    );

    assert(
      clientProfile.stats?.totalWorkLogs >= 1,
      "Fase 3",
      "Estatísticas de totalWorkLogs do perfil do cliente contabilizam o novo atendimento",
      `totalWorkLogs reportado: ${clientProfile.stats?.totalWorkLogs}`
    );

    // -------------------------------------------------------------
    // FASE 4: Testar rejeição de validação (HTTP 400 sem clientOrOffice)
    // -------------------------------------------------------------
    console.log("\n--> [FASE 4] Testando validação: tentativa de criar WorkLog sem clientOrOffice...");

    const invalidFormData = new FormData();
    invalidFormData.append("title", "Chamado Sem Cliente");
    invalidFormData.append("requester", "Analista de Suporte QA");
    // clientOrOffice intencionalmente omitido
    invalidFormData.append("reportedProblem", "Tentativa de submissão sem cliente especificado.");
    invalidFormData.append("tagId", testTag.id);
    invalidFormData.append("status", "Realizado");

    const postInvalidRes = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: invalidFormData,
    });

    assert(
      postInvalidRes.status === 400,
      "Fase 4",
      "Tentativa de criar WorkLog sem clientOrOffice é rejeitada com HTTP 400 Bad Request",
      `Status HTTP retornado: ${postInvalidRes.status}`
    );

    const postInvalidData = await postInvalidRes.json();
    assert(
      typeof postInvalidData.error === "string" && postInvalidData.error.length > 0,
      "Fase 4",
      "Mensagem de erro de validação descritiva é retornada",
      `Erro retornado: "${postInvalidData.error}"`
    );

    // Também testar envio com clientOrOffice vazio ("   ")
    const emptyClientFormData = new FormData();
    emptyClientFormData.append("title", "Chamado Com Cliente Espaços");
    emptyClientFormData.append("requester", "Analista de Suporte QA");
    emptyClientFormData.append("clientOrOffice", "   ");
    emptyClientFormData.append("reportedProblem", "Tentativa com apenas espaços em clientOrOffice.");
    emptyClientFormData.append("tagId", testTag.id);

    const postEmptyClientRes = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: emptyClientFormData,
    });

    assert(
      postEmptyClientRes.status === 400,
      "Fase 4",
      "Tentativa de criar WorkLog com clientOrOffice em branco/espaços é rejeitada com HTTP 400",
      `Status HTTP retornado: ${postEmptyClientRes.status}`
    );

    console.log();
  } catch (err) {
    console.error("❌ Erro durante a execução dos testes:", err);
    throw err;
  } finally {
    // -------------------------------------------------------------
    // FASE 5: Limpeza dos Dados de Teste & Encerramento do Servidor
    // -------------------------------------------------------------
    console.log("--> [FASE 5] Limpando dados transacionais e encerrando servidor...");

    try {
      if (createdWorkLogIds.length > 0) {
        await prisma.workLogStatusHistory.deleteMany({
          where: { workLogId: { in: createdWorkLogIds } },
        });
        await prisma.workLog.deleteMany({
          where: { id: { in: createdWorkLogIds } },
        });
        console.log(`    * ${createdWorkLogIds.length} WorkLog(s) e históricos removidos.`);
      }

      if (createdClientIds.length > 0) {
        await prisma.client.deleteMany({
          where: { id: { in: createdClientIds } },
        });
        console.log(`    * ${createdClientIds.length} Cliente(s) de teste removidos.`);
      }

      if (createdTagId) {
        await prisma.tag.delete({ where: { id: createdTagId } }).catch(() => {});
        console.log(`    * Tag de teste removida.`);
      }

      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
        console.log(`    * Usuário de teste removido.`);
      }
    } catch (cleanupErr) {
      console.warn("⚠️ Aviso na limpeza de dados de teste:", cleanupErr);
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("    * Servidor de testes finalizado com sucesso.\n");
  }

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log("================================================================================");
  console.log("               RESUMO DOS TESTES DE INTEGRAÇÃO & QA COMBOBOX");
  console.log("================================================================================");

  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log(`Total de asserções executadas: ${total}`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas: ${failed}`);
  console.log(`Taxa de Sucesso: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error("❌ ALERTA: Algumas asserções falharam!");
    for (const r of testResults.filter((r) => !r.passed)) {
      console.error(`  - [${r.step}] ${r.testName}: ${r.error || r.evidence}`);
    }
    process.exit(1);
  } else {
    console.log("🎉 TODOS OS TESTES PASSARAM COM SUCESSO! INTEGRAÇÃO 100% HOMOLOGADA.\n");
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Erro fatal durante a execução do test suite:", err);
  process.exit(1);
});
