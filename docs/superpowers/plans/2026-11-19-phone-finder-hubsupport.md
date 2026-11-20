# Phone Finder no HubSupport (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o sistema completo de backend e painel web do Phone Finder (SPEC v1.0) ao HubSupport, com persistência PostgreSQL/Prisma, API REST autenticada, Socket.IO em namespaces isolados (`/panel` e `/device`), despacho híbrido com FCM (fallback gracioso) e nova aba na Sidebar seguindo o design system da plataforma.

**Architecture:** Um módulo de domínio isolado em `src/server/phoneFinder/` encapsula repositório Prisma (`IPhoneCardRepository`), serviços de pareamento, presença/bateria em memória, FCM e despacho híbrido de comandos. O `http.Server` do Express (`src/server/index.ts`) acopla `socket.io` com dois namespaces (`/panel` protegido por JWT e `/device` exclusivo para aparelhos), enquanto o frontend React consome `/api/cards` via `src/services/api.ts` e recebe atualizações em tempo real pelo hook `usePhoneFinderSocket`.

**Tech Stack:** Express 5, TypeScript, Prisma 5 (PostgreSQL), `socket.io`, `socket.io-client`, `firebase-admin`, React 19, Vite 8, Tailwind CSS v4, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-11-19-phone-finder-hubsupport-design.md`

---

## Global Constraints

- **Nunca** expor `pushToken` em respostas REST (`GET/POST/PUT /api/cards`) ou eventos enviados para `/panel` — expor apenas `hasPushToken: boolean`.
- **Nunca** persistir cards em arquivo JSON em disco (Render possui filesystem efêmero); persistir exclusivamente no PostgreSQL via `PhoneCard` (Prisma).
- **Nunca** desabilitar os botões **Localizar** e **Vibrar** quando um card estiver `Pareado + Offline` (desabilitar apenas durante comando em andamento na janela de 7s).
- **Nunca** emitir `alert:locate`, `alert:vibrate` ou `device:unpaired` em broadcast — usar exclusivamente target emit para o(s) socket(s) do dispositivo alvo.
- Todas as rotas REST em `/api/cards` exigem `authenticateToken` (acesso geral a todos os usuários autenticados, sem restrição por role).
- Preservar `server.requestTimeout = 15 * 60 * 1000`, `server.headersTimeout = 16 * 60 * 1000` e encerramento gracioso em `src/server/index.ts`.
- Todo consumo REST no frontend deve passar por `src/services/api.ts`.
- Durações fixas: `locate = 5000 ms`, `vibrate = 3000 ms`; timeout de ACK: `7000 ms`; TTL de pareamento: `300_000 ms` (5 min); varredura de códigos expirados: `30_000 ms`; Socket.IO `pingTimeout = 120_000`, `pingInterval = 45_000`.
- Todo timestamp é string ISO 8601, exceto `timestamp` em `alert:ack` / `vibrate:ack` que é `number` (Unix ms).

## Review Focus

- **Dispositivo desvinculado/excluído enquanto offline tenta reconectar via `device:identify`:** deve receber `device:unpaired` e não registrar presença nem emitir `online` (testado na Task 3).
- **Reconexão rápida com dois sockets sobrepostos para o mesmo `deviceId`:** desconectar o socket antigo não pode marcar o card como `offline` enquanto o novo socket estiver ativo (testado na Task 2).
- **Token FCM inválido/revogado durante disparo offline:** deve falhar rápido (`503`, cancelando o timer de 7s), limpar `pushToken = null` no PostgreSQL e emitir `device:status` (`hasPushToken: false`) para `/panel` (testado na Task 2).
- **ACK tardio (após 7s) e ACK forjado por outro dispositivo identificado:** ACK tardio é descartado silenciosamente sem reemitir feedback; ACK vindo de um socket identificado como `deviceB` para comando do `deviceA` é ignorado (testado na Task 2).
- **Vazamento de `pushToken` e validação de nome vazio:** nenhuma resposta pública pode conter `pushToken`, e `POST`/`PUT /api/cards` com `name` vazio/só espaços deve retornar `400` (testado nas Tasks 1 e 3).

---

### Task 1: Dependências, Schema Prisma (`PhoneCard`), Auth Reutilizável e Repositório

**Files:**
- Modify: `package.json` (instalar `socket.io`, `socket.io-client`, `firebase-admin`)
- Modify: `prisma/schema.prisma` (adicionar model `PhoneCard`)
- Modify: `src/server/auth.ts:44-93` (extrair `verifySessionToken`)
- Create: `src/server/phoneFinder/types.ts`
- Create: `src/server/phoneFinder/cardRepository.ts`
- Test: `scripts/test-phone-finder-repo.ts`

**Interfaces:**
- Consumes: `prisma` (`src/lib/prisma.ts`), `AuthenticatedUser` (`src/server/auth.ts`)
- Produces:
  - `verifySessionToken(token: string): Promise<AuthenticatedUser | null>` em `src/server/auth.ts`
  - `PhoneCardRecord`, `PublicPhoneCard`, `CardWithStatus`, `DevicePresenceStatus`, `BatteryTelemetry`, `CommandAction`, `CommandAckStatus`, `CommandFeedbackStatus`, `CommandFeedbackPayload`, `PairingCodeResponse`, `toPublicPhoneCard(card: PhoneCardRecord): PublicPhoneCard` em `src/server/phoneFinder/types.ts`
  - `IPhoneCardRepository`, `PrismaPhoneCardRepository`, `InMemoryPhoneCardRepository` em `src/server/phoneFinder/cardRepository.ts`

- [x] **Step 1: Instalar dependências de runtime**

Run: `npm install socket.io socket.io-client firebase-admin`
Expected: Instalação concluída sem erros e entradas adicionadas em `package.json`.

- [x] **Step 2: Adicionar `PhoneCard` em `prisma/schema.prisma` e sincronizar com o banco**

Adicionar o modelo `PhoneCard` conforme Seção 5.1 da spec (`id String @id @default(uuid())`, `name String`, `description String? @db.Text`, `pairedDeviceId String? @unique`, `pushToken String? @db.Text`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`).

Run: `npx prisma db push && npx prisma generate`
Expected: Schema sincronizado no PostgreSQL e Prisma Client regenerado.

- [x] **Step 3: Escrever teste de unidade e persistência em `scripts/test-phone-finder-repo.ts`**

Assertions obrigatórias:
- `toPublicPhoneCard(record)` retorna `hasPushToken: true` quando `pushToken` existe e **não** contém a chave `"pushToken"` (`"pushToken" in pub === false`).
- `PrismaPhoneCardRepository`: `create`, `findById`, `findAll`, `update`, `pairDevice(id, deviceId, pushToken)`, `findByDeviceId(deviceId)`, `updatePushToken(id, null)`, `unpairDevice(id)`, `delete(id)` (com limpeza em bloco `finally`).
- `InMemoryPhoneCardRepository`: espelha exatamente o contrato de `IPhoneCardRepository` (incluindo unicidade de `pairedDeviceId`).

- [x] **Step 4: Executar o teste para confirmar falha inicial**

Run: `npx tsx scripts/test-phone-finder-repo.ts`
Expected: FAIL (módulos `types.ts` / `cardRepository.ts` ainda não existem).

- [x] **Step 5: Extrair `verifySessionToken(token: string)` em `src/server/auth.ts`**

Extrair a verificação JWT + lookup do usuário ativo no Prisma para `export async function verifySessionToken(token: string): Promise<AuthenticatedUser | null>` e fazer `authenticateToken` reutilizá-la sem alterar nenhuma mensagem HTTP ou comportamento existente.

- [x] **Step 6: Implementar `src/server/phoneFinder/types.ts` e `src/server/phoneFinder/cardRepository.ts`**

Definir todos os DTOs da Seção 5.2 da spec, os payloads dos 18 eventos da Seção 5.4, `toPublicPhoneCard` e as implementações `PrismaPhoneCardRepository` e `InMemoryPhoneCardRepository`.

- [x] **Step 7: Executar testes e typecheck**

Run: `npx tsx scripts/test-phone-finder-repo.ts && npx tsc --noEmit`
Expected: Todos os testes do repositório PASS e `tsc` sai com código 0.

- [x] **Step 8: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma src/server/auth.ts src/server/phoneFinder/types.ts src/server/phoneFinder/cardRepository.ts scripts/test-phone-finder-repo.ts
git commit -m "feat(phone-finder): adicionar model PhoneCard, repositorio e contratos base"
```

---

### Task 2: Serviços de Domínio — Pareamento, Presença/Bateria, FCM e Despacho Híbrido

**Files:**
- Create: `src/server/phoneFinder/pairingService.ts`
- Create: `src/server/phoneFinder/presenceService.ts`
- Create: `src/server/phoneFinder/fcmService.ts`
- Create: `src/server/phoneFinder/commandService.ts`
- Create: `src/server/phoneFinder/index.ts`
- Test: `scripts/test-phone-finder-services.ts`

**Interfaces:**
- Consumes: `IPhoneCardRepository`, `InMemoryPhoneCardRepository`, todos os DTOs de `src/server/phoneFinder/types.ts`
- Produces:
  - `PairingService` (`generateCode(cardId)`, `submitCode(code, pushToken?, clientKey?)`, `invalidateCardCode(cardId)`, `stop()`)
  - `PresenceService` (`registerSocket(deviceId, socketId, version?)`, `unregisterSocket(socketId)`, `getSockets(deviceId)`, `getDeviceBySocket(socketId)`, `isOnline(deviceId)`, `setBattery(deviceId, level, isCharging)`, `getBattery(deviceId)`, `getAppVersion(deviceId)`, `clearDevice(deviceId)`)
  - `IFcmService` & `FcmService` (`isConfigured()`, `sendCommand(params): Promise<FcmSendResult>`)
  - `CommandService` (`dispatchCommand(cardId, action): Promise<CommandDispatchOutcome>`, `handleAck(commandId, status, timestamp, socketDeviceId?)`, `hasInFlight(cardId)`, `stop()`)
  - `PhoneFinderRuntime` & `createPhoneFinderRuntime(overrides?)` + singleton `phoneFinderRuntime` em `src/server/phoneFinder/index.ts`

- [x] **Step 1: Escrever suíte de testes unitários em `scripts/test-phone-finder-services.ts`**

Usar `InMemoryPhoneCardRepository`, mock de `IFcmService`, emissores mockados e timers configuráveis (`timeoutMs`, `ttlMs`) para testar todos os cenários:
1. **PairingService:** gera código 6 dígitos (`^\d{6}$`), invalida código anterior do mesmo card, rejeita formato inválido / inexistente / expirado / card deletado na ordem da SPEC, consumo único (segunda tentativa falha), troca de aparelho em card já pareado retorna `previousDeviceId`, e rate limit bloqueia após 10 tentativas inválidas por minuto para o mesmo `clientKey`.
2. **PresenceService (Review Focus #2):** conectar `socket-1` e `socket-2` para o mesmo `deviceId` → desconectar `socket-1` mantém `isOnline(deviceId) === true` e retorna `wentOffline: false`; desconectar `socket-2` retorna `wentOffline: true`; telemetria de bateria salva e retorna `0..100` + `isCharging`.
3. **FcmService:** sem variáveis de ambiente, `isConfigured() === false` e `sendCommand` retorna `{ sent: false, error: ... }` sem lançar exceção.
4. **CommandService — entrega dupla + ACK:** card online + `pushToken` dispara tanto `emitToDevice` quanto `fcmService.sendCommand`; `handleAck(commandId, "ok", Date.now(), deviceId)` resolve `{ httpStatus: 200, feedback: { status: "success" } }` e emite feedback no painel.
5. **CommandService — ACK acordado via FCM (sem `device:identify`):** `handleAck(commandId, "ok", Date.now(), undefined)` resolve com `success`.
6. **CommandService — Review Focus #4 (ACK forjado + ACK tardio):** `handleAck(commandId, "ok", Date.now(), "outro-device")` é ignorado (comando segue pendente); após timeout (`httpStatus: 408`, `status: "timeout"`), ACK tardio é descartado silenciosamente sem segundo feedback.
7. **CommandService — concorrência (`409`):** segundo disparo no mesmo `cardId` enquanto o primeiro está pendente retorna `httpStatus: 409`.
8. **CommandService — Review Focus #3 (falha rápida offline + limpeza de token):** card offline com `pushToken` onde FCM retorna `{ sent: false, invalidToken: true }` cancela timer imediatamente (`httpStatus: 503`), limpa `pushToken = null` no repositório e invoca callback de atualização de status (`hasPushToken: false`).
9. **CommandService — online com falha FCM:** quando socket está online e FCM falha, **não** faz fail-fast e continua aguardando ACK do WebSocket.
10. **CommandService — ACK de erro do dispositivo:** `handleAck(commandId, "error", Date.now(), deviceId)` resolve `{ httpStatus: 502, feedback: { status: "error" } }`.

- [x] **Step 2: Executar o teste para confirmar falha inicial**

Run: `npx tsx scripts/test-phone-finder-services.ts`
Expected: FAIL (serviços ainda não existem).

- [x] **Step 3: Implementar `pairingService.ts`, `presenceService.ts`, `fcmService.ts`, `commandService.ts` e `index.ts`**

- `PairingService`: aceita opções opcionais `{ ttlMs?: number; cleanupIntervalMs?: number; maxFailedAttemptsPerMinute?: number }` com defaults da spec (`300_000`, `30_000`, `10`), usando `crypto.randomInt(100000, 1000000)`.
- `PresenceService`: mapas `deviceSockets: Map<string, Set<string>>`, `socketToDevice`, `batteryMap`, `appVersionMap`.
- `FcmService`: inicializa `firebase-admin` de forma lazy via `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON ou base64) ou `FIREBASE_SERVICE_ACCOUNT_PATH`; detecta códigos `messaging/registration-token-not-registered` e `messaging/invalid-registration-token` retornando `invalidToken: true`.
- `CommandService`: aceita `{ ackTimeoutMs?: number }` (default `7000`), durações `LOCATE_DURATION_MS = 5000`, `VIBRATE_DURATION_MS = 3000`, suporta `setTransportHooks(...)` para o servidor Socket.IO plugar `emitToDevice` e `broadcastToPanel`.
- `index.ts`: exporta `createPhoneFinderRuntime` e `phoneFinderRuntime` + helper `enrichCardWithStatus(card, presenceService): CardWithStatus`.

- [x] **Step 4: Executar testes e typecheck**

Run: `npx tsx scripts/test-phone-finder-services.ts && npx tsc --noEmit`
Expected: 100% dos cenários PASS e `tsc` código 0.

- [x] **Step 5: Commit**

```bash
git add src/server/phoneFinder/ scripts/test-phone-finder-services.ts
git commit -m "feat(phone-finder): implementar servicos de pareamento, presenca, FCM e despacho hibrido"
```

---

### Task 3: Servidor Socket.IO (`/panel` e `/device`), API REST (`/api/cards`), HTTP Wiring e Proxy Vite

**Files:**
- Create: `src/server/phoneFinder/socketServer.ts`
- Create: `src/server/routes/cards.routes.ts`
- Modify: `src/server/app.ts:15-75` (montar `/api/cards`)
- Modify: `src/server/index.ts:1-35` (migrar para `http.createServer(app)`, acoplar Socket.IO e encerramento gracioso)
- Modify: `vite.config.mts:14-27` (adicionar proxy `/socket.io` com `ws: true`)
- Test: `scripts/test-phone-finder-integration.ts`

**Interfaces:**
- Consumes: `phoneFinderRuntime`, `createPhoneFinderRuntime`, `enrichCardWithStatus` (`src/server/phoneFinder/index.ts`), `authenticateToken`, `verifySessionToken`, `generateToken` (`src/server/auth.ts`)
- Produces:
  - `attachPhoneFinderSocketServer(httpServer: HttpServer, runtime: PhoneFinderRuntime): SocketIOServer` em `src/server/phoneFinder/socketServer.ts`
  - `createCardsRouter(runtime: PhoneFinderRuntime): Router` e default router em `src/server/routes/cards.routes.ts`
  - Endpoints REST `/api/cards/*` e namespaces Socket.IO `/panel` e `/device` ativos no servidor Express

- [x] **Step 1: Escrever teste de integração ponta a ponta em `scripts/test-phone-finder-integration.ts`**

Sobe um servidor HTTP efêmero (`port: 0`) com Express + `createCardsRouter(runtime)` + `attachPhoneFinderSocketServer(httpServer, runtime)` (usando `InMemoryPhoneCardRepository`, `verifySessionToken` com usuário real ou mockado via token de teste, e `ackTimeoutMs: 400` para testes rápidos de timeout), conectando clientes `socket.io-client` reais em `/panel` e `/device`:
1. **Segurança REST e `/panel`:** `GET /api/cards` sem token retorna `401`; conexão em `/panel` sem token ou com token inválido falha com `"UNAUTHORIZED"`; conexão em `/panel` com token válido conecta.
2. **CRUD REST + Review Focus #5:** `POST /api/cards` com `name: "   "` retorna `400`; criar card válido retorna `201` sem `pushToken`; `GET /api/cards` e `GET /api/cards/:id` retornam `status: "unpaired"`; `PUT /api/cards/:id` atualiza nome/descrição.
3. **Fluxo completo de pareamento via Socket.IO + REST:** `POST /api/cards/:id/pairing-code` gera código 6 dígitos → `/device` emite `pairing:submit` com `{ code, pushToken: "fcm-secret-token" }` → `/device` recebe `pairing:result` (`success: true`, `deviceId`, `cardId`, `cardName`) → `/panel` recebe broadcast `device:status` (`status: "online"`, `hasPushToken: true`) sem conter `pushToken` → `GET /api/cards/:id` confirma `status: "online"`, `hasPushToken: true` e `"pushToken" in body === false`.
4. **Telemetria de bateria:** `/device` identificado emite `device:battery` (`level: 84, isCharging: true`) → `/panel` recebe `card:battery`; `/device` não identificado emitindo `device:battery` é ignorado.
5. **Localizar e Vibrar com ACK + Timeout:** `POST /api/cards/:id/locate` entrega `alert:locate` apenas ao socket alvo (segundo dispositivo conectado **não** recebe!) → dispositivo responde `alert:ack` (`status: "ok"`) → HTTP retorna `200` com `status: "success"` e `/panel` recebe `locate:feedback`; dispositivo silenciando ACK em `POST /api/cards/:id/vibrate` resulta em HTTP `408` com `status: "timeout"` e `/panel` recebe `vibrate:feedback`.
6. **Review Focus #1 (desvinculação + reconexão offline):** `POST /api/cards/:id/unpair` envia `device:unpaired` ao celular e broadcast `status: "unpaired"` em `/panel`; se o celular reconectar e emitir `device:identify` com o `deviceId` antigo, recebe imediatamente `device:unpaired` e não altera status no `/panel`.
7. **Delete de card pareado:** `DELETE /api/cards/:id` em card pareado envia `device:unpaired` ao celular conectado e remove o card (`GET` retorna `404`).

- [x] **Step 2: Executar teste de integração para confirmar falha inicial**

Run: `npx tsx scripts/test-phone-finder-integration.ts`
Expected: FAIL (arquivos `socketServer.ts` e `cards.routes.ts` ainda não existem).

- [x] **Step 3: Implementar `src/server/phoneFinder/socketServer.ts`**

Implementar `attachPhoneFinderSocketServer(httpServer, runtime)` com:
- `cors: { origin: true, credentials: true }`, `pingTimeout: 120_000`, `pingInterval: 45_000`.
- Middleware `/panel` aceitando token via `socket.handshake.auth?.token`, `Authorization: Bearer` ou cookie `token`, validando com `verifySessionToken`.
- Todos os 18 eventos da Seção 5.4 da spec (target emit exclusivo em `/device`, broadcast em `/panel`).
- Integração dos transport hooks no `runtime` (`emitToDevice`, `broadcastDeviceStatus`, `broadcastBattery`, `broadcastCommandFeedback`) para que tanto rotas REST quanto eventos Socket.IO compartilhem a mesma orquestração.

- [x] **Step 4: Implementar `src/server/routes/cards.routes.ts` e acoplar em `app.ts`, `index.ts` e `vite.config.mts`**

- `cards.routes.ts`: montar os 9 endpoints REST com `authenticateToken`, validação de `name.trim()`, e mapeamento HTTP exato da Seção 5.5.
- `app.ts`: `app.use("/api/cards", cardsRoutes);` (e garantir que `req.path.startsWith("/socket.io")` não caia no fallback SPA `index.html`).
- `index.ts`: usar `http.createServer(app)`, manter `requestTimeout = 15 * 60 * 1000` e `headersTimeout = 16 * 60 * 1000`, chamar `attachPhoneFinderSocketServer(server, phoneFinderRuntime)` e encerrar `io.close()` + `phoneFinderRuntime.stop()` em `SIGTERM`/`SIGINT`.
- `vite.config.mts`: adicionar proxy `"/socket.io": { target: "http://localhost:4000", ws: true, changeOrigin: true }`.

- [x] **Step 5: Executar testes de integração e typecheck**

Run: `npx tsx scripts/test-phone-finder-integration.ts && npx tsc --noEmit`
Expected: Todos os cenários de integração PASS e `tsc` código 0.

- [x] **Step 6: Commit**

```bash
git add src/server/phoneFinder/socketServer.ts src/server/routes/cards.routes.ts src/server/app.ts src/server/index.ts vite.config.mts scripts/test-phone-finder-integration.ts
git commit -m "feat(phone-finder): adicionar namespaces Socket.IO, rotas REST /api/cards e proxy WS"
```

---

### Task 4: Camada de API do Frontend e Hook Socket.IO (`/panel`)

**Files:**
- Modify: `src/services/api.ts` (exportar `getSocketBaseUrl`, tipos Phone Finder e `api.phoneFinder`)
- Create: `src/hooks/usePhoneFinderSocket.ts`

**Interfaces:**
- Consumes: `getToken`, `API_BASE`, `resolveApiUrl` (`src/services/api.ts`), eventos `/panel` da Task 3
- Produces:
  - `PhoneCardItem` (= `CardWithStatus`), `PhoneBatteryInfo`, `PhonePairingCodeResponse`, `PhoneCommandFeedback`, `getSocketBaseUrl()`, `api.phoneFinder` (`getCards`, `getCard`, `createCard`, `updateCard`, `deleteCard`, `generatePairingCode`, `unpairCard`, `locateCard`, `vibrateCard`) em `src/services/api.ts`
  - `usePhoneFinderSocket(handlers): { connectionState: "connecting" | "connected" | "disconnected" }` em `src/hooks/usePhoneFinderSocket.ts`

- [x] **Step 1: Adicionar tipos, `getSocketBaseUrl()` e `api.phoneFinder` em `src/services/api.ts`**

- `getSocketBaseUrl()` retorna `API_BASE || (typeof window !== "undefined" ? window.location.origin : "")`.
- Em `locateCard(id)` e `vibrateCard(id)`, usar `fetch(resolveApiUrl(...))` com credenciais/Authorization tratando explicitamente status `200`, `408`, `409`, `502`, `503` para retornar o `PhoneCommandFeedback` estruturado (em vez de jogar erro genérico), mantendo redirecionamento em `401`.

- [x] **Step 2: Criar `src/hooks/usePhoneFinderSocket.ts`**

Conecta em `${getSocketBaseUrl()}/panel` com `{ auth: { token: getToken() }, withCredentials: true, transports: ["websocket", "polling"], reconnection: true }`.
Usa refs para callbacks (`onDeviceStatus`, `onCardBattery`, `onLocateFeedback`, `onVibrateFeedback`) para evitar reconexões desnecessárias quando o componente re-renderizar, atualiza `connectionState` em `connect`, `disconnect`, `connect_error`, `reconnect_attempt`, e desconecta limpo no unmount.

- [x] **Step 3: Verificar compilação TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [x] **Step 4: Commit**

```bash
git add src/services/api.ts src/hooks/usePhoneFinderSocket.ts
git commit -m "feat(phone-finder): adicionar cliente REST api.phoneFinder e hook Socket.IO /panel"
```

---

### Task 5: Interface Web do Phone Finder (Design System HubSupport) e Navegação

**Files:**
- Create: `src/components/phoneFinder/PhoneCardFormModal.tsx`
- Create: `src/components/phoneFinder/PairingCodeModal.tsx`
- Create: `src/components/phoneFinder/PhoneCardTile.tsx`
- Create: `src/pages/PhoneFinderPage.tsx`
- Modify: `src/components/Sidebar.tsx:58-105` (adicionar aba **Phone Finder** abaixo de **Atendimentos**)
- Modify: `src/App.tsx:10-46` (registrar rota `/dashboard/phone-finder`)

**Interfaces:**
- Consumes: `api.phoneFinder`, `PhoneCardItem`, `PhoneCommandFeedback`, `PhonePairingCodeResponse` (`src/services/api.ts`), `usePhoneFinderSocket` (`src/hooks/usePhoneFinderSocket.ts`)
- Produces: Rota `/dashboard/phone-finder` acessível pela Sidebar logo abaixo de **Atendimentos**

- [ ] **Step 1: Criar `src/components/phoneFinder/PhoneCardFormModal.tsx`**

Modal limpo no padrão HubSupport (`bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl`) para criar ou editar um card (`name` obrigatório, `description` opcional), com loading state e validação inline.

- [ ] **Step 2: Criar `src/components/phoneFinder/PairingCodeModal.tsx`**

Exibe:
- Código de 6 dígitos formatado (`tracking-[0.25em] font-mono text-4xl font-bold`) com botão **Copiar** (feedback "Copiado!").
- Barra de progresso + contador regressivo ao vivo `MM:SS` calculado a partir de `expiresAt` (5:00 → 00:00).
- Estado "Código expirado" com botão **Gerar novo código** (também disponível a qualquer momento para regenerar).
- Detecção automática de pareamento: quando o card vinculado mudar para `online` (ou receber novo `pairedDeviceId` diferente do anterior), exibe tela de confirmação em esmeralda ("Dispositivo pareado com sucesso!") e botão para fechar (ou fecha automaticamente após breve confirmação).

- [ ] **Step 3: Criar `src/components/phoneFinder/PhoneCardTile.tsx`**

Card estilizado no padrão HubSupport (`bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all`):
- Topo: nome + descrição + badge de presença (`Online` esmeralda com dot pulsante, `Offline` âmbar, `Não pareado` slate) + menu/botões discretos de gerenciamento (Editar, Parear/Trocar aparelho, Desvincular, Excluir).
- Faixa de telemetria (quando pareado): ícone dinâmico de bateria (`BatteryFull`/`BatteryMedium`/`BatteryLow`/`BatteryCharging` da `lucide-react`) + percentual colorido, badge discreto da versão do app (se houver) e indicador sutil de Push FCM (`Push ativo` vs `Somente tempo real`).
- Rodapé de ações:
  - Se `status === "unpaired"`: botão **Parear Dispositivo**.
  - Se pareado (`online` **ou** `offline`): botões **Localizar** (destaque rose/red, `BellRing`) e **Vibrar** (secundário polido, `Vibrate`) **sempre habilitados**, ficando com spinner/desabilitados apenas enquanto `isDispatching` para aquele card.
- Faixa de feedback recente do comando (`success` esmeralda, `timeout` âmbar, `error` rose) com auto-limpeza suave.

- [ ] **Step 4: Criar `src/pages/PhoneFinderPage.tsx`**

Estrutura alinhada com `ClientsPage` / `TechnicianPage` (`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8`):
- Header com título **Phone Finder**, subtítulo conciso, indicador discreto de status do WebSocket (`Tempo real ativo` / `Reconectando...`) e botão **+ Novo Card**.
- Cards/chips de resumo (`Total`, `Online`, `Offline`, `Não pareados`) clicáveis como filtro rápido + input de busca por nome/descrição.
- Grid responsivo (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`) + empty state amigável.
- Sincronização em tempo real via `usePhoneFinderSocket` atualizando presença, bateria e feedbacks de comando sem reload de página + modais de formulário, pareamento e confirmação de desvincular/excluir.

- [ ] **Step 5: Registrar aba na `src/components/Sidebar.tsx` e rota em `src/App.tsx`**

- Em `src/components/Sidebar.tsx`: no grupo `OPERAÇÃO`, imediatamente abaixo de `Atendimentos`, adicionar `{ href: "/dashboard/phone-finder", label: "Phone Finder", exact: false, icon: <Smartphone className="w-5 h-5 shrink-0" /> }`.
- Em `src/App.tsx`: importar `PhoneFinderPage` e adicionar `<Route path="/dashboard/phone-finder" element={<PhoneFinderPage />} />`.

- [ ] **Step 6: Verificar tipagem e build de produção**

Run: `npx tsc --noEmit && npx vite build`
Expected: 0 erros TypeScript e bundle Vite compilado sem warnings críticos.

- [ ] **Step 7: Commit**

```bash
git add src/components/phoneFinder/ src/pages/PhoneFinderPage.tsx src/components/Sidebar.tsx src/App.tsx
git commit -m "feat(phone-finder): criar pagina Phone Finder, componentes e aba na Sidebar"
```

---

### Task 6: Simulador de Dispositivo Android e Verificação Final de Ponta a Ponta

**Files:**
- Create: `scripts/simulate-phone-finder-device.ts`

**Interfaces:**
- Consumes: Namespace `/device` do servidor Socket.IO (Task 3)
- Produces: Script CLI interativo para simular um celular Android real conectando ao HubSupport local ou em produção

- [ ] **Step 1: Criar `scripts/simulate-phone-finder-device.ts`**

Script CLI executável via `npx tsx scripts/simulate-phone-finder-device.ts --url http://localhost:4000 --code 123456` (ou `--device-id <uuid>` para testar reconexão):
- Conecta em `${url}/device`.
- Se `--code` fornecido: emite `pairing:submit` com `{ code, pushToken: "simulated-fcm-token" }`, imprime `deviceId` recebido.
- Se `--device-id` fornecido: emite `device:identify` com `{ deviceId, appVersionCode: 1, appVersionName: "1.0.0-sim" }`.
- Emite `device:battery` inicial (`level: 85, isCharging: false`) e periodicamente.
- Ao receber `alert:locate` ou `alert:vibrate`: aplica deduplicação em `Set<string>` por `commandId`, exibe banner colorido no terminal, e envia `alert:ack` / `vibrate:ack` com `{ commandId, status: "ok", timestamp: Date.now() }`.
- Ao receber `device:unpaired`: imprime aviso e encerra o processo limpo.

- [ ] **Step 2: Executar toda a suíte de verificação e build**

Run:
```bash
npx tsx scripts/test-phone-finder-repo.ts
npx tsx scripts/test-phone-finder-services.ts
npx tsx scripts/test-phone-finder-integration.ts
npx tsc --noEmit
npm run build
```
Expected: Todas as suítes de teste com 0 falhas, `tsc --noEmit` código 0, e `npm run build` gerando Prisma Client + `dist/` com sucesso.

- [ ] **Step 3: Commit**

```bash
git add scripts/simulate-phone-finder-device.ts
git commit -m "chore(phone-finder): adicionar simulador CLI de dispositivo e verificacao final"
```
