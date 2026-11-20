import {
  IPhoneCardRepository,
  PrismaPhoneCardRepository,
} from "./cardRepository";
import { CommandService, CommandServiceOptions } from "./commandService";
import { FcmService, IFcmService } from "./fcmService";
import { PairingService, PairingServiceOptions } from "./pairingService";
import { PresenceService } from "./presenceService";
import {
  CardWithStatus,
  DevicePresenceStatus,
  PhoneCardRecord,
  toPublicPhoneCard,
} from "./types";

export interface PhoneFinderRuntime {
  cardRepository: IPhoneCardRepository;
  pairingService: PairingService;
  presenceService: PresenceService;
  fcmService: IFcmService;
  commandService: CommandService;
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

  return {
    cardRepository,
    pairingService,
    presenceService,
    fcmService,
    commandService,
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
