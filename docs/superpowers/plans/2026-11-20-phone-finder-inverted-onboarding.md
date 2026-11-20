# Phone Finder — Auto-Cadastro Invertido por Aparelho & Alerta Sonoro Puro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo invertido de auto-cadastro do Phone Finder pelo próprio celular com padronização de títulos (`8299 | 1234 | 0845 | 7421`), edição em duas vias (celular e web), e remoção da tela vermelha tornando o alerta exclusivamente sonoro (`STREAM_ALARM`) e tátil.

**Architecture:** No Android, o app substitui o fluxo inicial de 6 dígitos por uma tela de auto-cadastro de até 4 blocos de 4 dígitos emitida via Socket.IO (`device:self-register`) sob um `installationId` persistente; a `AlertActivity` é excluída, mantendo o alerta via áudio contínuo, vibrador e notificação com ação de silenciar. No backend, o `socketServer` sanitiza os números com a formatação pipe, cria ou atualiza o card no PostgreSQL de forma idempotente, e sincroniza em tempo real com o painel web via eventos `card:created`/`card:updated`.

**Tech Stack:** Node.js, TypeScript, Express 5, Prisma ORM, Socket.IO 4, React 19, Vite, Kotlin, Jetpack Compose Material 3, Android SDK 35, Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-11-20-phone-finder-inverted-onboarding-design.md`

## Global Constraints
- Nenhuma rota REST pública desprotegida deve ser aberta: toda a comunicação de auto-cadastro opera pelo canal Socket.IO `/device`.
- O formato do título deve ser estritamente `DDDD | DDDD | DDDD | DDDD` (apenas para os blocos de 4 dígitos válidos preenchidos).
- O `deviceId` no Android deve persistir no Keystore/SharedPreferences mesmo se o operador desvincular o aparelho.
- A `AlertActivity` deve ser totalmente removida do Android (código, layout, AndroidManifest e ProGuard), sem quebrar o loop de áudio `STREAM_ALARM` ou a vibração do `AlertExecutor`.
- `npx vite build` no backend/web e `./gradlew testDebugUnitTest assembleRelease` no Android devem passar com zero erros.

## Review Focus
1. Entrada de números inválidos ou com caracteres não numéricos no celular: o backend deve descartar caracteres especiais e rejeitar se nenhum bloco de 4 dígitos válidos for encontrado.
2. Reconexão e reenvio de números pelo mesmo celular: o backend deve atualizar o card existente sem gerar duplicatas no banco.
3. Troca de aparelho físico com transferência de números: o backend deve transferir a vinculação do card antigo para o novo `deviceId` e desvincular o socket antigo.
4. Desvinculação no painel web enquanto o celular está pareado: o Android deve receber `device:unpaired` e retornar para a tela de auto-cadastro mantendo seu `installationId`.
5. Disparo do alarme enquanto a tela do celular está bloqueada: o `AlertExecutor` deve emitir som e vibração contínuos com `WakeLock` ativo e notificação Heads-Up com botão "Silenciar", sem tentar abrir nenhuma Activity.

---

### Task 1: Backend Title Formatter & Card Repository Enhancement

**Files:**
- Create: `src/server/phoneFinder/titleFormatter.ts`
- Modify: `src/server/phoneFinder/cardRepository.ts:1-120`
- Modify: `src/server/phoneFinder/types.ts:40-70`
- Test: `scripts/test-phone-finder-title-formatter.ts`

**Interfaces:**
- Consumes: `IPhoneCardRepository`
- Produces: `formatCardTitleFromNumbers(numbers: unknown): { success: true; title: string; validNumbers: string[] } | { success: false; error: string }`, `cardRepository.findByName(name: string): Promise<PhoneCardRecord | null>`

- [x] **Step 1: Write the failing test for title formatting and repository search by name**

```typescript
// scripts/test-phone-finder-title-formatter.ts
import assert from "node:assert/strict";
import { formatCardTitleFromNumbers } from "../src/server/phoneFinder/titleFormatter";

// 1. Testa formatação válida com 1 a 4 números
assert.deepEqual(formatCardTitleFromNumbers(["8299", "1234", "0845", "7421"]), {
  success: true,
  title: "8299 | 1234 | 0845 | 7421",
  validNumbers: ["8299", "1234", "0845", "7421"]
});

assert.deepEqual(formatCardTitleFromNumbers(["8299", "1234", "", "   "]), {
  success: true,
  title: "8299 | 1234",
  validNumbers: ["8299", "1234"]
});

// 2. Testa descarte de caracteres não numéricos
assert.deepEqual(formatCardTitleFromNumbers(["(82)99", "12-34"]), {
  success: true,
  title: "8299 | 1234",
  validNumbers: ["8299", "1234"]
});

// 3. Testa rejeição para entradas vazias ou com menos/mais de 4 dígitos
assert.equal(formatCardTitleFromNumbers([]).success, false);
assert.equal(formatCardTitleFromNumbers(["123", "12345"]).success, false);
console.log("Todos os testes de titleFormatter passaram com sucesso!");
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-phone-finder-title-formatter.ts`  
Expected: FAIL (Cannot find module `titleFormatter`).

- [x] **Step 3: Implement `formatCardTitleFromNumbers` and `cardRepository.findByName`**

Implementar `src/server/phoneFinder/titleFormatter.ts` sanitizando entradas, mantendo somente strings de exatamente 4 dígitos após remoção de não-dígitos, limitando a 4 blocos e unindo com `" | "`.  
Em `src/server/phoneFinder/cardRepository.ts`, adicionar método `findByName(name: string)` que executa `prisma.phoneCard.findFirst({ where: { name: name.trim() } })`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-phone-finder-title-formatter.ts`  
Expected: PASS com código 0.

- [x] **Step 5: Commit**

```bash
git add src/server/phoneFinder/titleFormatter.ts src/server/phoneFinder/cardRepository.ts src/server/phoneFinder/types.ts scripts/test-phone-finder-title-formatter.ts
git commit -m "feat(phoneFinder): add titleFormatter and cardRepository.findByName"
```

---

### Task 2: Backend Socket `device:self-register` & Real-Time Sync

**Files:**
- Modify: `src/server/phoneFinder/socketServer.ts:350-480`
- Modify: `src/server/phoneFinder/types.ts:130-180`
- Test: `scripts/test-phone-finder-self-register-socket.ts`

**Interfaces:**
- Consumes: `formatCardTitleFromNumbers`, `cardRepository`, `presenceService`
- Produces: Socket event handler `device:self-register`, broadcast de `card:created` e `card:updated` para `/panel`

- [x] **Step 1: Write integration test for `device:self-register` socket handler**

Criar `scripts/test-phone-finder-self-register-socket.ts` que instancia servidor em memória ou mock de runtime, conecta cliente em `/device` e `/panel`, emite `device:self-register` e valida:
1. Resposta de `pairing:result` com `{ success: true, cardId, cardName: "8299 | 1234" }`.
2. Emissão de `card:created` no `/panel` com status `online`.
3. Reenvio com o mesmo `deviceId` alterando números emite `card:updated` com o novo título no `/panel`.
4. Envio de números idênticos por novo `deviceId` transfere a posse e atualiza o card existente.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-phone-finder-self-register-socket.ts`  
Expected: FAIL (evento `device:self-register` não tratado).

- [x] **Step 3: Implement `device:self-register` in `src/server/phoneFinder/socketServer.ts`**

Adicionar listener `socket.on("device:self-register", async (payload: DeviceSelfRegisterPayload) => ...)`:
1. Validar e sanitizar payload via `formatCardTitleFromNumbers(payload.numbers)`.
2. Checar idempotência: primeiro por `cardRepository.findByDeviceId(deviceId)`; se não existir, por `cardRepository.findByName(formattedTitle)`.
3. Se existir, atualizar título, associar `deviceId` e atualizar `pushToken`. Se não existir, criar novo card.
4. Associar socket no `presenceService.registerSocket(deviceId, socket.id, versionInfo, card.id)`.
5. Emitir `pairing:result` para o socket e broadcast de `card:created` ou `card:updated` + `device:status` para o painel.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-phone-finder-self-register-socket.ts`  
Expected: PASS com código 0.

- [x] **Step 5: Commit**

```bash
git add src/server/phoneFinder/socketServer.ts src/server/phoneFinder/types.ts scripts/test-phone-finder-self-register-socket.ts
git commit -m "feat(phoneFinder): implement device:self-register with real-time panel broadcast"
```

---

### Task 3: Web Frontend Phone Finder Real-Time Updates & Search

**Files:**
- Modify: `src/pages/PhoneFinderPage.tsx:50-180`
- Test: `scripts/test-web-build.ts` (ou `npx vite build`)

**Interfaces:**
- Consumes: Socket events `card:created`, `card:updated`, `card:deleted` em `/panel`
- Produces: Grade de cards atualizada em tempo real e busca tolerante por substrings de números

- [x] **Step 1: Check existing socket listeners in `PhoneFinderPage.tsx`**

Verificar se `card:created` adiciona o novo card na lista local de cards e se `card:updated` substitui os dados sem perder o status de presença online.

- [x] **Step 2: Implement handlers for `card:created` and `card:updated` in `PhoneFinderPage.tsx`**

Adicionar/refinar os listeners no socket do `/panel`:
```typescript
socket.on("card:created", (newCard: PhoneCard) => {
  setCards(prev => {
    if (prev.some(c => c.id === newCard.id)) return prev;
    return [newCard, ...prev];
  });
});

socket.on("card:updated", (updatedCard: PhoneCard) => {
  setCards(prev => prev.map(c => c.id === updatedCard.id ? { ...c, ...updatedCard } : c));
});
```
Garantir que a busca `filteredCards` filtre `c.name.toLowerCase().includes(search.toLowerCase())`.

- [x] **Step 3: Run build verification**

Run: `npx vite build`  
Expected: Build concluído com sucesso e zero erros de tipagem TypeScript.

- [x] **Step 4: Commit**

```bash
git add src/pages/PhoneFinderPage.tsx
git commit -m "feat(phoneFinder): handle card:created and card:updated real-time events in web page"
```

---

### Task 4: Android App Persistent Device ID & Clean Alert (Remove AlertActivity)

**Files:**
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/core/DeviceStorage.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/core/AlertExecutor.kt`
- Delete: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/ui/AlertActivity.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/AndroidManifest.xml`
- Modify: `hubsupport-phone-finder-android/app/proguard-rules.pro`
- Test: `hubsupport-phone-finder-android/app/src/test/java/com/hubsupport/phonefinder/DeviceStorageTest.kt`
- Test: `hubsupport-phone-finder-android/app/src/test/java/com/hubsupport/phonefinder/AlertExecutorTest.kt`

**Interfaces:**
- Consumes: `EncryptedSharedPreferences`, `AudioManager`, `Vibrator`
- Produces: `storage.installationId` permanente, `AlertExecutor` sonoro/vibratório sem dependência de Activity

- [x] **Step 1: Write test for persistent `installationId` after `clearPairing`**

Em `DeviceStorageTest.kt`, testar que chamar `storage.clearPairing()` limpa `cardId` e `cardName`, mas o `installationId` (e consequentemente `deviceId`) permanece o mesmo valor UUID.

- [x] **Step 2: Update `DeviceStorage.kt` to preserve `installationId`**

Implementar geração e persistência de `KEY_INSTALLATION_ID` na primeira inicialização. Ajustar `clearPairing()` para não remover essa chave.

- [x] **Step 3: Delete `AlertActivity.kt` and clean up `AlertExecutor.kt`**

Excluir `AlertActivity.kt`.  
Remover registro de `AlertActivity` do `AndroidManifest.xml` e `proguard-rules.pro`.  
Em `AlertExecutor.kt`, remover o método `startActivity(alertIntent)` e manter 100% o loop de `STREAM_ALARM`, restauração de volume, vibração contínua e a notificação Heads-Up com ação de "Silenciar".

- [x] **Step 4: Run unit tests in Android repo**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && ./gradlew testDebugUnitTest`  
Expected: PASS com 100% dos testes passando.

- [x] **Step 5: Commit**

```bash
git add app/src/main/java/com/hubsupport/phonefinder/core/DeviceStorage.kt app/src/main/java/com/hubsupport/phonefinder/core/AlertExecutor.kt app/src/main/AndroidManifest.xml app/proguard-rules.pro app/src/test/
git rm app/src/main/java/com/hubsupport/phonefinder/ui/AlertActivity.kt
git commit -m "refactor(phoneFinder): make installationId persistent and remove AlertActivity"
```

---

### Task 5: Android App Self-Register & In-App Number Editing UI

**Files:**
- Create: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/ui/SelfRegisterScreen.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/core/SocketManager.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/MainActivity.kt`
- Test: `hubsupport-phone-finder-android/app/src/test/java/com/hubsupport/phonefinder/SelfRegisterPayloadTest.kt`

**Interfaces:**
- Consumes: `SocketManager.sendSelfRegister(numbers: List<String>)`
- Produces: Tela Compose `SelfRegisterScreen` e diálogo "Editar Números" na `PairedDashboardScreen`

- [x] **Step 1: Write unit tests for self-register payload and numbers parser**

Criar teste em Kotlin que valida o desmembramento de `cardName` (ex: `"8299 | 1234 | 0845 | 7421"` vira 4 strings nos campos) e valida a rejeição de inputs vazios.

- [x] **Step 2: Add `sendSelfRegister` in `SocketManager.kt`**

Adicionar método `sendSelfRegister(numbers: List<String>)`:
Emite evento `device:self-register` com `{ deviceId, numbers, pushToken, appVersionCode, appVersionName }` e aguarda `pairing:result`. Em caso de sucesso, grava no storage e atualiza o estado para `isPaired = true`.

- [x] **Step 3: Implement `SelfRegisterScreen.kt` and "Editar Números" in `PairedDashboardScreen.kt`**

1. `SelfRegisterScreen.kt`: 4 campos numéricos de 4 dígitos com foco automático via `FocusRequester`, botão "Cadastrar Aparelho" e botão secundário "Parear com código de 6 dígitos".
2. `PairedDashboardScreen.kt`: adicionar botão "Editar Números" que abre diálogo com os 4 campos pré-preenchidos e botão "Salvar Alterações".
3. `MainActivity.kt`: configurar navegação para exibir `SelfRegisterScreen` quando `!isPaired`.

- [x] **Step 4: Run unit tests and compilation check**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && ./gradlew testDebugUnitTest`  
Expected: PASS com 100% dos testes.

- [x] **Step 5: Commit**

```bash
git add app/src/main/java/com/hubsupport/phonefinder/ui/SelfRegisterScreen.kt app/src/main/java/com/hubsupport/phonefinder/core/SocketManager.kt app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt app/src/main/java/com/hubsupport/phonefinder/MainActivity.kt app/src/test/
git commit -m "feat(phoneFinder): implement SelfRegisterScreen and in-app number editing"
```

---

### Task 6: Release Build, APK Cloudflare R2 Upload & End-to-End Verification

**Files:**
- Modify: `hubsupport-phone-finder-android/app/build.gradle.kts` (bump versionCode/versionName se necessário)
- Script: `scripts/upload-phone-finder-apk.ts`
- Test: `scripts/test-apk-download-endpoint.ts`

**Interfaces:**
- Produces: Novo `app-release.apk` minificado com R8, publicado no bucket R2 e disponível para download via QR Code

- [x] **Step 1: Build production release APK**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && ./gradlew assembleRelease`  
Expected: Gera `app/build/outputs/apk/release/app-release.apk` assinado e minificado.

- [x] **Step 2: Upload new APK to Cloudflare R2**

Executar script de upload para substituir o arquivo no bucket `hubsupport-storage/phone-finder/hubsupport-phone-finder.apk`.

- [x] **Step 3: Run end-to-end verification of endpoint and full web build**

Run: `npm run build` no HubSupport e teste de download do APK via `curl/GET /api/phone-finder/apk`.  
Expected: Endpoint retorna 200 com `application/vnd.android.package-archive` e hash correspondente ao novo APK.

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/plans/
git commit -m "chore(phoneFinder): complete inverted onboarding and pure sound alert implementation"
```
