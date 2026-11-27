import type { PhoneCardItem } from "../services/api";

/**
 * Calcula o peso de prioridade da bateria para ordenação de cards do Localizador.
 *
 * Escala de Pesos:
 * - 0 a 100: Aparelho descarregando (isCharging === false) ordenado por nível (menor = mais prioritário)
 * - 1000 a 1100: Aparelho carregando (isCharging === true) ordenado por nível
 * - 2000: Aparelho sem telemetria (nunca informou carga de bateria)
 */
export function getBatteryWeight(card: PhoneCardItem): number {
  if (!card.battery) {
    return 2000;
  }

  const level = Math.max(0, Math.min(100, Math.round(card.battery.level)));
  const isCharging = Boolean(card.battery.isCharging);

  return isCharging ? 1000 + level : level;
}

/**
 * Ordena os cards dos celulares dinamicamente com base no nível de bateria e status de carregador:
 * 1. Aparelhos descarregando com menor carga primeiro (0% -> 100%)
 * 2. Aparelhos carregando na tomada com menor carga primeiro (1000 -> 1100)
 * 3. Aparelhos sem telemetria registrada ao final (2000)
 * 4. Desempate estável por ordem alfabética do nome do card
 */
export function sortPhoneCardsByBattery(cards: PhoneCardItem[]): PhoneCardItem[] {
  return [...cards].sort((a, b) => {
    const weightA = getBatteryWeight(a);
    const weightB = getBatteryWeight(b);

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    return a.name.localeCompare(b.name, "pt-BR", { numeric: true });
  });
}
