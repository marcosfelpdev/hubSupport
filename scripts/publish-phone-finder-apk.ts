import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  uploadBuffer,
  uploadFileFromDisk,
  isR2Configured,
  R2_BUCKET_NAME,
} from "../src/server/services/r2Storage";
import type { ApkVersionMetadata } from "../src/server/phoneFinder/apkVersionService";

export const PHONE_FINDER_APK_R2_KEY = "phone-finder/hubsupport-phone-finder.apk";
export const PHONE_FINDER_VERSION_R2_KEY = "phone-finder/version.json";

const DEFAULT_APK_PATH = path.resolve(
  process.cwd(),
  "..",
  "hubsupport-phone-finder-android",
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk"
);

const DEFAULT_GRADLE_PATH = path.resolve(
  process.cwd(),
  "..",
  "hubsupport-phone-finder-android",
  "app",
  "build.gradle.kts"
);

export function parseGradleVersion(gradleContent: string): {
  versionCode: number;
  versionName: string;
} {
  const withoutComments = gradleContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const codeMatch = withoutComments.match(/\bversionCode\s*=?\s*(\d+)/);
  if (!codeMatch) {
    throw new Error("Não foi possível encontrar versionCode no arquivo build.gradle.kts.");
  }

  const versionCode = Number.parseInt(codeMatch[1], 10);
  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    throw new Error(`versionCode inválido encontrado no Gradle: ${codeMatch[1]}`);
  }

  const nameMatch = withoutComments.match(/\bversionName\s*=?\s*["']([^"']+)["']/);
  if (!nameMatch || nameMatch[1].trim().length === 0) {
    throw new Error("Não foi possível encontrar versionName válido no arquivo build.gradle.kts.");
  }

  return {
    versionCode,
    versionName: nameMatch[1].trim(),
  };
}

export function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(hash.digest("hex").toLowerCase()));
  });
}

interface ParsedCliArgs {
  apkPath: string;
  versionCode?: number;
  versionName?: string;
}

function parsePositiveIntStrict(rawValue: string): number {
  if (!/^\d+$/.test(rawValue.trim())) {
    throw new Error(`--version-code inválido: ${rawValue}`);
  }
  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--version-code inválido: ${rawValue}`);
  }
  return parsed;
}

function parseCliArgs(argv: string[]): ParsedCliArgs {
  let positionalApkPath: string | undefined;
  let versionCode: number | undefined;
  let versionName: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--version-code") {
      const next = argv[i + 1];
      if (!next) throw new Error("Flag --version-code requer um valor inteiro positivo.");
      versionCode = parsePositiveIntStrict(next);
      i += 1;
    } else if (arg.startsWith("--version-code=")) {
      versionCode = parsePositiveIntStrict(arg.slice("--version-code=".length));
    } else if (arg === "--version-name") {
      const next = argv[i + 1];
      if (!next) throw new Error("Flag --version-name requer uma string não vazia.");
      versionName = next.trim();
      i += 1;
    } else if (arg.startsWith("--version-name=")) {
      versionName = arg.slice("--version-name=".length).trim();
    } else if (!arg.startsWith("-") && !positionalApkPath) {
      positionalApkPath = path.resolve(arg);
    }
  }

  if (versionName !== undefined && versionName.length === 0) {
    throw new Error("--version-name não pode ser vazio.");
  }

  return {
    apkPath: positionalApkPath ?? DEFAULT_APK_PATH,
    versionCode,
    versionName,
  };
}

function resolveVersionInfo(cliArgs: ParsedCliArgs): {
  versionCode: number;
  versionName: string;
} {
  if (cliArgs.versionCode !== undefined && cliArgs.versionName !== undefined) {
    return {
      versionCode: cliArgs.versionCode,
      versionName: cliArgs.versionName,
    };
  }

  if (!fs.existsSync(DEFAULT_GRADLE_PATH)) {
    throw new Error(
      `Arquivo Gradle não encontrado em ${DEFAULT_GRADLE_PATH}. Informe --version-code e --version-name.`
    );
  }

  const gradleContent = fs.readFileSync(DEFAULT_GRADLE_PATH, "utf-8");
  const parsed = parseGradleVersion(gradleContent);

  return {
    versionCode: cliArgs.versionCode ?? parsed.versionCode,
    versionName: cliArgs.versionName ?? parsed.versionName,
  };
}

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const { apkPath } = cliArgs;

  if (!fs.existsSync(apkPath)) {
    console.error(`[PublishAPK] APK não encontrado em: ${apkPath}`);
    process.exit(1);
  }

  const { versionCode, versionName } = resolveVersionInfo(cliArgs);
  const stat = fs.statSync(apkPath);
  const sha256 = await computeFileSha256(apkPath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);

  console.log(`[PublishAPK] Enviando ${apkPath} (${sizeMb} MB)...`);
  console.log(`[PublishAPK] Versão: v${versionName} (versionCode=${versionCode}), SHA-256=${sha256}`);
  console.log(
    `[PublishAPK] Destino: ${isR2Configured ? `Cloudflare R2 (${R2_BUCKET_NAME})` : "Disco local"} -> ${PHONE_FINDER_APK_R2_KEY}`
  );

  // Publica o APK antes de atualizar version.json para garantir consistência atômica
  const apkKey = await uploadFileFromDisk(
    apkPath,
    PHONE_FINDER_APK_R2_KEY,
    "application/vnd.android.package-archive"
  );

  const versionMetadata: ApkVersionMetadata = {
    versionCode,
    versionName,
    apkSizeBytes: stat.size,
    sha256,
    publishedAt: new Date().toISOString(),
  };

  const versionKey = await uploadBuffer(
    Buffer.from(JSON.stringify(versionMetadata, null, 2), "utf-8"),
    PHONE_FINDER_VERSION_R2_KEY,
    "application/json"
  );

  console.log(`[PublishAPK] Upload do APK concluído! Key: ${apkKey}`);
  console.log(`[PublishAPK] Upload de metadados concluído! Key: ${versionKey}`);
}

const isDirectExecution = (() => {
  if (typeof require !== "undefined" && typeof module !== "undefined") {
    return require.main === module;
  }
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const currentFile = fileURLToPath(import.meta.url);
    return path.resolve(currentFile).toLowerCase() === path.resolve(entry).toLowerCase();
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  main().catch((err) => {
    console.error("[PublishAPK] Falha no upload do APK:", err);
    process.exit(1);
  });
}
