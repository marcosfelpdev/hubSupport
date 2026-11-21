# Design — Atualização In-App em 1 Toque e Limpeza de Permissões (Relix Mobile)

**Data:** 2026-11-21  
**Escopo:** Backend Node.js/Express (`hubSupport`), Script de Publicação Cloudflare R2 e Aplicativo Android (`Relix Mobile` / `hubsupport-phone-finder-android`)

---

## 1. Intenção e Motivação

Atualmente o **Relix Mobile** envia sua versão instalada (`appVersionCode` e `appVersionName`) ao servidor para exibição no painel web, mas o próprio celular não sabe quando uma nova versão foi publicada no servidor. Além disso, o manifesto Android ainda mantém permissões sensíveis de sobreposição/tela cheia (`SYSTEM_ALERT_WINDOW` e `USE_FULL_SCREEN_INTENT`) herdadas da antiga tela vermelha (já abandonada), o que aumenta o atrito com o Google Play Protect em instalações diretas via APK.

Este projeto adiciona:
1. Publicação automática de metadados de versão (`version.json`) junto com o APK no Cloudflare R2 e endpoint público de consulta no backend.
2. Detecção automática de versão desatualizada no app Android com **botão de atualização in-app em 1 toque** (download com progresso + abertura direta do instalador nativo do Android), **sem disparar notificações na barra do Android**.
3. Remoção segura das permissões não usadas (`SYSTEM_ALERT_WINDOW` e `USE_FULL_SCREEN_INTENT`) preservando **100% intacto** o toque sonoro mesmo com o celular no silencioso.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
- Publicar automaticamente `phone-finder/version.json` no Cloudflare R2 (ou disco local em fallback) sempre que o APK for publicado via `scripts/publish-phone-finder-apk.ts`.
- Expor `GET /api/phone-finder/version` no Express retornando `versionCode`, `versionName`, `apkSizeBytes`, `sha256`, `publishedAt` e `apkPath`.
- No Android, consultar `/api/phone-finder/version` ao abrir/retomar o app e ao conectar o socket, exibindo um botão **"Atualizar para vX.X.X"** somente quando `remote.versionCode > BuildConfig.VERSION_CODE`.
- Ao tocar no botão, baixar o APK diretamente dentro do app (com barra de progresso e validação SHA-256), solicitar permissão de "Instalar apps desconhecidos" apenas se ainda não concedida, e abrir imediatamente o instalador nativo do Android via `FileProvider`.
- Remover `SYSTEM_ALERT_WINDOW` e `USE_FULL_SCREEN_INTENT` do app e simplificar o checklist de permissões de 4 para as 2 permissões realmente essenciais (**Notificações** e **Isenção de Otimização de Bateria**).

### Não-Objetivos
- Não implementar atualização silenciosa sem toque (impossível sem root ou MDM/Device Owner).
- Não publicar na Google Play Store nem alterar pacote (`com.hubsupport.phonefinder`) ou variáveis de infraestrutura (`R2_BUCKET_NAME`, `DEFAULT_PROD_API`).
- Não disparar notificação na barra de status do Android quando houver atualização disponível (explicitamente vetado pelo usuário).
- Não alterar a rota existente `GET /api/phone-finder/apk` nem quebrar o download via QR Code no painel web.

### Anti-Objetivos (O que seria considerado falha)
- **Qualquer regressão no toque do alarme em modo silencioso ou com tela bloqueada.** O áudio de alarme (`STREAM_ALARM` + `USAGE_ALARM`), vibração (`USAGE_ALARM`), `WAKE_LOCK`, `ForegroundService` e notificação Heads-Up com botão *"Silenciar Alarme"* devem permanecer 100% funcionais.
- Exibir botão de atualização quando o app já está na mesma versão (ou versão superior) ou quando o servidor está inacessível.
- Deixar o usuário preso em tela de erro se cancelar o diálogo de permissão "Instalar apps desconhecidos" ou cancelar o instalador do Android.

---

## 3. Restrições Técnicas e Garantias

1. **Garantia do Toque no Silencioso (`AlertExecutor.kt`):**
   - Verificado no código atual: o alarme no modo silencioso usa `MediaPlayer` + `AudioAttributes.USAGE_ALARM` + `AudioManager.STREAM_ALARM` (com maximização e restauração de volume), `WAKE_LOCK`, `VIBRATE` (`VibrationAttributes.USAGE_ALARM`), `FOREGROUND_SERVICE_REMOTE_MESSAGING`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` e `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
   - Nenhuma parte desse motor depende de `SYSTEM_ALERT_WINDOW` ou `USE_FULL_SCREEN_INTENT`. Apenas removemos a chamada `.setFullScreenIntent(contentPendingIntent, true)` da notificação Heads-Up em `AlertExecutor.kt`, mantendo `CATEGORY_ALARM`, `PRIORITY_MAX`, `VISIBILITY_PUBLIC` e a ação `"Silenciar Alarme"`.
2. **Assinatura Fixa de Release e Preservação de Dados:**
   - Provisionar uma keystore fixa dedicada de release (`relix-release.jks`, PKCS12/RSA 2048, validade 10.000 dias, `CN=Relix Mobile, O=Relix`) e configurar `keystore.properties` na raiz de `hubsupport-phone-finder-android` (ambos já protegidos no `.gitignore` para nunca irem ao Git).
   - Validar o APK final com `apksigner verify --print-certs` garantindo que o certificado **não** seja `CN=Android Debug`.
   - O celular de testes atualmente na `v1.1.1` (assinado em Debug) fará uma desinstalação única antes de instalar a `v1.2.0`; a partir da `v1.2.0`, todas as atualizações futuras usarão a mesma chave fixa de release, atualizando por cima sem perder `SharedPreferences` (números, `deviceId`, `serverUrl`) e reiniciando o serviço automaticamente via `MY_PACKAGE_REPLACED` no `BootReceiver`.
3. **Sem Novas Dependências Pesadas:**
   - O download HTTP e a consulta de versão no Android usam `java.net.HttpURLConnection` + `org.json.JSONObject` + `java.security.MessageDigest` (SDK padrão), mantendo o APK enxuto (~1.8 MB).

---

## 4. Abordagens Consideradas e Decisão

### Abordagem 1 — Instalador In-App em 1 Toque via `FileProvider` + `REQUEST_INSTALL_PACKAGES` *(Escolhida)*
- **Como funciona:** App baixa o APK em `cacheDir/updates/` com barra de progresso integrada, valida integridade SHA-256 e abre diretamente o instalador nativo do Android (`Intent.ACTION_VIEW`).
- **Trade-offs:** Melhor usabilidade (1 toque em "Atualizar", sem sair do app); requer declarar `REQUEST_INSTALL_PACKAGES` no manifesto (autorizado uma única vez por aparelho).

### Abordagem 2 — Botão In-App abrindo `/api/phone-finder/apk` no navegador externo
- **Como funciona:** Botão dispara `Intent.ACTION_VIEW` com a URL HTTP do APK para o Chrome/navegador do aparelho.
- **Trade-offs:** Manifesto 100% sem `REQUEST_INSTALL_PACKAGES`, porém exige ~3 toques (confirmar download no Chrome → abrir arquivo baixado → confirmar atualização).

**Decisão:** O usuário selecionou explicitamente a **Abordagem 1**, priorizando a simplicidade operacional do fluxo em 1 toque no celular, combinada com a limpeza das permissões não usadas (`SYSTEM_ALERT_WINDOW` e `USE_FULL_SCREEN_INTENT`).

---

## 5. Arquitetura Detalhada

### 5.1. Metadados de Versão e Publicação (`hubSupport`)

- **Chave no R2 / Storage local:** `phone-finder/version.json` (ao lado de `phone-finder/hubsupport-phone-finder.apk`).
- **Formato do JSON:**
  ```json
  {
    "versionCode": 5,
    "versionName": "1.2.0",
    "apkSizeBytes": 1920000,
    "sha256": "<hex-lowercase-64-chars>",
    "publishedAt": "2026-11-21T15:30:00.000Z"
  }
  ```
- **Script `scripts/publish-phone-finder-apk.ts`:**
  - Lê automaticamente `versionCode` e `versionName` de `../hubsupport-phone-finder-android/app/build.gradle.kts` (com suporte opcional a flags `--version-code` e `--version-name` caso o APK esteja em outro caminho).
  - Calcula `apkSizeBytes` e `sha256` do arquivo `.apk` em disco.
  - Faz upload primeiro do APK (`phone-finder/hubsupport-phone-finder.apk`) e em seguida de `phone-finder/version.json` via `uploadBuffer(..., "application/json")` — garantindo que `version.json` nunca aponte para uma versão cujo APK ainda não terminou de subir.

### 5.2. Endpoint REST no Backend (`src/server/`)

- **Serviço dedicado `src/server/phoneFinder/apkVersionService.ts`:**
  - Função `getLatestApkVersion(options?: { bypassCache?: boolean }): Promise<ApkVersionMetadata | null>`.
  - Lê `phone-finder/version.json` via `getFileBuffer` (`r2Storage.ts`), valida campos obrigatórios (`versionCode` inteiro positivo, `versionName` string não vazia).
  - Cache em memória de **60 segundos** (para evitar chamadas repetidas ao R2 quando vários celulares retomam juntos), com invalidação via `?fresh=1` ou expiração natural.
- **Rota pública em `src/server/app.ts`:**
  - `GET /api/phone-finder/version` (sem autenticação JWT, mesmo nível de acesso público de `GET /api/phone-finder/apk`).
  - Header `Cache-Control: no-cache, no-store, must-revalidate`.
  - Resposta `200`:
    ```json
    {
      "versionCode": 5,
      "versionName": "1.2.0",
      "apkSizeBytes": 1920000,
      "sha256": "...",
      "publishedAt": "...",
      "apkPath": "/api/phone-finder/apk"
    }
    ```
  - Resposta `404` se `version.json` ainda não existir no storage: `{ "error": "Metadados de versão ainda não publicados." }`.

### 5.3. Limpeza de Permissões no Android (`hubsupport-phone-finder-android`)

- **`AndroidManifest.xml`:**
  - **Remover:** `USE_FULL_SCREEN_INTENT` e `SYSTEM_ALERT_WINDOW`.
  - **Adicionar:** `REQUEST_INSTALL_PACKAGES` + `<provider>` `androidx.core.content.FileProvider` com `android:authorities="${applicationId}.fileprovider"`, `android:exported="false"`, `android:grantUriPermissions="true"` apontando para `@xml/file_paths`.
  - **Criar `res/xml/file_paths.xml`:** `<cache-path name="apk_updates" path="updates/" />`.
- **`AlertExecutor.kt`:**
  - Remover `.setFullScreenIntent(contentPendingIntent, true)` da notificação de alerta. Manter intactos todo o áudio (`STREAM_ALARM` / `USAGE_ALARM`), vibração, `WAKE_LOCK` e notificação Heads-Up com botão `"Silenciar Alarme"`.
- **`PermissionChecker.kt` e `PairedDashboardScreen.kt`:**
  - Reduzir `PermissionSnapshot` para 2 campos críticos: `notificationsGranted` e `batteryOptimizationIgnored` (`TOTAL_CRITICAL_COUNT = 2`).
  - Remover `buildFullScreenIntentSettingsIntent` e `buildOverlaySettingsIntent` (e callbacks correspondentes em `MainActivity.kt` e `PairedDashboardScreen.kt`).
  - Atualizar `PermissionSnapshotTest.kt` para refletir o contrato de 2 permissões.

### 5.4. Motor de Atualização In-App no Android

- **Novas classes em `com.hubsupport.phonefinder.core`:**
  1. `AppUpdateModels.kt`:
     - `RemoteAppVersion(versionCode: Int, versionName: String, apkSizeBytes: Long?, sha256: String?, apkPath: String)`
     - `sealed class AppUpdateState`:
       - `Idle`
       - `UpdateAvailable(remote: RemoteAppVersion)`
       - `WaitingInstallPermission(remote: RemoteAppVersion)`
       - `Downloading(remote: RemoteAppVersion, progressPercent: Int?)`
       - `Installing(remote: RemoteAppVersion)`
       - `Error(remote: RemoteAppVersion, message: String)`
  2. `AppUpdateChecker.kt` (lógica pura e 100% testável em JVM):
     - Faz `GET ${normalizedServerUrl}/api/phone-finder/version` com timeout curto (connect 5s / read 8s).
     - Faz parse do JSON e compara `remote.versionCode > currentVersionCode`.
     - Retorna `RemoteAppVersion` se houver atualização mais nova, ou `null` caso já esteja atualizado ou em caso de falha silenciosa (rede indisponível não deve poluir a tela com erro durante checagem em segundo plano).
  3. `ApkUpdateManager.kt`:
     - Gerencia o `StateFlow<AppUpdateState>` e throttle de checagem automática (mínimo 30s entre checagens automáticas no `onResume`).
     - `checkForUpdate(serverUrl: String, force: Boolean = false)` — atualiza para `UpdateAvailable` se houver nova versão (preservando `Downloading` se já estiver baixando).
     - `startUpdate(activity: Activity, serverUrl: String)`:
       - Verifica `canRequestPackageInstalls()` no Android 8+ (`Build.VERSION_CODES.O`). Se `false`, muda estado para `WaitingInstallPermission`, abre `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` (`package:${packageName}`) e, quando o usuário retornar à `MainActivity` (`onResume`) com permissão concedida, inicia automaticamente o download! Se o usuário voltar sem conceder, retorna o estado para `UpdateAvailable` sem erro bloqueante.
       - Limpa arquivos antigos em `File(context.cacheDir, "updates")` e baixa `${normalizedServerUrl}${remote.apkPath}` em `Dispatchers.IO` atualizando `progressPercent` (0..100).
       - Valida `sha256` (quando presente nos metadados); se falhar integridade, exclui o arquivo corrompido e exibe `Error` com botão para tentar novamente.
       - Dispara `Intent(Intent.ACTION_VIEW)` com `FileProvider.getUriForFile(context, "${BuildConfig.APPLICATION_ID}.fileprovider", apkFile)`, MIME `application/vnd.android.package-archive`, flags `Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION`.
       - Ao retornar de um cancelamento do instalador nativo, o `onResume` permite que o usuário toque no botão novamente sem travamento.

### 5.5. Experiência Visual no App (Jetpack Compose)

- **Componente reutilizável `UpdateAvailableButton` (em `PairedDashboardScreen.kt` ou arquivo dedicado `UpdateBanner.kt`):**
  - Exibido **exclusivamente** quando há atualização disponível (`UpdateAvailable`, `WaitingInstallPermission`, `Downloading`, `Installing`, `Error`).
  - **Estado `UpdateAvailable`:** botão limpo e destacado na parte superior da tela (logo abaixo do cabeçalho, antes do card de status): ícone de atualização + texto **"Atualizar para vX.X.X"**.
  - **Estado `Downloading`:** botão desabilitado / indicador de progresso linear + `"Baixando atualização... XX%"`.
  - **Estado `Error`:** mensagem curta do erro + botão **"Tentar novamente"**.
  - Exibido tanto na `PairedDashboardScreen` quanto na `SelfRegisterScreen` (para aparelhos antigos que ainda não foram pareados poderem atualizar em 1 toque antes mesmo de cadastrar números).
  - **Zero notificações na barra de status do Android.**

---

## 6. O que Fica a Cargo do Implementador

- Escolha exata de cores/espaçamentos do botão seguindo `HubTheme.palette` existente (cor de destaque consistente com a marca Relix `#DE1D4B` ou `palette.sky` com contraste AA em modo claro e escuro).
- Detalhes de limpeza do diretório `cacheDir/updates` na inicialização do app (para não ocupar armazenamento após uma atualização bem-sucedida).
- Estrutura dos testes unitários JVM no Android (`AppUpdateCheckerTest.kt` e `PermissionSnapshotTest.kt`) e teste de integração no backend (`scripts/test-apk-version-endpoint.ts`).
- Geração da keystore fixa de release (`relix-release.jks`) + `keystore.properties` (fora do Git), incremento da versão do Android para `versionCode = 5` e `versionName = "1.2.0"`, validação da assinatura com `apksigner` e publicação do APK + `version.json` no Cloudflare R2 ao final.
