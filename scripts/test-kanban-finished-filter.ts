import { isFinalizedToday } from "../src/components/dashboard/TechnicianKanbanBoard";
import type { WorkLogItem } from "../src/services/api";

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

// Datas de referência para os testes
const now = new Date();
const todayIso = now.toISOString();

const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayIso = yesterday.toISOString();

const threeDaysAgo = new Date(now);
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
const threeDaysAgoIso = threeDaysAgo.toISOString();

// Helper para criar mock básico de WorkLogItem
function createMockLog(partial: Partial<WorkLogItem>): WorkLogItem {
  return {
    id: "log-" + Math.random().toString(36).substring(2, 9),
    requester: "Usuário Teste",
    clientOrOffice: "Empresa Teste",
    reportedProblem: "Problema teste",
    status: "Solucionado",
    technicalAction: true,
    implementation: false,
    media: "[]",
    userId: "user-1",
    createdAt: threeDaysAgoIso,
    updatedAt: threeDaysAgoIso,
    user: {
      name: "Técnico Teste",
      email: "tecnico@teste.com",
    },
    ...partial,
  };
}

async function runTests() {
  console.log("🧪 Iniciando testes de unidade para isFinalizedToday (Filtro de Finalizadas do Kanban)...\n");

  // Cenário 1: Card finalizado hoje via statusHistory com toStatus: "Solucionado"
  {
    console.log("📋 Cenário 1: Card finalizado hoje via statusHistory");
    const log = createMockLog({
      updatedAt: threeDaysAgoIso, // updatedAt antigo de propósito
      statusHistory: [
        {
          id: "hist-1",
          workLogId: "log-1",
          fromStatus: "Em progresso",
          toStatus: "Solucionado",
          changedById: "user-1",
          changedBy: { id: "user-1", name: "Técnico" },
          createdAt: todayIso,
        },
      ],
    });
    assert(isFinalizedToday(log) === true, "Deve retornar true quando a transição para Solucionado ocorreu hoje");
  }

  // Cenário 2: Card finalizado ontem via statusHistory com toStatus: "Solucionado"
  {
    console.log("📋 Cenário 2: Card finalizado ontem via statusHistory");
    const log = createMockLog({
      updatedAt: todayIso, // updatedAt hoje (ex: nota adicionada hoje), mas status mudou ontem
      statusHistory: [
        {
          id: "hist-2",
          workLogId: "log-2",
          fromStatus: "Em progresso",
          toStatus: "Solucionado",
          changedById: "user-1",
          changedBy: { id: "user-1", name: "Técnico" },
          createdAt: yesterdayIso,
        },
      ],
    });
    assert(isFinalizedToday(log) === false, "Deve retornar false quando finalizado ontem (mesmo com updatedAt hoje)");
  }

  // Cenário 3: Card sem statusHistory, mas com updatedAt de hoje
  {
    console.log("📋 Cenário 3: Card sem statusHistory com updatedAt de hoje");
    const log = createMockLog({
      statusHistory: [],
      updatedAt: todayIso,
      createdAt: threeDaysAgoIso,
    });
    assert(isFinalizedToday(log) === true, "Deve retornar true por fallback de updatedAt de hoje");
  }

  // Cenário 4: Card sem statusHistory, mas com updatedAt de ontem
  {
    console.log("📋 Cenário 4: Card sem statusHistory com updatedAt de ontem");
    const log = createMockLog({
      statusHistory: [],
      updatedAt: yesterdayIso,
      createdAt: threeDaysAgoIso,
    });
    assert(isFinalizedToday(log) === false, "Deve retornar false por fallback de updatedAt de ontem");
  }

  // Cenário 5: Card com histórico onde houve transições para "Em progresso" depois para "Solucionado" hoje
  {
    console.log("📋 Cenário 5: Múltiplas transições com finalização hoje");
    const log = createMockLog({
      statusHistory: [
        {
          id: "hist-a",
          workLogId: "log-5",
          fromStatus: "Backlog",
          toStatus: "Em progresso",
          changedById: "user-1",
          changedBy: { id: "user-1", name: "Técnico" },
          createdAt: yesterdayIso,
        },
        {
          id: "hist-b",
          workLogId: "log-5",
          fromStatus: "Em progresso",
          toStatus: "Solucionado",
          changedById: "user-1",
          changedBy: { id: "user-1", name: "Técnico" },
          createdAt: todayIso,
        },
      ],
    });
    assert(isFinalizedToday(log) === true, "Deve pegar a transição mais recente para Solucionado e retornar true");
  }

  // Cenário 6: Card com data inválida ou nula
  {
    console.log("📋 Cenário 6: Datas inválidas ou nulas");
    const logInvalid = createMockLog({
      statusHistory: [],
      updatedAt: "invalid-date",
      createdAt: "invalid-date",
    });
    assert(isFinalizedToday(logInvalid) === false, "Deve retornar false para data inválida");

    const logEmpty = createMockLog({
      statusHistory: [],
      updatedAt: "",
      createdAt: "",
    });
    assert(isFinalizedToday(logEmpty) === false, "Deve retornar false para data vazia");

    assert(isFinalizedToday(null as any) === false, "Deve retornar false para log nulo");
    assert(isFinalizedToday(undefined as any) === false, "Deve retornar false para log indefinido");
  }

  // Cenário 7: Card com variações lexicais de status ("concluído", "finalizado", etc)
  {
    console.log("📋 Cenário 7: Variações lexicais de status finalizado");
    const logConcluido = createMockLog({
      statusHistory: [
        {
          id: "hist-c",
          workLogId: "log-7",
          fromStatus: "Validação",
          toStatus: "concluído",
          changedById: "user-1",
          changedBy: { id: "user-1", name: "Técnico" },
          createdAt: todayIso,
        },
      ],
    });
    assert(isFinalizedToday(logConcluido) === true, "Deve aceitar 'concluído' como status de finalização hoje");
  }

  // Cenário 8: Card sem statusHistory e sem updatedAt, fallback para createdAt hoje
  {
    console.log("📋 Cenário 8: Fallback para createdAt de hoje");
    const logCreatedAt = createMockLog({
      statusHistory: undefined,
      updatedAt: "",
      createdAt: todayIso,
    });
    assert(isFinalizedToday(logCreatedAt) === true, "Deve retornar true por fallback de createdAt de hoje");
  }

  console.log("\n=================================");
  console.log(`📊 Resultado dos testes: ${passed} passaram, ${failed} falharam.`);
  console.log("=================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
