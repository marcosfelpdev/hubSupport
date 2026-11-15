import { prisma } from "../src/lib/prisma";

async function runTest() {
  console.log("🚀 Iniciando teste de verificação do schema Prisma: descriptionInterleaved...");

  try {
    // 1. Obter usuário existente para associar ao WorkLog
    let user = await prisma.user.findFirst();
    if (!user) {
      console.log("ℹ️ Nenhum usuário encontrado. Criando usuário temporário para o teste...");
      user = await prisma.user.create({
        data: {
          name: "Test User Schema",
          email: `test-schema-${Date.now()}@example.com`,
          password: "hashedpassword123",
          role: "ADMIN",
        },
      });
    }

    const testInterleavedPayload = JSON.stringify([
      { type: "text", content: "Problema identificado ao abrir a tela de login: " },
      {
        type: "media",
        mediaId: "media_test_123",
        filename: "erro-login.png",
        mimeType: "image/png",
        fileIndex: 0,
      },
      { type: "text", content: "Após clicar no botão, o erro 500 foi exibido." },
    ]);

    // 2. Criar WorkLog com descriptionInterleaved
    console.log("📝 Criando WorkLog de teste com descriptionInterleaved...");
    const created = await prisma.workLog.create({
      data: {
        title: "Teste descriptionInterleaved",
        requester: "Tester",
        clientOrOffice: "Escritório de Testes",
        reportedProblem: "Problema identificado ao abrir a tela de login. Após clicar no botão, erro 500.",
        descriptionInterleaved: testInterleavedPayload,
        userId: user.id,
      },
    });

    console.log("✅ WorkLog criado com ID:", created.id);
    if (created.descriptionInterleaved !== testInterleavedPayload) {
      throw new Error(
        `Falha na verificação de inserção: esperado "${testInterleavedPayload}", recebido "${created.descriptionInterleaved}"`
      );
    }

    // 3. Buscar WorkLog pelo ID
    console.log("🔍 Buscando WorkLog criado pelo ID...");
    const fetched = await prisma.workLog.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        title: true,
        reportedProblem: true,
        descriptionInterleaved: true,
      },
    });

    if (!fetched) {
      throw new Error("WorkLog criado não foi encontrado na busca.");
    }

    if (fetched.descriptionInterleaved !== testInterleavedPayload) {
      throw new Error(
        `Falha na verificação de busca: esperado "${testInterleavedPayload}", recebido "${fetched.descriptionInterleaved}"`
      );
    }
    console.log("✅ descriptionInterleaved persistido e recuperado com sucesso!");

    // 4. Atualizar descriptionInterleaved
    console.log("🔄 Atualizando descriptionInterleaved...");
    const updatedPayload = JSON.stringify([
      { type: "text", content: "Descrição atualizada sem mídia." },
    ]);
    const updated = await prisma.workLog.update({
      where: { id: created.id },
      data: {
        descriptionInterleaved: updatedPayload,
      },
      select: {
        id: true,
        descriptionInterleaved: true,
      },
    });

    if (updated.descriptionInterleaved !== updatedPayload) {
      throw new Error(
        `Falha na verificação de atualização: esperado "${updatedPayload}", recebido "${updated.descriptionInterleaved}"`
      );
    }
    console.log("✅ Atualização de descriptionInterleaved concluída com sucesso!");

    // 5. Limpeza do registro de teste
    console.log("🧹 Removendo registro de teste...");
    await prisma.workLog.delete({
      where: { id: created.id },
    });
    console.log("✅ Registro de teste removido.");

    console.log("🎉 Teste de verificação do schema Prisma PASSOU com sucesso!");
  } catch (error) {
    console.error("❌ Erro durante a execução do teste:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
