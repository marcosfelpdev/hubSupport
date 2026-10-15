import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // 1. Criar usuário Mestre / Administrador
  const adminPassword = await bcrypt.hash("076250@Ma", 12);
  const admin = await prisma.user.upsert({
    where: { email: "marcosf@hubsupport.com" },
    update: {
      name: "Marcos",
      password: adminPassword,
      role: "ADMIN",
      active: true,
    },
    create: {
      name: "Marcos",
      email: "marcosf@hubsupport.com",
      password: adminPassword,
      role: "ADMIN",
      active: true,
    },
  });

  // 2. Criar colaboradores de teste
  const userPassword = await bcrypt.hash("senha123", 12);

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

  console.log("✅ Usuários configurados:");
  console.log(`   👑 [ADMIN] ${admin.name} (${admin.email})`);
  console.log(`   👤 [COLABORADOR] ${user1.name} (${user1.email})`);
  console.log(`   👤 [COLABORADOR] ${user2.name} (${user2.email})`);
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
