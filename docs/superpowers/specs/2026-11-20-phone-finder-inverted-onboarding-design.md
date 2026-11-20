# Phone Finder — Auto-Cadastro Invertido por Aparelho & Alerta Sonoro Puro

**Data:** 2026-11-20  
**Status:** Aprovado para Planejamento  
**Autores:** Equipe HubSupport  

---

## 1. Contexto e Motivação

Atualmente, o cadastro e pareamento de um aparelho de bancada no **HubSupport Phone Finder** exige um fluxo fragmentado entre duas interfaces:
1. O operador abre o painel web no computador, clica em "+ Novo Card" e digita o título do card.
2. O operador clica no botão "Parear" do card no computador para gerar um código numérico de 6 dígitos temporário.
3. O operador vai até o celular físico na bancada, abre o app e digita o código de 6 dígitos para concluir o vínculo.

Quando a bancada possui dezenas de celulares (muitos operando com até 4 contas de WhatsApp em perfis simultâneos como Dual Messenger ou contas de usuário), esse processo gera atrito desnecessário e lentidão. Na prática, o operador já tem os 4 últimos dígitos de cada linha visíveis na carcaça ou nas configurações do aparelho enquanto segura o celular.

Adicionalmente, a tela vermelha em tela cheia (`AlertActivity`) foi avaliada na prática operacional e se mostrou desnecessária e falha (versões recentes do Android restringem a abertura de Activities em tela cheia a partir de serviços em segundo plano). O objetivo principal do Phone Finder na bancada é a **localização sonora e tátil imediata** (volume 100% contínuo e vibração máxima), tornando a tela vermelha dispensável.

---

## 2. Objetivos e Anti-Objetivos

### Objetivos
- **Auto-Cadastro Invertido no Android:** Permitir que o operador cadastre o aparelho diretamente pela tela do aplicativo móvel, informando até 4 finais de números de WhatsApp (de 1 a 4 campos de 4 dígitos).
- **Padronização de Título:** O título do card no painel web deve ser formatado automaticamente unindo os números preenchidos com pipe e espaços (ex: `"8299 | 1234 | 0845 | 7421"` ou `"8299 | 1234"`).
- **Vínculo Instantâneo:** Ao submeter os números no app, o backend cria (ou atualiza) o card no PostgreSQL, associa o `deviceId` e emite o evento para o painel web em tempo real. O card aparece na tela do computador imediatamente sem recarregar a página.
- **Edição em Duas Vias (Celular Primário + Web Plano B):**
  - *No Celular (Fluxo Primário):* A tela pareada do app (`PairedDashboardScreen`) ganha uma opção "Editar Números" que abre os campos pré-preenchidos, permitindo alterar os números a qualquer momento sem precisar desvincular.
  - *Na Web (Plano B):* O painel web mantém a edição de títulos de cards já existente (`PUT /api/cards/:id`), refletindo alterações no banco e na interface.
- **Substituição Inteligente de Aparelho:** Se um novo aparelho for cadastrado com números idênticos a um card existente (ex: aparelho quebrado substituído por um novo na bancada), o sistema assume a titularidade para o novo `deviceId` e atualiza o card sem gerar duplicidade órfã.
- **Remoção da Tela Vermelha (`AlertActivity`):** O alarme móvel passa a ser executado 100% em segundo plano pelo `AlertExecutor`: áudio contínuo em `STREAM_ALARM` no volume máximo, padrão de vibração em repetição e notificação Heads-Up na barra de status com botão de ação para "Silenciar".
- **Busca Global por Qualquer Dígito:** O campo de busca da página Phone Finder na web permite localizar o celular digitando qualquer um dos números do card (ex: pesquisar `"1234"` localiza `"8299 | 1234 | 0845 | 7421"`).
- **Fallback de Compatibilidade:** O app mantém um botão secundário discreto para permitir o pareamento clássico por código de 6 dígitos caso necessário.

### Anti-Objetivos
- Não tentar ler o WhatsApp automaticamente sem consentimento ou via root (bloqueado pelo SO Android).
- Não expor endpoints REST desprotegidos: a comunicação de auto-cadastro móvel é restrita ao protocolo Socket.IO no namespace `/device`.
- Não alterar as regras de telemetria de bateria orientada a eventos (`BatteryTelemetryPolicy`) ou o cache de presença em memória implementados no PR #28.
- Não exigir login de usuário do HubSupport no celular da bancada.

---

## 3. Abordagens Consideradas

### Abordagem 1: Auto-Cadastro Direto pelo Aplicativo Móvel (Escolhida)
- **Descrição:** O app Android substitui a tela inicial de 6 dígitos por um formulário de cadastro com até 4 campos de 4 dígitos e um botão "Cadastrar Aparelho". Ao tocar no botão, o app emite o evento `device:self-register` para o backend via Socket.IO `/device`. O servidor valida, formata o título, persiste no banco, registra no `PresenceService` e notifica o painel web via WebSocket.
- **Trade-offs:** Elimina 100% da necessidade de usar o computador durante a preparação dos aparelhos na bancada. Exige validação de formato e sanitização de dados no backend.

### Abordagem 2: Pareamento por Fila / Reivindicação (Descartada)
- **Descrição:** Cards são criados previamente na web e o celular busca a lista de cards livres no servidor para reivindicar um deles.
- **Trade-offs:** Reintroduz a necessidade de acessar o computador antes de configurar o celular na bancada.

---

## 4. Arquitetura Detalhada

### 4.1. Mobile Android (`hubsupport-phone-finder-android`)

1. **Ciclo de Vida do `deviceId` (`DeviceStorage.kt`):**
   - Cria um `appInstallationId` (UUID v4) persistente na primeira execução que **nunca** é apagado pelo `clearPairing()`. Esse identificador atua como a identidade imutável do hardware/instalação.
   - `storage.deviceId` passa a retornar esse `appInstallationId`.

2. **Tela de Auto-Cadastro (`SelfRegisterScreen.kt`):**
   - Exibida quando `storage.isPaired == false`.
   - Layout Jetpack Compose com o tema do HubSupport:
     - Título: *"HubSupport Phone Finder"*.
     - Subtítulo: *"Informe os últimos 4 dígitos dos números deste aparelho:"*.
     - 4 caixas de texto numéricas (`KeyboardType.Number`, max 4 dígitos cada) com avanço automático de foco e suporte a colar ou limpar.
     - Botão principal: *"Cadastrar Aparelho"*, habilitado quando ao menos 1 bloco de 4 dígitos for preenchido.
     - Botão secundário: *"Parear com código de 6 dígitos"*, alternando para a tela clássica de código caso necessário.

3. **Edição de Números na Tela Pareada (`PairedDashboardScreen.kt`):**
   - Adicionado botão/ícone de edição: *"Editar Números"*.
   - Ao clicar, exibe um `AlertDialog` ou tela deslizante com os 4 campos preenchidos com os números atuais (extraídos de `storage.cardName`).
   - Ao salvar, emite novamente `device:self-register` pelo socket já conectado, atualizando o nome no painel web instantaneamente sem derrubar o serviço de presença.

4. **Comunicação de Socket (`SocketManager.kt`):**
   - Método: `sendSelfRegister(numbers: List<String>)`.
   - Payload emitido no evento `device:self-register`:
     ```json
     {
       "deviceId": "uuid-v4-persistente",
       "numbers": ["8299", "1234", "0845", "7421"],
       "pushToken": "fcm_token_ou_null",
       "appVersionCode": 1,
       "appVersionName": "1.0.0"
     }
     ```
   - Trata a resposta `pairing:result`:
     - Se `success: true`: grava `cardId` e `cardName` no storage criptografado, define `isPaired = true`, inicializa o Foreground Service de presença e transiciona para a tela de monitoramento pareado.
     - Se `success: false`: exibe feedback de erro ao operador.

5. **Remoção da `AlertActivity` e Ajuste no `AlertExecutor.kt`:**
   - Exclui o arquivo `app/src/main/java/com/hubsupport/phonefinder/ui/AlertActivity.kt`.
   - Remove a declaração de `<activity android:name=".ui.AlertActivity" ... />` do `AndroidManifest.xml` e do ProGuard.
   - No `AlertExecutor.kt`:
     - Remove qualquer chamada a `startActivity(alertIntent)`.
     - Mantém intactos o loop de áudio em `STREAM_ALARM` no volume 100%, restauração do volume original ao encerrar, padrão contínuo de vibração e `WakeLock`.
     - Exibe a notificação de alta prioridade (`NotificationCompat.PRIORITY_MAX`) com som e botão de ação *"Silenciar Alarme"*, permitindo interromper o som diretamente pela barra de notificações ou abrindo o app.

---

### 4.2. Backend HubSupport (`src/server/phoneFinder/`)

1. **Novo Evento no Namespace `/device` (`socketServer.ts`):**
   - Evento: `device:self-register`.
   - Payload recebido:
     ```typescript
     interface DeviceSelfRegisterPayload {
       deviceId: string;
       numbers: string[];
       pushToken?: string | null;
       appVersionCode?: number | null;
       appVersionName?: string | null;
     }
     ```

2. **Lógica de Formatação e Idempotência:**
   - **Validação:** Filtra os números válidos (strings de 4 dígitos numéricos, ignorando campos vazios, máximo 4 itens). Se nenhum for válido, retorna erro `Nenhum número de 4 dígitos informado.`.
   - **Formatação do Título:** Junta os blocos válidos usando `" | "` (ex: `8299 | 1234 | 0845 | 7421`).
   - **Idempotência e Resolução de Conflitos:**
     1. Busca se já existe um card vinculado àquele `deviceId` (`cardRepository.findByDeviceId(deviceId)`).
     2. Se não encontrar por `deviceId`, busca se já existe um card com o mesmo nome exato formatado (`cardRepository.findByName(formattedTitle)`).
     3. Se encontrar card existente: atualiza o título, associa o novo `deviceId` (se transferido), atualiza o `pushToken` e emite `card:updated` para o `/panel`.
     4. Se não encontrar: cria um novo card no banco via `cardRepository.create({ name: formattedTitle, deviceId, pushToken })` e emite `card:created` para o `/panel`.
   - **Presença e Sincronização:**
     - Registra o socket no `PresenceService` associando `deviceId` ao `card.id`.
     - Emite `pairing:result` com sucesso de volta para o socket do dispositivo com `{ success: true, deviceId, cardId: card.id, cardName: card.name }`.
     - Emite `device:status` com `online` para o `/panel`.

3. **Plano B — Edição via Painel Web:**
   - O endpoint REST `PUT /api/cards/:id` existente continua suportado e emite `card:updated` para o `/panel` e notifica o socket `/device` associado se conectado.

---

### 4.3. Frontend Web (`src/pages/PhoneFinderPage.tsx`)

1. **Atualização em Tempo Real:**
   - Garante tratamento dos eventos `card:created` e `card:updated` via WebSocket `/panel`.
   - Quando o novo card é criado via auto-cadastro pelo celular, ele aparece automaticamente na grade de cards sem recarregar a página.
2. **Busca Tolerante:**
   - O campo de busca existente filtra por `card.name.toLowerCase().includes(search.toLowerCase())`.
   - Como o título contém os números separados por pipe (`8299 | 1234 | 0845 | 7421`), pesquisar qualquer um dos finais (ex: `1234` ou `0845`) localiza o card instantaneamente.

---

## 5. Decisões do Builder Check Incorporadas

1. **Sem Rota REST Pública:** Toda a comunicação do auto-cadastro ocorre no namespace `/device` do Socket.IO, mantendo a superfície de segurança da API fechada e eliminando riscos de DoS em endpoints REST não autenticados.
2. **UUID Persistente de Instalação:** O `deviceId` no Android é gerado na instalação e protegido contra limpeza acidental, tornando a reconexão idempotente.
3. **Edição em Duas Vias:** Implementada opção de edição no próprio app móvel (fluxo primário) e mantida a edição na web (plano B).
4. **Resolução de Conflito de Números:** Se um celular físico for trocado na bancada e os mesmos números forem submetidos, o novo aparelho herda o card existente, evitando lixo no banco de dados.

---

## 6. Plano de Validação e Testes

1. **Testes Unitários no Backend:**
   - Formatação e sanitização de títulos com 1, 2, 3 e 4 números (`test-self-register-formatting.ts`).
   - Idempotência: criação de novo card, atualização pelo mesmo `deviceId`, e migração de `deviceId` ao submeter números idênticos.
   - Emissão correta de `card:created`, `card:updated` e `device:status` para o `/panel`.
2. **Testes Unitários no Android:**
   - Validação da entrada de 4 dígitos na UI Compose.
   - `DeviceStorageTest`: persistência do `appInstallationId` mesmo após `clearPairing()`.
   - `AlertExecutorTest`: execução sonoro-vibratória e cancelamento sem dependência de `AlertActivity`.
3. **Build e Entrega:**
   - Validação no frontend: `npx vite build` (zero erros TypeScript).
   - Validação no backend: testes passando.
   - Validação no Android: `./gradlew testDebugUnitTest assembleRelease`.
   - Upload do novo APK (`hubsupport-phone-finder.apk`) para o bucket Cloudflare R2 e commit nos dois repositórios.
