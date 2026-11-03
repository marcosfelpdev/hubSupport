import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed no banco de dados...");

  const adminEmail = process.env.ADMIN_SEED_EMAIL?.trim() || "admin@hubsupport.com";
  const adminName = process.env.ADMIN_SEED_NAME?.trim() || "Administrador";
  const adminPasswordPlain = process.env.ADMIN_SEED_PASSWORD?.trim() || "HubSupport@2026";
  const userPasswordPlain = process.env.USER_SEED_PASSWORD?.trim() || "Colaborador@2026";

  // 1. Criar usuário Administrador
  const adminPassword = await bcrypt.hash(adminPasswordPlain, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      password: adminPassword,
      role: "ADMIN",
      active: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: "ADMIN",
      active: true,
    },
  });

  // 2. Criar colaboradores de teste
  const userPassword = await bcrypt.hash(userPasswordPlain, 12);

  const user1 = await prisma.user.upsert({
    where: { email: "ana@hubsupport.com" },
    update: {
      name: "Ana Silva",
      role: "USER",
      active: true,
    },
    create: {
      name: "Ana Silva",
      email: "ana@hubsupport.com",
      password: userPassword,
      role: "USER",
      active: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "carlos@hubsupport.com" },
    update: {
      name: "Carlos Mendes",
      role: "USER",
      active: true,
    },
    create: {
      name: "Carlos Mendes",
      email: "carlos@hubsupport.com",
      password: userPassword,
      role: "USER",
      active: true,
    },
  });

  // 3. Criar usuário Técnico
  const techUser = await prisma.user.upsert({
    where: { email: "tecnico@hubsupport.com" },
    update: {
      name: "Lucas Técnico",
      role: "TECHNICIAN",
      active: true,
    },
    create: {
      name: "Lucas Técnico",
      email: "tecnico@hubsupport.com",
      password: userPassword,
      role: "TECHNICIAN",
      active: true,
    },
  });

  // 4. Criar usuário Gestor
  const managerUser = await prisma.user.upsert({
    where: { email: "gestao@hubsupport.com" },
    update: {
      name: "Juliana Gestora",
      role: "MANAGER",
      active: true,
    },
    create: {
      name: "Juliana Gestora",
      email: "gestao@hubsupport.com",
      password: userPassword,
      role: "MANAGER",
      active: true,
    },
  });

  // 5. Criar Tags Mestre iniciais (idempotente)
  const defaultTags = [
    { name: "Plataforma Web", color: "#3b82f6" },
    { name: "Sistema ERP", color: "#f59e0b" },
    { name: "App Mobile", color: "#10b981" },
    { name: "PDV / Checkout", color: "#ef4444" },
    { name: "Portal do Cliente", color: "#8b5cf6" },
  ];

  for (const tagData of defaultTags) {
    await prisma.tag.upsert({
      where: { name: tagData.name },
      update: { color: tagData.color },
      create: tagData,
    });
  }

  // 6. Chamados de exemplo opcionais (apenas se explicitamente habilitado via SEED_SAMPLE_LOGS=true)
  if (process.env.SEED_SAMPLE_LOGS === "true") {
    const defaultTagERP = await prisma.tag.findUnique({ where: { name: "Sistema ERP" } });
    const countLogs = await prisma.workLog.count();
    if (countLogs === 0) {
      await prisma.workLog.create({
        data: {
          title: "Falha na sincronização da API",
          requester: "Roberta Souza",
          clientOrOffice: "Escritório Central SP",
          reportedProblem: "Falha na sincronização da API de faturamento.",
          actionTaken: "Realizado diagnóstico preliminar.",
          status: "Em andamento",
          technicalAction: true,
          implementation: false,
          media: "[]",
          userId: user1.id,
          tagId: defaultTagERP?.id,
        },
      });
    }
  }

  console.log("✅ Usuários configurados com sucesso:");
  console.log(`   👑 [ADMIN] ${admin.name} (${admin.email})`);
  console.log(`   👤 [COLABORADOR] ${user1.name} (${user1.email})`);
  console.log(`   👤 [COLABORADOR] ${user2.name} (${user2.email})`);
  console.log(`   🔧 [TÉCNICO] ${techUser.name} (${techUser.email})`);
  console.log(`   📊 [GESTOR] ${managerUser.name} (${managerUser.email})`);
  console.log("🏷️  Tags Mestre criadas com sucesso!");
  console.log("\n✨ Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
