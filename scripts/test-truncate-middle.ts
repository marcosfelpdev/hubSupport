import { truncateMiddle } from "../src/lib/inline-media-parser";

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

async function runTests() {
  console.log("🧪 Iniciando testes de unidade para truncateMiddle...\n");

  // Grupo 1: Nomes curtos (sem truncamento)
  {
    console.log("📋 Grupo 1: Nomes curtos menores ou iguais a maxLength");
    assert(truncateMiddle("foto.png", 16) === "foto.png", "Nome curto com extensão não é alterado");
    assert(truncateMiddle("doc.pdf", 16) === "doc.pdf", "Nome curto doc.pdf mantido");
    assert(truncateMiddle("1234567890123456", 16) === "1234567890123456", "Nome com exatamente maxLength caracteres mantido");
    assert(truncateMiddle("a", 16) === "a", "Nome de 1 caractere mantido");
    assert(truncateMiddle("arquivo.txt", 11) === "arquivo.txt", "Tamanho exato 11 com extensão");
  }

  // Grupo 2: Nomes longos com extensão clássica
  {
    console.log("\n📋 Grupo 2: Nomes longos com extensão e preservação de sufixo");
    const longPng = "Captura de tela 2026-10-15 003713.png";

    // Padrão default (maxLength = 16)
    const res16 = truncateMiddle(longPng, 16);
    assert(res16.length === 16, `Comprimento com maxLength=16 é exatamente 16 (recebido: ${res16.length})`);
    assert(res16 === "Captu...3713.png", `Truncamento clássico 16 esperado 'Captu...3713.png' (recebido: '${res16}')`);
    assert(res16.endsWith(".png"), "Extensão .png preservada");
    assert(res16.includes("..."), "Contém elipse '...' no meio");

    // maxLength = 18 (referência de especificação)
    const res18 = truncateMiddle(longPng, 18);
    assert(res18.length === 18, `Comprimento com maxLength=18 é exatamente 18 (recebido: ${res18.length})`);
    assert(res18 === "Captura...3713.png", `Truncamento 18 preserva 'Captura' no início e '3713.png' no final: '${res18}'`);

    // maxLength = 14
    const res14 = truncateMiddle(longPng, 14);
    assert(res14.length === 14, `Comprimento com maxLength=14 é exatamente 14 (recebido: ${res14.length})`);
    assert(res14 === "Capt...713.png", `Truncamento 14 esperado 'Capt...713.png' (recebido: '${res14}')`);

    // Outras extensões (.jpeg, .docx, .mp4)
    const docx = "Relatorio_Consolidado_Novembro_2026.docx";
    const resDocx = truncateMiddle(docx, 18);
    assert(resDocx.length === 18, `Docx truncado para 18 caracteres (recebido: ${resDocx.length})`);
    assert(resDocx.endsWith(".docx"), "Extensão .docx preservada");
    assert(resDocx.startsWith("Relat"), "Prefixo 'Relat' preservado");
  }

  // Grupo 3: Nomes longos sem extensão
  {
    console.log("\n📋 Grupo 3: Nomes longos sem extensão");
    const noExt = "relatorio_mensal_de_vendas_consolidado";
    const resNoExt16 = truncateMiddle(noExt, 16);
    assert(resNoExt16.length === 16, `Comprimento sem extensão com maxLength=16 é 16 (recebido: ${resNoExt16.length})`);
    assert(resNoExt16 === "relator...lidado", `Truncamento simétrico no meio sem extensão: '${resNoExt16}'`);
    assert(resNoExt16.includes("..."), "Contém elipse '...'");

    const resNoExt15 = truncateMiddle(noExt, 15);
    assert(resNoExt15.length === 15, `Comprimento sem extensão com maxLength=15 é 15 (recebido: ${resNoExt15.length})`);
    assert(resNoExt15 === "relato...lidado", `Truncamento equilibrado com maxLength=15: '${resNoExt15}'`);

    const word = "supercalifragilisticexpialidocious";
    const resWord = truncateMiddle(word, 15);
    assert(resWord.length === 15, `Palavra longa truncada para 15 caracteres (recebido: ${resWord.length})`);
  }

  // Grupo 4: Múltiplos pontos no nome
  {
    console.log("\n📋 Grupo 4: Múltiplos pontos no nome de arquivo");
    const multiDot = "backup.2026.11.15.final.tar.gz";
    const resMulti = truncateMiddle(multiDot, 18);
    assert(resMulti.length === 18, `Multi-dot truncado para 18 caracteres (recebido: ${resMulti.length})`);
    assert(resMulti.endsWith(".gz"), "Última extensão .gz preservada");
    assert(resMulti.includes("..."), "Contém elipse no meio");

    const codeFile = "WorkLogForm.test.integration.spec.tsx";
    const resCode = truncateMiddle(codeFile, 20);
    assert(resCode.length === 20, `Arquivo de teste truncado para 20 caracteres`);
    assert(resCode.endsWith(".tsx"), "Extensão .tsx preservada");
  }

  // Grupo 5: Casos de borda (strings vazias, comprimentos mínimos, extensão longa)
  {
    console.log("\n📋 Grupo 5: Casos de borda e limites");
    assert(truncateMiddle("", 16) === "", "String vazia retorna vazio");
    assert(truncateMiddle("foto.png", 0) === "", "maxLength 0 retorna string vazia");
    assert(truncateMiddle("foto.png", -3) === "", "maxLength negativo retorna string vazia");
    assert(truncateMiddle("photo.png", 3) === "pho", "maxLength <= 3 retorna fatia direta de 3 chars");
    assert(truncateMiddle("photo.png", 1) === "p", "maxLength 1 retorna fatia de 1 char");

    // Arquivos ocultos com ponto no início
    const gitignore = ".gitignore_global_production";
    const resGit = truncateMiddle(gitignore, 12);
    assert(resGit.length === 12, "Arquivo oculto truncado com precisão de tamanho 12");
    assert(resGit.includes("..."), "Arquivo oculto contém elipse");

    // Ponto no final sem extensão real
    const dotAtEnd = "arquivo_sem_extensao.";
    const resDotEnd = truncateMiddle(dotAtEnd, 14);
    assert(resDotEnd.length === 14, "Ponto no final tratado sem quebra e truncado para 14");

    // Extensão muito longa que não cabe com a elipse
    const longExt = "arq.extensaogigantescamaiorqueomaxlength";
    const resLongExt = truncateMiddle(longExt, 12);
    assert(resLongExt.length === 12, "Extensão excessivamente longa trunca no fallback para 12 caracteres");
    assert(resLongExt.includes("..."), "Fallback contém elipse");

    // Parâmetro padrão default maxLength = 16
    const def16 = truncateMiddle("Captura de tela 2026-10-15 003713.png");
    assert(def16 === "Captu...3713.png", "Chamada sem segundo argumento usa maxLength=16 por padrão");
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
