import type {
  FormatCardTitleError,
  FormatCardTitleResult,
  FormatCardTitleSuccess,
} from "./types";

export type { FormatCardTitleError, FormatCardTitleResult, FormatCardTitleSuccess };

/**
 * Sanitiza e formata uma lista de números/chunks de telefone em um título padronizado:
 * "DDDD | DDDD | DDDD | DDDD" (máximo 4 blocos de 4 dígitos válidos).
 *
 * Regras:
 * - O formato final une blocos válidos estritamente com " | ".
 * - Caracteres não numéricos (espaços, traços, parênteses) são removidos.
 * - Blocos que não resultem em exatamente 4 dígitos são descartados.
 * - Limite de no máximo 4 blocos válidos.
 * - Se nenhum bloco de 4 dígitos for identificado ou entrada for inválida, retorna erro.
 */
export function formatCardTitleFromNumbers(
  numbers: unknown
): FormatCardTitleResult {
  if (!Array.isArray(numbers)) {
    return {
      success: false,
      error: "Nenhum número de 4 dígitos informado.",
    };
  }

  const validNumbers: string[] = [];

  for (const item of numbers) {
    if (item === null || item === undefined) {
      continue;
    }
    const cleaned = String(item).replace(/\D/g, "");
    if (cleaned.length === 4) {
      validNumbers.push(cleaned);
      if (validNumbers.length === 4) {
        break;
      }
    }
  }

  if (validNumbers.length === 0) {
    return {
      success: false,
      error: "Nenhum número de 4 dígitos informado.",
    };
  }

  const title = validNumbers.join(" | ");

  return {
    success: true,
    title,
    validNumbers,
  };
}
