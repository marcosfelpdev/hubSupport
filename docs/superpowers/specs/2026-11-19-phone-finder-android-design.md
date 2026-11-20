# Design Doc: Phone Finder — App Android Nativo (Fase 2)

**Data:** 19/11/2026  
**Status:** Aprovado pelo usuário em 20/11/2026  
**Escopo:** Projeto completo — Fase 2 de 2 (App Android nativo conectado ao backend HubSupport entregue na Fase 1)  
**Repositório Alvo:** `c:\Users\mfana\projetos\hubsupport-phone-finder-android` (repositório Git próprio, separado do monorepo web)  
**Referências:** Phone Finder SPEC v1.0 & `docs/superpowers/specs/2026-11-19-phone-finder-hubsupport-design.md`

---

## 1. Propósito e Contexto (Intent & Why)

O **HubSupport Phone Finder (Android)** é o cliente móvel nativo que roda nos celulares físicos de bancadas técnicas, estoques e testes. Ele mantém vínculo persistente com um **Card** cadastrado na aba *Phone Finder* do HubSupport (Fase 1) e reage fisicamente aos comandos disparados pelo painel web — atravessando inclusive o **Doze Mode** do Android graças à entrega dupla (Socket.IO em Foreground Service + FCM *data-only* de alta prioridade).

A interface segue a identidade visual do **HubSupport** (paleta `slate` / `#090d16` / `#111726`, tema claro/escuro, acentos esmeralda/âmbar/rose) usando **Kotlin + Jetpack Compose (Material 3)**, enquanto a tela de alerta (`AlertActivity`) é uma superfície nativa minimalista 100% vermelha (`#FF0000`) capaz de acender sobre a tela de bloqueio e sobre outros apps.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos (Goals)
- Criar projeto Android nativo moderno em `c:\Users\mfana\projetos\hubsupport-phone-finder-android` (`applicationId = "com.hubsupport.phonefinder"`, `minSdk = 26`, `targetSdk = 35`, `compileSdk = 35`), compatível com Android Studio 2026.2.1 / OpenJDK 25 / Gradle 9.x / AGP 9.x.
- Implementar 100% do contrato `/device` estabelecido na Fase 1:
  - Conexão Socket.IO em `${serverUrl}/device` (default `https://hubsupport-api.onrender.com`, editável na UI para testes locais).
  - Eventos emitidos: `pairing:submit`, `device:identify`, `device:battery`, `alert:ack`, `vibrate:ack`.
  - Eventos recebidos: `pairing:result`, `alert:locate`, `alert:vibrate`, `device:unpaired`.
- Manter conexão resiliente em segundo plano via **Foreground Service** (`PhoneFinderForegroundService`, `foregroundServiceType="remoteMessaging"`) com notificação discreta `IMPORTANCE_LOW`, reconexão exponencial e **auto-inicialização no boot** (`BootReceiver`).
- Receber e executar comandos em Doze Mode via **`FirebaseMessagingService`** (`PhoneFinderMessagingService`) com mensagens *data-only* de alta prioridade, atualizando `pushToken` via `onNewToken` e na reconexão (`device:identify`).
- Construir um **Motor de Alerta (`AlertExecutor`)** à prova de falhas para Android 8–15:
  - Cache thread-safe de deduplicação por `commandId` (LRU 100 entradas / TTL 10 min) para descartar entregas duplicadas (Socket.IO + FCM).
  - `WakeLock` (`PARTIAL_WAKE_LOCK`) com timeout automático de segurança (`durationMs + 2000ms`).
  - Som em volume máximo no `AudioManager.STREAM_ALARM` com **restauração automática do volume original** ao encerrar.
  - Vibração intensa contínua (`VibrationEffect` com `USAGE_ALARM`).
  - `AlertActivity` full-screen `#FF0000` sem botões/distrações sobre a tela de bloqueio (`showWhenLocked`, `turnScreenOn`, `keepScreenOn`), acionada via `FullScreenIntent` (`CATEGORY_ALARM`) quando bloqueado/background e via `startActivity` direto quando `SYSTEM_ALERT_WINDOW` ("Sobrepor outros apps") estiver concedida — garantindo tela vermelha mesmo quando o aparelho está desbloqueado em outro app.
  - Notificação silenciosa transitória (auto-cancelada após 3s) quando `vibrate` chega via FCM em Doze Mode — evitando que o Google Play Services rebaixe a prioridade das próximas mensagens FCM do app (o que quebraria o `locate` em Doze Mode).
  - Timer de parada inviolável (`5000ms` para `locate`, `3000ms` para `vibrate`) encerrando som, vibração, notificações temporárias, `AlertActivity` e `WakeLock`.
  - Envio rápido de ACK (`alert:ack` / `vibrate:ack`) assim que o alerta inicia — incluindo fallback de conexão efêmera em `/device` (`EphemeralAckSender`) sem chamar `startForegroundService()` a partir de background em Doze Mode (prevenindo `ForegroundServiceStartNotAllowedException` no Android 12–15).
- Enviar **telemetria de bateria** (`device:battery`) imediatamente após pareamento/identificação e a cada **10 minutos** enquanto conectado.
- Entregar UI limpa no design system do HubSupport com:
  - Tela de Pareamento (código numérico de 6 dígitos + configuração de URL do servidor).
  - Tela de Status Pareado (nome do Card, status Online/Reconectando/Offline, bateria, status do FCM, versão do app, botão "Testar alerta local", ação discreta "Alterar servidor" para recuperação caso um servidor de dev saia do ar, e **checklist guiado de 4 permissões críticas**: Notificações, Tela Cheia sobre bloqueio, Sobrepor outros apps e Isenção de Otimização de Bateria).
- Provisionar projeto **Firebase dedicado** (`hubsupport-phone-finder`, com fallback automático de sufixo se o ID global estiver em uso), baixar `app/google-services.json`, manter aplicação condicional do plugin `com.google.gms.google-services`, configurar regras ProGuard/R8 + `signingConfigs` opcional para `release`, e entregar `scripts/install-usb.ps1` (instalando o APK via `adb` e já concedendo automaticamente permissões críticas de bancada como `POST_NOTIFICATIONS` e `SYSTEM_ALERT_WINDOW`) + guia curto para `FIREBASE_SERVICE_ACCOUNT_JSON` no Render.

### Não-Objetivos (Non-Goals)
- Publicação na Google Play Store (distribuição interna via APK / `adb`).
- Login de usuário HubSupport dentro do app Android (o pareamento usa exclusivamente o código de 6 dígitos → `deviceId` UUID v4).
- Botão explícito de "Desvincular" iniciado pelo próprio celular no fluxo normal (SPEC Seção 3.5: desvinculação é disparada pelo operador no painel web; o celular apenas reage a `device:unpaired`).
- Suporte a Android < 8.0 (`minSdk = 26`).

### Anti-Objetivos (Anti-Goals)
- **Nunca** permitir que som, vibração ou tela vermelha fiquem travados após `durationMs`.
- **Nunca** vazar `WakeLock` nem deixar o volume de alarme do celular permanentemente no máximo após o alerta.
- **Nunca** usar `foregroundServiceType="dataSync"` (Android 15 impõe limite de 6 horas em `dataSync`, matando o serviço em celulares de bancada).
- **Nunca** chamar `startForegroundService()` diretamente de `FirebaseMessagingService.onMessageReceived` quando em background/Doze Mode (evita `ForegroundServiceStartNotAllowedException` no Android 12–15).
- **Nunca** commitar a *Service Account Key* do Firebase, `keystore.properties`, arquivos `.jks`/`.keystore` ou `app/google-services.json` em repositório Git (incluir todos no `.gitignore` + templates `.example`).
- **Nunca** misturar o código Android no repositório `hubSupport`.

---

## 3. Restrições e Ambiente Local (Constraints)

- **Ambiente verificado na máquina:**
  - Android Studio `2026.2.1` com OpenJDK `25.0.3` em `C:\Program Files\Android\Android Studio\jbr`.
  - Android SDK em `%LOCALAPPDATA%\Android\Sdk` com `platforms/android-35`, `platforms/android-37.0`, `build-tools/34.0.0`, `build-tools/36.0.0`, e `platform-tools/adb.exe`.
  - **Compatibilidade Gradle/AGP com JDK 25:** usar **Gradle 9.1+** e **AGP 9.0+** (Kotlin embutido no AGP 9 — sem aplicar o plugin legado `org.jetbrains.kotlin.android`, usando `org.jetbrains.kotlin.plugin.compose` para Compose).
- **Compatibilidade de protocolo com a Fase 1:**
  - Socket.IO client Java (`io.socket:socket.io-client:2.1.1`) compatível com Socket.IO Server v4 do HubSupport.
  - Namespace obrigatório: `/device` (ex.: `IO.socket("https://hubsupport-api.onrender.com/device", options)`).
  - Payload de `alert:locate` / `alert:vibrate` (via Socket.IO): `{ commandId: string, action: "locate" | "vibrate", durationMs: number, timestamp: string, cardName: string }`.
  - Payload de FCM (`RemoteMessage.data`): mesmas 5 chaves, todas como `String` (`durationMs` parseado com `toLongOrNull()`, fallback `5000L` para `locate` e `3000L` para `vibrate`).
  - Payload de `alert:ack` / `vibrate:ack`: `{ commandId: string, status: "ok" | "error", timestamp: Long }` (Unix epoch em ms).
- **Firebase CLI:** `npx -y firebase-tools@latest` (v15.37.0) disponível; requer login interativo único no navegador (`npx -y firebase-tools@latest login`) sob a conta Google do proprietário para provisionar o projeto ao vivo e baixar `app/google-services.json`.

---

## 4. Abordagens Consideradas (Approaches)

| Abordagem | Resumo | Trade-offs | Decisão |
|---|---|---|---|
| **A — Kotlin + Jetpack Compose (Material 3 HubSupport) + Motor Nativo** | UI declarativa em Compose com tema claro/escuro HubSupport + Foreground Service (`remoteMessaging`) + `FirebaseMessagingService` + `AlertActivity` full-screen `#FF0000`. | UI limpa, reativa e fácil de manter; compatível com Compose Preview; APK ~8–10 MB. | **Escolhida pelo usuário** |
| **B — Kotlin + Views XML Clássicas (`ViewBinding`)** | Mesma camada de background/alerta, mas UI em XML tradicional. | APK ~4–5 MB, porém UI mais verbosa e sem Compose Preview. | Não escolhida |
| **Híbrido (PWA / Flutter / React Native)** | Frameworks cross-platform ou web mobile. | Bloqueios do SO / bridges frágeis para `STREAM_ALARM`, `WakeLock`, `ForegroundService` e `showWhenLocked` em Android 14/15. | Descartada |

---

## 5. Arquitetura Detalhada do App Android

### 5.1 Estrutura de Pacotes (`com.hubsupport.phonefinder`)

```text
app/src/main/java/com/hubsupport/phonefinder/
├── PhoneFinderApp.kt                 # Application: cria canais de notificação e inicializa AppContainer
├── data/
│   ├── DeviceStorage.kt              # Interface IDeviceStorage + SharedPreferencesDeviceStorage (serverUrl, deviceId, cardId, cardName, pushToken)
│   ├── ProtocolModels.kt             # Data classes (IncomingCommand, CommandAction, ConnectionStatus, BatterySnapshot, PairingOutcome) + parser unificado WS/FCM
│   └── ServerUrlNormalizer.kt        # Valida e normaliza URL base (exige http/https, remove barras finais, monta URI do namespace /device)
├── core/
│   ├── CommandDeduplicator.kt        # Cache thread-safe LRU (100 IDs, janela 10 min) para deduplicação por commandId
│   ├── BatteryReader.kt              # Lê nível (0..100) e isCharging via ACTION_BATTERY_CHANGED sticky intent
│   ├── PermissionChecker.kt          # Verifica POST_NOTIFICATIONS (API 33+), canUseFullScreenIntent (API 34+), Settings.canDrawOverlays e isIgnoringBatteryOptimizations
│   └── AlertExecutor.kt              # Orquestra WakeLock, STREAM_ALARM (salva/restaura volume), Vibrator, AlertActivity/FullScreenIntent, notificação silenciosa FCM vibrate e timer inviolável
├── network/
│   ├── SocketManager.kt              # Gerencia io.socket.client.Socket em /device, reconexão exponencial, pairing:submit, device:identify, device:battery, ACKs, device:unpaired
│   └── EphemeralAckSender.kt         # Fallback rápido: quando acordado pelo FCM com SocketManager desconectado, abre socket /device curto (5s), envia alert:ack/vibrate:ack e fecha
├── service/
│   ├── PhoneFinderForegroundService.kt  # Foreground Service (remoteMessaging), notificação IMPORTANCE_LOW, mantém SocketManager + loop de bateria (10 min)
│   ├── PhoneFinderMessagingService.kt   # FirebaseMessagingService: onNewToken + onMessageReceived (data-only high-priority -> AlertExecutor + EphemeralAckSender, sem startForegroundService)
│   └── BootReceiver.kt                  # BroadcastReceiver (BOOT_COMPLETED / MY_PACKAGE_REPLACED): religa Foreground Service se deviceId estiver salvo
└── ui/
    ├── theme/
    │   └── HubSupportTheme.kt        # Tokens visuais do HubSupport (light: #f8f9fa / #ffffff / slate-900; dark: #090d16 / #111726 / slate-100; rose-600 / emerald-500 / amber-500)
    ├── MainActivity.kt               # Compose host: alterna entre PairingScreen e PairedDashboardScreen conforme StateFlow do AppContainer
    ├── PairingScreen.kt              # Input de 6 dígitos, feedback de erro/loading, dialog "Configurar servidor"
    ├── PairedDashboardScreen.kt      # Nome do Card, badge Online/Reconectando/Offline, bateria, FCM status, checklist de 4 permissões, "Testar alerta local" e ação discreta "Alterar servidor"
    └── AlertActivity.kt              # Full-screen #FF0000 imersivo sobre tela de bloqueio; fecha automaticamente via Broadcast/Flow de encerramento
```

### 5.2 Motor de Alerta, Timing de ACK e Resiliência Android 10–15 (`AlertExecutor`)

1. **Entrada unificada (`AlertExecutor.execute(command, source = WS | FCM)`):**
   - Passo 1: `CommandDeduplicator.tryMarkProcessed(command.commandId)` — se retornar `false` (duplicata), retorna imediatamente sem tocar som nem reenviar ACK.
   - Passo 2: Valida `durationMs` (`500L..30_000L`, fallback `5000L` para `locate`, `3000L` para `vibrate`).
   - Passo 3: Se já houver alerta em execução, encerra o anterior limpo (restaurando volume) antes de iniciar o novo.
   - Passo 4: Adquire `PowerManager.PARTIAL_WAKE_LOCK` com timeout de segurança `durationMs + 2000L`.
   - Passo 5:
     - **`locate`**:
       - Salva `previousAlarmVolume = audioManager.getStreamVolume(STREAM_ALARM)` e sobe para `getStreamMaxVolume(STREAM_ALARM)` (com `try/catch` caso política DND restrita bloqueie).
       - Inicia `MediaPlayer` com `AudioAttributes.USAGE_ALARM` em loop usando `RingtoneManager.getDefaultUri(TYPE_ALARM)` (fallback `TYPE_RINGTONE`).
       - Inicia vibração contínua (`VibrationEffect.createWaveform(longArrayOf(0, 600, 150), 0)` com `USAGE_ALARM`).
       - Dispara `AlertActivity` full-screen `#FF0000`:
         - Sempre posta notificação `CATEGORY_ALARM` + `setFullScreenIntent(pendingIntent, true)` no canal `phone_finder_alerts` (`IMPORTANCE_HIGH`, som nulo pois o som vem do `STREAM_ALARM`) — acende sobre a tela de bloqueio mesmo em Doze Mode.
         - Também executa `context.startActivity(intent)` quando em foreground ou quando `Settings.canDrawOverlays(context) == true` (`SYSTEM_ALERT_WINDOW`) — garantindo takeover `#FF0000` mesmo quando o celular está desbloqueado em outro app!
     - **`vibrate`**:
       - Inicia vibração intensa contínua (`VibrationEffect.createWaveform(longArrayOf(0, 500, 120), 0)`).
       - Se `source == FCM`: posta notificação silenciosa transitória (`"Vibrando para localização..."` no canal `phone_finder_silent_vibrate`, `IMPORTANCE_LOW`, sem som/vibração própria) cancelada automaticamente após `durationMs` — evita que o Google Play Services rebaixe a prioridade de futuros pushes FCM high-priority!
   - Passo 6 (**Timing de ACK**): assim que o alerta inicia com sucesso, envia imediatamente `alert:ack` ou `vibrate:ack` (`status = "ok"`, `timestamp = System.currentTimeMillis()`):
     - Se `SocketManager.isConnected()` → envia pelo socket ativo (< 50ms).
     - Senão (acordado via FCM em Doze Mode) → usa `EphemeralAckSender` (abre conexão curta em `/device` com timeout 5s, emite o ACK, aguarda flush e fecha) **sem** chamar `startForegroundService()` em background.
     - Se ocorrer exceção crítica impedindo a execução → envia ACK com `status = "error"`.
   - Passo 7 (**Parada automática inviolável**): timer agendado para exatamente `durationMs` ms executa `stopAlert(runId)`:
     - Para e libera `MediaPlayer`.
     - Restaura `previousAlarmVolume` no `STREAM_ALARM`.
     - Cancela `Vibrator`.
     - Cancela notificações temporárias (`locate` full-screen / `vibrate` silenciosa).
     - Envia sinal para `AlertActivity.finishAndRemoveTask()`.
     - Libera `WakeLock` se `isHeld` (cada etapa isolada em seu próprio `try/catch`).

### 5.3 Protocolo de Rede, Reconexão e Recuperação (`SocketManager`)

- **Opções Socket.IO:** `transports = ["websocket", "polling"]`, `reconnection = true`, `reconnectionDelay = 1000L`, `reconnectionDelayMax = 30_000L`, `timeout = 20_000L`.
- **Pareamento:** `PairingScreen` obtém `pushToken` via `FcmTokenProvider` (timeout 3s / fallback `null`), conecta em `${serverUrl}/device` e emite `pairing:submit` (`{ code, pushToken? }`). Em `pairing:result.success == true`, salva `deviceId`, `cardId`, `cardName` e `pushToken`, inicia `PhoneFinderForegroundService`, envia `device:battery` e abre `PairedDashboardScreen`.
- **Reconexão (`Socket.EVENT_CONNECT`):** se `deviceId != null`, emite `device:identify` (`{ deviceId, pushToken?, appVersionCode = BuildConfig.VERSION_CODE, appVersionName = BuildConfig.VERSION_NAME }`) + `device:battery` inicial.
- **Desvinculação (`device:unpaired`):** limpa `deviceId`, `cardId`, `cardName` do `DeviceStorage`, encerra `PhoneFinderForegroundService`, desconecta socket e retorna para `PairingScreen` exibindo `payload.message`.
- **Recuperação de servidor em `PairedDashboardScreen`:** ação discreta "Alterar servidor" no topo da tela; se o usuário confirmar a troca de URL, encerra o serviço/socket, limpa o `deviceId` local, grava a nova URL e volta para `PairingScreen` (impedindo que um aparelho pareado a um IP de dev que saiu do ar fique travado para sempre).
- **Atualização de token (`onNewToken`):** salva novo token no `DeviceStorage` e chama `SocketManager.refreshIdentity(token)` se já pareado.

### 5.4 Permissões Android, Assinatura de APK e Distribuição na Bancada

- **Permissões declaradas (`AndroidManifest.xml`):**
  - `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `WAKE_LOCK`
  - `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_REMOTE_MESSAGING`
  - `POST_NOTIFICATIONS` (runtime Android 13+)
  - `USE_FULL_SCREEN_INTENT` (verificada no Android 14+ com atalho para `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`)
  - `SYSTEM_ALERT_WINDOW` (verificada com atalho para `ACTION_MANAGE_OVERLAY_PERMISSION` — garante tela vermelha `#FF0000` mesmo quando o celular está desbloqueado em outro app)
  - `RECEIVE_BOOT_COMPLETED` (para `BootReceiver`)
  - `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (atalho opcional no checklist)
- **Assinatura & R8 (`app/build.gradle.kts` + `app/proguard-rules.pro`):**
  - `debug`: pronto para compilação rápida local (`assembleDebug`).
  - `release`: lê `keystore.properties` (gitignored, com template `keystore.properties.example`) ou variáveis de ambiente (`KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`); se ausentes, faz fallback para assinatura debug local. Inclui `proguard-rules.pro` com keep rules explícitas para `io.socket.*`, `okhttp3.*`, `org.json.*` e Firebase Messaging.
- **Script de Bancada (`scripts/install-usb.ps1`):**
  - Aceita `-Variant debug|release` (default `debug` se não houver `keystore.properties`, ou `release` se configurado).
  - Compila o APK com `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` e `ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"`.
  - Detecta todos os aparelhos conectados via `adb devices`, instala o APK (`adb install -r`) e já aplica opcionalmente as permissões de bancada via `adb shell pm grant` / `appops set` (`POST_NOTIFICATIONS`, `SYSTEM_ALERT_WINDOW`) para agilizar o setup de múltiplos celulares!

### 5.5 Provisionamento Firebase e Build Condicional

- Em `app/build.gradle.kts`: aplica `com.google.gms.google-services` somente quando `file("google-services.json").exists()`.
- Em `FcmTokenProvider.kt`: verifica `FirebaseApp.getApps(context).isNotEmpty()` antes de chamar `FirebaseMessaging.getInstance()`, degradando graciosamente (retornando `null`) se o arquivo não existir.
- **Fronteira de provisionamento ao vivo:** o plano de implementação incluirá uma task dedicada para criar o projeto Firebase (`hubsupport-phone-finder`, com fallback de sufixo único se necessário), registrar `com.hubsupport.phonefinder` e baixar `app/google-services.json` via `npx -y firebase-tools@latest` (com pausa rápida para você concluir `firebase login` no navegador na sua conta Google) — e também um script/guia reutilizável (`scripts/setup-firebase.ps1` + `README.md`) com os passos exatos para baixar a *Service Account Key* e colá-la em `FIREBASE_SERVICE_ACCOUNT_JSON` no Render.

---

## 6. Decisões Assumidas pelo Design (para sua validação)

1. **Local do repositório e pacote:** `c:\Users\mfana\projetos\hubsupport-phone-finder-android` (`com.hubsupport.phonefinder`, `minSdk = 26`, `targetSdk = 35`).
2. **Tipo do Foreground Service:** `remoteMessaging` (evita o corte de 6 horas que o Android 15 aplica a `dataSync`).
3. **Takeover `#FF0000` mesmo com tela desbloqueada (`SYSTEM_ALERT_WINDOW`):** incluído no checklist de permissões (e concedido automaticamente no `scripts/install-usb.ps1` via `adb appops`) para que a tela vermelha abra sobre qualquer app; sem ela, degrada graciosamente para `FullScreenIntent` + alarme no máximo + vibração.
4. **Notificação silenciosa transitória no `vibrate` via FCM (3s):** evita que o Google Play Services rebaixe futuras mensagens FCM high-priority em Doze Mode; sem `startForegroundService()` a partir de `onMessageReceived` (previne crash no Android 12–15).
5. **Timing de envio do ACK:** disparado imediatamente ao iniciar o alerta (dentro da janela de 7s do servidor mesmo acordado via FCM em Doze Mode).
6. **Restauração automática de volume + Auto-start no boot (`BootReceiver`):** restaura o volume original do alarme após os 5s e religa o Foreground Service automaticamente ao reiniciar o aparelho.
7. **Recuperação de URL na tela pareada:** opção discreta "Alterar servidor" (com confirmação) para evitar que um celular pareado a um servidor local de teste fique travado sem receber `device:unpaired`, mantendo a ausência de botão normal de desvinculação.
8. **Assinatura de APK + R8:** `debug` pronto de imediato e `release` assinado via `keystore.properties` (gitignored) com regras ProGuard para Socket.IO/OkHttp/Firebase para atualizações limpas em frota de bancada sem perder pareamento.

---

## 7. O Que Fica a Cargo do Implementador (Builder)

- Organização fina de `gradle/libs.versions.toml`, `settings.gradle.kts` e wrapper Gradle 9.x compatível com OpenJDK 25.
- Ícone adaptativo do launcher alinhado às cores do HubSupport (`slate-900` + acento esmeralda/rose).
- Micro-animações Compose, textos exatos dos banners de permissão em português e formatação de logs `Log.d("PhoneFinder", ...)`.
- Estrutura detalhada dos testes unitários JVM (`./gradlew testDebugUnitTest`).
