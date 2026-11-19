import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import http from "http";

async function main() {
  console.log("================================================================================");
  console.log("   TESTE DE INTEGRAÇÃO: API DE CATEGORIAS DINÂMICAS & RBAC");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor de testes ativo na porta ${port}\n`);

  try {
    // 1. Obter ou criar usuários para teste: 1 Admin e 1 Normal User
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", active: true },
    });
    if (!adminUser) throw new Error("Usuário Admin não encontrado no banco.");

    const normalUser = await prisma.user.findFirst({
      where: { role: "USER", active: true },
    });
    if (!normalUser) throw new Error("Usuário Comum não encontrado no banco.");

    const techUser = await prisma.user.findFirst({
      where: { role: "TECHNICIAN", active: true },
    });
    if (!techUser) throw new Error("Usuário Técnico não encontrado no banco.");

    const adminToken = generateToken(adminUser);
    const normalToken = generateToken(normalUser);

    console.log(`👤 Admin: ${adminUser.name} | Usuário Comum: ${normalUser.name} | Técnico: ${techUser.name}`);

    // TESTE 1: GET /api/categories (autenticado)
    console.log("\n--> [TESTE 1] GET /api/categories como Usuário Comum");
    const getRes = await fetch(`${baseUrl}/api/categories`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    if (getRes.status !== 200) throw new Error(`Falha no GET /api/categories: status ${getRes.status}`);
    const categories = await getRes.json();
    console.log(`  ✅ [PASS] Listadas ${categories.length} categorias com sucesso.`);

    // TESTE 2: POST /api/categories como Usuário Comum (Deve ser 403 Forbidden)
    console.log("\n--> [TESTE 2] POST /api/categories como Usuário Comum (RBAC)");
    const forbidRes = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${normalToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Categoria Não Autorizada",
      }),
    });
    if (forbidRes.status !== 403) {
      throw new Error(`Esperado status 403 Forbidden para não-admin, obtido: ${forbidRes.status}`);
    }
    console.log("  ✅ [PASS] Usuário não-admin foi corretamente bloqueado com 403 Forbidden.");

    // TESTE 3: POST /api/categories como Admin
    console.log("\n--> [TESTE 3] POST /api/categories como Admin");
    const createRes = await fetch(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Infraestrutura Cloud",
        subtitle: "Servidores e bancos de dados",
        icon: "server",
        color: "#06b6d4",
        notifyRole: "TECHNICIAN",
        targetKanban: true,
        lockStatus: true,
        targetStatus: "Backlog",
        order: 99,
      }),
    });
    if (createRes.status !== 201) {
      const err = await createRes.text();
      throw new Error(`Falha no POST /api/categories (Admin): ${createRes.status} - ${err}`);
    }
    const createdCat = await createRes.json();
    console.log(`  ✅ [PASS] Categoria criada com sucesso: "${createdCat.name}" (ID: ${createdCat.id}, Slug: ${createdCat.slug})`);

    // TESTE 4: PUT /api/categories/:id como Admin
    console.log("\n--> [TESTE 4] PUT /api/categories/:id como Admin");
    const updateRes = await fetch(`${baseUrl}/api/categories/${createdCat.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Infraestrutura Cloud & DevOps",
        color: "#6366f1",
      }),
    });
    if (updateRes.status !== 200) {
      throw new Error(`Falha no PUT /api/categories/:id: status ${updateRes.status}`);
    }
    const updatedCat = await updateRes.json();
    if (updatedCat.name !== "Infraestrutura Cloud & DevOps" || updatedCat.color !== "#6366f1") {
      throw new Error("Dados da categoria não foram atualizados corretamente.");
    }
    console.log(`  ✅ [PASS] Categoria atualizada: "${updatedCat.name}" (${updatedCat.color})`);

    // TESTE 5: POST /api/worklogs associando categoryId
    console.log("\n--> [TESTE 5] POST /api/worklogs com categoryId dinâmico");
    const tag = await prisma.tag.findFirst();
    if (!tag) throw new Error("Nenhuma tag encontrada no banco.");

    const formBody = new URLSearchParams();
    formBody.set("title", "Deploy do novo cluster Kubernetes");
    formBody.set("requester", "DevOps Team");
    formBody.set("clientOrOffice", "Matriz SP");
    formBody.set("reportedProblem", "Configuração de autoscaling no cluster.");
    formBody.set("status", "Realizado"); // Deve ser sobrescrito para "Backlog" por lockStatus: true
    formBody.set("tagId", tag.id);
    formBody.set("categoryId", createdCat.id);

    const logRes = await fetch(`${baseUrl}/api/worklogs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${normalToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });

    if (logRes.status !== 201) {
      const err = await logRes.text();
      throw new Error(`Falha ao criar WorkLog com categoryId: ${logRes.status} - ${err}`);
    }
    const logData = await logRes.json();
    console.log(`  ✅ [PASS] Atendimento criado (ID: ${logData.id}).`);

    // Verificar se o WorkLog criado tem o status "Backlog" e categoryId correto
    const savedLog = await prisma.workLog.findUnique({
      where: { id: logData.id },
      include: { category: true },
    });

    if (!savedLog || savedLog.categoryId !== createdCat.id) {
      throw new Error("WorkLog não associou categoryId corretamente.");
    }
    if (savedLog.status !== "Backlog") {
      throw new Error(`Status esperado "Backlog" (lockStatus), obtido: "${savedLog.status}"`);
    }
    console.log(`  ✅ [PASS] Status travado em "Backlog" e categoria vinculada: ${savedLog.category?.name}`);

    // TESTE 6: DELETE /api/categories/:id como Admin
    console.log("\n--> [TESTE 6] DELETE /api/categories/:id como Admin");
    const delRes = await fetch(`${baseUrl}/api/categories/${createdCat.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (delRes.status !== 200) {
      throw new Error(`Falha no DELETE /api/categories/:id: status ${delRes.status}`);
    }
    console.log("  ✅ [PASS] Categoria excluída com sucesso.");

    // Limpeza do worklog criado
    await prisma.notification.deleteMany({ where: { workLogId: logData.id } });
    await prisma.aiReport.deleteMany({ where: { workLogId: logData.id } });
    await prisma.workLogStatusHistory.deleteMany({ where: { workLogId: logData.id } });
    await prisma.workLog.delete({ where: { id: logData.id } });
    console.log("  🧹 Dados temporários de teste removidos.");

    console.log("\n================================================================================");
    console.log("✨ TODOS OS TESTES DA TASK 2 PASSARAM COM 100% DE SUCESSO!");
    console.log("================================================================================");
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Erro nos testes da Task 2:", err);
  process.exit(1);
});
