# Design Doc: Phone Finder no HubSupport (Fase 1 — Backend + Painel Web)

**Data:** 19/11/2026  
**Status:** Aprovado pelo usuário em 19/11/2026  
**Escopo:** Projeto completo — Fase 1 de 2 (a Fase 2 será o App Android nativo em repositório separado)  
**Referência Funcional:** Phone Finder SPEC v1.0

---

## 1. Propósito e Contexto (Intent & Why)

O **Phone Finder** resolve a localização física rápida de celulares em ambientes com muitos aparelhos (bancadas técnicas, escritórios, testes). O operador seleciona um cartão no painel web e aciona o celular físico com alarme sonoro em volume máximo (`STREAM_ALARM`), vibração intensa e tela cheia vermelha (`#FF0000`) — ou apenas vibração em ambientes silenciosos.

Esta **Fase 1** integra todo o servidor (persistência, API REST, WebSockets em tempo real, despacho híbrido e integração FCM) e o painel web diretamente dentro do **HubSupport**, em uma nova aba de navegação posicionada logo abaixo de **Atendimentos** e estilizada com o design system da plataforma. O app Android nativo será construído do zero na **Fase 2**, em repositório separado, consumindo o contrato exato definido neste documento.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos (Goals)
- Persistir os **Cards** no PostgreSQL existente do HubSupport via Prisma (`PhoneCard`), isolados por um **Repository Pattern** desacoplado (`IPhoneCardRepository`).
- Expor os **9 endpoints REST** da SPEC em `/api/cards` protegidos pela autenticação de sessão do HubSupport (`authenticateToken`), com **acesso geral** para todos os usuários autenticados (decisão do usuário).
- Acoplar **Socket.IO** ao servidor HTTP do Express (`src/server/index.ts`) com **dois namespaces isolados**:
  - `/panel`: exige JWT válido do HubSupport no handshake; recebe atualizações de presença, bateria e feedback; pode emitir eventos de painel.
  - `/device`: exclusivo para dispositivos móveis (sem login de usuário HubSupport); recebe apenas eventos de pareamento, identificação, bateria e ACKs.
- Implementar integralmente os **18 eventos em tempo real** da SPEC (Seção 5.4), incluindo:
  - Pareamento por código de 6 dígitos (CSPRNG, TTL 5 min, uso único, 1 código ativo por card, limpeza automática a cada 30s, rate limit básico contra brute-force).
  - Presença em tempo real (`unpaired` / `online` / `offline`) e telemetria de bateria em memória.
  - Despacho híbrido de comandos (*Localizar* 5000ms e *Vibrar* 3000ms) com entrega dupla simultânea (Socket.IO target emit + FCM data-only high-priority), deduplicação por `commandId` (UUID v4), ciclo de ACK e timeout de 7 segundos.
  - Integração FCM (`firebase-admin`) com **fallback gracioso**: opera em modo real-time sem quebrar quando credenciais do Firebase não estiverem configuradas no `.env`.
- Adicionar a aba **Phone Finder** na Sidebar (`src/components/Sidebar.tsx`) imediatamente abaixo de **Atendimentos** (grupo `OPERAÇÃO`), rota `/dashboard/phone-finder`, seguindo fielmente o design system do HubSupport (light/dark mode).
- Fornecer um **script simulador de dispositivo** (`scripts/simulate-phone-finder-device.ts`) e suíte automatizada de testes cobrindo REST, Socket.IO (`/panel` e `/device`), pareamento, presença, bateria, ACK (online e acordado via FCM), timeout, concorrência e fallback FCM.

### Não-Objetivos (Non-Goals)
- Construção do aplicativo Android nativo (Kotlin / Android Studio) — pertence à Fase 2.
- Restrição de permissões por cargo (`ADMIN` vs `USER`) — todos os usuários autenticados do HubSupport têm acesso completo.
- Escalabilidade horizontal multi-instância (Redis adapter para Socket.IO) — o backend do HubSupport opera em instância única no Render.
- Persistência de histórico de bateria ou histórico de comandos disparados no banco de dados.
- Customização de duração (`durationMs`) pela UI — as durações são constantes fixas conforme a SPEC (`5000ms` para `locate`, `3000ms` para `vibrate`).

### Anti-Objetivos (Anti-Goals)
- **Nunca** expor `pushToken` em nenhuma resposta REST (`GET /api/cards`, `GET /api/cards/:id`) nem em eventos emitidos para `/panel`.
- **Nunca** persistir cards em arquivo JSON em disco (no Render o filesystem é efêmero e apagaria os pareamentos a cada deploy).
- **Nunca** desabilitar os botões **Localizar** e **Vibrar** quando o card estiver `Pareado + Offline` (a entrega via FCM deve permanecer acionável).
- **Nunca** emitir comandos (`alert:locate`, `alert:vibrate`, `device:unpaired`) em broadcast — usar sempre target emit exclusivo ao(s) socket(s) do `deviceId` alvo.
- **Nunca** quebrar rotas REST existentes, upload de arquivos até 1GB ou timeouts configurados em `src/server/index.ts`.

---

## 3. Restrições e Contexto do Projeto (Constraints)

- **Stack atual:** Express 5, TypeScript, Prisma 5 com **PostgreSQL**, React 19, Vite 8, Tailwind CSS v4, `lucide-react`.
- **Novas dependências:** `socket.io`, `socket.io-client`, `firebase-admin`.
- **Hospedagem em produção:** Frontend SPA no Cloudflare Pages + Backend Express no Render (`https://hubsupport-api.onrender.com`).
- **Configuração de Proxy em Dev (`vite.config.mts`):** encaminhar `/socket.io` com `ws: true` para `http://localhost:4000`, além de `/api` e `/uploads`.
- **Timeouts e Shutdown (`src/server/index.ts`):** migrar de `app.listen()` para `http.createServer(app)` preservando `requestTimeout = 15 * 60 * 1000` e `headersTimeout = 16 * 60 * 1000`. Em `SIGTERM`/`SIGINT`, fechar o servidor Socket.IO e parar o `setInterval` de limpeza de códigos de pareamento.
- **Autenticação reutilizável (`src/server/auth.ts`):** extrair função `verifySessionToken(token: string): Promise<AuthenticatedUser | null>` compartilhada entre o middleware Express `authenticateToken` e o middleware do namespace Socket.IO `/panel`.
- **Regra permanente do HubSupport:** todo consumo REST do frontend deve passar por `src/services/api.ts`.

---

## 4. Abordagens Consideradas (Approaches)

| Abordagem | Resumo | Trade-offs | Decisão |
|---|---|---|---|
| **A — PostgreSQL + Socket.IO `/` (sala `panel`)** | Persistência no PostgreSQL/Prisma; namespace raiz `/` com segregação por sala/auth. | Mais literal à SPEC para clientes externos, porém mistura conexões de painel e celular no mesmo namespace. | Não escolhida |
| **B — JSON Atômico + Socket.IO `/`** | Armazena cards em `storage/phone-finder/cards.json`. | **Inviável no Render** (filesystem efêmero apaga cards pareados em cada deploy). | Descartada |
| **C — PostgreSQL + Namespaces `/panel` e `/device`** | Persistência no PostgreSQL/Prisma + Repository Pattern; namespaces Socket.IO isolados (`/panel` com JWT obrigatório na borda, `/device` exclusivo para celulares). | Segurança estrutural por construção e isolamento limpo caso o HubSupport ganhe outros recursos real-time no futuro; app Android (Fase 2) conectará explicitamente em `/device`. | **Escolhida pelo usuário** |

---

## 5. Arquitetura Detalhada e Contrato de Protocolo

### 5.1 Modelo de Dados (`prisma/schema.prisma`)

```prisma
model PhoneCard {
  id             String   @id @default(uuid())
  name           String
  description    String?  @db.Text
  pairedDeviceId String?  @unique
  pushToken      String?  @db.Text
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

- `id` usa `@default(uuid())` (UUID v4), conforme Seção 2.1 da SPEC.
- `pairedDeviceId` é `@unique` para impedir que um mesmo `deviceId` fique vinculado a dois cards simultaneamente.
- `pushToken` nunca é serializado para respostas públicas.

### 5.2 Contratos DTO (REST e Tempo Real)

Todos os timestamps são **strings ISO 8601** (`createdAt`, `updatedAt`, `expiresAt`, `timestamp` de comando), com **uma exceção definida pela Seção 5.5 da SPEC**: o campo `timestamp` enviado pelo app nos eventos `alert:ack` e `vibrate:ack` é `number` (Unix epoch em ms).

```ts
export type DevicePresenceStatus = "unpaired" | "online" | "offline";
export type CommandAction = "locate" | "vibrate";
export type CommandAckStatus = "ok" | "error";
export type CommandFeedbackStatus = "success" | "timeout" | "error";

export interface BatteryTelemetry {
  level: number;        // inteiro 0..100
  isCharging: boolean;
  updatedAt: string;    // ISO 8601
}

export interface PublicPhoneCard {
  id: string;                      // UUID v4
  name: string;
  description: string | null;
  pairedDeviceId: string | null;   // UUID v4 ou null
  hasPushToken: boolean;           // substitui pushToken sem vazar o segredo
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}

export interface CardWithStatus extends PublicPhoneCard {
  status: DevicePresenceStatus;    // "unpaired" | "online" | "offline"
  battery: BatteryTelemetry | null;
  appVersionCode: number | null;
  appVersionName: string | null;
}

export interface PairingCodeResponse {
  cardId: string;
  code: string;        // 6 dígitos numéricos "100000".."999999"
  expiresAt: string;   // ISO 8601
}

export interface CommandFeedbackPayload {
  cardId: string;
  commandId: string;   // UUID v4 (ou "" se falhar antes de gerar comando)
  status: CommandFeedbackStatus; // "success" | "timeout" | "error"
  message: string;     // descrição legível em português
}
```

### 5.3 Camada de Repositório e Serviços (`src/server/phoneFinder/`)

1. **`cardRepository.ts`:** interface `IPhoneCardRepository` (`findAll`, `findById`, `findByDeviceId`, `create`, `update`, `delete`, `pairDevice`, `unpairDevice`, `updatePushToken`) + implementação `PrismaPhoneCardRepository`.
2. **`pairingService.ts`:**
   - Gera códigos de 6 dígitos com `crypto.randomInt(100000, 1000000).toString()`.
   - TTL de 5 minutos (`300_000 ms`), mantido apenas em `Map` em memória.
   - Um código ativo por `cardId`: gerar novo código invalida o anterior imediatamente.
   - Limpeza automática a cada 30s (`setInterval(..., 30_000)` com `.unref()` e `stop()` para shutdown).
   - **Rate limit em `pairing:submit` (nossa decisão):** máximo de **10 tentativas falhas por minuto por IP/socket**; acima disso retorna erro legível de limite excedido em `pairing:result` para proteger códigos de 6 dígitos no endpoint público `/device`.
   - Ordem estrita de validação (SPEC Seção 3.3):
     1. Formato inválido (não `/^\d{6}$/`) → erro legível.
     2. Código inexistente → erro legível.
     3. Código expirado → remove do mapa + erro instruindo gerar novo código.
     4. Card inexistente no repositório → remove do mapa + erro legível.
     5. Sucesso → consome código (uso único), gera `deviceId = crypto.randomUUID()`. Se o card já possuía outro `pairedDeviceId`, notifica o aparelho antigo com `device:unpaired` e limpa sua presença antes de vincular o novo.
3. **`presenceService.ts`:**
   - Mapa bidirecional em memória: `deviceSockets: Map<string, Set<string>>` e `socketToDevice: Map<string, string>`.
   - Usar `Set<string>` evita race conditions em reconexões rápidas (o dispositivo só vai para `offline` quando o último socket daquele `deviceId` fecha).
   - Mantém também em memória `batteryMap: Map<string, BatteryTelemetry>` e `appVersionMap: Map<string, { appVersionCode: number | null; appVersionName: string | null }>`.
4. **`fcmService.ts`:**
   - Inicialização lazy/opcional com `firebase-admin`.
   - Lê credenciais via `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON puro ou Base64) ou `FIREBASE_SERVICE_ACCOUNT_PATH`.
   - Se ausente, entra em **fallback gracioso** (`isConfigured() === false`) com log único no boot.
   - Quando configurado, envia mensagem **data-only** de alta prioridade (`android: { priority: "high", ttl: 60_000 }`) com todos os valores de `data` como string (`commandId`, `action`, `durationMs`, `timestamp`, `cardName`).
   - Retorna resultado estruturado `{ sent: boolean; invalidToken?: boolean; error?: string }`:
     - Se o Firebase retornar `messaging/registration-token-not-registered` ou `messaging/invalid-registration-token`, sinaliza `invalidToken: true` para limpeza automática do `pushToken` no banco.
5. **`commandService.ts`:**
   - Durações fixas: `locate = 5000 ms`, `vibrate = 3000 ms`. Timeout de ACK: `7000 ms`.
   - **Concorrência por Card (nossa decisão):** mantém `inFlightByCard: Map<string, string>` (`cardId -> commandId`). Se já houver um comando pendente na janela de 7s para o mesmo card, rejeita o segundo disparo com erro de conflito (HTTP `409 Conflict`, mensagem *"Já existe um comando em andamento para este dispositivo."*).
   - Fluxo de `dispatchCommand(cardId, action)`:
     1. Valida existência do card (`404`), existência de `pairedDeviceId` (`400`) e ausência de comando em andamento (`409`).
     2. Verifica canais: `hasOnlineSocket = presenceService.isOnline(deviceId)` e `canSendPush = Boolean(card.pushToken && fcmService.isConfigured())`.
     3. Se `!hasOnlineSocket && !canSendPush` → retorna imediatamente `status: "error"` (HTTP `503`, *"Dispositivo offline e sem push notification configurado."*), emitindo feedback no `/panel`.
     4. Gera `commandId = crypto.randomUUID()` e `timestamp = new Date().toISOString()`.
     5. Registra em `pendingCommands` com timer de `7000 ms`.
     6. **Entrega dupla simultânea:**
        - Se `hasOnlineSocket`: envia target emit (`alert:locate` ou `alert:vibrate`) exclusivamente para os sockets do `deviceId`.
        - Se `canSendPush`: chama `fcmService.sendCommand(...)` em paralelo.
          - Se `invalidToken === true`, executa `cardRepository.updatePushToken(cardId, null)` e notifica `/panel` via `device:status` atualizado (`hasPushToken: false`).
          - **Fail-fast offline (nossa decisão):** se o dispositivo estiver **offline** (`!hasOnlineSocket`) e o envio FCM falhar imediatamente, cancela o timer de 7s, limpa o pendente e resolve imediatamente com `status: "error"` (HTTP `503`) em vez de prender o operador por 7 segundos. Se o socket estiver **online**, o erro FCM é apenas logado e o servidor segue aguardando o ACK do WebSocket.
     7. Quando `handleAck(commandId, ackStatus, timestamp, socketDeviceId?)` chega:
        - Se o socket já estiver identificado (`socketDeviceId`), valida `socketDeviceId === pending.deviceId`.
        - Se o socket **ainda não** executou `device:identify` (caso de um celular acordado em background via FCM que abre conexão rápida só para enviar ACK), aceita o ACK validando o `commandId` UUID v4 pendente (token único de 122 bits com vida útil de 7s).
        - Cancela o timer, remove de `pendingCommands` e `inFlightByCard`, emite `locate:feedback` ou `vibrate:feedback` em broadcast para `/panel`, e resolve (`"success"` se `ackStatus === "ok"`, `"error"` caso contrário).
     8. Em timeout de 7s: limpa pendentes, emite feedback `status: "timeout"` para `/panel` e resolve com `"timeout"`. ACKs tardios são logados e descartados silenciosamente.

### 5.4 Contrato Exaustivo dos 18 Eventos Socket.IO (`src/server/phoneFinder/socketServer.ts`)

Configuração do `Server`: `cors: { origin: true, credentials: true }`, `pingTimeout: 120_000`, `pingInterval: 45_000`.

#### Namespace `/panel` (JWT obrigatório no handshake via `auth.token`, header `Authorization: Bearer` ou cookie `token`)

| Direção | Evento | Payload Exato | Comportamento |
|---|---|---|---|
| Painel → Srv | `pairing:generate` | `{ cardId: string }` | Gera código 6 dígitos (5 min) e responde ao socket solicitante com `pairing:generated` (ou callback de erro). |
| Painel → Srv | `device:unpair` | `{ cardId: string }` | Desvincula card, envia `device:unpaired` ao celular alvo (se online), limpa presença/bateria e faz broadcast de `device:status` para `/panel`. |
| Painel → Srv | `locate:trigger` | `{ cardId: string }` | Dispara `commandService.dispatchCommand(cardId, "locate")` (resultado propagado via `locate:feedback`). |
| Painel → Srv | `vibrate:trigger` | `{ cardId: string }` | Dispara `commandService.dispatchCommand(cardId, "vibrate")` (resultado propagado via `vibrate:feedback`). |
| Srv → Painel (target) | `pairing:generated` | `{ cardId: string, code: string, expiresAt: string }` | Retorna o código gerado ao operador solicitante. |
| Srv → Painel (broadcast) | `device:status` | `{ cardId: string, status: DevicePresenceStatus, deviceId?: string \| null, hasPushToken?: boolean, appVersionCode?: number \| null, appVersionName?: string \| null }` | Propaga mudanças de presença/pareamento/versão/push sem exigir re-fetch no frontend. |
| Srv → Painel (broadcast) | `card:battery` | `{ cardId: string, deviceId: string, level: number, isCharging: boolean, updatedAt: string }` | Propaga telemetria de bateria em tempo real. |
| Srv → Painel (broadcast) | `locate:feedback` | `CommandFeedbackPayload` | Propaga resultado do comando `locate` para todos os operadores conectados. |
| Srv → Painel (broadcast) | `vibrate:feedback` | `CommandFeedbackPayload` | Propaga resultado do comando `vibrate` para todos os operadores conectados. |

#### Namespace `/device` (conexões de dispositivos móveis; target emit exclusivo, nunca broadcast)

| Direção | Evento | Payload Exato | Comportamento |
|---|---|---|---|
| App → Srv | `pairing:submit` | `{ code: string, pushToken?: string }` | Valida código (com rate limit), cria `deviceId`, persiste no card, registra presença, responde `pairing:result` e faz broadcast `device:status` (`online`) em `/panel`. |
| App → Srv | `device:identify` | `{ deviceId: string, pushToken?: string, appVersionCode?: number, appVersionName?: string }` | Valida existência do `deviceId` no banco; se não existir, envia `device:unpaired` ao socket. Se existir, atualiza `pushToken` (se enviado), registra presença/versão, faz broadcast `device:status` (`online`) e reenvia `card:battery` em memória (se existir). |
| App → Srv | `device:battery` | `{ deviceId: string, level: number, isCharging?: boolean }` | Exige socket identificado com o mesmo `deviceId`; valida `0 <= level <= 100`, salva em memória e faz broadcast `card:battery` em `/panel`. |
| App → Srv | `alert:ack` | `{ commandId: string, status: "ok" \| "error", timestamp: number }` | Confirma execução de `locate` (aceito tanto de socket identificado quanto de socket recém-acordado via FCM via `commandId`). |
| App → Srv | `vibrate:ack` | `{ commandId: string, status: "ok" \| "error", timestamp: number }` | Confirma execução de `vibrate` (mesma regra de validação de `alert:ack`). |
| Srv → App (target) | `pairing:result` | `{ success: true, deviceId: string, cardId: string, cardName: string } \| { success: false, error: string }` | Resultado da submissão do código de pareamento. |
| Srv → App (target) | `alert:locate` | `{ commandId: string, action: "locate", durationMs: number, timestamp: string, cardName: string }` | Instrução de alerta sonoro + vibração + tela `#FF0000` (alinhado ao payload FCM para parser único no Android). |
| Srv → App (target) | `alert:vibrate` | `{ commandId: string, action: "vibrate", durationMs: number, timestamp: string, cardName: string }` | Instrução de vibração contínua (alinhado ao payload FCM). |
| Srv → App (target) | `device:unpaired` | `{ message: string }` | Notifica o dispositivo que foi desvinculado para limpar o `deviceId` local. |

*(Total exato: 9 eventos Cliente → Servidor + 9 eventos Servidor → Cliente = **18 eventos da SPEC**.)*

### 5.5 Rotas REST (`src/server/routes/cards.routes.ts` montada em `/api/cards`)

Todas protegidas por `authenticateToken`:

| Método | Rota | Status HTTP | Request / Response |
|---|---|---|---|
| `GET` | `/api/cards` | `200` | `CardWithStatus[]` (ordenado por `createdAt desc`, sem `pushToken`). |
| `GET` | `/api/cards/:id` | `200` / `404` | `CardWithStatus`. |
| `POST` | `/api/cards` | `201` / `400` | Body: `{ name: string, description?: string }` → `CardWithStatus`. |
| `PUT` | `/api/cards/:id` | `200` / `400` / `404` | Body: `{ name?: string, description?: string }` → `CardWithStatus`. |
| `DELETE` | `/api/cards/:id` | `200` / `404` | Desvincula se pareado (emite `device:unpaired`), remove card → `{ success: true }`. |
| `POST` | `/api/cards/:id/pairing-code` | `200` / `404` | `PairingCodeResponse` (`{ cardId, code, expiresAt }`). |
| `POST` | `/api/cards/:id/unpair` | `200` / `404` | Desvincula e notifica aparelho + `/panel` → `{ success: true }`. |
| `POST` | `/api/cards/:id/locate` | `200` (`success`) / `408` (`timeout`) / `502` (erro no device) / `503` (offline sem push / falha FCM) / `409` (já em andamento) / `400` (não pareado) / `404` | `CommandFeedbackPayload`. |
| `POST` | `/api/cards/:id/vibrate` | Mesmo mapeamento HTTP acima | `CommandFeedbackPayload`. |

### 5.6 Frontend SPA e Direção Visual (HubSupport)

- **Navegação:**
  - `src/components/Sidebar.tsx`: no grupo `OPERAÇÃO`, imediatamente abaixo de **Atendimentos** (`/dashboard/atendimentos`), item **Phone Finder** (`/dashboard/phone-finder`) com ícone `Smartphone` (`lucide-react`).
  - `src/App.tsx`: rota protegida `<Route path="/dashboard/phone-finder" element={<PhoneFinderPage />} />`.
- **Camada de Dados (`src/services/api.ts` + `src/hooks/usePhoneFinderSocket.ts`):**
  - `api.phoneFinder.*` para todos os 9 endpoints REST (tratando explicitamente os status `200`, `408`, `409`, `502`, `503` nas rotas `locate`/`vibrate` para retornar o `CommandFeedbackPayload` tipado sem falhar de forma genérica).
  - `usePhoneFinderSocket`: conecta em `${getSocketBaseUrl()}/panel` com `{ auth: { token: getToken() }, withCredentials: true }`, escuta `device:status`, `card:battery`, `locate:feedback`, `vibrate:feedback` e atualiza o estado em tempo real.
- **Interface (`src/pages/PhoneFinderPage.tsx` e `src/components/phoneFinder/`):**
  - Segue estritamente os tokens do HubSupport: `bg-white dark:bg-[#111726]`, `border-slate-200 dark:border-slate-800`, `rounded-2xl`, fundo `#f8f9fa` / `#090d16`, tipografia `slate`, suporte total light/dark.
  - **Cabeçalho + Resumo:** título "Phone Finder", indicador discreto de conexão em tempo real, chips de contagem (`Total`, `Online`, `Offline`, `Não pareados`), busca por nome/descrição, filtro por estado e botão **+ Novo Card**.
  - **Grid de Cards (`PhoneCardTile.tsx`):**
    - Cabeçalho do card: nome, descrição, badge de presença (`Online` esmeralda pulsante, `Offline` âmbar, `Não pareado` slate) e menu de ações (Editar, Parear / Trocar aparelho, Desvincular, Excluir).
    - Faixa de telemetria (quando pareado): ícone dinâmico de bateria + percentual + ícone de carregamento (quando disponível), versão do app e indicador discreto de Push/FCM ativo.
    - Rodapé de ações:
      - Não pareado: botão **Parear Dispositivo**.
      - Pareado (Online ou Offline): botões **Localizar** e **Vibrar** **sempre habilitados** (desabilitados apenas durante a janela de envio em andamento para evitar clique duplicado), exibindo spinner e feedback inline/toast (`success` / `timeout` / `error`).
  - **Modais:**
    - `PairingCodeModal.tsx`: exibe os 6 dígitos em fonte monoespaçada grande, botão copiar, contagem regressiva de 5:00, botão "Gerar novo código", e transição automática de sucesso assim que `device:status` confirmar `online`.
    - `PhoneCardFormModal.tsx`: criar/editar nome e descrição.
    - Confirmação antes de desvincular ou excluir um card.

---

## 6. Decisões Assumidas pelo Design (para sua verificação)

1. **Nome da aba:** `"Phone Finder"` na rota `/dashboard/phone-finder` (logo abaixo de **Atendimentos**).
2. **Durações fixas:** `5000 ms` (Localizar) e `3000 ms` (Vibrar), sem seletor de duração na UI.
3. **Concorrência de comandos:** bloqueio por card durante a janela ativa de 7s (`409 Conflict`) para evitar sobreposição de alarmes quando dois operadores clicam simultaneamente.
4. **Resiliência de ACK acordado via FCM:** `/device` exige `device:identify` para telemetria (`device:battery`), mas aceita `alert:ack` / `vibrate:ack` tanto de sockets identificados quanto de conexões rápidas acordadas via FCM usando o `commandId` (UUID v4 de 122 bits válido por 7s).
5. **Falha rápida em Push offline + limpeza de token inválido:** se o aparelho estiver offline e o FCM rejeitar imediatamente, o servidor retorna erro na hora (`503`) em vez de aguardar 7s; se o Firebase acusar token revogado/inválido, limpa `pushToken` automaticamente no banco.
6. **Proteção contra força bruta em `/device`:** rate limit em memória de 10 tentativas inválidas/minuto por IP/socket em `pairing:submit`.
7. **Substituição de aparelho / desvinculação offline:** parear um novo aparelho em um card já pareado notifica o antigo com `device:unpaired`; se um aparelho desvinculado enquanto offline tentar reconectar via `device:identify`, recebe `device:unpaired` para limpar seu `deviceId` local.

---

## 7. O Que Fica a Cargo do Implementador (Builder)

- Organização fina de subcomponentes internos, micro-animações Tailwind e textos exatos de tooltips/empty states (em português, no tom do HubSupport).
- Estrutura dos cenários detalhados no script simulador `scripts/simulate-phone-finder-device.ts` e na suíte automatizada `scripts/test-phone-finder.ts`.
- Detalhes de formatação de logs `[PhoneFinder]` no backend.
