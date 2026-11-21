import { getFileBuffer } from "../services/r2Storage";

export const PHONE_FINDER_VERSION_R2_KEY = "phone-finder/version.json";
export const PHONE_FINDER_APK_DOWNLOAD_PATH = "/api/phone-finder/apk";
const DEFAULT_CACHE_TTL_MS = 60_000;

export interface ApkVersionMetadata {
  versionCode: number;
  versionName: string;
  apkSizeBytes: number;
  sha256: string;
  publishedAt: string;
}

export interface ApkVersionResponse extends ApkVersionMetadata {
  apkPath: string;
}

function parseVersionMetadata(rawBuffer: Buffer): ApkVersionResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBuffer.toString("utf-8"));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const versionCode = record.versionCode;
  const versionName = record.versionName;

  if (typeof versionCode !== "number" || !Number.isInteger(versionCode) || versionCode <= 0) {
    return null;
  }

  if (typeof versionName !== "string" || versionName.trim().length === 0) {
    return null;
  }

  const apkSizeBytes =
    typeof record.apkSizeBytes === "number" &&
    Number.isFinite(record.apkSizeBytes) &&
    record.apkSizeBytes >= 0
      ? record.apkSizeBytes
      : 0;

  const sha256 = typeof record.sha256 === "string" ? record.sha256.trim() : "";
  const publishedAt = typeof record.publishedAt === "string" ? record.publishedAt.trim() : "";

  return {
    versionCode,
    versionName: versionName.trim(),
    apkSizeBytes,
    sha256,
    publishedAt,
    apkPath: PHONE_FINDER_APK_DOWNLOAD_PATH,
  };
}

export function createApkVersionService(deps?: {
  fetchBuffer?: (key: string) => Promise<Buffer>;
  now?: () => number;
  ttlMs?: number;
}): {
  getLatestApkVersion(options?: { bypassCache?: boolean }): Promise<ApkVersionResponse | null>;
  clearCache(): void;
} {
  const fetchBuffer = deps?.fetchBuffer ?? getFileBuffer;
  const now = deps?.now ?? Date.now;
  const ttlMs = deps?.ttlMs ?? DEFAULT_CACHE_TTL_MS;

  let cachedResponse: ApkVersionResponse | null = null;
  let cachedAt: number | null = null;

  function clearCache(): void {
    cachedResponse = null;
    cachedAt = null;
  }

  async function getLatestApkVersion(options?: {
    bypassCache?: boolean;
  }): Promise<ApkVersionResponse | null> {
    const bypassCache = options?.bypassCache === true;
    const currentTime = now();

    if (
      !bypassCache &&
      cachedResponse !== null &&
      cachedAt !== null &&
      currentTime - cachedAt < ttlMs
    ) {
      return cachedResponse;
    }

    try {
      const buffer = await fetchBuffer(PHONE_FINDER_VERSION_R2_KEY);
      const parsed = parseVersionMetadata(buffer);
      if (!parsed) {
        clearCache();
        return null;
      }

      cachedResponse = parsed;
      cachedAt = now();
      return parsed;
    } catch {
      clearCache();
      return null;
    }
  }

  return {
    getLatestApkVersion,
    clearCache,
  };
}

const defaultApkVersionService = createApkVersionService();

export async function getLatestApkVersion(options?: {
  bypassCache?: boolean;
}): Promise<ApkVersionResponse | null> {
  return defaultApkVersionService.getLatestApkVersion(options);
}

export function clearApkVersionCache(): void {
  defaultApkVersionService.clearCache();
}
