# Expansão de Temas Relix — Fase 2 (Cobalto, Esmeralda, Âmbar, Cyberpunk) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir a personalização de temas do Relix de 2 para 6 temas, adicionando as 4 novas variações de logo e paleta cromática enviadas pelo usuário (Relix Cobalto, Relix Esmeralda, Relix Âmbar e Relix Cyberpunk duo-tone com realce primário Ciano).

**Architecture:** Aproveita a infraestrutura já consolidada na Fase 1 (Tailwind v4 `@theme inline`, registry centralizado em `themeRegistry.ts`, anti-FOUC em `index.html` e `<BrandLogo />`), estendendo o `RelixLogo.tsx` com variações de cores fiéis aos designs vetoriais (light e dark), definindo os 4 novos blocos de tokens CSS escopados com `:not(.dark)` e atualizando as suítes de teste estático e Playwright `--live`.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS v4, Vite 8, Node.js / Express 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-22-custom-theme-phase-2-palette-expansion.md`

## Global Constraints

- **Modo escuro 100% intocado nas cores de UI:** Todas as cores de interface em `.dark` (body, cards, botões, sidebar ativa, inputs) devem permanecer **estritamente idênticas** em todos os 6 temas. Apenas a logo `<BrandLogo />` acompanha a variante de cor no dark mode.
- **Tema padrão (`default`) = paridade exata com produção:** `#0F172A` e acentos slate/sky/indigo.
- **Realce primário do tema Cyberpunk:** Ciano (`#0891B2` / `cyan-600`) para botões, itens em foco e sidebar ativa; Violeta (`#6B42FF` / `#684ECB`) na logo e detalhes de preview.
- **Isolamento estrito de Tags e Categorias:** NUNCA alterar `<TagBadge>`, `tag.color`, `cat.color`, `PRESET_COLORS`, nem `<CategoryIconPicker>`.
- **Isolamento de elementos semânticos e backdrops:** Manter backdrops de modal (`bg-slate-900/40`, `bg-slate-900/60`, `bg-slate-950/60`), botão `Localizar` (`bg-rose-600`), `<QRCodeSVG>`, KPIs, avatares e status pills.
- **NUNCA tocar em `docs/specs/LOCALIZADOR_MOBILE_SPEC_V2.md`** nem rodar `git add .` / `git add -A`.

## Review Focus

1. **Anti-FOUC imediato em todos os 5 temas Relix:** A whitelist do script inline em `index.html` deve conter todos os temas para evitar flash de estilo no F5.
2. **Exaustividade de tipos em `themeRegistry.ts` e `BrandLogo.tsx`:** Garantir que o TypeScript force verificação em tempo de compilação com `const _exhaustive: never = themeDef.logoId;`.
3. **Escopo estrito de tokens CSS:** Todos os 4 novos blocos em `src/styles/globals.css` devem usar `:root[data-brand-theme="..."]:not(.dark)` para blindar completamente o modo escuro.
4. **Contraste de botões de perigo (`--brand-danger`):** Em temas azuis, verdes, âmbar e ciano, o botão destrutivo deve usar vermelho/rose (`#e11d48`) para manter semântica e contraste impecáveis.
5. **Pré-visualizações fiéis na aba "Aparência":** Cada um dos 6 cards em `ThemeSettingsSection.tsx` deve exibir miniatura, cores hexadecimais e badge correspondentes.

---

### Task 1: Expansão do Theme Registry, Anti-FOUC e Tokens CSS dos 4 Novos Temas

**Files:**
- Modify: `src/themes/themeRegistry.ts`
- Modify: `index.html:26-30`
- Modify: `src/styles/globals.css`
- Test: `scripts/test-brand-theme-foundation.ts`

**Interfaces:**
- Produces: 6 temas registrados (`default`, `relix`, `relix-cobalt`, `relix-emerald`, `relix-amber`, `relix-cyberpunk`), whitelist atualizada em `index.html` e blocos de tokens CSS prontos em `globals.css`.

- [ ] **Step 1: Atualizar testes de fundação com os 6 temas**
  - Em `scripts/test-brand-theme-foundation.ts`, atualizar as asserções para esperar exatamente os 6 IDs de tema (`['default', 'relix', 'relix-cobalt', 'relix-emerald', 'relix-amber', 'relix-cyberpunk']`), checar a whitelist em `index.html` e verificar os 4 novos blocos de CSS `:root[data-brand-theme="..."]:not(.dark)`.
  - Executar: `npx tsx scripts/test-brand-theme-foundation.ts` (deve falhar nas novas asserções - RED).

- [ ] **Step 2: Atualizar `src/themes/themeRegistry.ts`**
  - Expandir `BrandThemeId` para `"default" | "relix" | "relix-cobalt" | "relix-emerald" | "relix-amber" | "relix-cyberpunk"`.
  - Expandir `BrandLogoId` para `"relix-crimson" | "relix-cobalt" | "relix-emerald" | "relix-amber" | "relix-cyberpunk"`.
  - Adicionar as 4 novas definições completas em `BRAND_THEMES` com nomes ("Relix Cobalto", "Relix Esmeralda", "Relix Âmbar", "Relix Cyberpunk"), descrições, badges e metadados de preview.

- [ ] **Step 3: Atualizar whitelist anti-FOUC em `index.html`**
  - Atualizar a lista de temas válidos no script inline do `<head>` para `["relix", "relix-cobalt", "relix-emerald", "relix-amber", "relix-cyberpunk"]`.

- [ ] **Step 4: Adicionar os 4 blocos de tokens CSS em `src/styles/globals.css`**
  - Adicionar os blocos para `relix-cobalt`, `relix-emerald`, `relix-amber` e `relix-cyberpunk`, todos com seletor `:root[data-brand-theme="..."]:not(.dark)`.
  - Manter a regra de colapso `:root:where([data-brand-theme]:not([data-brand-theme="default"])):not(.dark)`.

- [ ] **Step 5: Executar testes de fundação e compilação**
  - Executar: `npx tsx scripts/test-brand-theme-foundation.ts` (deve passar - GREEN).
  - Executar: `npx tsc --noEmit`.

- [ ] **Step 6: Commit da Task 1**
  ```powershell
  git add src/themes/themeRegistry.ts index.html src/styles/globals.css scripts/test-brand-theme-foundation.ts
  git commit -m "feat(theme): registrar novos temas cobalto, esmeralda, ambar e cyberpunk com tokens e anti-FOUC"
  ```

---

### Task 2: Renderização Multivariante das Logos Relix (`RelixLogo` & `BrandLogo`) e UI de Configurações

**Files:**
- Modify: `src/components/common/RelixLogo.tsx`
- Modify: `src/components/common/BrandLogo.tsx`
- Test: `scripts/test-theme-settings-ui.ts`

**Interfaces:**
- Consumes: `BrandLogoId` de `src/themes/themeRegistry.ts`.
- Produces: Renderização vetorial precisa das 5 logos da Relix nos modos light e dark, e exibição dos 6 temas na aba "Aparência".

- [x] **Step 1: Atualizar testes de UI e BrandLogo**
  - Em `scripts/test-theme-settings-ui.ts`, adicionar asserções para renderização das novas logos (`relix-cobalt`, `relix-emerald`, `relix-amber`, `relix-cyberpunk`), checagem dos 6 temas renderizados na aba "Aparência" e seus códigos hexadecimais.
  - Executar: `npx tsx scripts/test-theme-settings-ui.ts` (deve falhar nas novas asserções - RED).

- [x] **Step 2: Parametrizar variantes de cores em `src/components/common/RelixLogo.tsx`**
  - Adicionar suporte à prop opcional `logoId?: BrandLogoId` (default: `"relix-crimson"`).
  - Mapear para cada `logoId`:
    - Gradiente da ribbon principal (`mainGradColorStart`, `mainGradColorEnd`)
    - Gradiente da dobra 3D (`foldGradColorStart`, `foldGradColorEnd`)
    - Cor do colchete externo no light e no dark (`bracketColorLight`, `bracketColorDark`)
    - Cor da perna colorida do "x" no light e no dark (`xStrokeColorLight`, `xStrokeColorDark`)
    - Cor de fundo do app-icon (`appIconBgColor`)
  - No caso do `relix-cyberpunk`: colchete violeta (`#684ECB` no light, `#6B42FF` no dark), ribbon ciano (`#0891B2` -> `#06B6D4` / `#22D3EE`), perna do x violeta no light e ciano no dark.

- [x] **Step 3: Conectar os novos `logoId`s em `src/components/common/BrandLogo.tsx`**
  - No `switch (themeDef.logoId)` em `BrandLogoByThemeId`, adicionar os cases `"relix-cobalt"`, `"relix-emerald"`, `"relix-amber"`, `"relix-cyberpunk"` passando `logoId={themeDef.logoId}` para o `RelixLogo`.
  - Manter o bloco `default:` exaustivo com `const _exhaustive: never = themeDef.logoId;`.

- [x] **Step 4: Executar testes de UI e compilação**
  - Executar: `npx tsx scripts/test-theme-settings-ui.ts` (GREEN).
  - Executar: `npx tsc --noEmit`.

- [x] **Step 5: Commit da Task 2**
  ```powershell
  git add src/components/common/RelixLogo.tsx src/components/common/BrandLogo.tsx scripts/test-theme-settings-ui.ts
  git commit -m "feat(logo): implementar variantes vetoriais das logos cobalto, esmeralda, ambar e cyberpunk"
  ```

---

### Task 3: Atualização da Auditoria E2E Playwright, Build de Produção e Homologação em `localhost`

**Files:**
- Modify: `scripts/test-theme-migration-audit.ts`

**Interfaces:**
- Consumes: Toda a SPA com os 6 temas + dev server em `http://localhost:3000`.
- Produces: Validação automatizada completa de todos os 6 temas no modo claro, persistência anti-FOUC e paridade estrita de modo escuro entre todos eles.

- [x] **Step 1: Atualizar auditoria estática e Playwright em `scripts/test-theme-migration-audit.ts`**
  - No Modo 1: validar que todos os 5 temas Relix definem `:not(.dark)` e declaram seus tokens semânticos.
  - No Modo 2 (`--live`):
    - Em `/dashboard/configuracoes`: validar que os 6 temas aparecem na grade de temas;
    - Clicar sucessivamente em cada um dos novos temas (`relix-cobalt`, `relix-emerald`, `relix-amber`, `relix-cyberpunk`), verificar que `dataset.brandTheme` é aplicado, o botão primário e link da sidebar adotam a respectiva cor de realce (Azul `#2563EB`, Verde `#059669`, Âmbar `#D97706` e Ciano `#0891B2`), e que o recarregamento (F5) preserva a seleção imediatamente.
    - Em modo escuro (`.dark`), verificar que a comparação de estilos computados entre `default` e **todos** os novos temas permanece estritamente idêntica!

- [x] **Step 2: Rodar toda a suíte de verificações offline e build**
  ```powershell
  npx tsx scripts/test-brand-theme-foundation.ts
  npx tsx scripts/test-theme-settings-ui.ts
  npx tsx scripts/test-web-spa-rebranding.ts
  npx tsx scripts/test-theme-migration-audit.ts
  npx tsc --noEmit
  npx vite build
  ```

- [x] **Step 3: Commit da auditoria**
  ```powershell
  git add scripts/test-theme-migration-audit.ts
  git commit -m "test(theme): expandir auditoria estatica e Playwright live para os 6 temas da plataforma"
  ```

- [x] **Step 4: Executar auditoria Playwright ao vivo contra o dev server**
  - Executar: `npx tsx scripts/test-theme-migration-audit.ts --live` contra `http://localhost:3000`.
  - Confirmar 100% de aprovação em todos os blocos.

- [ ] **Step 5: Parar para homologação pessoal do usuário em `http://localhost:3000`**
  - Apresentar a interface pronta com os 6 temas para teste manual do usuário antes de qualquer push/PR/merge.
