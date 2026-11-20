import crypto from "node:crypto";
import { IPhoneCardRepository } from "./cardRepository";
import { IFcmService } from "./fcmService";
import { PresenceService } from "./presenceService";
import {
  AlertLocatePayload,
  AlertVibratePayload,
  CommandAckStatus,
  CommandAction,
  CommandFeedbackPayload,
  CommandFeedbackStatus,
  DeviceStatusPayload,
} from "./types";

export const LOCATE_DURATION_MS = 5000;
export const VIBRATE_DURATION_MS = 3000;
export const DEFAULT_ACK_TIMEOUT_MS = 7000;

export interface CommandDispatchOutcome {
  httpStatus: number;
  feedback: CommandFeedbackPayload;
}

export interface CommandTransportHooks {
  emitToDevice?: (
    deviceId: string,
    event: "alert:locate" | "alert:vibrate",
    payload: AlertLocatePayload | AlertVibratePayload
  ) => void;
  broadcastCommandFeedback?: (
    action: CommandAction,
    feedback: CommandFeedbackPayload
  ) => void;
  broadcastDeviceStatus?: (payload: DeviceStatusPayload) => void;
}

export interface CommandServiceOptions {
  ackTimeoutMs?: number;
}

interface PendingCommand {
  commandId: string;
  cardId: string;
  deviceId: string;
  action: CommandAction;
  timer: NodeJS.Timeout;
  resolve: (outcome: CommandDispatchOutcome) => void;
}

export class CommandService {
  private readonly cardRepository: IPhoneCardRepository;
  private readonly presenceService: PresenceService;
  private readonly fcmService: IFcmService;
  private readonly ackTimeoutMs: number;

  private hooks: CommandTransportHooks = {};
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private readonly inFlightByCard = new Map<string, string>();

  constructor(
    cardRepository: IPhoneCardRepository,
    presenceService: PresenceService,
    fcmService: IFcmService,
    options?: CommandServiceOptions
  ) {
    this.cardRepository = cardRepository;
    this.presenceService = presenceService;
    this.fcmService = fcmService;
    this.ackTimeoutMs = options?.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
  }

  setTransportHooks(hooks: CommandTransportHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  hasInFlight(cardId: string): boolean {
    return this.inFlightByCard.has(cardId);
  }

  async dispatchCommand(
    cardId: string,
    action: CommandAction
  ): Promise<CommandDispatchOutcome> {
    const card = await this.cardRepository.findById(cardId);
    if (!card) {
      return {
        httpStatus: 404,
        feedback: {
          cardId,
          commandId: "",
          status: "error",
          message: "Card não encontrado.",
        },
      };
    }

    if (!card.pairedDeviceId) {
      return {
        httpStatus: 400,
        feedback: {
          cardId,
          commandId: "",
          status: "error",
          message: "Este card ainda não possui um dispositivo pareado.",
        },
      };
    }

    if (this.inFlightByCard.has(cardId)) {
      return {
        httpStatus: 409,
        feedback: {
          cardId,
          commandId: "",
          status: "error",
          message: "Já existe um comando em andamento para este dispositivo.",
        },
      };
    }

    const deviceId = card.pairedDeviceId;
    const hasOnlineSocket = this.presenceService.isOnline(deviceId);
    const canSendPush = Boolean(
      card.pushToken && this.fcmService.isConfigured()
    );

    if (!hasOnlineSocket && !canSendPush) {
      const feedback: CommandFeedbackPayload = {
        cardId,
        commandId: "",
        status: "error",
        message: "Dispositivo offline e sem push notification configurado.",
      };
      this.hooks.broadcastCommandFeedback?.(action, feedback);
      return {
        httpStatus: 503,
        feedback,
      };
    }

    const commandId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const durationMs =
      action === "locate" ? LOCATE_DURATION_MS : VIBRATE_DURATION_MS;

    return new Promise<CommandDispatchOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.finishPending(
          commandId,
          408,
          "timeout",
          "Tempo esgotado aguardando confirmação do dispositivo."
        );
      }, this.ackTimeoutMs);

      this.pendingCommands.set(commandId, {
        commandId,
        cardId,
        deviceId,
        action,
        timer,
        resolve,
      });
      this.inFlightByCard.set(cardId, commandId);

      // Entrega dupla simultânea — Canal 1: WebSocket (target emit exclusivo)
      let deliveredViaSocket = false;
      if (hasOnlineSocket) {
        try {
          if (action === "locate") {
            const payload: AlertLocatePayload = {
              commandId,
              action: "locate",
              durationMs,
              timestamp,
              cardName: card.name,
            };
            this.hooks.emitToDevice?.(deviceId, "alert:locate", payload);
          } else {
            const payload: AlertVibratePayload = {
              commandId,
              action: "vibrate",
              durationMs,
              timestamp,
              cardName: card.name,
            };
            this.hooks.emitToDevice?.(deviceId, "alert:vibrate", payload);
          }
          deliveredViaSocket = true;
        } catch (err) {
          console.error(
            `[PhoneFinder][Command] Erro ao emitir ${action} via socket para device=${deviceId}:`,
            err
          );
          if (!canSendPush) {
            this.finishPending(
              commandId,
              503,
              "error",
              "Falha ao enviar comando pelo canal em tempo real."
            );
            return;
          }
        }
      }

      // Entrega dupla simultânea — Canal 2: FCM high-priority em paralelo
      if (canSendPush && card.pushToken) {
        void this.sendPushInParallel({
          commandId,
          cardId,
          deviceId,
          pushToken: card.pushToken,
          action,
          durationMs,
          timestamp,
          cardName: card.name,
          hasOnlineSocket: deliveredViaSocket,
        });
      }
    });
  }

  handleAck(
    commandId: string,
    ackStatus: CommandAckStatus,
    timestamp: number,
    socketDeviceId?: string | null
  ): boolean {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) {
      console.info(
        `[PhoneFinder][Command] ACK tardio ou desconhecido ignorado (commandId=${commandId}, timestamp=${timestamp}).`
      );
      return false;
    }

    // Se o socket já está identificado, rejeita ACK forjado por outro deviceId
    if (
      socketDeviceId !== undefined &&
      socketDeviceId !== null &&
      socketDeviceId !== "" &&
      socketDeviceId !== pending.deviceId
    ) {
      console.warn(
        `[PhoneFinder][Command] ACK rejeitado: socket identificado como device=${socketDeviceId}, esperado=${pending.deviceId} (commandId=${commandId}).`
      );
      return false;
    }

    if (ackStatus === "ok") {
      const message =
        pending.action === "locate"
          ? "Alerta de localização executado com sucesso no dispositivo."
          : "Vibração executada com sucesso no dispositivo.";
      return this.finishPending(commandId, 200, "success", message);
    }

    const errorMessage =
      pending.action === "locate"
        ? "O dispositivo reportou erro ao executar o alerta de localização."
        : "O dispositivo reportou erro ao executar a vibração.";
    return this.finishPending(commandId, 502, "error", errorMessage);
  }

  stop(): void {
    for (const pending of this.pendingCommands.values()) {
      clearTimeout(pending.timer);
      const feedback: CommandFeedbackPayload = {
        cardId: pending.cardId,
        commandId: pending.commandId,
        status: "error",
        message: "Servidor encerrado antes da confirmação do dispositivo.",
      };
      pending.resolve({
        httpStatus: 503,
        feedback,
      });
    }
    this.pendingCommands.clear();
    this.inFlightByCard.clear();
  }

  private async sendPushInParallel(params: {
    commandId: string;
    cardId: string;
    deviceId: string;
    pushToken: string;
    action: CommandAction;
    durationMs: number;
    timestamp: string;
    cardName: string;
    hasOnlineSocket: boolean;
  }): Promise<void> {
    try {
      const result = await this.fcmService.sendCommand({
        pushToken: params.pushToken,
        commandId: params.commandId,
        action: params.action,
        durationMs: params.durationMs,
        timestamp: params.timestamp,
        cardName: params.cardName,
      });

      // Cancela timer de 7s imediatamente antes de qualquer await no banco se for fail-fast offline
      if (!result.sent && !params.hasOnlineSocket) {
        const pending = this.pendingCommands.get(params.commandId);
        if (pending) {
          clearTimeout(pending.timer);
        }
      }

      if (result.invalidToken) {
        const currentCard = await this.cardRepository
          .findById(params.cardId)
          .catch((err) => {
            console.error(
              "[PhoneFinder][Command] Falha ao reconsultar card antes de limpar pushToken:",
              err
            );
            return null;
          });

        if (
          currentCard &&
          currentCard.pairedDeviceId === params.deviceId &&
          currentCard.pushToken === params.pushToken
        ) {
          await this.cardRepository
            .updatePushToken(params.cardId, null)
            .catch((err) => {
              console.error(
                "[PhoneFinder][Command] Falha ao limpar pushToken inválido:",
                err
              );
            });

          const appVersion = this.presenceService.getAppVersion(
            params.deviceId
          );
          this.hooks.broadcastDeviceStatus?.({
            cardId: params.cardId,
            status: this.presenceService.isOnline(params.deviceId)
              ? "online"
              : "offline",
            deviceId: params.deviceId,
            hasPushToken: false,
            appVersionCode: appVersion?.appVersionCode ?? null,
            appVersionName: appVersion?.appVersionName ?? null,
          });
        }
      }

      if (!result.sent) {
        if (!params.hasOnlineSocket) {
          const message = result.invalidToken
            ? "Token de push do dispositivo está inválido ou revogado. Reconecte o app."
            : result.error
              ? `Falha ao enviar push notification: ${result.error}`
              : "Falha ao enviar push notification para o dispositivo offline.";
          this.finishPending(params.commandId, 503, "error", message);
        } else {
          console.warn(
            `[PhoneFinder][Command] Falha no envio FCM para card=${params.cardId} (socket online, aguardando ACK WebSocket): ${result.error ?? "erro desconhecido"}`
          );
        }
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      if (!params.hasOnlineSocket) {
        this.finishPending(
          params.commandId,
          503,
          "error",
          `Falha ao enviar push notification: ${errMessage}`
        );
      } else {
        console.warn(
          `[PhoneFinder][Command] Exceção no envio FCM para card=${params.cardId} (socket online, aguardando ACK WebSocket): ${errMessage}`
        );
      }
    }
  }

  private finishPending(
    commandId: string,
    httpStatus: number,
    status: CommandFeedbackStatus,
    message: string
  ): boolean {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingCommands.delete(commandId);
    if (this.inFlightByCard.get(pending.cardId) === commandId) {
      this.inFlightByCard.delete(pending.cardId);
    }

    const feedback: CommandFeedbackPayload = {
      cardId: pending.cardId,
      commandId: pending.commandId,
      status,
      message,
    };

    this.hooks.broadcastCommandFeedback?.(pending.action, feedback);
    pending.resolve({
      httpStatus,
      feedback,
    });
    return true;
  }
}
