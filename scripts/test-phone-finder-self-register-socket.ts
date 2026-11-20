import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { io as ioClient, Socket } from "socket.io-client";
import { AuthenticatedUser } from "../src/server/auth";
import { InMemoryPhoneCardRepository } from "../src/server/phoneFinder/cardRepository";
import { IFcmService } from "../src/server/phoneFinder/fcmService";
import { createPhoneFinderRuntime } from "../src/server/phoneFinder/index";
import { attachPhoneFinderSocketServer } from "../src/server/phoneFinder/socketServer";
import {
  CardWithStatus,
  DeviceStatusPayload,
  DeviceUnpairedPayload,
  PairingResultPayload,
} from "../src/server/phoneFinder/types";

const VALID_TOKEN = "test-token-self-register";
const TEST_USER: AuthenticatedUser = {
  id: "user-test-self-register",
  name: "Operador Teste",
  email: "operador@hubsupport.local",
  role: "USER",
  active: true,
};

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

async function runTests() {
  console.log("=== Iniciando testes de integração: device:self-register ===");

  const app = express();
  const server = http.createServer(app);

  const repo = new InMemoryPhoneCardRepository();
  const mockFcm: IFcmService = {
    isConfigured: () => false,
    sendCommand: async () => ({ sent: false, error: "Mock FCM" }),
  };

  const runtime = createPhoneFinderRuntime({
    cardRepository: repo,
    fcmService: mockFcm,
    pairingOptions: { ttlMs: 60_000, cleanupIntervalMs: 10_000 },
    commandOptions: { ackTimeoutMs: 500 },
  });

  const ioServer = attachPhoneFinderSocketServer(server, runtime, {
    verifyToken: async (token) => (token === VALID_TOKEN ? TEST_USER : null),
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  let panelSocket: Socket | null = null;
  let deviceSocket1: Socket | null = null;
  let deviceSocket2: Socket | null = null;

  try {
    // 1. Conecta socket no /panel autenticado
    panelSocket = await connectSocket(`${baseUrl}/panel`, {
      auth: { token: VALID_TOKEN },
    });
    assert.equal(panelSocket.connected, true);

    // 2. Conecta socket do dispositivo 1 em /device
    deviceSocket1 = await connectSocket(`${baseUrl}/device`);
    assert.equal(deviceSocket1.connected, true);

    // -------------------------------------------------------------------------
    // Cenário 1 & 2: Cadastro inicial de novo aparelho via device:self-register
    // -------------------------------------------------------------------------
    console.log("Teste 1 & 2: Cadastro inicial de aparelho e broadcast de card:created");

    const pResult1Promise = waitForEvent<PairingResultPayload>(
      deviceSocket1,
      "pairing:result"
    );
    const pCardCreatedPromise = waitForEvent<CardWithStatus>(
      panelSocket,
      "card:created"
    );
    const pDeviceStatusPromise = waitForEvent<DeviceStatusPayload>(
      panelSocket,
      "device:status"
    );

    deviceSocket1.emit("device:self-register", {
      deviceId: "device-test-1",
      numbers: ["8299", "1234"],
      pushToken: "token-fcm-1",
      appVersionCode: 10,
      appVersionName: "1.0.0",
    });

    const result1 = await pResult1Promise;
    assert.equal(result1.success, true);
    if (!result1.success) throw new Error("Falha no pareamento");

    assert.equal(result1.deviceId, "device-test-1");
    assert.equal(result1.cardName, "8299 | 1234");
    assert.ok(result1.cardId, "cardId deve estar presente");

    const createdCard = await pCardCreatedPromise;
    assert.equal(createdCard.id, result1.cardId);
    assert.equal(createdCard.name, "8299 | 1234");
    assert.equal(createdCard.pairedDeviceId, "device-test-1");
    assert.equal(createdCard.status, "online");
    assert.equal(createdCard.hasPushToken, true);

    const initialStatus = await pDeviceStatusPromise;
    assert.equal(initialStatus.cardId, result1.cardId);
    assert.equal(initialStatus.status, "online");
    assert.equal(initialStatus.deviceId, "device-test-1");

    console.log("  ✓ Cadastro inicial criou card com status online e formato 8299 | 1234");

    // -------------------------------------------------------------------------
    // Cenário 3: Reenvio com o mesmo deviceId alterando números emite card:updated
    // -------------------------------------------------------------------------
    console.log("Teste 3: Edição de números pelo mesmo deviceId emite card:updated");

    const pResult2Promise = waitForEvent<PairingResultPayload>(
      deviceSocket1,
      "pairing:result"
    );
    const pCardUpdatedPromise = waitForEvent<CardWithStatus>(
      panelSocket,
      "card:updated"
    );

    deviceSocket1.emit("device:self-register", {
      deviceId: "device-test-1",
      numbers: ["8299", "1234", "0845"],
      appVersionCode: 11,
      appVersionName: "1.1.0",
    });

    const result2 = await pResult2Promise;
    assert.equal(result2.success, true);
    if (!result2.success) throw new Error("Falha no pareamento");

    assert.equal(result2.cardId, result1.cardId, "Deve manter o mesmo cardId");
    assert.equal(result2.cardName, "8299 | 1234 | 0845");

    const updatedCard = await pCardUpdatedPromise;
    assert.equal(updatedCard.id, result1.cardId);
    assert.equal(updatedCard.name, "8299 | 1234 | 0845");
    assert.equal(updatedCard.pairedDeviceId, "device-test-1");

    console.log("  ✓ Reenvio atualizou o card existente para '8299 | 1234 | 0845' no painel");

    // -------------------------------------------------------------------------
    // Cenário 4: Envio de números idênticos por novo deviceId transfere posse
    // -------------------------------------------------------------------------
    console.log("Teste 4: Transferência de posse para novo deviceId com números idênticos");

    deviceSocket2 = await connectSocket(`${baseUrl}/device`);
    assert.equal(deviceSocket2.connected, true);

    const pUnpairedPromise = waitForEvent<DeviceUnpairedPayload>(
      deviceSocket1,
      "device:unpaired"
    );
    const pResult3Promise = waitForEvent<PairingResultPayload>(
      deviceSocket2,
      "pairing:result"
    );
    const pCardUpdatedTransferPromise = waitForEvent<CardWithStatus>(
      panelSocket,
      "card:updated"
    );

    deviceSocket2.emit("device:self-register", {
      deviceId: "device-test-2",
      numbers: ["8299", "1234", "0845"],
      pushToken: "token-fcm-2",
    });

    const unpairedNotice = await pUnpairedPromise;
    assert.ok(
      unpairedNotice.message.includes("substituído") ||
        unpairedNotice.message.includes("desvinculado")
    );

    const result3 = await pResult3Promise;
    assert.equal(result3.success, true);
    if (!result3.success) throw new Error("Falha no pareamento");
    assert.equal(result3.deviceId, "device-test-2");
    assert.equal(result3.cardId, result1.cardId, "Deve manter o card existente");

    const transferredCard = await pCardUpdatedTransferPromise;
    assert.equal(transferredCard.id, result1.cardId);
    assert.equal(transferredCard.pairedDeviceId, "device-test-2");
    assert.equal(transferredCard.status, "online");

    console.log("  ✓ Transferência de titularidade desvinculou device-1 e atualizou para device-2");

    // -------------------------------------------------------------------------
    // Cenário 5: Validação de entradas inválidas
    // -------------------------------------------------------------------------
    console.log("Teste 5: Rejeição de payload com números inválidos ou sem deviceId");

    const pInvalidNumbersPromise = waitForEvent<PairingResultPayload>(
      deviceSocket2,
      "pairing:result"
    );
    deviceSocket2.emit("device:self-register", {
      deviceId: "device-test-2",
      numbers: ["123", "abc", ""],
    });
    const invalidResult = await pInvalidNumbersPromise;
    assert.equal(invalidResult.success, false);
    if (!invalidResult.success) {
      assert.ok(invalidResult.error.includes("Nenhum número de 4 dígitos informado"));
    }

    const pMissingDevicePromise = waitForEvent<PairingResultPayload>(
      deviceSocket2,
      "pairing:result"
    );
    deviceSocket2.emit("device:self-register", {
      deviceId: "   ",
      numbers: ["1234"],
    });
    const missingDeviceResult = await pMissingDevicePromise;
    assert.equal(missingDeviceResult.success, false);

    console.log("  ✓ Payloads inválidos rejeitados com feedback de erro adequado");

    console.log("\nTodos os testes de device:self-register passaram com sucesso!");
  } finally {
    if (deviceSocket1) deviceSocket1.close();
    if (deviceSocket2) deviceSocket2.close();
    if (panelSocket) panelSocket.close();
    await new Promise<void>((resolve) => {
      ioServer.close(() => {
        server.close(() => resolve());
      });
    });
    runtime.stop();
  }
}

runTests().catch((err) => {
  console.error("Erro nos testes:", err);
  process.exit(1);
});
