/**
 * Automated Integration Test Suite: Gestor Pessoal de Clientes (HubSupport)
 * 
 * Testa a integridade ponta a ponta:
 * 1. POST /api/clients com e sem managerId
 * 2. Validação de existência de managerId
 * 3. GET /api/clients com inclusão de manager
 * 4. GET /api/clients/:id com inclusão de manager
 * 5. PUT /api/clients/:id para atualizar nome, alterar gestor ou remover gestor (null)
 * 6. Validação de integridade referencial (onDelete: SetNull)
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
  console.log("   QA TEST SUITE: GESTOR PESSOAL DE CLIENTES (HUBSUPPORT)");
  console.log("=======================================================================\n");

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor de testes ativo em ${baseUrl}\n`);

  const testClientIds: string[] = [];
  const testUserIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Criação de usuários de teste
    // -------------------------------------------------------------
    console.log("--> Preparando ambiente de testes (Usuários, Gestores, Token JWT)...");

    const timestamp = Date.now();

    // 1. Usuário Admin para chamadas da API
    const adminUser = await prisma.user.create({
      data: {
        name: `Admin Manager Test ${timestamp}`,
        email: `admin.mgr.${timestamp}@hubsupport.test`,
        password: "hash_test_pwd",
        role: "ADMIN",
      },
    });
    testUserIds.push(adminUser.id);

    // 2. Colaborador 1 (Gestor Alfa)
    const manager1 = await prisma.user.create({
      data: {
        name: `Gestor Alfa ${timestamp}`,
        email: `manager1.${timestamp}@hubsupport.test`,
        password: "hash_test_pwd",
        role: "TECHNICIAN",
      },
    });
    testUserIds.push(manager1.id);

    // 3. Colaborador 2 (Gestor Beta)
    const manager2 = await prisma.user.create({
      data: {
        name: `Gestora Beta ${timestamp}`,
        email: `manager2.${timestamp}@hubsupport.test`,
        password: "hash_test_pwd",
        role: "MANAGER",
      },
    });
    testUserIds.push(manager2.id);

    const token = generateToken({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    });

    console.log(`    Admin: ${adminUser.name}`);
    console.log(`    Gestor 1: ${manager1.name} (${manager1.role})`);
    console.log(`    Gestor 2: ${manager2.name} (${manager2.role})`);
    console.log("    Token JWT autenticado pronto.\n");

    const clientNameA = `Cliente Alfa Corp ${timestamp}`;
    const clientNameB = `Cliente Beta S/A ${timestamp}`;

    // =============================================================
    // SUITE 1: Criação de Cliente (POST /api/clients)
    // =============================================================
    console.log("---------------------------------------------------------------");
    console.log(" SUITE 1: Criação de Cliente com/sem Gestor (POST /api/clients)");
    console.log("---------------------------------------------------------------");

    // 1.1 Criar cliente sem gestor
    const resNoMgr = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: clientNameA }),
    });
    assertEqual(resNoMgr.status, 201, "Suite 1", "1.1 Criação de cliente sem gestor (HTTP 201)");
    const dataNoMgr = await resNoMgr.json();
    testClientIds.push(dataNoMgr.client.id);
    assert(dataNoMgr.client.managerId === null, "Suite 1", "1.1.1 managerId é null", `managerId: ${dataNoMgr.client.managerId}`);
    assert(dataNoMgr.client.manager === null, "Suite 1", "1.1.2 manager retornado é null", `manager: ${JSON.stringify(dataNoMgr.client.manager)}`);

    // 1.2 Criar cliente com managerId inválido/inexistente
    const resInvalidMgr = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: `Cliente Invalido ${timestamp}`, managerId: "non-existent-user-id" }),
    });
    assertEqual(resInvalidMgr.status, 400, "Suite 1", "1.2 Rejeição de managerId inexistente (HTTP 400)");

    // 1.3 Criar cliente com gestor válido (manager1)
    const resWithMgr = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: clientNameB, managerId: manager1.id }),
    });
    assertEqual(resWithMgr.status, 201, "Suite 1", "1.3 Criação com gestor válido (HTTP 201)");
    const dataWithMgr = await resWithMgr.json();
    testClientIds.push(dataWithMgr.client.id);
    assertEqual(dataWithMgr.client.managerId, manager1.id, "Suite 1", "1.3.1 managerId corresponde ao manager1.id");
    assert(Boolean(dataWithMgr.client.manager), "Suite 1", "1.3.2 manager preenchido", `manager: ${dataWithMgr.client.manager?.name}`);
    assertEqual(dataWithMgr.client.manager?.name, manager1.name, "Suite 1", "1.3.3 Nome do gestor confere");
    assertEqual(dataWithMgr.client.manager?.role, manager1.role, "Suite 1", "1.3.4 Cargo do gestor confere");

    // =============================================================
    // SUITE 2: Listagem de Clientes (GET /api/clients)
    // =============================================================
    console.log("\n---------------------------------------------------------------");
    console.log(" SUITE 2: Listagem de Clientes com Gestores (GET /api/clients)");
    console.log("---------------------------------------------------------------");

    const resList = await fetch(`${baseUrl}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assertEqual(resList.status, 200, "Suite 2", "2.1 Listagem de clientes (HTTP 200)");
    const clientList: Array<{ id: string; name: string; managerId?: string | null; manager?: any }> = await resList.json();

    const foundClientA = clientList.find((c) => c.id === dataNoMgr.client.id);
    assert(Boolean(foundClientA), "Suite 2", "2.2 Cliente sem gestor está presente na lista");
    assert(foundClientA?.manager === null || foundClientA?.manager === undefined, "Suite 2", "2.3 Cliente A tem manager nulo na lista");

    const foundClientB = clientList.find((c) => c.id === dataWithMgr.client.id);
    assert(Boolean(foundClientB), "Suite 2", "2.4 Cliente com gestor está presente na lista");
    assertEqual(foundClientB?.manager?.id, manager1.id, "Suite 2", "2.5 Cliente B inclui ID do gestor 1");
    assertEqual(foundClientB?.manager?.name, manager1.name, "Suite 2", "2.6 Cliente B inclui Nome do gestor 1");
    assertEqual(foundClientB?.manager?.role, manager1.role, "Suite 2", "2.7 Cliente B inclui Cargo do gestor 1");

    // =============================================================
    // SUITE 3: Perfil do Cliente (GET /api/clients/:id)
    // =============================================================
    console.log("\n---------------------------------------------------------------");
    console.log(" SUITE 3: Perfil Detalhado do Cliente (GET /api/clients/:id)");
    console.log("---------------------------------------------------------------");

    const resProfileA = await fetch(`${baseUrl}/api/clients/${dataNoMgr.client.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assertEqual(resProfileA.status, 200, "Suite 3", "3.1 Perfil do cliente sem gestor (HTTP 200)");
    const profileA = await resProfileA.json();
    assert(profileA.client.manager === null, "Suite 3", "3.2 Perfil A retorna manager nulo");

    const resProfileB = await fetch(`${baseUrl}/api/clients/${dataWithMgr.client.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assertEqual(resProfileB.status, 200, "Suite 3", "3.3 Perfil do cliente com gestor (HTTP 200)");
    const profileB = await resProfileB.json();
    assert(Boolean(profileB.client.manager), "Suite 3", "3.4 Perfil B retorna manager preenchido");
    assertEqual(profileB.client.manager?.name, manager1.name, "Suite 3", "3.5 Perfil B confere nome do gestor");
    assertEqual(profileB.client.manager?.role, manager1.role, "Suite 3", "3.6 Perfil B confere cargo do gestor");

    // =============================================================
    // SUITE 4: Atualização de Cliente (PUT /api/clients/:id)
    // =============================================================
    console.log("\n---------------------------------------------------------------");
    console.log(" SUITE 4: Edição de Cliente e Gestor (PUT /api/clients/:id)");
    console.log("---------------------------------------------------------------");

    // 4.1 Alterar gestor do Cliente B para manager2
    const resUpdateMgr = await fetch(`${baseUrl}/api/clients/${dataWithMgr.client.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ managerId: manager2.id }),
    });
    assertEqual(resUpdateMgr.status, 200, "Suite 4", "4.1 Troca de gestor para Gestora Beta (HTTP 200)");
    const dataUpdateMgr = await resUpdateMgr.json();
    assertEqual(dataUpdateMgr.client.managerId, manager2.id, "Suite 4", "4.1.1 managerId atualizado para manager2");
    assertEqual(dataUpdateMgr.client.manager?.name, manager2.name, "Suite 4", "4.1.2 manager.name atualizado para manager2");

    // 4.2 Remover gestor do Cliente B (definir managerId como null)
    const resRemoveMgr = await fetch(`${baseUrl}/api/clients/${dataWithMgr.client.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ managerId: null }),
    });
    assertEqual(resRemoveMgr.status, 200, "Suite 4", "4.2 Remoção do gestor passando null (HTTP 200)");
    const dataRemoveMgr = await resRemoveMgr.json();
    assert(dataRemoveMgr.client.managerId === null, "Suite 4", "4.2.1 managerId agora é null");
    assert(dataRemoveMgr.client.manager === null, "Suite 4", "4.2.2 manager retornado agora é null");

    // 4.3 Atribuir gestor ao Cliente A (que antes não tinha)
    const resAssignA = await fetch(`${baseUrl}/api/clients/${dataNoMgr.client.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ managerId: manager1.id }),
    });
    assertEqual(resAssignA.status, 200, "Suite 4", "4.3 Atribuição de gestor para cliente antes sem gestor (HTTP 200)");
    const dataAssignA = await resAssignA.json();
    assertEqual(dataAssignA.client.managerId, manager1.id, "Suite 4", "4.3.1 managerId atribuído com sucesso");

    // 4.4 Atualizar nome do cliente
    const updatedNameA = `${clientNameA} - Renomeado`;
    const resUpdateName = await fetch(`${baseUrl}/api/clients/${dataNoMgr.client.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: updatedNameA }),
    });
    assertEqual(resUpdateName.status, 200, "Suite 4", "4.4 Atualização do nome do cliente (HTTP 200)");
    const dataUpdateName = await resUpdateName.json();
    assertEqual(dataUpdateName.client.name, updatedNameA, "Suite 4", "4.4.1 Nome atualizado retornado");

    // 4.5 Rejeitar duplicidade de nome em outro cliente
    const resDuplicateName = await fetch(`${baseUrl}/api/clients/${dataWithMgr.client.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: updatedNameA }),
    });
    assertEqual(resDuplicateName.status, 409, "Suite 4", "4.5 Rejeição de nome duplicado em PUT (HTTP 409)");

    // 4.6 Rejeitar gestor inexistente em PUT
    const resInvalidPutMgr = await fetch(`${baseUrl}/api/clients/${dataNoMgr.client.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ managerId: "non-existent-user-id" }),
    });
    assertEqual(resInvalidPutMgr.status, 400, "Suite 4", "4.6 Rejeição de gestor inexistente em PUT (HTTP 400)");

    // =============================================================
    // SUITE 5: Integridade Referencial (onDelete: SetNull)
    // =============================================================
    console.log("\n---------------------------------------------------------------");
    console.log(" SUITE 5: Integridade Referencial ao Deletar Gestor (SetNull)");
    console.log("---------------------------------------------------------------");

    // Cria um gestor temporário
    const tempManager = await prisma.user.create({
      data: {
        name: `Gestor Temporário ${timestamp}`,
        email: `temp.mgr.${timestamp}@hubsupport.test`,
        password: "hash_test_pwd",
        role: "USER",
      },
    });

    // Cria cliente com esse gestor
    const resTempClient = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: `Cliente Temp ${timestamp}`, managerId: tempManager.id }),
    });
    const tempClientData = await resTempClient.json();
    testClientIds.push(tempClientData.client.id);

    // Deleta o gestor temporário diretamente no prisma
    await prisma.user.delete({ where: { id: tempManager.id } });

    // Consulta o cliente novamente para verificar se managerId virou null sem erros
    const clientAfterUserDeleted = await prisma.client.findUnique({
      where: { id: tempClientData.client.id },
      include: { manager: true },
    });
    assert(clientAfterUserDeleted !== null, "Suite 5", "5.1 Cliente continua existindo após exclusão do gestor", "Cliente encontrado no banco");
    assert(clientAfterUserDeleted?.managerId === null, "Suite 5", "5.2 managerId virou null automaticamente (SetNull)", `managerId é ${clientAfterUserDeleted?.managerId}`);
    assert(clientAfterUserDeleted?.manager === null, "Suite 5", "5.3 manager é null", "manager é null");

  } finally {
    console.log("\n--> Limpando dados de teste...");

    // Limpeza de clientes de teste
    if (testClientIds.length > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: testClientIds } },
      }).catch((e) => console.error("Erro ao limpar clientes:", e));
    }

    // Limpeza de usuários de teste
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      }).catch((e) => console.error("Erro ao limpar usuários:", e));
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("    Servidor de testes finalizado.");
    console.log("    Dados de teste limpos com sucesso.\n");
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
    console.log("🎉 TODOS OS TESTES PASSARAM COM SUCESSO! TASK 1 100% HOMOLOGADA.");
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Erro fatal durante a execução do test suite:", err);
  process.exit(1);
});
