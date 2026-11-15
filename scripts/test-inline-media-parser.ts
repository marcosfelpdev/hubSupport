import {
  parseEditorDomToInterleaved,
  formatMediaTag,
  generateMediaId,
  createAttachedMediaItem,
  AttachedMediaItem,
  InterleavedBlock,
} from "../src/lib/inline-media-parser";

// Mock minimal DOM for Node.js test execution
class MockNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: MockNode[];
  parentNode: MockNode | null = null;
  attributes: Map<string, string>;

  constructor(nodeType: number, nodeName: string, textContent: string | null = null) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.textContent = textContent;
    this.childNodes = [];
    this.attributes = new Map();
  }

  appendChild(child: MockNode): MockNode {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) || null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  get dataset(): Record<string, string> {
    const data: Record<string, string> = {};
    for (const [key, value] of this.attributes.entries()) {
      if (key.startsWith("data-")) {
        const camel = key.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        data[camel] = value;
      }
    }
    return data;
  }
}

function createText(text: string): MockNode {
  return new MockNode(3 /* TEXT_NODE */, "#text", text);
}

function createElement(tag: string, attrs?: Record<string, string>, children?: MockNode[]): MockNode {
  const el = new MockNode(1 /* ELEMENT_NODE */, tag.toUpperCase());
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
  }
  if (children) {
    for (const child of children) {
      el.appendChild(child);
    }
  }
  return el;
}

function createMediaChip(mediaId: string, filename?: string, mimeType?: string): MockNode {
  const chip = createElement("span", {
    "contenteditable": "false",
    "data-media-id": mediaId,
    ...(filename ? { "data-filename": filename } : {}),
    ...(mimeType ? { "data-mimetype": mimeType } : {}),
  });
  // Children inside chip should NOT be parsed as text
  chip.appendChild(createElement("img", { src: "blob:..." }));
  chip.appendChild(createElement("span", {}, [createText(filename || "media")]));
  chip.appendChild(createElement("button", { "data-action": "remove-chip" }, [createText("×")]));
  return chip;
}

async function runTests() {
  console.log("🧪 Iniciando testes de unidade para inline-media-parser...");
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

  // Preparação de mediaMap
  const mediaMap = new Map<string, AttachedMediaItem>();

  const item1: AttachedMediaItem = {
    id: "med_img_01",
    file: new File([""], "screenshot.png", { type: "image/png" }),
    name: "screenshot.png",
    size: 1024,
    mimeType: "image/png",
    previewUrl: "blob:mock-1",
  };
  mediaMap.set(item1.id, item1);

  const item2: AttachedMediaItem = {
    id: "med_doc_02",
    file: new File([""], "relatorio.pdf", { type: "application/pdf" }),
    name: "relatorio.pdf",
    size: 2048,
    mimeType: "application/pdf",
    previewUrl: "blob:mock-2",
  };
  mediaMap.set(item2.id, item2);

  // Teste 1: Texto antes, chip de imagem, texto no meio, chip de documento, texto final
  {
    console.log("\n📋 Teste 1: Texto e mídias intercalados em linha única");
    const container = createElement("div", {}, [
      createText("Problema inicial: "),
      createMediaChip(item1.id),
      createText(" continua aqui com documento "),
      createMediaChip(item2.id),
      createText(" e conclusão do atendimento."),
    ]);

    const result = parseEditorDomToInterleaved(container as any, mediaMap);

    assert(
      result.plainText ===
        "Problema inicial: [Imagem: screenshot.png] continua aqui com documento [Arquivo: relatorio.pdf] e conclusão do atendimento.",
      "plainText formatado corretamente com tags [Imagem] e [Arquivo]"
    );
    assert(result.interleaved.length === 5, "interleaved possui 5 blocos");
    assert(result.interleaved[0].type === "text" && result.interleaved[0].content === "Problema inicial: ", "Bloco 0 é texto");
    assert(result.interleaved[1].type === "media" && result.interleaved[1].mediaId === item1.id, "Bloco 1 é media item1");
    assert(result.interleaved[2].type === "text" && result.interleaved[2].content === " continua aqui com documento ", "Bloco 2 é texto meio");
    assert(result.interleaved[3].type === "media" && result.interleaved[3].mediaId === item2.id, "Bloco 3 é media item2");
    assert(result.interleaved[4].type === "text" && result.interleaved[4].content === " e conclusão do atendimento.", "Bloco 4 é texto final");
    assert(result.insertedMediaIds.has(item1.id) && result.insertedMediaIds.has(item2.id), "insertedMediaIds contém ambos os IDs");
  }

  // Teste 2: Múltiplas linhas com <div>, <p> e <br>
  {
    console.log("\n📋 Teste 2: Quebras de linha estruturadas com <div>, <p> e <br>");
    const container = createElement("div", {}, [
      createElement("div", {}, [createText("Linha 1 de introdução")]),
      createElement("div", {}, [createText("Linha 2 com "), createMediaChip(item1.id)]),
      createElement("p", {}, [createText("Parágrafo 3 com linha quebrada"), createElement("br"), createText("após o br")]),
    ]);

    const result = parseEditorDomToInterleaved(container as any, mediaMap);

    const expectedText =
      "Linha 1 de introdução\nLinha 2 com [Imagem: screenshot.png]\nParágrafo 3 com linha quebrada\napós o br";
    assert(result.plainText === expectedText, `plainText preserva quebras de linha:\n--- Recebido:\n${result.plainText}\n--- Esperado:\n${expectedText}`);
    assert(result.insertedMediaIds.has(item1.id), "insertedMediaIds contém item1");
  }

  // Teste 3: Entrada vazia e normalização de espaços em branco
  {
    console.log("\n📋 Teste 3: Entrada vazia e nós com apenas <br>");
    const container1 = createElement("div", {}, []);
    const result1 = parseEditorDomToInterleaved(container1 as any, mediaMap);
    assert(result1.plainText === "" && result1.interleaved.length === 0, "Container vazio resulta em texto e interleaved vazios");

    const container2 = createElement("div", {}, [
      createElement("div", {}, [createElement("br")]),
    ]);
    const result2 = parseEditorDomToInterleaved(container2 as any, mediaMap);
    assert(result2.plainText === "" && result2.interleaved.length === 0, "Container com apenas <div><br></div> normaliza para vazio");
  }

  // Teste 4: Fallback de mídia não encontrada no mediaMap mas com atributos no DOM
  {
    console.log("\n📋 Teste 4: Chip com atributos no DOM e sem mediaMap");
    const container = createElement("div", {}, [
      createText("Veja o vídeo: "),
      createMediaChip("med_video_99", "gravacao.mp4", "video/mp4"),
    ]);

    const result = parseEditorDomToInterleaved(container as any, new Map());
    assert(
      result.plainText === "Veja o vídeo: [Vídeo: gravacao.mp4]",
      "Tag [Vídeo: gravacao.mp4] gerada via fallback de atributos"
    );
    assert(result.interleaved.length === 2, "interleaved possui 2 blocos");
    assert(result.interleaved[1].filename === "gravacao.mp4", "filename obtido do fallback");
  }

  // Teste 5: Chips adjacentes sem texto no meio
  {
    console.log("\n📋 Teste 5: Chips de mídia adjacentes sem texto intermediário");
    const container = createElement("div", {}, [
      createText("Fotos: "),
      createMediaChip(item1.id),
      createMediaChip(item2.id),
      createText(" fim."),
    ]);

    const result = parseEditorDomToInterleaved(container as any, mediaMap);
    assert(result.interleaved.length === 4, "4 blocos: texto, media, media, texto");
    assert(result.interleaved[1].type === "media" && result.interleaved[2].type === "media", "Dois blocos de mídia consecutivos preservados");
  }

  // Teste 6: Helpers formatMediaTag e generateMediaId
  {
    console.log("\n📋 Teste 6: Helpers formatMediaTag e generateMediaId");
    assert(formatMediaTag("foto.png", "image/png") === "[Imagem: foto.png]", "formatMediaTag image");
    assert(formatMediaTag("video.mp4", "video/mp4") === "[Vídeo: video.mp4]", "formatMediaTag video");
    assert(formatMediaTag("audio.mp3", "audio/mpeg") === "[Áudio: audio.mp3]", "formatMediaTag audio");
    assert(formatMediaTag("dados.xlsx", "application/vnd.ms-excel") === "[Arquivo: dados.xlsx]", "formatMediaTag document");

    const id1 = generateMediaId();
    const id2 = generateMediaId();
    assert(id1.startsWith("media_") && id1 !== id2, "generateMediaId gera IDs únicos com prefixo media_");
  }

  console.log(`\n========================================`);
  console.log(`Resumo dos Testes: ${passed} passaram, ${failed} falharam`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erro fatal na execução dos testes:", err);
  process.exit(1);
});
