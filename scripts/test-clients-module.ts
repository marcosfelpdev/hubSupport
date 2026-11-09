/**
 * QA Automation & Audit Test Suite: Módulo de Clientes (HubSupport)
 * 
 * Executa testes automatizados cobrindo:
 * 1. Validações de criação de cliente (nome obrigatório, rejeição de duplicatas case-insensitive, trim de espaços).
 * 2. Associação de atendimentos (WorkLogs) e reuniões (AgendaEvents) ao cliente (retroativa e direta).
 * 3. Retorno do perfil detalhado com histórico ordenado (GET /api/clients/:id, ordenação, métricas de stats).
 * 4. Remoção de cliente mantendo integridade referencial (onDelete: SetNull para WorkLogs e AgendaEvents, RBAC).
 */

import "dotenv/config";
import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import type { Server } from "http";

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, testName: string, evidence: string) {
  if (condition) {
    results.push({ suite, testName, passed: true, evidence });
    console.log(`  [PASS] [${suite}] ${testName}\n         -> ${evidence}`);
  } else {
    results.push({
      suite,
      testName,
      passed: false,
      evidence,
      error: "Assertion failed: expected true but got false",
    });
    console.error(`  [FAIL] [${suite}] ${testName}\n         -> ${evidence}`);
  }
}

function assertEqual<T>(actual: T, expected: T, suite: string, testName: string, detail?: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  const evidence = `${detail || testName} => Esperado: ${JSON.stringify(expected)}, Obtido: ${JSON.stringify(actual)}`;
  if (isMatch) {
    results.push({ suite, testName, passed: true, evidence });
    console.log(`  [PASS] [${suite}] ${testName}\n         -> ${evidence}`);
  } else {
    results.push({
      suite,
      testName,
      passed: false,
      evidence,
      error: `Mismatch: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    });
    console.error(`  [FAIL] [${suite}] ${testName}\n         -> ${evidence}`);
  }
}

async function runTestSuite() {
  console.log("\n=======================================================================");
  console.log("   QA AUDIT & AUTOMATION TEST SUITE: MÓDULO DE CLIENTES (HUBSUPPORT)");
  console.log("=======================================================================\n");

  // Inicia servidor em porta efêmera dedicada
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor de testes ativo em ${baseUrl}\n`);

  // Identificadores para limpeza pós-teste
  const testClientIds: string[] = [];
  const testWorkLogIds: string[] = [];
  const testAgendaEventIds: string[] = [];
  let testTagId: string | null = null;
  let testAdminUserId: string | null = null;
  let testNormalUserId: string | null = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Obter ou criar usuários e tags de teste
    // -------------------------------------------------------------
    console.log("--> Preparando ambiente de testes (Usuários, Tags, Tokens JWT)...");

    // 1. Tag de teste
    let tag = await prisma.tag.findFirst({ where: { name: "QA_TEST_TAG" } });
    if (!tag) {
      tag = await prisma.tag.create({
        data: {
          name: "QA_TEST_TAG",
          color: "#6366f1",
        },
      });
    }
    testTagId = tag.id;

    // 2. Usuário Admin
    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", active: true },
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "Admin QA Verifier",
          email: `admin.qa.${Date.now()}@hubsupport.test`,
          password: "password_hash_test",
          role: "ADMIN",
        },
      });
      testAdminUserId = adminUser.id;
    }

    // 3. Usuário Regular (USER)
    let normalUser = await prisma.user.findFirst({
      where: { role: "USER", active: true },
    });
    if (!normalUser) {
      normalUser = await prisma.user.create({
        data: {
          name: "User Normal QA",
          email: `user.qa.${Date.now()}@hubsupport.test`,
          password: "password_hash_test",
          role: "USER",
        },
      });
      testNormalUserId = normalUser.id;
    }

    const adminToken = generateToken({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    });

    const userToken = generateToken({
      id: normalUser.id,
      name: normalUser.name,
      email: normalUser.email,
      role: normalUser.role,
    });

    console.log(`    Admin para testes: ${adminUser.name} (${adminUser.role})`);
    console.log(`    Usuário para testes: ${normalUser.name} (${normalUser.role})`);
    console.log("    Tokens JWT gerados com sucesso.\n");

    // Prefixos únicos para isolar os dados de teste
    const uniquePrefix = `QA_Client_${Date.now()}`;

    // =============================================================
    // SUITE 1: Validações de Criação de Cliente (POST /api/clients)
    // =============================================================
    console.log("---------------------------------------------------------------");
    console.log(" SUITE 1: Validações de Criação de Cliente (POST /api/clients)");
    console.log("---------------------------------------------------------------");

    // 1.1 Requisição sem autenticação
    const unauthRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cliente Sem Token" }),
    });
    assertEqual(unauthRes.status, 401, "Suite 1", "1.1 Rejeição de requisição sem token JWT (HTTP 401)");

    // 1.2 Nome não fornecido ou vazio
    const emptyNameRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "" }),
    });
    assertEqual(emptyNameRes.status, 400, "Suite 1", "1.2 Rejeição de nome vazio (HTTP 400)");

    // 1.3 Nome contendo apenas espaços
    const whitespaceNameRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "     " }),
    });
    assertEqual(whitespaceNameRes.status, 400, "Suite 1", "1.3 Rejeição de nome composto apenas por espaços (HTTP 400)");

    // 1.4 Criação com trim de espaços laterais
    const rawNameWithSpaces = `   ${uniquePrefix}_Alfa   `;
    const expectedTrimmedName = `${uniquePrefix}_Alfa`;

    const createAlfaRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: rawNameWithSpaces }),
    });
    assertEqual(createAlfaRes.status, 201, "Suite 1", "1.4 Sucesso ao cadastrar cliente válido (HTTP 201)");

    const createAlfaData = await createAlfaRes.json();
    testClientIds.push(createAlfaData.client.id);
    assertEqual(
      createAlfaData.client.name,
      expectedTrimmedName,
      "Suite 1",
      "1.5 Trim automático de espaços ao salvar no banco",
      `O nome salvo deve ser "${expectedTrimmedName}"`
    );

    // 1.6 Rejeição de cliente com nome duplicado exato
    const duplicateExactRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: expectedTrimmedName }),
    });
    assertEqual(duplicateExactRes.status, 409, "Suite 1", "1.6 Rejeição de nome duplicado idêntico (HTTP 409)");

    // 1.7 Rejeição de cliente com nome duplicado case-insensitive (minúsculas / maiúsculas)
    const duplicateCaseRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: expectedTrimmedName.toLowerCase() }),
    });
    assertEqual(duplicateCaseRes.status, 409, "Suite 1", "1.7 Rejeição de nome duplicado case-insensitive (HTTP 409)");

    console.log();

    // =============================================================
    // SUITE 2: Associação de Atendimentos (WorkLogs) e Reuniões (AgendaEvents)
    // =============================================================
    console.log("---------------------------------------------------------------");
    console.log(" SUITE 2: Associação de Atendimentos e Reuniões");
    console.log("---------------------------------------------------------------");

    const retroClientName = `${uniquePrefix}_BetaRetro`;

    // 2.1 Criar WorkLog antes da existência do cliente no banco
    const preExistingWorkLog = await prisma.workLog.create({
      data: {
        title: "Atendimento Pré-existente",
        requester: "João Suporte",
        clientOrOffice: retroClientName,
        reportedProblem: "Dúvida sobre emissão de notas",
        actionTaken: "Orientação prestada",
        status: "Realizado",
        userId: adminUser.id,
        tagId: testTagId,
        clientId: null,
      },
    });
    testWorkLogIds.push(preExistingWorkLog.id);

    assert(
      preExistingWorkLog.clientId === null,
      "Suite 2",
      "2.1 WorkLog pré-existente criado sem clientId",
      `WorkLog ${preExistingWorkLog.id} tem clientId=null antes de cadastrar cliente`
    );

    // 2.2 Criar AgendaEvent antes da existência do cliente no banco
    const preExistingEvent = await prisma.agendaEvent.create({
      data: {
        title: `Reunião de Diagnóstico - ${retroClientName}`,
        date: "2026-11-20",
        time: "14:30",
        category: "Reunião",
        createdById: adminUser.id,
        employeeId: adminUser.id,
        clientId: null,
      },
    });
    testAgendaEventIds.push(preExistingEvent.id);

    assert(
      preExistingEvent.clientId === null,
      "Suite 2",
      "2.2 AgendaEvent pré-existente criado sem clientId",
      `AgendaEvent ${preExistingEvent.id} tem clientId=null antes de cadastrar cliente`
    );

    // 2.3 Agora cadastrar o cliente retroativo via POST /api/clients
    const createRetroRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: retroClientName }),
    });
    assertEqual(createRetroRes.status, 201, "Suite 2", "2.3 Criação do cliente retroativo (HTTP 201)");
    const retroClientData = await createRetroRes.json();
    const retroClientId = retroClientData.client.id;
    testClientIds.push(retroClientId);

    // 2.4 Verificar se o WorkLog pré-existente foi vinculado retroativamente por clientId
    const reloadedWorkLog = await prisma.workLog.findUnique({
      where: { id: preExistingWorkLog.id },
    });
    assertEqual(
      reloadedWorkLog?.clientId,
      retroClientId,
      "Suite 2",
      "2.4 Vinculação retroativa automática de WorkLog ao novo Client",
      `WorkLog.clientId agora é ${retroClientId}`
    );

    // 2.5 Verificar se o AgendaEvent pré-existente foi vinculado retroativamente por clientId
    const reloadedEvent = await prisma.agendaEvent.findUnique({
      where: { id: preExistingEvent.id },
    });
    assertEqual(
      reloadedEvent?.clientId,
      retroClientId,
      "Suite 2",
      "2.5 Vinculação retroativa automática de AgendaEvent ao novo Client",
      `AgendaEvent.clientId agora é ${retroClientId}`
    );

    // 2.6 Criar novo WorkLog via POST /api/worklogs associado diretamente ao cliente
    const directWorkLogRes = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Segundo Atendimento Direto",
        requester: "Maria Financeiro",
        clientOrOffice: retroClientName,
        reportedProblem: "Configuração de certificado digital",
        actionTaken: "Certificado instalado",
        status: "Solucionado",
        tagId: testTagId,
        clientId: retroClientId,
      }),
    });
    assertEqual(directWorkLogRes.status, 201, "Suite 2", "2.6 Criação de WorkLog direto via API (HTTP 201)");
    const directWorkLogData = await directWorkLogRes.json();
    const createdLogId = directWorkLogData.id || directWorkLogData.logId;
    testWorkLogIds.push(createdLogId);

    const directWorkLogFromDb = await prisma.workLog.findUnique({
      where: { id: createdLogId },
    });
    assertEqual(
      directWorkLogFromDb?.clientId,
      retroClientId,
      "Suite 2",
      "2.7 WorkLog criado com clientId vinculado diretamente",
      `WorkLog.clientId retornado é ${directWorkLogFromDb?.clientId}`
    );

    // 2.7 Criar nova reunião via POST /api/agenda associada diretamente ao cliente
    const directAgendaRes = await fetch(`${baseUrl}/api/agenda`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: `Reunião Mensal ${retroClientName}`,
        date: "2026-11-25",
        time: "10:00",
        category: "Reunião",
        employeeId: adminUser.id,
        clientId: retroClientId,
      }),
    });
    assertEqual(directAgendaRes.status, 201, "Suite 2", "2.8 Criação de AgendaEvent direto via API (HTTP 201)");
    const directAgendaData = await directAgendaRes.json();
    testAgendaEventIds.push(directAgendaData.event.id);
    assertEqual(
      directAgendaData.event.clientId,
      retroClientId,
      "Suite 2",
      "2.9 AgendaEvent criado com clientId vinculado diretamente",
      `AgendaEvent.clientId retornado é ${retroClientId}`
    );

    // 2.8 Verificar GET /api/clients com contagens agregadas
    const listClientsRes = await fetch(`${baseUrl}/api/clients`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assertEqual(listClientsRes.status, 200, "Suite 2", "2.10 Listagem de clientes GET /api/clients (HTTP 200)");
    const listClients = await listClientsRes.json();
    const foundRetroInList = listClients.find((c: any) => c.id === retroClientId);

    assert(
      foundRetroInList !== undefined,
      "Suite 2",
      "2.11 Cliente retroativo presente na listagem geral",
      `Cliente ${retroClientId} encontrado na lista`
    );
    assertEqual(
      foundRetroInList?._count?.workLogs,
      2,
      "Suite 2",
      "2.12 Contagem agregada correta de WorkLogs (_count.workLogs = 2)",
      `Total de WorkLogs contados: ${foundRetroInList?._count?.workLogs}`
    );
    assertEqual(
      foundRetroInList?._count?.events,
      2,
      "Suite 2",
      "2.13 Contagem agregada correta de Eventos da Agenda (_count.events = 2)",
      `Total de Eventos contados: ${foundRetroInList?._count?.events}`
    );

    console.log();

    // =============================================================
    // SUITE 3: Retorno do Perfil Detalhado e Ordenação (GET /api/clients/:id)
    // =============================================================
    console.log("---------------------------------------------------------------");
    console.log(" SUITE 3: Retorno do Perfil Detalhado e Ordenação");
    console.log("---------------------------------------------------------------");

    // 3.1 Cliente inexistente
    const notFoundProfileRes = await fetch(`${baseUrl}/api/clients/id-inexistente-12345`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assertEqual(notFoundProfileRes.status, 404, "Suite 3", "3.1 Retorno de 404 para cliente inexistente");

    // 3.2 Obter perfil do cliente retroativo
    const profileRes = await fetch(`${baseUrl}/api/clients/${retroClientId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assertEqual(profileRes.status, 200, "Suite 3", "3.2 Retorno do perfil de cliente existente (HTTP 200)");

    const profileData = await profileRes.json();

    // Valida estrutura básica do perfil
    assertEqual(profileData.client?.id, retroClientId, "Suite 3", "3.3 ID do cliente no perfil");
    assertEqual(profileData.client?.name, retroClientName, "Suite 3", "3.4 Nome do cliente no perfil");

    // Valida histórico de eventos
    assert(
      Array.isArray(profileData.events) && profileData.events.length === 2,
      "Suite 3",
      "3.5 Histórico de eventos retornado com exatos 2 registros",
      `Eventos retornados: ${profileData.events?.length}`
    );

    // Valida ordenação cronológica decrescente dos eventos da agenda (mais recente primeiro)
    const eventDates = profileData.events.map((e: any) => `${e.date} ${e.time}`);
    const isEventsSortedDesc =
      eventDates[0] >= eventDates[1];
    assert(
      isEventsSortedDesc,
      "Suite 3",
      "3.6 Eventos ordenados de forma decrescente por data/hora",
      `Ordem dos eventos: ${eventDates.join(" -> ")}`
    );

    // Valida histórico de chamados (WorkLogs)
    assert(
      Array.isArray(profileData.workLogs) && profileData.workLogs.length === 2,
      "Suite 3",
      "3.7 Histórico de chamados retornado com exatos 2 registros",
      `WorkLogs retornados: ${profileData.workLogs?.length}`
    );

    // Valida ordenação cronológica decrescente dos chamados (mais recente primeiro)
    const logCreatedAts = profileData.workLogs.map((w: any) => new Date(w.createdAt).getTime());
    const isLogsSortedDesc = logCreatedAts[0] >= logCreatedAts[1];
    assert(
      isLogsSortedDesc,
      "Suite 3",
      "3.8 WorkLogs ordenados de forma decrescente por createdAt",
      `Timestamps: ${logCreatedAts.join(" >= ")}`
    );

    // Valida estatísticas computadas
    assertEqual(
      profileData.stats?.totalWorkLogs,
      2,
      "Suite 3",
      "3.9 Stats: totalWorkLogs = 2",
      `stats.totalWorkLogs = ${profileData.stats?.totalWorkLogs}`
    );
    assertEqual(
      profileData.stats?.totalEvents,
      2,
      "Suite 3",
      "3.10 Stats: totalEvents = 2",
      `stats.totalEvents = ${profileData.stats?.totalEvents}`
    );
    assertEqual(
      profileData.stats?.solvedWorkLogs,
      1,
      "Suite 3",
      "3.11 Stats: solvedWorkLogs = 1",
      `stats.solvedWorkLogs = ${profileData.stats?.solvedWorkLogs}`
    );
    assertEqual(
      profileData.stats?.pendingWorkLogs,
      1,
      "Suite 3",
      "3.12 Stats: pendingWorkLogs = 1",
      `stats.pendingWorkLogs = ${profileData.stats?.pendingWorkLogs}`
    );

    console.log();

    // =============================================================
    // SUITE 4: Remoção de Cliente & Integridade Referencial (SetNull)
    // =============================================================
    console.log("---------------------------------------------------------------");
    console.log(" SUITE 4: Remoção de Cliente & Integridade Referencial (SetNull)");
    console.log("---------------------------------------------------------------");

    // 4.1 Usuário comum sem privilégios tenta remover cliente -> 403 Forbidden
    const unprivilegedDeleteRes = await fetch(`${baseUrl}/api/clients/${retroClientId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assertEqual(
      unprivilegedDeleteRes.status,
      403,
      "Suite 4",
      "4.1 Rejeição de exclusão de cliente por usuário USER sem permissão (HTTP 403)"
    );

    // 4.2 Exclusão de cliente inexistente com Admin -> 404 Not Found
    const notFoundDeleteRes = await fetch(`${baseUrl}/api/clients/id-inexistente-12345`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assertEqual(
      notFoundDeleteRes.status,
      404,
      "Suite 4",
      "4.2 Retorno de 404 ao tentar excluir cliente inexistente"
    );

    // 4.3 Exclusão de cliente com Admin -> 200 OK
    const deleteRes = await fetch(`${baseUrl}/api/clients/${retroClientId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assertEqual(deleteRes.status, 200, "Suite 4", "4.3 Exclusão bem-sucedida de cliente por Administrador (HTTP 200)");

    // 4.4 Confirma que o cliente não existe mais no banco de dados
    const deletedClientInDb = await prisma.client.findUnique({
      where: { id: retroClientId },
    });
    assert(
      deletedClientInDb === null,
      "Suite 4",
      "4.4 Registro do cliente excluído permanentemente da tabela Client",
      `prisma.client.findUnique retornou null`
    );

    // 4.5 INTEGRIDADE REFERENCIAL: WorkLogs NÃO foram excluídos, mas tiveram clientId setado para null
    const validTestWorkLogIds = testWorkLogIds.filter((id): id is string => Boolean(id));
    const preservedWorkLogs = await prisma.workLog.findMany({
      where: {
        id: { in: validTestWorkLogIds },
      },
    });
    assertEqual(
      preservedWorkLogs.length,
      2,
      "Suite 4",
      "4.5 Integridade Referencial: Nenhum WorkLog foi deletado em cascata",
      `WorkLogs remanescentes: ${preservedWorkLogs.length} de 2`
    );

    const allWorkLogsClientNull = preservedWorkLogs.every((w) => w.clientId === null);
    assert(
      allWorkLogsClientNull,
      "Suite 4",
      "4.6 Integridade Referencial: WorkLogs tiveram clientId atualizado para null (onDelete: SetNull)",
      `WorkLogs clientId values: ${preservedWorkLogs.map((w) => w.clientId).join(", ")}`
    );

    // 4.7 INTEGRIDADE REFERENCIAL: AgendaEvents NÃO foram excluídos, mas tiveram clientId setado para null
    const validTestAgendaEventIds = testAgendaEventIds.filter((id): id is string => Boolean(id));
    const preservedEvents = await prisma.agendaEvent.findMany({
      where: {
        id: { in: validTestAgendaEventIds },
      },
    });
    assertEqual(
      preservedEvents.length,
      2,
      "Suite 4",
      "4.7 Integridade Referencial: Nenhum AgendaEvent foi deletado em cascata",
      `AgendaEvents remanescentes: ${preservedEvents.length} de 2`
    );

    const allEventsClientNull = preservedEvents.every((e) => e.clientId === null);
    assert(
      allEventsClientNull,
      "Suite 4",
      "4.8 Integridade Referencial: AgendaEvents tiveram clientId atualizado para null (onDelete: SetNull)",
      `AgendaEvents clientId values: ${preservedEvents.map((e) => e.clientId).join(", ")}`
    );

    console.log();
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Limpeza dos dados de teste
    // -------------------------------------------------------------
    console.log("--> Executando limpeza segura de dados de teste...");

    const cleanupWorkLogIds = testWorkLogIds.filter((id): id is string => Boolean(id));
    if (cleanupWorkLogIds.length > 0) {
      await prisma.workLogStatusHistory.deleteMany({
        where: { workLogId: { in: cleanupWorkLogIds } },
      });
      await prisma.workLog.deleteMany({
        where: { id: { in: cleanupWorkLogIds } },
      });
    }

    const cleanupAgendaIds = testAgendaEventIds.filter((id): id is string => Boolean(id));
    if (cleanupAgendaIds.length > 0) {
      await prisma.agendaEvent.deleteMany({
        where: { id: { in: cleanupAgendaIds } },
      });
    }

    const cleanupClientIds = testClientIds.filter((id): id is string => Boolean(id));
    if (cleanupClientIds.length > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: cleanupClientIds } },
      });
    }

    if (testAdminUserId) {
      await prisma.user.delete({ where: { id: testAdminUserId } }).catch(() => {});
    }

    if (testNormalUserId) {
      await prisma.user.delete({ where: { id: testNormalUserId } }).catch(() => {});
    }

    if (testTagId) {
      await prisma.tag.delete({ where: { id: testTagId } }).catch(() => {});
    }

    // Encerra o servidor de testes
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("    Servidor de testes finalizado.");
    console.log("    Dados transacionais de teste limpos com sucesso.\n");
  }

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log("=======================================================================");
  console.log("                    RESUMO DA AUDITORIA DE QA");
  console.log("=======================================================================");

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total de testes executados: ${total}`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas: ${failed}`);
  console.log(`Taxa de Sucesso: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error("❌ ALERTA: Alguns testes falharam!");
    for (const r of results.filter((r) => !r.passed)) {
      console.error(`  - [${r.suite}] ${r.testName}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log("🎉 TODOS OS TESTES PASSARAM COM SUCESSO! MÓDULO 100% HOMOLOGADO.");
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Erro fatal durante a execução do test suite:", err);
  process.exit(1);
});
