import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("--> Testando WorkLogCategory no banco...");
  const categories = await prisma.workLogCategory.findMany({
    orderBy: { order: "asc" },
  });

  console.log(`Encontradas ${categories.length} categorias cadastradas:`);
  for (const cat of categories) {
    console.log(`  - [${cat.order}] ${cat.name} (${cat.slug}) | Icon: ${cat.icon} | Color: ${cat.color} | Notify: ${cat.notifyRole} | Kanban: ${cat.targetKanban} | Lock: ${cat.lockStatus}`);
  }

  if (categories.length < 4) {
    throw new Error(`Esperado pelo menos 4 categorias, encontrado: ${categories.length}`);
  }

  // Verificar se a consulta com include category funciona
  const sampleLog = await prisma.workLog.findFirst({
    include: { category: true },
  });

  console.log("Consulta de WorkLog com category include bem-sucedida! Exemplo:", sampleLog ? {
    id: sampleLog.id,
    title: sampleLog.title,
    categoryId: sampleLog.categoryId,
    categoryName: sampleLog.category?.name ?? "Sem categoria",
  } : "Nenhum log no banco");

  console.log("✅ Task 1 DB Verification passou com sucesso!");
}

run()
  .catch((err) => {
    console.error("❌ Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
