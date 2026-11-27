import assert from "node:assert/strict";
import http from "node:http";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import { io as ioClient, Socket } from "socket.io-client";
import { AuthenticatedUser } from "../src/server/auth";
import { InMemoryPhoneCardRepository } from "../src/server/phoneFinder/cardRepository";
import { IFcmService } from "../src/server/phoneFinder/fcmService";
import { createPhoneFinderRuntime } from "../src/server/phoneFinder/index";
import { attachPhoneFinderSocketServer } from "../src/server/phoneFinder/socketServer";
import { createCardsRouter } from "../src/server/routes/cards.routes";
import {
  AlertLocatePayload,
  AlertVibratePayload,
  CardBatteryPayload,
  CardWithStatus,
  CommandFeedbackPayload,
  DeviceStatusPayload,
  DeviceUnpairedPayload,
  PairingCodeResponse,
  PairingResultPayload,
} from "../src/server/phoneFinder/types";

const VALID_TOKEN = "test-valid-session-token";
const TEST_USER: AuthenticatedUser = {
  id: "user-integration-1",
  name: "Operador Teste",
  email: "operador@hubsupport.local",
  role: "USER",
  active: true,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
  predicate?: (payload: T) => boolean
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout aguardando evento "${event}" (${timeoutMs}ms)`));
    }, timeoutMs);

    const handler = (payload: T) => {
      if (predicate && !predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

async function expectNoEvent<T>(
  socket: Socket,
  event: string,
  windowMs = 250,
  predicate?: (payload: T) => boolean
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const handler = (payload: T) => {
      if (predicate && !predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(event, handler);
      reject(
        new Error(
          `Evento inesperado "${event}" recebido: ${JSON.stringify(payload)}`
        )
      );
    };

    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, windowMs);

    socket.on(event, handler);
  });
}

function connectSocket(
  url: string,
  options?: Parameters<typeof ioClient>[1]
): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
    const socket = ioClient(url, {
      transports: ["websocket"],
      reconnection: false,
      ...options,
    });

    const onConnect = () => {
      socket.off("connect_error", onError);
      resolve(socket);
    };

    const onError = (err: Error) => {
      socket.off("connect", onConnect);
      socket.close();
      reject(err);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
}

async function runIntegrationTests() {
  const repo = new InMemoryPhoneCardRepository();
  const mockFcm: IFcmService = {
    isConfigured: () => false,
    sendCommand: async () => ({ sent: false, error: "FCM mock desativado" }),
  };

  const runtime = createPhoneFinderRuntime({
    cardRepository: repo,
    fcmService: mockFcm,
    pairingOptions: { ttlMs: 300_000, cleanupIntervalMs: 30_000 },
    commandOptions: { ackTimeoutMs: 400 },
  });

  const verifyTestToken = async (
    token: string
  ): Promise<AuthenticatedUser | null> => {
    return token === VALID_TOKEN ? TEST_USER : null;
  };

  const testAuthMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : req.cookies?.token;

    if (!token) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }

    const user = await verifyTestToken(token);
    if (!user) {
      res.status(401).json({ error: "Token inválido." });
      return;
    }

    req.user = user;
    next();
  };

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    "/api/cards",
    createCardsRouter(runtime, { authMiddleware: testAuthMiddleware })
  );

  const httpServer = http.createServer(app);
  const io = attachPhoneFinderSocketServer(httpServer, runtime, {
    verifyToken: verifyTestToken,
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });

  const address = httpServer.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const activeSockets: Socket[] = [];
  const track = (s: Socket): Socket => {
    activeSockets.push(s);
    return s;
  };

  async function apiFetch(
    path: string,
    init: RequestInit = {},
    authenticated = true
  ): Promise<globalThis.Response> {
    const headers = new Headers(init.headers);
    if (authenticated) {
      headers.set("Authorization", `Bearer ${VALID_TOKEN}`);
    }
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  }

  try {
    // -------------------------------------------------------------------------
    // Cenário 1: Segurança REST e /panel
    // -------------------------------------------------------------------------
    const unauthRest = await apiFetch("/api/cards", {}, false);
    assert.equal(unauthRest.status, 401, "GET /api/cards sem token deve retornar 401");

    const badAuthRest = await fetch(`${baseUrl}/api/cards`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    assert.equal(badAuthRest.status, 401, "GET /api/cards com token inválido deve retornar 401");

    await assert.rejects(
      () => connectSocket(`${baseUrl}/panel`),
      (err: Error) => {
        assert.equal(err.message, "UNAUTHORIZED");
        return true;
      },
      "/panel sem token deve rejeitar com UNAUTHORIZED"
    );

    await assert.rejects(
      () =>
        connectSocket(`${baseUrl}/panel`, {
          auth: { token: "token-invalido" },
        }),
      (err: Error) => {
        assert.equal(err.message, "UNAUTHORIZED");
        return true;
      },
      "/panel com token inválido deve rejeitar com UNAUTHORIZED"
    );

    const panelCookieSocket = track(
      await connectSocket(`${baseUrl}/panel`, {
        extraHeaders: {
          Cookie: `other=1; token=${encodeURIComponent(VALID_TOKEN)}`,
        },
      })
    );
    assert.equal(panelCookieSocket.connected, true);
    panelCookieSocket.disconnect();

    const panelSocket = track(
      await connectSocket(`${baseUrl}/panel`, {
        auth: { token: VALID_TOKEN },
      })
    );
    assert.equal(panelSocket.connected, true);
    console.log("✔ Cenário 1: Segurança REST e /panel OK");

    // -------------------------------------------------------------------------
    // Cenário 2: CRUD REST + Review Focus #5 (nome vazio e zero vazamento de pushToken)
    // -------------------------------------------------------------------------
    const emptyNameRes = await apiFetch("/api/cards", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });
    assert.equal(emptyNameRes.status, 400, "POST /api/cards com nome vazio deve retornar 400");

    const createRes = await apiFetch("/api/cards", {
      method: "POST",
      body: JSON.stringify({ name: "Bancada Alpha", description: "Pixel 8 Pro" }),
    });
    assert.equal(createRes.status, 201);
    const card1 = (await createRes.json()) as CardWithStatus;
    assert.equal(card1.name, "Bancada Alpha");
    assert.equal(card1.description, "Pixel 8 Pro");
    assert.equal(card1.status, "unpaired");
    assert.equal(card1.hasPushToken, false);
    assert.equal("pushToken" in card1, false, "POST não pode vazar pushToken");

    const listRes = await apiFetch("/api/cards");
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as CardWithStatus[];
    assert.equal(listBody.length, 1);
    assert.equal(listBody[0].status, "unpaired");
    assert.equal("pushToken" in listBody[0], false);

    const getRes = await apiFetch(`/api/cards/${card1.id}`);
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as CardWithStatus;
    assert.equal(getBody.status, "unpaired");
    assert.equal("pushToken" in getBody, false);

    const badPutRes = await apiFetch(`/api/cards/${card1.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: "   " }),
    });
    assert.equal(badPutRes.status, 400, "PUT com name vazio deve retornar 400");

    const putRes = await apiFetch(`/api/cards/${card1.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: "Bancada Alpha Atualizada",
        description: "Galaxy S24",
      }),
    });
    assert.equal(putRes.status, 200);
    const updatedCard1 = (await putRes.json()) as CardWithStatus;
    assert.equal(updatedCard1.name, "Bancada Alpha Atualizada");
    assert.equal(updatedCard1.description, "Galaxy S24");
    assert.equal("pushToken" in updatedCard1, false);
    console.log("✔ Cenário 2: CRUD REST + Review Focus #5 OK");

    // -------------------------------------------------------------------------
    // Cenário 3: Fluxo completo de pareamento via Socket.IO + REST
    // -------------------------------------------------------------------------
    const pairingCodeRes = await apiFetch(`/api/cards/${card1.id}/pairing-code`, {
      method: "POST",
    });
    assert.equal(pairingCodeRes.status, 200);
    const pairingData = (await pairingCodeRes.json()) as PairingCodeResponse;
    assert.equal(pairingData.cardId, card1.id);
    assert.match(pairingData.code, /^\d{6}$/);

    const device1 = track(await connectSocket(`${baseUrl}/device`));

    const pairingResultPromise = waitForEvent<PairingResultPayload>(
      device1,
      "pairing:result"
    );
    const statusOnlinePromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card1.id && ev.status === "online"
    );

    device1.emit("pairing:submit", {
      code: pairingData.code,
      pushToken: "fcm-secret-token",
    });

    const pairingResult = await pairingResultPromise;
    assert.equal(pairingResult.success, true);
    if (!pairingResult.success) {
      throw new Error("Esperava sucesso no pareamento");
    }
    const device1Id = pairingResult.deviceId;
    assert.ok(device1Id);
    assert.equal(pairingResult.cardId, card1.id);
    assert.equal(pairingResult.cardName, "Bancada Alpha Atualizada");

    const statusOnline = await statusOnlinePromise;
    assert.equal(statusOnline.status, "online");
    assert.equal(statusOnline.deviceId, device1Id);
    assert.equal(statusOnline.hasPushToken, true);
    assert.equal("pushToken" in statusOnline, false, "Broadcast /panel não pode conter pushToken");

    const pairedGetRes = await apiFetch(`/api/cards/${card1.id}`);
    assert.equal(pairedGetRes.status, 200);
    const pairedBody = (await pairedGetRes.json()) as CardWithStatus;
    assert.equal(pairedBody.status, "online");
    assert.equal(pairedBody.hasPushToken, true);
    assert.equal("pushToken" in pairedBody, false, "GET após pareamento não pode vazar pushToken");
    console.log("✔ Cenário 3: Fluxo completo de pareamento via Socket.IO + REST OK");

    // -------------------------------------------------------------------------
    // Cenário 4: Telemetria de bateria (identificado vs não identificado + 0 queries no banco)
    // -------------------------------------------------------------------------
    assert.equal(
      runtime.presenceService.getCardId(device1Id),
      card1.id,
      "pairing:submit deve popular o cache deviceId -> cardId"
    );

    let findByDeviceIdCalls = 0;
    const origFindForBatteryPairing = repo.findByDeviceId.bind(repo);
    repo.findByDeviceId = async (devId) => {
      findByDeviceIdCalls += 1;
      return origFindForBatteryPairing(devId);
    };

    try {
      const batteryReadings = [
        { level: 84, isCharging: true },
        { level: 85, isCharging: true },
        { level: 83, isCharging: false },
      ];

      for (const reading of batteryReadings) {
        const batteryPromise = waitForEvent<CardBatteryPayload>(
          panelSocket,
          "card:battery",
          3000,
          (ev) =>
            ev.cardId === card1.id &&
            ev.level === reading.level &&
            ev.isCharging === reading.isCharging
        );
        device1.emit("device:battery", {
          deviceId: device1Id,
          level: reading.level,
          isCharging: reading.isCharging,
        });
        const batteryEv = await batteryPromise;
        assert.equal(batteryEv.cardId, card1.id);
        assert.equal(batteryEv.deviceId, device1Id);
        assert.equal(batteryEv.level, reading.level);
        assert.equal(batteryEv.isCharging, reading.isCharging);
        assert.equal(Number.isNaN(Date.parse(batteryEv.updatedAt)), false);
      }

      assert.equal(
        findByDeviceIdCalls,
        0,
        `device:battery após pairing:submit deve fazer 0 chamadas a findByDeviceId (fez ${findByDeviceIdCalls})`
      );
    } finally {
      repo.findByDeviceId = origFindForBatteryPairing;
    }

    // Socket não identificado tentando emitir bateria com device1Id → deve ser ignorado
    const rogueDevice = track(await connectSocket(`${baseUrl}/device`));
    const noRogueBattery = expectNoEvent<CardBatteryPayload>(
      panelSocket,
      "card:battery",
      250,
      (ev) => ev.level === 12
    );
    rogueDevice.emit("device:battery", {
      deviceId: device1Id,
      level: 12,
      isCharging: false,
    });
    await noRogueBattery;
    rogueDevice.disconnect();
    console.log(
      "✔ Cenário 4: Telemetria de bateria OK (findByDeviceId calls pós-pairing = 0)"
    );

    // -------------------------------------------------------------------------
    // Cenário 5: Localizar e Vibrar com ACK + Timeout + Target-only (anti-broadcast)
    // -------------------------------------------------------------------------
    // Criar e parear um segundo card + device2 para validar isolamento (target emit)
    const createCard2Res = await apiFetch("/api/cards", {
      method: "POST",
      body: JSON.stringify({ name: "Bancada Beta" }),
    });
    assert.equal(createCard2Res.status, 201);
    const card2 = (await createCard2Res.json()) as CardWithStatus;

    const code2Res = await apiFetch(`/api/cards/${card2.id}/pairing-code`, {
      method: "POST",
    });
    const code2Data = (await code2Res.json()) as PairingCodeResponse;

    const device2 = track(await connectSocket(`${baseUrl}/device`));
    const pair2Promise = waitForEvent<PairingResultPayload>(
      device2,
      "pairing:result"
    );
    device2.emit("pairing:submit", { code: code2Data.code });
    const pair2Result = await pair2Promise;
    assert.equal(pair2Result.success, true);

    // 5a) Localizar card1 → apenas device1 recebe alert:locate; device2 NÃO recebe
    let device2GotLocate = false;
    device2.on("alert:locate", () => {
      device2GotLocate = true;
    });

    const device1LocatePromise = waitForEvent<AlertLocatePayload>(
      device1,
      "alert:locate"
    );
    const panelLocateFeedbackPromise = waitForEvent<CommandFeedbackPayload>(
      panelSocket,
      "locate:feedback",
      3000,
      (fb) => fb.cardId === card1.id
    );

    const locateHttpPromise = apiFetch(`/api/cards/${card1.id}/locate`, {
      method: "POST",
    });

    const locatePayload = await device1LocatePromise;
    assert.equal(locatePayload.action, "locate");
    assert.equal(locatePayload.durationMs, 5000);
    assert.equal(locatePayload.cardName, "Bancada Alpha Atualizada");

    device1.emit("alert:ack", {
      commandId: locatePayload.commandId,
      status: "ok",
      timestamp: Date.now(),
    });

    const locateHttpRes = await locateHttpPromise;
    assert.equal(locateHttpRes.status, 200);
    const locateBody = (await locateHttpRes.json()) as CommandFeedbackPayload;
    assert.equal(locateBody.status, "success");
    assert.equal(locateBody.commandId, locatePayload.commandId);

    const panelLocateFb = await panelLocateFeedbackPromise;
    assert.equal(panelLocateFb.status, "success");
    assert.equal(panelLocateFb.commandId, locatePayload.commandId);

    await sleep(60);
    assert.equal(
      device2GotLocate,
      false,
      "device2 NÃO pode receber alert:locate direcionado ao device1"
    );

    // 5b) Vibrar card1 sem ACK → timeout HTTP 408 + vibrate:feedback
    let device2GotVibrate = false;
    device2.on("alert:vibrate", () => {
      device2GotVibrate = true;
    });

    const device1VibratePromise = waitForEvent<AlertVibratePayload>(
      device1,
      "alert:vibrate"
    );
    const panelVibrateFeedbackPromise = waitForEvent<CommandFeedbackPayload>(
      panelSocket,
      "vibrate:feedback",
      3000,
      (fb) => fb.cardId === card1.id
    );

    const vibrateHttpPromise = apiFetch(`/api/cards/${card1.id}/vibrate`, {
      method: "POST",
    });

    const vibratePayload = await device1VibratePromise;
    assert.equal(vibratePayload.action, "vibrate");
    assert.equal(vibratePayload.durationMs, 3000);

    // Não envia vibrate:ack → espera timeout configurado de 400ms
    const vibrateHttpRes = await vibrateHttpPromise;
    assert.equal(vibrateHttpRes.status, 408);
    const vibrateBody = (await vibrateHttpRes.json()) as CommandFeedbackPayload;
    assert.equal(vibrateBody.status, "timeout");
    assert.equal(vibrateBody.commandId, vibratePayload.commandId);

    const panelVibrateFb = await panelVibrateFeedbackPromise;
    assert.equal(panelVibrateFb.status, "timeout");
    assert.equal(
      device2GotVibrate,
      false,
      "device2 NÃO pode receber alert:vibrate direcionado ao device1"
    );
    console.log("✔ Cenário 5: Localizar (ACK 200) e Vibrar (Timeout 408) + Target-only OK");

    // -------------------------------------------------------------------------
    // Cenário 6: Review Focus #1 — Desvinculação + reconexão offline via device:identify
    // -------------------------------------------------------------------------
    const device1UnpairedPromise = waitForEvent<DeviceUnpairedPayload>(
      device1,
      "device:unpaired"
    );
    const panelUnpairedPromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card1.id && ev.status === "unpaired"
    );

    const unpairRes = await apiFetch(`/api/cards/${card1.id}/unpair`, {
      method: "POST",
    });
    assert.equal(unpairRes.status, 200);
    assert.deepEqual(await unpairRes.json(), { success: true });

    const unpairedMsg = await device1UnpairedPromise;
    assert.ok(unpairedMsg.message.length > 0);

    const panelUnpairedEv = await panelUnpairedPromise;
    assert.equal(panelUnpairedEv.status, "unpaired");
    assert.equal(panelUnpairedEv.deviceId, null);
    assert.equal(panelUnpairedEv.hasPushToken, false);
    assert.equal(
      runtime.presenceService.getCardId(device1Id),
      null,
      "unpairCard deve limpar cache deviceId -> cardId"
    );

    device1.disconnect();

    // Reconexão do aparelho antigo tentando device:identify
    const staleDevice = track(await connectSocket(`${baseUrl}/device`));
    const staleUnpairedPromise = waitForEvent<DeviceUnpairedPayload>(
      staleDevice,
      "device:unpaired"
    );
    const noOnlineBroadcast = expectNoEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      250,
      (ev) => ev.cardId === card1.id && ev.status === "online"
    );

    staleDevice.emit("device:identify", {
      deviceId: device1Id,
      appVersionCode: 10,
      appVersionName: "1.0.0",
    });

    const staleUnpaired = await staleUnpairedPromise;
    assert.ok(staleUnpaired.message.length > 0);
    await noOnlineBroadcast;
    assert.equal(runtime.presenceService.isOnline(device1Id), false);

    const card1AfterStale = (await (
      await apiFetch(`/api/cards/${card1.id}`)
    ).json()) as CardWithStatus;
    assert.equal(card1AfterStale.status, "unpaired");
    staleDevice.disconnect();
    console.log("✔ Cenário 6: Review Focus #1 (desvinculação + reconexão offline) OK");

    // -------------------------------------------------------------------------
    // Cenário 7: Delete de card pareado
    // -------------------------------------------------------------------------
    const device2UnpairedPromise = waitForEvent<DeviceUnpairedPayload>(
      device2,
      "device:unpaired"
    );
    const panelDeleteStatusPromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card2.id && ev.status === "unpaired"
    );

    const deleteRes = await apiFetch(`/api/cards/${card2.id}`, {
      method: "DELETE",
    });
    assert.equal(deleteRes.status, 200);
    assert.deepEqual(await deleteRes.json(), { success: true });

    const dev2Unpaired = await device2UnpairedPromise;
    assert.ok(dev2Unpaired.message.length > 0);

    const panelDelEv = await panelDeleteStatusPromise;
    assert.equal(panelDelEv.status, "unpaired");
    if (pair2Result.success) {
      assert.equal(
        runtime.presenceService.getCardId(pair2Result.deviceId),
        null,
        "deleteCard deve limpar cache deviceId -> cardId"
      );
    }

    const getDeletedRes = await apiFetch(`/api/cards/${card2.id}`);
    assert.equal(getDeletedRes.status, 404);
    console.log("✔ Cenário 7: Delete de card pareado OK");

    // -------------------------------------------------------------------------
    // Cenário 8 (Extra): Eventos /panel (pairing:generate, locate/vibrate:trigger,
    // device:unpair) + device:identify válido (versão, bateria em cache, offline)
    // -------------------------------------------------------------------------
    const card3Res = await apiFetch("/api/cards", {
      method: "POST",
      body: JSON.stringify({ name: "Bancada Gamma" }),
    });
    assert.equal(card3Res.status, 201);
    const card3 = (await card3Res.json()) as CardWithStatus;

    const pairingGenEventPromise = waitForEvent<PairingCodeResponse>(
      panelSocket,
      "pairing:generated",
      3000,
      (ev) => ev.cardId === card3.id
    );
    const ackGen = await new Promise<
      { ok: true; data: PairingCodeResponse } | { ok: false; error: string }
    >((resolve) => {
      panelSocket.emit("pairing:generate", { cardId: card3.id }, resolve);
    });
    assert.equal(ackGen.ok, true);
    const genEv = await pairingGenEventPromise;
    assert.match(genEv.code, /^\d{6}$/);

    const device3 = track(await connectSocket(`${baseUrl}/device`));
    const pair3Promise = waitForEvent<PairingResultPayload>(
      device3,
      "pairing:result"
    );
    device3.emit("pairing:submit", { code: genEv.code });
    const pair3 = await pair3Promise;
    assert.equal(pair3.success, true);
    if (!pair3.success) throw new Error("Esperava pareamento de card3");

    // Salva bateria antes de desconectar
    const bat3Promise = waitForEvent<CardBatteryPayload>(
      panelSocket,
      "card:battery",
      3000,
      (ev) => ev.cardId === card3.id && ev.level === 67
    );
    device3.emit("device:battery", {
      deviceId: pair3.deviceId,
      level: 67,
      isCharging: false,
    });
    await bat3Promise;

    // Disconnect -> status offline no /panel
    const offlinePromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card3.id && ev.status === "offline"
    );
    device3.disconnect();
    const offlineEv = await offlinePromise;
    assert.equal(offlineEv.status, "offline");
    assert.equal(offlineEv.deviceId, pair3.deviceId);

    // Reconecta com device:identify informando versão + pushToken -> online + bateria reenviada
    const device3Re = track(await connectSocket(`${baseUrl}/device`));
    const reOnlinePromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card3.id && ev.status === "online"
    );
    const reBatteryPromise = waitForEvent<CardBatteryPayload>(
      panelSocket,
      "card:battery",
      3000,
      (ev) => ev.cardId === card3.id && ev.level === 67
    );
    device3Re.emit("device:identify", {
      deviceId: pair3.deviceId,
      pushToken: "updated-fcm-token",
      appVersionCode: 42,
      appVersionName: "1.2.3",
    });

    const reOnlineEv = await reOnlinePromise;
    assert.equal(reOnlineEv.hasPushToken, true);
    assert.equal(reOnlineEv.appVersionCode, 42);
    assert.equal(reOnlineEv.appVersionName, "1.2.3");
    assert.equal("pushToken" in reOnlineEv, false);
    const reBatteryEv = await reBatteryPromise;
    assert.equal(reBatteryEv.level, 67);

    // Após device:identify, múltiplos eventos device:battery devem executar 0 queries no banco
    assert.equal(
      runtime.presenceService.getCardId(pair3.deviceId),
      card3.id,
      "device:identify deve manter/popular cache deviceId -> cardId"
    );
    let identifyBatteryDbCalls = 0;
    const origFindForIdentifyBattery = repo.findByDeviceId.bind(repo);
    repo.findByDeviceId = async (devId) => {
      identifyBatteryDbCalls += 1;
      return origFindForIdentifyBattery(devId);
    };
    try {
      for (const [level, isCharging] of [
        [68, true],
        [69, true],
        [70, false],
      ] as const) {
        const nextBatPromise = waitForEvent<CardBatteryPayload>(
          panelSocket,
          "card:battery",
          3000,
          (ev) =>
            ev.cardId === card3.id &&
            ev.level === level &&
            ev.isCharging === isCharging
        );
        device3Re.emit("device:battery", {
          deviceId: pair3.deviceId,
          level,
          isCharging,
        });
        const nextBatEv = await nextBatPromise;
        assert.equal(nextBatEv.cardId, card3.id);
        assert.equal(nextBatEv.deviceId, pair3.deviceId);
        assert.equal(nextBatEv.level, level);
        assert.equal(nextBatEv.isCharging, isCharging);
      }
      assert.equal(
        identifyBatteryDbCalls,
        0,
        `device:battery após device:identify deve fazer 0 chamadas a findByDeviceId (fez ${identifyBatteryDbCalls})`
      );
    } finally {
      repo.findByDeviceId = origFindForIdentifyBattery;
    }

    // Trigger via /panel socket (locate:trigger + alert:ack)
    const dev3LocatePromise = waitForEvent<AlertLocatePayload>(
      device3Re,
      "alert:locate"
    );
    const panelTrigFbPromise = waitForEvent<CommandFeedbackPayload>(
      panelSocket,
      "locate:feedback",
      3000,
      (fb) => fb.cardId === card3.id
    );
    panelSocket.emit("locate:trigger", { cardId: card3.id });
    const dev3Locate = await dev3LocatePromise;
    device3Re.emit("alert:ack", {
      commandId: dev3Locate.commandId,
      status: "ok",
      timestamp: Date.now(),
    });
    const panelTrigFb = await panelTrigFbPromise;
    assert.equal(panelTrigFb.status, "success");

    // Unpair via /panel socket (device:unpair)
    const dev3UnpairedPromise = waitForEvent<DeviceUnpairedPayload>(
      device3Re,
      "device:unpaired"
    );
    const ackUnpair = await new Promise<{ ok: true } | { ok: false; error: string }>(
      (resolve) => {
        panelSocket.emit("device:unpair", { cardId: card3.id }, resolve);
      }
    );
    assert.equal(ackUnpair.ok, true);
    await dev3UnpairedPromise;
    assert.equal(
      runtime.presenceService.getCardId(pair3.deviceId),
      null,
      "device:unpair via /panel deve limpar cache deviceId -> cardId"
    );
    console.log(
      "✔ Cenário 8: Eventos /panel + reconexão device:identify com versão/bateria OK (findByDeviceId calls pós-identify = 0)"
    );

    // -------------------------------------------------------------------------
    // Cenário 9: Regressão — ack não-função em /panel & disconnect durante await
    // -------------------------------------------------------------------------
    // 9a) ack não-função em pairing:generate e device:unpair não pode derrubar o servidor
    const nonFnGenPromise = waitForEvent<PairingCodeResponse>(
      panelSocket,
      "pairing:generated",
      3000,
      (ev) => ev.cardId === card3.id
    );
    panelSocket.emit("pairing:generate", { cardId: card3.id }, "not-a-function");
    const nonFnGen = await nonFnGenPromise;
    assert.match(nonFnGen.code, /^\d{6}$/);

    const nonFnUnpairStatusPromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card3.id && ev.status === "unpaired"
    );
    panelSocket.emit("device:unpair", { cardId: card3.id }, 12345);
    await nonFnUnpairStatusPromise;

    // Também testa payload inválido com ack não-função (garante ramo de erro seguro)
    panelSocket.emit("pairing:generate", { cardId: "" }, { invalid: true });
    panelSocket.emit("device:unpair", { cardId: "inexistente" }, "bad-ack");
    await sleep(60);

    // 9b) Disconnect durante await em pairing:submit → não vaza presença online e emite offline
    const slowCodeRes = await apiFetch(`/api/cards/${card3.id}/pairing-code`, {
      method: "POST",
    });
    const slowCodeData = (await slowCodeRes.json()) as PairingCodeResponse;

    const origPairDevice = repo.pairDevice.bind(repo);
    let releasePairDevice!: () => void;
    let pairDeviceStartedResolve!: () => void;
    const pairDeviceStarted = new Promise<void>((r) => {
      pairDeviceStartedResolve = r;
    });
    repo.pairDevice = async (id, deviceId, pushToken) => {
      pairDeviceStartedResolve();
      await new Promise<void>((r) => {
        releasePairDevice = r;
      });
      return origPairDevice(id, deviceId, pushToken);
    };

    const ephemeralPairSocket = track(await connectSocket(`${baseUrl}/device`));
    const offlineAfterDisconnectPromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card3.id && ev.status === "offline"
    );
    ephemeralPairSocket.emit("pairing:submit", { code: slowCodeData.code });
    await pairDeviceStarted;
    ephemeralPairSocket.disconnect();
    await sleep(50);
    releasePairDevice();
    repo.pairDevice = origPairDevice;

    const offlineAfterDisconnect = await offlineAfterDisconnectPromise;
    assert.equal(offlineAfterDisconnect.status, "offline");
    assert.ok(offlineAfterDisconnect.deviceId);
    assert.equal(
      runtime.presenceService.isOnline(offlineAfterDisconnect.deviceId),
      false,
      "Socket morto durante pairing:submit não pode ficar registrado como online"
    );
    assert.equal(
      runtime.presenceService.getCardId(offlineAfterDisconnect.deviceId),
      card3.id,
      "pairing:submit com disconnect durante await ainda deve popular cache deviceId -> cardId"
    );

    // 9c) Disconnect durante await em device:identify → não registra presença nem emite online
    const pairedDeviceId3 = offlineAfterDisconnect.deviceId;
    const origFindByDeviceId = repo.findByDeviceId.bind(repo);
    let releaseIdentify!: () => void;
    let identifyStartedResolve!: () => void;
    const identifyStarted = new Promise<void>((r) => {
      identifyStartedResolve = r;
    });
    repo.findByDeviceId = async (devId) => {
      if (devId === pairedDeviceId3) {
        identifyStartedResolve();
        await new Promise<void>((r) => {
          releaseIdentify = r;
        });
      }
      return origFindByDeviceId(devId);
    };

    const ephemeralIdentifySocket = track(await connectSocket(`${baseUrl}/device`));
    const noOnlineLeak = expectNoEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      250,
      (ev) => ev.cardId === card3.id && ev.status === "online"
    );
    ephemeralIdentifySocket.emit("device:identify", {
      deviceId: pairedDeviceId3,
    });
    await identifyStarted;
    ephemeralIdentifySocket.disconnect();
    await sleep(50);
    releaseIdentify();
    repo.findByDeviceId = origFindByDeviceId;

    await noOnlineLeak;
    assert.equal(
      runtime.presenceService.isOnline(pairedDeviceId3),
      false,
      "Socket morto durante device:identify não pode vazar presença online"
    );
    console.log("✔ Cenário 9: Regressão ack não-função + disconnect durante await OK");

    // Cenário 10: Prevenção de race condition entre device:identify e device:battery instantâneo
    const card10 = await repo.create({ name: "Aparelho Telemetria Instantânea" });
    const devId10 = "device-instant-telemetry-10";
    await repo.pairDevice(card10.id, devId10);
    runtime.presenceService.clearDevice(devId10);

    const device10Socket = track(await connectSocket(`${baseUrl}/device`));

    const bat10Promise = waitForEvent<CardBatteryPayload>(
      panelSocket,
      "card:battery",
      3000,
      (ev) => ev.cardId === card10.id && ev.deviceId === devId10 && ev.level === 82
    );
    const online10Promise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status",
      3000,
      (ev) => ev.cardId === card10.id && ev.deviceId === devId10 && ev.status === "online"
    );

    // Emite consecutivamente sem delay (exatamente como o Android faz no EVENT_CONNECT)
    device10Socket.emit("device:identify", {
      deviceId: devId10,
      appVersionCode: 120,
      appVersionName: "1.2.0",
    });
    device10Socket.emit("device:battery", {
      deviceId: devId10,
      level: 82,
      isCharging: false,
    });

    const [online10Ev, bat10Ev] = await Promise.all([online10Promise, bat10Promise]);
    assert.equal(online10Ev.status, "online");
    assert.equal(bat10Ev.level, 82);
    assert.equal(bat10Ev.isCharging, false);

    const storedBattery = runtime.presenceService.getBattery(devId10);
    assert.notEqual(storedBattery, null, "presenceService deve reter a telemetria inicial da bateria");
    assert.equal(storedBattery?.level, 82);

    // Próximas emissões de bateria não devem fazer consultas repetidas ao banco
    let dbCalls10 = 0;
    const origFind10 = repo.findByDeviceId.bind(repo);
    repo.findByDeviceId = async (devId) => {
      dbCalls10 += 1;
      return origFind10(devId);
    };

    try {
      const bat10UpdatePromise = waitForEvent<CardBatteryPayload>(
        panelSocket,
        "card:battery",
        3000,
        (ev) => ev.cardId === card10.id && ev.level === 83
      );
      device10Socket.emit("device:battery", {
        deviceId: devId10,
        level: 83,
        isCharging: true,
      });
      const updatedBat10 = await bat10UpdatePromise;
      assert.equal(updatedBat10.level, 83);
      assert.equal(updatedBat10.isCharging, true);
      assert.equal(
        dbCalls10,
        0,
        `device:battery subsequente deve fazer 0 chamadas a findByDeviceId (fez ${dbCalls10})`
      );
    } finally {
      repo.findByDeviceId = origFind10;
    }

    console.log("✔ Cenário 10: Resolução de race condition device:identify / device:battery instantâneo OK");

    console.log("\n✅ Todos os cenários de integração do Phone Finder passaram!");
  } finally {
    for (const socket of activeSockets) {
      if (socket.connected || socket.active) {
        socket.disconnect();
      }
      socket.close();
    }
    runtime.stop();
    await new Promise<void>((resolve) => {
      io.close(() => {
        if (httpServer.listening) {
          httpServer.close(() => resolve());
        } else {
          resolve();
        }
      });
    });
  }
}

runIntegrationTests().catch((err) => {
  console.error("❌ Falha na suíte de integração do Phone Finder:", err);
  process.exit(1);
});
