import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app } from "../src/server/app";

const LOCAL_RELEASE_APK_PATH = path.resolve(
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

function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  console.log("================================================================================");
  console.log("   TESTE E2E: DOWNLOAD PÚBLICO DO APK ANDROID (GET /api/phone-finder/apk)");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor de testes ativo na porta ${port}\n`);

  try {
    let localApkBuffer: Buffer | null = null;
    let localSha256 = "";
    if (fs.existsSync(LOCAL_RELEASE_APK_PATH)) {
      localApkBuffer = fs.readFileSync(LOCAL_RELEASE_APK_PATH);
      localSha256 = computeSha256(localApkBuffer);
      console.log(`📦 APK local de referência: ${LOCAL_RELEASE_APK_PATH}`);
      console.log(`   Tamanho local: ${localApkBuffer.length} bytes (${(localApkBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
      console.log(`   SHA-256 local: ${localSha256}\n`);
    } else {
      console.warn(`⚠️ APK local não encontrado em: ${LOCAL_RELEASE_APK_PATH}`);
    }

    console.log(`--> [GET] ${baseUrl}/api/phone-finder/apk ...`);
    const res = await fetch(`${baseUrl}/api/phone-finder/apk`);

    console.log(`Status HTTP: ${res.status}`);
    const contentType = res.headers.get("content-type");
    const contentDisposition = res.headers.get("content-disposition");
    const contentLength = res.headers.get("content-length");
    console.log(`Content-Type: ${contentType}`);
    console.log(`Content-Disposition: ${contentDisposition}`);
    console.log(`Content-Length: ${contentLength}`);

    if (res.status !== 200) {
      const errBody = await res.text();
      throw new Error(`Esperado status 200, mas recebeu ${res.status}. Detalhes: ${errBody}`);
    }

    if (!contentType || !contentType.includes("application/vnd.android.package-archive")) {
      throw new Error(`Content-Type incorreto: ${contentType}. Esperado application/vnd.android.package-archive`);
    }

    if (!contentDisposition || !contentDisposition.includes('filename="hubsupport-phone-finder.apk"')) {
      throw new Error(`Content-Disposition inesperado: ${contentDisposition}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const downloadedBuffer = Buffer.from(arrayBuffer);
    const downloadedSha256 = computeSha256(downloadedBuffer);
    console.log(`Tamanho baixado: ${downloadedBuffer.length} bytes (${(downloadedBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`SHA-256 baixado: ${downloadedSha256}`);

    if (downloadedBuffer.length === 0) {
      throw new Error("O arquivo baixado está vazio (0 bytes).");
    }

    if (localApkBuffer) {
      if (downloadedBuffer.length !== localApkBuffer.length) {
        throw new Error(
          `Discrepância no tamanho do APK: esperado ${localApkBuffer.length} bytes, baixado ${downloadedBuffer.length} bytes`
        );
      }
      if (downloadedSha256 !== localSha256) {
        throw new Error(
          `Discrepância no SHA-256 do APK: esperado ${localSha256}, baixado ${downloadedSha256}`
        );
      }
      console.log("\n✅ Integridade verificada com sucesso: SHA-256 e tamanho conferem perfeitamente com o build local!");
    } else {
      console.log("\n✅ APK baixado com sucesso do storage remoto com status 200 e headers corretos.");
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    console.log("Servidor de testes finalizado.");
  }
}

main().catch((err) => {
  console.error("❌ Falha no teste do endpoint de APK:", err);
  process.exit(1);
});
