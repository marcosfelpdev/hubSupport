# Rebranding Visual — Relix (Web) & Relix Mobile (Android)

**Data:** 2026-11-21  
**Status:** Proposto para Aprovação  
**Autores:** Equipe de Engenharia e Design  

---

## 1. Contexto e Motivação

A plataforma passa por um processo de reposicionamento e modernização de marca: a nomenclatura e identidade visual anterior (**HubSupport**) são substituídas oficialmente por **Relix** na plataforma web e **Relix Mobile** no aplicativo Android.

A nova identidade gráfica baseia-se na imagem oficial fornecida:
- **Cores Oficiais:**
  - *Carmim / Rose Brand:* `#DE1D4B` (RGB 222, 29, 75)
  - *Dark Navy (Fundo Dark e Tipografia Light):* `#121A2D` / `#141B2E`
  - *Branco Puro (Fundo Light e Monograma):* `#FFFFFF`
- **Símbolo:** Composição geométrica com suporte/bracket estilizado envolvendo uma fita entrelaçada em formato "R/X".
- **Logotipo Completo (Wordmark):** Símbolo à esquerda + tipografia minúscula *"relix"* com corte característico na perna diagonal da letra "x".
- **Ícone Mobile:** Quadrado com cantos arredondados em fundo carmim `#DE1D4B` contendo exclusivamente o monograma branco centralizado, **sem texto**.

Conforme diretriz estrita do usuário, esta etapa é **exclusivamente visual**: variáveis de infraestrutura (nomes de buckets Cloudflare R2, URLs do Render, strings de conexão e pacotes internos) são rigorosamente mantidos inalterados para garantir zero risco operacional ou indisponibilidade.

---

## 2. Objetivos e Anti-Objetivos

### Objetivos
- **Frontend Web (Relix):**
  - Implementar componente de marca `RelixLogo.tsx` em SVG vetorial de alta definição com suporte a variantes: `full` (símbolo + texto "relix"), `symbol` (apenas o ícone) e `app-icon` (ícone arredondado carmim), compatível com temas Dark e Light.
  - Substituir logos e favicons da aplicação: `public/favicon.ico`, `public/favicon.svg` e `public/relix-logo.svg`.
  - Atualizar metatags e título no `index.html`: `<title>Relix — Log de Atendimentos & Relatórios IA</title>`.
  - Atualizar elementos visuais da interface: Sidebar (`Sidebar.tsx`), cabeçalho superior (`DashboardHeader.tsx`), tela de autenticação (`LoginPage.tsx`), modal de download do aplicativo (`AppDownloadModal.tsx`) e rodapés de relatórios PDF.
- **Mobile Android (Relix Mobile):**
  - Atualizar nome visível do aplicativo para `"Relix Mobile"` no manifesto e recursos (`strings.xml: app_name`).
  - Substituir o conjunto completo de ícones do launcher Android em todas as densidades (`mipmap-mdpi`, `mipmap-hdpi`, `mipmap-xhdpi`, `mipmap-xxhdpi`, `mipmap-xxxhdpi` para `ic_launcher` e `ic_launcher_round`), aplicando o ícone carmim com o monograma branco isolado.
  - Atualizar ícones adaptativos do Android 8.0+ (`ic_launcher_foreground.xml` e `ic_launcher_background.xml`).
  - Atualizar cabeçalhos e textos de interface no Jetpack Compose (`SelfRegisterScreen.kt`, `PairedDashboardScreen.kt`, `PairingScreen.kt`) para exibir "Relix Mobile".
  - Atualizar títulos das notificações de serviço de primeiro plano (`NotificationChannels.kt`, `PhoneFinderForegroundService.kt`).
- **Release & Distribuição:**
  - Compilar nova versão do APK release (`Relix Mobile v1.1.1` / `versionCode 4`) e publicar no Cloudflare R2, garantindo que o download por QR Code no painel já entregue o novo visual.

### Anti-Objetivos
- **Não alterar infraestrutura:** Não renomear variáveis de ambiente (`R2_BUCKET_NAME`, `DEFAULT_PROD_API`, nomes de serviços no Render).
- **Não renomear pacote Java/Kotlin:** O package name do Android permanece `com.hubsupport.phonefinder`, prevenindo necessidade de recriar projeto no Firebase ou alterar Keystore.
- **Não alterar schemas de banco:** Tabelas do banco de dados (`prisma/schema.prisma`) e endpoints REST permanecem compatíveis.

---

## 3. Abordagens Consideradas

### Abordagem 1: Vetorização Fiel (SVG) para Web + Mipmaps em Alta Definição para Android (Escolhida)
- **Descrição:** Mapeamento em SVG vetorial de alta precisão para a logo web e renderização de matrizes PNG nativas em todas as densidades mipmap do Android a partir do design vetorial/alta fidelidade.
- **Trade-offs:** Demanda modelagem vetorial das curvas e dimensões exatas da marca, mas oferece acabamento profissional, escalabilidade infinita e zero borrão em telas OLED/Retina.

### Abordagem 2: Recorte e Redimensionamento Raster Direto do JPEG (Descartada)
- **Descrição:** Fatiamento das regiões do arquivo JPEG enviado e reamostragem em resoluções menores.
- **Trade-offs:** O arquivo JPEG original possui pequenos artefatos de compressão e halos em torno das bordas que degradariam a nitidez em ícones de 16px, 32px e 48px.

---

## 4. Detalhamento Técnico

### 4.1. Web SPA (`src/`)

1. **Assets & Componente `RelixLogo.tsx`:**
   - Criação de `src/components/common/RelixLogo.tsx`:
     - Props: `variant?: "full" | "symbol" | "app-icon"`, `mode?: "auto" | "light" | "dark"`, `className?: string`, `height?: number`.
     - Vetor limpo com os caminhos SVG exatos: bracket geométrico + fita "R/X" carmim (`#DE1D4B`) + tipografia *"relix"* com corte no "x".
   - Exportação de SVGs estáticos em `public/`:
     - `public/favicon.svg` (ícone da marca em vetor)
     - `public/favicon.ico` (multi-res 16x16, 32x32, 48x48)
     - `public/relix-icon.png` (512x512 para PWA/web manifest)
     - `public/relix-logo-dark.svg` e `public/relix-logo-light.svg`

2. **Telas e Componentes Atualizados:**
   - `index.html`: `<title>Relix — Log de Atendimentos & Relatórios IA</title>`.
   - `Sidebar.tsx`: Substitui ícone e texto por `<RelixLogo variant="full" />` (ou `variant="symbol"` quando colapsada).
   - `DashboardHeader.tsx`: Atualiza menções e títulos para "Relix".
   - `LoginPage.tsx`: Exibe o logotipo oficial completo Relix no topo do formulário.
   - `AppDownloadModal.tsx`: Substitui referências para *"Relix Mobile"* e ajusta botão de download.
   - `src/lib/pdf-generator.ts` e `src/lib/report-formatter.ts`: Rodapés e marcas visuais em relatórios mudam para *"Relix"*.

---

### 4.2. Mobile Android (`hubsupport-phone-finder-android`)

1. **Launcher Icons (Mipmaps & Adaptive Icons):**
   - Diretórios atualizados com PNGs de alta definição gerados com fidelidade à imagem de referência:
     - `app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48) & `ic_launcher_round.png`
     - `app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72) & `ic_launcher_round.png`
     - `app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96) & `ic_launcher_round.png`
     - `app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144) & `ic_launcher_round.png`
     - `app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192) & `ic_launcher_round.png`
   - Ícone Adaptativo Android 8.0+:
     - `app/src/main/res/drawable/ic_launcher_background.xml`: fundo sólido `#DE1D4B`.
     - `app/src/main/res/drawable/ic_launcher_foreground.xml`: vetor do monograma branco perfeitamente centralizado com margem de segurança de corte circular do sistema.

2. **Strings e Nomes de Interface:**
   - `app/src/main/res/values/strings.xml`:
     ```xml
     <string name="app_name">Relix Mobile</string>
     ```
   - `SelfRegisterScreen.kt`, `PairingScreen.kt`, `PairedDashboardScreen.kt`:
     - Cabeçalho: *"Relix Mobile"*.
     - Subtítulo: *"Informe os últimos 4 dígitos dos números deste aparelho:"*.
   - `NotificationChannels.kt`:
     - Título e canais de notificação atualizados com a assinatura *"Relix Mobile"*.

---

## 5. Validação e Testes

1. **Web:**
   - `npx vite build` executado sem erros de tipagem.
   - Inspeção visual dos temas Claro e Escuro (Sidebar, Header, Login e Favicon).
2. **Android:**
   - `./gradlew testDebugUnitTest` com 100% dos testes aprovados.
   - `./gradlew assembleRelease` gerando APK assinado com a nova marca e ícone.
3. **Distribuição:**
   - Upload do novo binário (`Relix Mobile v1.1.1`) para o Cloudflare R2 e validação do download pelo QR Code.
