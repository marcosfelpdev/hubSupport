# Relix Mobile In-App 1-Tap Update & Permission Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic version metadata publishing (`phone-finder/version.json`) and an in-app 1-tap APK update button in Relix Mobile, remove unused sensitive permissions (`SYSTEM_ALERT_WINDOW`, `USE_FULL_SCREEN_INTENT`) while keeping silent-mode ringing 100% intact, and sign/publish release `v1.2.0` (`versionCode = 5`) with a dedicated fixed release keystore.

**Architecture:** The backend (`hubSupport`) publishes `phone-finder/version.json` alongside the APK in Cloudflare R2 (via `scripts/publish-phone-finder-apk.ts`) and exposes `GET /api/phone-finder/version` with a 60s in-memory cache. The Android app (`hubsupport-phone-finder-android`) checks that endpoint on resume/connect via `HttpURLConnection`, surfaces an inline Jetpack Compose update button (zero status-bar notifications) when `remote.versionCode > BuildConfig.VERSION_CODE`, downloads the APK into `cacheDir/updates/` with SHA-256 verification, and launches the native Android installer via `FileProvider`.

**Tech Stack:** Node.js + Express 5 + TypeScript + Cloudflare R2 (`@aws-sdk/client-s3`) on backend; Kotlin + Jetpack Compose + Material 3 + AndroidX `FileProvider` + JUnit 4 + Kotlin Coroutines Test on Android.

**Spec:** `docs/superpowers/specs/2026-11-21-relix-mobile-in-app-update-design.md`

## Global Constraints

- Preserve silent-mode and lockscreen alarm ringing 100%: keep `AudioManager.STREAM_ALARM`, `AudioAttributes.USAGE_ALARM`, `WAKE_LOCK`, `VIBRATE`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_REMOTE_MESSAGING`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, and `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- Remove `SYSTEM_ALERT_WINDOW` and `USE_FULL_SCREEN_INTENT` from Android manifest, permission checker, and UI checklist (2 critical permissions total).
- Zero Android status-bar notifications for app updates (in-app button only).
- Keep existing `GET /api/phone-finder/apk` route, R2 bucket (`R2_BUCKET_NAME`), package name (`com.hubsupport.phonefinder`), and server URLs unchanged.
- Do not add third-party HTTP libraries to Android (use JDK `HttpURLConnection`, `org.json.JSONObject`, `java.security.MessageDigest`).
- Release APK `v1.2.0` (`versionCode = 5`) MUST be signed with a dedicated fixed release keystore (`relix-release.jks` + `keystore.properties`, both gitignored) and verified via `apksigner` to NOT be `CN=Android Debug`.

## Review Focus

- **Corrupted/truncated APK download (SHA-256 mismatch):** `ApkUpdateManager` deletes the bad file and transitions to `AppUpdateState.Error` with retry, never launching the installer (covered in Task 3).
- **User declines "Install unknown apps" or cancels the Android installer:** `onResume` transitions cleanly from `WaitingInstallPermission` / `Installing` back to `UpdateAvailable` instead of getting stuck (covered in Task 3).
- **Server unreachable, HTTP 404, or malformed JSON on `/api/phone-finder/version`:** `AppUpdateChecker` fails silently returning `null` (`Idle`), never showing an error banner on background checks (covered in Task 1 & Task 3).
- **Equal or older server version (`remote.versionCode <= currentVersionCode`):** Must return `null` and show nothing, preventing update loops (covered in Task 3).
- **Backend cache TTL & `?fresh=1` bypass + missing/invalid `version.json`:** `GET /api/phone-finder/version` returns `404` when missing/invalid, caches valid metadata for 60s, and honors `?fresh=1` (covered in Task 1).

---

### Task 1: Backend Version Metadata Service, Endpoint & Atomic R2 Publisher (`hubSupport`)

**Files:**
- Create: `src/server/phoneFinder/apkVersionService.ts`
- Modify: `src/server/app.ts:61-87`
- Modify: `scripts/publish-phone-finder-apk.ts:1-46`
- Test: `scripts/test-apk-version-endpoint.ts`

**Interfaces:**
- Consumes: `getFileBuffer`, `uploadBuffer`, `uploadFileFromDisk` from `src/server/services/r2Storage.ts`.
- Produces:
  - `export const PHONE_FINDER_VERSION_R2_KEY = "phone-finder/version.json"` in `src/server/phoneFinder/apkVersionService.ts`
  - `export interface ApkVersionMetadata { versionCode: number; versionName: string; apkSizeBytes: number; sha256: string; publishedAt: string; }`
  - `export interface ApkVersionResponse extends ApkVersionMetadata { apkPath: string; }`
  - `export async function getLatestApkVersion(options?: { bypassCache?: boolean }): Promise<ApkVersionResponse | null>`
  - `export function clearApkVersionCache(): void`
  - `export function parseGradleVersion(gradleContent: string): { versionCode: number; versionName: string }` in `scripts/publish-phone-finder-apk.ts`
  - Public route `GET /api/phone-finder/version` returning `200` (`ApkVersionResponse`) or `404` (`{ error: string }`).

- [ ] **Step 1: Write the failing backend verification script `scripts/test-apk-version-endpoint.ts`**

Create `scripts/test-apk-version-endpoint.ts` asserting:
1. `parseGradleVersion` extracts `{ versionCode: 5, versionName: "1.2.0" }` from a sample `build.gradle.kts` snippet and throws when missing.
2. `getLatestApkVersion` returns `null` when `version.json` is absent or malformed JSON, returns parsed `ApkVersionResponse` (with `apkPath: "/api/phone-finder/apk"`) when valid, caches for 60s, and refreshes when `{ bypassCache: true }` is passed (injecting a mock `fetchBuffer` reader parameter or testing against isolated helper `createApkVersionService`).
3. Express `GET /api/phone-finder/version` returns HTTP `200` with `Cache-Control: no-cache, no-store, must-revalidate` and valid JSON (or `404` if not yet published) via an ephemeral HTTP server instance of `app`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-apk-version-endpoint.ts`  
Expected: FAIL because `apkVersionService.ts` and `parseGradleVersion` do not exist yet.

- [ ] **Step 3: Implement `src/server/phoneFinder/apkVersionService.ts`**

Implement `createApkVersionService(deps)` (defaulting `fetchBuffer` to `getFileBuffer` and `now` to `Date.now`) with 60,000 ms TTL cache, strict validation (`Number.isInteger(versionCode) && versionCode > 0`, non-empty `versionName`), `apkPath: "/api/phone-finder/apk"`, and module-level exports `PHONE_FINDER_VERSION_R2_KEY`, `getLatestApkVersion`, `clearApkVersionCache`.

- [ ] **Step 4: Register `GET /api/phone-finder/version` in `src/server/app.ts`**

Add the public route directly next to `GET /api/phone-finder/apk`:
- Support `?fresh=1` (`bypassCache: req.query.fresh === "1"`).
- Always set `Cache-Control: no-cache, no-store, must-revalidate`.
- Return `200` with the metadata JSON or `404` with `{ error: "Metadados de versão ainda não publicados." }`.

- [ ] **Step 5: Update `scripts/publish-phone-finder-apk.ts` to publish `version.json` atomically after APK**

- Export `parseGradleVersion(gradleContent: string)` and `computeFileSha256(filePath: string): Promise<string>`.
- Support optional CLI flags `--version-code <n>` and `--version-name <str>`, falling back to reading `../hubsupport-phone-finder-android/app/build.gradle.kts`.
- Guard `main()` execution when imported by tests (`require.main === module` / `import.meta.url` check).
- Upload `phone-finder/hubsupport-phone-finder.apk` first, then upload `phone-finder/version.json` via `uploadBuffer(..., "application/json")`.

- [ ] **Step 6: Run tests and build to verify**

Run: `npx tsx scripts/test-apk-version-endpoint.ts && npm run build`  
Expected: All assertions PASS and Vite/Prisma build succeeds with 0 errors.

- [ ] **Step 7: Commit on feature branch**

Create branch `feature/relix-mobile-in-app-update` in `hubSupport` and commit:
```bash
git checkout -b feature/relix-mobile-in-app-update
git add docs/superpowers/specs/2026-11-21-relix-mobile-in-app-update-design.md docs/superpowers/plans/2026-11-21-relix-mobile-in-app-update.md src/server/phoneFinder/apkVersionService.ts src/server/app.ts scripts/publish-phone-finder-apk.ts scripts/test-apk-version-endpoint.ts
git commit -m "feat(phone-finder): add APK version metadata endpoint and atomic R2 version.json publisher"
```

---

### Task 2: Android Sensitive Permission Cleanup & Silent-Alarm Preservation (`hubsupport-phone-finder-android`)

**Files:**
- Modify: `app/src/main/AndroidManifest.xml:16-20`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/core/AlertExecutor.kt:286-304`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/core/PermissionChecker.kt:14-105`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/ui/MainActivity.kt:31-38,106-137`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt:101-114,245-253,820-920`
- Test: `app/src/test/java/com/hubsupport/phonefinder/core/PermissionSnapshotTest.kt`

**Interfaces:**
- Consumes: Existing `AlertExecutor`, `PermissionChecker`, `PairedDashboardScreen`, `MainActivity`.
- Produces:
  - `data class PermissionSnapshot(val notificationsGranted: Boolean, val batteryOptimizationIgnored: Boolean)` with `TOTAL_CRITICAL_COUNT = 2`, `grantedCount`, `allCriticalGranted`.
  - Clean `PairedDashboardScreen` signature without `onOpenFullScreenIntentSettings` and `onOpenOverlaySettings`.

- [ ] **Step 1: Update `PermissionSnapshotTest.kt` to enforce the 2-permission contract**

Replace the 4-flag test with `allCriticalGranted_isTrueOnlyWhenBothCriticalFlagsAreTrue()` asserting:
- `PermissionSnapshot.TOTAL_CRITICAL_COUNT == 2`
- Both `true` -> `allCriticalGranted == true`, `grantedCount == 2`
- Missing notifications -> `allCriticalGranted == false`, `grantedCount == 1`
- Missing battery optimization -> `allCriticalGranted == false`, `grantedCount == 1`
- Both `false` -> `allCriticalGranted == false`, `grantedCount == 0`

- [ ] **Step 2: Run JVM unit tests to verify test fails before refactor**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && .\gradlew testDebugUnitTest`  
Expected: FAIL compiling `PermissionSnapshotTest.kt` against old 4-arg `PermissionSnapshot`.

- [ ] **Step 3: Clean up permissions across Manifest, `AlertExecutor.kt`, `PermissionChecker.kt`, `MainActivity.kt`, and `PairedDashboardScreen.kt`**

- `AndroidManifest.xml`: remove `<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />` and `<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />`. Keep `POST_NOTIFICATIONS`, `WAKE_LOCK`, `VIBRATE`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_REMOTE_MESSAGING`, `RECEIVE_BOOT_COMPLETED`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- `AlertExecutor.kt`: remove `.setFullScreenIntent(contentPendingIntent, true)` in `showRedScreenAlert()`. Do NOT touch `startAlarmAudio()` (`STREAM_ALARM` / `USAGE_ALARM`), `startVibration()`, `acquireWakeLock()`, or `"Silenciar Alarme"` notification action.
- `PermissionChecker.kt`: reduce `PermissionSnapshot` to `notificationsGranted` and `batteryOptimizationIgnored` (`TOTAL_CRITICAL_COUNT = 2`); remove `buildFullScreenIntentSettingsIntent` and `buildOverlaySettingsIntent`.
- `PairedDashboardScreen.kt` & `MainActivity.kt`: remove the 2 legacy red-screen permission rows (`Alerta em tela cheia`, `Sobrepor outros apps`) and their unused callback parameters.

- [ ] **Step 4: Run JVM unit tests to verify all pass (including `AlertRunCoordinator` / `AlarmVolumeHelper` silent-alarm tests)**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && .\gradlew testDebugUnitTest`  
Expected: BUILD SUCCESSFUL, 100% tests pass.

- [ ] **Step 5: Commit in `hubsupport-phone-finder-android`**

```bash
git add app/src/main/AndroidManifest.xml app/src/main/java/com/hubsupport/phonefinder/core/AlertExecutor.kt app/src/main/java/com/hubsupport/phonefinder/core/PermissionChecker.kt app/src/main/java/com/hubsupport/phonefinder/ui/MainActivity.kt app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt app/src/test/java/com/hubsupport/phonefinder/core/PermissionSnapshotTest.kt
git commit -m "chore(permissions): remove unused overlay and full-screen permissions while preserving silent alarm"
```

---

### Task 3: Android In-App Update Engine (`AppUpdateChecker`, `ApkUpdateManager`, `FileProvider`)

**Files:**
- Create: `app/src/main/res/xml/file_paths.xml`
- Modify: `app/src/main/AndroidManifest.xml` (add `REQUEST_INSTALL_PACKAGES` + `FileProvider`)
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/AppUpdateModels.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/AppUpdateChecker.kt`
- Create: `app/src/main/java/com/hubsupport/phonefinder/core/ApkUpdateManager.kt`
- Test: `app/src/test/java/com/hubsupport/phonefinder/core/AppUpdateCheckerTest.kt`
- Test: `app/src/test/java/com/hubsupport/phonefinder/core/ApkUpdateManagerTest.kt`

**Interfaces:**
- Consumes: `ServerUrlNormalizer` from `com.hubsupport.phonefinder.data`, `BuildConfig.VERSION_CODE` / `BuildConfig.APPLICATION_ID`.
- Produces:
  - `data class RemoteAppVersion(val versionCode: Int, val versionName: String, val apkSizeBytes: Long?, val sha256: String?, val apkPath: String)`
  - `sealed class AppUpdateState` (`Idle`, `UpdateAvailable`, `WaitingInstallPermission`, `Downloading`, `Installing`, `Error`)
  - `class AppUpdateChecker(currentVersionCode: Int, httpGet: (String) -> String? = ...)` with `fun checkForUpdate(serverUrl: String): RemoteAppVersion?` and `fun parseVersionResponse(json: String): RemoteAppVersion?`
  - `class ApkUpdateManager(...)` with:
    - `val state: StateFlow<AppUpdateState>`
    - `fun checkInBackground(serverUrl: String, force: Boolean = false)`
    - `fun startOrResumeUpdate(serverUrl: String, canInstallPackages: () -> Boolean, onRequestInstallPermission: () -> Unit, onLaunchInstaller: (File) -> Unit)`
    - `fun onHostResumed(serverUrl: String, canInstallPackages: () -> Boolean, onLaunchInstaller: (File) -> Unit)`
    - `fun cleanupOldApks()`

- [ ] **Step 1: Write failing unit tests `AppUpdateCheckerTest.kt` and `ApkUpdateManagerTest.kt`**

`AppUpdateCheckerTest.kt` asserts:
- Returns `RemoteAppVersion` when `remote.versionCode > currentVersionCode`.
- Returns `null` when `remote.versionCode == currentVersionCode` or `remote.versionCode < currentVersionCode` (Review Focus #4).
- Returns `null` silently on HTTP error/network exception/404 or malformed JSON (Review Focus #3).
- Normalizes trailing slash in `serverUrl` and defaults `apkPath` to `"/api/phone-finder/apk"`.

`ApkUpdateManagerTest.kt` asserts:
- Transitions `Idle` -> `UpdateAvailable` on newer version, respecting 30s throttle unless `force = true`.
- When `canInstallPackages()` is `false`: transitions to `WaitingInstallPermission` and invokes `onRequestInstallPermission()`.
- On `onHostResumed`: if still `canInstallPackages() == false`, resets cleanly to `UpdateAvailable` (Review Focus #2); if `canInstallPackages() == true`, proceeds automatically to download & install!
- When `sha256` matches downloaded bytes: emits `Downloading` progress, transitions to `Installing`, invokes `onLaunchInstaller(apkFile)`, and on `onHostResumed` resets `Installing` -> `UpdateAvailable` in case user cancelled installer (Review Focus #2).
- When `sha256` mismatches downloaded bytes: deletes the corrupted file, never calls `onLaunchInstaller`, and transitions to `Error` (Review Focus #1).

- [ ] **Step 2: Run JVM unit tests to verify they fail**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && .\gradlew testDebugUnitTest`  
Expected: FAIL because `AppUpdateModels`, `AppUpdateChecker`, and `ApkUpdateManager` do not exist yet.

- [ ] **Step 3: Configure `FileProvider` and `REQUEST_INSTALL_PACKAGES`**

- Create `app/src/main/res/xml/file_paths.xml`:
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <paths>
      <cache-path name="apk_updates" path="updates/" />
  </paths>
  ```
- In `AndroidManifest.xml`: add `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />` and `<provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true">` referencing `@xml/file_paths`.

- [ ] **Step 4: Implement `AppUpdateModels.kt`, `AppUpdateChecker.kt`, and `ApkUpdateManager.kt`**

- Implement `AppUpdateChecker` using `HttpURLConnection` (5s connect, 8s read timeout) and `org.json.JSONObject`.
- Implement `ApkUpdateManager` with injectable `checker`, `downloader`, `updatesDir`, `clock`, and `coroutineScope` for deterministic unit tests, plus production constructor using `HttpURLConnection` streaming download to `File(cacheDir, "updates/relix-mobile-update.apk")` with live `MessageDigest("SHA-256")` computation and progress callback.
- Zero `NotificationManager` usage (strictly no status-bar notifications).

- [ ] **Step 5: Run JVM unit tests to verify all pass**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && .\gradlew testDebugUnitTest`  
Expected: BUILD SUCCESSFUL, all tests pass.

- [ ] **Step 6: Commit in `hubsupport-phone-finder-android`**

```bash
git add app/src/main/AndroidManifest.xml app/src/main/res/xml/file_paths.xml app/src/main/java/com/hubsupport/phonefinder/core/AppUpdateModels.kt app/src/main/java/com/hubsupport/phonefinder/core/AppUpdateChecker.kt app/src/main/java/com/hubsupport/phonefinder/core/ApkUpdateManager.kt app/src/test/java/com/hubsupport/phonefinder/core/AppUpdateCheckerTest.kt app/src/test/java/com/hubsupport/phonefinder/core/ApkUpdateManagerTest.kt
git commit -m "feat(update): add in-app version checker, SHA-256 APK downloader and FileProvider installer engine"
```

---

### Task 4: Android In-App Update Button UI & Activity Wiring (`hubsupport-phone-finder-android`)

**Files:**
- Create: `app/src/main/java/com/hubsupport/phonefinder/ui/UpdateActionBanner.kt`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/PhoneFinderApp.kt`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/ui/MainActivity.kt`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt`
- Modify: `app/src/main/java/com/hubsupport/phonefinder/ui/SelfRegisterScreen.kt`

**Interfaces:**
- Consumes: `ApkUpdateManager`, `AppUpdateState` from Task 3.
- Produces:
  - `@Composable fun UpdateActionBanner(updateState: AppUpdateState, onUpdateClick: () -> Unit)`
  - `val apkUpdateManager: ApkUpdateManager` in `AppContainer` (`PhoneFinderApp.kt`).

- [ ] **Step 1: Wire `ApkUpdateManager` in `PhoneFinderApp.kt`**

Instantiate `apkUpdateManager = ApkUpdateManager(appContext = appContext, currentVersionCode = BuildConfig.VERSION_CODE)` inside `AppContainer` and call `apkUpdateManager.cleanupOldApks()` on startup.

- [ ] **Step 2: Create `UpdateActionBanner.kt`**

Render nothing when `updateState is AppUpdateState.Idle`.
When update is available / in progress / errored:
- `UpdateAvailable` / `WaitingInstallPermission` / `Installing`: crisp single full-width primary button (`#DE1D4B` Relix crimson with white icon `Icons.Rounded.SystemUpdate` & bold text **`"Atualizar para v${remote.versionName}"`**).
- `Downloading`: card/button with `LinearProgressIndicator` (determinate when `progressPercent != null`, indeterminate otherwise) and `"Baixando atualização... ${progressPercent}% "`.
- `Error`: concise inline error text + retry button `"Tentar atualizar novamente"`.

- [ ] **Step 3: Integrate `UpdateActionBanner` in `PairedDashboardScreen.kt`, `SelfRegisterScreen.kt`, and `MainActivity.kt`**

- Collect `val updateState by container.apkUpdateManager.state.collectAsState()` in `MainActivity`.
- Trigger `container.apkUpdateManager.checkInBackground(serverUrl)` and `container.apkUpdateManager.onHostResumed(...)` in `MainActivity.onResume()`, and also trigger `checkInBackground(serverUrl)` whenever `connectionStatus` transitions to `CONNECTED` (`LaunchedEffect(connectionStatus)`).
- Wire `onUpdateClick` to `container.apkUpdateManager.startOrResumeUpdate(...)` with:
  - `canInstallPackages = { Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls() }`
  - `onRequestInstallPermission`: opens `Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))` safely.
  - `onLaunchInstaller(apkFile)`: builds `FileProvider.getUriForFile(this, "${BuildConfig.APPLICATION_ID}.fileprovider", apkFile)` and launches `Intent(Intent.ACTION_VIEW)` with MIME `"application/vnd.android.package-archive"` and `Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION`.
- Pass `updateState` and `onUpdateClick` (with safe defaults `AppUpdateState.Idle` and `{}`) to `PairedDashboardScreen` (rendered directly under the header) and `SelfRegisterScreen` (rendered directly above the main card).

- [ ] **Step 4: Compile & verify with Gradle debug build and unit tests**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && .\gradlew testDebugUnitTest assembleDebug`  
Expected: BUILD SUCCESSFUL, 0 compilation errors, all unit tests pass.

- [ ] **Step 5: Commit in `hubsupport-phone-finder-android`**

```bash
git add app/src/main/java/com/hubsupport/phonefinder/PhoneFinderApp.kt app/src/main/java/com/hubsupport/phonefinder/ui/UpdateActionBanner.kt app/src/main/java/com/hubsupport/phonefinder/ui/MainActivity.kt app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt app/src/main/java/com/hubsupport/phonefinder/ui/SelfRegisterScreen.kt
git commit -m "feat(ui): add 1-tap in-app update button on dashboard and onboarding screens"
```

---

### Task 5: Fixed Release Keystore Provisioning, Release `v1.2.0` (`versionCode 5`), R2 Publish & End-to-End Verification

**Files:**
- Create (local only, gitignored): `c:\Users\mfana\projetos\hubsupport-phone-finder-android\relix-release.jks`
- Create (local only, gitignored): `c:\Users\mfana\projetos\hubsupport-phone-finder-android\keystore.properties`
- Modify: `c:\Users\mfana\projetos\hubsupport-phone-finder-android\app\build.gradle.kts:44-45`

**Interfaces:**
- Consumes: `scripts/publish-phone-finder-apk.ts` (Task 1), Android codebase (Tasks 2–4).
- Produces:
  - Signed release APK `app-release.apk` (`v1.2.0`, `versionCode = 5`) signed with `CN=Relix Mobile`.
  - Live `phone-finder/hubsupport-phone-finder.apk` and `phone-finder/version.json` in Cloudflare R2.

- [ ] **Step 1: Generate dedicated release keystore (`relix-release.jks`) and `keystore.properties`**

- Use JDK `keytool -genkeypair` with `-keystore relix-release.jks -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 10000 -alias relix-release -dname "CN=Relix Mobile, OU=Mobile, O=Relix, L=Sao Paulo, ST=SP, C=BR"` and a strong generated password saved in `keystore.properties` (and reported securely to the user for backup).
- Verify `git status` in `hubsupport-phone-finder-android` confirms neither `relix-release.jks` nor `keystore.properties` is tracked/untracked (properly gitignored).

- [ ] **Step 2: Bump `versionCode = 5` and `versionName = "1.2.0"` in `app/build.gradle.kts` and build release APK**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && .\gradlew testDebugUnitTest assembleRelease`  
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Verify release signature with `apksigner` and manifest permissions with `aapt2` / `apkanalyzer`**

- Run `apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk` and confirm `CN=Relix Mobile` (NOT `CN=Android Debug`).
- Verify `SYSTEM_ALERT_WINDOW` and `USE_FULL_SCREEN_INTENT` are absent from the built APK manifest, while `REQUEST_INSTALL_PACKAGES`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `VIBRATE`, `FOREGROUND_SERVICE_REMOTE_MESSAGING`, and `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` are present.

- [ ] **Step 4: Publish APK + `version.json` to Cloudflare R2 and verify backend endpoints**

- Run `npx tsx scripts/publish-phone-finder-apk.ts` from `c:\Users\mfana\projetos\hubSupport`.
- Run `npx tsx scripts/test-apk-version-endpoint.ts` and `npx tsx scripts/test-apk-download-endpoint.ts` to verify live R2 `version.json` (`versionCode: 5`, `versionName: "1.2.0"`) and SHA-256 match with the downloaded APK.
- Run `npm run build` in `hubSupport`.

- [ ] **Step 5: Commit version bump in `hubsupport-phone-finder-android` and merge PR in `hubSupport`**

- Commit `app/build.gradle.kts` (`chore(release): bump versionCode to 5 and versionName to 1.2.0`) in `hubsupport-phone-finder-android`.
- Push `feature/relix-mobile-in-app-update` in `hubSupport`, open PR, wait for CI checks, squash merge to `main`, and sync local `main`.
