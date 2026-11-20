import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  PhoneCardRecord,
  toPublicPhoneCard,
} from "../src/server/phoneFinder/types";
import {
  IPhoneCardRepository,
  InMemoryPhoneCardRepository,
  PrismaPhoneCardRepository,
} from "../src/server/phoneFinder/cardRepository";

async function testToPublicPhoneCard() {
  const now = new Date().toISOString();

  const withToken: PhoneCardRecord = {
    id: crypto.randomUUID(),
    name: "Bancada 01",
    description: "Samsung Galaxy A54",
    pairedDeviceId: crypto.randomUUID(),
    pushToken: "super-secret-fcm-token-xyz",
    createdAt: now,
    updatedAt: now,
  };

  const pubWithToken = toPublicPhoneCard(withToken);
  assert.equal(pubWithToken.id, withToken.id);
  assert.equal(pubWithToken.name, withToken.name);
  assert.equal(pubWithToken.description, withToken.description);
  assert.equal(pubWithToken.pairedDeviceId, withToken.pairedDeviceId);
  assert.equal(pubWithToken.hasPushToken, true);
  assert.equal(pubWithToken.createdAt, withToken.createdAt);
  assert.equal(pubWithToken.updatedAt, withToken.updatedAt);
  assert.equal("pushToken" in pubWithToken, false, "PublicPhoneCard nunca deve conter pushToken");
  assert.equal(
    JSON.stringify(pubWithToken).includes("super-secret-fcm-token-xyz"),
    false,
    "Serialização pública nunca deve vazar o valor de pushToken"
  );

  const withoutToken: PhoneCardRecord = {
    ...withToken,
    pushToken: null,
  };
  const pubWithoutToken = toPublicPhoneCard(withoutToken);
  assert.equal(pubWithoutToken.hasPushToken, false);
  assert.equal("pushToken" in pubWithoutToken, false);

  const emptyToken: PhoneCardRecord = {
    ...withToken,
    pushToken: "",
  };
  const pubEmptyToken = toPublicPhoneCard(emptyToken);
  assert.equal(pubEmptyToken.hasPushToken, false);
  assert.equal("pushToken" in pubEmptyToken, false);

  console.log("✔ toPublicPhoneCard passou");
}

async function runRepositoryContractSuite(
  label: string,
  repo: IPhoneCardRepository,
  createdIds: string[]
) {
  const uniqueSuffix = crypto.randomUUID().slice(0, 8);
  const first = await repo.create({
    name: `Card 1 ${uniqueSuffix}`,
    description: "Primeiro aparelho de teste",
  });
  createdIds.push(first.id);

  assert.ok(first.id, `${label}: create deve gerar id`);
  assert.equal(first.name, `Card 1 ${uniqueSuffix}`);
  assert.equal(first.description, "Primeiro aparelho de teste");
  assert.equal(first.pairedDeviceId, null);
  assert.equal(first.pushToken, null);
  assert.equal(Number.isNaN(Date.parse(first.createdAt)), false);
  assert.equal(Number.isNaN(Date.parse(first.updatedAt)), false);

  // Garantir timestamp estritamente maior para validar ordenação createdAt desc
  await new Promise((resolve) => setTimeout(resolve, 15));

  const second = await repo.create({
    name: `Card 2 ${uniqueSuffix}`,
  });
  createdIds.push(second.id);
  assert.equal(second.description, null);

  // findById
  const fetched = await repo.findById(first.id);
  assert.ok(fetched);
  assert.equal(fetched.id, first.id);
  assert.equal(await repo.findById(crypto.randomUUID()), null);

  // findAll ordenação createdAt desc
  const all = await repo.findAll();
  const idxSecond = all.findIndex((c) => c.id === second.id);
  const idxFirst = all.findIndex((c) => c.id === first.id);
  assert.notEqual(idxSecond, -1, `${label}: second deve aparecer em findAll`);
  assert.notEqual(idxFirst, -1, `${label}: first deve aparecer em findAll`);
  assert.ok(
    idxSecond < idxFirst,
    `${label}: findAll deve ordenar por createdAt desc (second idx=${idxSecond}, first idx=${idxFirst})`
  );

  // update
  const updated = await repo.update(first.id, {
    name: `Card 1 Atualizado ${uniqueSuffix}`,
    description: "Descrição atualizada",
  });
  assert.ok(updated);
  assert.equal(updated.name, `Card 1 Atualizado ${uniqueSuffix}`);
  assert.equal(updated.description, "Descrição atualizada");
  assert.equal(await repo.update(crypto.randomUUID(), { name: "Inexistente" }), null);

  // pairDevice + findByDeviceId
  const deviceId = crypto.randomUUID();
  const paired = await repo.pairDevice(first.id, deviceId, "fcm-token-inicial");
  assert.ok(paired);
  assert.equal(paired.pairedDeviceId, deviceId);
  assert.equal(paired.pushToken, "fcm-token-inicial");

  const foundByDevice = await repo.findByDeviceId(deviceId);
  assert.ok(foundByDevice);
  assert.equal(foundByDevice.id, first.id);
  assert.equal(await repo.findByDeviceId(crypto.randomUUID()), null);

  // Unicidade de pairedDeviceId
  await assert.rejects(
    async () => {
      await repo.pairDevice(second.id, deviceId, "outro-token");
    },
    `${label}: deve rejeitar pairedDeviceId duplicado em outro card`
  );

  // updatePushToken
  const withUpdatedToken = await repo.updatePushToken(first.id, "fcm-token-novo");
  assert.ok(withUpdatedToken);
  assert.equal(withUpdatedToken.pushToken, "fcm-token-novo");

  const withClearedToken = await repo.updatePushToken(first.id, null);
  assert.ok(withClearedToken);
  assert.equal(withClearedToken.pushToken, null);
  assert.equal(await repo.updatePushToken(crypto.randomUUID(), "x"), null);

  // unpairDevice
  const unpaired = await repo.unpairDevice(first.id);
  assert.ok(unpaired);
  assert.equal(unpaired.pairedDeviceId, null);
  assert.equal(unpaired.pushToken, null);
  assert.equal(await repo.findByDeviceId(deviceId), null);
  assert.equal(await repo.unpairDevice(crypto.randomUUID()), null);

  // delete
  const deletedFirst = await repo.delete(first.id);
  assert.equal(deletedFirst, true);
  assert.equal(await repo.findById(first.id), null);
  assert.equal(await repo.delete(first.id), false);

  const deletedSecond = await repo.delete(second.id);
  assert.equal(deletedSecond, true);

  console.log(`✔ ${label} passou`);
}

async function main() {
  await testToPublicPhoneCard();

  const memoryIds: string[] = [];
  const inMemoryRepo = new InMemoryPhoneCardRepository();
  await runRepositoryContractSuite("InMemoryPhoneCardRepository", inMemoryRepo, memoryIds);

  const prismaIds: string[] = [];
  const prismaRepo = new PrismaPhoneCardRepository();
  try {
    await runRepositoryContractSuite("PrismaPhoneCardRepository", prismaRepo, prismaIds);
  } finally {
    for (const id of prismaIds) {
      await prisma.phoneCard.deleteMany({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log("\nTodos os testes da Task 1 (repositório e contratos) passaram!");
}

main().catch((err) => {
  console.error("Falha nos testes da Task 1:", err);
  process.exit(1);
});
