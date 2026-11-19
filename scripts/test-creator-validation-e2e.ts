import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import http from "http";

async function main() {
  console.log("=== TESTE E2E: ACESSO GERAL AO KANBAN E VALIDAÇÃO EXCLUSIVA PELO CRIADOR ===\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;

  let testLogId: string | null = null;
  let testUserAId: string | null = null;
  let testUserBId: string | null = null;

  try {
    const tag = await prisma.tag.findFirst();
    if (!tag) throw new Error("Tag não encontrada no banco.");

    // 1. Criar ou obter Usuário A (role: USER - Criador) e Usuário B (role: TECHNICIAN - Revisor Técnico)
    console.log("--> [PASSO 1] Configurando Usuário A (USER) e Usuário B (TECHNICIAN)");
    const userA = await prisma.user.create({
      data: {
        name: "Mariana Usuária Teste",
        email: `mariana.test.${Date.now()}@example.com`,
        password: "hashed_password_mock",
        role: "USER",
        active: true,
      },
    });
    testUserAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        name: "Carlos Técnico Teste",
        email: `carlos.tech.${Date.now()}@example.com`,
        password: "hashed_password_mock",
        role: "TECHNICIAN",
        active: true,
      },
    });
    testUserBId = userB.id;

    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);

    console.log(`  ✅ Usuário A (Criador, USER): ID=${userA.id}`);
    console.log(`  ✅ Usuário B (Técnico, TECHNICIAN): ID=${userB.id}`);

    // 2. Testar acesso ao endpoint Kanban por usuário comum (role USER)
    console.log("\n--> [PASSO 2] Verificar acesso de Usuário A (role: USER) ao endpoint /api/worklogs/kanban");
    const kanbanRes = await fetch(`${baseUrl}/api/worklogs/kanban`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (kanbanRes.status !== 200) {
      throw new Error(`Usuário comum não conseguiu acessar o kanban: ${kanbanRes.status}`);
    }
    const kanbanData = await kanbanRes.json();
    if (!Array.isArray(kanbanData)) {
      throw new Error("Resposta do kanban não é um array");
    }
    console.log(`  ✅ [PASS] Usuário comum acessou o Kanban com sucesso. (${kanbanData.length} registros recebidos)`);

    // 3. Usuário A cria um chamado que entra no fluxo técnico
    console.log("\n--> [PASSO 3] Usuário A cria um atendimento com ação técnica");
    const createdLog = await prisma.workLog.create({
      data: {
        title: "Dúvida sobre integração do gateway de pagamento",
        requester: userA.name,
        clientOrOffice: "Loja Virtual Exemplo",
        reportedProblem: "Webhook de pagamento falhando com timeout",
        status: "Em progresso",
        technicalAction: true,
        userId: userA.id,
        tagId: tag.id,
      },
    });
    testLogId = createdLog.id;
    console.log(`  ✅ Chamado criado: ID=${testLogId}, Autor=${userA.name} (ID: ${userA.id})`);

    // 4. Mover o chamado para "Validação"
    console.log("\n--> [PASSO 4] Mover chamado para fase de 'Validação'");
    const toValidationRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Validação" }),
    });
    if (toValidationRes.status !== 200) {
      throw new Error(`Falha ao mover para Validação: ${toValidationRes.status}`);
    }
    console.log("  ✅ Chamado agora está em 'Validação'.");

    // 5. TESTE CRÍTICO: Usuário B (Técnico, não criador) tenta aprovar a solução via /resolve -> DEVE RETORNAR 403
    console.log("\n--> [PASSO 5] Bloqueio: Usuário B (Técnico, NÃO criador) tenta aprovar via /resolve");
    const unauthorizedResolveRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/resolve`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    if (unauthorizedResolveRes.status !== 403) {
      throw new Error(
        `Esperado 403 Forbidden para não-criador, mas obteve: ${unauthorizedResolveRes.status}`
      );
    }
    const unauthData = await unauthorizedResolveRes.json();
    console.log(`  ✅ [PASS] Aprovação por não-criador bloqueada com 403: "${unauthData.error}"`);

    // 6. TESTE CRÍTICO: Usuário B tenta forçar status "Solucionado" via PATCH /status -> DEVE RETORNAR 403
    console.log("\n--> [PASSO 6] Bloqueio: Usuário B tenta forçar 'Solucionado' via PATCH /status");
    const unauthorizedStatusRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Solucionado" }),
    });
    if (unauthorizedStatusRes.status !== 403) {
      throw new Error(
        `Esperado 403 Forbidden ao tentar forçar status Solucionado por não-criador, obtido: ${unauthorizedStatusRes.status}`
      );
    }
    console.log("  ✅ [PASS] Alteração para Solucionado por não-criador bloqueada com 403 Forbidden.");

    // 7. TESTE DE SUCESSO: Usuário A (Criador original) aprova a solução via /resolve
    console.log("\n--> [PASSO 7] Aprovação válida: Usuário A (Criador original) aprova via /resolve");
    const creatorResolveRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/resolve`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    if (creatorResolveRes.status !== 200) {
      const errTxt = await creatorResolveRes.text();
      throw new Error(`Falha na aprovação pelo criador: ${creatorResolveRes.status} - ${errTxt}`);
    }
    const resolvedData = await creatorResolveRes.json();
    if (resolvedData.status !== "Solucionado") {
      throw new Error(`Status não é Solucionado: ${resolvedData.status}`);
    }
    console.log("  ✅ [PASS] Solução aprovada com sucesso pelo criador original! Status='Solucionado'.");

    console.log("\n=======================================================");
    console.log("🎉 TODOS OS TESTES DE VALIDAÇÃO DO CRIADOR PASSARAM! 🎉");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("❌ ERRO NO TESTE E2E:", err);
    process.exitCode = 1;
  } finally {
    if (testLogId) {
      await prisma.workLogNote.deleteMany({ where: { workLogId: testLogId } }).catch(() => {});
      await prisma.workLogStatusHistory.deleteMany({ where: { workLogId: testLogId } }).catch(() => {});
      await prisma.workLog.delete({ where: { id: testLogId } }).catch(() => {});
    }
    if (testUserAId) {
      await prisma.user.delete({ where: { id: testUserAId } }).catch(() => {});
    }
    if (testUserBId) {
      await prisma.user.delete({ where: { id: testUserBId } }).catch(() => {});
    }
    await prisma.$disconnect();
    server.close();
  }
}

main();
