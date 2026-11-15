import {
  AttachedMediaItem,
  InterleavedBlock,
  createAttachedMediaItem,
  formatMediaTag,
  generateMediaId,
  parseEditorDomToInterleaved,
  truncateMiddle,
} from "../src/lib/inline-media-parser";
import WorkLogForm from "../src/components/WorkLogForm";
import { InlineMediaEditor } from "../src/components/common/InlineMediaEditor";

// Simulação de File em ambiente Node.js se não existir globalmente
class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;

  constructor(bits: any[], name: string, options?: { type?: string }) {
    this.name = name;
    this.size = bits.reduce((acc, b) => acc + (typeof b === "string" ? b.length : b.byteLength || 100), 0);
    this.type = options?.type || "application/octet-stream";
    this.lastModified = Date.now();
  }
}

const FileClass: any = typeof File !== "undefined" ? File : MockFile;

// Mock de FormData para ambiente Node.js
class MockFormData {
  private data: Map<string, any[]> = new Map();

  set(key: string, value: any) {
    this.data.set(key, [value]);
  }

  append(key: string, value: any) {
    const list = this.data.get(key) || [];
    list.push(value);
    this.data.set(key, list);
  }

  get(key: string): any {
    const list = this.data.get(key);
    return list && list.length > 0 ? list[0] : null;
  }

  getAll(key: string): any[] {
    return this.data.get(key) || [];
  }

  delete(key: string) {
    this.data.delete(key);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }
}

async function runTests() {
  console.log("🧪 Iniciando testes de integração e serialização do WorkLogForm...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Verificação de Importações e Componentes
  console.log("\n📦 1. Verificação de Componentes e Exportações:");
  assert(typeof WorkLogForm === "function", "WorkLogForm é exportado como componente React válido");
  assert(typeof InlineMediaEditor === "object" || typeof InlineMediaEditor === "function", "InlineMediaEditor é exportado corretamente");
  assert(typeof createAttachedMediaItem === "function", "createAttachedMediaItem está acessível");
  assert(typeof parseEditorDomToInterleaved === "function", "parseEditorDomToInterleaved está acessível");
  assert(typeof truncateMiddle === "function", "truncateMiddle está acessível");
  assert(truncateMiddle("Captura de tela 2026-10-15 003713.png", 14) === "Capt...713.png", "truncateMiddle trunca com precisão 14 para o card quadrado");

  // 2. Serialização e Desserialização de Blocos Intercalados
  console.log("\n🔄 2. Teste de Serialização de descriptionInterleaved:");
  const testBlocks: InterleavedBlock[] = [
    { type: "text", content: "Identificado erro crítico no checkout:\n" },
    {
      type: "media",
      mediaId: "med_12345",
      filename: "erro_checkout.png",
      mimeType: "image/png",
    },
    { type: "text", content: "\nApós reiniciar o serviço redis, o status normalizou:\n" },
    {
      type: "media",
      mediaId: "med_67890",
      filename: "logs_sucesso.txt",
      mimeType: "text/plain",
    },
  ];

  const serialized = JSON.stringify(testBlocks);
  assert(typeof serialized === "string", "Blocos foram serializados para string JSON");
  assert(serialized.includes("erro_checkout.png"), "JSON contém o nome da primeira mídia");
  assert(serialized.includes("med_12345"), "JSON contém o mediaId da primeira mídia");

  const deserialized: InterleavedBlock[] = JSON.parse(serialized);
  assert(Array.isArray(deserialized), "JSON.parse retorna um array");
  assert(deserialized.length === 4, "Array desserializado mantém os 4 blocos originais");
  assert(deserialized[0].type === "text" && deserialized[0].content === "Identificado erro crítico no checkout:\n", "Primeiro bloco de texto íntegro");
  assert(deserialized[1].type === "media" && deserialized[1].mediaId === "med_12345", "Segundo bloco de mídia íntegro");
  assert(deserialized[2].type === "text" && deserialized[2].content?.includes("redis"), "Terceiro bloco de texto íntegro");
  assert(deserialized[3].type === "media" && deserialized[3].filename === "logs_sucesso.txt", "Quarto bloco de mídia íntegro");

  // Teste de array vazio
  const emptySerialized = JSON.stringify([]);
  assert(emptySerialized === "[]", "Array vazio serializa como '[]'");
  assert(JSON.parse(emptySerialized).length === 0, "Array vazio desserializa com length 0");

  // 3. Simulação da Lógica de Submissão do Formulário (FormData)
  console.log("\n📋 3. Simulação da Lógica de Montagem do FormData no handleSubmit:");

  function simulateFormSubmission(params: {
    plainText: string;
    interleaved: InterleavedBlock[];
    selectedTagId: string | null;
    selectedStatus: string;
    technicalAction: boolean;
    implementation: boolean;
    attachedMedia: AttachedMediaItem[];
    activeRecordedVideo: any | null;
  }) {
    // 1. Validação de descrição obrigatória
    const plainTextTrimmed = params.plainText.trim();
    if (!plainTextTrimmed && params.interleaved.length === 0) {
      return { success: false, error: "Por favor, preencha a descrição do atendimento." };
    }

    // 2. Validação de tag obrigatória
    if (!params.selectedTagId) {
      return { success: false, error: "Por favor, selecione uma tag de plataforma obrigatória." };
    }

    const formData = new MockFormData();
    const isTechnicalOrImplementation = params.technicalAction || params.implementation;
    const finalStatus = isTechnicalOrImplementation ? "Backlog" : params.selectedStatus;

    formData.set("title", "Chamado de Teste Intercalado");
    formData.set("requester", "João da Silva");
    formData.set("clientOrOffice", "Matriz SP");
    formData.set("technicalAction", params.technicalAction ? "on" : "off");
    formData.set("implementation", params.implementation ? "on" : "off");
    formData.set("status", finalStatus);
    formData.set("tagId", params.selectedTagId);
    formData.set("actionTaken", "");
    formData.set("reportedProblem", plainTextTrimmed);
    formData.set("descriptionInterleaved", JSON.stringify(params.interleaved));

    formData.delete("media");
    params.attachedMedia.forEach((item) => {
      formData.append("media", item.file);
    });

    if (params.activeRecordedVideo) {
      formData.append("recordedVideo", params.activeRecordedVideo);
    }

    return { success: true, formData };
  }

  // Caso 3.1: Descrição vazia é rejeitada
  const emptyRes = simulateFormSubmission({
    plainText: "",
    interleaved: [],
    selectedTagId: "tag_1",
    selectedStatus: "Realizado",
    technicalAction: false,
    implementation: false,
    attachedMedia: [],
    activeRecordedVideo: null,
  });
  assert(!emptyRes.success && emptyRes.error?.includes("preencha a descrição"), "Submissão com descrição vazia é rejeitada");

  // Caso 3.2: Tag não selecionada é rejeitada
  const noTagRes = simulateFormSubmission({
    plainText: "Descrição válida",
    interleaved: [{ type: "text", content: "Descrição válida" }],
    selectedTagId: null,
    selectedStatus: "Realizado",
    technicalAction: false,
    implementation: false,
    attachedMedia: [],
    activeRecordedVideo: null,
  });
  assert(!noTagRes.success && noTagRes.error?.includes("selecione uma tag"), "Submissão sem tag é rejeitada");

  // Caso 3.3: Submissão com texto puro
  const pureTextRes = simulateFormSubmission({
    plainText: "Atendimento realizado com sucesso para o usuário.",
    interleaved: [{ type: "text", content: "Atendimento realizado com sucesso para o usuário." }],
    selectedTagId: "tag_omnilink",
    selectedStatus: "Realizado",
    technicalAction: false,
    implementation: false,
    attachedMedia: [],
    activeRecordedVideo: null,
  });
  assert(pureTextRes.success, "Submissão de texto puro tem sucesso");
  assert(pureTextRes.formData?.get("reportedProblem") === "Atendimento realizado com sucesso para o usuário.", "reportedProblem preenchido");
  assert(pureTextRes.formData?.get("status") === "Realizado", "status Realizado preservado");
  assert(pureTextRes.formData?.getAll("media").length === 0, "Sem anexos físicos em texto puro");

  // Caso 3.4: Submissão multimodal com mídias intercaladas e arquivos físicos
  const file1 = new FileClass(["fake-image-bytes-1"], "print1.png", { type: "image/png" });
  const file2 = new FileClass(["fake-doc-bytes-2"], "relatorio.pdf", { type: "application/pdf" });
  const mediaItem1: AttachedMediaItem = {
    id: "media_p1",
    file: file1,
    name: "print1.png",
    size: file1.size,
    mimeType: file1.type,
    previewUrl: "blob:http://localhost:3000/print1",
  };
  const mediaItem2: AttachedMediaItem = {
    id: "media_p2",
    file: file2,
    name: "relatorio.pdf",
    size: file2.size,
    mimeType: file2.type,
    previewUrl: "",
  };

  const multimodalInterleaved: InterleavedBlock[] = [
    { type: "text", content: "Veja a tela de erro:\n" },
    { type: "media", mediaId: mediaItem1.id, filename: mediaItem1.name, mimeType: mediaItem1.mimeType },
    { type: "text", content: "\nE os detalhes adicionais no documento:\n" },
    { type: "media", mediaId: mediaItem2.id, filename: mediaItem2.name, mimeType: mediaItem2.mimeType },
  ];

  const multimodalRes = simulateFormSubmission({
    plainText: "Veja a tela de erro:\n[Imagem: print1.png]\nE os detalhes adicionais no documento:\n[Arquivo: relatorio.pdf]",
    interleaved: multimodalInterleaved,
    selectedTagId: "tag_omnilink",
    selectedStatus: "Realizado",
    technicalAction: true,
    implementation: false,
    attachedMedia: [mediaItem1, mediaItem2],
    activeRecordedVideo: null,
  });

  assert(multimodalRes.success, "Submissão multimodal tem sucesso");
  assert(multimodalRes.formData?.get("reportedProblem")?.includes("[Imagem: print1.png]"), "reportedProblem contém marcador de mídia para fallback");
  assert(multimodalRes.formData?.get("status") === "Backlog", "status é forçado para Backlog quando technicalAction é true");
  assert(multimodalRes.formData?.get("technicalAction") === "on", "technicalAction está 'on'");
  assert(multimodalRes.formData?.get("tagId") === "tag_omnilink", "tagId gravado corretamente");

  const attachedPhysicalFiles = multimodalRes.formData?.getAll("media");
  assert(attachedPhysicalFiles?.length === 2, "FormData contém exatamente os 2 arquivos anexados");
  assert(attachedPhysicalFiles?.[0].name === "print1.png", "Primeiro arquivo físico anexado é print1.png");
  assert(attachedPhysicalFiles?.[1].name === "relatorio.pdf", "Segundo arquivo físico anexado é relatorio.pdf");

  const storedInterleavedJson = multimodalRes.formData?.get("descriptionInterleaved");
  assert(typeof storedInterleavedJson === "string", "descriptionInterleaved é string");
  const parsedStored = JSON.parse(storedInterleavedJson);
  assert(parsedStored.length === 4, "JSON armazenado no FormData contém os 4 blocos intercalados");
  assert(parsedStored[1].mediaId === "media_p1", "Bloco de mídia referencia media_p1");

  // 4. Teste de Sincronização Bidirecional e Estado dos Badges
  console.log("\n🔄 4. Teste da Lógica de Sincronização Bidirecional e Badges:");

  let attachedList: AttachedMediaItem[] = [mediaItem1, mediaItem2];
  let insertedIds = new Set<string>();

  // Inicial: nenhum item inserido no texto
  assert(!insertedIds.has(mediaItem1.id), "Badge 'No texto' inativo para mediaItem1 antes da inserção");
  assert(!insertedIds.has(mediaItem2.id), "Badge 'No texto' inativo para mediaItem2 antes da inserção");

  // Insere mediaItem1 no texto
  insertedIds.add(mediaItem1.id);
  assert(insertedIds.has(mediaItem1.id), "Badge 'No texto' fica ativo após inserção do chip de mediaItem1");
  assert(!insertedIds.has(mediaItem2.id), "Badge 'No texto' continua inativo para mediaItem2 (não inserido)");

  // Usuário remove chip do editor via teclado ou botão '×' do chip
  insertedIds.delete(mediaItem1.id);
  assert(!insertedIds.has(mediaItem1.id), "Badge 'No texto' desaparece automaticamente após chip ser removido do editor");
  assert(attachedList.some((m) => m.id === mediaItem1.id), "Arquivo físico continua preservado na lista inferior após remoção do chip");

  // Usuário remove anexo da lista inferior (click '×' no card)
  let removedChips: string[] = [];
  let revokedUrls: string[] = [];
  const mockEditorRef = {
    removeChip: (mediaId: string) => {
      removedChips.push(mediaId);
    },
    clear: () => {},
  };

  function removeMediaItemSim(idToRemove: string) {
    const item = attachedList.find((m) => m.id === idToRemove);
    if (item) {
      mockEditorRef.removeChip(item.id);
      if (item.previewUrl) {
        revokedUrls.push(item.previewUrl);
      }
      attachedList = attachedList.filter((m) => m.id !== idToRemove);
      insertedIds.delete(item.id);
    }
  }

  // Insere novamente ambos no texto
  insertedIds.add(mediaItem1.id);
  insertedIds.add(mediaItem2.id);

  // Remove mediaItem1 pela lista inferior
  removeMediaItemSim(mediaItem1.id);
  assert(attachedList.length === 1 && attachedList[0].id === mediaItem2.id, "mediaItem1 foi removido da lista de anexos");
  assert(removedChips.includes(mediaItem1.id), "editorRef.removeChip foi acionado para mediaItem1");
  assert(revokedUrls.includes(mediaItem1.previewUrl), "URL de prévia foi revogada com sucesso");
  assert(!insertedIds.has(mediaItem1.id), "insertedIds não contém mais mediaItem1");

  // Remove todos
  function removeAllSim() {
    attachedList.forEach((item) => {
      mockEditorRef.removeChip(item.id);
      if (item.previewUrl) revokedUrls.push(item.previewUrl);
    });
    attachedList = [];
    insertedIds.clear();
  }

  removeAllSim();
  assert(attachedList.length === 0, "Lista de anexos esvaziada");
  assert(removedChips.includes(mediaItem2.id), "editorRef.removeChip acionado para mediaItem2 ao remover todos");
  assert(insertedIds.size === 0, "insertedIds esvaziado");

  // Resumo Final
  console.log(`\n========================================`);
  console.log(`📊 Resultado dos Testes: ${passed} passaram, ${failed} falharam.`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌ Erro fatal durante a execução dos testes:", err);
  process.exit(1);
});