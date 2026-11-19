/**
 * Integration Test:
 * Validação do schema do Prisma e rotas de Backend para Categorias Prompt e Ideia:
 * 1. POST /api/worklogs com isPrompt: true -> isPrompt=true, status="Backlog"
 * 2. POST /api/worklogs com isIdea: true -> isIdea=true, status="Backlog"
 * 3. POST /api/worklogs com isPrompt: true e isIdea: true -> ambos true, status="Backlog"
 * 4. GET /api/worklogs/kanban inclui os chamados criados
 * 5. Notificações para técnicos com labels corretas ("Prompt", "Ideia", "Prompt · Ideia")
 * 6. Limpeza e integridade dos dados de teste
 */

import "dotenv/config";
import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import type { Server } from "http";

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
  console.log("   TESTE DE INTEGRAÇÃO: BACKEND PROMPT & IDEIA EM WORKLOGS & KANBAN");
  console.log("================================================================================\n");

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor HTTP de testes ativo na porta ${port} (${baseUrl})\n`);

  const createdWorkLogIds: string[] = [];
  let createdTechnicianId: string | null = null;
  let createdUserId: string | null = null;

  try {
    // -------------------------------------------------------------
    // FASE 0: Usuários, Tags e Clientes
    // -------------------------------------------------------------
    console.log("--> [FASE 0] Preparando dependências (usuário, técnico, tag, cliente)...");

    let testUser = await prisma.user.findFirst({
      where: { active: true },
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          name: "Test Normal User",
          email: `user.test.${Date.now()}@hubsupport.test`,
          password: "test_password_123",
          role: "USER",
        },
      });
      createdUserId = testUser.id;
    }

    // Garantir que exista ao menos um técnico ativo para receber notificações
    let technician = await prisma.user.findFirst({
      where: { role: "TECHNICIAN", active: true },
    });

    if (!technician) {
      technician = await prisma.user.create({
        data: {
          name: "Técnico de Teste",
          email: `tech.test.${Date.now()}@hubsupport.test`,
          password: "tech_password_123",
          role: "TECHNICIAN",
          active: true,
        },
      });
      createdTechnicianId = technician.id;
      console.log(`     Técnico temporário criado para o teste: ${technician.email}`);
    } else {
      console.log(`     Técnico existente encontrado: ${technician.email}`);
    }

    const authToken = generateToken({
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
    });

    assert(Boolean(authToken && authToken.length > 20), "Geração de Token JWT", `Token JWT gerado para ${testUser.name}`);

    // Garantir Tag
    let testTag = await prisma.tag.findFirst();
    if (!testTag) {
      testTag = await prisma.tag.create({
        data: {
          name: `Tag Prompt/Idea ${Date.now()}`,
          color: "#10b981",
        },
      });
    }

    // Garantir Cliente
    let testClient = await prisma.client.findFirst();
    if (!testClient) {
      testClient = await prisma.client.create({
        data: {
          name: `Cliente IA Teste ${Date.now()}`,
        },
      });
    }

    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
    };

    // -------------------------------------------------------------
    // CASO 1: Criar WorkLog com isPrompt: true
    // -------------------------------------------------------------
    console.log("\n--> [CASO 1] POST /api/worklogs com isPrompt: true");

    const form1 = new FormData();
    form1.append("title", "Ajuste de Prompt de Triagem Automática");
    form1.append("requester", "Roberta Silva");
    form1.append("clientOrOffice", testClient.name);
    form1.append("reportedProblem", "Calibrar few-shot examples para suporte de Nível 1");
    form1.append("tagId", testTag.id);
    form1.append("status", "Realizado"); // Deve ser sobrescrito para "Backlog"
    form1.append("isPrompt", "true");
    form1.append("isIdea", "false");

    const res1 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: form1,
    });

    const data1 = (await res1.json()) as { success: boolean; logId?: string; id?: string; error?: string };
    assertEqual(res1.status, 201, "Status HTTP Caso 1 (isPrompt: true)", "Status da resposta");
    assert(Boolean(data1.success && (data1.logId || data1.id)), "Resposta Caso 1", `ID retornado: ${data1.logId || data1.id}`);

    const log1Id = (data1.logId || data1.id)!;
    createdWorkLogIds.push(log1Id);

    const dbLog1 = await prisma.workLog.findUnique({
      where: { id: log1Id },
    });

    assert(Boolean(dbLog1), "Registro Caso 1 encontrado no banco", `Log ID: ${log1Id}`);
    assertEqual(dbLog1?.isPrompt, true, "dbLog1.isPrompt deve ser true");
    assertEqual(dbLog1?.isIdea, false, "dbLog1.isIdea deve ser false");
    assertEqual(dbLog1?.status, "Backlog", "dbLog1.status deve ser 'Backlog' (bloqueio automático)");

    // -------------------------------------------------------------
    // CASO 2: Criar WorkLog com isIdea: true
    // -------------------------------------------------------------
    console.log("\n--> [CASO 2] POST /api/worklogs com isIdea: true");

    const form2 = new FormData();
    form2.append("title", "Ideia: Botão de Resumo de Chamados no WhatsApp");
    form2.append("requester", "Marcos Oliveira");
    form2.append("clientOrOffice", testClient.name);
    form2.append("reportedProblem", "Sugestão de funcionalidade para enviar PDF compactado via webhook");
    form2.append("tagId", testTag.id);
    form2.append("status", "Em andamento"); // Deve ser sobrescrito para "Backlog"
    form2.append("isPrompt", "false");
    form2.append("isIdea", "true");

    const res2 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: form2,
    });

    const data2 = (await res2.json()) as { success: boolean; logId?: string; id?: string };
    assertEqual(res2.status, 201, "Status HTTP Caso 2 (isIdea: true)", "Status da resposta");

    const log2Id = (data2.logId || data2.id)!;
    createdWorkLogIds.push(log2Id);

    const dbLog2 = await prisma.workLog.findUnique({
      where: { id: log2Id },
    });

    assertEqual(dbLog2?.isPrompt, false, "dbLog2.isPrompt deve ser false");
    assertEqual(dbLog2?.isIdea, true, "dbLog2.isIdea deve ser true");
    assertEqual(dbLog2?.status, "Backlog", "dbLog2.status deve ser 'Backlog' (bloqueio automático)");

    // -------------------------------------------------------------
    // CASO 3: Criar WorkLog com isPrompt: true E isIdea: true
    // -------------------------------------------------------------
    console.log("\n--> [CASO 3] POST /api/worklogs com isPrompt: true e isIdea: true (combinados)");

    const form3 = new FormData();
    form3.append("title", "Prompt & Ideia: Assistente de Rascunho de E-mails com Gemini");
    form3.append("requester", "Juliana Costa");
    form3.append("clientOrOffice", testClient.name);
    form3.append("reportedProblem", "Prototipar prompt de assistência criativa para técnicos");
    form3.append("tagId", testTag.id);
    form3.append("status", "Solucionado"); // Deve ser sobrescrito para "Backlog"
    form3.append("isPrompt", "true");
    form3.append("isIdea", "true");

    const res3 = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: form3,
    });

    const data3 = (await res3.json()) as { success: boolean; logId?: string; id?: string };
    assertEqual(res3.status, 201, "Status HTTP Caso 3 (Prompt + Ideia)", "Status da resposta");

    const log3Id = (data3.logId || data3.id)!;
    createdWorkLogIds.push(log3Id);

    const dbLog3 = await prisma.workLog.findUnique({
      where: { id: log3Id },
    });

    assertEqual(dbLog3?.isPrompt, true, "dbLog3.isPrompt deve ser true");
    assertEqual(dbLog3?.isIdea, true, "dbLog3.isIdea deve ser true");
    assertEqual(dbLog3?.status, "Backlog", "dbLog3.status deve ser 'Backlog' (bloqueio automático)");

    // -------------------------------------------------------------
    // CASO 4: GET /api/worklogs/kanban e GET /api/worklogs?type=technical
    // -------------------------------------------------------------
    console.log("\n--> [CASO 4] Consulta Kanban (/api/worklogs/kanban e ?type=technical)");

    const kanbanRes = await fetch(`${baseUrl}/api/worklogs/kanban`, {
      headers: authHeaders,
    });
    assertEqual(kanbanRes.status, 200, "Status HTTP GET /api/worklogs/kanban");
    const kanbanLogs = (await kanbanRes.json()) as any[];

    const found1InKanban = kanbanLogs.find((l) => l.id === log1Id);
    const found2InKanban = kanbanLogs.find((l) => l.id === log2Id);
    const found3InKanban = kanbanLogs.find((l) => l.id === log3Id);

    assert(Boolean(found1InKanban), "Chamado com isPrompt: true está no Kanban", `ID ${log1Id}`);
    assertEqual(found1InKanban?.isPrompt, true, "Atributo isPrompt preservado no Kanban (Caso 1)");

    assert(Boolean(found2InKanban), "Chamado com isIdea: true está no Kanban", `ID ${log2Id}`);
    assertEqual(found2InKanban?.isIdea, true, "Atributo isIdea preservado no Kanban (Caso 2)");

    assert(Boolean(found3InKanban), "Chamado híbrido (Prompt + Ideia) está no Kanban", `ID ${log3Id}`);
    assertEqual(found3InKanban?.isPrompt, true, "Atributo isPrompt preservado no Kanban (Caso 3)");
    assertEqual(found3InKanban?.isIdea, true, "Atributo isIdea preservado no Kanban (Caso 3)");

    // Validar retrocompatibilidade com /api/worklogs?type=technical
    const technicalRes = await fetch(`${baseUrl}/api/worklogs?type=technical`, {
      headers: authHeaders,
    });
    assertEqual(technicalRes.status, 200, "Status HTTP GET /api/worklogs?type=technical");
    const technicalLogs = (await technicalRes.json()) as any[];

    assert(
      technicalLogs.some((l) => l.id === log1Id) &&
      technicalLogs.some((l) => l.id === log2Id) &&
      technicalLogs.some((l) => l.id === log3Id),
      "Retrocompatibilidade: todos os 3 chamados retornam em ?type=technical",
      `log1, log2 e log3 encontrados em ?type=technical`
    );

    // -------------------------------------------------------------
    // CASO 5: Validação das Notificações para Técnicos
    // -------------------------------------------------------------
    console.log("\n--> [CASO 5] Validação das Notificações para Técnicos");

    const notifications = await prisma.notification.findMany({
      where: {
        workLogId: { in: createdWorkLogIds },
      },
    });

    const notifPrompt = notifications.find((n) => n.workLogId === log1Id);
    const notifIdea = notifications.find((n) => n.workLogId === log2Id);
    const notifPromptIdea = notifications.find((n) => n.workLogId === log3Id);

    assert(Boolean(notifPrompt), "Notificação gerada para chamado Prompt", `ID worklog: ${log1Id}`);
    assert(
      Boolean(notifPrompt && notifPrompt.message.includes("(Prompt)")),
      "Mensagem da notificação de Prompt contém '(Prompt)'",
      notifPrompt?.message || ""
    );

    assert(Boolean(notifIdea), "Notificação gerada para chamado Ideia", `ID worklog: ${log2Id}`);
    assert(
      Boolean(notifIdea && notifIdea.message.includes("(Ideia)")),
      "Mensagem da notificação de Ideia contém '(Ideia)'",
      notifIdea?.message || ""
    );

    assert(Boolean(notifPromptIdea), "Notificação gerada para chamado Prompt · Ideia", `ID worklog: ${log3Id}`);
    assert(
      Boolean(notifPromptIdea && notifPromptIdea.message.includes("(Prompt · Ideia)")),
      "Mensagem da notificação combinada contém '(Prompt · Ideia)'",
      notifPromptIdea?.message || ""
    );

    // -------------------------------------------------------------
    // CASO 6: Chamado Comum sem Categorias Técnicas
    // -------------------------------------------------------------
    console.log("\n--> [CASO 6] POST /api/worklogs sem categorias técnicas (deve manter status)");

    const formNormal = new FormData();
    formNormal.append("title", "Dúvida de Login no Painel");
    formNormal.append("requester", "Lucas Mendes");
    formNormal.append("clientOrOffice", testClient.name);
    formNormal.append("reportedProblem", "Usuário esqueceu a senha e precisava de redefinição");
    formNormal.append("tagId", testTag.id);
    formNormal.append("status", "Solucionado"); // NÃO deve virar Backlog
    formNormal.append("isPrompt", "false");
    formNormal.append("isIdea", "false");

    const resNormal = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: authHeaders,
      body: formNormal,
    });

    const dataNormal = (await resNormal.json()) as { success: boolean; logId?: string; id?: string };
    const logNormalId = (dataNormal.logId || dataNormal.id)!;
    createdWorkLogIds.push(logNormalId);

    const dbLogNormal = await prisma.workLog.findUnique({
      where: { id: logNormalId },
    });

    assertEqual(dbLogNormal?.isPrompt, false, "Chamado normal: isPrompt é false");
    assertEqual(dbLogNormal?.isIdea, false, "Chamado normal: isIdea é false");
    assertEqual(dbLogNormal?.status, "Solucionado", "Chamado normal: status 'Solucionado' preservado (não forçado para Backlog)");

    // Não deve constar no kanban
    const kanbanCheck = await fetch(`${baseUrl}/api/worklogs/kanban`, {
      headers: authHeaders,
    });
    const kanbanCheckLogs = (await kanbanCheck.json()) as any[];
    assert(
      !kanbanCheckLogs.some((l) => l.id === logNormalId),
      "Chamado normal não entra no Kanban técnico",
      `ID ${logNormalId} ausente do Kanban como esperado`
    );

  } finally {
    // -------------------------------------------------------------
    // LIMPEZA
    // -------------------------------------------------------------
    console.log("\n--> [LIMPEZA] Removendo dados criados durante os testes...");
    try {
      if (createdWorkLogIds.length > 0) {
        await prisma.notification.deleteMany({
          where: { workLogId: { in: createdWorkLogIds } },
        });
        await prisma.aiReport.deleteMany({
          where: { workLogId: { in: createdWorkLogIds } },
        });
        await prisma.workLogStatusHistory.deleteMany({
          where: { workLogId: { in: createdWorkLogIds } },
        });
        await prisma.workLog.deleteMany({
          where: { id: { in: createdWorkLogIds } },
        });
        console.log(`     Removidos ${createdWorkLogIds.length} atendimentos de teste e dependências.`);
      }

      if (createdTechnicianId) {
        await prisma.user.delete({ where: { id: createdTechnicianId } });
        console.log(`     Técnico temporário ${createdTechnicianId} removido.`);
      }

      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } });
        console.log(`     Usuário temporário ${createdUserId} removido.`);
      }
    } catch (cleanupErr) {
      console.warn("⚠️ Aviso na limpeza de dados:", cleanupErr);
    }

    server.close();
  }

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("   SUMÁRIO DE EXECUÇÃO DOS TESTES");
  console.log("================================================================================");

  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;
  const totalCount = testResults.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log(`Total de testes: ${totalCount}`);
  console.log(`Sucessos:        ${passedCount}`);
  console.log(`Falhas:          ${failedCount}`);
  console.log(`Taxa de sucesso: ${passRate}%\n`);

  if (failedCount > 0) {
    console.error("❌ ALGUNS TESTES FALHARAM!");
    process.exit(1);
  } else {
    console.log("✨ TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!");
  }
}

runTests().catch((err) => {
  console.error("❌ Erro fatal durante a execução dos testes:", err);
  process.exit(1);
});
