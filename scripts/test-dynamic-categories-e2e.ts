import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import http from "http";

async function main() {
  console.log("================================================================================");
  console.log("   TESTE E2E: GERENCIAMENTO DINÂMICO DE CATEGORIAS DE ATENDIMENTO");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor de teste iniciado na porta ${port}\n`);

  let testCatId: string | null = null;
  let testWorkLogId: string | null = null;

  try {
    // 1. Obter usuários
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", active: true },
    });
    if (!adminUser) throw new Error("Admin não encontrado no banco.");

    const techUser = await prisma.user.findFirst({
      where: { role: "TECHNICIAN", active: true },
    });
    if (!techUser) throw new Error("Técnico não encontrado no banco.");

    const sampleTag = await prisma.tag.findFirst();
    if (!sampleTag) throw new Error("Nenhuma tag encontrada no banco.");

    const adminToken = generateToken(adminUser);

    // ETAPA 1: Verificar categorias padrão
    console.log("--> [ETAPA 1] Validar categorias pré-existentes / padrão");
    const listRes = await fetch(`${baseUrl}/api/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (listRes.status !== 200) throw new Error(`Falha ao listar: status ${listRes.status}`);
    const initialCats = await listRes.json();
    console.log(`  Encontradas ${initialCats.length} categorias cadastradas.`);
    const slugs = initialCats.map((c: any) => c.slug);
    const requiredSlugs = ["technical_action", "implementation", "prompt", "idea"];
    for (const slug of requiredSlugs) {
      if (!slugs.includes(slug)) {
        throw new Error(`Categoria padrão '${slug}' não encontrada nas categorias cadastradas.`);
      }
    }
    console.log("  ✅ [PASS] Todas as 4 categorias padrão estão presentes.\n");

    // ETAPA 2: Admin cria nova categoria personalizada
    console.log("--> [ETAPA 2] Admin cria nova categoria personalizada 'Suporte VIP'");
    const createCatRes = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Suporte VIP",
        subtitle: "Atendimento prioritário para diretores",
        icon: "shield",
        color: "#ec4899",
        notifyRole: "TECHNICIAN",
        targetKanban: true,
        lockStatus: true,
        targetStatus: "Backlog",
        order: 10,
        active: true,
      }),
    });
    if (createCatRes.status !== 201) {
      const err = await createCatRes.text();
      throw new Error(`Falha ao criar categoria: ${createCatRes.status} - ${err}`);
    }
    const createdCat = await createCatRes.json();
    testCatId = createdCat.id;
    console.log(`  ✅ [PASS] Categoria criada com sucesso! ID: ${createdCat.id}, Slug: ${createdCat.slug}\n`);

    // ETAPA 3: Criar chamado vinculado à nova categoria
    console.log("--> [ETAPA 3] Criar chamado com categoryId e status inicial customizado (testando trava)");
    const formData = new FormData();
    formData.append("title", "Falha de Conexão no Gabinete da Presidência");
    formData.append("requester", "Dr. Roberto");
    formData.append("clientOrOffice", "Gabinete Presidencial");
    formData.append("reportedProblem", "Queda súbita de VPN e acesso ao sistema central");
    formData.append("status", "Em progresso"); // Deve ser sobrescrito para 'Backlog' devido a lockStatus
    formData.append("tagId", sampleTag.id);
    formData.append("categoryId", createdCat.id);

    const initialNotificationsCount = await prisma.notification.count({
      where: { userId: techUser.id },
    });

    const createLogRes = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: formData,
    });

    if (createLogRes.status !== 201) {
      const err = await createLogRes.text();
      throw new Error(`Falha ao criar chamado: ${createLogRes.status} - ${err}`);
    }

    const createdLogResponse = await createLogRes.json();
    testWorkLogId = createdLogResponse.id || createdLogResponse.logId;
    console.log(`  Chamado criado com ID: ${testWorkLogId}`);

    // ETAPA 4: Validar propriedades do chamado (trava de status, categoryId, etc.)
    console.log("--> [ETAPA 4] Validar integridade e trava de status do chamado criado via GET /api/worklogs/:id");
    const singleLogRes = await fetch(`${baseUrl}/api/worklogs/${testWorkLogId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (singleLogRes.status !== 200) {
      throw new Error(`Falha ao buscar chamado por ID: ${singleLogRes.status}`);
    }
    const createdLog = await singleLogRes.json();

    if (createdLog.categoryId !== createdCat.id) {
      throw new Error(`Esperado categoryId ${createdCat.id}, obtido ${createdLog.categoryId}`);
    }
    if (createdLog.status !== "Backlog") {
      throw new Error(`Esperado status 'Backlog' pela trava, mas obteve: '${createdLog.status}'`);
    }
    if (createdLog.category?.name !== "Suporte VIP") {
      throw new Error(`Esperado category.name 'Suporte VIP', obtido: '${createdLog.category?.name}'`);
    }
    console.log("  ✅ [PASS] Chamado vinculado corretamente com categoryId e status travado em 'Backlog'.\n");

    // ETAPA 5: Validar geração de notificação para a role configurada (TECHNICIAN)
    console.log("--> [ETAPA 5] Validar notificação disparada para TECHNICIAN");
    const finalNotificationsCount = await prisma.notification.count({
      where: { userId: techUser.id },
    });
    if (finalNotificationsCount <= initialNotificationsCount) {
      throw new Error("Nenhuma notificação foi gerada para o técnico configurado em notifyRole.");
    }
    const latestNotification = await prisma.notification.findFirst({
      where: { userId: techUser.id },
      orderBy: { createdAt: "desc" },
    });
    console.log(`  Notificação encontrada: "${latestNotification?.title}" - "${latestNotification?.message}"`);
    console.log("  ✅ [PASS] Notificação gerada com sucesso para o cargo configurado.\n");

    // ETAPA 6: Validar busca de chamados e inclusão da relação category
    console.log("--> [ETAPA 6] Validar busca em GET /api/worklogs com inclusão de category");
    const getWorklogsRes = await fetch(`${baseUrl}/api/worklogs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const worklogs = await getWorklogsRes.json();
    const fetchedLog = worklogs.find((w: any) => w.id === testWorkLogId);
    if (!fetchedLog) throw new Error("Chamado criado não encontrado na listagem geral.");
    if (!fetchedLog.category || fetchedLog.category.id !== createdCat.id) {
      throw new Error("Relação category ausente ou incorreta no chamado retornado pela listagem.");
    }
    console.log(`  Chamado traz category com ícone '${fetchedLog.category.icon}' e cor '${fetchedLog.category.color}'`);
    console.log("  ✅ [PASS] Listagem de chamados inclui dados completos da categoria.\n");

    // ETAPA 7: Atualizar categoria (PUT)
    console.log("--> [ETAPA 7] Editar a categoria criada");
    const updateCatRes = await fetch(`${baseUrl}/api/categories/${createdCat.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Suporte Presidencial VIP",
        color: "#db2777",
      }),
    });
    if (updateCatRes.status !== 200) {
      throw new Error(`Falha ao editar categoria: ${updateCatRes.status}`);
    }
    const updatedCat = await updateCatRes.json();
    if (updatedCat.name !== "Suporte Presidencial VIP" || updatedCat.color !== "#db2777") {
      throw new Error("Atualização de categoria não refletiu os novos valores.");
    }
    console.log(`  ✅ [PASS] Categoria atualizada para '${updatedCat.name}' com cor '${updatedCat.color}'.\n`);

    // ETAPA 8: Excluir a categoria e validar desassociação segura
    console.log("--> [ETAPA 8] Excluir categoria de teste e validar segurança referencial");
    const deleteCatRes = await fetch(`${baseUrl}/api/categories/${createdCat.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (deleteCatRes.status !== 200) {
      const err = await deleteCatRes.text();
      throw new Error(`Falha ao excluir categoria: ${deleteCatRes.status} - ${err}`);
    }
    testCatId = null; // Já excluída

    const logAfterCatDelete = await prisma.workLog.findUnique({
      where: { id: testWorkLogId },
    });
    if (logAfterCatDelete?.categoryId !== null) {
      throw new Error("Esperado que categoryId fosse setado para null após a exclusão da categoria.");
    }
    console.log("  ✅ [PASS] Categoria excluída e chamado desassociado com segurança (categoryId: null).\n");

    console.log("================================================================================");
    console.log("   🎉 TODOS OS TESTES E2E DE CATEGORIAS DINÂMICAS PASSARAM COM 100%!");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("❌ ERRO NO TESTE E2E:", err);
    process.exitCode = 1;
  } finally {
    // Limpeza segura
    if (testWorkLogId) {
      await prisma.notification.deleteMany({ where: { workLogId: testWorkLogId } }).catch(() => {});
      await prisma.workLogStatusHistory.deleteMany({ where: { workLogId: testWorkLogId } }).catch(() => {});
      await prisma.aiReport.deleteMany({ where: { workLogId: testWorkLogId } }).catch(() => {});
      await prisma.workLog.delete({ where: { id: testWorkLogId } }).catch(() => {});
    }
    if (testCatId) {
      await prisma.workLogCategory.delete({ where: { id: testCatId } }).catch(() => {});
    }
    await prisma.$disconnect();
    server.close();
  }
}

main();
