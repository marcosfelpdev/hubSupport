import assert from "assert";
import { prisma } from "../src/lib/prisma";

async function testArchiveApi() {
  console.log("[Test] Iniciando teste do fluxo de arquivamento no banco de dados...");

  // 1. Cria ou busca um chamado para teste
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test-archive@hubsupport.local",
        name: "Test Archive User",
        password: "hash",
        role: "ADMIN",
      },
    });
  }

  const workLog = await prisma.workLog.create({
    data: {
      title: "Chamado Teste de Arquivamento",
      requester: "Tester",
      clientOrOffice: "Escritório Modelo",
      reportedProblem: "Erro a ser arquivado",
      status: "Em progresso",
      technicalAction: true,
      userId: user.id,
      isArchived: false,
    },
  });

  assert.strictEqual(workLog.isArchived, false, "Chamado recém-criado deve ter isArchived=false");
  assert.strictEqual(workLog.archivedAt, null, "archivedAt deve ser null inicialmente");

  // 2. Simula o PATCH /api/worklogs/:id/archive
  const archived = await prisma.workLog.update({
    where: { id: workLog.id },
    data: {
      isArchived: true,
      archivedAt: new Date(),
    },
  });

  assert.strictEqual(archived.isArchived, true, "Chamado deve ser marcado como isArchived=true");
  assert.ok(archived.archivedAt instanceof Date, "archivedAt deve ser uma data válida");
  assert.strictEqual(archived.status, "Em progresso", "Status original 'Em progresso' deve ser rigorosamente preservado!");

  // 3. Testa consulta do kanban ativo: NÃO deve retornar o item arquivado
  const activeLogs = await prisma.workLog.findMany({
    where: {
      id: workLog.id,
      isArchived: false,
    },
  });
  assert.strictEqual(activeLogs.length, 0, "Chamado arquivado não pode aparecer no kanban ativo!");

  // 4. Testa consulta dos arquivados: DEVE retornar o item arquivado
  const archivedLogs = await prisma.workLog.findMany({
    where: {
      id: workLog.id,
      isArchived: true,
    },
  });
  assert.strictEqual(archivedLogs.length, 1, "Chamado arquivado deve aparecer na consulta de arquivados");

  // 5. Simula o PATCH /api/worklogs/:id/unarchive (restauração)
  const unarchived = await prisma.workLog.update({
    where: { id: workLog.id },
    data: {
      isArchived: false,
      archivedAt: null,
    },
  });

  assert.strictEqual(unarchived.isArchived, false, "Chamado restaurado deve ter isArchived=false");
  assert.strictEqual(unarchived.archivedAt, null, "archivedAt deve ser null após restauração");
  assert.strictEqual(unarchived.status, "Em progresso", "Status deve continuar 'Em progresso' para voltar à coluna certa");

  // Limpeza do chamado de teste
  await prisma.workLog.delete({ where: { id: workLog.id } });

  console.log("[Test] PASS: Fluxo completo de arquivamento, preservação de coluna e restauração testado com sucesso!");
}

testArchiveApi()
  .catch((err) => {
    console.error("[Test] FAIL:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
