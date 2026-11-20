import assert from "node:assert/strict";
import crypto from "node:crypto";
import { InMemoryPhoneCardRepository } from "../src/server/phoneFinder/cardRepository";
import { PairingService } from "../src/server/phoneFinder/pairingService";
import { PresenceService } from "../src/server/phoneFinder/presenceService";
import {
  FcmCommandParams,
  FcmSendResult,
  FcmService,
  IFcmService,
} from "../src/server/phoneFinder/fcmService";
import {
  CommandService,
  LOCATE_DURATION_MS,
  VIBRATE_DURATION_MS,
} from "../src/server/phoneFinder/commandService";
import {
  createPhoneFinderRuntime,
  enrichCardWithStatus,
} from "../src/server/phoneFinder/index";
import {
  AlertLocatePayload,
  AlertVibratePayload,
  CommandAction,
  CommandFeedbackPayload,
  DeviceStatusPayload,
} from "../src/server/phoneFinder/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MockFcmService implements IFcmService {
  configured: boolean;
  calls: FcmCommandParams[] = [];
  nextResult: FcmSendResult | ((params: FcmCommandParams) => Promise<FcmSendResult> | FcmSendResult);

  constructor(
    configured = true,
    nextResult:
      | FcmSendResult
      | ((params: FcmCommandParams) => Promise<FcmSendResult> | FcmSendResult) = {
      sent: true,
      messageId: "mock-msg-id",
    }
  ) {
    this.configured = configured;
    this.nextResult = nextResult;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendCommand(params: FcmCommandParams): Promise<FcmSendResult> {
    this.calls.push(params);
    if (typeof this.nextResult === "function") {
      return await this.nextResult(params);
    }
    return this.nextResult;
  }
}

async function testPairingService() {
  const repo = new InMemoryPhoneCardRepository();
  const pairing = new PairingService(repo, {
    ttlMs: 80,
    cleanupIntervalMs: 30_000,
    maxFailedAttemptsPerMinute: 10,
  });

  try {
    // Card inexistente retorna null
    assert.equal(await pairing.generateCode(crypto.randomUUID()), null);

    const card = await repo.create({ name: "Bancada 01" });

    // 1. Gera código 6 dígitos e invalida anterior ao gerar novo
    const first = await pairing.generateCode(card.id);
    assert.ok(first);
    assert.equal(first.cardId, card.id);
    assert.match(first.code, /^\d{6}$/);
    assert.equal(Number.isNaN(Date.parse(first.expiresAt)), false);

    const second = await pairing.generateCode(card.id);
    assert.ok(second);
    assert.match(second.code, /^\d{6}$/);

    if (first.code !== second.code) {
      const oldResult = await pairing.submitCode(first.code, "token-old", "client-old");
      assert.equal(oldResult.success, false, "Código anterior deve ser invalidado imediatamente");
    }

    // 2. Ordem estrita de validação:
    // (1) Formato inválido
    const invalidFmt = await pairing.submitCode("12ab56", undefined, "client-fmt");
    assert.equal(invalidFmt.success, false);
    assert.match(invalidFmt.error.toLowerCase(), /6 d[íi]gitos|inv[áa]lido/);

    // (2) Código inexistente
    const nonexistentCode = second.code === "999999" ? "111111" : "999999";
    const missingRes = await pairing.submitCode(nonexistentCode, undefined, "client-missing");
    assert.equal(missingRes.success, false);
    assert.match(missingRes.error.toLowerCase(), /n[ãa]o encontrado|inv[áa]lido|utilizado/);

    // (3) Código expirado (ttlMs = 80ms)
    await sleep(110);
    const expiredRes = await pairing.submitCode(second.code, undefined, "client-expired");
    assert.equal(expiredRes.success, false);
    assert.match(expiredRes.error.toLowerCase(), /expirado/);

    // (4) Card deletado após geração de código
    const tempCard = await repo.create({ name: "Card Temporário" });
    const tempCode = await pairing.generateCode(tempCard.id);
    assert.ok(tempCode);
    await repo.delete(tempCard.id);
    const deletedCardRes = await pairing.submitCode(tempCode.code, undefined, "client-deleted");
    assert.equal(deletedCardRes.success, false);
    assert.match(deletedCardRes.error.toLowerCase(), /card|n[ãa]o.*encontrado/);

    // (5) Sucesso + consumo único
    const freshCode = await pairing.generateCode(card.id);
    assert.ok(freshCode);
    const paired1 = await pairing.submitCode(freshCode.code, "fcm-token-1", "client-ok");
    assert.equal(paired1.success, true);
    if (paired1.success) {
      assert.ok(paired1.deviceId);
      assert.equal(paired1.previousDeviceId, null);
      assert.equal(paired1.card.pairedDeviceId, paired1.deviceId);
      assert.equal(paired1.card.pushToken, "fcm-token-1");

      // Reuso do mesmo código deve falhar
      const reuseRes = await pairing.submitCode(freshCode.code, "fcm-token-1", "client-ok");
      assert.equal(reuseRes.success, false, "Código deve ser de uso único");

      // Troca de aparelho em card já pareado retorna previousDeviceId
      const replaceCode = await pairing.generateCode(card.id);
      assert.ok(replaceCode);
      const paired2 = await pairing.submitCode(replaceCode.code, "fcm-token-2", "client-ok-2");
      assert.equal(paired2.success, true);
      if (paired2.success) {
        assert.equal(paired2.previousDeviceId, paired1.deviceId);
        assert.notEqual(paired2.deviceId, paired1.deviceId);
        assert.equal(paired2.card.pairedDeviceId, paired2.deviceId);
        assert.equal(paired2.card.pushToken, "fcm-token-2");
      }
    }

    // invalidateCardCode
    const toInvalidate = await pairing.generateCode(card.id);
    assert.ok(toInvalidate);
    pairing.invalidateCardCode(card.id);
    const afterInvalidate = await pairing.submitCode(toInvalidate.code, undefined, "client-inv");
    assert.equal(afterInvalidate.success, false);

    // Rate limit: 10 tentativas inválidas por minuto bloqueiam a 11ª (mesmo com código válido)
    const ratePairing = new PairingService(repo, {
      ttlMs: 60_000,
      cleanupIntervalMs: 30_000,
      maxFailedAttemptsPerMinute: 10,
    });
    try {
      const validCodeForRl = await ratePairing.generateCode(card.id);
      assert.ok(validCodeForRl);

      const attackerKey = "ip:10.0.0.99";
      for (let i = 0; i < 10; i++) {
        const failRes = await ratePairing.submitCode("000000", undefined, attackerKey);
        assert.equal(failRes.success, false);
      }

      // 11ª tentativa do mesmo clientKey deve ser bloqueada pelo rate limit mesmo com código válido
      const blockedRes = await ratePairing.submitCode(
        validCodeForRl.code,
        "token-blocked",
        attackerKey
      );
      assert.equal(blockedRes.success, false);
      assert.match(blockedRes.error.toLowerCase(), /muitas tentativas|limite|aguarde/);

      // Outro clientKey não foi afetado e consegue parear com o código ainda válido
      const legitRes = await ratePairing.submitCode(
        validCodeForRl.code,
        "token-legit",
        "ip:10.0.0.100"
      );
      assert.equal(legitRes.success, true);
    } finally {
      ratePairing.stop();
    }
  } finally {
    pairing.stop();
  }

  console.log("✔ Cenário 1 (PairingService) passou");
}

async function testPresenceService() {
  const presence = new PresenceService();
  const deviceId = crypto.randomUUID();

  // Reconexão rápida com dois sockets sobrepostos (Review Focus #2)
  presence.registerSocket(deviceId, "socket-1", {
    appVersionCode: 10,
    appVersionName: "1.0.0",
  });
  presence.registerSocket(deviceId, "socket-2", {
    appVersionCode: 11,
    appVersionName: "1.1.0",
  });

  assert.equal(presence.isOnline(deviceId), true);
  assert.deepEqual(presence.getSockets(deviceId).sort(), ["socket-1", "socket-2"]);
  assert.equal(presence.getDeviceBySocket("socket-1"), deviceId);
  assert.equal(presence.getDeviceBySocket("socket-2"), deviceId);
  assert.deepEqual(presence.getAppVersion(deviceId), {
    appVersionCode: 11,
    appVersionName: "1.1.0",
  });

  // Desconectar socket-1 não pode derrubar deviceId para offline
  const firstDisconnect = presence.unregisterSocket("socket-1");
  assert.deepEqual(firstDisconnect, { deviceId, wentOffline: false });
  assert.equal(presence.isOnline(deviceId), true);
  assert.deepEqual(presence.getSockets(deviceId), ["socket-2"]);
  assert.equal(presence.getDeviceBySocket("socket-1"), null);

  // Desconectar último socket marca wentOffline: true
  const secondDisconnect = presence.unregisterSocket("socket-2");
  assert.deepEqual(secondDisconnect, { deviceId, wentOffline: true });
  assert.equal(presence.isOnline(deviceId), false);
  assert.deepEqual(presence.getSockets(deviceId), []);
  assert.equal(presence.unregisterSocket("socket-unknown"), null);

  // Telemetria de bateria
  const battery = presence.setBattery(deviceId, 84, true);
  assert.equal(battery.level, 84);
  assert.equal(battery.isCharging, true);
  assert.equal(Number.isNaN(Date.parse(battery.updatedAt)), false);
  assert.deepEqual(presence.getBattery(deviceId), battery);

  // clearDevice retorna sockets ativos e limpa presença + bateria + versão
  presence.registerSocket(deviceId, "socket-3");
  const clearedSockets = presence.clearDevice(deviceId);
  assert.deepEqual(clearedSockets, ["socket-3"]);
  assert.equal(presence.isOnline(deviceId), false);
  assert.equal(presence.getDeviceBySocket("socket-3"), null);
  assert.equal(presence.getBattery(deviceId), null);
  assert.equal(presence.getAppVersion(deviceId), null);

  console.log("✔ Cenário 2 (PresenceService / Review Focus #2) passou");
}

async function testFcmServiceFallback() {
  const prevJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const prevPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  try {
    const fcm = new FcmService();
    assert.equal(fcm.isConfigured(), false);
    const res = await fcm.sendCommand({
      pushToken: "some-token",
      commandId: crypto.randomUUID(),
      action: "locate",
      durationMs: LOCATE_DURATION_MS,
      timestamp: new Date().toISOString(),
      cardName: "Teste",
    });
    assert.equal(res.sent, false);
    assert.ok(res.error);
  } finally {
    if (prevJson !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prevJson;
    if (prevPath !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT_PATH = prevPath;
  }

  console.log("✔ Cenário 3 (FcmService fallback gracioso) passou");
}

async function testCommandServiceScenarios() {
  // Cenário 4: Entrega dupla simultânea + ACK (locate e vibrate)
  {
    const repo = new InMemoryPhoneCardRepository();
    const presence = new PresenceService();
    const fcm = new MockFcmService(true, { sent: true, messageId: "fcm-1" });
    const commands = new CommandService(repo, presence, fcm, { ackTimeoutMs: 500 });

    const emitted: Array<{
      deviceId: string;
      event: string;
      payload: AlertLocatePayload | AlertVibratePayload;
    }> = [];
    const feedbacks: Array<{ action: CommandAction; feedback: CommandFeedbackPayload }> = [];

    commands.setTransportHooks({
      emitToDevice: (deviceId, event, payload) => {
        emitted.push({ deviceId, event, payload });
      },
      broadcastCommandFeedback: (action, feedback) => {
        feedbacks.push({ action, feedback });
      },
    });

    try {
      const card = await repo.create({ name: "Moto G84" });
      const deviceId = crypto.randomUUID();
      await repo.pairDevice(card.id, deviceId, "valid-fcm-token");
      presence.registerSocket(deviceId, "sock-a");

      const dispatchPromise = commands.dispatchCommand(card.id, "locate");
      await sleep(10);

      assert.equal(commands.hasInFlight(card.id), true);
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].deviceId, deviceId);
      assert.equal(emitted[0].event, "alert:locate");
      assert.equal(emitted[0].payload.durationMs, LOCATE_DURATION_MS);
      assert.equal(emitted[0].payload.cardName, "Moto G84");

      assert.equal(fcm.calls.length, 1);
      assert.equal(fcm.calls[0].pushToken, "valid-fcm-token");
      assert.equal(fcm.calls[0].commandId, emitted[0].payload.commandId);
      assert.equal(fcm.calls[0].action, "locate");
      assert.equal(fcm.calls[0].durationMs, LOCATE_DURATION_MS);

      const ackAccepted = commands.handleAck(
        emitted[0].payload.commandId,
        "ok",
        Date.now(),
        deviceId
      );
      assert.equal(ackAccepted, true);

      const outcome = await dispatchPromise;
      assert.equal(outcome.httpStatus, 200);
      assert.equal(outcome.feedback.status, "success");
      assert.equal(outcome.feedback.cardId, card.id);
      assert.equal(outcome.feedback.commandId, emitted[0].payload.commandId);
      assert.equal(commands.hasInFlight(card.id), false);
      assert.equal(feedbacks.length, 1);
      assert.equal(feedbacks[0].action, "locate");
      assert.equal(feedbacks[0].feedback.status, "success");

      // Vibrate usa VIBRATE_DURATION_MS (3000)
      const vibPromise = commands.dispatchCommand(card.id, "vibrate");
      await sleep(10);
      assert.equal(emitted[1].event, "alert:vibrate");
      assert.equal(emitted[1].payload.durationMs, VIBRATE_DURATION_MS);
      commands.handleAck(emitted[1].payload.commandId, "ok", Date.now(), deviceId);
      const vibOutcome = await vibPromise;
      assert.equal(vibOutcome.httpStatus, 200);
      assert.equal(vibOutcome.feedback.status, "success");
    } finally {
      commands.stop();
    }
    console.log("✔ Cenário 4 (CommandService entrega dupla + ACK) passou");
  }

  // Cenário 5: ACK acordado via FCM (sem device:identify -> socketDeviceId = undefined)
  {
    const repo = new InMemoryPhoneCardRepository();
    const presence = new PresenceService();
    const fcm = new MockFcmService(true, { sent: true });
    const commands = new CommandService(repo, presence, fcm, { ackTimeoutMs: 500 });

    try {
      const card = await repo.create({ name: "Pixel 8" });
      const deviceId = crypto.randomUUID();
      await repo.pairDevice(card.id, deviceId, "fcm-wake-token");
      // Device está offline no WebSocket, mas tem pushToken + FCM configurado
      const dispatchPromise = commands.dispatchCommand(card.id, "locate");
      await sleep(15);

      assert.equal(fcm.calls.length, 1);
      const commandId = fcm.calls[0].commandId;

      // ACK chega sem socketDeviceId (socket recém acordado pelo FCM)
      const accepted = commands.handleAck(commandId, "ok", Date.now(), undefined);
      assert.equal(accepted, true);

      const outcome = await dispatchPromise;
      assert.equal(outcome.httpStatus, 200);
      assert.equal(outcome.feedback.status, "success");
    } finally {
      commands.stop();
    }
    console.log("✔ Cenário 5 (CommandService ACK acordado via FCM) passou");
  }

  // Cenário 6 (Review Focus #4): ACK forjado por outro device + timeout + ACK tardio
  {
    const repo = new InMemoryPhoneCardRepository();
    const presence = new PresenceService();
    const fcm = new MockFcmService(false);
    const commands = new CommandService(repo, presence, fcm, { ackTimeoutMs: 120 });

    let capturedCommandId = "";
    const feedbacks: CommandFeedbackPayload[] = [];
    commands.setTransportHooks({
      emitToDevice: (_deviceId, _event, payload) => {
        capturedCommandId = payload.commandId;
      },
      broadcastCommandFeedback: (_action, feedback) => {
        feedbacks.push(feedback);
      },
    });

    try {
      const card = await repo.create({ name: "Galaxy S24" });
      const deviceId = crypto.randomUUID();
      await repo.pairDevice(card.id, deviceId, null);
      presence.registerSocket(deviceId, "sock-s24");

      const dispatchPromise = commands.dispatchCommand(card.id, "locate");
      await sleep(15);
      assert.ok(capturedCommandId);

      // ACK forjado por outro dispositivo identificado deve ser ignorado
      const forgedAccepted = commands.handleAck(
        capturedCommandId,
        "ok",
        Date.now(),
        "outro-device-id"
      );
      assert.equal(forgedAccepted, false);
      assert.equal(commands.hasInFlight(card.id), true);
      assert.equal(feedbacks.length, 0);

      // Aguarda timeout
      const outcome = await dispatchPromise;
      assert.equal(outcome.httpStatus, 408);
      assert.equal(outcome.feedback.status, "timeout");
      assert.equal(feedbacks.length, 1);
      assert.equal(commands.hasInFlight(card.id), false);

      // ACK tardio (após timeout) deve ser descartado silenciosamente sem segundo feedback
      const lateAccepted = commands.handleAck(capturedCommandId, "ok", Date.now(), deviceId);
      assert.equal(lateAccepted, false);
      assert.equal(feedbacks.length, 1);
    } finally {
      commands.stop();
    }
    console.log("✔ Cenário 6 (CommandService Review Focus #4: ACK forjado + tardio) passou");
  }

  // Cenário 7: Concorrência (409) + 404 / 400 / 503 offline sem push
  {
    const repo = new InMemoryPhoneCardRepository();
    const presence = new PresenceService();
    const fcm = new MockFcmService(false);
    const commands = new CommandService(repo, presence, fcm, { ackTimeoutMs: 400 });

    let capturedCommandId = "";
    const feedbacks: CommandFeedbackPayload[] = [];
    commands.setTransportHooks({
      emitToDevice: (_deviceId, _event, payload) => {
        capturedCommandId = payload.commandId;
      },
      broadcastCommandFeedback: (_action, feedback) => {
        feedbacks.push(feedback);
      },
    });

    try {
      // 404 card inexistente
      const notFound = await commands.dispatchCommand(crypto.randomUUID(), "locate");
      assert.equal(notFound.httpStatus, 404);

      // 400 card não pareado
      const card = await repo.create({ name: "iPhone Teste" });
      const unpaired = await commands.dispatchCommand(card.id, "locate");
      assert.equal(unpaired.httpStatus, 400);

      // 503 card pareado offline sem push
      const deviceId = crypto.randomUUID();
      await repo.pairDevice(card.id, deviceId, null);
      const offlineNoPush = await commands.dispatchCommand(card.id, "locate");
      assert.equal(offlineNoPush.httpStatus, 503);
      assert.equal(offlineNoPush.feedback.status, "error");
      assert.equal(feedbacks.length, 1);

      // 409 concorrência
      presence.registerSocket(deviceId, "sock-concur");
      const firstPromise = commands.dispatchCommand(card.id, "locate");
      await sleep(10);

      const secondOutcome = await commands.dispatchCommand(card.id, "vibrate");
      assert.equal(secondOutcome.httpStatus, 409);
      assert.equal(secondOutcome.feedback.status, "error");

      commands.handleAck(capturedCommandId, "ok", Date.now(), deviceId);
      const firstOutcome = await firstPromise;
      assert.equal(firstOutcome.httpStatus, 200);
    } finally {
      commands.stop();
    }
    console.log("✔ Cenário 7 (CommandService concorrência 409 + 404/400/503) passou");
  }

  // Cenário 8 (Review Focus #3): Falha rápida offline + limpeza de pushToken inválido
  {
    const repo = new InMemoryPhoneCardRepository();
    const presence = new PresenceService();
    const fcm = new MockFcmService(true, {
      sent: false,
      invalidToken: true,
      error: "Requested entity was not found.",
    });
    // Timeout longo de 5s para provar que fail-fast cancela o timer imediatamente
    const commands = new CommandService(repo, presence, fcm, { ackTimeoutMs: 5000 });

    const statusUpdates: DeviceStatusPayload[] = [];
    const feedbacks: CommandFeedbackPayload[] = [];
    commands.setTransportHooks({
      broadcastDeviceStatus: (payload) => statusUpdates.push(payload),
      broadcastCommandFeedback: (_action, feedback) => feedbacks.push(feedback),
    });

    try {
      const card = await repo.create({ name: "Redmi Note 13" });
      const deviceId = crypto.randomUUID();
      await repo.pairDevice(card.id, deviceId, "revoked-fcm-token");

      const startedAt = Date.now();
      const outcome = await commands.dispatchCommand(card.id, "locate");
      const elapsedMs = Date.now() - startedAt;

      assert.equal(outcome.httpStatus, 503);
      assert.equal(outcome.feedback.status, "error");
      assert.ok(
        elapsedMs < 1000,
        `Fail-fast offline deve resolver imediatamente (levou ${elapsedMs}ms)`
      );
      assert.equal(commands.hasInFlight(card.id), false);

      const updatedCard = await repo.findById(card.id);
      assert.ok(updatedCard);
      assert.equal(updatedCard.pushToken, null, "pushToken inválido deve ser limpo no repositório");

      assert.equal(statusUpdates.length, 1);
      assert.equal(statusUpdates[0].cardId, card.id);
      assert.equal(statusUpdates[0].status, "offline");
      assert.equal(statusUpdates[0].hasPushToken, false);

      assert.equal(feedbacks.length, 1);
      assert.equal(feedbacks[0].status, "error");
    } finally {
      commands.stop();
    }
    console.log("✔ Cenário 8 (CommandService Review Focus #3: fail-fast + limpeza de token) passou");
  }

  // Cenário 9: Online com falha FCM não faz fail-fast e aguarda ACK do WebSocket
  {
    const repo = new InMemoryPhoneCardRepository();
    const presence = new PresenceService();
    const fcm = new MockFcmService(true, {
      sent: false,
      error: "FCM 503 temporary outage",
    });
    const commands = new CommandService(repo, presence, fcm, { ackTimeoutMs: 500 });

    let capturedCommandId = "";
    commands.setTransportHooks({
      emitToDevice: (_deviceId, _event, payload) => {
        capturedCommandId = payload.commandId;
      },
    });

    try {
      const card = await repo.create({ name: "Poco X6" });
      const deviceId = crypto.randomUUID();
      await repo.pairDevice(card.id, deviceId, "fcm-token-x6");
      presence.registerSocket(deviceId, "sock-x6");

      const dispatchPromise = commands.dispatchCommand(card.id, "locate");
      await sleep(40);

      // Mesmo após FCM falhar, o comando continua pendente aguardando WebSocket ACK
      assert.equal(fcm.calls.length, 1);
      assert.equal(commands.hasInFlight(card.id), true);

      commands.handleAck(capturedCommandId, "ok", Date.now(), deviceId);
      const outcome = await dispatchPromise;
      assert.equal(outcome.httpStatus, 200);
      assert.equal(outcome.feedback.status, "success");
    } finally {
      commands.stop();
    }
    console.log("✔ Cenário 9 (CommandService online com falha FCM aguarda WebSocket) passou");
  }

  // Cenário 10: ACK de erro do dispositivo -> 502 + status "error"
  {
    const repo = new InMemoryPhoneCardRepository();
    const presence = new PresenceService();
    const fcm = new MockFcmService(false);
    const commands = new CommandService(repo, presence, fcm, { ackTimeoutMs: 500 });

    let capturedCommandId = "";
    const feedbacks: CommandFeedbackPayload[] = [];
    commands.setTransportHooks({
      emitToDevice: (_deviceId, _event, payload) => {
        capturedCommandId = payload.commandId;
      },
      broadcastCommandFeedback: (_action, feedback) => {
        feedbacks.push(feedback);
      },
    });

    try {
      const card = await repo.create({ name: "Zenfone 10" });
      const deviceId = crypto.randomUUID();
      await repo.pairDevice(card.id, deviceId, null);
      presence.registerSocket(deviceId, "sock-zen");

      const dispatchPromise = commands.dispatchCommand(card.id, "vibrate");
      await sleep(10);

      const accepted = commands.handleAck(capturedCommandId, "error", Date.now(), deviceId);
      assert.equal(accepted, true);

      const outcome = await dispatchPromise;
      assert.equal(outcome.httpStatus, 502);
      assert.equal(outcome.feedback.status, "error");
      assert.equal(feedbacks.length, 1);
      assert.equal(feedbacks[0].status, "error");
    } finally {
      commands.stop();
    }
    console.log("✔ Cenário 10 (CommandService ACK de erro -> 502) passou");
  }
}

async function testRuntimeAndEnrich() {
  const repo = new InMemoryPhoneCardRepository();
  const runtime = createPhoneFinderRuntime({
    cardRepository: repo,
    fcmService: new MockFcmService(false),
  });

  try {
    const card = await runtime.cardRepository.create({ name: "Bancada QA" });
    const unpairedView = enrichCardWithStatus(card, runtime.presenceService);
    assert.equal(unpairedView.status, "unpaired");
    assert.equal(unpairedView.hasPushToken, false);
    assert.equal("pushToken" in unpairedView, false);

    const deviceId = crypto.randomUUID();
    const pairedCard = await runtime.cardRepository.pairDevice(card.id, deviceId, "secret-token");
    assert.ok(pairedCard);

    const offlineView = enrichCardWithStatus(pairedCard, runtime.presenceService);
    assert.equal(offlineView.status, "offline");
    assert.equal(offlineView.hasPushToken, true);
    assert.equal("pushToken" in offlineView, false);

    runtime.presenceService.registerSocket(deviceId, "sock-qa", {
      appVersionCode: 4,
      appVersionName: "1.4.0",
    });
    runtime.presenceService.setBattery(deviceId, 67, false);

    const onlineView = enrichCardWithStatus(pairedCard, runtime.presenceService);
    assert.equal(onlineView.status, "online");
    assert.equal(onlineView.battery?.level, 67);
    assert.equal(onlineView.battery?.isCharging, false);
    assert.equal(onlineView.appVersionCode, 4);
    assert.equal(onlineView.appVersionName, "1.4.0");
    assert.equal("pushToken" in onlineView, false);
  } finally {
    runtime.stop();
  }

  console.log("✔ Runtime & enrichCardWithStatus passou");
}

async function main() {
  await testPairingService();
  await testPresenceService();
  await testFcmServiceFallback();
  await testCommandServiceScenarios();
  await testRuntimeAndEnrich();
  console.log("\nTodos os 10 cenários + runtime da Task 2 passaram com sucesso!");
}

main().catch((err) => {
  console.error("Falha nos testes da Task 2:", err);
  process.exit(1);
});
