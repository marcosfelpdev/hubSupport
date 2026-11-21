# Rebranding Visual — Relix (Web) & Relix Mobile (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o rebranding visual oficial da plataforma para Relix (Web) e Relix Mobile (Android) utilizando os novos assets gráficos (símbolo vetorial e ícone carmim), sem modificar variáveis de infraestrutura ou pacotes internos.

**Architecture:** No frontend web, um novo componente vetorial `RelixLogo.tsx` fornece suporte dinâmico a temas claro/escuro e variantes (completa, símbolo e app-icon); favicons, metatags, telas de autenticação e navegação são atualizadas para a marca Relix. No aplicativo Android, o nome visível muda para `Relix Mobile`, todas as densidades de mipmaps e ícones adaptativos recebem o ícone carmim `#DE1D4B` com o monograma branco centralizado sem texto, e as telas Compose e notificações adotam a nova nomenclatura visual.

**Tech Stack:** React 19, TypeScript, Vite, SVG, Python Pillow (geração de matrizes gráficas), Kotlin, Jetpack Compose Material 3, Android SDK 35, Gradle, Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-11-21-rebranding-relix-visual-design.md`

## Global Constraints
- Esta entrega é **estritamente visual**: variáveis de infraestrutura (`R2_BUCKET_NAME`, `DEFAULT_PROD_API`, URLs de banco e rotas de deploy) NUNCA devem ser alteradas.
- O nome do pacote Android permanece `com.hubsupport.phonefinder`.
- O ícone mobile no Android deve conter apenas o monograma branco em fundo carmim `#DE1D4B`, **sem nenhum texto**, exatamente como na referência visual fornecida.
- A cor primária da marca Relix é `#DE1D4B`, acompanhada pelo Dark Navy `#121A2D` / `#141B2E` e branco `#FFFFFF`.
- `npx vite build` no frontend e `./gradlew testDebugUnitTest assembleRelease` no Android devem concluir com 100% de sucesso e zero erros.

## Review Focus
1. Renderização nítida do logo vetorial `RelixLogo` em temas Dark e Light, sem cortes ou distorções de proporção.
2. Integridade dos favicons (`favicon.ico` e `favicon.svg`) na aba do navegador.
3. Preservação de layout responsivo na Sidebar quando colapsada (símbolo isolado) e expandida (logo horizontal completa).
4. Alinhamento e recorte circular seguro do ícone adaptativo no Android (margem de segurança de 25% para evitar cortes nas bordas do monograma).
5. Exibição correta do nome "Relix Mobile" na gaveta de aplicativos do Android e nas notificações de sistema.

---

### Task 1: Web Brand Assets & `RelixLogo` Component

**Files:**
- Create: `src/components/common/RelixLogo.tsx`
- Create: `public/favicon.svg`
- Create: `public/relix-icon.png`
- Modify: `index.html:1-21`
- Test: `scripts/test-relix-brand-assets.ts`

**Interfaces:**
- Produces: `RelixLogo({ variant?: "full" | "symbol" | "app-icon", mode?: "auto" | "light" | "dark", className?: string, height?: number })`

- [x] **Step 1: Write verification test for brand assets and `RelixLogo`**

Criar `scripts/test-relix-brand-assets.ts` verificando:
1. Existência e validade dos arquivos `public/favicon.svg` e `public/relix-icon.png`.
2. Presença do novo título `<title>Relix — Log de Atendimentos & Relatórios IA</title>` e link do favicon em `index.html`.
3. Exportação e renderização limpa do componente `RelixLogo`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-relix-brand-assets.ts`  
Expected: FAIL (arquivos de assets e componente ainda não existem).

- [x] **Step 3: Implement `RelixLogo.tsx` and generate public assets**

1. Modelar vetor SVG exato em `RelixLogo.tsx` com as três variantes:
   - `full`: símbolo à esquerda + tipografia *"relix"* à direita com o corte no "x" (Dark: texto branco + "x" carmim; Light: texto navy `#121A2D` + "x" carmim).
   - `symbol`: bracket geométrico com a fita "R/X" carmim (`#DE1D4B`).
   - `app-icon`: quadrado com cantos arredondados (`rx="22%"`) em fundo `#DE1D4B` com o símbolo branco centralizado.
2. Exportar `public/favicon.svg` (SVG otimizado do app-icon).
3. Gerar `public/relix-icon.png` (512x512 PNG de alta resolução).
4. Atualizar `index.html` com o título oficial e meta descrições da Relix.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-relix-brand-assets.ts`  
Expected: PASS com código 0.

- [x] **Step 5: Commit**

```bash
git add src/components/common/RelixLogo.tsx public/ index.html scripts/test-relix-brand-assets.ts
git commit -m "feat(brand): add RelixLogo component and public brand assets"
```

---

### Task 2: Web SPA Visual Rebranding

**Files:**
- Modify: `src/components/Sidebar.tsx:1-80`
- Modify: `src/components/DashboardHeader.tsx:1-60`
- Modify: `src/pages/LoginPage.tsx:1-120`
- Modify: `src/components/phoneFinder/AppDownloadModal.tsx:1-80`
- Modify: `src/lib/pdf-generator.ts:1-60`
- Modify: `src/lib/report-formatter.ts:1-40`
- Test: `npx vite build`

**Interfaces:**
- Consumes: `<RelixLogo />`
- Produces: Interface web totalmente atualizada com a marca Relix e Relix Mobile

- [x] **Step 1: Update `Sidebar.tsx` and `DashboardHeader.tsx`**

1. Em `Sidebar.tsx`:
   - Substituir o ícone genérico e texto "HubSupport" por `<RelixLogo variant={isHovered ? "full" : "symbol"} height={32} />`.
   - Atualizar tooltips e textos visuais para "Relix".
2. Em `DashboardHeader.tsx`:
   - Atualizar títulos e rótulos de "HubSupport" para "Relix".

- [x] **Step 2: Update `LoginPage.tsx`**

1. Substituir o cabeçalho e logo de login pela versão `<RelixLogo variant="full" height={48} />`.
2. Atualizar textos de boas-vindas: *"Acesse sua conta no Relix"*.

- [x] **Step 3: Update `AppDownloadModal.tsx` and PDF Reports**

1. Em `AppDownloadModal.tsx`:
   - Atualizar título para *"Relix Mobile"*.
   - Atualizar instruções: *"Instale o aplicativo Relix Mobile no celular..."*.
2. Em `pdf-generator.ts` e `report-formatter.ts`:
   - Atualizar assinaturas visuais geradas de "HubSupport" para "Relix".

- [x] **Step 4: Run build verification**

Run: `npx vite build`  
Expected: Build concluído com sucesso e zero erros TypeScript.

- [x] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/DashboardHeader.tsx src/pages/LoginPage.tsx src/components/phoneFinder/AppDownloadModal.tsx src/lib/pdf-generator.ts src/lib/report-formatter.ts
git commit -m "feat(brand): update web SPA visuals and typography to Relix"
```

---

### Task 3: Android Launcher Icons Generation (Mipmaps & Adaptive Icons)

**Files:**
- Modify: `hubsupport-phone-finder-android/app/src/main/res/mipmap-mdpi/ic_launcher.png`, `ic_launcher_round.png` (48x48)
- Modify: `hubsupport-phone-finder-android/app/src/main/res/mipmap-hdpi/ic_launcher.png`, `ic_launcher_round.png` (72x72)
- Modify: `hubsupport-phone-finder-android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`, `ic_launcher_round.png` (96x96)
- Modify: `hubsupport-phone-finder-android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`, `ic_launcher_round.png` (144x144)
- Modify: `hubsupport-phone-finder-android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`, `ic_launcher_round.png` (192x192)
- Create: `hubsupport-phone-finder-android/app/src/main/res/drawable/ic_launcher_foreground.xml`
- Modify: `hubsupport-phone-finder-android/app/src/main/res/drawable/ic_launcher_background.xml`
- Modify: `hubsupport-phone-finder-android/app/src/main/res/values/colors.xml`
- Test: `scripts/test-android-launcher-icons.ts`

**Interfaces:**
- Produces: Matrizes PNG de alta fidelidade e vetores XML para o launcher Android do Relix Mobile

- [x] **Step 1: Write verification script for Android launcher icons**

Criar script que inspeciona as dimensões, canais e integridade de todos os arquivos de ícone nos diretórios mipmap do app Android.

- [x] **Step 2: Generate PNG mipmaps and vector foreground**

1. Usar script Python Pillow para renderizar as matrizes nativas do ícone arredondado carmim `#DE1D4B` com o monograma branco isolado para:
   - `mdpi` (48x48)
   - `hdpi` (72x72)
   - `xhdpi` (96x96)
   - `xxhdpi` (144x144)
   - `xxxhdpi` (192x192)
2. Criar `ic_launcher_foreground.xml` em vetor com viewport 108x108 e monograma centralizado de 64x64.
3. Adicionar `<color name="relix_brand_rose">#FFDE1D4B</color>` em `colors.xml` e referenciar em `ic_launcher_background.xml`.

- [x] **Step 3: Run verification test**

Run: `npx tsx scripts/test-android-launcher-icons.ts`  
Expected: PASS com código 0.

- [x] **Step 4: Commit**

```bash
git add app/src/main/res/mipmap-*/ app/src/main/res/drawable/ app/src/main/res/values/colors.xml
git commit -m "feat(brand): update Android launcher icons to Relix Mobile"
```

---

### Task 4: Android App Visual Naming & UI Branding ("Relix Mobile")

**Files:**
- Modify: `hubsupport-phone-finder-android/app/src/main/res/values/strings.xml:1-10`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/ui/SelfRegisterScreen.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/ui/PairedDashboardScreen.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/ui/PairingScreen.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/core/NotificationChannels.kt`
- Modify: `hubsupport-phone-finder-android/app/src/main/java/com/hubsupport/phonefinder/core/AlertExecutor.kt`
- Test: `cd hubsupport-phone-finder-android && ./gradlew testDebugUnitTest`

**Interfaces:**
- Produces: App Android com textos e títulos exibindo "Relix Mobile"

- [x] **Step 1: Update `strings.xml` and notification channels**

1. Em `strings.xml`:
   ```xml
   <string name="app_name">Relix Mobile</string>
   ```
2. Em `NotificationChannels.kt`:
   - Atualizar títulos e canais de notificação para "Relix Mobile".
3. Em `AlertExecutor.kt`:
   - Fallback de conteúdo para `"Relix Mobile"`.

- [x] **Step 2: Update Compose Screen Headers**

1. Em `SelfRegisterScreen.kt`:
   - Título principal: *"Relix Mobile"*.
2. Em `PairedDashboardScreen.kt`:
   - Título do cabeçalho: *"Relix Mobile"*.
3. Em `PairingScreen.kt`:
   - Título do cabeçalho: *"Relix Mobile"*.

- [x] **Step 3: Run Android unit tests**

Run: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && ./gradlew testDebugUnitTest`  
Expected: PASS com 100% dos testes aprovados.

- [x] **Step 4: Commit**

```bash
git add app/src/main/res/values/strings.xml app/src/main/java/com/hubsupport/phonefinder/
git commit -m "feat(brand): update Android app strings and UI headers to Relix Mobile"
```

---

### Task 5: Release Build, Cloudflare R2 Upload & End-to-End Verification

**Files:**
- Modify: `hubsupport-phone-finder-android/app/build.gradle.kts` (bump `versionCode = 4`, `versionName = "1.1.1"`)
- Script: `scripts/upload-phone-finder-apk.ts`
- Test: `scripts/test-apk-download-endpoint.ts`

**Interfaces:**
- Produces: Novo `app-release.apk` assinado e minificado contendo a nova marca, publicado no Cloudflare R2

- [x] **Step 1: Bump version and build production release APK**

1. Em `app/build.gradle.kts`: `versionCode = 4`, `versionName = "1.1.1"`.
2. Executar: `cd c:\Users\mfana\projetos\hubsupport-phone-finder-android && ./gradlew assembleRelease`.
3. Validar geração de `app/build/outputs/apk/release/app-release.apk`.

- [x] **Step 2: Upload new APK to Cloudflare R2**

Executar script de upload para publicar o novo binário no bucket Cloudflare R2.

- [x] **Step 3: Run end-to-end verification**

1. Executar `scripts/test-apk-download-endpoint.ts` validando resposta 200 e integridade do arquivo.
2. Executar `npm run build` no HubSupport garantindo build limpo.

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/plans/ docs/superpowers/specs/
git commit -m "chore(brand): complete visual rebranding to Relix and Relix Mobile"
```
