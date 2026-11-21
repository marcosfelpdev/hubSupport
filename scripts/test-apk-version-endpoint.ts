import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { app } from "../src/server/app";
import {
  PHONE_FINDER_VERSION_R2_KEY,
  clearApkVersionCache,
  createApkVersionService,
} from "../src/server/phoneFinder/apkVersionService";
import {
  PHONE_FINDER_APK_R2_KEY,
  PHONE_FINDER_VERSION_R2_KEY as PUBLISHER_VERSION_R2_KEY,
  computeFileSha256,
  parseGradleVersion,
} from "./publish-phone-finder-apk";

async function runParseGradleVersionTests() {
  const sampleGradle = `
android {
    namespace = "com.hubsupport.phonefinder"
    defaultConfig {
        applicationId = "com.hubsupport.phonefinder"
        versionCode = 5
        versionName = "1.2.0"
    }
}
`;
  const parsed = parseGradleVersion(sampleGradle);
  assert.deepEqual(parsed, { versionCode: 5, versionName: "1.2.0" });

  assert.throws(() => parseGradleVersion(`defaultConfig { versionName = "1.2.0" }`), /versionCode/i);
  assert.throws(() => parseGradleVersion(`defaultConfig { versionCode = 5 }`), /versionName/i);
  assert.throws(() => parseGradleVersion(`defaultConfig { versionCode = 0\n versionName = "1.2.0" }`), /versionCode/i);
}

async function runComputeFileSha256Tests() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "relix-sha-test-"));
  const tmpFile = path.join(tmpDir, "sample.apk");
  try {
    const content = Buffer.from("relix-apk-binary-payload-v1.2.0", "utf-8");
    fs.writeFileSync(tmpFile, content);
    const expected = crypto.createHash("sha256").update(content).digest("hex").toLowerCase();
    const actual = await computeFileSha256(tmpFile);
    assert.equal(actual, expected);
    assert.match(actual, /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function runApkVersionServiceTests() {
  assert.equal(PHONE_FINDER_VERSION_R2_KEY, "phone-finder/version.json");
  assert.equal(PUBLISHER_VERSION_R2_KEY, "phone-finder/version.json");
  assert.equal(PHONE_FINDER_APK_R2_KEY, "phone-finder/hubsupport-phone-finder.apk");

  // 1. Missing object in storage -> null
  const missingService = createApkVersionService({
    fetchBuffer: async () => {
      throw new Error("NoSuchKey");
    },
  });
  assert.equal(await missingService.getLatestApkVersion(), null);

  // 2. Malformed JSON -> null
  const malformedService = createApkVersionService({
    fetchBuffer: async () => Buffer.from("{invalid json", "utf-8"),
  });
  assert.equal(await malformedService.getLatestApkVersion(), null);

  // 3. Invalid versionCode / versionName -> null
  for (const invalidPayload of [
    { versionCode: 0, versionName: "1.2.0" },
    { versionCode: -3, versionName: "1.2.0" },
    { versionCode: 1.5, versionName: "1.2.0" },
    { versionCode: "5", versionName: "1.2.0" },
    { versionCode: 5, versionName: "" },
    { versionCode: 5, versionName: "   " },
  ]) {
    const invalidService = createApkVersionService({
      fetchBuffer: async () => Buffer.from(JSON.stringify(invalidPayload), "utf-8"),
    });
    assert.equal(
      await invalidService.getLatestApkVersion(),
      null,
      `Expected null for invalid payload: ${JSON.stringify(invalidPayload)}`
    );
  }

  // 4. Valid metadata, 60s TTL cache, bypassCache, TTL expiration, and clearCache
  let currentNow = 1_000_000;
  let fetchCalls = 0;
  let currentRemotePayload = {
    versionCode: 5,
    versionName: "1.2.0",
    apkSizeBytes: 1920000,
    sha256: "a".repeat(64),
    publishedAt: "2026-11-21T15:30:00.000Z",
  };

  const cachedService = createApkVersionService({
    now: () => currentNow,
    ttlMs: 60_000,
    fetchBuffer: async (key: string) => {
      assert.equal(key, PHONE_FINDER_VERSION_R2_KEY);
      fetchCalls += 1;
      return Buffer.from(JSON.stringify(currentRemotePayload), "utf-8");
    },
  });

  const first = await cachedService.getLatestApkVersion();
  assert.deepEqual(first, {
    ...currentRemotePayload,
    apkPath: "/api/phone-finder/apk",
  });
  assert.equal(fetchCalls, 1);

  // Within 60s TTL -> cached result, no extra fetch
  currentNow += 59_999;
  currentRemotePayload = {
    ...currentRemotePayload,
    versionCode: 6,
    versionName: "1.3.0",
  };
  const cachedHit = await cachedService.getLatestApkVersion();
  assert.equal(cachedHit?.versionCode, 5);
  assert.equal(fetchCalls, 1);

  // bypassCache: true -> fetches updated version immediately
  const bypassed = await cachedService.getLatestApkVersion({ bypassCache: true });
  assert.equal(bypassed?.versionCode, 6);
  assert.equal(bypassed?.versionName, "1.3.0");
  assert.equal(fetchCalls, 2);

  // Advance past 60s TTL -> expires and fetches again
  currentNow += 60_000;
  currentRemotePayload = {
    ...currentRemotePayload,
    versionCode: 7,
    versionName: "1.4.0",
  };
  const afterTtl = await cachedService.getLatestApkVersion();
  assert.equal(afterTtl?.versionCode, 7);
  assert.equal(afterTtl?.versionName, "1.4.0");
  assert.equal(fetchCalls, 3);

  // clearCache() forces next call to fetch
  cachedService.clearCache();
  await cachedService.getLatestApkVersion();
  assert.equal(fetchCalls, 4);
}

async function runExpressEndpointTests() {
  clearApkVersionCache();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    for (const endpoint of ["/api/phone-finder/version", "/api/phone-finder/version?fresh=1"]) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      const cacheControl = res.headers.get("cache-control");
      assert.equal(
        cacheControl,
        "no-cache, no-store, must-revalidate",
        `Expected strict Cache-Control header on ${endpoint}, got ${cacheControl}`
      );

      const body = (await res.json()) as Record<string, unknown>;
      if (res.status === 200) {
        assert.equal(typeof body.versionCode, "number");
        assert.ok(Number.isInteger(body.versionCode) && (body.versionCode as number) > 0);
        assert.equal(typeof body.versionName, "string");
        assert.ok((body.versionName as string).trim().length > 0);
        assert.equal(typeof body.apkSizeBytes, "number");
        assert.equal(typeof body.sha256, "string");
        assert.equal(typeof body.publishedAt, "string");
        assert.equal(body.apkPath, "/api/phone-finder/apk");
      } else {
        assert.equal(res.status, 404, `Expected 200 or 404 from ${endpoint}, got ${res.status}`);
        assert.equal(typeof body.error, "string");
        assert.ok((body.error as string).trim().length > 0);
      }
    }
  } finally {
    clearApkVersionCache();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function main() {
  await runParseGradleVersionTests();
  await runComputeFileSha256Tests();
  await runApkVersionServiceTests();
  await runExpressEndpointTests();
  console.log("✅ Todos os testes de versionamento e endpoint APK passaram com sucesso!");
}

main().catch((err) => {
  console.error("❌ Falha nos testes de versionamento do APK:", err);
  process.exit(1);
});
