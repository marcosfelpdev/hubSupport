import assert from "node:assert";
import type { PhoneCardItem } from "../src/services/api";
import {
  getBatteryWeight,
  sortPhoneCardsByBattery,
} from "../src/utils/phoneCardSorting";

function createMockCard(
  id: string,
  name: string,
  battery: { level: number; isCharging: boolean } | null,
  status: "online" | "offline" | "unpaired" = "online"
): PhoneCardItem {
  return {
    id,
    name,
    status,
    description: `Desc ${name}`,
    pairedDeviceId: status !== "unpaired" ? `dev-${id}` : null,
    pairedDeviceName: status !== "unpaired" ? `Device ${name}` : null,
    hasPushToken: true,
    battery: battery
      ? {
          level: battery.level,
          isCharging: battery.isCharging,
          updatedAt: new Date().toISOString(),
        }
      : null,
  };
}

console.log("[Test] Iniciando validação do algoritmo de ordenação dinâmica por carga...");

// 1. Cenário: Celulares descarregando devem vir do menor para o maior percentual
const card10Discharging = createMockCard("1", "Card 10%", { level: 10, isCharging: false });
const card39Discharging = createMockCard("2", "Card 39%", { level: 39, isCharging: false });
const card90Discharging = createMockCard("3", "Card 90%", { level: 90, isCharging: false });

const sortedDischarging = sortPhoneCardsByBattery([
  card90Discharging,
  card10Discharging,
  card39Discharging,
]);
assert.deepStrictEqual(
  sortedDischarging.map((c) => c.id),
  ["1", "2", "3"],
  "Deveria ordenar descarregando do menor para o maior nível"
);
console.log("✔ Passo 1 aprovado: descarregando ordenados de forma crescente.");

// 2. Cenário: Celulares descarregando com mais carga ainda precedem celulares carregando
// Exemplo crítico: celular com 50% descarregando DEVE vir antes de celular com 10% carregando
const card50Discharging = createMockCard("4", "Card 50% Descarregando", { level: 50, isCharging: false });
const card10Charging = createMockCard("5", "Card 10% Carregando", { level: 10, isCharging: true });

const sortedChargingVsDischarging = sortPhoneCardsByBattery([
  card10Charging,
  card50Discharging,
]);
assert.deepStrictEqual(
  sortedChargingVsDischarging.map((c) => c.id),
  ["4", "5"],
  "Celular descarregando (50%) deve vir antes de celular seguro carregando (10%)"
);
console.log("✔ Passo 2 aprovado: descarregando tem prioridade sobre carregando.");

// 3. Cenário: Celulares carregando são ordenados entre si do menor para o maior
const card80Charging = createMockCard("6", "Card 80% Carregando", { level: 80, isCharging: true });
const card100Charging = createMockCard("7", "Card 100% Carregando", { level: 100, isCharging: true });

const sortedCharging = sortPhoneCardsByBattery([
  card100Charging,
  card10Charging,
  card80Charging,
]);
assert.deepStrictEqual(
  sortedCharging.map((c) => c.id),
  ["5", "6", "7"],
  "Celulares carregando devem ordenar entre si do menor para o maior"
);
console.log("✔ Passo 3 aprovado: carregando ordenados de forma crescente entre si.");

// 4. Cenário: Aparelhos sem telemetria devem ir para o final da fila
const cardNoTelemetry = createMockCard("8", "Card Sem Telemetria", null, "unpaired");
const sortedWithNoTelemetry = sortPhoneCardsByBattery([
  cardNoTelemetry,
  card10Charging,
  card39Discharging,
]);
assert.deepStrictEqual(
  sortedWithNoTelemetry.map((c) => c.id),
  ["2", "5", "8"],
  "Card sem telemetria deve ficar após descarregando e carregando"
);
console.log("✔ Passo 4 aprovado: aparelhos sem telemetria ficam ao final.");

// 5. Cenário: Empate de carga e status desempata por ordem alfabética do nome
const cardTieA = createMockCard("9", "Aparelho Alfa", { level: 50, isCharging: false });
const cardTieB = createMockCard("10", "Aparelho Beta", { level: 50, isCharging: false });

const sortedTie = sortPhoneCardsByBattery([cardTieB, cardTieA]);
assert.deepStrictEqual(
  sortedTie.map((c) => c.id),
  ["9", "10"],
  "Empate deve desempatar pelo nome alfabeticamente"
);
console.log("✔ Passo 5 aprovado: critério de desempate por nome alfabético.");

// 6. Cenário: Aparelho offline que possui última telemetria registrada preserva sua posição
const cardOfflineWithTelemetry = createMockCard("11", "Card Offline 25%", { level: 25, isCharging: false }, "offline");
const sortedWithOffline = sortPhoneCardsByBattery([
  card39Discharging,
  cardOfflineWithTelemetry,
  card10Discharging,
]);
assert.deepStrictEqual(
  sortedWithOffline.map((c) => c.id),
  ["1", "11", "2"],
  "Aparelho offline com última leitura deve ser ordenado pela carga registrada"
);
console.log("✔ Passo 6 aprovado: preservação de última leitura em offline.");

console.log("[Test] TODOS OS TESTES PASSARAM COM SUCESSO! 🎯");
