import { prisma } from "../src/lib/prisma";

async function testDb() {
  console.log("=== TESTE DE BANCO: WORKLOGNOTE E HASVALIDATIONREJECTION ===");

  const user = await prisma.user.findFirst({ where: { active: true } });
  if (!user) throw new Error("Usuário não encontrado");

  const tag = await prisma.tag.findFirst();
  if (!tag) throw new Error("Tag não encontrada");

  // 1. Criar chamado de teste
  const log = await prisma.workLog.create({
    data: {
      title: "Chamado Teste Notas",
      requester: "Testador",
      clientOrOffice: "Escritório Alfa",
      reportedProblem: "Teste de notas",
      userId: user.id,
      tagId: tag.id,
      status: "Validação",
      hasValidationRejection: false,
    },
  });
  console.log("Chamado criado:", log.id, "hasValidationRejection:", log.hasValidationRejection);

  // 2. Criar nota geral e nota de recusa
  const note1 = await prisma.workLogNote.create({
    data: {
      workLogId: log.id,
      userId: user.id,
      content: "Primeiro apontamento geral da equipe",
      type: "general",
    },
  });
  console.log("Nota 1 criada:", note1.id, note1.type);

  const note2 = await prisma.workLogNote.create({
    data: {
      workLogId: log.id,
      userId: user.id,
      content: "Solução reprovada: relatório não abordou a falha de rede",
      type: "rejection",
    },
  });
  console.log("Nota 2 (rejeição) criada:", note2.id, note2.type);

  // 3. Atualizar flag hasValidationRejection
  const updatedLog = await prisma.workLog.update({
    where: { id: log.id },
    data: { hasValidationRejection: true },
    include: {
      notes: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  console.log("Chamado atualizado hasValidationRejection:", updatedLog.hasValidationRejection);
  console.log("Total de notas vinculadas:", updatedLog.notes.length);
  if (updatedLog.notes.length !== 2) throw new Error("Deveria conter 2 notas");
  if (!updatedLog.hasValidationRejection) throw new Error("hasValidationRejection deveria ser true");

  // 4. Limpeza
  await prisma.workLogNote.deleteMany({ where: { workLogId: log.id } });
  await prisma.workLog.delete({ where: { id: log.id } });
  console.log("Limpeza concluída com sucesso!");
  console.log("✅ [PASS] Teste de banco WorkLogNote concluído com 100% de sucesso!");
}

testDb()
  .catch((err) => {
    console.error("Erro no teste de banco:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
