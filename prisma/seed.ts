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

  // 3. Criar usuário Técnico de teste
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

  // 4. Criar chamados de exemplo com ação técnica e implementação se não existirem
  const countTechLogs = await prisma.workLog.count({
    where: {
      OR: [{ technicalAction: true }, { implementation: true }],
    },
  });

  if (countTechLogs === 0) {
    const log1 = await prisma.workLog.create({
      data: {
        requester: "Roberta Souza",
        clientOrOffice: "Escritório Central SP",
        reportedProblem: "Falha na sincronização da API de faturamento com o banco de dados principal. Retorno de erro 504 Timeout nas requisições noturnas.",
        actionTaken: "Realizado diagnóstico preliminar na fila de processamento. Necessário ajuste no script de conciliação e deploy de patch de performance.",
        status: "Em andamento",
        technicalAction: true,
        implementation: false,
        media: "[]",
        userId: user1.id,
      },
    });

    const log2 = await prisma.workLog.create({
      data: {
        requester: "Mariana Costa",
        clientOrOffice: "Filial Curitiba",
        reportedProblem: "Sugestão de automação para exportação de relatórios diários em formato XLSX e envio automático para os gerentes regionais.",
        actionTaken: "Documentado escopo da demanda com a equipe de atendimento. Encaminhado para a equipe técnica analisar viabilidade de implementação do cronjob.",
        status: "Aguardando reunião",
        technicalAction: false,
        implementation: true,
        media: "[]",
        userId: user2.id,
      },
    });

    // Criar notificações para o técnico
    await prisma.notification.createMany({
      data: [
        {
          userId: techUser.id,
          workLogId: log1.id,
          title: "Novo chamado: Ação Técnica",
          message: `${user1.name} registrou um atendimento para "Escritório Central SP" que requer atuação técnica.`,
          read: false,
        },
        {
          userId: techUser.id,
          workLogId: log2.id,
          title: "Novo chamado: Implementação",
          message: `${user2.name} registrou um atendimento para "Filial Curitiba" que requer atuação técnica.`,
          read: false,
        },
      ],
    });
  }

  console.log("✅ Usuários configurados:");
  console.log(`   👑 [ADMIN] ${admin.name} (${admin.email})`);
  console.log(`   👤 [COLABORADOR] ${user1.name} (${user1.email})`);
  console.log(`   👤 [COLABORADOR] ${user2.name} (${user2.email})`);
  console.log(`   🔧 [TÉCNICO] ${techUser.name} (${techUser.email}) - Senha: senha123`);
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
