import type { Server as HttpServer } from "node:http";
import { Namespace, Server as SocketIOServer, Socket } from "socket.io";
import { AuthenticatedUser, verifySessionToken } from "../auth";
import type { PhoneFinderRuntime } from "./index";
import {
  AlertAckPayload,
  AlertLocatePayload,
  AlertVibratePayload,
  CardBatteryPayload,
  CommandAction,
  CommandFeedbackPayload,
  DeviceBatteryPayload,
  DeviceClientToServerEvents,
  DeviceIdentifyPayload,
  DeviceServerToClientEvents,
  DeviceStatusPayload,
  DeviceUnpairPayload,
  LocateTriggerPayload,
  PairingGeneratePayload,
  PairingSubmitPayload,
  PanelClientToServerEvents,
  PanelServerToClientEvents,
  VibrateAckPayload,
  VibrateTriggerPayload,
} from "./types";

export interface PhoneFinderSocketServerOptions {
  verifyToken?: (token: string) => Promise<AuthenticatedUser | null>;
}

interface PanelSocketData {
  user?: AuthenticatedUser;
}

type PanelNamespace = Namespace<
  PanelClientToServerEvents,
  PanelServerToClientEvents,
  Record<string, never>,
  PanelSocketData
>;

type DeviceNamespace = Namespace<
  DeviceClientToServerEvents,
  DeviceServerToClientEvents
>;

type DeviceSocket = Socket<
  DeviceClientToServerEvents,
  DeviceServerToClientEvents
>;

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const segment of cookieHeader.split(";")) {
    const eqIndex = segment.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = segment.slice(0, eqIndex).trim();
    const rawValue = segment.slice(eqIndex + 1).trim();
    if (!key) {
      continue;
    }
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}

function extractHandshakeToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const authHeader = socket.handshake.headers.authorization;
  if (typeof authHeader === "string" && authHeader.trim().length > 0) {
    const match = authHeader.trim().match(/^Bearer\s+(.+)$/i);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  const cookies = parseCookieHeader(socket.handshake.headers.cookie);
  if (cookies.token && cookies.token.trim().length > 0) {
    return cookies.token.trim();
  }

  return null;
}

function getDeviceClientKey(socket: DeviceSocket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : socket.handshake.address;

  return rawIp && rawIp.trim().length > 0 ? rawIp.trim() : socket.id;
}

export function attachPhoneFinderSocketServer(
  httpServer: HttpServer,
  runtime: PhoneFinderRuntime,
  options?: PhoneFinderSocketServerOptions
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    pingTimeout: 120_000,
    pingInterval: 45_000,
  });

  const verifyToken = options?.verifyToken ?? verifySessionToken;
  const panelNs = io.of("/panel") as unknown as PanelNamespace;
  const deviceNs = io.of("/device") as unknown as DeviceNamespace;

  // ---------------------------------------------------------------------------
  // Helpers de transporte (target emit exclusivo em /device, broadcast em /panel)
  // ---------------------------------------------------------------------------
  const emitAlertToDevice = (
    deviceId: string,
    event: "alert:locate" | "alert:vibrate",
    payload: AlertLocatePayload | AlertVibratePayload
  ): void => {
    const socketIds = runtime.presenceService.getSockets(deviceId);
    for (const socketId of socketIds) {
      if (event === "alert:locate") {
        deviceNs.to(socketId).emit("alert:locate", payload as AlertLocatePayload);
      } else {
        deviceNs.to(socketId).emit("alert:vibrate", payload as AlertVibratePayload);
      }
    }
  };

  const notifyDeviceUnpaired = (
    deviceId: string,
    message = "Este dispositivo foi desvinculado do painel."
  ): void => {
    const socketIds = runtime.presenceService.getSockets(deviceId);
    for (const socketId of socketIds) {
      deviceNs.to(socketId).emit("device:unpaired", { message });
    }
  };

  const broadcastDeviceStatus = (payload: DeviceStatusPayload): void => {
    panelNs.emit("device:status", payload);
  };

  const broadcastBattery = (payload: CardBatteryPayload): void => {
    panelNs.emit("card:battery", payload);
  };

  const broadcastCommandFeedback = (
    action: CommandAction,
    feedback: CommandFeedbackPayload
  ): void => {
    if (action === "locate") {
      panelNs.emit("locate:feedback", feedback);
    } else {
      panelNs.emit("vibrate:feedback", feedback);
    }
  };

  runtime.commandService.setTransportHooks({
    emitToDevice: emitAlertToDevice,
    broadcastCommandFeedback,
    broadcastDeviceStatus,
  });

  runtime.setRealtimeTransport({
    notifyDeviceUnpaired,
    broadcastDeviceStatus,
    broadcastBattery,
    broadcastCommandFeedback,
  });

  // ---------------------------------------------------------------------------
  // Namespace /panel — exige JWT válido do HubSupport no handshake
  // ---------------------------------------------------------------------------
  panelNs.use(async (socket, next) => {
    try {
      const token = extractHandshakeToken(socket);
      if (!token) {
        next(new Error("UNAUTHORIZED"));
        return;
      }

      const user = await verifyToken(token);
      if (!user) {
        next(new Error("UNAUTHORIZED"));
        return;
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  panelNs.on("connection", (socket) => {
    socket.on(
      "pairing:generate",
      async (payload: PairingGeneratePayload, ack) => {
        const reply = typeof ack === "function" ? ack : undefined;
        try {
          const cardId =
            typeof payload?.cardId === "string" ? payload.cardId.trim() : "";
          if (!cardId) {
            reply?.({ ok: false, error: "cardId é obrigatório." });
            return;
          }

          const generated = await runtime.pairingService.generateCode(cardId);
          if (!generated) {
            reply?.({ ok: false, error: "Card não encontrado." });
            return;
          }

          socket.emit("pairing:generated", generated);
          reply?.({ ok: true, data: generated });
        } catch (err) {
          console.error(
            "[PhoneFinder][Socket][/panel] Erro em pairing:generate:",
            err
          );
          reply?.({ ok: false, error: "Erro ao gerar código de pareamento." });
        }
      }
    );

    socket.on("device:unpair", async (payload: DeviceUnpairPayload, ack) => {
      const reply = typeof ack === "function" ? ack : undefined;
      try {
        const cardId =
          typeof payload?.cardId === "string" ? payload.cardId.trim() : "";
        if (!cardId) {
          reply?.({ ok: false, error: "cardId é obrigatório." });
          return;
        }

        const updated = await runtime.unpairCard(cardId);
        if (!updated) {
          reply?.({ ok: false, error: "Card não encontrado." });
          return;
        }

        reply?.({ ok: true });
      } catch (err) {
        console.error(
          "[PhoneFinder][Socket][/panel] Erro em device:unpair:",
          err
        );
        reply?.({ ok: false, error: "Erro ao desvincular dispositivo." });
      }
    });

    socket.on("locate:trigger", (payload: LocateTriggerPayload) => {
      const cardId =
        typeof payload?.cardId === "string" ? payload.cardId.trim() : "";
      if (!cardId) {
        return;
      }
      void runtime.commandService.dispatchCommand(cardId, "locate").catch((err) => {
        console.error(
          "[PhoneFinder][Socket][/panel] Erro em locate:trigger:",
          err
        );
      });
    });

    socket.on("vibrate:trigger", (payload: VibrateTriggerPayload) => {
      const cardId =
        typeof payload?.cardId === "string" ? payload.cardId.trim() : "";
      if (!cardId) {
        return;
      }
      void runtime.commandService.dispatchCommand(cardId, "vibrate").catch((err) => {
        console.error(
          "[PhoneFinder][Socket][/panel] Erro em vibrate:trigger:",
          err
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Namespace /device — conexões exclusivas dos celulares (sem login de usuário)
  // ---------------------------------------------------------------------------
  deviceNs.on("connection", (socket) => {
    socket.on("pairing:submit", async (payload: PairingSubmitPayload) => {
      try {
        const code = typeof payload?.code === "string" ? payload.code.trim() : "";
        const pushToken =
          typeof payload?.pushToken === "string"
            ? payload.pushToken
            : undefined;
        const clientKey = getDeviceClientKey(socket);

        const result = await runtime.pairingService.submitCode(
          code,
          pushToken,
          clientKey
        );

        if (!result.success) {
          socket.emit("pairing:result", {
            success: false,
            error: result.error,
          });
          return;
        }

        if (
          result.previousDeviceId &&
          result.previousDeviceId !== result.deviceId
        ) {
          notifyDeviceUnpaired(
            result.previousDeviceId,
            "Este dispositivo foi substituído por outro aparelho no painel."
          );
          runtime.presenceService.clearDevice(result.previousDeviceId);
        }

        // Cache deviceId -> cardId em memória para zerar queries no banco em device:battery
        runtime.presenceService.setCardId(result.deviceId, result.card.id);

        // Previne leak permanente de presença caso o socket tenha desconectado durante o await
        if (!socket.connected) {
          broadcastDeviceStatus({
            cardId: result.card.id,
            status: "offline",
            deviceId: result.deviceId,
            hasPushToken: Boolean(result.card.pushToken),
            appVersionCode: null,
            appVersionName: null,
          });
          return;
        }

        runtime.presenceService.registerSocket(
          result.deviceId,
          socket.id,
          undefined,
          result.card.id
        );

        socket.emit("pairing:result", {
          success: true,
          deviceId: result.deviceId,
          cardId: result.card.id,
          cardName: result.card.name,
        });

        broadcastDeviceStatus({
          cardId: result.card.id,
          status: "online",
          deviceId: result.deviceId,
          hasPushToken: Boolean(result.card.pushToken),
          appVersionCode: null,
          appVersionName: null,
        });
      } catch (err) {
        console.error(
          "[PhoneFinder][Socket][/device] Erro em pairing:submit:",
          err
        );
        if (socket.connected) {
          socket.emit("pairing:result", {
            success: false,
            error: "Erro interno ao processar pareamento.",
          });
        }
      }
    });

    socket.on("device:identify", async (payload: DeviceIdentifyPayload) => {
      try {
        const deviceId =
          typeof payload?.deviceId === "string" ? payload.deviceId.trim() : "";

        if (!deviceId) {
          socket.emit("device:unpaired", {
            message: "Este dispositivo foi desvinculado do painel.",
          });
          return;
        }

        let card = await runtime.cardRepository.findByDeviceId(deviceId);
        if (!card) {
          if (socket.connected) {
            socket.emit("device:unpaired", {
              message: "Este dispositivo foi desvinculado do painel.",
            });
          }
          return;
        }

        if (
          typeof payload.pushToken === "string" &&
          payload.pushToken.trim().length > 0
        ) {
          const updated = await runtime.cardRepository.updatePushToken(
            card.id,
            payload.pushToken.trim()
          );
          if (updated) {
            card = updated;
          }
        }

        // Previne leak permanente de presença caso o socket tenha desconectado durante os awaits no banco
        if (!socket.connected) {
          return;
        }

        const hasVersionInfo =
          payload.appVersionCode !== undefined ||
          payload.appVersionName !== undefined;

        runtime.presenceService.registerSocket(
          deviceId,
          socket.id,
          hasVersionInfo
            ? {
                appVersionCode:
                  typeof payload.appVersionCode === "number" &&
                  Number.isFinite(payload.appVersionCode)
                    ? payload.appVersionCode
                    : null,
                appVersionName:
                  typeof payload.appVersionName === "string" &&
                  payload.appVersionName.trim().length > 0
                    ? payload.appVersionName.trim()
                    : null,
              }
            : undefined,
          card.id
        );

        const appVersion = runtime.presenceService.getAppVersion(deviceId);

        broadcastDeviceStatus({
          cardId: card.id,
          status: "online",
          deviceId,
          hasPushToken: Boolean(card.pushToken),
          appVersionCode: appVersion?.appVersionCode ?? null,
          appVersionName: appVersion?.appVersionName ?? null,
        });

        const battery = runtime.presenceService.getBattery(deviceId);
        if (battery) {
          broadcastBattery({
            cardId: card.id,
            deviceId,
            level: battery.level,
            isCharging: battery.isCharging,
            updatedAt: battery.updatedAt,
          });
        }
      } catch (err) {
        console.error(
          "[PhoneFinder][Socket][/device] Erro em device:identify:",
          err
        );
      }
    });

    socket.on("device:battery", async (payload: DeviceBatteryPayload) => {
      try {
        const deviceId =
          typeof payload?.deviceId === "string" ? payload.deviceId.trim() : "";
        const registeredDeviceId = runtime.presenceService.getDeviceBySocket(
          socket.id
        );

        if (!registeredDeviceId || registeredDeviceId !== deviceId) {
          return;
        }

        if (
          typeof payload?.level !== "number" ||
          !Number.isFinite(payload.level) ||
          payload.level < 0 ||
          payload.level > 100
        ) {
          return;
        }

        let cardId = runtime.presenceService.getCardId(deviceId);
        if (cardId === null) {
          const card = await runtime.cardRepository.findByDeviceId(deviceId);
          if (!card) {
            return;
          }
          if (runtime.presenceService.getDeviceBySocket(socket.id) !== deviceId) {
            return;
          }
          cardId = card.id;
          runtime.presenceService.setCardId(deviceId, card.id);
        }

        const telemetry = runtime.presenceService.setBattery(
          deviceId,
          payload.level,
          Boolean(payload.isCharging)
        );

        broadcastBattery({
          cardId,
          deviceId,
          level: telemetry.level,
          isCharging: telemetry.isCharging,
          updatedAt: telemetry.updatedAt,
        });
      } catch (err) {
        console.error(
          "[PhoneFinder][Socket][/device] Erro em device:battery:",
          err
        );
      }
    });

    const handleDeviceAck = (
      payload: AlertAckPayload | VibrateAckPayload
    ): void => {
      if (
        typeof payload?.commandId !== "string" ||
        payload.commandId.trim().length === 0
      ) {
        return;
      }
      if (payload.status !== "ok" && payload.status !== "error") {
        return;
      }

      const timestamp =
        typeof payload.timestamp === "number" &&
        Number.isFinite(payload.timestamp)
          ? payload.timestamp
          : Date.now();

      const socketDeviceId = runtime.presenceService.getDeviceBySocket(
        socket.id
      );

      runtime.commandService.handleAck(
        payload.commandId,
        payload.status,
        timestamp,
        socketDeviceId
      );
    };

    socket.on("alert:ack", handleDeviceAck);
    socket.on("vibrate:ack", handleDeviceAck);

    socket.on("disconnect", async () => {
      try {
        const unregistered = runtime.presenceService.unregisterSocket(socket.id);
        if (!unregistered || !unregistered.wentOffline) {
          return;
        }

        const card = await runtime.cardRepository.findByDeviceId(
          unregistered.deviceId
        );
        if (!card || card.pairedDeviceId !== unregistered.deviceId) {
          return;
        }

        const appVersion = runtime.presenceService.getAppVersion(
          unregistered.deviceId
        );

        broadcastDeviceStatus({
          cardId: card.id,
          status: "offline",
          deviceId: unregistered.deviceId,
          hasPushToken: Boolean(card.pushToken),
          appVersionCode: appVersion?.appVersionCode ?? null,
          appVersionName: appVersion?.appVersionName ?? null,
        });
      } catch (err) {
        console.error(
          "[PhoneFinder][Socket][/device] Erro em disconnect:",
          err
        );
      }
    });
  });

  return io;
}
