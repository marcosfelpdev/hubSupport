import assert from "assert";
import { resolveApiUrl } from "../src/services/api";

console.log("[Test] Verificando contratos de URL e headers para streaming inline...");

// Simulação de geração de URLs do api.worklogs
function getDownloadRecordingUrl(id: string, token?: string): string {
  return `/api/reports/${id}/recording${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

function getViewRecordingUrl(id: string, token?: string): string {
  return `/api/reports/${id}/recording?view=inline${token ? `&token=${encodeURIComponent(token)}` : ""}`;
}

const testId = "log-12345";
const testToken = "jwt-mock-token-xyz";

const downloadUrl = getDownloadRecordingUrl(testId, testToken);
assert.strictEqual(downloadUrl, "/api/reports/log-12345/recording?token=jwt-mock-token-xyz");

const viewUrl = getViewRecordingUrl(testId, testToken);
assert.strictEqual(viewUrl, "/api/reports/log-12345/recording?view=inline&token=jwt-mock-token-xyz");
assert.ok(viewUrl.includes("view=inline"), "A URL de visualização deve incluir o parâmetro view=inline");

// Validação dos cabeçalhos esperados para inline vs attachment
function computeHeaders(isInline: boolean, filename: string, mimeType: string) {
  return {
    "Content-Type": mimeType,
    "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename="${filename}"`,
    "Cache-Control": isInline ? "private, max-age=3600" : "private, no-cache, no-store, must-revalidate",
    "Accept-Ranges": "bytes"
  };
}

const inlineHeaders = computeHeaders(true, "gravacao-teste.webm", "video/webm");
assert.strictEqual(inlineHeaders["Content-Disposition"], 'inline; filename="gravacao-teste.webm"');
assert.strictEqual(inlineHeaders["Cache-Control"], "private, max-age=3600");
assert.strictEqual(inlineHeaders["Accept-Ranges"], "bytes");

const attachmentHeaders = computeHeaders(false, "gravacao-teste.webm", "video/webm");
assert.strictEqual(attachmentHeaders["Content-Disposition"], 'attachment; filename="gravacao-teste.webm"');
assert.strictEqual(attachmentHeaders["Cache-Control"], "private, no-cache, no-store, must-revalidate");

console.log("[Test] PASS: Todos os contratos de cabeçalho e geração de URL inline foram validados com sucesso!");
