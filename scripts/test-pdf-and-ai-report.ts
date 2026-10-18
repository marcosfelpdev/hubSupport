import { generateReportPdf } from "../src/lib/pdf-generator";
import { StructuredReportData } from "../src/lib/gemini";
import { prisma } from "../src/lib/prisma";
import fs from "fs/promises";
import path from "path";

async function main() {
  console.log("🧪 Iniciando teste do gerador de PDF e integração de banco de dados...");

  // 1. Obter ou criar um usuário e um atendimento de teste
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error("Nenhum usuário encontrado no banco de dados.");
  }

  const workLog = await prisma.workLog.create({
    data: {
      requester: "Mariana Teste",
      clientOrOffice: "Escritório de Testes & Auditoria",
      reportedProblem: "Lentidão nas requisições do painel financeiro e erro de conciliação de faturas.",
      actionTaken: "Realizada análise de desempenho do banco de dados e aplicada indexação nas tabelas de transação.",
      status: "Solucionado",
      technicalAction: true,
      implementation: false,
      media: "[]",
      userId: user.id,
    },
  });

  console.log(`✅ Atendimento de teste criado: ID ${workLog.id}`);

  // 2. Testar geração de PDF com PDFKit
  const sampleData: StructuredReportData = {
    title: "Relatório de Sugestões de Melhoria no Sistema",
    subtitle: "Solicitação de Exportação de Dados em Lote para Planilhamento",
    date: "09/10/2026",
    department: "Cível Processual | IEP Advogados",
    participants: `Raynara (Operação), ${user.name} (Suporte Trinux)`,
    platformAnalyzed: "Trinux ERP Jurídico",
    executiveSummary:
      "Este documento formaliza uma solicitação de melhoria levantada pela operação durante atendimento de suporte. A usuária Raynara identificou a necessidade de uma funcionalidade de exportação em lote das informações processuais filtradas na tela, com o objetivo de agilizar drasticamente o trabalho manual de \"planilhar\" grandes volumes de processos.",
    proposals: [
      {
        item: "1. Exportação de Dados em Lote (PDF/Excel)",
        description:
          "Capacidade de baixar um arquivo contendo os dados principais (ex: Número do Processo, Nome, Vara) de múltiplos protocolos filtrados simultaneamente.",
        category: "UX / EXPORTAÇÃO",
        priority: "Alta",
      },
    ],
    detailingTopic: "Necessidade Operacional de Planilhamento",
    detailingParagraphs: [
      "No fluxo de trabalho atual da equipe Cível Processual, é comum que a operação filtre um volume expressivo de protocolos pendentes ou ativos (como no exemplo demonstrado na reunião, um filtro retornando 115 processos). A usuária demonstrou que, atualmente, os dados fundamentais para acompanhamento — como o número do processo, o nome do cliente e a vara — ficam visíveis na interface web, mas não há um botão rápido para exportar todos esses resultados condensados.",
      "A criação de uma ferramenta de exportação em lote (seja no formato PDF solicitado pela usuária, ou preferencialmente em formato estruturado como CSV/Excel para planilhamento direto) removeria a necessidade de copiar os dados um a um, poupando horas de trabalho manual e mitigando riscos de erro de digitação.",
    ],
    referrals:
      "O representante do suporte avaliou a interface durante a chamada e confirmou que a funcionalidade não está disponível na versão atual. Comprometeu-se a preencher um relatório de requisitos e repassar a demanda imediatamente à equipe técnica (Dev) para implementação futura.",
    transcript: [
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "00:38",
        text: "Que quando a gente filtrava, a gente conseguia baixar tudo isso aqui. Aí ficava os dados com o número, a vara, o nome e contra quem é. Aí a gente conseguia baixar e ter tudo isso em um único PDF. Aí eu queria saber se existe a possibilidade de fazer isso aqui também. Porque eu preciso dos dados de todos esses 115 protocolos pra poder planilhar. Aí eu acho que facilitaria bastante fazendo isso. Tipo assim, baixar em um único PDF essas informações que ficam aqui na frente, sabe?",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "01:18",
        text: "Sim, eu sei.",
      },
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "01:20",
        text: "Pois é, pra conseguir planilhar. Aí eu queria saber se é possível fazer isso.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "01:24",
        text: "Pronto, eu vou ver agora se é possível fazer. Se não for, eu vou passar pra equipe técnica pra gente já implementar essa função pra ti, tá?",
      },
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "01:32",
        text: "Tá certo.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "01:33",
        text: "Só um minutinho, eu vou só confirmar aqui.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "03:40",
        text: "Oi, alô?",
      },
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "03:44",
        text: "Oi.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "03:45",
        text: "Oi, perdão, é que eu acabei não perguntando o seu nome.",
      },
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "03:48",
        text: "É Raynara.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "03:49",
        text: "Raynara, certo. Raynara, é... pode só me dizer de novo qual que era a situação? Era pra fazer o download em PDF de que informações?",
      },
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "04:03",
        text: "É dessas informações, como o número... o nome... tipo assim, os principais, é o número do processo e o nome.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "04:13",
        text: "Certo, entendi. Só mais um instantinho.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "04:24",
        text: "Pronto, perfeito, Raynara. É... realmente a gente não tem essa funcionalidade ainda, tá? Mas eu vou preencher um relatório, passar pra equipe técnica, e assim que possível a gente implementa isso pra você, tá?",
      },
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "04:35",
        text: "Tá certo, muito obrigada, viu? Iria ajudar bastante, porque são muitos... são 115...",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "04:40",
        text: "Ah, 115 é muita coisa mesmo. Mas tudo bem, pode deixar que a gente vai fazer pra você, tá?",
      },
      {
        speaker: "Raynara",
        role: "Cível Processual",
        timestamp: "04:47",
        text: "Tá certo, muitíssimo obrigada. Boa tarde.",
      },
      {
        speaker: user.name,
        role: "Suporte",
        timestamp: "04:50",
        text: "Boa tarde, de nada.",
      },
    ],
  };

  const context = {
    requester: workLog.requester,
    clientOrOffice: workLog.clientOrOffice,
    reportedProblem: workLog.reportedProblem,
    actionTaken: workLog.actionTaken,
    status: workLog.status,
    technicalAction: workLog.technicalAction,
    implementation: workLog.implementation,
    authorName: user.name,
    createdAt: workLog.createdAt,
  };

  console.log("📄 Gerando arquivo PDF com PDFKit...");
  const pdfPath = await generateReportPdf({
    workLogId: workLog.id,
    data: sampleData,
    context,
  });

  console.log(`✅ PDF gerado com sucesso em: ${pdfPath}`);

  // Validar integridade do arquivo PDF
  const stats = await fs.stat(pdfPath);
  console.log(`📦 Tamanho do arquivo PDF: ${stats.size} bytes`);
  if (stats.size < 1000) {
    throw new Error("Arquivo PDF gerado está vazio ou truncado!");
  }

  const pdfHeader = (await fs.readFile(pdfPath)).subarray(0, 5).toString();
  if (pdfHeader !== "%PDF-") {
    throw new Error(`Cabeçalho inválido no arquivo PDF: esperado %PDF-, recebido ${pdfHeader}`);
  }
  console.log(`✅ Assinatura do PDF válida: ${pdfHeader}`);

  // 3. Vincular o relatório ao atendimento no banco de dados
  const aiReport = await prisma.aiReport.create({
    data: {
      workLogId: workLog.id,
      status: "completed",
      pdfPath,
      structuredData: JSON.stringify(sampleData),
      completedAt: new Date(),
    },
  });

  console.log(`✅ Registro AiReport criado e vinculado: ID ${aiReport.id}, status: ${aiReport.status}`);

  // 4. Testar consulta via Prisma para garantir que o relacionamento 1-1 funciona
  const queriedLog = await prisma.workLog.findUnique({
    where: { id: workLog.id },
    include: { aiReport: true },
  });

  if (!queriedLog?.aiReport || queriedLog.aiReport.status !== "completed") {
    throw new Error("Falha ao consultar AiReport relacionado com WorkLog!");
  }

  console.log("✅ Relacionamento WorkLog <-> AiReport verificado com sucesso no banco!");
  console.log("\n✨ Todos os testes de PDF e banco de dados foram concluídos com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no teste:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
