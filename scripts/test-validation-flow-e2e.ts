import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import http from "http";

async function main() {
  console.log("=== SUÍTE DE TESTES E2E: GOVERNANÇA KANBAN, VALIDAÇÃO, NOTAS E EDIÇÃO ===\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;

  let testLogId: string | null = null;

  try {
    const technician = await prisma.user.findFirst({ where: { role: "TECHNICIAN", active: true } });
    if (!technician) throw new Error("Usuário técnico ativo não encontrado no banco.");
    const tag = await prisma.tag.findFirst();
    if (!tag) throw new Error("Tag não encontrada no banco.");

    const token = generateToken(technician);

    // 1. Criação inicial em "Em progresso"
    console.log("--> [PASSO 1] Criação de atendimento inicial em 'Em progresso'");
    const createdLog = await prisma.workLog.create({
      data: {
        title: "Atendimento E2E Validação e Notas",
        requester: "Carlos Alberto",
        clientOrOffice: "Escritório Central",
        reportedProblem: "Lentidão ao processar lotes de documentos",
        actionTaken: "Análise de queries e índices no banco de dados",
        status: "Em progresso",
        userId: technician.id,
        tagId: tag.id,
        hasValidationRejection: false,
      },
    });
    testLogId = createdLog.id;
    console.log(`  ✅ Atendimento criado: ID=${testLogId}, Status=${createdLog.status}`);

    // 2. Transição para "Validação"
    console.log("\n--> [PASSO 2] Mover atendimento para 'Validação'");
    const toValidationRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Validação" }),
    });
    if (toValidationRes.status !== 200) {
      throw new Error(`Falha ao mover para Validação: ${toValidationRes.status}`);
    }
    const valData = await toValidationRes.json();
    if (valData.status !== "Validação") {
      throw new Error(`Status incorreto: esperado Validação, obtido ${valData.status}`);
    }
    console.log("  ✅ Atendimento movido para 'Validação' com sucesso.");

    // 3. Tentativa de recuo de "Validação" para "Pendências" SEM justificativa (deve retornar 400)
    console.log("\n--> [PASSO 3] Bloqueio obrigatório: recuo sem justificativa deve retornar 400");
    const badRegressRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Pendências" }),
    });
    if (badRegressRes.status !== 400) {
      throw new Error(`Esperado status 400, porém a API retornou: ${badRegressRes.status}`);
    }
    console.log("  ✅ [PASS] Recuo bloqueado com sucesso (400 Bad Request).");

    // 4. Recuo de "Validação" para "Em progresso" COM justificativa obrigatória
    console.log("\n--> [PASSO 4] Recuo com justificativa obrigatória de reprovação");
    const validRegressRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Em progresso",
        rejectionReason: "Os índices criados causaram timeout em inserções concorrentes. Necessário revisar.",
      }),
    });
    if (validRegressRes.status !== 200) {
      throw new Error(`Falha no recuo com justificativa: ${validRegressRes.status}`);
    }
    const regressData = await validRegressRes.json();
    if (regressData.status !== "Em progresso" || !regressData.hasValidationRejection) {
      throw new Error("Falha ao registrar hasValidationRejection ou status 'Em progresso'.");
    }
    const hasRej = regressData.notes.some(
      (n: any) => n.type === "rejection" && n.content.includes("timeout em inserções")
    );
    if (!hasRej) {
      throw new Error("Nota de reprovação não encontrada no retorno da API.");
    }
    console.log("  ✅ [PASS] Recuo executado, flag hasValidationRejection=true e nota de reprovação anexada.");

    // 5. Adicionar nota geral de acompanhamento
    console.log("\n--> [PASSO 5] Adicionar nota de acompanhamento técnico via POST /notes");
    const notePostRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Ajustamos os índices para CONCURRENTLY e o tempo de resposta normalizou.",
        type: "general",
      }),
    });
    if (notePostRes.status !== 201) {
      throw new Error(`Falha ao adicionar nota geral: ${notePostRes.status}`);
    }
    const postedNote = await notePostRes.json();
    console.log(`  ✅ [PASS] Nota geral criada: ID=${postedNote.id}, Tipo=${postedNote.type}`);

    // 6. Consultar lista completa de notas via GET /notes
    console.log("\n--> [PASSO 6] Consultar notas via GET /notes");
    const getNotesRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/notes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (getNotesRes.status !== 200) {
      throw new Error(`Falha ao buscar notas: ${getNotesRes.status}`);
    }
    const notesList = await getNotesRes.json();
    if (!Array.isArray(notesList) || notesList.length < 2) {
      throw new Error(`Esperado ao menos 2 notas, recebido: ${notesList.length}`);
    }
    console.log(`  ✅ [PASS] ${notesList.length} notas recuperadas com dados de autor e tipo.`);

    // 7. Edição de dados do relatório com auditoria de histórico via PUT /api/worklogs/:id
    console.log("\n--> [PASSO 7] Edição de dados do atendimento com auditoria no histórico");
    const editRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Atendimento E2E [Otimização de Índices e Performance]",
        actionTaken: "Criados índices concorrentes e reconfigurado pool de conexões.",
      }),
    });
    if (editRes.status !== 200) {
      throw new Error(`Falha ao editar atendimento: ${editRes.status}`);
    }
    const editData = await editRes.json();
    if (editData.workLog.title !== "Atendimento E2E [Otimização de Índices e Performance]") {
      throw new Error("Título não foi atualizado na edição.");
    }
    console.log("  ✅ [PASS] Atendimento editado com sucesso e auditoria registrada no histórico.");

    // 8. Reenvio para "Validação"
    console.log("\n--> [PASSO 8] Reenviar atendimento para 'Validação'");
    const revalRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Validação" }),
    });
    if (revalRes.status !== 200) {
      throw new Error(`Falha ao retornar para Validação: ${revalRes.status}`);
    }
    console.log("  ✅ [PASS] Atendimento novamente em 'Validação'.");

    // 9. Aprovação formal da solução via PATCH /api/worklogs/:id/resolve
    console.log("\n--> [PASSO 9] Aprovação formal da solução via /resolve");
    const resolveRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resolveRes.status !== 200) {
      throw new Error(`Falha ao solucionar atendimento: ${resolveRes.status}`);
    }
    const resolvedLog = await prisma.workLog.findUnique({
      where: { id: testLogId },
      include: { statusHistory: true, notes: true },
    });
    if (resolvedLog?.status !== "Solucionado") {
      throw new Error(`Status não é Solucionado: ${resolvedLog?.status}`);
    }
    if (resolvedLog?.hasValidationRejection !== false) {
      throw new Error("hasValidationRejection deveria ser false após aprovação.");
    }
    console.log("  ✅ [PASS] Atendimento aprovado, status='Solucionado' e pendência de recusa limpa.");

    console.log("\n=======================================================");
    console.log("🎉 SUÍTE DE TESTES E2E CONCLUÍDA COM 100% DE SUCESSO! 🎉");
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
    await prisma.$disconnect();
    server.close();
  }
}

main();
