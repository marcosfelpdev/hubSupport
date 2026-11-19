import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import { getValidationDuration } from "../src/components/dashboard/WorkLogDetailContent";
import http from "http";

async function main() {
  console.log("=== TESTE E2E: CONTADOR DE DIAS EM VALIDAÇÃO E RESET NA REPROVAÇÃO ===\n");

  // 1. Teste Unitário da função getValidationDuration
  console.log("--> [PASSO 1] Verificando formatação de durações com getValidationDuration()");
  const now = Date.now();
  
  // Menos de 1h
  const d0 = getValidationDuration(new Date(now - 15 * 60 * 1000));
  if (d0.days !== 0 || !d0.label.includes("Hoje")) {
    throw new Error(`Falha no cálculo de menos de 1h: ${JSON.stringify(d0)}`);
  }
  console.log(`  ✅ < 1h: "${d0.label}" (urgency=${d0.urgencyLevel})`);

  // 5 horas
  const d5h = getValidationDuration(new Date(now - 5 * 3600 * 1000));
  if (d5h.days !== 0 || !d5h.label.includes("5h")) {
    throw new Error(`Falha no cálculo de 5h: ${JSON.stringify(d5h)}`);
  }
  console.log(`  ✅ 5h: "${d5h.label}" (urgency=${d5h.urgencyLevel})`);

  // 1 dia (26 horas)
  const d1d = getValidationDuration(new Date(now - 26 * 3600 * 1000));
  if (d1d.days !== 1 || d1d.label !== "1 dia") {
    throw new Error(`Falha no cálculo de 1 dia: ${JSON.stringify(d1d)}`);
  }
  console.log(`  ✅ 1 dia: "${d1d.label}" (urgency=${d1d.urgencyLevel})`);

  // 4 dias (warning)
  const d4d = getValidationDuration(new Date(now - 4 * 24 * 3600 * 1000));
  if (d4d.days !== 4 || d4d.urgencyLevel !== "warning") {
    throw new Error(`Falha no cálculo de 4 dias: ${JSON.stringify(d4d)}`);
  }
  console.log(`  ✅ 4 dias: "${d4d.label}" (urgency=${d4d.urgencyLevel})`);

  // 6 dias (danger)
  const d6d = getValidationDuration(new Date(now - 6 * 24 * 3600 * 1000));
  if (d6d.days !== 6 || d6d.urgencyLevel !== "danger") {
    throw new Error(`Falha no cálculo de 6 dias: ${JSON.stringify(d6d)}`);
  }
  console.log(`  ✅ 6 dias: "${d6d.label}" (urgency=${d6d.urgencyLevel})`);

  // 2. Teste da API e Ciclo de Vida do validationStartedAt
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;

  let testLogId: string | null = null;
  let testUserId: string | null = null;

  try {
    const user = await prisma.user.create({
      data: {
        name: "Validador Timer Teste",
        email: `timer.test.${Date.now()}@example.com`,
        password: "mock_password",
        role: "USER",
        active: true,
      },
    });
    testUserId = user.id;
    const token = generateToken(user);
    const tag = await prisma.tag.findFirst();

    // Criação inicial em "Em progresso"
    console.log("\n--> [PASSO 2] Criando atendimento inicial em 'Em progresso'");
    const createdLog = await prisma.workLog.create({
      data: {
        title: "Atendimento para teste de contador de validação",
        requester: user.name,
        clientOrOffice: "Empresa Teste",
        reportedProblem: "Verificação de relógio e reset",
        status: "Em progresso",
        userId: user.id,
        tagId: tag?.id,
      },
    });
    testLogId = createdLog.id;
    if (createdLog.validationStartedAt !== null) {
      throw new Error("validationStartedAt deveria ser null ao criar fora de Validação");
    }
    console.log(`  ✅ Atendimento criado: validationStartedAt=null`);

    // Mover para "Validação" -> validationStartedAt deve ser preenchido
    console.log("\n--> [PASSO 3] Mover para 'Validação' (início da contagem)");
    const toValRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Validação" }),
    });
    if (toValRes.status !== 200) {
      throw new Error(`Falha ao mover para Validação: ${toValRes.status}`);
    }
    const logInVal = await prisma.workLog.findUnique({ where: { id: testLogId } });
    if (!logInVal?.validationStartedAt) {
      throw new Error("validationStartedAt não foi definido ao entrar em Validação");
    }
    const firstValidationTime = new Date(logInVal.validationStartedAt).getTime();
    console.log(`  ✅ Entrou em Validação: validationStartedAt=${logInVal.validationStartedAt.toISOString()}`);

    // Simular que o chamado ficou 3 dias em validação
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    await prisma.workLog.update({
      where: { id: testLogId },
      data: { validationStartedAt: threeDaysAgo },
    });
    const logWith3Days = await prisma.workLog.findUnique({ where: { id: testLogId } });
    const computed3Days = getValidationDuration(logWith3Days?.validationStartedAt);
    if (computed3Days.days !== 3) {
      throw new Error(`Esperado 3 dias, obteve: ${computed3Days.days}`);
    }
    console.log(`  ✅ Simulação de 3 dias confirmada: "${computed3Days.label}"`);

    // Reprovar e recuar para "Em progresso" -> validationStartedAt DEVE RESETAR para null
    console.log("\n--> [PASSO 4] Reprovar chamado para 'Em progresso' (tempo de validação deve resetar)");
    const rejectRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Em progresso",
        rejectionReason: "Faltou validar o relatório de métricas.",
      }),
    });
    if (rejectRes.status !== 200) {
      throw new Error(`Falha ao reprovar: ${rejectRes.status}`);
    }
    const logRejected = await prisma.workLog.findUnique({ where: { id: testLogId } });
    if (logRejected?.validationStartedAt !== null) {
      throw new Error("validationStartedAt NÃO foi resetado para null após a reprovação");
    }
    if (logRejected?.hasValidationRejection !== true) {
      throw new Error("hasValidationRejection deveria ser true");
    }
    console.log("  ✅ Chamado reprovado com sucesso: validationStartedAt=null (RESETADO!)");

    // Reenviar para "Validação" -> novo validationStartedAt é registrado a partir de agora
    console.log("\n--> [PASSO 5] Reenviar chamado para 'Validação' (novo timer começa do zero)");
    const revalRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Validação" }),
    });
    if (revalRes.status !== 200) {
      throw new Error(`Falha ao revalidar: ${revalRes.status}`);
    }
    const logRevalidated = await prisma.workLog.findUnique({ where: { id: testLogId } });
    if (!logRevalidated?.validationStartedAt) {
      throw new Error("validationStartedAt não foi reiniciado após retorno para Validação");
    }
    const secondValidationTime = new Date(logRevalidated.validationStartedAt).getTime();
    if (secondValidationTime <= firstValidationTime) {
      throw new Error("O novo timestamp de validação deve ser posterior ao original");
    }
    const newDuration = getValidationDuration(logRevalidated.validationStartedAt);
    if (newDuration.days !== 0) {
      throw new Error(`Contador deveria ter voltado para 0 dias, mas está em: ${newDuration.days}`);
    }
    console.log(`  ✅ Novo ciclo de validação iniciado: "${newDuration.label}" (Timestamp renovado!)`);

    // Aprovar solução
    console.log("\n--> [PASSO 6] Criador aprova a solução (finalização)");
    const resolveRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resolveRes.status !== 200) {
      throw new Error(`Falha ao solucionar: ${resolveRes.status}`);
    }
    const logSolved = await prisma.workLog.findUnique({ where: { id: testLogId } });
    if (logSolved?.status !== "Solucionado" || logSolved?.validationStartedAt !== null) {
      throw new Error("Status deveria ser Solucionado e validationStartedAt=null");
    }
    console.log("  ✅ Atendimento aprovado como Solucionado com sucesso!");

    console.log("\n=======================================================");
    console.log("🎉 SUÍTE DE TESTES DO CONTADOR DE VALIDAÇÃO APROVADA! 🎉");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("❌ ERRO NO TESTE:", err);
    process.exitCode = 1;
  } finally {
    if (testLogId) {
      await prisma.workLogNote.deleteMany({ where: { workLogId: testLogId } }).catch(() => {});
      await prisma.workLogStatusHistory.deleteMany({ where: { workLogId: testLogId } }).catch(() => {});
      await prisma.workLog.delete({ where: { id: testLogId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
    server.close();
  }
}

main();
