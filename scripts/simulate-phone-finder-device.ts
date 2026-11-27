import { io, Socket } from "socket.io-client";
import type {
  AlertLocatePayload,
  AlertVibratePayload,
  DeviceClientToServerEvents,
  DeviceServerToClientEvents,
  DeviceUnpairedPayload,
  PairingResultPayload,
} from "../src/server/phoneFinder/types";

interface SimulatorOptions {
  url: string;
  code?: string;
  deviceId?: string;
  battery: number;
  charging: boolean;
  pushToken?: string;
  version: string;
  help: boolean;
}

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgGreen: "\x1b[42m",
  black: "\x1b[30m",
} as const;

const MAX_PROCESSED_COMMANDS = 100;
const BATTERY_INTERVAL_MS = 60_000;
const ACK_DELAY_MS = 350;

function nowTime(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

function logInfo(msg: string): void {
  console.log(`${ANSI.dim}[${nowTime()}]${ANSI.reset} ${ANSI.cyan}[SIM]${ANSI.reset} ${msg}`);
}

function logSuccess(msg: string): void {
  console.log(`${ANSI.dim}[${nowTime()}]${ANSI.reset} ${ANSI.green}[OK]${ANSI.reset} ${msg}`);
}

function logWarn(msg: string): void {
  console.warn(`${ANSI.dim}[${nowTime()}]${ANSI.reset} ${ANSI.yellow}[AVISO]${ANSI.reset} ${msg}`);
}

function logError(msg: string): void {
  console.error(`${ANSI.dim}[${nowTime()}]${ANSI.reset} ${ANSI.red}[ERRO]${ANSI.reset} ${msg}`);
}

function printHelp(): void {
  console.log(`
${ANSI.bold}${ANSI.cyan}Phone Finder — Simulador CLI de Dispositivo Android (HubSupport)${ANSI.reset}

Simula um smartphone Android conectado ao namespace ${ANSI.bold}/device${ANSI.reset} do servidor
HubSupport, permitindo testar pareamento, telemetria de bateria, presença em
tempo real, alertas de localização/vibração com ACK e desvinculação remota.

${ANSI.bold}USO:${ANSI.reset}
  npx tsx scripts/simulate-phone-finder-device.ts --code <6-digitos> [opções]
  npx tsx scripts/simulate-phone-finder-device.ts --device-id <uuid> [opções]

${ANSI.bold}OPÇÕES:${ANSI.reset}
  --url <url>           URL base do servidor HubSupport
                        (padrão: http://localhost:4000)
  --code <6-digitos>    Código de 6 dígitos gerado no painel para parear
                        um novo dispositivo simulado
  --device-id <uuid>    UUID de um dispositivo já pareado para simular
                        reconexão direta via device:identify
  --battery <0-100>     Nível inicial de bateria enviado ao painel
                        (padrão: 85)
  --charging            Indica que o dispositivo está carregando
                        (padrão: false)
  --push-token <token>  Token FCM simulado ou "none" para omitir
                        (padrão: "simulated-fcm-token")
  --version <string>    Versão do app enviada em device:identify
                        (padrão: "1.0.0-sim")
  --help, -h            Exibe este guia de uso e encerra

${ANSI.bold}EXEMPLOS:${ANSI.reset}
  ${ANSI.dim}# Parear novo aparelho no servidor local${ANSI.reset}
  npx tsx scripts/simulate-phone-finder-device.ts --url http://localhost:4000 --code 123456

  ${ANSI.dim}# Reconectar aparelho já pareado com bateria 42% carregando${ANSI.reset}
  npx tsx scripts/simulate-phone-finder-device.ts --device-id 550e8400-e29b-41d4-a716-446655440000 --battery 42 --charging

  ${ANSI.dim}# Testar dispositivo sem Push Token (somente tempo real)${ANSI.reset}
  npx tsx scripts/simulate-phone-finder-device.ts --code 654321 --push-token none
`);
}

function parseCliArgs(argv: string[]): SimulatorOptions {
  let url = "http://localhost:4000";
  let code: string | undefined;
  let deviceId: string | undefined;
  let battery = 85;
  let charging = false;
  let pushTokenRaw = "simulated-fcm-token";
  let version = "1.0.0-sim";
  let help = false;

  const consumeValue = (index: number, flagName: string, inlineValue?: string): { value: string; nextIndex: number } => {
    if (inlineValue !== undefined) {
      return { value: inlineValue, nextIndex: index };
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`A opção ${flagName} exige um valor.`);
    }
    return { value: next, nextIndex: index + 1 };
  };

  for (let i = 0; i < argv.length; i += 1) {
    const rawArg = argv[i];
    if (rawArg === "--help" || rawArg === "-h") {
      help = true;
      continue;
    }
    if (rawArg === "--charging") {
      charging = true;
      continue;
    }

    const eqIdx = rawArg.indexOf("=");
    const flag = eqIdx >= 0 ? rawArg.slice(0, eqIdx) : rawArg;
    const inlineValue = eqIdx >= 0 ? rawArg.slice(eqIdx + 1) : undefined;

    switch (flag) {
      case "--url": {
        const res = consumeValue(i, "--url", inlineValue);
        url = res.value.trim();
        i = res.nextIndex;
        break;
      }
      case "--code": {
        const res = consumeValue(i, "--code", inlineValue);
        code = res.value.trim();
        i = res.nextIndex;
        break;
      }
      case "--device-id": {
        const res = consumeValue(i, "--device-id", inlineValue);
        deviceId = res.value.trim();
        i = res.nextIndex;
        break;
      }
      case "--battery": {
        const res = consumeValue(i, "--battery", inlineValue);
        const parsed = Number(res.value);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
          throw new Error("--battery deve ser um número inteiro entre 0 e 100.");
        }
        battery = parsed;
        i = res.nextIndex;
        break;
      }
      case "--push-token": {
        const res = consumeValue(i, "--push-token", inlineValue);
        pushTokenRaw = res.value.trim();
        i = res.nextIndex;
        break;
      }
      case "--version": {
        const res = consumeValue(i, "--version", inlineValue);
        version = res.value.trim();
        if (!version) {
          throw new Error("--version não pode ser vazio.");
        }
        i = res.nextIndex;
        break;
      }
      default:
        throw new Error(`Argumento desconhecido: ${rawArg}`);
    }
  }

  const normalizedUrl = url.replace(/\/+$/, "");
  if (!normalizedUrl) {
    throw new Error("--url não pode ser vazio.");
  }

  const pushToken =
    pushTokenRaw.toLowerCase() === "none" || pushTokenRaw.length === 0
      ? undefined
      : pushTokenRaw;

  return {
    url: normalizedUrl,
    code,
    deviceId,
    battery,
    charging,
    pushToken,
    version,
    help,
  };
}

function printAlertBanner(
  kind: "locate" | "vibrate",
  payload: AlertLocatePayload | AlertVibratePayload
): void {
  const isLocate = kind === "locate";
  const headerBg = isLocate ? `${ANSI.bgRed}${ANSI.white}${ANSI.bold}` : `${ANSI.bgYellow}${ANSI.black}${ANSI.bold}`;
  const borderColor = isLocate ? ANSI.red : ANSI.yellow;
  const title = isLocate
    ? `  ALARME VERMELHO ATIVADO (${payload.durationMs}ms)  `
    : `  VIBRAÇÃO ATIVADA (${payload.durationMs}ms)  `;

  console.log("");
  console.log(`${borderColor}================================================================${ANSI.reset}`);
  console.log(`${headerBg}${title}${ANSI.reset}`);
  console.log(`${borderColor}----------------------------------------------------------------${ANSI.reset}`);
  console.log(`  Card      : ${ANSI.bold}${payload.cardName}${ANSI.reset}`);
  console.log(`  Ação      : ${ANSI.bold}${payload.action}${ANSI.reset}`);
  console.log(`  Duração   : ${payload.durationMs}ms`);
  console.log(`  CommandId : ${ANSI.cyan}${payload.commandId}${ANSI.reset}`);
  console.log(`  Timestamp : ${payload.timestamp}`);
  console.log(`${borderColor}================================================================${ANSI.reset}`);
  console.log("");
}

function main(): void {
  let options: SimulatorOptions;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError(message);
    console.error("Use --help para ver as opções disponíveis.");
    process.exit(1);
  }

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (!options.code && !options.deviceId) {
    logError("Informe --code <6-digitos> para parear ou --device-id <uuid> para reconectar.");
    console.error("Use --help para ver exemplos de uso.");
    process.exit(1);
  }

  if (options.code && options.deviceId) {
    logError("Use apenas uma das opções por vez: --code OU --device-id.");
    process.exit(1);
  }

  const endpoint = `${options.url}/device`;
  let activeDeviceId: string | null = options.deviceId ?? null;
  let batteryTimer: NodeJS.Timeout | null = null;
  let initialBatteryTimer: NodeJS.Timeout | null = null;
  const pendingAckTimers = new Set<NodeJS.Timeout>();
  const processedCommandIds = new Set<string>();
  let isShuttingDown = false;

  const rememberCommandId = (commandId: string): boolean => {
    if (processedCommandIds.has(commandId)) {
      return false;
    }
    processedCommandIds.add(commandId);
    while (processedCommandIds.size > MAX_PROCESSED_COMMANDS) {
      const oldest = processedCommandIds.values().next().value;
      if (oldest === undefined) {
        break;
      }
      processedCommandIds.delete(oldest);
    }
    return true;
  };

  const clearBatteryTimers = (): void => {
    if (initialBatteryTimer) {
      clearTimeout(initialBatteryTimer);
      initialBatteryTimer = null;
    }
    if (batteryTimer) {
      clearInterval(batteryTimer);
      batteryTimer = null;
    }
  };

  const clearTimers = (): void => {
    clearBatteryTimers();
    for (const timer of pendingAckTimers) {
      clearTimeout(timer);
    }
    pendingAckTimers.clear();
  };

  logInfo(`Conectando em ${ANSI.bold}${endpoint}${ANSI.reset}...`);
  logInfo(
    `Configuração: bateria=${options.battery}% | carregando=${options.charging ? "sim" : "não"} | pushToken=${options.pushToken ?? "(omitido)"} | versão=${options.version}`
  );

  const socket: Socket<DeviceServerToClientEvents, DeviceClientToServerEvents> = io(endpoint, {
    transports: ["websocket", "polling"],
    reconnection: true,
  });

  const emitBatteryNow = (deviceId: string): void => {
    if (!socket.connected) {
      return;
    }
    socket.emit("device:battery", {
      deviceId,
      level: options.battery,
      isCharging: options.charging,
    });
    logInfo(
      `Telemetria enviada (device:battery): ${options.battery}%${options.charging ? " ⚡ carregando" : ""}`
    );
  };

  const startBatteryTelemetry = (deviceId: string, initialDelayMs = 0): void => {
    clearBatteryTimers();

    if (initialDelayMs > 0) {
      initialBatteryTimer = setTimeout(() => {
        initialBatteryTimer = null;
        if (isShuttingDown || !socket.connected || activeDeviceId !== deviceId) {
          return;
        }
        emitBatteryNow(deviceId);
      }, initialDelayMs);
      initialBatteryTimer.unref();
    } else {
      emitBatteryNow(deviceId);
    }

    batteryTimer = setInterval(() => {
      if (!activeDeviceId || !socket.connected) {
        return;
      }
      emitBatteryNow(activeDeviceId);
    }, BATTERY_INTERVAL_MS);
    batteryTimer.unref();
  };

  const shutdown = (exitCode: number, reason?: string): void => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    clearTimers();
    if (reason) {
      logInfo(reason);
    }
    socket.removeAllListeners();
    if (socket.connected) {
      socket.disconnect();
    } else {
      socket.close();
    }
    process.exit(exitCode);
  };

  socket.on("connect", () => {
    logSuccess(`Conectado ao namespace /device (socketId=${socket.id}).`);

    if (activeDeviceId) {
      const identifyPayload = {
        deviceId: activeDeviceId,
        ...(options.pushToken ? { pushToken: options.pushToken } : {}),
        appVersionCode: 1,
        appVersionName: options.version,
      };
      logInfo(`Enviando device:identify para deviceId=${ANSI.bold}${activeDeviceId}${ANSI.reset}...`);
      socket.emit("device:identify", identifyPayload);
      // Telemetria imediata idêntica ao app Android (sem delay)
      startBatteryTelemetry(activeDeviceId, 0);
      return;
    }

    if (options.code) {
      const pairingPayload = {
        code: options.code,
        ...(options.pushToken ? { pushToken: options.pushToken } : {}),
      };
      logInfo(`Enviando pairing:submit com código ${ANSI.bold}${options.code}${ANSI.reset}...`);
      socket.emit("pairing:submit", pairingPayload);
    }
  });

  socket.on("pairing:result", (result: PairingResultPayload) => {
    if (!result.success) {
      logError(`Pareamento recusado: ${result.error}`);
      shutdown(1);
      return;
    }

    activeDeviceId = result.deviceId;
    logSuccess(
      `Pareado com sucesso ao card "${ANSI.bold}${result.cardName}${ANSI.reset}" (cardId=${result.cardId}).`
    );
    console.log("");
    console.log(
      `${ANSI.bgGreen}${ANSI.black}${ANSI.bold}  DEVICE ID RECEBIDO  ${ANSI.reset} ${ANSI.bold}${ANSI.green}${result.deviceId}${ANSI.reset}`
    );
    console.log(
      `${ANSI.dim}Reuso futuro: npx tsx scripts/simulate-phone-finder-device.ts --url ${options.url} --device-id ${result.deviceId}${ANSI.reset}`
    );
    console.log("");

    startBatteryTelemetry(result.deviceId);
  });

  socket.on("alert:locate", (payload: AlertLocatePayload) => {
    if (!rememberCommandId(payload.commandId)) {
      logWarn(`Comando alert:locate duplicado ignorado (commandId=${payload.commandId}).`);
      return;
    }

    printAlertBanner("locate", payload);

    const timer = setTimeout(() => {
      pendingAckTimers.delete(timer);
      if (isShuttingDown || !socket.connected) {
        return;
      }
      const timestamp = Date.now();
      socket.emit("alert:ack", {
        commandId: payload.commandId,
        status: "ok",
        timestamp,
      });
      logSuccess(`ACK enviado (alert:ack): commandId=${payload.commandId}, status=ok`);
    }, ACK_DELAY_MS);
    pendingAckTimers.add(timer);
  });

  socket.on("alert:vibrate", (payload: AlertVibratePayload) => {
    if (!rememberCommandId(payload.commandId)) {
      logWarn(`Comando alert:vibrate duplicado ignorado (commandId=${payload.commandId}).`);
      return;
    }

    printAlertBanner("vibrate", payload);

    const timer = setTimeout(() => {
      pendingAckTimers.delete(timer);
      if (isShuttingDown || !socket.connected) {
        return;
      }
      const timestamp = Date.now();
      socket.emit("vibrate:ack", {
        commandId: payload.commandId,
        status: "ok",
        timestamp,
      });
      logSuccess(`ACK enviado (vibrate:ack): commandId=${payload.commandId}, status=ok`);
    }, ACK_DELAY_MS);
    pendingAckTimers.add(timer);
  });

  socket.on("device:unpaired", (payload: DeviceUnpairedPayload) => {
    const msg = payload?.message || "Este dispositivo foi desvinculado do painel.";
    logWarn(`Evento device:unpaired recebido: "${msg}"`);
    shutdown(0, "Encerrando simulador após desvinculação remota.");
  });

  socket.on("disconnect", (reason) => {
    if (isShuttingDown) {
      return;
    }
    clearBatteryTimers();
    logWarn(`Desconectado do servidor (${reason}). Aguardando reconexão automática...`);
  });

  socket.on("connect_error", (err) => {
    if (isShuttingDown) {
      return;
    }
    logError(`Falha ao conectar em ${endpoint}: ${err.message}`);
  });

  socket.io.on("reconnect_attempt", (attempt) => {
    if (isShuttingDown) {
      return;
    }
    logInfo(`Tentativa de reconexão #${attempt}...`);
  });

  process.on("SIGINT", () => {
    shutdown(0, "Sinal SIGINT recebido. Encerrando simulador...");
  });

  process.on("SIGTERM", () => {
    shutdown(0, "Sinal SIGTERM recebido. Encerrando simulador...");
  });
}

main();
