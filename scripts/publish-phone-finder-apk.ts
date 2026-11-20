import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { uploadFileFromDisk, isR2Configured, R2_BUCKET_NAME } from "../src/server/services/r2Storage";

export const PHONE_FINDER_APK_R2_KEY = "phone-finder/hubsupport-phone-finder.apk";
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

async function main() {
  const apkPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_APK_PATH;

  if (!fs.existsSync(apkPath)) {
    console.error(`[PublishAPK] APK não encontrado em: ${apkPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(apkPath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`[PublishAPK] Enviando ${apkPath} (${sizeMb} MB)...`);
  console.log(
    `[PublishAPK] Destino: ${isR2Configured ? `Cloudflare R2 (${R2_BUCKET_NAME})` : "Disco local"} -> ${PHONE_FINDER_APK_R2_KEY}`
  );

  const key = await uploadFileFromDisk(
    apkPath,
    PHONE_FINDER_APK_R2_KEY,
    "application/vnd.android.package-archive"
  );

  console.log(`[PublishAPK] Upload concluído com sucesso! Key: ${key}`);
}

main().catch((err) => {
  console.error("[PublishAPK] Falha no upload do APK:", err);
  process.exit(1);
});
