import crypto from "node:crypto";
import { Prisma, PhoneCard as PrismaPhoneCard } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { PhoneCardRecord } from "./types";

export interface CreatePhoneCardInput {
  name: string;
  description?: string | null;
}

export interface UpdatePhoneCardInput {
  name?: string;
  description?: string | null;
}

export interface IPhoneCardRepository {
  findAll(): Promise<PhoneCardRecord[]>;
  findById(id: string): Promise<PhoneCardRecord | null>;
  findByDeviceId(deviceId: string): Promise<PhoneCardRecord | null>;
  create(data: CreatePhoneCardInput): Promise<PhoneCardRecord>;
  update(id: string, data: UpdatePhoneCardInput): Promise<PhoneCardRecord | null>;
  delete(id: string): Promise<boolean>;
  pairDevice(
    id: string,
    deviceId: string,
    pushToken?: string | null
  ): Promise<PhoneCardRecord | null>;
  unpairDevice(id: string): Promise<PhoneCardRecord | null>;
  updatePushToken(
    id: string,
    pushToken: string | null
  ): Promise<PhoneCardRecord | null>;
}

function mapPrismaCard(row: PrismaPhoneCard): PhoneCardRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pairedDeviceId: row.pairedDeviceId,
    pushToken: row.pushToken,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isRecordNotFoundError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"
  );
}

export class PrismaPhoneCardRepository implements IPhoneCardRepository {
  async findAll(): Promise<PhoneCardRecord[]> {
    const rows = await prisma.phoneCard.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapPrismaCard);
  }

  async findById(id: string): Promise<PhoneCardRecord | null> {
    const row = await prisma.phoneCard.findUnique({
      where: { id },
    });
    return row ? mapPrismaCard(row) : null;
  }

  async findByDeviceId(deviceId: string): Promise<PhoneCardRecord | null> {
    const row = await prisma.phoneCard.findUnique({
      where: { pairedDeviceId: deviceId },
    });
    return row ? mapPrismaCard(row) : null;
  }

  async create(data: CreatePhoneCardInput): Promise<PhoneCardRecord> {
    const row = await prisma.phoneCard.create({
      data: {
        name: data.name,
        description: data.description ?? null,
      },
    });
    return mapPrismaCard(row);
  }

  async update(
    id: string,
    data: UpdatePhoneCardInput
  ): Promise<PhoneCardRecord | null> {
    try {
      const updateData: Prisma.PhoneCardUpdateInput = {};
      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      const row = await prisma.phoneCard.update({
        where: { id },
        data: updateData,
      });
      return mapPrismaCard(row);
    } catch (err) {
      if (isRecordNotFoundError(err)) {
        return null;
      }
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.phoneCard.delete({
        where: { id },
      });
      return true;
    } catch (err) {
      if (isRecordNotFoundError(err)) {
        return false;
      }
      throw err;
    }
  }

  async pairDevice(
    id: string,
    deviceId: string,
    pushToken?: string | null
  ): Promise<PhoneCardRecord | null> {
    try {
      const row = await prisma.phoneCard.update({
        where: { id },
        data: {
          pairedDeviceId: deviceId,
          pushToken: pushToken ?? null,
        },
      });
      return mapPrismaCard(row);
    } catch (err) {
      if (isRecordNotFoundError(err)) {
        return null;
      }
      throw err;
    }
  }

  async unpairDevice(id: string): Promise<PhoneCardRecord | null> {
    try {
      const row = await prisma.phoneCard.update({
        where: { id },
        data: {
          pairedDeviceId: null,
          pushToken: null,
        },
      });
      return mapPrismaCard(row);
    } catch (err) {
      if (isRecordNotFoundError(err)) {
        return null;
      }
      throw err;
    }
  }

  async updatePushToken(
    id: string,
    pushToken: string | null
  ): Promise<PhoneCardRecord | null> {
    try {
      const row = await prisma.phoneCard.update({
        where: { id },
        data: { pushToken },
      });
      return mapPrismaCard(row);
    } catch (err) {
      if (isRecordNotFoundError(err)) {
        return null;
      }
      throw err;
    }
  }
}

export class InMemoryPhoneCardRepository implements IPhoneCardRepository {
  private readonly cards = new Map<string, PhoneCardRecord>();

  private clone(card: PhoneCardRecord): PhoneCardRecord {
    return { ...card };
  }

  async findAll(): Promise<PhoneCardRecord[]> {
    return Array.from(this.cards.values())
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((card) => this.clone(card));
  }

  async findById(id: string): Promise<PhoneCardRecord | null> {
    const card = this.cards.get(id);
    return card ? this.clone(card) : null;
  }

  async findByDeviceId(deviceId: string): Promise<PhoneCardRecord | null> {
    for (const card of this.cards.values()) {
      if (card.pairedDeviceId === deviceId) {
        return this.clone(card);
      }
    }
    return null;
  }

  async create(data: CreatePhoneCardInput): Promise<PhoneCardRecord> {
    const now = new Date().toISOString();
    const record: PhoneCardRecord = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description ?? null,
      pairedDeviceId: null,
      pushToken: null,
      createdAt: now,
      updatedAt: now,
    };
    this.cards.set(record.id, record);
    return this.clone(record);
  }

  async update(
    id: string,
    data: UpdatePhoneCardInput
  ): Promise<PhoneCardRecord | null> {
    const existing = this.cards.get(id);
    if (!existing) {
      return null;
    }

    const updated: PhoneCardRecord = {
      ...existing,
      name: data.name !== undefined ? data.name : existing.name,
      description:
        data.description !== undefined ? data.description : existing.description,
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(id, updated);
    return this.clone(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.cards.delete(id);
  }

  async pairDevice(
    id: string,
    deviceId: string,
    pushToken?: string | null
  ): Promise<PhoneCardRecord | null> {
    const existing = this.cards.get(id);
    if (!existing) {
      return null;
    }

    for (const other of this.cards.values()) {
      if (other.id !== id && other.pairedDeviceId === deviceId) {
        const error = new Error(
          `Unique constraint failed on pairedDeviceId: ${deviceId}`
        ) as Error & { code?: string };
        error.code = "P2002";
        throw error;
      }
    }

    const updated: PhoneCardRecord = {
      ...existing,
      pairedDeviceId: deviceId,
      pushToken: pushToken ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(id, updated);
    return this.clone(updated);
  }

  async unpairDevice(id: string): Promise<PhoneCardRecord | null> {
    const existing = this.cards.get(id);
    if (!existing) {
      return null;
    }

    const updated: PhoneCardRecord = {
      ...existing,
      pairedDeviceId: null,
      pushToken: null,
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(id, updated);
    return this.clone(updated);
  }

  async updatePushToken(
    id: string,
    pushToken: string | null
  ): Promise<PhoneCardRecord | null> {
    const existing = this.cards.get(id);
    if (!existing) {
      return null;
    }

    const updated: PhoneCardRecord = {
      ...existing,
      pushToken,
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(id, updated);
    return this.clone(updated);
  }
}
