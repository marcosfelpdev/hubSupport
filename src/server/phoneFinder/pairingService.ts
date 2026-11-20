import crypto from "node:crypto";
import { IPhoneCardRepository } from "./cardRepository";
import { PairingCodeResponse, PhoneCardRecord } from "./types";

const DEFAULT_PAIRING_TTL_MS = 300_000; // 5 minutos
const DEFAULT_CLEANUP_INTERVAL_MS = 30_000; // 30 segundos
const DEFAULT_MAX_FAILED_ATTEMPTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const SIX_DIGIT_CODE_REGEX = /^\d{6}$/;

export interface PairingServiceOptions {
  ttlMs?: number;
  cleanupIntervalMs?: number;
  maxFailedAttemptsPerMinute?: number;
}

export type PairingSubmitOutcome =
  | {
      success: true;
      deviceId: string;
      card: PhoneCardRecord;
      previousDeviceId: string | null;
    }
  | {
      success: false;
      error: string;
    };

interface PendingPairingCode {
  cardId: string;
  code: string;
  expiresAtMs: number;
  expiresAt: string;
}

export class PairingService {
  private readonly cardRepository: IPhoneCardRepository;
  private readonly ttlMs: number;
  private readonly maxFailedAttemptsPerMinute: number;

  private readonly codesByCode = new Map<string, PendingPairingCode>();
  private readonly codeByCardId = new Map<string, string>();
  private readonly failedAttempts = new Map<string, number[]>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    cardRepository: IPhoneCardRepository,
    options?: PairingServiceOptions
  ) {
    this.cardRepository = cardRepository;
    this.ttlMs = options?.ttlMs ?? DEFAULT_PAIRING_TTL_MS;
    this.maxFailedAttemptsPerMinute =
      options?.maxFailedAttemptsPerMinute ??
      DEFAULT_MAX_FAILED_ATTEMPTS_PER_MINUTE;

    const cleanupIntervalMs =
      options?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired();
      }, cleanupIntervalMs);
      this.cleanupTimer.unref?.();
    }
  }

  async generateCode(cardId: string): Promise<PairingCodeResponse | null> {
    const card = await this.cardRepository.findById(cardId);
    if (!card) {
      return null;
    }

    // Invalida imediatamente qualquer código ativo anterior do mesmo card
    this.invalidateCardCode(cardId);

    let code = crypto.randomInt(100000, 1000000).toString();
    for (let attempt = 0; attempt < 20 && this.codesByCode.has(code); attempt++) {
      code = crypto.randomInt(100000, 1000000).toString();
    }

    const expiresAtMs = Date.now() + this.ttlMs;
    const expiresAt = new Date(expiresAtMs).toISOString();

    this.codesByCode.set(code, {
      cardId,
      code,
      expiresAtMs,
      expiresAt,
    });
    this.codeByCardId.set(cardId, code);

    return {
      cardId,
      code,
      expiresAt,
    };
  }

  async submitCode(
    code: string,
    pushToken?: string | null,
    clientKey?: string
  ): Promise<PairingSubmitOutcome> {
    // Rate limit por clientKey (IP/socket) para proteção contra força bruta
    if (this.isRateLimited(clientKey)) {
      return {
        success: false,
        error:
          "Muitas tentativas inválidas. Aguarde um minuto antes de tentar novamente.",
      };
    }

    // 1. Formato inválido (não /^\d{6}$/)
    if (typeof code !== "string" || !SIX_DIGIT_CODE_REGEX.test(code)) {
      this.recordFailedAttempt(clientKey);
      return {
        success: false,
        error: "Código inválido. Informe exatamente 6 dígitos numéricos.",
      };
    }

    // 2. Código inexistente
    const entry = this.codesByCode.get(code);
    if (!entry) {
      this.recordFailedAttempt(clientKey);
      return {
        success: false,
        error: "Código de pareamento não encontrado ou já utilizado.",
      };
    }

    // 3. Código expirado → remove do mapa + erro instruindo gerar novo código
    if (Date.now() > entry.expiresAtMs) {
      this.deleteCodeEntry(entry);
      this.recordFailedAttempt(clientKey);
      return {
        success: false,
        error:
          "Código de pareamento expirado. Gere um novo código no painel.",
      };
    }

    // Consumo único atômico antes de qualquer await (evita TOCTOU em submissões concorrentes)
    this.deleteCodeEntry(entry);

    // 4. Card inexistente no repositório → erro legível
    const card = await this.cardRepository.findById(entry.cardId);
    if (!card) {
      this.recordFailedAttempt(clientKey);
      return {
        success: false,
        error: "O card associado a este código não foi encontrado.",
      };
    }

    // 5. Sucesso → vincula novo deviceId
    const deviceId = crypto.randomUUID();
    const previousDeviceId = card.pairedDeviceId;
    const normalizedPushToken =
      typeof pushToken === "string" && pushToken.trim().length > 0
        ? pushToken.trim()
        : null;

    const updatedCard = await this.cardRepository.pairDevice(
      card.id,
      deviceId,
      normalizedPushToken
    );

    if (!updatedCard) {
      this.recordFailedAttempt(clientKey);
      return {
        success: false,
        error: "O card associado a este código não foi encontrado.",
      };
    }

    return {
      success: true,
      deviceId,
      card: updatedCard,
      previousDeviceId,
    };
  }

  invalidateCardCode(cardId: string): void {
    const existingCode = this.codeByCardId.get(cardId);
    if (!existingCode) {
      return;
    }
    this.codeByCardId.delete(cardId);
    this.codesByCode.delete(existingCode);
  }

  cleanupExpired(): void {
    const now = Date.now();

    for (const entry of this.codesByCode.values()) {
      if (now > entry.expiresAtMs) {
        this.deleteCodeEntry(entry);
      }
    }

    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    for (const [key, timestamps] of this.failedAttempts.entries()) {
      const recent = timestamps.filter((ts) => ts > cutoff);
      if (recent.length === 0) {
        this.failedAttempts.delete(key);
      } else if (recent.length !== timestamps.length) {
        this.failedAttempts.set(key, recent);
      }
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private deleteCodeEntry(entry: PendingPairingCode): void {
    this.codesByCode.delete(entry.code);
    if (this.codeByCardId.get(entry.cardId) === entry.code) {
      this.codeByCardId.delete(entry.cardId);
    }
  }

  private isRateLimited(clientKey?: string): boolean {
    if (!clientKey || this.maxFailedAttemptsPerMinute <= 0) {
      return false;
    }

    const timestamps = this.failedAttempts.get(clientKey);
    if (!timestamps || timestamps.length === 0) {
      return false;
    }

    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    const recent = timestamps.filter((ts) => ts > cutoff);
    if (recent.length === 0) {
      this.failedAttempts.delete(clientKey);
      return false;
    }

    if (recent.length !== timestamps.length) {
      this.failedAttempts.set(clientKey, recent);
    }

    return recent.length >= this.maxFailedAttemptsPerMinute;
  }

  private recordFailedAttempt(clientKey?: string): void {
    if (!clientKey || this.maxFailedAttemptsPerMinute <= 0) {
      return;
    }

    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const existing = this.failedAttempts.get(clientKey) ?? [];
    const recent = existing.filter((ts) => ts > cutoff);
    recent.push(now);
    this.failedAttempts.set(clientKey, recent);
  }
}
