import {
  IPhoneCardRepository,
  PrismaPhoneCardRepository,
} from "./cardRepository";
import { CommandService, CommandServiceOptions } from "./commandService";
import { FcmService, IFcmService } from "./fcmService";
import { PairingService, PairingServiceOptions } from "./pairingService";
import { PresenceService } from "./presenceService";
import {
  CardBatteryPayload,
  CardWithStatus,
  CommandAction,
  CommandFeedbackPayload,
  DevicePresenceStatus,
  DeviceStatusPayload,
  PhoneCardRecord,
  toPublicPhoneCard,
} from "./types";

export interface PhoneFinderRealtimeTransport {
  notifyDeviceUnpaired?: (deviceId: string, message?: string) => void;
  broadcastDeviceStatus?: (payload: DeviceStatusPayload) => void;
  broadcastBattery?: (payload: CardBatteryPayload) => void;
  broadcastCommandFeedback?: (
    action: CommandAction,
    feedback: CommandFeedbackPayload
  ) => void;
  broadcastCardCreated?: (card: CardWithStatus) => void;
  broadcastCardUpdated?: (card: CardWithStatus) => void;
}

export interface PhoneFinderRuntime {
  cardRepository: IPhoneCardRepository;
  pairingService: PairingService;
  presenceService: PresenceService;
  fcmService: IFcmService;
  commandService: CommandService;
  setRealtimeTransport: (transport: PhoneFinderRealtimeTransport) => void;
  unpairCard: (cardId: string) => Promise<PhoneCardRecord | null>;
  deleteCard: (cardId: string) => Promise<boolean>;
  stop: () => void;
}

export interface PhoneFinderRuntimeOverrides {
  cardRepository?: IPhoneCardRepository;
  presenceService?: PresenceService;
  fcmService?: IFcmService;
  pairingOptions?: PairingServiceOptions;
  commandOptions?: CommandServiceOptions;
}

export function enrichCardWithStatus(
  card: PhoneCardRecord,
  presenceService: PresenceService
): CardWithStatus {
  const publicCard = toPublicPhoneCard(card);
  let status: DevicePresenceStatus = "unpaired";

  if (card.pairedDeviceId) {
    status = presenceService.isOnline(card.pairedDeviceId)
      ? "online"
      : "offline";
  }

  const battery = card.pairedDeviceId
    ? presenceService.getBattery(card.pairedDeviceId)
    : null;
  const appVersion = card.pairedDeviceId
    ? presenceService.getAppVersion(card.pairedDeviceId)
    : null;

  return {
    ...publicCard,
    status,
    battery,
    appVersionCode: appVersion?.appVersionCode ?? null,
    appVersionName: appVersion?.appVersionName ?? null,
  };
}

export function createPhoneFinderRuntime(
  overrides?: PhoneFinderRuntimeOverrides
): PhoneFinderRuntime {
  const cardRepository =
    overrides?.cardRepository ?? new PrismaPhoneCardRepository();
  const presenceService = overrides?.presenceService ?? new PresenceService();
  const fcmService = overrides?.fcmService ?? new FcmService();
  const pairingService = new PairingService(
    cardRepository,
    overrides?.pairingOptions
  );
  const commandService = new CommandService(
    cardRepository,
    presenceService,
    fcmService,
    overrides?.commandOptions
  );

  let realtimeTransport: PhoneFinderRealtimeTransport = {};

  const setRealtimeTransport = (
    transport: PhoneFinderRealtimeTransport
  ): void => {
    realtimeTransport = { ...realtimeTransport, ...transport };
  };

  const unpairCard = async (cardId: string): Promise<PhoneCardRecord | null> => {
    const existing = await cardRepository.findById(cardId);
    if (!existing) {
      return null;
    }

    const previousDeviceId = existing.pairedDeviceId;
    pairingService.invalidateCardCode(cardId);

    const updated = await cardRepository.unpairDevice(cardId);
    if (!updated) {
      return null;
    }

    if (previousDeviceId) {
      realtimeTransport.notifyDeviceUnpaired?.(
        previousDeviceId,
        "Este dispositivo foi desvinculado do painel."
      );
      presenceService.clearDevice(previousDeviceId);
    }

    realtimeTransport.broadcastDeviceStatus?.({
      cardId: updated.id,
      status: "unpaired",
      deviceId: null,
      hasPushToken: false,
      appVersionCode: null,
      appVersionName: null,
    });

    return updated;
  };

  const deleteCard = async (cardId: string): Promise<boolean> => {
    const existing = await cardRepository.findById(cardId);
    if (!existing) {
      return false;
    }

    const previousDeviceId = existing.pairedDeviceId;
    pairingService.invalidateCardCode(cardId);

    const deleted = await cardRepository.delete(cardId);
    if (!deleted) {
      return false;
    }

    if (previousDeviceId) {
      realtimeTransport.notifyDeviceUnpaired?.(
        previousDeviceId,
        "Este dispositivo foi desvinculado porque o card foi excluído do painel."
      );
      presenceService.clearDevice(previousDeviceId);
    }

    realtimeTransport.broadcastDeviceStatus?.({
      cardId,
      status: "unpaired",
      deviceId: null,
      hasPushToken: false,
      appVersionCode: null,
      appVersionName: null,
    });

    return true;
  };

  return {
    cardRepository,
    pairingService,
    presenceService,
    fcmService,
    commandService,
    setRealtimeTransport,
    unpairCard,
    deleteCard,
    stop: () => {
      pairingService.stop();
      commandService.stop();
    },
  };
}

export const phoneFinderRuntime = createPhoneFinderRuntime();

export * from "./types";
export * from "./cardRepository";
export * from "./pairingService";
export * from "./presenceService";
export * from "./fcmService";
export * from "./commandService";
