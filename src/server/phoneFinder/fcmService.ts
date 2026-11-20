import fs from "node:fs";
import path from "node:path";
import {
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { CommandAction } from "./types";

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export interface FcmCommandParams {
  pushToken: string;
  commandId: string;
  action: CommandAction;
  durationMs: number;
  timestamp: string;
  cardName: string;
}

export interface FcmSendResult {
  sent: boolean;
  messageId?: string;
  invalidToken?: boolean;
  error?: string;
}

export interface IFcmService {
  isConfigured(): boolean;
  sendCommand(params: FcmCommandParams): Promise<FcmSendResult>;
}

export interface FcmServiceOptions {
  serviceAccountJson?: string;
  serviceAccountPath?: string;
  appName?: string;
}

function parseServiceAccountJson(raw: string): ServiceAccount {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as ServiceAccount;
  }
  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  return JSON.parse(decoded) as ServiceAccount;
}

export class FcmService implements IFcmService {
  private readonly options: FcmServiceOptions;
  private initialized = false;
  private messaging: Messaging | null = null;

  constructor(options: FcmServiceOptions = {}) {
    this.options = options;
  }

  isConfigured(): boolean {
    this.ensureInitialized();
    return this.messaging !== null;
  }

  async sendCommand(params: FcmCommandParams): Promise<FcmSendResult> {
    this.ensureInitialized();

    if (!this.messaging) {
      return {
        sent: false,
        error: "FCM não configurado",
      };
    }

    try {
      const messageId = await this.messaging.send({
        token: params.pushToken,
        data: {
          commandId: String(params.commandId),
          action: String(params.action),
          durationMs: String(params.durationMs),
          timestamp: String(params.timestamp),
          cardName: String(params.cardName),
        },
        android: {
          priority: "high",
          ttl: 60_000,
        },
      });

      return {
        sent: true,
        messageId,
      };
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code)
          : undefined;
      const errorMessage =
        err instanceof Error ? err.message : String(err ?? "Erro desconhecido");

      if (errorCode && INVALID_TOKEN_ERROR_CODES.has(errorCode)) {
        return {
          sent: false,
          invalidToken: true,
          error: errorMessage,
        };
      }

      return {
        sent: false,
        error: errorMessage,
      };
    }
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const rawJson =
      this.options.serviceAccountJson ??
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const rawPath =
      this.options.serviceAccountPath ??
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    const hasJson = typeof rawJson === "string" && rawJson.trim().length > 0;
    const hasPath = typeof rawPath === "string" && rawPath.trim().length > 0;

    if (!hasJson && !hasPath) {
      console.warn(
        "[PhoneFinder][FCM] Credenciais do Firebase não configuradas (FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH). Operando em modo real-time sem push FCM."
      );
      this.messaging = null;
      return;
    }

    try {
      let serviceAccount: ServiceAccount;
      if (hasJson && rawJson) {
        serviceAccount = parseServiceAccountJson(rawJson);
      } else {
        const resolvedPath = path.resolve((rawPath as string).trim());
        const fileContents = fs.readFileSync(resolvedPath, "utf8");
        serviceAccount = JSON.parse(fileContents) as ServiceAccount;
      }

      const appName = this.options.appName ?? "phone-finder-fcm";
      const existingApp = getApps().find((app) => app.name === appName);
      const app =
        existingApp ??
        initializeApp(
          {
            credential: cert(serviceAccount),
          },
          appName
        );

      this.messaging = getMessaging(app);
      console.info(
        "[PhoneFinder][FCM] Firebase Admin SDK inicializado com sucesso."
      );
    } catch (err) {
      console.error(
        "[PhoneFinder][FCM] Falha ao inicializar Firebase Admin SDK; operando em fallback real-time:",
        err
      );
      this.messaging = null;
    }
  }
}
