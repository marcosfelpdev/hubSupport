import {
  normalizeText,
  filterClients,
  getNextHighlightedIndex,
} from "../src/components/ClientCombobox";
import type { ClientItem } from "../src/services/api";

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

// Dados simulados para testes
const mockClients: ClientItem[] = [
  {
    id: "client-1",
    name: "Trynux Tecnologia",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "client-2",
    name: "Matriz São Paulo",
    createdAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "client-3",
    name: "Hospital Sao Lucas",
    createdAt: "2026-01-03T00:00:00Z",
  },
  {
    id: "client-4",
    name: "Clínica Esperança & Saúde",
    createdAt: "2026-01-04T00:00:00Z",
  },
  {
    id: "client-5",
    name: "Filial Rio de Janeiro - Copacabana",
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: "client-6",
    name: "Advocacia João & Associados",
    createdAt: "2026-01-06T00:00:00Z",
  },
];

async function runTests() {
  console.log("🧪 Iniciando testes de unidade para ClientCombobox logic...\n");

  // Grupo 1: Normalização de Texto (normalizeText)
  {
    console.log("📋 Grupo 1: Normalização de Texto (normalizeText)");
    assert(normalizeText("") === "", "String vazia retorna vazia");
    assert(normalizeText("   ") === "", "Apenas espaços retorna string vazia");
    assert(normalizeText("São Paulo") === "sao paulo", "Remove acento circunflexo/til e minúsculas");
    assert(normalizeText("CLÍNICA") === "clinica", "Remove acento agudo e converte maiúsculas");
    assert(normalizeText("  Ação e Saúde  ") === "acao e saude", "Trata cedilha, til, acento e trim");
    assert(normalizeText("TRYNUX") === "trynux", "Converte maiúsculas simples");
  }

  // Grupo 2: Filtragem com Busca em Tempo Real (filterClients)
  {
    console.log("\n📋 Grupo 2: Filtragem com Busca em Tempo Real (filterClients)");

    // Query vazia
    const emptyQuery = filterClients(mockClients, "");
    assert(emptyQuery.length === mockClients.length, "Query vazia retorna todos os clientes");

    const spacesQuery = filterClients(mockClients, "   ");
    assert(spacesQuery.length === mockClients.length, "Query de apenas espaços retorna todos os clientes");

    // Case-insensitive
    const caseLower = filterClients(mockClients, "trynux");
    assert(caseLower.length === 1 && caseLower[0].id === "client-1", "Busca minúscula 'trynux' encontra 'Trynux Tecnologia'");

    const caseUpper = filterClients(mockClients, "TRYNUX");
    assert(caseUpper.length === 1 && caseUpper[0].id === "client-1", "Busca maiúscula 'TRYNUX' encontra 'Trynux Tecnologia'");

    // Substring match
    const subMatch = filterClients(mockClients, "rio");
    assert(subMatch.length === 1 && subMatch[0].id === "client-5", "Busca substring 'rio' encontra 'Filial Rio de Janeiro'");

    // Tolerância a acentuação bidirecional
    const queryWithAccent = filterClients(mockClients, "são");
    assert(
      queryWithAccent.some((c) => c.id === "client-2") && queryWithAccent.some((c) => c.id === "client-3"),
      "Busca com acento 'são' encontra tanto 'São Paulo' quanto 'Sao Lucas'"
    );

    const queryWithoutAccent = filterClients(mockClients, "sao");
    assert(
      queryWithoutAccent.some((c) => c.id === "client-2") && queryWithoutAccent.some((c) => c.id === "client-3"),
      "Busca sem acento 'sao' encontra tanto 'São Paulo' quanto 'Sao Lucas'"
    );

    const queryClinicaSemAcento = filterClients(mockClients, "clinica");
    assert(queryClinicaSemAcento.length === 1 && queryClinicaSemAcento[0].id === "client-4", "Busca sem acento 'clinica' encontra 'Clínica Esperança & Saúde'");

    const querySaudeComAcento = filterClients(mockClients, "saúde");
    assert(querySaudeComAcento.length === 1 && querySaudeComAcento[0].id === "client-4", "Busca com acento 'saúde' encontra 'Clínica Esperança & Saúde'");

    const querySaudeSemAcento = filterClients(mockClients, "saude");
    assert(querySaudeSemAcento.length === 1 && querySaudeSemAcento[0].id === "client-4", "Busca sem acento 'saude' encontra 'Clínica Esperança & Saúde'");

    // Sem correspondência
    const noMatch = filterClients(mockClients, "Inexistente 12345");
    assert(noMatch.length === 0, "Termo inexistente retorna lista vazia");

    // Edge cases de segurança
    const nullClients = filterClients(null as any, "trynux");
    assert(Array.isArray(nullClients) && nullClients.length === 0, "Lista null tratada com retorno de array vazio seguro");
  }

  // Grupo 3: Navegação por Teclado (getNextHighlightedIndex)
  {
    console.log("\n📋 Grupo 3: Navegação por Teclado (getNextHighlightedIndex)");

    const total = 5;

    // Inicialização a partir de -1 (nenhum item selecionado)
    assert(getNextHighlightedIndex(-1, 1, total) === 0, "ArrowDown inicial de -1 seleciona o primeiro item (índice 0)");
    assert(getNextHighlightedIndex(-1, -1, total) === 4, "ArrowUp inicial de -1 seleciona o último item (índice 4)");

    // Navegação intermediária
    assert(getNextHighlightedIndex(0, 1, total) === 1, "ArrowDown de 0 vai para 1");
    assert(getNextHighlightedIndex(1, 1, total) === 2, "ArrowDown de 1 vai para 2");
    assert(getNextHighlightedIndex(2, -1, total) === 1, "ArrowUp de 2 vai para 1");

    // Wrap around (ciclo circular)
    assert(getNextHighlightedIndex(4, 1, total) === 0, "ArrowDown no último item (4) faz wrap para o primeiro (0)");
    assert(getNextHighlightedIndex(0, -1, total) === 4, "ArrowUp no primeiro item (0) faz wrap para o último (4)");

    // Lista vazia
    assert(getNextHighlightedIndex(-1, 1, 0) === -1, "Lista vazia com ArrowDown retorna -1");
    assert(getNextHighlightedIndex(0, 1, 0) === -1, "Lista vazia retorna -1");
  }

  // Grupo 4: Verificação de Mapeamento e Integridade do Cliente Selecionado
  {
    console.log("\n📋 Grupo 4: Mapeamento de Seleção e Integridade");

    const selected = mockClients[0];
    assert(selected.id === "client-1", "ID do cliente selecionado preservado");
    assert(selected.name === "Trynux Tecnologia", "Nome do cliente selecionado preservado");

    const foundInList = mockClients.find((c) => c.id === selected.id);
    assert(Boolean(foundInList), "Cliente selecionado localizável na lista de clientes");
    assert(foundInList?.name === selected.name, "Nome coincide com registro encontrado");
  }

  console.log(`\n========================================`);
  console.log(`📊 Total: ${passed + failed} | ✅ Passou: ${passed} | ❌ Falhou: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erro fatal na execução dos testes:", err);
  process.exit(1);
});
