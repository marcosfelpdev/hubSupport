// =============================================================================
// Phone Finder — Contratos de Domínio, DTOs REST e Payloads Socket.IO (SPEC v1.0)
// =============================================================================

export type DevicePresenceStatus = "unpaired" | "online" | "offline";
export type CommandAction = "locate" | "vibrate";
export type CommandAckStatus = "ok" | "error";
export type CommandFeedbackStatus = "success" | "timeout" | "error";

export interface BatteryTelemetry {
  level: number;        // inteiro 0..100
  isCharging: boolean;
  updatedAt: string;    // ISO 8601
}

export interface AppVersionInfo {
  appVersionCode: number | null;
  appVersionName: string | null;
}

/**
 * Registro interno persistido no banco de dados (inclui segredo pushToken).
 * Nunca deve ser serializado diretamente para respostas HTTP ou eventos /panel.
 */
export interface PhoneCardRecord {
  id: string;                      // UUID v4
  name: string;
  description: string | null;
  pairedDeviceId: string | null;   // UUID v4 ou null
  pushToken: string | null;        // segredo FCM (uso interno apenas)
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}

/**
 * Representação pública de um card (substitui pushToken por hasPushToken).
 */
export interface PublicPhoneCard {
  id: string;                      // UUID v4
  name: string;
  description: string | null;
  pairedDeviceId: string | null;   // UUID v4 ou null
  hasPushToken: boolean;           // substitui pushToken sem vazar o segredo
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}

/**
 * Card enriquecido com estado de presença, bateria e versão do app em memória.
 */
export interface CardWithStatus extends PublicPhoneCard {
  status: DevicePresenceStatus;
  battery: BatteryTelemetry | null;
  appVersionCode: number | null;
  appVersionName: string | null;
}

export interface PairingCodeResponse {
  cardId: string;
  code: string;        // 6 dígitos numéricos "100000".."999999"
  expiresAt: string;   // ISO 8601
}

export interface CommandFeedbackPayload {
  cardId: string;
  commandId: string;   // UUID v4 (ou "" se falhar antes de gerar comando)
  status: CommandFeedbackStatus;
  message: string;     // descrição legível em português
}

export interface FormatCardTitleSuccess {
  success: true;
  title: string;
  validNumbers: string[];
}

export interface FormatCardTitleError {
  success: false;
  error: string;
}

export type FormatCardTitleResult =
  | FormatCardTitleSuccess
  | FormatCardTitleError;


// -----------------------------------------------------------------------------
// Payloads dos 18 Eventos Socket.IO (Seção 5.4 da Spec)
// -----------------------------------------------------------------------------

// 1-4: Namespace /panel — Painel -> Servidor
export interface PairingGeneratePayload {
  cardId: string;
}

export interface DeviceUnpairPayload {
  cardId: string;
}

export interface LocateTriggerPayload {
  cardId: string;
}

export interface VibrateTriggerPayload {
  cardId: string;
}

// 5-9: Namespace /panel — Servidor -> Painel
export type PairingGeneratedPayload = PairingCodeResponse;

export interface DeviceStatusPayload {
  cardId: string;
  status: DevicePresenceStatus;
  deviceId?: string | null;
  hasPushToken?: boolean;
  appVersionCode?: number | null;
  appVersionName?: string | null;
}

export interface CardBatteryPayload {
  cardId: string;
  deviceId: string;
  level: number;
  isCharging: boolean;
  updatedAt: string;   // ISO 8601
}

export type LocateFeedbackPayload = CommandFeedbackPayload;
export type VibrateFeedbackPayload = CommandFeedbackPayload;

// 10-14: Namespace /device — App -> Servidor
export interface PairingSubmitPayload {
  code: string;
  pushToken?: string;
}

export interface DeviceIdentifyPayload {
  deviceId: string;
  pushToken?: string;
  appVersionCode?: number;
  appVersionName?: string;
}

export interface DeviceSelfRegisterPayload {
  deviceId: string;
  numbers: string[];
  pushToken?: string | null;
  appVersionCode?: number | null;
  appVersionName?: string | null;
}

export interface DeviceBatteryPayload {
  deviceId: string;
  level: number;
  isCharging?: boolean;
}

export interface AlertAckPayload {
  commandId: string;
  status: CommandAckStatus;
  timestamp: number;   // Unix epoch em ms (exceção da Seção 5.5 da SPEC)
}

export interface VibrateAckPayload {
  commandId: string;
  status: CommandAckStatus;
  timestamp: number;   // Unix epoch em ms (exceção da Seção 5.5 da SPEC)
}

// 15-18: Namespace /device — Servidor -> App (target emit exclusivo)
export interface PairingResultSuccessPayload {
  success: true;
  deviceId: string;
  cardId: string;
  cardName: string;
}

export interface PairingResultErrorPayload {
  success: false;
  error: string;
}

export type PairingResultPayload =
  | PairingResultSuccessPayload
  | PairingResultErrorPayload;

export interface AlertLocatePayload {
  commandId: string;
  action: "locate";
  durationMs: number;
  timestamp: string;   // ISO 8601
  cardName: string;
}

export interface AlertVibratePayload {
  commandId: string;
  action: "vibrate";
  durationMs: number;
  timestamp: string;   // ISO 8601
  cardName: string;
}

export interface DeviceUnpairedPayload {
  message: string;
}

// -----------------------------------------------------------------------------
// Mapas Tipados de Eventos Socket.IO por Namespace
// -----------------------------------------------------------------------------

export interface PanelClientToServerEvents {
  "pairing:generate": (
    payload: PairingGeneratePayload,
    ack?: (response: { ok: true; data: PairingGeneratedPayload } | { ok: false; error: string }) => void
  ) => void;
  "device:unpair": (
    payload: DeviceUnpairPayload,
    ack?: (response: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  "locate:trigger": (payload: LocateTriggerPayload) => void;
  "vibrate:trigger": (payload: VibrateTriggerPayload) => void;
}

export interface PanelServerToClientEvents {
  "pairing:generated": (payload: PairingGeneratedPayload) => void;
  "device:status": (payload: DeviceStatusPayload) => void;
  "card:battery": (payload: CardBatteryPayload) => void;
  "locate:feedback": (payload: LocateFeedbackPayload) => void;
  "vibrate:feedback": (payload: VibrateFeedbackPayload) => void;
  "card:created": (payload: CardWithStatus) => void;
  "card:updated": (payload: CardWithStatus) => void;
}

export interface DeviceClientToServerEvents {
  "pairing:submit": (payload: PairingSubmitPayload) => void;
  "device:self-register": (payload: DeviceSelfRegisterPayload) => void;
  "device:identify": (payload: DeviceIdentifyPayload) => void;
  "device:battery": (payload: DeviceBatteryPayload) => void;
  "alert:ack": (payload: AlertAckPayload) => void;
  "vibrate:ack": (payload: VibrateAckPayload) => void;
}

export interface DeviceServerToClientEvents {
  "pairing:result": (payload: PairingResultPayload) => void;
  "alert:locate": (payload: AlertLocatePayload) => void;
  "alert:vibrate": (payload: AlertVibratePayload) => void;
  "device:unpaired": (payload: DeviceUnpairedPayload) => void;
}

// -----------------------------------------------------------------------------
// Conversor Seguro de DTO Público
// -----------------------------------------------------------------------------

/**
 * Converte um PhoneCardRecord interno em PublicPhoneCard garantindo que
 * `pushToken` nunca seja exposto em respostas REST ou broadcasts `/panel`.
 */
export function toPublicPhoneCard(card: PhoneCardRecord): PublicPhoneCard {
  return {
    id: card.id,
    name: card.name,
    description: card.description,
    pairedDeviceId: card.pairedDeviceId,
    hasPushToken: Boolean(card.pushToken),
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}
