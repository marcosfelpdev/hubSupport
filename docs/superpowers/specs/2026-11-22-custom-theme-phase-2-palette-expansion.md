# Design Doc: Expansão de Temas Relix — Fase 2 (Cobalto, Esmeralda, Âmbar, Cyberpunk)

**Data:** 2026-11-22  
**Status:** Approved by User  
**Branch:** `feature/custom-theme-styling`  

---

## 1. Contexto & Objetivos

A Fase 1 estabeleceu a fundação de temas no Relix:
- Registry centralizado (`src/themes/themeRegistry.ts`)
- Script anti-FOUC em `<head>` (`index.html`)
- Tokens semânticos Tailwind v4 (`--brand-*` / `@theme inline`) em `src/styles/globals.css` escopados com `:not(.dark)`
- Componente dinâmico `<BrandLogo />`
- Aba "Aparência" em Configurações (`ThemeSettingsSection.tsx`)
- Migração de ~38 arquivos da SPA mantendo paridade 100% no dark mode e isolamento estrito de Tags, Categorias, Modais e KPIs.

Na Fase 2, expandimos o catálogo de 2 temas para **6 temas**:
1. `default`: **Padrão do Sistema** (slate/navy clássico, acentos sky/indigo)
2. `relix`: **Relix Carmim** (Carmim `#E11D48` / `rose-600`)
3. `relix-cobalt`: **Relix Cobalto** (Azul Royal `#2563EB` / `blue-600`)
4. `relix-emerald`: **Relix Esmeralda** (Verde Jade `#059669` / `emerald-600`)
5. `relix-amber`: **Relix Âmbar** (Laranja Solar `#D97706` / `amber-600`)
6. `relix-cyberpunk`: **Relix Cyberpunk** (Duo-tone Violeta `#6B42FF` + Ciano `#0891B2`, com realce primário da UI em **Ciano** conforme decisão do usuário)

---

## 2. Decisões do Usuário & Escopo

1. **Prioridade do Realce Cyberpunk:** No tema duo-tone Violeta/Ciano, o tom de realce primário da interface (botões, foco, sidebar ativa, cards selecionados) é o **Ciano** (`#0891B2` / `cyan-600`), enquanto o Violeta atua no colchete e detalhes da logo.
2. **Nomenclatura oficial dos temas:**
   - `relix-cobalt`: "Relix Cobalto"
   - `relix-emerald`: "Relix Esmeralda"
   - `relix-amber`: "Relix Âmbar"
   - `relix-cyberpunk`: "Relix Cyberpunk"
3. **Isolamento e Segurança:**
   - Preservação de 100% das cores de UI no **Modo Escuro** (`.dark`), mantendo paridade exata com o tema padrão. Apenas o `<BrandLogo />` adapta suas cores ao tema no dark mode.
   - Preservação estrita das cores personalizadas de Tags (`tag.color`), Categorias de Atendimento (`cat.color`, `PRESET_COLORS`), backdrops de modais, KPIs, avatares e botão semântico `Localizar`.

---

## 3. Especificação das Variações da Logo (`BrandLogo` / `RelixLogo`)

A logo vetorial em `src/components/common/RelixLogo.tsx` é parametrizável pelo `logoId`:
- `relix-crimson`: Colchete neutro (branco no dark, navy no light), Ribbon carmim `#DE1D4B`, perna do X carmim.
- `relix-cobalt`: Colchete neutro, Ribbon azul cobalto `#2563EB` (gradiente `#1D4ED8` -> `#2563EB`), perna do X azul `#2563EB`.
- `relix-emerald`: Colchete neutro, Ribbon verde esmeralda `#059669` (gradiente `#047857` -> `#059669`), perna do X verde `#059669`.
- `relix-amber`: Colchete neutro, Ribbon âmbar `#D97706` (gradiente `#B45309` -> `#D97706`), perna do X âmbar `#D97706`.
- `relix-cyberpunk`:
  - Dark: Colchete Violeta `#6B42FF`, Ribbon Ciano `#06B6D4` (gradiente `#0891B2` -> `#22D3EE`), perna do X Ciano `#22D3EE`.
  - Light: Colchete Violeta `#684ECB`, Ribbon Ciano `#0891B2`, perna do X Violeta `#684ECB`.
  - App Icon: fundo Violeta `#6B42FF` com símbolo ciano/branco.

---

## 4. Mapeamento de Tokens CSS (`src/styles/globals.css`)

Todos os novos blocos são estritamente condicionados a `:not(.dark)`:

```css
:root[data-brand-theme="relix-cobalt"]:not(.dark) {
  --brand-accent: #2563eb;
  --brand-accent-hover: #1d4ed8;
  --brand-accent-foreground: #ffffff;
  --brand-accent-soft: #eff6ff;
  --brand-accent-soft-hover: #dbeafe;
  --brand-accent-border: #93c5fd;
  --brand-accent-text: #1e40af;
  --brand-focus-border: #2563eb;
  --brand-focus-ring: rgba(37, 99, 235, 0.35);
  --brand-card-selected-bg: rgba(239, 246, 255, 0.45);
  --brand-card-selected-bg-hover: rgba(219, 234, 254, 0.52);
  --brand-card-selected-border: #2563eb;
  --brand-card-selected-ring: rgba(37, 99, 235, 0.35);
  --brand-card-selected-shadow: rgba(37, 99, 235, 0.14);
  --brand-card-selected-pill: #2563eb;
  --brand-recorder-bg: rgba(37, 99, 235, 0.08);
  --brand-recorder-bg-hover: rgba(37, 99, 235, 0.14);
  --brand-recorder-text: #2563eb;
  --brand-recorder-border: rgba(37, 99, 235, 0.32);
  --brand-highlight-bg: rgba(239, 246, 255, 0.75);
  --brand-highlight-bg-soft: rgba(239, 246, 255, 0.5);
  --brand-highlight-border: #60a5fa;
  --brand-highlight-text: #1d4ed8;
  --brand-highlight-dot: #2563eb;
  --brand-danger: #e11d48;
  --brand-danger-hover: #be123c;
}

:root[data-brand-theme="relix-emerald"]:not(.dark) {
  --brand-accent: #059669;
  --brand-accent-hover: #047857;
  --brand-accent-foreground: #ffffff;
  --brand-accent-soft: #ecfdf5;
  --brand-accent-soft-hover: #d1fae5;
  --brand-accent-border: #6ee7b7;
  --brand-accent-text: #065f46;
  --brand-focus-border: #059669;
  --brand-focus-ring: rgba(5, 150, 105, 0.35);
  --brand-card-selected-bg: rgba(236, 253, 245, 0.45);
  --brand-card-selected-bg-hover: rgba(209, 250, 229, 0.52);
  --brand-card-selected-border: #059669;
  --brand-card-selected-ring: rgba(5, 150, 105, 0.35);
  --brand-card-selected-shadow: rgba(5, 150, 105, 0.14);
  --brand-card-selected-pill: #059669;
  --brand-recorder-bg: rgba(5, 150, 105, 0.08);
  --brand-recorder-bg-hover: rgba(5, 150, 105, 0.14);
  --brand-recorder-text: #059669;
  --brand-recorder-border: rgba(5, 150, 105, 0.32);
  --brand-highlight-bg: rgba(236, 253, 245, 0.75);
  --brand-highlight-bg-soft: rgba(236, 253, 245, 0.5);
  --brand-highlight-border: #34d399;
  --brand-highlight-text: #047857;
  --brand-highlight-dot: #059669;
  --brand-danger: #e11d48;
  --brand-danger-hover: #be123c;
}

:root[data-brand-theme="relix-amber"]:not(.dark) {
  --brand-accent: #d97706;
  --brand-accent-hover: #b45309;
  --brand-accent-foreground: #ffffff;
  --brand-accent-soft: #fffbeb;
  --brand-accent-soft-hover: #fef3c7;
  --brand-accent-border: #fcd34d;
  --brand-accent-text: #92400e;
  --brand-focus-border: #d97706;
  --brand-focus-ring: rgba(217, 119, 6, 0.35);
  --brand-card-selected-bg: rgba(255, 251, 235, 0.45);
  --brand-card-selected-bg-hover: rgba(254, 243, 199, 0.52);
  --brand-card-selected-border: #d97706;
  --brand-card-selected-ring: rgba(217, 119, 6, 0.35);
  --brand-card-selected-shadow: rgba(217, 119, 6, 0.14);
  --brand-card-selected-pill: #d97706;
  --brand-recorder-bg: rgba(217, 119, 6, 0.08);
  --brand-recorder-bg-hover: rgba(217, 119, 6, 0.14);
  --brand-recorder-text: #d97706;
  --brand-recorder-border: rgba(217, 119, 6, 0.32);
  --brand-highlight-bg: rgba(255, 251, 235, 0.75);
  --brand-highlight-bg-soft: rgba(255, 251, 235, 0.5);
  --brand-highlight-border: #fbbf24;
  --brand-highlight-text: #b45309;
  --brand-highlight-dot: #d97706;
  --brand-danger: #e11d48;
  --brand-danger-hover: #be123c;
}

:root[data-brand-theme="relix-cyberpunk"]:not(.dark) {
  --brand-accent: #0891b2;
  --brand-accent-hover: #0e7490;
  --brand-accent-foreground: #ffffff;
  --brand-accent-soft: #ecfeff;
  --brand-accent-soft-hover: #cffafe;
  --brand-accent-border: #67e8f9;
  --brand-accent-text: #155e75;
  --brand-focus-border: #0891b2;
  --brand-focus-ring: rgba(8, 145, 178, 0.35);
  --brand-card-selected-bg: rgba(236, 254, 255, 0.45);
  --brand-card-selected-bg-hover: rgba(207, 250, 254, 0.52);
  --brand-card-selected-border: #0891b2;
  --brand-card-selected-ring: rgba(8, 145, 178, 0.35);
  --brand-card-selected-shadow: rgba(8, 145, 178, 0.14);
  --brand-card-selected-pill: #0891b2;
  --brand-recorder-bg: rgba(8, 145, 178, 0.08);
  --brand-recorder-bg-hover: rgba(8, 145, 178, 0.14);
  --brand-recorder-text: #0891b2;
  --brand-recorder-border: rgba(8, 145, 178, 0.32);
  --brand-highlight-bg: rgba(236, 254, 255, 0.75);
  --brand-highlight-bg-soft: rgba(236, 254, 255, 0.5);
  --brand-highlight-border: #22d3ee;
  --brand-highlight-text: #0e7490;
  --brand-highlight-dot: #0891b2;
  --brand-danger: #e11d48;
  --brand-danger-hover: #be123c;
}
```

---

## 5. Estratégia de Verificação e Homologação

1. **Testes Unitários e de Fundação:**
   - Atualizar `scripts/test-brand-theme-foundation.ts` para verificar os 6 temas, seus metadados, validação de IDs e whitelist do `index.html`.
2. **Testes de UI e BrandLogo:**
   - Atualizar `scripts/test-theme-settings-ui.ts` para validar a renderização das 6 opções com seus previews e logos.
3. **Auditoria Estática & Playwright Live:**
   - Atualizar `scripts/test-theme-migration-audit.ts` para testar a comutação entre todos os temas e a paridade absoluta em modo escuro.
4. **Homologação Local:**
   - Testar ao vivo no dev server (`http://localhost:3000`) alternando entre os 6 temas em tempo real.
