# Phone Finder — App Android Nativo (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir do zero o aplicativo Android nativo **HubSupport Phone Finder** em `c:\Users\mfana\projetos\hubsupport-phone-finder-android` (`com.hubsupport.phonefinder`), conectado ao namespace `/device` do HubSupport (Fase 1), com Foreground Service resiliente, FCM data-only high-priority (Doze Mode), motor de alerta nativo (`STREAM_ALARM` + vibração + tela cheia `#FF0000` sobre bloqueio), UI Jetpack Compose no design system HubSupport e scripts de provisionamento Firebase + instalação USB em bancada.

**Architecture:** Repositório Android independente em Kotlin + Jetpack Compose (AGP 9.x / Gradle 9.x compatível com OpenJDK 25 do Android Studio instalado), organizado em camadas desacopladas (`data/`, `core/`, `network/`, `service/`, `ui/`) ligadas por um `AppContainer` leve na `Application`. Toda lógica crítica de protocolo, parsing, normalização de URL, deduplicação e ciclo de vida de alerta é testável em JVM (`./gradlew testDebugUnitTest`), enquanto a camada Android nativa orquestra Foreground Service (`remoteMessaging`), `FirebaseMessagingService`, `AlertActivity` e `EphemeralAckSender`.

**Tech Stack:** Kotlin (built-in AGP 9.x), Gradle 9.x, Jetpack Compose (Material 3), `io.socket:socket.io-client:2.1.1`, Firebase Messaging BOM (`firebase-messaging`), AndroidX Core/Lifecycle/Activity Compose, JUnit 4 + Coroutines Test.

**Spec:** `c:\Users\mfana\projetos\hubSupport\docs\superpowers\specs\2026-11-19-phone-finder-android-design.md`

---

## Global Constraints

- Repositório alvo separado: `c:\Users\mfana\projetos\hubsupport-phone-finder-android` (nunca misturar arquivos Android no repo `hubSupport`).
- `applicationId = "com.hubsupport.phonefinder"`, `minSdk = 26`, `targetSdk = 35`, `compileSdk = 35`.
- Build executado com `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` (OpenJDK 25.0.3) e `ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"` → exige **Gradle 9.1+** e **AGP 9.0+** (Kotlin embutido no AGP 9; não aplicar plugin legado `org.jetbrains.kotlin.android`).
- `foregroundServiceType="remoteMessaging"` (nunca `dataSync`, que sofre corte de 6h no Android 15).
- Nunca chamar `startForegroundService()` diretamente de `FirebaseMessagingService.onMessageReceived` quando em background/Doze Mode (usar `EphemeralAckSender`).
- Contrato exato do namespace `/device` (Fase 1):
  - URL padrão: `https://hubsupport-api.onrender.com`, namespace `/device`.
  - Emite: `pairing:submit`, `device:identify`, `device:battery`, `alert:ack`, `vibrate:ack`.
  - Recebe: `pairing:result`, `alert:locate`, `alert:vibrate`, `device:unpaired`.
  - Durações padrão: `locate = 5000L ms`, `vibrate = 3000L ms`; clamp seguro `500L..30_000L`.
  - ACK enviado imediatamente ao iniciar o alerta (`timestamp: Long` Unix epoch em ms).
- Encerramento automático inviolável de som, vibração, notificações temporárias, `AlertActivity` e `WakeLock` após `durationMs`, sempre restaurando o volume original do `STREAM_ALARM`.
- Build condicional de Firebase: aplicar `com.google.gms.google-services` somente se `app/google-services.json` existir, e verificar `FirebaseApp.getApps(context).isNotEmpty()` em runtime.
- Nunca commitar `app/google-services.json`, `keystore.properties`, `*.jks`/`*.keystore`, `local.properties` ou *Service Account Keys*.

## Review Focus

- **Entrega dupla simultânea (WS + FCM com mesmo `commandId`) e evicção LRU:** `CommandDeduplicator` deve executar apenas a primeira ocorrência, descartar duplicatas de qualquer thread/canal, expirar após 10 min e limitar a 100 entradas (testado na Task 2).
- **Payloads FCM malformados ou `durationMs` fora de faixa:** parser deve aplicar fallback (`5000L`/`3000L`) em string não numérica/ausente, aplicar clamp `500L..30_000L` e rejeitar `commandId` vazio ou `action` desconhecida sem crash (testado na Task 2).
- **URLs de servidor inválidas ou com `/device` duplicado:** `ServerUrlNormalizer` deve limpar espaços/barras finais, remover `/device` acidental, rejeitar esquemas fora de `http`/`https` e montar `${origin}/device` corretamente (testado na Task 2).
- **Sobreposição de alertas e exceção DND ao ajustar volume:** `AlertExecutor` usa `runId` monotônico (timer antigo nunca cancela alerta mais novo), isola `setStreamVolume` em `try/catch` e sempre restaura volume/libera `WakeLock` ao encerrar (testado na Task 4).
- **Build resiliente sem `google-services.json` e sem `keystore.properties` (incluindo R8 em release):** `./gradlew testDebugUnitTest`, `./gradlew assembleDebug` e `./gradlew assembleRelease` passam com sucesso mesmo antes do provisionamento interativo do Firebase (testado nas Tasks 1 e 6).

---

### Task 1: Repositório Android, Scaffold Gradle 9 / AGP 9 + Compose, Manifest & Assinatura/R8

**Files (em `c:\Users\mfana\projetos\hubsupport-phone-finder-android\`):**
- Create: `.gitignore`, `settings.gradle.kts`, `gradle.properties`, `build.gradle.kts`, `gradle/libs.versions.toml`, `gradle/wrapper/gradle-wrapper.properties`, `gradlew`, `gradlew.bat`, `local.properties` (gitignored)
- Create: `app/build.gradle.kts`, `app/proguard-rules.pro`, `app/google-services.json.example`, `keystore.properties.example`
- Create: `app/src/main/AndroidManifest.xml`, `app/src/main/res/values/strings.xml`, `app/src/main/res/values/themes.xml`, `app/src/main/res/drawable/*`, `app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- Create: `app/src/main/java/com/hubsupport/phonefinder/ui/MainActivity.kt` (shell mínimo compilável substituído na Task 5)

**Interfaces:**
- Consumes: SDK local (`%LOCALAPPDATA%\Android\Sdk`), JDK 25 (`C:\Program Files\Android\Android Studio\jbr`)
- Produces: Projeto Gradle 9.x / AGP 9.x compilável com Compose + Socket.IO + Firebase Messaging + build condicional `google-services.json` + signing config opcional + `proguard-rules.pro`

- [x] **Step 1: Inicializar repositório Git e configurar `.gitignore` + `local.properties`**

Criar `c:\Users\mfana\projetos\hubsupport-phone-finder-android`, executar `git init`, gravar `.gitignore` (cobrindo `.gradle/`, `build/`, `local.properties`, `app/google-services.json`, `keystore.properties`, `*.jks`, `*.keystore`, `*service-account*.json`, `.idea/`) e gravar `local.properties` com `sdk.dir=C\:\\Users\\mfana\\AppData\\Local\\Android\\Sdk`.

- [x] **Step 2: Configurar Gradle 9.x Wrapper, Version Catalog (`gradle/libs.versions.toml`) e build scripts AGP 9.x**

Usar Gradle `9.2.1` (ou última 9.x compatível com JDK 25) + AGP `9.0.0` (ou versão 9.x estável disponível no Google Maven) + Kotlin Compose Compiler Plugin (`org.jetbrains.kotlin.plugin.compose`), Compose BOM, Material 3, Material Icons Extended, `io.socket:socket.io-client:2.1.1` (excluindo `org.json:json` conflitante com o Android SDK!), Firebase BOM + `firebase-messaging`, Coroutines Android, JUnit 4 + Coroutines Test.
Em `app/build.gradle.kts`:
- `applicationId = "com.hubsupport.phonefinder"`, `minSdk = 26`, `targetSdk = 35`, `compileSdk = 35`, `versionCode = 1`, `versionName = "1.0.0"`.
- `buildFeatures { compose = true; buildConfig = true }`.
- `signingConfigs`: lê `keystore.properties` (ou env vars `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) para `release`, com fallback limpo para `signingConfigs.getByName("debug")` se ausente.
- `buildTypes.release`: `isMinifyEnabled = true`, `isShrinkResources = true`, `proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")`.
- Plugin condicional no final de `app/build.gradle.kts`: `if (file("google-services.json").exists()) { apply(plugin = "com.google.gms.google-services") }`.

- [x] **Step 3: Criar `app/proguard-rules.pro`, `AndroidManifest.xml`, templates `.example` e recursos visuais (ícone HubSupport + tema)**

- `proguard-rules.pro`: manter classes/métodos de `io.socket.**`, `okhttp3.**`, `okio.**`, `com.google.firebase.messaging.**` e `com.hubsupport.phonefinder.service.**`.
- `AndroidManifest.xml`: declarar todas as permissões da Seção 5.4 da spec (`INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_REMOTE_MESSAGING`, `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT`, `SYSTEM_ALERT_WINDOW`, `RECEIVE_BOOT_COMPLETED`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), `usesCleartextTraffic="true"` (necessário para testar contra IP local HTTP `http://192.168.x.x:4000` em dev!), e registrar `MainActivity` (com o restante dos componentes adicionados na Task 4).

- [x] **Step 4: Compilar debug e verificar o ambiente Gradle + JDK 25**

Run (com `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` e `ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"`):
`.\gradlew.bat assembleDebug`
Expected: `BUILD SUCCESSFUL` e APK gerado em `app/build/outputs/apk/debug/app-debug.apk`.

- [x] **Step 5: Commit inicial no repositório Android**

```bash
git add -A
git commit -m "chore: inicializar projeto Android Gradle 9 / AGP 9 + Compose e configuracoes base"
```

---

### Task 2: Camada de Dados, Parsers de Protocolo (`/device`) e Deduplicação (TDD em JVM)

**Files (em `c:\Users\mfana\projetos\hubsupport-phone-finder-android\`):**
- Create: `app/src/main/java/com/hubsupport/phonefinder/data/DeviceStorage.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/data/ServerUrlNormalizer.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/data/ProtocolModels.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/CommandDeduplicator.kt`
- Test: `app/src/test/java/com/hubsupport/phonefinder/core/CommandDeduplicatorTest.kt`
- Test: `app/src/test/java/com/hubsupport/phonefinder/data/ProtocolModelsTest.kt`
- Test: `app/src/test/java/com/hubsupport/phonefinder/data/ServerUrlNormalizerTest.kt`

**Interfaces:**
- Produces:
  - `IDeviceStorage` (`serverUrl`, `deviceId`, `cardId`, `cardName`, `pushToken`, `savePairing(...)`, `clearPairing()`, `isPaired`) + `SharedPreferencesDeviceStorage`
  - `ServerUrlNormalizer.normalizeBaseUrl(raw: String): Result<String>`, `buildDeviceNamespaceUri(baseUrl: String): String`
  - `CommandAction` (`LOCATE`, `VIBRATE`), `CommandSource` (`SOCKET`, `FCM`, `LOCAL_TEST`), `IncomingCommand`, `ConnectionStatus` (`DISCONNECTED`, `CONNECTING`, `CONNECTED`), `BatterySnapshot`, `PairingResult`, `ProtocolParser.parseSocketCommand(...)`, `ProtocolParser.parseFcmCommand(...)`, `ProtocolParser.isValidPairingCode(code: String): Boolean`
  - `CommandDeduplicator(maxEntries = 100, ttlMs = 600_000L, clock = System::currentTimeMillis)` com `tryMarkProcessed(commandId: String): Boolean`

- [x] **Step 1: Escrever os 3 arquivos de testes unitários JVM cobrindo Review Focus #1, #2 e #3**

Assertions obrigatórias:
- `CommandDeduplicatorTest`: primeira chamada `true`, repetida `false`, ID em branco `false`, expiração após 10 min permite novo registro, inserção de 105 IDs evicta os mais antigos mantendo capacidade 100, chamadas concorrentes de múltiplas threads só retornam `true` exatamente 1 vez.
- `ProtocolModelsTest`: parse de payload WS (`JSONObject`) e FCM (`Map<String, String>`), fallback `5000L` (`locate`) / `3000L` (`vibrate`) quando `durationMs` ausente ou inválido, clamp para `500L..30_000L`, rejeição (`null`) quando `commandId` vazio ou `action` desconhecida, `isValidPairingCode` aceita apenas exatamente 6 dígitos numéricos.
- `ServerUrlNormalizerTest`: remove espaços e barras finais, remove sufixo `/device` acidental, rejeita vazio/`javascript:`/`ftp:`/URL sem host, preserva porta em `http://192.168.0.10:4000`, e `buildDeviceNamespaceUri` retorna `https://hubsupport-api.onrender.com/device`.

- [x] **Step 2: Implementar `DeviceStorage.kt`, `ServerUrlNormalizer.kt`, `ProtocolModels.kt` e `CommandDeduplicator.kt`**

Implementar código puro Kotlin (sem acoplamento ao framework Android em `ServerUrlNormalizer`, `ProtocolModels` e `CommandDeduplicator` para máxima velocidade nos testes JVM).

- [x] **Step 3: Executar testes unitários JVM**

Run: `.\gradlew.bat testDebugUnitTest`
Expected: `BUILD SUCCESSFUL` com todos os testes passando (0 falhas).

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: camada de dados, normalizador de URL, parsers de protocolo e deduplicador de comandos"
```

---

### Task 3: Camada de Rede (`/device` Socket.IO), Leitor de Bateria, Token FCM e `EphemeralAckSender`

**Files (em `c:\Users\mfana\projetos\hubsupport-phone-finder-android\`):**
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/BatteryReader.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/FcmTokenProvider.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/network/SocketPayloads.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/network/SocketManager.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/network/EphemeralAckSender.kt`
- Test: `app/src/test/java/com/hubsupport/phonefinder/network/SocketPayloadsTest.kt`

**Interfaces:**
- Consumes: `IDeviceStorage`, `ServerUrlNormalizer`, `ProtocolModels`, `ProtocolParser` (Task 2)
- Produces:
  - `BatteryReader.read(): BatterySnapshot?`
  - `FcmTokenProvider.fetchTokenOrNull(timeoutMs = 3000L): String?`, `isFirebaseAvailable(): Boolean`
  - `SocketPayloads` (construtores puros de `JSONObject` para `pairing:submit`, `device:identify`, `device:battery`, `alert:ack`, `vibrate:ack` e parser de `pairing:result` / `device:unpaired`)
  - `SocketManager` (`connectionStatus: StateFlow<ConnectionStatus>`, `lastBattery: StateFlow<BatterySnapshot?>`, `unpairedNotice: StateFlow<String?>`, `submitPairingCode(code): PairingResult`, `connectIfPaired()`, `disconnect()`, `sendBattery()`, `sendAck(action, commandId, ok): Boolean`, `refreshIdentity(newPushToken)`, `changeServerUrlAndReset(newUrl)`)
  - `EphemeralAckSender.sendAck(serverUrl, action, commandId, ok, timeoutMs = 5000L): Boolean`

- [x] **Step 1: Escrever `SocketPayloadsTest.kt` garantindo alinhamento 1:1 com `socketServer.ts` da Fase 1**

Assertions:
- `buildPairingSubmit("482917", "tok")` contém `code` e `pushToken`; omite `pushToken` quando `null`.
- `buildDeviceIdentify(deviceId, pushToken, 1, "1.0.0")` contém `deviceId`, `appVersionCode`, `appVersionName` e opcional `pushToken`.
- `buildDeviceBattery(deviceId, 82, true)` contém `deviceId`, `level` (`0..100`), `isCharging`.
- `buildAck(commandId, ok = true, timestamp = 1700000000000L)` produz `status = "ok"` e `timestamp` numérico `Long` (e `status = "error"` quando `ok = false`).
- `parsePairingResult` trata `success: true` (`deviceId`, `cardId`, `cardName`) e `success: false` (`error`).

- [x] **Step 2: Implementar `BatteryReader.kt`, `FcmTokenProvider.kt`, `SocketPayloads.kt`, `SocketManager.kt` e `EphemeralAckSender.kt`**

- `FcmTokenProvider`: checa `FirebaseApp.getApps(context).isNotEmpty()` antes de chamar `FirebaseMessaging.getInstance().token` (degrada graciosamente retornando `null` sem crash se `google-services.json` não foi adicionado).
- `SocketManager`: conecta em `ServerUrlNormalizer.buildDeviceNamespaceUri(storage.serverUrl)` com `transports = ["websocket", "polling"]`, `reconnection = true`, `reconnectionDelay = 1000L`, `reconnectionDelayMax = 30_000L`. Em `EVENT_CONNECT` quando pareado, emite `device:identify` + `device:battery`. Escuta `alert:locate`, `alert:vibrate` (repassando ao callback de execução) e `device:unpaired` (limpa `storage.clearPairing()`, dispara callback de parada do Foreground Service e publica `unpairedNotice`).
- `EphemeralAckSender`: cria socket descartável em `${baseUrl}/device` com `reconnection = false`, emite `alert:ack` ou `vibrate:ack` no `EVENT_CONNECT`, aguarda breve flush (~300ms) e encerra socket dentro de timeout máximo de 5s.

- [x] **Step 3: Executar testes unitários JVM**

Run: `.\gradlew.bat testDebugUnitTest`
Expected: `BUILD SUCCESSFUL` com 0 falhas.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: camada Socket.IO /device, leitor de bateria, FCM token provider e EphemeralAckSender"
```

---

### Task 4: Motor de Alerta (`AlertExecutor`), `AlertActivity`, Foreground Service, FCM Service e `BootReceiver`

**Files (em `c:\Users\mfana\projetos\hubsupport-phone-finder-android\`):**
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/NotificationChannels.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/AlertExecutor.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/ui/AlertActivity.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/service/PhoneFinderForegroundService.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/service/PhoneFinderMessagingService.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/service/BootReceiver.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/PhoneFinderApp.kt`
- Modify: `app/src/main/AndroidManifest.xml` (registrar `PhoneFinderApp`, `AlertActivity`, `PhoneFinderForegroundService`, `PhoneFinderMessagingService`, `BootReceiver`)
- Test: `app/src/test/java/com/hubsupport/phonefinder/core/AlertCoordinatorTest.kt`

**Interfaces:**
- Consumes: `CommandDeduplicator`, `SocketManager`, `EphemeralAckSender`, `IDeviceStorage`, `FcmTokenProvider`, `BatteryReader` (Tasks 2–3)
- Produces:
  - `AlertExecutor.execute(command: IncomingCommand, source: CommandSource)` e `executeLocalTest()`
  - `PhoneFinderForegroundService.start(context)` / `stop(context)`
  - `PhoneFinderApp.container: AppContainer` (expondo `storage`, `socketManager`, `alertExecutor`, `fcmTokenProvider`, `batteryReader`, `startServiceIfPaired()`, `stopService()`)

- [x] **Step 1: Escrever `AlertCoordinatorTest.kt` cobrindo Review Focus #4**

Extrair a lógica de coordenação/ciclo de vida (`AlertRunCoordinator` com abstração `AlertHardwareDriver` e `AckCallback`) para testar puramente em JVM:
1. Duplicata de `commandId` não aciona hardware nem envia ACK duplicado.
2. Dois alertas em sequência (com `runId` monotônico): o timer do 1º alerta cancelado **não** encerra o 2º alerta; o 2º alerta encerra corretamente ao fim de sua duração.
3. Falha (`SecurityException`) ao elevar volume DND não impede tocar som/vibração/tela e ainda envia ACK `"ok"`, restaurando recursos no encerramento.
4. Exceção fatal no início do alerta envia ACK `"error"` e libera `WakeLock`/recursos.
5. `vibrate` vindo de `CommandSource.FCM` solicita notificação silenciosa transitória (e cancela após `durationMs`), enquanto `vibrate` via `SOCKET` não exibe notificação extra.

- [x] **Step 2: Implementar `NotificationChannels.kt`, `AlertActivity.kt`, `AlertExecutor.kt`, `PhoneFinderForegroundService.kt`, `PhoneFinderMessagingService.kt`, `BootReceiver.kt`, `PhoneFinderApp.kt` e atualizar `AndroidManifest.xml`**

Detalhes críticos:
- `AlertActivity`: tema full-screen sem barra de título, fundo `#FF0000`, `setShowWhenLocked(true)`, `setTurnScreenOn(true)`, `FLAG_KEEP_SCREEN_ON`, modo imersivo edge-to-edge, escuta `AlertExecutor.alertActiveFlow` (ou `stopSignal`) fechando com `finishAndRemoveTask()` assim que o timer encerrar.
- `PhoneFinderForegroundService`: `foregroundServiceType="remoteMessaging"`, notificação discreta `IMPORTANCE_LOW` mostrando nome do Card vinculado e status, inicia `socketManager.connectIfPaired()`, agenda coroutine de telemetria de bateria a cada `10 * 60 * 1000L` ms.
- `PhoneFinderMessagingService`: em `onNewToken` salva token e chama `socketManager.refreshIdentity(token)`; em `onMessageReceived` parseia `ProtocolParser.parseFcmCommand(message.data)` e chama `alertExecutor.execute(cmd, CommandSource.FCM)` (**nunca** chama `startForegroundService()` em background!).
- `BootReceiver`: em `ACTION_BOOT_COMPLETED` ou `ACTION_MY_PACKAGE_REPLACED`, se `storage.isPaired`, inicia `PhoneFinderForegroundService.start(context)` com `try/catch` seguro.

- [x] **Step 3: Executar testes JVM e compilar APK debug**

Run: `.\gradlew.bat testDebugUnitTest assembleDebug`
Expected: `BUILD SUCCESSFUL`, todos os testes JVM passam e APK debug compila.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: motor de alerta, AlertActivity full-screen, Foreground Service, FCM e BootReceiver"
```

---

### Task 5: Interface Jetpack Compose (Design System HubSupport) e Checklist de Permissões

**Files (em `c:\Users\mfana\projetos\hubsupport-phone-finder-android\`):**
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/PermissionChecker.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/ui/theme/HubSupportTheme.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/ui/PairingScreen.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/ui/MainActivity.kt`

**Interfaces:**
- Consumes: `PhoneFinderApp.container` (`storage`, `socketManager`, `alertExecutor`, `fcmTokenProvider`, `batteryReader`, `startServiceIfPaired`, `stopService`), `ServerUrlNormalizer`, `ProtocolParser`
- Produces: Experiência completa de pareamento, monitoramento de status, permissões críticas e teste local no visual do HubSupport

- [x] **Step 1: Implementar `PermissionChecker.kt` e `HubSupportTheme.kt`**

- `PermissionChecker.checkAll(context): PermissionSnapshot` retornando 4 flags + intents de ação direta:
  1. `notificationsGranted` (`POST_NOTIFICATIONS` no Android 13+, `true` abaixo).
  2. `fullScreenIntentGranted` (`NotificationManager.canUseFullScreenIntent()` no Android 14+, `true` abaixo; intent `Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`).
  3. `overlayGranted` (`Settings.canDrawOverlays(context)`; intent `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`).
  4. `batteryOptimizationIgnored` (`PowerManager.isIgnoringBatteryOptimizations(packageName)`; intent `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`).
- `HubSupportTheme`: paleta claro (`#f8f9fa` fundo, `#ffffff` superfície, `#e2e8f0` borda, `#0f172a` texto) e escuro (`#090d16` fundo, `#111726` superfície, `#1e293b` borda, `#f1f5f9` texto) + acentos semânticos HubSupport (`emerald #10b981`, `amber #f59e0b`, `rose #e11d48`).

- [x] **Step 2: Implementar `PairingScreen.kt`, `PairedDashboardScreen.kt` e `MainActivity.kt`**

- `PairingScreen`: logo/cabeçalho HubSupport Phone Finder, campo numérico grande para código de 6 dígitos (aceita somente dígitos até 6 caracteres), botão primário **Vincular Dispositivo** com spinner, banner de erro inline ou aviso de desvinculação (`unpairedNotice`), e botão discreto **Configurar servidor** abrindo dialog com validação via `ServerUrlNormalizer` e botão "Restaurar padrão (`hubsupport-api.onrender.com`)".
- `PairedDashboardScreen`: cabeçalho com nome do Card + ícone discreto **Alterar servidor** (abre confirmação clara antes de resetar vínculo local e trocar URL), card de status em tempo real (`Online` esmeralda pulsante / `Reconectando` âmbar / `Offline` rose), card de telemetria (bateria % + carregando, status do Push FCM `Ativo` vs `Não configurado`, versão do app), card de **Permissões Críticas** exibindo os 4 itens com check verde ou botão "Ativar" abrindo o fluxo exato do Android, e botão **Testar alerta local** (executa `locate` de 2s ou 5s localmente sem enviar ACK à rede).
- `MainActivity`: re-checa permissões no `ON_RESUME`, inicia `PhoneFinderForegroundService` automaticamente se já pareado, usa `ActivityResultContracts.RequestPermission` para `POST_NOTIFICATIONS`.

- [x] **Step 3: Executar testes JVM e compilar APK debug**

Run: `.\gradlew.bat testDebugUnitTest assembleDebug`
Expected: `BUILD SUCCESSFUL` com 0 erros de compilação ou testes.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: interface Jetpack Compose no design system HubSupport e checklist de permissoes"
```

---

### Task 6: Scripts de Provisionamento Firebase, Instalação USB em Bancada, Documentação e Build Final (Debug + Release/R8)

**Files (em `c:\Users\mfana\projetos\hubsupport-phone-finder-android\`):**
- Create: `scripts/setup-firebase.ps1`
- Create: `scripts/install-usb.ps1`
- Create: `instalar-celulares.bat`
- Create: `README.md`

**Interfaces:**
- Produces: Automação de setup do projeto Firebase dedicado (`hubsupport-phone-finder`), script de instalação em lote via USB/ADB com concessão de permissões de bancada, e APKs `debug` e `release` (R8) validados.

- [x] **Step 1: Criar `scripts/setup-firebase.ps1`**

Script PowerShell usando `npx -y firebase-tools@latest` (nunca `firebase` nu!):
1. Verifica login (`npx -y firebase-tools@latest login:list`); se não autenticado, chama `npx -y firebase-tools@latest login`.
2. Cria o projeto Firebase dedicado `hubsupport-phone-finder` (ou aceita `-ProjectId` customizado caso o ID global já esteja em uso).
3. Registra o app Android `com.hubsupport.phonefinder` (`apps:create ANDROID`).
4. Baixa automaticamente `app/google-services.json` via `apps:sdkconfig ANDROID <APP_ID> --project <PROJECT_ID>`.
5. Imprime o link direto do console do Firebase (`Configurações do projeto → Contas de serviço → Gerar nova chave privada`) explicando como colar o JSON na variável `FIREBASE_SERVICE_ACCOUNT_JSON` do serviço `hubsupport-api` no Render.

- [x] **Step 2: Criar `scripts/install-usb.ps1`, `instalar-celulares.bat` e `README.md`**

- `install-usb.ps1`: define `JAVA_HOME` (Android Studio JBR) e `ANDROID_HOME` (SDK local), aceita `-Variant debug|release` e `-SkipBuild`, compila o APK via `.\gradlew.bat`, lista todos os aparelhos em `adb devices`, executa `adb -s <serial> install -r <apk>` e concede automaticamente `POST_NOTIFICATIONS` + `appops set SYSTEM_ALERT_WINDOW allow` + `dumpsys deviceidle whitelist +com.hubsupport.phonefinder`.
- `instalar-celulares.bat`: atalho 1-clique no Windows chamando `powershell -ExecutionPolicy Bypass -File scripts\install-usb.ps1`.
- `README.md`: documentação completa em português (arquitetura, protocolo `/device`, setup Firebase + Render, geração de keystore de release e instalação USB).

- [x] **Step 3: Verificação completa (Testes JVM + APK Debug + APK Release com R8/ProGuard)**

Run (em `c:\Users\mfana\projetos\hubsupport-phone-finder-android`):
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat testDebugUnitTest assembleDebug assembleRelease
```
Expected: `BUILD SUCCESSFUL` com todos os testes JVM verdes, `app-debug.apk` e `app-release.apk` (minificado com R8) gerados sem erros.

- [x] **Step 4: Commit final no repositório Android**

```bash
git add -A
git commit -m "chore: adicionar scripts de setup Firebase, instalacao USB ADB e documentacao"
```
