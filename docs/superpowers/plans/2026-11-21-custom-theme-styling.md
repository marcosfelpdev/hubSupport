# Estilização Personalizada e Sistema Multi-Tema (Relix) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended — chosen by user) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar um sistema individual de personalização de tema (Padrão do Sistema + Relix Carmim `#E11D48`) com arquitetura preparada para múltiplas variações de cor da logo Relix, nova aba **Aparência** em Configurações e isolamento total do modo escuro e das cores personalizadas de Tags e Categorias de Atendimento.

**Architecture:** Um registro tipado (`src/themes/themeRegistry.ts`) centraliza metadados, prévias e `logoId` de cada tema; `ThemeContext` persiste `brandTheme` em `localStorage` (`relix_brand_theme`) e sincroniza `data-brand-theme` no `<html>` (com script anti-FOUC em `index.html`). Em `src/styles/globals.css`, variáveis CSS semânticas expostas via Tailwind CSS v4 (`@theme inline`) preservam 100% da paridade do tema `default` em `:root`, colapsam controles legados automaticamente para qualquer tema customizado sob `:not(.dark)` e aplicam o tema `relix` exclusivamente no modo claro. Um wrapper `<BrandLogo />` desacopla a logo para futuras variações light/dark.

**Tech Stack:** React 19, TypeScript 5, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`, `@theme inline`, `@custom-variant dark`), `lucide-react`, `tsx` (test runner via `npx tsx scripts/test-*.ts`), Playwright (auditoria visual/computada).

**Spec:** `docs/superpowers/specs/2026-11-21-custom-theme-styling-design.md`

## Global Constraints

- **Modo escuro 100% intocado nas cores de UI:** nenhuma regra de tema pode alterar qualquer cor de fundo, borda, botão, input, sombra ou brilho quando `.dark` estiver em `<html>` (`:not(.dark)` obrigatório em todos os blocos de tema + preservação explícita de `dark:*` em todos os componentes).
- **Logo acompanha o tema em ambos os modos:** `<BrandLogo />` resolve `logoId` do `brandTheme` ativo tanto no modo claro quanto no modo escuro (delegando `mode="auto"` para a variante light/dark da logo).
- **Marca fixa "Relix":** textos da plataforma, tooltips, login e `<title>` permanecem sempre "Relix".
- **Tema `default` (modo claro) = paridade exata com produção:** manter `bg-blue-600` (Categorias), `bg-sky-600` (`EditWorkLogModal`), `bg-indigo-600` (`Adicionar Nota`), `sky` (`DateRangePopover`) e `indigo` inline (`ScreenRecorderButton`) idênticos no `:root`, colapsando-os automaticamente via `:root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)` em temas customizados.
- **Isolamento estrito de Tags e Categorias:** nunca alterar `PRESET_COLORS`, `<input type="color">`, `<TagBadge>`, `<CategoryIconPicker accentColor={catColor} />`, pílulas de Tag e cards de Categoria no `WorkLogForm`, ícones/badges de categoria nos cards/Kanban/detalhes.
- **Isolamento de elementos semânticos/informativos e backdrops:** nunca alterar backdrops (`bg-slate-900/40`, `bg-slate-900/60`), KPIs do Dashboard, pills `Atendimentos`/`Reuniões`, avatares, badges de cargo (`Admin`, `Equipe Técnica`), colunas do Kanban, badges de status, botão `Localizar`, `QRCodeSVG`, `Sparkles` IA, gravação ativa ou alertas de erro/sucesso.
- **Compatibilidade de `localStorage`:** manter chave `hubsupport_theme` intacta; usar `relix_brand_theme` para o tema de marca.
- **Homologação obrigatória antes de PR/merge:** finalizar com `npx tsc --noEmit`, `npm run build`, auditoria de testes e subir `localhost` (`npm run dev`) para validação do usuário. Não abrir PR nem fazer merge antes do OK da homologação.

## Review Focus

1. **Valor corrompido/desconhecido ou `localStorage` bloqueado (`SecurityError`) em `relix_brand_theme`:** deve fazer fallback seguro para `"default"` sem lançar exceção nem deixar `data-brand-theme` inválido no `<html>` (coberto em Task 1).
2. **Vazamento de tema para o modo escuro em componentes sem `dark:*` original** (`SettingsPage` Categorias `blue-600`/checkboxes, `ScreenRecorderButton` inline, `EditWorkLogModal` focus rings, `WorkLogDetailContent` focus rings, botões destrutivos `rose-600`, `EmployeesPage` spinner, `NotificationBell` dot): estilos computados em `.dark` devem ser idênticos entre `default` e `relix` (coberto em Task 1, Task 2 e Task 6).
3. **Contaminação acidental de backdrops (`bg-slate-900/40`, `bg-slate-900/60`) ou de cores personalizadas de Tags/Categorias (`TagBadge`, `PRESET_COLORS`, `CategoryIconPicker`, `WorkLogForm`):** devem permanecer 100% inalterados no tema `relix` (coberto em Task 2 e Task 6).
4. **Contraste de ícone dentro de botão primário `#E11D48` (`WorkLogDetailContent.tsx:1282` `<UserCheck className="text-indigo-400">`):** no tema `relix`, `indigo-400` sobre `#E11D48` perde legibilidade; usar token `--brand-accent-icon-tint` (`#818cf8` em `:root` → `#ffffff` em temas customizados, mantendo `dark:text-cyan-400`) (coberto em Task 1 e Task 4).
5. **Usuário não-admin acessando Configurações (`SettingsPage.tsx`):** deve abrir diretamente na aba `Aparência` (visível a todos os cargos), trocar de tema instantaneamente sem depender de chamadas admin e nunca ficar preso na aba restrita `categories` (coberto em Task 2).

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/themes/themeRegistry.ts` | Criar | Tipos `BrandThemeId`/`BrandLogoId`/`BrandThemeDefinition`, lista `BRAND_THEMES`, validadores e lookup |
| `src/contexts/ThemeContext.tsx` | Modificar | Gerenciar `brandTheme`, `setBrandTheme`, `activeBrandTheme`, persistência `relix_brand_theme` e atributo `data-brand-theme` |
| `index.html` | Modificar | Script síncrono anti-FOUC no `<head>` aplicando `.dark` e `data-brand-theme` antes do React |
| `src/styles/globals.css` | Modificar | Tokens CSS `:root`, regra de colapso `:not([data-brand-theme="default"]):not(.dark)`, bloco `relix`, `@theme inline` e helpers `.brand-card-selected`/`.brand-recorder-btn` |
| `src/components/common/BrandLogo.tsx` | Criar | Wrapper de logo desacoplado por `logoId`, acompanhando `brandTheme` em light e dark mode |
| `src/components/settings/ThemeSettingsSection.tsx` | Criar | Nova UI da aba Aparência com banner, aviso contextual de dark mode e grade de cartões com miniatura fiel |
| `src/pages/SettingsPage.tsx` | Modificar | Nova 1ª aba `Aparência` + migração estrutural de abas/botões/inputs/checkboxes/spinners/exclusão |
| Componentes UI (Tasks 3, 4, 5 — 35 arquivos) | Modificar | Migração cirúrgica dos realces interativos no modo claro para tokens `brand-*`, preservando `dark:*` e exceções |
| `scripts/test-brand-theme-foundation.ts` | Criar | Testes unitários do registry + invariantes de CSS e anti-FOUC |
| `scripts/test-theme-settings-ui.ts` | Criar | Testes SSR de `BrandLogo`, `ThemeSettingsSection` e isolamento em `SettingsPage` |
| `scripts/test-web-spa-rebranding.ts` | Modificar | Atualizar verificação de `RelixLogo` → `BrandLogo` em `Sidebar`, `LoginPage` e `DashboardHeader` |
| `scripts/test-theme-migration-audit.ts` | Criar | Auditoria estática de fronteira + verificação Playwright de estilos computados (light/dark × default/relix + F5 anti-FOUC) |

---

### Task 1: Theme Registry, Contexto Multi-Tema, Anti-FOUC e Tokens CSS Tailwind v4

**Files:**
- Create: `src/themes/themeRegistry.ts`
- Modify: `src/contexts/ThemeContext.tsx:1-76`
- Modify: `index.html:1-23`
- Modify: `src/styles/globals.css:1-416`
- Test: `scripts/test-brand-theme-foundation.ts`

**Interfaces:**
- Consumes: `ThemeContext` existente (`theme`, `setTheme`, `toggleTheme`, chave `"hubsupport_theme"`).
- Produces:
  - `src/themes/themeRegistry.ts`:
    - `export type BrandThemeId = "default" | "relix";`
    - `export type BrandLogoId = "relix-crimson";`
    - `export interface BrandThemePreview { accent: string; accentHover: string; softBg: string; cardBorder: string; cardBg: string; cardPill: string; recorderBg: string; recorderText: string; }`
    - `export interface BrandThemeDefinition { id: BrandThemeId; name: string; badge: string; description: string; logoId: BrandLogoId; accentHex: string; preview: BrandThemePreview; }`
    - `export const DEFAULT_BRAND_THEME_ID: BrandThemeId = "default";`
    - `export const BRAND_THEME_STORAGE_KEY = "relix_brand_theme";`
    - `export const BRAND_THEMES: readonly BrandThemeDefinition[];`
    - `export function isValidBrandThemeId(value: unknown): value is BrandThemeId;`
    - `export function getBrandThemeById(id: unknown): BrandThemeDefinition;`
  - `src/contexts/ThemeContext.tsx`:
    - `ThemeContextType` estendido com `brandTheme: BrandThemeId`, `setBrandTheme: (id: BrandThemeId) => void`, `activeBrandTheme: BrandThemeDefinition`.
  - `src/styles/globals.css`:
    - Tokens `--brand-*` em `:root`, regra de colapso `:root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)`, bloco `:root[data-brand-theme="relix"]:not(.dark)`, mapeamento `@theme inline` (`--color-brand-*`), e utilitárias `.brand-card-selected` e `.brand-recorder-btn`.

- [ ] **Step 1: Escrever o teste de fundação que falha (`scripts/test-brand-theme-foundation.ts`)**

Criar `scripts/test-brand-theme-foundation.ts` validando:
1. `BRAND_THEMES` contém exatamente `["default", "relix"]` com `default.accentHex === "#0F172A"`, `relix.accentHex === "#E11D48"`, ambos com `logoId === "relix-crimson"` e todos os campos de `preview` preenchidos.
2. `isValidBrandThemeId("default") === true`, `isValidBrandThemeId("relix") === true`, e retorna `false` para `""`, `null`, `undefined`, `"unknown-theme"`, `123`.
3. `getBrandThemeById("unknown-theme")` e `getBrandThemeById(null)` fazem fallback seguro para `DEFAULT_BRAND_THEME_ID` (`"default"`).
4. `src/styles/globals.css` contém:
   - `@theme inline` expondo `--color-brand-accent`, `--color-brand-accent-hover`, `--color-brand-accent-foreground`, `--color-brand-accent-soft`, `--color-brand-accent-border`, `--color-brand-accent-text`, `--color-brand-accent-icon-tint`, `--color-brand-focus-border`, `--color-brand-focus-ring`, `--color-brand-card-selected-bg`, `--color-brand-card-selected-bg-hover`, `--color-brand-card-selected-border`, `--color-brand-card-selected-ring`, `--color-brand-card-selected-shadow`, `--color-brand-card-selected-pill`, `--color-brand-recorder-bg`, `--color-brand-recorder-bg-hover`, `--color-brand-recorder-text`, `--color-brand-recorder-border`, `--color-brand-highlight-bg`, `--color-brand-highlight-border`, `--color-brand-highlight-text`, `--color-brand-highlight-dot`, `--color-brand-action-blue`, `--color-brand-action-blue-hover`, `--color-brand-focus-blue`, `--color-brand-action-sky`, `--color-brand-action-sky-hover`, `--color-brand-focus-sky`, `--color-brand-action-indigo`, `--color-brand-action-indigo-hover`, `--color-brand-focus-indigo`, `--color-brand-filter-bg`, `--color-brand-filter-bg-hover`, `--color-brand-filter-border`, `--color-brand-filter-text`, `--color-brand-danger`, `--color-brand-danger-hover`.
   - Bloco de colapso `:root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)` e bloco `:root[data-brand-theme="relix"]:not(.dark)` com `--brand-accent: #e11d48;` e `--brand-danger: #991b1b;`.
   - Garantia de que **nenhum** seletor `[data-brand-theme` aparece sem `:not(.dark)` no `globals.css`.
   - Garantia de que `.avatar` continua com `background: #0f172a;` (preservada conforme Anti-Goal).
5. `index.html` contém script inline no `<head>` lendo `"hubsupport_theme"` e `"relix_brand_theme"` dentro de `try { ... } catch`, validando whitelist `["relix"]` antes de setar `data-brand-theme`.
6. `src/contexts/ThemeContext.tsx` preserva `"hubsupport_theme"` e usa `BRAND_THEME_STORAGE_KEY`, `isValidBrandThemeId`, `getBrandThemeById` e `delete root.dataset.brandTheme` quando `"default"`.

- [ ] **Step 2: Rodar o teste para confirmar falha inicial**

Run: `npx tsx scripts/test-brand-theme-foundation.ts`
Expected: FAIL (`Cannot find module '../src/themes/themeRegistry'`).

- [ ] **Step 3: Implementar `src/themes/themeRegistry.ts`**

Definir os tipos, `DEFAULT_BRAND_THEME_ID`, `BRAND_THEME_STORAGE_KEY`, `BRAND_THEMES` (`"default"` = `"Padrão do Sistema"` / `"Clássico"` / `#0F172A`; `"relix"` = `"Relix Carmim"` / `"Logo Relix"` / `#E11D48`), `isValidBrandThemeId` e `getBrandThemeById` (com fallback seguro para `BRAND_THEMES[0]`).

- [ ] **Step 4: Estender `src/contexts/ThemeContext.tsx` e adicionar anti-FOUC em `index.html`**

- Em `ThemeContext.tsx`: adicionar `getInitialBrandTheme()` (lendo `localStorage.getItem(BRAND_THEME_STORAGE_KEY)` em `try/catch` com validação `isValidBrandThemeId`, fallback `DEFAULT_BRAND_THEME_ID`), estado `brandTheme`, efeito sincronizando `root.dataset.brandTheme` (remove atributo quando `"default"`) e persistência em `localStorage`, expondo `brandTheme`, `setBrandTheme` e `activeBrandTheme` no provider sem quebrar consumidores atuais de `useTheme()`.
- Em `index.html`: adicionar `<script>` síncrono no `<head>` antes de `</head>` aplicando `.dark` (via `hubsupport_theme` ou `prefers-color-scheme`) e `data-brand-theme` (via `relix_brand_theme` contra whitelist `["relix"]`), encapsulado em `try {} catch (_) {}`.

- [ ] **Step 5: Adicionar tokens semânticos, `@theme inline` e helpers em `src/styles/globals.css`**

- Adicionar todas as CSS variables `--brand-*` em `:root` com os hexadecimais exatos da Seção 7.4 da Spec (incluindo `--brand-accent-icon-tint: #818cf8;`).
- Adicionar a regra compartilhada `:root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)` colapsando `--brand-action-blue*`, `--brand-action-sky*`, `--brand-action-indigo*`, `--brand-focus-blue/sky/indigo`, `--brand-filter-*` e `--brand-accent-icon-tint: #ffffff;`.
- Adicionar `:root[data-brand-theme="relix"]:not(.dark)` com a paleta `#E11D48` / `rose-600` e `--brand-danger: #991b1b; --brand-danger-hover: #7f1d1d;`.
- Adicionar bloco `@theme inline { --color-brand-...: var(--brand-...); }` imediatamente após `@custom-variant dark`.
- Adicionar helpers seguros para composições complexas:
  - `.brand-card-selected` (em modo claro usa `border-color`, `box-shadow` combinando anel interno `inset 0 0 0 1.5px var(--brand-card-selected-ring)` + sombra externa `0 4px 12px var(--brand-card-selected-shadow)` e `background-color: var(--brand-card-selected-bg)` com hover; no `.dark` não é sobrescrito ou preserva exatamente o estilo `dark:bg-sky-950/20 dark:border-sky-400 dark:ring-sky-500/40 dark:shadow-sky-950/40`).
  - `.brand-recorder-btn` (aplica `background: var(--brand-recorder-bg); color: var(--brand-recorder-text); border: 1px solid var(--brand-recorder-border);` e `:hover:not(:disabled) { background: var(--brand-recorder-bg-hover); }`).
- Atualizar `.btn-primary`, `.input-dark:focus`, `.spinner` para ler `--brand-accent` / `--brand-accent-hover` / `--brand-focus-border`. Manter `.avatar` inalterada (`background: #0f172a;`).

- [ ] **Step 6: Rodar teste de fundação e type-check**

Run: `npx tsx scripts/test-brand-theme-foundation.ts && npx tsc --noEmit`
Expected: PASS com 0 erros.

- [ ] **Step 7: Commit**

```powershell
git add src/themes/themeRegistry.ts src/contexts/ThemeContext.tsx index.html src/styles/globals.css scripts/test-brand-theme-foundation.ts
git commit -m "feat(theme): adicionar registry de temas, tokens Tailwind v4 e anti-FOUC"
```

---

### Task 2: `BrandLogo`, Seção "Aparência" (`ThemeSettingsSection`) e `SettingsPage`

**Files:**
- Create: `src/components/common/BrandLogo.tsx`
- Create: `src/components/settings/ThemeSettingsSection.tsx`
- Modify: `src/pages/SettingsPage.tsx:1-1231` (nova aba `"appearance"` + migração cirúrgica das linhas mapeadas)
- Test: `scripts/test-theme-settings-ui.ts`

**Interfaces:**
- Consumes: `ThemeContext` (`theme`, `setTheme`, `brandTheme`, `setBrandTheme`, `activeBrandTheme`), `themeRegistry` (`BRAND_THEMES`, `BrandThemeId`, `getBrandThemeById`), `RelixLogo` (`RelixLogoProps`).
- Produces:
  - `src/components/common/BrandLogo.tsx`:
    - `export interface BrandLogoProps extends RelixLogoProps { themeId?: BrandThemeId; }`
    - `export const BrandLogo: React.FC<BrandLogoProps>` + `export default BrandLogo;`
    - Se `themeId` for informado, usa `getBrandThemeById(themeId)`; caso contrário, lê `brandTheme` do contexto (usando hook seguro ou `useTheme()` com fallback para `"default"` se usado fora do provider). Resolve `logoId` em **ambos** os modos light e dark (passando `mode`, `variant`, `height`, `className` ao renderer da logo).
  - `src/components/settings/ThemeSettingsSection.tsx`:
    - `export default function ThemeSettingsSection(): React.JSX.Element`

- [ ] **Step 1: Escrever o teste de UI/SSR e isolamento (`scripts/test-theme-settings-ui.ts`)**

Criar `scripts/test-theme-settings-ui.ts` validando:
1. `renderToString(<BrandLogo themeId="default" variant="full" height={32} />)` e `renderToString(<BrandLogo themeId="relix" variant="symbol" mode="dark" height={32} />)` renderizam `<svg` válido com `aria-label="Relix"` / `"Relix Symbol"` sem erros.
2. `renderToString(<ThemeProvider><ThemeSettingsSection /></ThemeProvider>)` renderiza ambos os temas (`"Padrão do Sistema"` e `"Relix Carmim"`), códigos `"#0F172A"` e `"#E11D48"`, e `aria-pressed="true"` no tema padrão.
3. Inspeção de `src/components/settings/ThemeSettingsSection.tsx`: contém aviso condicional `theme === "dark"` explicando que no modo escuro apenas a variação da logo acompanha o tema + botão `"Alternar para Modo Claro"`, e renderiza `<BrandLogo themeId={item.id} mode="light"`.
4. Inspeção de `src/pages/SettingsPage.tsx`:
   - `activeTab` inicializa em `"appearance"` (`"appearance" | "tags" | "categories"`), visível a todos os usuários (sem guard `isAdmin`), com fallback não-admin para `"appearance"` caso `activeTab === "categories"`.
   - Abas ativas usam `border-brand-accent text-brand-accent dark:border-white dark:text-white`.
   - Botões `Nova Categoria` / `Criar Categoria` usam `bg-brand-action-blue` **com** `dark:bg-blue-600 dark:hover:bg-blue-700`; checkboxes de categoria têm `dark:accent-blue-600 dark:focus:ring-blue-500`; inputs de categoria têm `dark:focus:ring-blue-500`.
   - Botões de confirmação de exclusão usam `bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700`.
   - **Isolamento verificado:** `PRESET_COLORS`, `<TagBadge`, `<CategoryIconPicker`, `type="color"`, `cat.color`, `bg-slate-900/40` (backdrops) e badge `Admin` (`bg-blue-50`) permanecem intactos.

- [ ] **Step 2: Rodar o teste para confirmar falha inicial**

Run: `npx tsx scripts/test-theme-settings-ui.ts`
Expected: FAIL (`Cannot find module '../src/components/common/BrandLogo'`).

- [ ] **Step 3: Implementar `src/components/common/BrandLogo.tsx`**

Implementar `BrandLogo` resolvendo `logoId` via `getBrandThemeById(effectiveThemeId)` (com mapeamento `switch (themeDef.logoId)` delegando `"relix-crimson"` para `<RelixLogo />`). Adicionar um helper opcional `useOptionalTheme` ou `try/catch` em volta de `useTheme()` quando `themeId` for passado explicitamente, facilitando testes SSR isolados.

- [ ] **Step 4: Implementar `src/components/settings/ThemeSettingsSection.tsx`**

Construir a seção seguindo exatamente o design system de `SettingsPage.tsx`:
- Banner explicativo superior (ícone `Palette`, título `"Personalização de Tema e Identidade Visual"`, texto explicando que a escolha é individual e preserva modo escuro, Tags e Categorias).
- Aviso contextual exibido quando `theme === "dark"`: informa que no modo escuro apenas a variação da logo acompanha o tema enquanto as cores de realce se aplicam ao modo claro, com botão `"Alternar para Modo Claro"` chamando `setTheme("light")`.
- Grade `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5` iterando `BRAND_THEMES`:
  - Cartão `<button type="button" aria-pressed={isActive} onClick={() => setBrandTheme(item.id)}>`:
    - Miniatura fixa em modo claro (`bg-[#f8f9fa] border border-slate-200 rounded-xl p-3`) mostrando: `<BrandLogo themeId={item.id} mode="light" height={18} />`, mini item de sidebar ativo (`item.preview.accent`), mini botão primário (`item.preview.accent`), mini botão secundário (`item.preview.recorderBg` / `item.preview.recorderText`) e mini card selecionado (`item.preview.cardBorder` / `item.preview.cardBg` + pill `Aberto` em `item.preview.cardPill`).
    - Nome (`item.name`), badge (`item.badge`), descrição (`item.description`), dot + `<code>{item.accentHex}</code>` e indicador `"Ativo"` com `<Check>` quando selecionado.
    - Borda/glow do cartão selecionado usa `.brand-card-selected` no claro e destaque limpo `dark:border-white dark:ring-1 dark:ring-white/40` no escuro.

- [ ] **Step 5: Atualizar `src/pages/SettingsPage.tsx`**

- Importar `Palette` de `lucide-react` e `ThemeSettingsSection` de `@/components/settings/ThemeSettingsSection`.
- Alterar `activeTab` na L42 para `useState<"appearance" | "tags" | "categories">("appearance")` e o efeito na L90 para cair em `"appearance"` se `!isAdmin && activeTab === "categories"`.
- Inserir botão da aba **Aparência** (com ícone `<Palette className="w-4 h-4" />` e pill `Temas`) como 1ª aba em `L307` e renderizar `{activeTab === "appearance" && <ThemeSettingsSection />}`.
- Migrar estritamente as linhas mapeadas na auditoria:
  - Abas ativas (`L313, L330`): `border-brand-accent text-brand-accent dark:border-white dark:text-white`.
  - Botões Tags (`L399, L429, L815`): `bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-foreground dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white`.
  - Spinner Tags (`L409`): `border-t-brand-accent dark:border-t-slate-200`.
  - Botões Categorias (`L533, L563, L1145`): `bg-brand-action-blue hover:bg-brand-action-blue-hover dark:bg-blue-600 dark:hover:bg-blue-700 text-white`.
  - Spinner Categorias (`L543`): `border-t-brand-action-blue dark:border-t-blue-400`.
  - Foco inputs Tag (`L729, L781`): `focus:border-brand-focus-border focus:ring-brand-focus-ring dark:focus:border-slate-400 dark:focus:ring-slate-400`.
  - Foco inputs/select Categoria (`L992, L1006, L1056, L1114`): `focus:ring-brand-focus-blue dark:focus:ring-blue-500`.
  - Checkboxes Categoria (`L1073, L1090, L1125`): `accent-brand-action-blue text-brand-action-blue focus:ring-brand-focus-blue dark:accent-blue-600 dark:text-blue-600 dark:focus:ring-blue-500`.
  - Botões exclusão (`L883, L1213`): `bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700`.
- **NÃO tocar** em `PRESET_COLORS`, badge `Admin`, alertas, `<TagBadge>`, `<CategoryIconPicker>`, previews/ícones de categoria (`cat.color`), nem backdrops `bg-slate-900/40`.

- [ ] **Step 6: Rodar testes e type-check**

Run: `npx tsx scripts/test-theme-settings-ui.ts && npx tsc --noEmit`
Expected: PASS com 0 erros.

- [ ] **Step 7: Commit**

```powershell
git add src/components/common/BrandLogo.tsx src/components/settings/ThemeSettingsSection.tsx src/pages/SettingsPage.tsx scripts/test-theme-settings-ui.ts
git commit -m "feat(settings): adicionar BrandLogo e aba Aparencia com personalizacao de temas"
```

---

### Task 3: Migração de Navegação, Auth, Notificações e Dashboard/Agenda/Atendimentos (Parte 1)

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/components/DashboardHeader.tsx`
- Modify: `src/components/NotificationBell.tsx`
- Modify: `src/pages/DashboardOverviewPage.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/DashboardClient.tsx`
- Modify: `src/components/ScreenRecorderButton.tsx`
- Modify: `src/components/dashboard/BasicAgenda.tsx`
- Modify: `src/components/dashboard/DateRangePopover.tsx`
- Modify: `src/components/dashboard/RecentWorkLogsList.tsx`
- Modify: `src/components/dashboard/SolvedReportsList.tsx`
- Modify: `scripts/test-web-spa-rebranding.ts`

**Interfaces:**
- Consumes: `<BrandLogo />` (Task 2), tokens CSS `--color-brand-*` e `.brand-recorder-btn` (Task 1).
- Produces: Prints 1, 2, 3 e 4 migrados + navegação, login, notificações, agenda e filtros do dashboard adaptados ao tema no modo claro com dark mode intacto.

- [ ] **Step 1: Migrar Navegação, Auth e Notificações (`Sidebar.tsx`, `LoginPage.tsx`, `DashboardHeader.tsx`, `NotificationBell.tsx`)**

- `Sidebar.tsx`: trocar `RelixLogo` → `BrandLogo` (`L7, L212-216`), item ativo (`L294`: `bg-brand-accent text-brand-accent-foreground dark:bg-white dark:text-slate-900`), ícone ativo (`L301`: `text-brand-accent-foreground dark:text-slate-900`), ícone `Moon` (`L349`: `text-brand-highlight-dot`). Preservar backdrop, gravação ativa, toggle Claro/Escuro, avatares e badges de cargo.
- `LoginPage.tsx`: trocar `RelixLogo` → `BrandLogo` (`L5, L47`), foco inputs (`L83, L103`: `focus:border-brand-focus-border focus:ring-brand-focus-ring`), botão `Entrar` (`L117`: `bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-foreground dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white`). Preservar alerta de erro (`L66-67`).
- `DashboardHeader.tsx`: trocar `RelixLogo` → `BrandLogo` (`L3, L59`). Preservar `.avatar` e botão ghost.
- `NotificationBell.tsx`: badge `{unreadCount} nova(s)` (`L201`: `bg-brand-highlight-bg text-brand-highlight-text border-brand-highlight-border`), link `Marcar lidas` (`L236`: `text-brand-highlight-dot hover:text-brand-highlight-text hover:bg-brand-highlight-bg`), item não lido (`L278`: `bg-brand-highlight-bg/70 hover:bg-brand-highlight-bg border-brand-highlight-border/50`), dot não lido (`L349`: `bg-brand-highlight-dot dark:bg-indigo-600`). Preservar `L185` (`bg-rose-500`), ícones semânticos (`L284-289`) e status (`L336-340`).

- [ ] **Step 2: Migrar Dashboard, Agenda, DateRange e ScreenRecorderButton**

- `DashboardOverviewPage.tsx`: botão `+ Novo Atendimento` (`L115`: `bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-foreground dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white`) e spinner (`L217`: `border-t-brand-accent dark:border-t-white`). Preservar os 4 KPIs (`L124-196`).
- `DashboardPage.tsx`: spinner (`L62`: `border-t-brand-accent dark:border-t-white`).
- `DashboardClient.tsx`: botão `+ Novo Atendimento` (`L157`) e foco dos filtros (`L178, L189, L223, L238, L253`: `focus:border-brand-focus-border`). Preservar backdrop (`L343`).
- `ScreenRecorderButton.tsx`: no ramo `!isRecording` (`L368-389`), usar `className="brand-recorder-btn"` (removendo `background`/`color`/`border` inline hardcoded do estado inativo, mantendo `isRecording` 100% intocado).
- `BasicAgenda.tsx`: dia selecionado (`L385`: `bg-brand-accent text-brand-accent-foreground dark:bg-white dark:text-slate-900`), `isToday` (`L387`: `border-brand-highlight-border bg-brand-highlight-bg text-brand-highlight-text`), dot de evento (`L397`: `bg-brand-accent-foreground dark:bg-slate-900` / `bg-brand-highlight-dot dark:bg-indigo-400`), botão `+ Novo` (`L424`: `bg-brand-accent border-brand-accent hover:bg-brand-accent-hover text-brand-accent-foreground dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-white`), foco inputs/selects (`L448, L457, L464, L477, L492`), botão `Salvar` (`L505`), link `+ Adicionar` (`L527`: `text-brand-highlight-dot hover:text-brand-highlight-text`). Preservar `categoryBadgeConfig` e header/badge informativos.
- `DateRangePopover.tsx`: preset selecionado (`L243`), botão gatilho ativo (`L255`), ícone ativo (`L267`), botão `X` (`L295`), badge `Ativo` (`L325`) usando tokens `--color-brand-filter-*` (com `dark:*` intacto); foco inputs data (`L396, L407`) e botão `Aplicar` (`L425`: `bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-foreground dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900`).
- `RecentWorkLogsList.tsx` (`L68, L82`) e `SolvedReportsList.tsx` (`L68`): foco na busca e pílula de filtro ativo (`bg-brand-accent border-brand-accent text-brand-accent-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white`). Preservar ícones e badges informativos de cabeçalho.

- [ ] **Step 3: Atualizar `scripts/test-web-spa-rebranding.ts` para `BrandLogo`**

Atualizar verificações de `Sidebar.tsx`, `DashboardHeader.tsx` e `LoginPage.tsx` para esperar `BrandLogo` (além de verificar que `BrandLogo.tsx` renderiza `RelixLogo`).

- [ ] **Step 4: Rodar testes e type-check**

Run: `npx tsx scripts/test-web-spa-rebranding.ts && npx tsc --noEmit`
Expected: PASS com 0 erros.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Sidebar.tsx src/pages/LoginPage.tsx src/components/DashboardHeader.tsx src/components/NotificationBell.tsx src/pages/DashboardOverviewPage.tsx src/pages/DashboardPage.tsx src/components/DashboardClient.tsx src/components/ScreenRecorderButton.tsx src/components/dashboard/BasicAgenda.tsx src/components/dashboard/DateRangePopover.tsx src/components/dashboard/RecentWorkLogsList.tsx src/components/dashboard/SolvedReportsList.tsx scripts/test-web-spa-rebranding.ts
git commit -m "feat(theme): migrar navegacao, login, notificacoes, dashboard e agenda para tokens"
```

---

### Task 4: Migração de Formulários, Editor Inline e Modais de Relatório/Mídia (Parte 2)

**Files:**
- Modify: `src/components/WorkLogForm.tsx`
- Modify: `src/components/ClientCombobox.tsx`
- Modify: `src/components/common/InlineMediaEditor.tsx`
- Modify: `src/components/dashboard/EditWorkLogModal.tsx`
- Modify: `src/components/dashboard/WorkLogDetailContent.tsx`
- Modify: `src/components/dashboard/ReportDetailsModal.tsx`
- Modify: `src/components/dashboard/PdfViewerModal.tsx`
- Modify: `src/components/MediaGalleryModal.tsx`
- Modify: `src/components/dashboard/MeetingCompletionModal.tsx`

**Interfaces:**
- Consumes: tokens CSS `--color-brand-*` (Task 1), incluindo `--color-brand-accent-icon-tint`, `--color-brand-action-sky*`, `--color-brand-action-indigo*`, `--color-brand-danger*`.
- Produces: Todos os formulários e modais de relatório/mídia adaptados ao tema com Tags, Categorias, IA, badges semânticos e dark mode 100% preservados.

- [ ] **Step 1: Migrar `WorkLogForm.tsx`, `ClientCombobox.tsx` e `InlineMediaEditor.tsx`**

- `WorkLogForm.tsx`: foco em `L519, L547, L581`, dropzone drag-over em `L663, L672, L684`, link `procure no dispositivo` em `L688` (`text-brand-accent dark:text-white`), badge `✓ No texto` em `L777` (`bg-brand-action-indigo/90 dark:bg-indigo-600/90`), botão `Salvar Atendimento` em `L988`. **NÃO TOCAR** em `L845-875` (Tags Mestre) nem `L902-975` (Categorias de Atendimento).
- `ClientCombobox.tsx`: foco em `L294`.
- `InlineMediaEditor.tsx`: `focus-within` em `L506`, bolinha e linha do cursor de drop em `L529-530` (`bg-brand-action-indigo dark:bg-indigo-400`, preservando `dark:shadow-[0_0_8px_rgba(99,102,241,0.8)]`).

- [ ] **Step 2: Migrar `EditWorkLogModal.tsx` e `WorkLogDetailContent.tsx`**

- `EditWorkLogModal.tsx`: ícone cabeçalho (`L89`: `bg-brand-filter-bg text-brand-action-sky border-brand-filter-border dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800/80`), foco inputs/textareas (`L128, L143, L157, L172, L186`: `focus:border-brand-focus-sky focus:ring-brand-focus-sky dark:focus:border-sky-500 dark:focus:ring-sky-500`), botão `Salvar Alterações` (`L204`: `bg-brand-action-sky hover:bg-brand-action-sky-hover dark:bg-sky-600 dark:hover:bg-sky-500`). Preservar backdrop (`L84`).
- `WorkLogDetailContent.tsx`:
  - Foco select status (`L1012`: `focus:ring-brand-focus-indigo/60 dark:focus:ring-indigo-500/60`, mantendo `statusPill.badgeClass`).
  - Botão `Assumir Tarefa` (`L1277`: `bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-foreground dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white`) + ícone `<UserCheck>` (`L1282`: `text-brand-accent-icon-tint dark:text-cyan-400` para contraste perfeito sobre `#E11D48`).
  - Busca e item selecionado no dropdown `Designar Responsável` (`L1336` + `dark:focus:ring-indigo-500`; `L1367, L1383, L1398` com `brand-highlight-*`).
  - Botões/links `Visualizar PDF` (`L1676, L1687, L2030, L2040`).
  - Foco textarea nota (`L2104` + `dark:focus:ring-indigo-500/30 dark:focus:border-indigo-500`) e botão `Adicionar Nota` (`L2121`: `bg-brand-action-indigo hover:bg-brand-action-indigo-hover dark:bg-indigo-600 dark:hover:bg-indigo-500`).
  - Botão destrutivo `Confirmar Exclusão` (`L2352`: `bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-500`).
  - **NÃO TOCAR** em status, roles, avatares, `<TagBadge>`, categorias, validação `purple`, solução `emerald`, seção/botão IA, ícones informativos de seções nem backdrop (`L2308`).

- [ ] **Step 3: Migrar `ReportDetailsModal.tsx`, `PdfViewerModal.tsx`, `MediaGalleryModal.tsx` e `MeetingCompletionModal.tsx`**

- `ReportDetailsModal.tsx`: botões `Exportar`/`Baixar Arquivo` (`L214, L292, L365`), spinner (`L248`), thumbnail ativa e badge numérico (`L401, L420`). Preservar backdrops e ícones informativos dos cabeçalhos (`L168, L271`).
- `PdfViewerModal.tsx`: botão `Exportar` (`L115`) e spinner (`L140`).
- `MediaGalleryModal.tsx`: botão `Baixar Arquivo` (`L151`) e thumbnail ativa + badge numérico (`L186, L205`).
- `MeetingCompletionModal.tsx`: foco textarea (`L344`), contador de arquivos (`L358`), dropzone drag-over e link (`L384, L391, L401, L407`). Preservar cabeçalho `emerald`, chips informativos e botão `Concluir e Salvar Ata` (`L491`).

- [ ] **Step 4: Verificar compilação TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```powershell
git add src/components/WorkLogForm.tsx src/components/ClientCombobox.tsx src/components/common/InlineMediaEditor.tsx src/components/dashboard/EditWorkLogModal.tsx src/components/dashboard/WorkLogDetailContent.tsx src/components/dashboard/ReportDetailsModal.tsx src/components/dashboard/PdfViewerModal.tsx src/components/MediaGalleryModal.tsx src/components/dashboard/MeetingCompletionModal.tsx
git commit -m "feat(theme): migrar formularios, editor inline e modais de relatorio para tokens"
```

---

### Task 5: Migração do Painel Técnico, Kanban, Card Selecionado, Clientes, Funcionários e Localizador (Parte 3)

**Files:**
- Modify: `src/pages/TechnicianPage.tsx`
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`
- Modify: `src/components/TechnicianDashboardClient.tsx`
- Modify: `src/components/ReportCardMinimized.tsx`
- Modify: `src/components/ClientsManager.tsx`
- Modify: `src/pages/ClientsPage.tsx`
- Modify: `src/pages/ClientProfilePage.tsx`
- Modify: `src/components/EmployeesManager.tsx`
- Modify: `src/pages/EmployeesPage.tsx`
- Modify: `src/pages/PhoneFinderPage.tsx`
- Modify: `src/components/phoneFinder/PhoneCardTile.tsx`
- Modify: `src/components/phoneFinder/PhoneCardFormModal.tsx`
- Modify: `src/components/phoneFinder/PairingCodeModal.tsx`
- Modify: `src/components/phoneFinder/AppDownloadModal.tsx`

**Interfaces:**
- Consumes: tokens CSS `--color-brand-*` e `.brand-card-selected` (Task 1).
- Produces: Prints 5, 6 e 7 migrados + módulos Técnico/Kanban, Clientes, Funcionários e Localizador 100% adaptados com exceções e dark mode preservados.

- [ ] **Step 1: Migrar Painel Técnico, Kanban e `ReportCardMinimized.tsx` (Prints 5 e 6)**

- `TechnicianPage.tsx`: toggle segmentado ativo (`L102, L114`: `bg-brand-accent text-brand-accent-foreground dark:bg-slate-800 dark:text-white`) e spinner (`L127`: `border-t-brand-accent dark:border-t-white`). Preservar badge `Equipe Técnica`.
- `TechnicianKanbanBoard.tsx`: foco dos 4 filtros (`L581, L590, L604, L618`), dropzone drag-over (`L711`: `border-brand-card-selected-border bg-brand-card-selected-bg dark:border-sky-500 dark:bg-sky-950/30`), banner `"Solte para mover"` (`L777`: `border-brand-card-selected-border bg-brand-filter-bg-hover text-brand-filter-text dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-200`). Preservar `COLUMNS`, `DEFAULT_CATEGORIES`, filtros de categoria (`cat.color`) e toggle `Hoje`/`Todos`.
- `TechnicianDashboardClient.tsx`: foco dos 7 campos de filtro (`L277, L284, L291, L296, L308, L317, L329`).
- `ReportCardMinimized.tsx`: estado `isSelected` (`L389, L395` usando `.brand-card-selected` + `dark:bg-sky-950/20 dark:hover:bg-sky-950/30 dark:border-sky-400 dark:ring-[1.5px] dark:ring-inset dark:ring-sky-500/40 dark:shadow-md dark:shadow-sky-950/40`), estado `isDragging` (`L393`: `border-brand-card-selected-border dark:border-sky-500`) e pill `Aberto` (`L421`: `bg-brand-card-selected-pill dark:bg-sky-600`). **NÃO TOCAR** em `<TagBadge>`, `categoryColor`, `Sparkles`, status nem avatares.

- [ ] **Step 2: Migrar Clientes e Funcionários (Print 7)**

- `ClientsManager.tsx`: ícones sólidos cabeçalho/modais (`L226, L477, L595`: `bg-brand-accent text-brand-accent-foreground dark:bg-white dark:text-slate-900`), botões primários (`L246, L320, L564, L682`), foco inputs/selects (`L267, L521, L540, L639, L658`), hover link/editar (`L358, L426`), botão destrutivo `Sim, excluir` (`L748`: `bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700`). Preservar pills `Atendimentos`/`Reuniões`, avatares e backdrops.
- `ClientsPage.tsx`: spinner `<Loader2>` (`L37`: `text-brand-accent dark:text-slate-300`).
- `ClientProfilePage.tsx`: spinner (`L255`), botão `Ocultar Ata` (`L557`), ícone `Ver Galeria` (`L633`: `text-brand-highlight-dot dark:text-indigo-500`), hover título (`L815`), botão `Detalhes` hover (`L871`), ícone modal editar (`L926`), foco campos (`L967, L984`) e botão `Salvar Alterações` (`L1008`). Preservar KPIs, avatares, badges semânticos, `<TagBadge>` e backdrop.
- `EmployeesManager.tsx`: botões primários (`L235, L581, L765`), foco campos (`L257, L473, L492, L511, L648, L684, L743`), cartões radio selecionados + check (`L535, L556, L707, L720`), botão destrutivo (`L834`: `bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700`). Preservar `ROLE_METADATA`, avatares e backdrops.
- `EmployeesPage.tsx`: spinner (`L36`: `border-t-brand-accent dark:border-t-slate-800`).

- [ ] **Step 3: Migrar Módulo Localizador (`PhoneFinder*`)**

- `PhoneFinderPage.tsx`: ícone cabeçalho (`L607`), botões primários (`L672, L796`), pílula de filtro ativo (`L707`: `bg-brand-accent text-brand-accent-foreground border-brand-accent dark:bg-white dark:text-slate-900 dark:border-white`), foco busca (`L740`), spinner (`L759`), botão destrutivo `Sim, excluir` (`L1020`: `bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700`). Preservar status WebSocket, dots de filtro, botão `amber` desvincular e backdrops.
- `PhoneCardTile.tsx`: botão `Parear Dispositivo` (`L328`). **NÃO TOCAR** no botão semântico `Localizar` (`L340`), presença, bateria nem badge `Push ativo`.
- `PhoneCardFormModal.tsx`: ícone modal (`L85`), foco campos (`L143, L165`), botão submit (`L182`).
- `PairingCodeModal.tsx`: ícone modal (`L180`), spinner (`L228`), barra de progresso normal (`L310`), botão `Gerar novo código` (`L342`).
- `AppDownloadModal.tsx`: ícone modal (`L78`), botão `Baixar APK` (`L158`). **NÃO TOCAR** em `<QRCodeSVG>` (`L107-113`).

- [ ] **Step 4: Verificar compilação TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/TechnicianPage.tsx src/components/dashboard/TechnicianKanbanBoard.tsx src/components/TechnicianDashboardClient.tsx src/components/ReportCardMinimized.tsx src/components/ClientsManager.tsx src/pages/ClientsPage.tsx src/pages/ClientProfilePage.tsx src/components/EmployeesManager.tsx src/pages/EmployeesPage.tsx src/pages/PhoneFinderPage.tsx src/components/phoneFinder/PhoneCardTile.tsx src/components/phoneFinder/PhoneCardFormModal.tsx src/components/phoneFinder/PairingCodeModal.tsx src/components/phoneFinder/AppDownloadModal.tsx
git commit -m "feat(theme): migrar painel tecnico, kanban, clientes, funcionarios e localizador"
```

---

### Task 6: Auditoria Automatizada (Estática + Playwright Light/Dark), Build de Produção e Homologação em `localhost`

**Files:**
- Create: `scripts/test-theme-migration-audit.ts`

**Interfaces:**
- Consumes: Toda a aplicação compilada + servidor local `http://localhost:3000` (`npm run dev`).
- Produces: Evidência automatizada de conformidade + servidor `localhost` ativo e pronto para homologação pessoal do usuário.

- [ ] **Step 1: Criar e rodar auditoria estática + Playwright (`scripts/test-theme-migration-audit.ts`)**

O script deve verificar:
1. **Auditoria estática:**
   - Nenhum modal backdrop (`fixed inset-0 ... bg-brand-accent`) foi contaminado em `src/`.
   - Nenhum uso direto restante de `<RelixLogo` em `Sidebar.tsx`, `LoginPage.tsx` ou `DashboardHeader.tsx`.
   - `PhoneCardTile.tsx` mantém botão `Localizar` em `bg-rose-600`; `WorkLogForm.tsx` mantém `tag.color` e `cat.color`; `SettingsPage.tsx` mantém `PRESET_COLORS` e `<CategoryIconPicker accentColor={catColor}`.
   - Todos os arquivos com `bg-brand-danger` ou `bg-brand-action-blue` possuem `dark:bg-*` explícito na mesma linha.
2. **Auditoria Playwright em navegador real contra `http://localhost:3000`** (modo `--live` opcional ou executado após subir o dev server):
   - Na tela de `/login` (sem precisar de seed especial) e, se credenciais de seed funcionarem, em `/dashboard`, `/dashboard/atendimentos`, `/dashboard/tecnico`, `/dashboard/clientes` e `/dashboard/configuracoes`:
     - Em **light + `default`**: botão primário tem `background-color: rgb(15, 23, 42)` (`#0f172a`).
     - Em **light + `relix`**: botão primário e item ativo da sidebar têm `background-color: rgb(225, 29, 72)` (`#e11d48`), card selecionado tem borda `rgb(225, 29, 72)` e `TagBadge` mantém sua cor personalizada intacta.
     - Após `page.reload()` (F5): `document.documentElement.dataset.brandTheme === "relix"` já está presente imediatamente (anti-FOUC).
     - Em **dark + `default` vs dark + `relix`**: estilos computados de fundo, sidebar ativa, botões primários e inputs são **100% idênticos** entre os dois temas!

- [ ] **Step 2: Garantir dependências instaladas, rodar todos os testes e compilar produção**

```powershell
npm install --no-audit --no-fund # apenas se node_modules estiver incompleto
npx tsx scripts/test-brand-theme-foundation.ts
npx tsx scripts/test-theme-settings-ui.ts
npx tsx scripts/test-web-spa-rebranding.ts
npx tsx scripts/test-theme-migration-audit.ts
npx tsc --noEmit
npm run build
```
Expected: Todos os scripts PASS, `tsc` 0 erros e `vite build` concluído sem erros.

- [ ] **Step 3: Commit da auditoria**

```powershell
git add scripts/test-theme-migration-audit.ts
git commit -m "test(theme): adicionar auditoria estatica e verificacao Playwright light/dark"
```

- [ ] **Step 4: Subir `localhost` (`npm run dev`) e rodar auditoria Playwright ao vivo**

- Iniciar `npm run dev` em background (daemon) na porta 3000 (frontend) + 4000 (backend).
- Rodar `npx tsx scripts/test-theme-migration-audit.ts --live` contra `http://localhost:3000` para validar estilos computados reais.
- **PARAR para homologação pessoal do usuário** apresentando a URL `http://localhost:3000`, o resumo das verificações executadas e aguardando feedback/ajustes antes de abrir PR, aprovar e fazer merge.
