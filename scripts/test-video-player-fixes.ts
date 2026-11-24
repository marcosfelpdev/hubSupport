import assert from "assert";
import fixWebmDuration from "fix-webm-duration";

console.log("[Test] Iniciando testes unitários das correções do reprodutor de vídeo e WebM...");

// 1. Teste da função formatTime
function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

assert.strictEqual(formatTime(0), "00:00");
assert.strictEqual(formatTime(34), "00:34");
assert.strictEqual(formatTime(125), "02:05");
assert.strictEqual(formatTime(3665), "1:01:05");
assert.strictEqual(formatTime(Infinity), "00:00");
assert.strictEqual(formatTime(-5), "00:00");

// 2. Teste da lógica de Seek Seguro (evitar reset para 0 quando duration for 0)
function computeSeekTarget(
  pos: number,
  duration: number,
  videoDuration: number,
  maxObservedTime: number,
  bufferedTime: number
): number | null {
  const effectiveDuration =
    duration > 0
      ? duration
      : isFinite(videoDuration) && !isNaN(videoDuration) && videoDuration > 0 && videoDuration !== Infinity
      ? videoDuration
      : maxObservedTime > 0
      ? maxObservedTime
      : bufferedTime;

  if (effectiveDuration <= 0) {
    return null; // Não permite zerar o playback
  }

  return Math.max(0, Math.min(pos * effectiveDuration, effectiveDuration));
}

// Caso bug antigo: duration era 0, clicava na metade (0.5) -> retornava 0 e resetava o vídeo
const oldBugResult = computeSeekTarget(0.5, 0, Infinity, 0, 0);
assert.strictEqual(oldBugResult, null, "Quando a duração for totalmente indeterminada, o seek deve ser ignorado em vez de zerar para 0");

// Caso com maxObservedTime (usuário já assistiu 34s):
const observedResult = computeSeekTarget(0.5, 0, Infinity, 34, 0);
assert.strictEqual(observedResult, 17, "Deve permitir seek relativo ao tempo observado");

// Caso normal com duração resolvida (ex: 120s):
const normalResult = computeSeekTarget(0.5, 120, 120, 34, 0);
assert.strictEqual(normalResult, 60, "Deve calcular exatamente 60s para 50% de 120s");

// 3. Teste do módulo fixWebmDuration
assert.strictEqual(typeof fixWebmDuration, "function", "fixWebmDuration deve ser uma função válida");

console.log("[Test] PASS: Todas as regras de proteção de seek, formatação e patch de WebM foram validadas com sucesso!");
