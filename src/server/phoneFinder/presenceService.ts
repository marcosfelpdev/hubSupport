import { AppVersionInfo, BatteryTelemetry } from "./types";

export interface SocketVersionInput {
  appVersionCode?: number | null;
  appVersionName?: string | null;
}

export interface UnregisterSocketResult {
  deviceId: string;
  wentOffline: boolean;
}

export class PresenceService {
  private readonly deviceSockets = new Map<string, Set<string>>();
  private readonly socketToDevice = new Map<string, string>();
  private readonly batteryMap = new Map<string, BatteryTelemetry>();
  private readonly appVersionMap = new Map<string, AppVersionInfo>();

  registerSocket(
    deviceId: string,
    socketId: string,
    version?: SocketVersionInput
  ): void {
    const previousDeviceId = this.socketToDevice.get(socketId);
    if (previousDeviceId && previousDeviceId !== deviceId) {
      const prevSet = this.deviceSockets.get(previousDeviceId);
      if (prevSet) {
        prevSet.delete(socketId);
        if (prevSet.size === 0) {
          this.deviceSockets.delete(previousDeviceId);
        }
      }
    }

    let sockets = this.deviceSockets.get(deviceId);
    if (!sockets) {
      sockets = new Set<string>();
      this.deviceSockets.set(deviceId, sockets);
    }
    sockets.add(socketId);
    this.socketToDevice.set(socketId, deviceId);

    if (
      version &&
      (version.appVersionCode !== undefined ||
        version.appVersionName !== undefined)
    ) {
      const current = this.appVersionMap.get(deviceId);
      this.appVersionMap.set(deviceId, {
        appVersionCode:
          version.appVersionCode !== undefined
            ? version.appVersionCode
            : (current?.appVersionCode ?? null),
        appVersionName:
          version.appVersionName !== undefined
            ? version.appVersionName
            : (current?.appVersionName ?? null),
      });
    }
  }

  unregisterSocket(socketId: string): UnregisterSocketResult | null {
    const deviceId = this.socketToDevice.get(socketId);
    if (!deviceId) {
      return null;
    }

    this.socketToDevice.delete(socketId);

    const sockets = this.deviceSockets.get(deviceId);
    if (!sockets) {
      return { deviceId, wentOffline: true };
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.deviceSockets.delete(deviceId);
      return { deviceId, wentOffline: true };
    }

    return { deviceId, wentOffline: false };
  }

  getSockets(deviceId: string): string[] {
    const sockets = this.deviceSockets.get(deviceId);
    return sockets ? Array.from(sockets) : [];
  }

  getDeviceBySocket(socketId: string): string | null {
    return this.socketToDevice.get(socketId) ?? null;
  }

  isOnline(deviceId: string): boolean {
    const sockets = this.deviceSockets.get(deviceId);
    return Boolean(sockets && sockets.size > 0);
  }

  setBattery(
    deviceId: string,
    level: number,
    isCharging: boolean
  ): BatteryTelemetry {
    const normalizedLevel = Math.max(0, Math.min(100, Math.round(level)));
    const telemetry: BatteryTelemetry = {
      level: normalizedLevel,
      isCharging: Boolean(isCharging),
      updatedAt: new Date().toISOString(),
    };
    this.batteryMap.set(deviceId, telemetry);
    return { ...telemetry };
  }

  getBattery(deviceId: string): BatteryTelemetry | null {
    const telemetry = this.batteryMap.get(deviceId);
    return telemetry ? { ...telemetry } : null;
  }

  getAppVersion(deviceId: string): AppVersionInfo | null {
    const info = this.appVersionMap.get(deviceId);
    return info ? { ...info } : null;
  }

  clearDevice(deviceId: string): string[] {
    const activeSockets = this.getSockets(deviceId);
    for (const socketId of activeSockets) {
      this.socketToDevice.delete(socketId);
    }
    this.deviceSockets.delete(deviceId);
    this.batteryMap.delete(deviceId);
    this.appVersionMap.delete(deviceId);
    return activeSockets;
  }
}
