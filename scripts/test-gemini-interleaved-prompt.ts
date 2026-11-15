import fs from "fs";
import path from "path";
import {
  buildInterleavedGeminiParts,
  WorkLogContext,
  isSupportedGeminiInlineMimeType,
  detectMimeType,
} from "../src/lib/gemini";

const FIXTURES_DIR = path.join(process.cwd(), "uploads", "test-gemini-fixtures");

function setupFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  // 1x1 transparent PNG buffer
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const pngBuffer = Buffer.from(pngBase64, "base64");

  fs.writeFileSync(path.join(FIXTURES_DIR, "tela1.png"), pngBuffer);
  fs.writeFileSync(path.join(FIXTURES_DIR, "tela2.png"), pngBuffer);
  fs.writeFileSync(path.join(FIXTURES_DIR, "extra.png"), pngBuffer);
  fs.writeFileSync(
    path.join(FIXTURES_DIR, "planilha.xlsx"),
    Buffer.from("fake-xlsx-binary-data")
  );
  fs.writeFileSync(
    path.join(FIXTURES_DIR, "contrato.docx"),
    Buffer.from("fake-docx-binary-data")
  );
  fs.writeFileSync(
    path.join(FIXTURES_DIR, "documento.pdf"),
    Buffer.from("%PDF-1.4 fake pdf data")
  );
}

function cleanupFixtures() {
  try {
    if (fs.existsSync(FIXTURES_DIR)) {
      fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("Aviso ao limpar fixtures de teste:", err);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("=== INICIANDO TESTES DO PIPELINE MULTIMODAL GEMINI AI ===\n");
  setupFixtures();

  try {
    // -------------------------------------------------------------------------
    // Test 1: Interleaved prompt generation: text -> image -> text -> image
    // -------------------------------------------------------------------------
    console.log("Test 1: Geração de prompt intercalado: text -> image -> text -> image");
    const test1Blocks = [
      { type: "text", content: "Primeiro relato do problema: " },
      {
        type: "media",
        filename: "tela1.png",
        storagePath: "uploads/test-gemini-fixtures/tela1.png",
        mimeType: "image/png",
      },
      { type: "text", content: " e em seguida ocorreu outro erro na tela: " },
      {
        type: "media",
        filename: "tela2.png",
        storagePath: "uploads/test-gemini-fixtures/tela2.png",
        mimeType: "image/png",
      },
    ];

    const test1MediaUrls = [
      "/uploads/test-gemini-fixtures/tela1.png",
      "/uploads/test-gemini-fixtures/tela2.png",
    ];

    const res1 = await buildInterleavedGeminiParts(
      JSON.stringify(test1Blocks),
      test1MediaUrls
    );

    assert(res1.hasInterleaved === true, "hasInterleaved deve ser true");
    assert(res1.interleavedParts.length === 4, `Esperado 4 partes, recebido ${res1.interleavedParts.length}`);
    
    // Parte 0: texto
    assert(
      "text" in res1.interleavedParts[0] &&
        res1.interleavedParts[0].text === "Primeiro relato do problema: ",
      "Parte 0 deve ser o primeiro texto"
    );

    // Parte 1: inlineData da imagem tela1.png
    assert(
      "inlineData" in res1.interleavedParts[1] &&
        res1.interleavedParts[1].inlineData.mimeType === "image/png" &&
        typeof res1.interleavedParts[1].inlineData.data === "string" &&
        res1.interleavedParts[1].inlineData.data.length > 0,
      "Parte 1 deve conter inlineData da tela1.png em base64"
    );

    // Parte 2: texto
    assert(
      "text" in res1.interleavedParts[2] &&
        res1.interleavedParts[2].text === " e em seguida ocorreu outro erro na tela: ",
      "Parte 2 deve ser o segundo texto"
    );

    // Parte 3: inlineData da imagem tela2.png
    assert(
      "inlineData" in res1.interleavedParts[3] &&
        res1.interleavedParts[3].inlineData.mimeType === "image/png" &&
        typeof res1.interleavedParts[3].inlineData.data === "string" &&
        res1.interleavedParts[3].inlineData.data.length > 0,
      "Parte 3 deve conter inlineData da tela2.png em base64"
    );

    assert(
      res1.complementaryParts.length === 0,
      "Não deve haver mídias complementares quando todas foram usadas no texto"
    );
    assert(res1.allParts.length === 4, "allParts deve conter exatamente as 4 partes");
    assert(res1.inlineImageParts.length === 2, "inlineImageParts deve conter 2 imagens");
    console.log("  [PASS] Test 1 passou com sucesso!\n");

    // -------------------------------------------------------------------------
    // Test 2: Handling of non-image files (e.g. Excel/Word) without throwing
    // -------------------------------------------------------------------------
    console.log("Test 2: Tratamento de arquivos não suportados em binário (Excel/Word) com marcadores textuais");
    const test2Blocks = [
      { type: "text", content: "Conforme análise dos dados na planilha " },
      {
        type: "media",
        filename: "planilha.xlsx",
        storagePath: "uploads/test-gemini-fixtures/planilha.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      { type: "text", content: " e no contrato " },
      {
        type: "media",
        filename: "contrato.docx",
        storagePath: "uploads/test-gemini-fixtures/contrato.docx",
      },
    ];

    const test2MediaUrls = [
      "/uploads/test-gemini-fixtures/planilha.xlsx",
      "/uploads/test-gemini-fixtures/contrato.docx",
    ];

    const res2 = await buildInterleavedGeminiParts(
      JSON.stringify(test2Blocks),
      test2MediaUrls
    );

    assert(res2.hasInterleaved === true, "hasInterleaved deve ser true");
    assert(res2.interleavedParts.length === 4, "Esperado 4 partes intercaladas");

    // Parte 1 deve ser um marcador textual para a planilha .xlsx (sem inlineData)
    assert(
      "text" in res2.interleavedParts[1] &&
        !("inlineData" in res2.interleavedParts[1]) &&
        res2.interleavedParts[1].text.includes("[Arquivo anexado no texto: planilha.xlsx]"),
      "Parte 1 deve ser marcador textual para planilha.xlsx"
    );

    // Parte 3 deve ser um marcador textual para o documento .docx (sem inlineData)
    assert(
      "text" in res2.interleavedParts[3] &&
        !("inlineData" in res2.interleavedParts[3]) &&
        res2.interleavedParts[3].text.includes("[Arquivo anexado no texto: contrato.docx]"),
      "Parte 3 deve ser marcador textual para contrato.docx"
    );

    // Nenhuma imagem inline gerada para arquivos não-imagem
    assert(res2.inlineImageParts.length === 0, "inlineImageParts deve ser vazio para Excel/Word");
    assert(
      res2.complementaryParts.length === 0,
      "Não deve duplicar em complementares os arquivos já tratados no texto"
    );
    console.log("  [PASS] Test 2 passou com sucesso!\n");

    // -------------------------------------------------------------------------
    // Test 3: Complementary media included when attachments exist outside the text
    // -------------------------------------------------------------------------
    console.log("Test 3: Mídias complementares incluídas quando anexos existem fora do texto");
    const test3Blocks = [
      { type: "text", content: "Problema demonstrado no print: " },
      {
        type: "media",
        filename: "tela1.png",
        storagePath: "uploads/test-gemini-fixtures/tela1.png",
        mimeType: "image/png",
      },
    ];

    const test3MediaUrls = [
      "/uploads/test-gemini-fixtures/tela1.png",
      "/uploads/test-gemini-fixtures/extra.png",
    ];

    const res3 = await buildInterleavedGeminiParts(
      JSON.stringify(test3Blocks),
      test3MediaUrls
    );

    assert(res3.hasInterleaved === true, "hasInterleaved deve ser true");
    assert(res3.interleavedParts.length === 2, "interleavedParts deve ter 2 itens (texto + tela1)");
    assert(res3.complementaryParts.length === 2, "complementaryParts deve ter cabeçalho + extra.png");

    // Cabeçalho de mídias complementares
    assert(
      "text" in res3.complementaryParts[0] &&
        res3.complementaryParts[0].text.includes("Mídias Complementares em Anexo"),
      "Cabeçalho de mídias complementares deve estar presente"
    );

    // Mídia complementar extra.png
    assert(
      "inlineData" in res3.complementaryParts[1] &&
        res3.complementaryParts[1].inlineData.mimeType === "image/png" &&
        res3.complementaryParts[1].inlineData.data.length > 0,
      "extra.png deve ser incluído em complementaryParts com base64"
    );

    // tela1.png não deve ser duplicado em complementaryParts
    assert(
      res3.usedMediaPaths.has("uploads/test-gemini-fixtures/tela1.png"),
      "tela1.png deve estar marcado em usedMediaPaths"
    );
    assert(
      res3.allParts.length === 4,
      `allParts deve conter 4 partes (2 intercaladas + 2 complementares), obtido ${res3.allParts.length}`
    );
    console.log("  [PASS] Test 3 passou com sucesso!\n");

    // -------------------------------------------------------------------------
    // Test 4: Backward compatibility when descriptionInterleaved is null / empty
    // -------------------------------------------------------------------------
    console.log("Test 4: Retrocompatibilidade quando descriptionInterleaved é nulo, vazio ou inválido");
    const test4MediaUrls = ["/uploads/test-gemini-fixtures/tela1.png"];

    const res4Null = await buildInterleavedGeminiParts(null, test4MediaUrls);
    assert(res4Null.hasInterleaved === false, "null deve retornar hasInterleaved: false");
    assert(res4Null.interleavedParts.length === 0, "interleavedParts deve ser vazio");
    assert(res4Null.complementaryParts.length === 0, "complementaryParts deve ser vazio");

    const res4Undef = await buildInterleavedGeminiParts(undefined, test4MediaUrls);
    assert(res4Undef.hasInterleaved === false, "undefined deve retornar hasInterleaved: false");

    const res4Empty = await buildInterleavedGeminiParts("", test4MediaUrls);
    assert(res4Empty.hasInterleaved === false, "string vazia deve retornar hasInterleaved: false");

    const res4Whitespace = await buildInterleavedGeminiParts("   ", test4MediaUrls);
    assert(res4Whitespace.hasInterleaved === false, "espaços em branco deve retornar hasInterleaved: false");

    const res4EmptyArray = await buildInterleavedGeminiParts("[]", test4MediaUrls);
    assert(res4EmptyArray.hasInterleaved === false, "array vazio '[]' deve retornar hasInterleaved: false");

    const res4InvalidJson = await buildInterleavedGeminiParts("{invalid json", test4MediaUrls);
    assert(res4InvalidJson.hasInterleaved === false, "JSON inválido deve retornar hasInterleaved: false sem lançar erro");
    console.log("  [PASS] Test 4 passou com sucesso!\n");

    // -------------------------------------------------------------------------
    // Test 5: Recording context with inline images
    // -------------------------------------------------------------------------
    console.log("Test 5: Contexto de gravação de tela com imagens inline da descrição");
    const contextWithVideoAndImages: WorkLogContext = {
      title: "Atendimento com Vídeo e Prints Inline",
      requester: "Raynara",
      clientOrOffice: "IEP Advogados",
      reportedProblem: "Erro gravado em vídeo e ilustrado por print inline",
      descriptionInterleaved: JSON.stringify([
        { type: "text", content: "Durante o atendimento gravamos a tela e capturamos este print do erro: " },
        {
          type: "media",
          filename: "tela1.png",
          storagePath: "uploads/test-gemini-fixtures/tela1.png",
          mimeType: "image/png",
        },
        { type: "text", content: " e mais este detalhe do cabeçalho: " },
        {
          type: "media",
          filename: "documento.pdf",
          storagePath: "uploads/test-gemini-fixtures/documento.pdf",
          mimeType: "application/pdf",
        },
      ]),
      actionTaken: "Ação de verificação realizada",
      status: "Realizado",
      technicalAction: true,
      implementation: false,
      authorName: "Marcos (Suporte)",
      createdAt: new Date(),
    };

    const res5 = await buildInterleavedGeminiParts(
      contextWithVideoAndImages.descriptionInterleaved,
      ["/uploads/test-gemini-fixtures/tela1.png", "/uploads/test-gemini-fixtures/documento.pdf"]
    );

    assert(res5.hasInterleaved === true, "hasInterleaved deve ser true");
    assert(res5.inlineImageParts.length === 2, `Esperado 2 partes binárias inline, obtido ${res5.inlineImageParts.length}`);
    assert(
      res5.inlineImageParts[0].inlineData.mimeType === "image/png",
      "Primeira imagem inline deve ter MIME image/png"
    );
    assert(
      res5.inlineImageParts[1].inlineData.mimeType === "application/pdf",
      "Segundo documento inline deve ter MIME application/pdf"
    );

    // Simula a composição do array `contents` em analyzeRecordingWithGemini
    const mockVideoPart = {
      fileData: {
        fileUri: "https://generativelanguage.googleapis.com/v1beta/files/mock-video-id",
        mimeType: "video/webm",
      },
    };
    const mockPrompt = "Prompt executivo com instruções de análise do vídeo e formulário...";
    const recordingContents = [mockVideoPart, ...res5.inlineImageParts, mockPrompt];

    assert(recordingContents.length === 4, `recordingContents deve conter 4 partes, obtido ${recordingContents.length}`);
    assert(recordingContents[0] === mockVideoPart, "Parte 0 deve ser o vídeo");
    assert(recordingContents[1] === res5.inlineImageParts[0], "Parte 1 deve ser o print PNG");
    assert(recordingContents[2] === res5.inlineImageParts[1], "Parte 2 deve ser o PDF inline");
    assert(recordingContents[3] === mockPrompt, "Parte 3 deve ser o prompt textual");
    console.log("  [PASS] Test 5 passou com sucesso!\n");

    console.log("=========================================================");
    console.log(" TODOS OS 5 TESTES DO PIPELINE MULTIMODAL PASSARAM! 🎉");
    console.log("=========================================================");
  } finally {
    cleanupFixtures();
  }
}

runTests().catch((err) => {
  console.error("ERRO NOS TESTES:", err);
  process.exit(1);
});
