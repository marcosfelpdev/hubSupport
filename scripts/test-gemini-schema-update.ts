import {
  REPORT_SCHEMA,
  StructuredReportData,
  WorkLogContext,
  buildFinalStructuredReport,
  SafeReportContext,
} from "../src/lib/gemini";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

async function runTests() {
  console.log("=== Iniciando Teste de Validação do Schema e Tipos do Gemini ===\n");

  // 1. Validação da existência e tipagem dos novos campos no REPORT_SCHEMA
  console.log("[1] Validando propriedades e tipos no REPORT_SCHEMA...");
  const properties = (REPORT_SCHEMA as any).properties;
  assert(!!properties, "REPORT_SCHEMA possui nó 'properties'");

  // routeEnvironment
  assert(
    properties.routeEnvironment?.type === "string",
    "routeEnvironment está definido como string no schema"
  );

  // documentNature
  assert(
    properties.documentNature?.type === "string",
    "documentNature está definido como string no schema"
  );

  // currentBehavior & expectedBehavior
  assert(
    properties.currentBehavior?.type === "string",
    "currentBehavior está definido como string no schema"
  );
  assert(
    properties.expectedBehavior?.type === "string",
    "expectedBehavior está definido como string no schema"
  );

  // evidenceCaptions
  assert(
    properties.evidenceCaptions?.type === "array" &&
      properties.evidenceCaptions.items?.type === "object" &&
      properties.evidenceCaptions.items.properties?.filename?.type === "string" &&
      properties.evidenceCaptions.items.properties?.caption?.type === "string",
    "evidenceCaptions está definido como array de objetos { filename, caption } no schema"
  );

  // isTechnicalReport & investigativeNotice
  assert(
    properties.isTechnicalReport?.type === "boolean",
    "isTechnicalReport está definido como boolean no schema"
  );
  assert(
    properties.investigativeNotice?.type === "string",
    "investigativeNotice está definido como string no schema"
  );

  // diagnosticHypothesis
  assert(
    properties.diagnosticHypothesis?.type === "object" &&
      properties.diagnosticHypothesis.properties?.topic?.type === "string" &&
      properties.diagnosticHypothesis.properties?.paragraphs?.type === "array",
    "diagnosticHypothesis possui topic (string) e paragraphs (array) no schema"
  );

  // logicalDiagram
  const diagramProps = properties.logicalDiagram?.properties;
  assert(
    properties.logicalDiagram?.type === "object" &&
      diagramProps?.title?.type === "string" &&
      diagramProps?.leftBoxTitle?.type === "string" &&
      diagramProps?.leftBoxContent?.type === "string" &&
      diagramProps?.operator?.type === "string" &&
      diagramProps?.rightBoxTitle?.type === "string" &&
      diagramProps?.rightBoxContent?.type === "string",
    "logicalDiagram possui 6 campos chave (title, leftBoxTitle, leftBoxContent, operator, rightBoxTitle, rightBoxContent)"
  );

  // codeSuggestion
  const codeProps = properties.codeSuggestion?.properties;
  assert(
    properties.codeSuggestion?.type === "object" &&
      codeProps?.language?.type === "string" &&
      codeProps?.title?.type === "string" &&
      codeProps?.code?.type === "string" &&
      codeProps?.explanation?.type === "string",
    "codeSuggestion possui language, title, code e explanation no schema"
  );

  // investigationGuidelines
  assert(
    properties.investigationGuidelines?.type === "array" &&
      properties.investigationGuidelines.items?.type === "string",
    "investigationGuidelines está definido como array de string no schema"
  );

  console.log("\n[2] Validando instanciação dos Tipos TypeScript...");
  // Teste de instanciação de WorkLogContext com tagColor
  const testContext: WorkLogContext = {
    title: "Falha na sincronização do lote de documentos",
    requester: "Raynara Souza",
    clientOrOffice: "IEP Advogados Associados",
    reportedProblem: "Ao selecionar múltiplos documentos e arrastar para pasta, apenas o primeiro é movido.",
    actionTaken: "Inspecionado log de rede e verificado evento onDrag.",
    status: "Em andamento",
    technicalAction: true,
    implementation: false,
    platform: "Trynux Process",
    authorName: "Marcos Suporte",
    createdAt: new Date(),
    tagColor: "#f59e0b",
  };
  assert(testContext.tagColor === "#f59e0b", "WorkLogContext aceita e preserva tagColor");

  // Teste de instanciação de StructuredReportData completa
  const fullReportData: StructuredReportData = {
    title: "Falha na sincronização do lote de documentos",
    subtitle: "IEP Advogados Associados",
    department: "Cível Processual | IEP Advogados Associados",
    participants: "Raynara Souza (Operação), Marcos Suporte (Suporte)",
    platformAnalyzed: "Trynux Process",
    routeEnvironment: "Módulo de Documentos (Listagem)",
    documentNature: "Relato de QA e Investigação Técnica",
    executiveSummary: "Identificada anomalia no arraste de múltiplos documentos para pastas...",
    currentBehavior: "Ao arrastar múltiplos itens selecionados, apenas o item focado é persistido na pasta.",
    expectedBehavior: "Todos os itens selecionados no estado devem ser transmitidos no payload da mutação.",
    evidenceCaptions: [
      { filename: "evidencia_1.png", caption: "1. Dois documentos marcados com checkbox" },
      { filename: "evidencia_2.png", caption: "2. Apenas um item alocado na pasta de destino" },
    ],
    isTechnicalReport: true,
    investigativeNotice: "AVISO DE CONTEXTO INVESTIGATIVO: As hipóteses a seguir...",
    diagnosticHypothesis: {
      topic: "Divergência entre Estado Global de Seleção e Payload de Drag and Drop",
      paragraphs: [
        "O componente de lista mantém o array de IDs selecionados em seu estado interno.",
        "No entanto, o tratador onDragStart captura apenas o ID do elemento DOM diretamente clicado.",
      ],
    },
    logicalDiagram: {
      title: "Mapeamento do Gargalo Lógico",
      leftBoxTitle: "ESTADO GLOBAL [IDs]",
      leftBoxContent: "selectedIds: ['doc_1', 'doc_2']",
      operator: "≠",
      rightBoxTitle: "EVENTO ON_DRAG [Payload]",
      rightBoxContent: "dragData: { activeId: 'doc_1' }",
    },
    codeSuggestion: {
      language: "typescript",
      title: "Ajuste na Propagação do Payload do DragStart",
      code: "const payload = selectedIds.length > 0 ? selectedIds : [item.id];",
      explanation: "Verifica se há seleção ativa antes de atribuir o payload.",
    },
    investigationGuidelines: [
      "Auditar o hook useDocumentSelection no frontend.",
      "Verificar se a rota de mutação da API aceita array de IDs no body.",
    ],
  };
  assert(fullReportData.isTechnicalReport === true, "StructuredReportData aceita e valida modelo completo");

  console.log("\n[3] Validando Fallbacks e Normalização em buildFinalStructuredReport...");

  const safeCtx: SafeReportContext = {
    title: "Título Literal do Chamado",
    requester: "Carlos Operador",
    clientOrOffice: "Alpha Law",
    reportedProblem: "Erro ao gerar PDF",
    actionTaken: "Reiniciado serviço",
    status: "Realizado",
    technicalAction: true,
    implementation: false,
    platform: "ERP Jurídico",
    authorName: "Ana Atendente",
    createdAt: "15/11/2026",
    tagColor: "#10b981",
  };

  // Teste 3.1: IA retorna dados parciais sem campos técnicos -> fallbacks preservam e deduzem
  const partialFromGemini: Partial<StructuredReportData> = {
    executiveSummary: "Resumo executivo do atendimento.",
  };

  const processed = buildFinalStructuredReport(partialFromGemini, safeCtx, false);
  assert(processed.title === "Título Literal do Chamado", "Título literal do contexto é preservado sem numeração");
  assert(processed.documentNature === "Relato de QA e Investigação Técnica", "documentNature deduzido corretamente para technicalAction");
  assert(processed.isTechnicalReport === true, "isTechnicalReport assume true para technicalAction");
  assert(!!processed.investigativeNotice, "investigativeNotice padrão é fornecido para relatório técnico");
  assert(processed.expectedBehavior === undefined, "expectedBehavior é omitido quando a IA não envia (autocensura)");
  assert(processed.codeSuggestion === undefined, "codeSuggestion é omitido sem erros quando não aplicável");
  assert(processed.logicalDiagram === undefined, "logicalDiagram é omitido sem erros quando não aplicável");

  // Teste 3.2: Chamado comum (sem ação técnica nem implementação)
  const commonCtx: SafeReportContext = {
    ...safeCtx,
    technicalAction: false,
    implementation: false,
  };
  const processedCommon = buildFinalStructuredReport({}, commonCtx, false);
  assert(
    processedCommon.documentNature === "Relatório Técnico de Atendimento",
    "documentNature é 'Relatório Técnico de Atendimento' para chamado simples"
  );
  assert(processedCommon.isTechnicalReport === false, "isTechnicalReport é false para chamado simples");
  assert(processedCommon.investigativeNotice === undefined, "investigativeNotice é omitido para chamado simples");

  // Teste 3.3: Chamado de implementação
  const implCtx: SafeReportContext = {
    ...safeCtx,
    technicalAction: false,
    implementation: true,
  };
  const processedImpl = buildFinalStructuredReport({}, implCtx, false);
  assert(
    processedImpl.documentNature === "Especificação de Melhoria e Novas Features",
    "documentNature é 'Especificação de Melhoria e Novas Features' para implementação"
  );
  assert(processedImpl.isTechnicalReport === true, "isTechnicalReport é true para implementação");

  console.log("\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!");
}

runTests().catch((err) => {
  console.error("Erro inesperado no teste:", err);
  process.exit(1);
});
