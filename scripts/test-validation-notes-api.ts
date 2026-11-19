import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import http from "http";

async function main() {
  console.log("=== TESTE DA API: EDICAO, NOTAS E GOVERNANCA DE VALIDACAO ===\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;

  let testLogId: string | null = null;

  try {
    const user = await prisma.user.findFirst({ where: { role: "TECHNICIAN", active: true } });
    if (!user) throw new Error("Usuário técnico não encontrado");
    const tag = await prisma.tag.findFirst();
    if (!tag) throw new Error("Tag não encontrada");

    const token = generateToken(user);

    // 1. Criar chamado de teste em "Validação"
    const createdLog = await prisma.workLog.create({
      data: {
        title: "Chamado Inicial para Teste de Validação",
        requester: "Mariana Souza",
        clientOrOffice: "Empresa Beta",
        reportedProblem: "Problema no módulo fiscal",
        actionTaken: "Ajustada configuração da API",
        status: "Validação",
        userId: user.id,
        tagId: tag.id,
        hasValidationRejection: false,
      },
    });
    testLogId = createdLog.id;
    console.log("Chamado criado com ID:", testLogId, "Status:", createdLog.status);

    // TESTE 1: Edição de relatório via PUT /api/worklogs/:id
    console.log("\n--> [TESTE 1] PUT /api/worklogs/:id (Edição de Relatório com Auditoria)");
    const putRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Chamado Editado: Módulo Fiscal e Emissão de Notas",
        actionTaken: "Ajustada configuração da API e recompilada rota",
      }),
    });
    if (putRes.status !== 200) {
      const err = await putRes.text();
      throw new Error(`Falha no PUT /api/worklogs/:id: ${putRes.status} - ${err}`);
    }
    const putData = await putRes.json();
    if (putData.workLog.title !== "Chamado Editado: Módulo Fiscal e Emissão de Notas") {
      throw new Error("Título não foi atualizado corretamente");
    }
    console.log("  ✅ [PASS] Relatório editado com sucesso e histórico registrado.");

    // TESTE 2: Adicionar nota livre via POST /api/worklogs/:id/notes
    console.log("\n--> [TESTE 2] POST /api/worklogs/:id/notes (Adicionar Nota Livre)");
    const noteRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Verificado no ambiente de staging com sucesso.",
        type: "general",
      }),
    });
    if (noteRes.status !== 201) {
      const err = await noteRes.text();
      throw new Error(`Falha no POST /notes: ${noteRes.status} - ${err}`);
    }
    const createdNote = await noteRes.json();
    console.log(`  ✅ [PASS] Nota criada com ID: ${createdNote.id}, autor: ${createdNote.user?.name}`);

    // TESTE 3: Recuar de "Validação" para "Em progresso" SEM motivo (Deve retornar 400)
    console.log("\n--> [TESTE 3] PATCH /api/worklogs/:id/status (Recuo sem justificativa - deve falhar)");
    const rejectWithoutReasonRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Em progresso",
      }),
    });
    if (rejectWithoutReasonRes.status !== 400) {
      throw new Error(`Esperado status 400 ao recuar sem justificativa, obtido: ${rejectWithoutReasonRes.status}`);
    }
    console.log("  ✅ [PASS] Recuo sem justificativa foi corretamente bloqueado com 400 Bad Request.");

    // TESTE 4: Recuar de "Validação" para "Em progresso" COM justificativa obrigatória
    console.log("\n--> [TESTE 4] PATCH /api/worklogs/:id/status (Recuo com justificativa obrigatória)");
    const rejectWithReasonRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Em progresso",
        rejectionReason: "Faltou testar o envio de notas em contingência",
      }),
    });
    if (rejectWithReasonRes.status !== 200) {
      const err = await rejectWithReasonRes.text();
      throw new Error(`Falha no recuo com justificativa: ${rejectWithReasonRes.status} - ${err}`);
    }
    const rejectData = await rejectWithReasonRes.json();
    if (rejectData.status !== "Em progresso" || !rejectData.hasValidationRejection) {
      throw new Error("Status ou hasValidationRejection não refletiram o recuo com reprovação");
    }
    const hasRejectionNote = rejectData.notes.some(
      (n: any) => n.type === "rejection" && n.content.includes("contingência")
    );
    if (!hasRejectionNote) {
      throw new Error("Nota de rejeição não encontrada nas notas retornadas");
    }
    console.log("  ✅ [PASS] Chamado retornado para 'Em progresso' com hasValidationRejection=true e nota gravada.");

    // TESTE 5: Solucionar e Aprovar via PATCH /api/worklogs/:id/resolve
    console.log("\n--> [TESTE 5] PATCH /api/worklogs/:id/resolve (Aprovar Solução limpa pendência)");
    const resolveRes = await fetch(`${baseUrl}/api/worklogs/${testLogId}/resolve`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (resolveRes.status !== 200) {
      const err = await resolveRes.text();
      throw new Error(`Falha ao solucionar: ${resolveRes.status} - ${err}`);
    }
    const resolvedLog = await prisma.workLog.findUnique({
      where: { id: testLogId },
    });
    if (resolvedLog?.status !== "Solucionado" || resolvedLog?.hasValidationRejection !== false) {
      throw new Error("Chamado solucionado não limpou hasValidationRejection");
    }
    console.log("  ✅ [PASS] Chamado aprovado como Solucionado e pendência de recusa limpa.");

    console.log("\n🎉 TODOS OS TESTES DA API PASSARAM COM SUCESSO!");
  } catch (err) {
    console.error("❌ ERRO NO TESTE:", err);
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
