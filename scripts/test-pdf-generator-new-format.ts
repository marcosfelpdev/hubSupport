import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { generateReportPdf } from "../src/lib/pdf-generator";
import { StructuredReportData, WorkLogContext } from "../src/lib/gemini";
import { getFileBuffer } from "../src/server/services/r2Storage";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

async function runTests() {
  console.log("=== Iniciando Suíte de Testes do Novo Gerador de PDF (PDFKit Modernizado) ===\n");

  // Criação de imagem PNG de teste (100x60 pixels simples em base64 válida)
  // Ou leitura de imagem existente se disponível
  let samplePngBuffer: Buffer;
  const existingImagePath = path.join(process.cwd(), "scripts", "dashboard_with_ai_report.png");
  if (fs.existsSync(existingImagePath)) {
    samplePngBuffer = fs.readFileSync(existingImagePath);
    console.log(`✓ Usando imagem de teste real: ${existingImagePath} (${samplePngBuffer.length} bytes)`);
  } else {
    // 1x1 pixel PNG transparente fallback
    const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    samplePngBuffer = Buffer.from(samplePngBase64, "base64");
    console.log("✓ Usando PNG de teste gerado em memória");
  }

  // -------------------------------------------------------------
  // TESTE 1: Relatório Completo de QA e Investigação Técnica
  // -------------------------------------------------------------
  console.log("\n[1] Testando geração de Relatório Completo com Identidade Visual Dinâmica e Seção Técnica...");

  const richTechnicalData: StructuredReportData = {
    title: "Falha de Arraste em Lote no Módulo de Documentos",
    subtitle: "Trynux Process | Escritório Ramos & Associados",
    date: "24/10/2026",
    department: "Contencioso Cível | Ramos & Associados",
    participants: "Carla Silveira (Operação), Marcos Felipe (Suporte N3)",
    platformAnalyzed: "Trynux Process",
    routeEnvironment: "/processos/[id]/documentos (Listagem com Seleção Múltipla)",
    documentNature: "Relato de QA e Investigação Técnica",
    executiveSummary:
      "Durante a rotina de triagem documental no Trynux Process, a operadora selecionou múltiplos anexos via checkbox para movimentação em lote para a pasta 'Contestações'. Ao arrastar o bloco de itens, apenas o primeiro elemento sobre o qual o cursor iniciou o evento drag foi transferido, mantendo os demais selecionados porém órfãos de persistência no backend.",
    currentBehavior:
      "Ao selecionar 5 documentos e arrastar para a pasta de destino, apenas 1 item é movido. O payload enviado na requisição PUT /api/documents/move contém apenas o ID unitário clicado ('doc-101'), ignorando os demais documentos marcados.",
    expectedBehavior:
      "Todos os documentos marcados na seleção ativa devem compor o array de IDs transferidos no evento onDragStart ('[doc-101, doc-102, doc-103, doc-104, doc-105]') e ser movidos atomicamente para a pasta destino.",
    evidenceCaptions: [
      {
        filename: "selecao-multipla-documentos.png",
        caption: "1. Cinco documentos marcados com checkbox ativo na listagem",
      },
      {
        filename: "arraste-incompleto-pasta.png",
        caption: "2. Soltura na pasta destino transferindo apenas o primeiro documento",
      },
    ],
    isTechnicalReport: true,
    investigativeNotice:
      "AVISO DE CONTEXTO INVESTIGATIVO: As hipóteses e o modelo de correção abaixo representam diagnósticos técnicos preliminares gerados a partir do rastreio de telemetria e análise de DOM, servindo de diretriz para os engenheiros responsáveis pelo módulo de Documentos.",
    diagnosticHypothesis: {
      topic: "Desconexão entre Estado Global de Seleção e DataTransfer no Drag and Drop",
      paragraphs: [
        "A análise preliminar do componente DocumentListView indica que o manipulador handleDragStart consome exclusivamente o parâmetro item.id passado pelo nó DOM alvo do evento onDragStart, em vez de reconciliar com a lista de seleção global selectedDocumentIds.",
        "Como consequência, a camada de transporte HTML5 Drag and Drop serializa apenas o registro unitário subjacente ao ponteiro do mouse, descartando os itens marcados via checkbox e induzindo o backend a executar uma alteração atômica incompleta.",
      ],
    },
    logicalDiagram: {
      title: "GARGALO LÓGICO IDENTIFICADO: DIVERGÊNCIA ENTRE ESTADO E EVENTO",
      leftBoxTitle: "ESTADO GLOBAL (Checkbox)",
      leftBoxContent: "selectedDocumentIds: ['doc-101', 'doc-102', 'doc-103'] (3 itens)",
      operator: "≠",
      rightBoxTitle: "EVENTO ON_DRAG (DataTransfer)",
      rightBoxContent: "payload.data: { id: 'doc-101' } (Apenas 1 item unitário)",
    },
    codeSuggestion: {
      language: "JavaScript / React",
      title: "Reconciliação de IDs Selecionados no handleDragStart",
      code: `const handleDragStart = (e, item) => {
  const isTargetSelected = selectedDocumentIds.includes(item.id);
  const idsToTransfer = isTargetSelected
    ? selectedDocumentIds
    : [item.id];

  e.dataTransfer.setData("application/json", JSON.stringify({
    documentIds: idsToTransfer,
    sourceFolderId: currentFolderId
  }));
  e.dataTransfer.effectAllowed = "move";
};`,
      explanation:
        "Garante que se o item arrastado pertencer à seleção em lote atual, todo o conjunto de IDs selecionados é propagado no payload.",
    },
    investigationGuidelines: [
      "Inspecionar o hook useDocumentSelection no repositório frontend do Trynux Process.",
      "Verificar se o endpoint PUT /api/documents/batch-move suporta transação atômica com rollback.",
      "Adicionar teste end-to-end com Playwright validando drag-and-drop de múltiplos elementos selecionados.",
    ],
    transcript: [
      {
        speaker: "Carla Silveira",
        role: "Operação Ramos & Associados",
        timestamp: "00:42",
        text: "Eu selecionei os cinco comprovantes, arrastei pra pasta de Contestações e só foi um. Os outros quatro continuaram na raiz como se nada tivesse acontecido.",
      },
      {
        speaker: "Marcos Felipe",
        role: "Suporte N3",
        timestamp: "01:05",
        text: "Entendido Carla. Verificamos na chamada que o clique inicial capturou apenas o primeiro arquivo no drag event. Vou abrir o relato de QA e encaminhar aos desenvolvedores.",
      },
    ],
  };

  const richTechnicalContext: WorkLogContext = {
    title: "Falha de Arraste em Lote no Módulo de Documentos",
    requester: "Carla Silveira (Operação)",
    clientOrOffice: "Ramos & Associados",
    reportedProblem: "Ao selecionar múltiplos documentos e arrastar para outra pasta, apenas um documento é movido.",
    actionTaken: "Realizada reprodução do erro em ambiente homologado e gerado relato técnico com código de correção.",
    status: "Em Investigação",
    technicalAction: true,
    implementation: false,
    platform: "Trynux Process",
    authorName: "Marcos Felipe",
    createdAt: "2026-10-24T14:30:00.000Z",
    tagColor: "#f59e0b",
  };

  const testPdfKey1 = await generateReportPdf({
    workLogId: "test-qa-001",
    data: richTechnicalData,
    context: richTechnicalContext,
    imageBuffers: [
      { filename: "selecao-multipla-documentos.png", buffer: samplePngBuffer },
      { filename: "arraste-incompleto-pasta.png", buffer: samplePngBuffer },
    ],
  });

  assert(typeof testPdfKey1 === "string" && testPdfKey1.endsWith(".pdf"), "Retorno é uma chave de PDF válida");
  const localPdfPath1 = path.join(process.cwd(), testPdfKey1);
  assert(fs.existsSync(localPdfPath1), `Arquivo PDF gerado em disco: ${localPdfPath1}`);

  const pdfBuffer1 = fs.readFileSync(localPdfPath1);
  assert(pdfBuffer1.length > 5000, `PDF possui tamanho adequado (> 5KB): ${pdfBuffer1.length} bytes`);
  assert(pdfBuffer1.subarray(0, 5).toString() === "%PDF-", "Arquivo possui cabeçalho válido do PDFKit (%PDF-)");

  // Conta as páginas procurando por "/Type /Page"
  const pdfString1 = pdfBuffer1.toString("binary");
  const pageMatches1 = pdfString1.match(/\/Type\s*\/Page\b/g);
  const pageCount1 = pageMatches1 ? pageMatches1.length : 0;
  console.log(`✓ Relatório técnico completo compilado com ${pageCount1} página(s)`);
  assert(pageCount1 >= 2, "Relatório rico e completo gerou múltiplas páginas sem clipping");

  // -------------------------------------------------------------
  // TESTE 2: Resiliência contra Imagens Corrompidas ou Ausentes
  // -------------------------------------------------------------
  console.log("\n[2] Testando resiliência contra imagens ausentes ou corrompidas (Graceful Fallback)...");

  const corruptImageBuffer = Buffer.from("THIS_IS_NOT_A_VALID_IMAGE_BUFFER");
  const fallbackPdfKey = await generateReportPdf({
    workLogId: "test-fallback-002",
    data: {
      ...richTechnicalData,
      title: "Teste de Resiliência de Imagens",
      evidenceCaptions: [
        { filename: "imagem-corrompida.png", caption: "Tentativa de exibição de buffer corrompido" },
        { filename: "imagem-inexistente.png", caption: "Tentativa de exibição de imagem não localizada" },
      ],
    },
    context: richTechnicalContext,
    imageBuffers: [
      { filename: "imagem-corrompida.png", buffer: corruptImageBuffer },
    ],
  });

  assert(typeof fallbackPdfKey === "string", "Geração de PDF não travou com imagem corrompida/ausente");
  const fallbackPath = path.join(process.cwd(), fallbackPdfKey);
  assert(fs.existsSync(fallbackPath), "PDF com fallback foi gerado com sucesso no disco");

  // -------------------------------------------------------------
  // TESTE 3: Relatório Simples Sem Ação Técnica (Retrocompatibilidade)
  // -------------------------------------------------------------
  console.log("\n[3] Testando retrocompatibilidade com Atendimento Simples (sem código, sem diagrama)...");

  const simpleData: StructuredReportData = {
    title: "Dúvida sobre Emissão de Boletos",
    department: "Financeiro | Silva & Santos",
    participants: "Amanda (Financeiro), Marcos (Suporte)",
    platformAnalyzed: "HubSupport Finance",
    executiveSummary:
      "A usuária solicitou esclarecimentos a respeito da data de vencimento configurada para os boletos gerados via integração bancária.",
    currentBehavior: "Dúvida operacional sanada durante o contato telefônico.",
    expectedBehavior: "Fluxo regular de geração mantido de acordo com as regras de faturamento.",
    isTechnicalReport: false,
    referrals: "Nenhum encaminhamento técnico pendente.",
  };

  const simpleContext: WorkLogContext = {
    title: "Dúvida sobre Emissão de Boletos",
    requester: "Amanda (Financeiro)",
    clientOrOffice: "Silva & Santos",
    reportedProblem: "Dúvida sobre vencimento de boletos.",
    actionTaken: "Explicado como ajustar a data padrão de vencimento.",
    status: "Solucionado",
    technicalAction: false,
    implementation: false,
    platform: "HubSupport Finance",
    authorName: "Marcos Felipe",
    createdAt: new Date(),
    tagColor: "#10b981",
  };

  const simplePdfKey = await generateReportPdf({
    workLogId: "test-simple-003",
    data: simpleData,
    context: simpleContext,
  });

  assert(typeof simplePdfKey === "string", "Relatório simples compilado com sucesso");
  const simplePath = path.join(process.cwd(), simplePdfKey);
  assert(fs.existsSync(simplePath), "PDF simples gravado em disco");

  console.log("\n=======================================================");
  console.log("🎉 TODOS OS TESTES DO NOVO GERADOR DE PDF PASSARAM!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Erro fatal durante a execução dos testes:", err);
  process.exit(1);
});
