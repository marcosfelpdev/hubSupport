# Design Doc: Estilização Personalizada e Sistema Multi-Tema (Relix)

**Data:** 21/11/2026  
**Status:** Proposto para Aprovação  
**Escopo:** Projeto completo — Fase 1 (Arquitetura multi-tema + Tema Padrão + Tema Relix Carmim `#E11D48`; preparado para receber variações de cores da logo Relix nas próximas entregas)

---

## 1. Propósito e Contexto (Intent & Why)

Após o rebranding visual da plataforma de **HubSupport** para **Relix** (identidade em branco, dark navy `#121A2D` e carmim/rose `#E11D48` / `#DE1D4B`), os pontos de realce interativos no modo claro continuam usando a paleta neutra/azulada original (`slate-900`, `sky-500` em cards selecionados e `indigo` em botões secundários).

O objetivo é introduzir um **sistema de personalização de tema individual por usuário**, acessível na página de **Configurações**, começando com dois temas no **modo claro**:
1. **Padrão do Sistema (Atual):** preserva com fidelidade de pixel a aparência atual da plataforma.
2. **Relix Carmim (`#E11D48` / `rose-600`):** adapta os pontos de realce da interface (sidebar ativa, botões primários, botão de gravação de tela inativo, dia selecionado na agenda, toggles segmentados, ícones de cabeçalho/modais, inputs em foco, borda/iluminação de cards selecionados, abas ativas e loaders) para a cor de destaque da logo Relix.

A arquitetura também prepara o sistema para a etapa seguinte, quando o usuário enviará **outras variações de cores da própria logo Relix** (todas mantendo o nome "Relix" e possuindo versão própria para modo claro e modo escuro). Trocar de tema passa a trocar simultaneamente a **paleta de realces no modo claro** e a **variação da logo exibida** (tanto no modo claro quanto no modo escuro), sem precisar editar novamente os componentes da aplicação.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos (Goals)
- Criar um registro tipado de temas em `src/themes/themeRegistry.ts` centralizando metadados, prévia visual, paleta de destaque e identificador de variação da logo (`logoId`).
- Estender `src/contexts/ThemeContext.tsx` para gerenciar `brandTheme: BrandThemeId` de forma individual por usuário em `localStorage`, mantendo 100% compatível o controle existente de `theme: "light" | "dark"` (`hubsupport_theme`).
- Criar o componente `src/components/common/BrandLogo.tsx` (lendo `brandTheme` do contexto ou uma prop opcional `themeId` para pré-visualizações), delegando para `RelixLogo` nesta etapa e desacoplado por `logoId` para suportar múltiplas variações de cores da logo Relix (com versões light e dark) nas próximas entregas. Substituir o uso direto de `RelixLogo` em `Sidebar.tsx`, `LoginPage.tsx` e `DashboardHeader.tsx`.
- Definir tokens CSS semânticos via Tailwind CSS v4 (`@theme inline`) em `src/styles/globals.css`, com garantia estrutural de:
  - **Paridade visual total no tema `default` (modo claro)**;
  - **Sobrescritas estritamente no modo claro** (`:root[data-brand-theme="..."]:not(.dark)`);
  - **Zero impacto nas cores de UI do modo escuro** (`.dark`).
- Migrar cirurgicamente os pontos de realce interativos no modo claro nos componentes da SPA para utilitários semânticos `brand-*`, preservando todas as classes `dark:*`.
- Adicionar a nova aba **Aparência** em `src/pages/SettingsPage.tsx` (visível para todos os cargos), renderizando `src/components/settings/ThemeSettingsSection.tsx` com cartões interativos de pré-visualização e troca instantânea.
- Adicionar script síncrono mínimo anti-FOUC no `<head>` de `index.html` para aplicar `.dark` e `data-brand-theme` antes do mount do React.

### Não-Objetivos (Non-Goals)
- **Não alterar cores de interface no modo escuro (`dark`):** fundos, bordas, botões, inputs e brilhos do modo escuro permanecem 100% idênticos aos atuais. *(Apenas o `<BrandLogo />` acompanha a variação da logo do tema selecionado, usando sua respectiva versão dark).*
- **Não persistir tema no banco de dados (`prisma/schema.prisma`) nem criar endpoints REST:** a preferência é individual e local no navegador (`localStorage`), alinhada ao modo claro/escuro atual.
- **Não tornar o nome da marca, `<title>` ou textos de login dinâmicos:** todas as futuras logos são variações de cor da própria marca **Relix**.
- **Não criar ainda as logos adicionais** (serão adicionadas na etapa seguinte a partir dos arquivos enviados pelo usuário).
- **Não alterar o app Android (`Relix Mobile`) nem a geração de PDFs (`src/lib/pdf-generator.ts`).**

### Anti-Objetivos (Anti-Goals)
- **Nunca afetar cores personalizadas de Categorias de Atendimento ou Tags:** `TagBadge`, paleta `PRESET_COLORS`, `<input type="color">`, `<CategoryIconPicker accentColor={catColor} />`, pílulas selecionadas de tags e cartões selecionados de categoria em `WorkLogForm.tsx`, ícones/badges de categoria em `ReportCardMinimized.tsx`, `WorkLogDetailContent.tsx`, `TechnicianKanbanBoard.tsx` e `SettingsPage.tsx` devem continuar respeitando exclusivamente o hexadecimal configurado pelo usuário/admin.
- **Nunca alterar elementos semânticos ou estritamente informativos/categóricos:** badges de status (`Solucionado` verde, `Pendência` âmbar, `Validação` roxo, `Em progresso` azul-céu, `Backlog` índigo), cores das 5 colunas do Kanban, KPIs do Dashboard (`DashboardOverviewPage.tsx`), pills categóricos de contagem (`Atendimentos` vs `Reuniões` em `ClientsManager.tsx`), avatares de usuário/gestor/cliente, badges de cargo (`Admin`, `Equipe Técnica`), indicador de gravação ativa (vermelho pulsante), ícone `Sparkles` de IA e alertas de erro/sucesso.
- **Nunca confundir botões primários `#E11D48` com botões destrutivos (exclusão):** botões de confirmação de exclusão devem se destacar visualmente dos botões primários quando o tema `#E11D48` estiver ativo.
- **Nunca alterar backdrops de modais** (`bg-slate-900/40`, `bg-slate-900/60`) ao migrar `bg-slate-900`.
- **Nunca quebrar a chave legada `hubsupport_theme` no `localStorage`** (usada por sessões existentes e scripts de QA).

---

## 3. Restrições e Contexto Técnico (Constraints)

- **Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`, sem `tailwind.config.*`), `lucide-react`.
- **Variante Dark no Tailwind v4:** `src/styles/globals.css` utiliza `@custom-variant dark (&:where(.dark, .dark *));`. Como `:where(...)` tem especificidade zero, as utilitárias `dark:*` continuam vencendo as utilitárias base `brand-*` pela ordem de camada do Tailwind v4. Como camada extra de segurança, todas as sobrescritas de tema usam `:not(.dark)`, tornando estruturalmente impossível o vazamento de tokens de cor para o modo escuro.
- **Preservação explícita de dark mode em componentes sem `dark:` hoje:** onde o componente hoje usa uma cor sem variante `dark:` (ex.: `ScreenRecorderButton.tsx` via `style` inline, botões `bg-blue-600` e checkboxes/spinner `blue-600` em `SettingsPage.tsx`, `EditWorkLogModal.tsx` e botão `Adicionar Nota` `bg-indigo-600` em `WorkLogDetailContent.tsx`), a migração deve manter o comportamento exato do modo escuro por meio de fallback em `:root` (pois `:not(.dark)` não ativa em `.dark`) ou adicionando a classe `dark:*` equivalente ao visual atual.
- **Verificação obrigatória:** `npx tsc --noEmit` e `npm run build` (`prisma generate && vite build`) com zero erros, seguidos de homologação pessoal pelo usuário em `localhost` antes de abrir PR e realizar merge.

---

## 4. Abordagens Consideradas (Approaches)

| Abordagem | Resumo | Trade-offs | Decisão |
|---|---|---|---|
| **1 — Tokens semânticos CSS (Tailwind v4 `@theme inline`) + Registry + `BrandLogo`** | Variáveis CSS semânticas no `globals.css` escopadas em `:not(.dark)`, registry tipado de temas/logos e migração cirúrgica dos pontos de realce. | Requer passada inicial nos componentes para substituir realces hardcoded; em contrapartida, adicionar novas variações da logo Relix exige editar apenas o registro + bloco CSS + variação da logo, com isolamento garantido de dark mode e Tags/Categorias. | **Escolhida pelo usuário** |
| **2 — Overrides globais CSS sobre classes Tailwind atuais** | Regras CSS sobrescrevendo `.bg-slate-900`, `.border-sky-500`, etc. | Frágil, vaza para elementos neutros/semânticos (colunas do Kanban, backdrops de modais), não cobre estilos inline (`ScreenRecorderButton`) e escala mal com vários temas. | Descartada |
| **3 — Classes condicionais via Hook React (`useTheme`)** | Cada componente alterna strings de classe Tailwind em JS conforme o tema ativo. | Obriga revisitar dezenas de arquivos a cada nova variação de logo e provoca re-render em cascata na troca de tema. | Descartada |

---

## 5. Decisões do Usuário vs. Escolhas do Designer

### Decisões explícitas do usuário
- Preferência de tema **individual por usuário** (todos os perfis têm acesso na aba de Configurações).
- **Logo muda junto com o tema**: todas as futuras logos serão **variações de cores da própria marca Relix** (nome "Relix" permanece fixo) e **todas possuirão versão própria em modo escuro** (então `<BrandLogo />` acompanha o tema tanto no claro quanto no escuro).
- **Cores de UI no modo escuro permanecem 100% intocadas** nesta etapa.
- Dois temas iniciais: **Padrão do Sistema (atual)** e **Relix Carmim (`#E11D48` / `rose-600`)**.
- Em **Categorias de Atendimento** e **Tags**: proteger apenas as **cores personalizadas, ícones e cards**; abas, botões estruturais e foco de inputs seguem o tema normalmente.
- **Homologação em `localhost`** obrigatória antes de abrir PR e fazer merge (com autorização prévia para abrir, aprovar e mergear PR após validação).

### Escolhas feitas pelo designer (para conferência durante a leitura)
1. **Persistência em `localStorage` (`relix_brand_theme`):** espelha `hubsupport_theme`, aplica o tema inclusive na tela de Login antes da autenticação e evita alterações no banco PostgreSQL.
2. **Paridade estrita no tema `default` com colapso automático para temas customizados:** em `:root`, preservamos os hexadecimais exatos de hoje (incluindo os botões legados `blue-600` em Categorias, `sky-600` em `EditWorkLogModal`, `indigo-600` em `Adicionar Nota` e o filtro ativo `sky` de `DateRangePopover`). Uma única regra compartilhada `:root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)` colapsa esses tokens legados automaticamente para os tokens centrais do tema ativo (`var(--brand-accent)`, `var(--brand-highlight-*)`). Assim, o tema `default` fica **100% fiel ao visual atual** e nenhum tema futuro precisa duplicar tokens legados.
3. **Fronteira explícita entre controles interativos vs. elementos informativos/categóricos (Seção 6):** mudam com o tema todos os controles interativos, containers sólidos de ícone de cabeçalho/modal e o estado selecionado de cards; permanecem fixos KPIs do Dashboard, pills de contagem categóricos (`Atendimentos`/`Reuniões`), avatares, badges de papel e cores semânticas de status/colunas.
4. **Contraste para ações destrutivas no tema Relix:** botões de confirmação de exclusão (`Confirmar Exclusão`, `Excluir Cliente`, `Excluir Funcionário`, `Excluir Card`) usam `--brand-danger` (`#e11d48` no `default` = `rose-600` atual; `#991b1b` / `red-800` profundo no tema `relix`), distinguindo claramente ações destrutivas do `#E11D48` vibrante dos botões primários, sem alterar o dark mode.
5. **Botão "Gravação de Tela" (estado inativo):** migrado do `style` inline hardcoded (`indigo`) para tokens `--brand-recorder-*`, preservando exatamente o tom índigo atual no `default` e no modo escuro, e aplicando tom suave carmim legível (`rgba(225,29,72,0.08)`, texto `#e11d48`, borda `rgba(225,29,72,0.32)`) no tema `relix` em modo claro. O estado de gravação ativa (vermelho pulsante) permanece intocado.
6. **Posição da aba em Configurações e aviso no modo escuro:** a nova aba **Aparência** aparece como primeira aba em `SettingsPage.tsx` (visível a todos os usuários), seguida por **Formato de Formulário (Tags Mestre)** e **Categorias de Atendimento (Admin)**. Quando o usuário estiver em modo escuro, um aviso discreto explica que no modo escuro apenas a variação da logo acompanha o tema enquanto as cores de realce da interface se aplicam ao modo claro, com botão rápido para alternar para o modo claro.

---

## 6. Referência Visual dos 7 Prints e Fronteira de Estilização

### 6.1. Mapeamento dos 7 Prints de Referência Enviados pelo Usuário
| Print | Elemento Visual | Estado Atual (Tema Padrão / Light) | Estado no Tema Relix (`#E11D48` / Light) |
|---|---|---|---|
| **1** | Item ativo na Sidebar (`Dashboard`, etc.) | Fundo `bg-slate-900`, texto e ícone brancos | Fundo `#E11D48` (`bg-brand-accent`), texto e ícone brancos |
| **2** | Botão primário (`+ Novo Atendimento`) | Fundo `bg-slate-900`, hover `bg-slate-800`, texto branco | Fundo `#E11D48`, hover `#BE123C`, texto branco |
| **3** | Dia selecionado no calendário da Agenda (`21`) | Quadrado arredondado `bg-slate-900`, texto branco | Quadrado arredondado `#E11D48`, texto branco |
| **4** | Barra de ações de Atendimentos (`+ Novo Atendimento` + `Gravação de Tela`) | Primário `slate-900` + secundário `Gravação de Tela` em índigo translúcido inline | Primário `#E11D48` + `Gravação de Tela` em carmim translúcido suave com borda e texto `#E11D48` |
| **5** | Card minimizado selecionado (`ReportCardMinimized`) | Borda `sky-500`, anel/iluminação `sky-400/40`, fundo `sky-50/30`, pill `Aberto` `bg-sky-500`; Tag (`Chat Trynux`), Categoria (âmbar), Sparkles e Status preservados | Borda `#E11D48`, anel/iluminação `rgba(225,29,72,0.35)`, fundo `rgba(255,241,242,0.45)`, pill `Aberto` `#E11D48`; Tag, Categoria, Sparkles e Status **100% preservados** |
| **6** | Toggle segmentado (`Quadro Kanban (Operações)` / `Lista Tradicional`) | Item ativo `bg-slate-900`, texto branco | Item ativo `#E11D48`, texto branco |
| **7** | Modal `Editar Cliente` | Container do ícone `bg-slate-900`, borda/anel de foco do input `slate-900`, botão `Salvar Alterações` `bg-slate-900` | Container do ícone `#E11D48`, foco do input `#E11D48` com anel suave carmim, botão `Salvar Alterações` `#E11D48` |

### 6.2. Regra Clara de Fronteira (O Que Muda vs. O Que Fica Fixo)
- **Muda com o tema (modo claro):**
  - Todos os **controles interativos**: item ativo da sidebar, botões primários de ação, botão `Gravação de Tela` inativo, toggles segmentados e pílulas de filtro ativas, dia selecionado/hoje/dots da agenda, abas ativas, cartões radio selecionados, foco de inputs/selects/combobox/editor inline, thumbnails ativas em galerias, barra de progresso de pareamento, destaque de dropzone drag-over, links interativos em hover/ação (`Marcar lidas`, hover de cliente na tabela, botão `Ocultar Ata` / `Detalhes`), checkboxes estruturais e loaders/spinners de carregamento.
  - **Containers de ícone de cabeçalho e modais** de entidades (`ClientsManager`, `PhoneFinderPage`, `PhoneCardFormModal`, `PairingCodeModal`, `AppDownloadModal`, `EditWorkLogModal`, `ClientProfilePage` modal de edição).
  - **Card selecionado e dropzone ativa do Kanban** (`ReportCardMinimized` selecionado/arrastando + pill `Aberto`, coluna em drag-over no `TechnicianKanbanBoard`).
- **NÃO muda com o tema:**
  - **Tags e Categorias de Atendimento personalizadas** (badges, ícones, previews, pickers de cor/ícone, pílulas/cards no `WorkLogForm` e filtros de categoria no Kanban).
  - **Elementos informativos, categóricos e semânticos**: KPIs do Dashboard (`DashboardOverviewPage`), pills de contagem categóricos (`Atendimentos` índigo vs `Reuniões` violeta em `ClientsManager`), avatares de usuário/gestor/cliente, badges de papel (`Admin`, `Equipe Técnica`), cores das 5 colunas do Kanban, ícones informativos de seções/banners (Agenda compartilhada, listas recentes, banner de categorias), badges de status, botão semântico `Localizar` no Localizador, indicador de gravação ativa, ícone `Sparkles` de IA e alertas de erro/sucesso.

---

## 7. Arquitetura Técnica Detalhada

### 7.1. Registro de Temas (`src/themes/themeRegistry.ts`)
```ts
export type BrandThemeId = "default" | "relix";
export type BrandLogoId = "relix-crimson";

export interface BrandThemePreview {
  accent: string;
  accentHover: string;
  softBg: string;
  cardBorder: string;
  cardBg: string;
  cardPill: string;
  recorderBg: string;
  recorderText: string;
}

export interface BrandThemeDefinition {
  id: BrandThemeId;
  name: string;
  badge: string;
  description: string;
  logoId: BrandLogoId;
  accentHex: string;
  preview: BrandThemePreview;
}
```
- Exporta `DEFAULT_BRAND_THEME_ID: BrandThemeId = "default"`, `BRAND_THEMES: readonly BrandThemeDefinition[]`, `isValidBrandThemeId(value: unknown): value is BrandThemeId` e `getBrandThemeById(id: BrandThemeId): BrandThemeDefinition`.
- Entradas iniciais:
  1. `default`: nome `"Padrão do Sistema"`, badge `"Clássico"`, `logoId: "relix-crimson"`, `accentHex: "#0F172A"`, descrição explicando a aparência clássica neutra da plataforma.
  2. `relix`: nome `"Relix Carmim"`, badge `"Logo Relix"`, `logoId: "relix-crimson"`, `accentHex: "#E11D48"`, descrição destacando os realces inspirados na cor carmim (`rose-600`) da logo Relix.
- Para adicionar uma nova variação de cor da logo Relix na Fase 2, basta: (1) registrar o novo `BrandThemeId` / `BrandLogoId` em `themeRegistry.ts`, (2) mapear o novo `logoId` em `BrandLogo.tsx` (com suas cores/assets light e dark) e (3) adicionar um bloco CSS `:root[data-brand-theme="<id>"]:not(.dark)` com ~10 tokens centrais em `globals.css`.

### 7.2. Abstração de Logo (`src/components/common/BrandLogo.tsx`)
- Props: `variant?: "full" | "symbol" | "app-icon"`, `mode?: "auto" | "light" | "dark"`, `height?: number`, `className?: string`, `themeId?: BrandThemeId` (opcional — quando omitido, consome `brandTheme` de `useTheme()`).
- **Comportamento em Dark Mode:** resolve sempre o `logoId` do `effectiveThemeId` escolhido (tanto no modo claro quanto no modo escuro), delegando o ajuste visual claro/escuro ao componente da logo (`mode="auto"` usa a variante light ou dark daquela logo).
- Nesta etapa, `"relix-crimson"` renderiza `<RelixLogo />` preservando integralmente o SVG existente.
- Substitui imports diretos de `RelixLogo` em `Sidebar.tsx`, `LoginPage.tsx` e `DashboardHeader.tsx`.

### 7.3. Contexto de Tema (`src/contexts/ThemeContext.tsx`) & Anti-FOUC (`index.html`)
- Mantém intactos: `theme: "light" | "dark"`, `setTheme`, `toggleTheme` e chave `THEME_STORAGE_KEY = "hubsupport_theme"`.
- Adiciona:
  - `BRAND_THEME_STORAGE_KEY = "relix_brand_theme"`.
  - `brandTheme: BrandThemeId`, `setBrandTheme: (id: BrandThemeId) => void`, `activeBrandTheme: BrandThemeDefinition`.
  - Sincroniza `document.documentElement.dataset.brandTheme`: define `data-brand-theme="<id>"` quando diferente de `"default"`, e remove o atributo quando `"default"`.
  - Persiste em `localStorage` com `try/catch` e validação via `isValidBrandThemeId`.
- `index.html`: script síncrono mínimo no `<head>` lendo `hubsupport_theme` (e fallback `prefers-color-scheme`) e `relix_brand_theme` (validado contra whitelist explícita `["relix"]`) para aplicar `.dark` e `data-brand-theme` antes da renderização do React, evitando flash visual ao recarregar.

### 7.4. Tokens Semânticos CSS (`src/styles/globals.css`)
1. **`:root` (Tema Padrão — paridade de pixel com o estado atual e fallback automático no `.dark`):**
   - Centrais:
     - `--brand-accent: #0f172a;`
     - `--brand-accent-hover: #1e293b;`
     - `--brand-accent-foreground: #ffffff;`
     - `--brand-accent-soft: #f1f5f9;`
     - `--brand-accent-soft-hover: #e2e8f0;`
     - `--brand-accent-border: #cbd5e1;`
     - `--brand-accent-text: #0f172a;`
   - Foco de inputs:
     - `--brand-focus-border: #0f172a;`
     - `--brand-focus-ring: #0f172a;`
   - Card selecionado / Dragging / Pill `"Aberto"`:
     - `--brand-card-selected-bg: rgba(240, 249, 255, 0.3);`
     - `--brand-card-selected-bg-hover: rgba(240, 249, 255, 0.4);`
     - `--brand-card-selected-border: #0ea5e9;`
     - `--brand-card-selected-ring: rgba(56, 189, 248, 0.4);`
     - `--brand-card-selected-shadow: rgba(14, 165, 233, 0.1);`
     - `--brand-card-selected-pill: #0ea5e9;`
   - Botão `Gravação de Tela` (inativo):
     - `--brand-recorder-bg: rgba(99, 102, 241, 0.08);`
     - `--brand-recorder-bg-hover: rgba(99, 102, 241, 0.14);`
     - `--brand-recorder-text: #a5b4fc;`
     - `--brand-recorder-border: rgba(99, 102, 241, 0.3);`
   - Destaques auxiliares (dia atual / dot na agenda, notificações não lidas, links ativos):
     - `--brand-highlight-bg: rgba(238, 242, 255, 0.6);`
     - `--brand-highlight-border: #818cf8;`
     - `--brand-highlight-text: #4338ca;`
     - `--brand-highlight-dot: #4f46e5;`
   - Botões/controles legados preservados fielmente no `default`:
     - `--brand-action-blue: #2563eb;` / `--brand-action-blue-hover: #1d4ed8;` / `--brand-focus-blue: #3b82f6;` *(Settings Categorias)*
     - `--brand-action-sky: #0284c7;` / `--brand-action-sky-hover: #0369a1;` / `--brand-focus-sky: #0ea5e9;` *(EditWorkLogModal)*
     - `--brand-action-indigo: #4f46e5;` / `--brand-action-indigo-hover: #4338ca;` / `--brand-focus-indigo: #6366f1;` *(Adicionar Nota / badges inline)*
     - `--brand-filter-bg: #f0f9ff;` / `--brand-filter-bg-hover: #e0f2fe;` / `--brand-filter-border: #7dd3fc;` / `--brand-filter-text: #075985;` *(DateRangePopover ativo)*
   - Ações destrutivas (exclusão):
     - `--brand-danger: #e11d48;`
     - `--brand-danger-hover: #be123c;`

2. **Regra compartilhada de colapso para qualquer tema customizado (`:root[data-brand-theme]:not([data-brand-theme="default"]):not(.dark)`):**
   - Colapsa automaticamente todos os tokens legados (`--brand-action-blue*`, `--brand-action-sky*`, `--brand-action-indigo*`, `--brand-focus-blue/sky/indigo`, `--brand-filter-*`) para os tokens centrais (`var(--brand-accent)`, `var(--brand-accent-hover)`, `var(--brand-focus-border)`, `var(--brand-highlight-*)`).

3. **Bloco do Tema Relix Carmim (`:root[data-brand-theme="relix"]:not(.dark)`):**
   - `--brand-accent: #e11d48;` / `--brand-accent-hover: #be123c;` / `--brand-accent-foreground: #ffffff;`
   - `--brand-accent-soft: #fff1f2;` / `--brand-accent-soft-hover: #ffe4e6;` / `--brand-accent-border: #fda4af;` / `--brand-accent-text: #be123c;`
   - `--brand-focus-border: #e11d48;` / `--brand-focus-ring: rgba(225, 29, 72, 0.35);`
   - `--brand-card-selected-bg: rgba(255, 241, 242, 0.45);` / `--brand-card-selected-bg-hover: rgba(255, 228, 230, 0.52);`
   - `--brand-card-selected-border: #e11d48;` / `--brand-card-selected-ring: rgba(225, 29, 72, 0.35);` / `--brand-card-selected-shadow: rgba(225, 29, 72, 0.14);` / `--brand-card-selected-pill: #e11d48;`
   - `--brand-recorder-bg: rgba(225, 29, 72, 0.08);` / `--brand-recorder-bg-hover: rgba(225, 29, 72, 0.14);` / `--brand-recorder-text: #e11d48;` / `--brand-recorder-border: rgba(225, 29, 72, 0.32);`
   - `--brand-highlight-bg: rgba(255, 241, 242, 0.75);` / `--brand-highlight-border: #fb7185;` / `--brand-highlight-text: #be123c;` / `--brand-highlight-dot: #e11d48;`
   - `--brand-danger: #991b1b;` / `--brand-danger-hover: #7f1d1d;`

4. **Integração Tailwind CSS v4 (`@theme inline`) e utilitárias existentes em `globals.css`:**
   - Expor os tokens como `--color-brand-*` no bloco `@theme inline` para habilitar classes nativas (`bg-brand-accent`, `hover:bg-brand-accent-hover`, `border-brand-focus`, `ring-brand-focus-ring`, `text-brand-highlight-text`, `bg-brand-danger`, etc.).
   - Atualizar `.btn-primary`, `.input-dark:focus`, `.spinner`, `.avatar` em `globals.css` para referenciar as CSS variables correspondentes (protegendo `.dark`).

### 7.5. Matriz de Migração de Componentes (Preservando 100% `dark:*`)
1. **Navegação, Auth & Notificações:**
   - `Sidebar.tsx`: `<BrandLogo />`, item ativo (`bg-brand-accent text-brand-accent-foreground dark:bg-white dark:text-slate-900`), ícone Lua no botão compacto claro (`text-brand-highlight-dot`).
   - `LoginPage.tsx`: `<BrandLogo />`, foco dos inputs, botão `Entrar`.
   - `NotificationBell.tsx`: badge de novas no header do dropdown, botão `Marcar lidas`, fundo/borda/dot de item não lido (preservando badge vermelho do sino e ícones semânticos por tipo).
   - `DashboardHeader.tsx`: `<BrandLogo />`.
2. **Dashboard, Agenda & Atendimentos:**
   - `DashboardOverviewPage.tsx`: botão `+ Novo Atendimento`, spinner (preservando os 4 cards KPI semânticos).
   - `DashboardClient.tsx`: botão `+ Novo Atendimento`, foco nos filtros (preservando backdrop do modal).
   - `ScreenRecorderButton.tsx`: botão inativo consumindo `--brand-recorder-*` (preservando estado gravando vermelho pulsante).
   - `BasicAgenda.tsx`: dia selecionado (`21`), indicador `isToday`, dot de evento, botões `+ Novo` / `Salvar`, link `+ Adicionar`, foco nos inputs/selects (preservando header/badge informativos).
   - `DateRangePopover.tsx`: botão gatilho ativo, preset selecionado, botão `Aplicar`, foco nos inputs de data (usando `--brand-filter-*` para paridade no `default`).
   - `RecentWorkLogsList.tsx` & `SolvedReportsList.tsx`: pílula de filtro ativo, foco na busca (preservando ícones e badges informativos de cabeçalho).
   - `WorkLogForm.tsx`, `ClientCombobox.tsx`, `InlineMediaEditor.tsx`: foco nos campos, dropzone drag-over, cursor de drop / badge `✓ No texto`, botão `Salvar Atendimento`. **100% protegidos:** pílulas de Tags (`tag.color`) e cards de Categorias (`cat.color`).
   - `EditWorkLogModal.tsx`: ícone de cabeçalho, foco em inputs/selects, botão `Salvar Alterações` (usando `--brand-action-sky*` / `--brand-focus-sky` com `dark:*` preservado).
   - `WorkLogDetailContent.tsx`: botões `Assumir Tarefa`, `Visualizar PDF` e `Adicionar Nota` (`--brand-action-indigo*` + `dark:bg-indigo-600 dark:hover:bg-indigo-700`), foco em nota/selects (preservando Tag, Categoria, Status, botão IA e ícones informativos de seções).
   - `ReportDetailsModal.tsx`, `PdfViewerModal.tsx`, `MediaGalleryModal.tsx`, `MeetingCompletionModal.tsx`: botões primários, thumbnails ativas, spinner, drag-over, foco (preservando backdrops e cabeçalhos informativos).
3. **Painel Técnico & Kanban:**
   - `TechnicianPage.tsx`: toggle segmentado (`Quadro Kanban (Operações)` / `Lista Tradicional`), spinner (preservando badge `Equipe Técnica`).
   - `TechnicianKanbanBoard.tsx`: foco dos filtros, dropzone drag-over e banner "Solte para mover" (preservando cores das 5 colunas e botões de filtro de categoria com `cat.color`).
   - `TechnicianDashboardClient.tsx`: foco dos filtros.
   - `ReportCardMinimized.tsx`: estado `isSelected` (borda, anel/iluminação, fundo e pill `Aberto`) e `isDragging` via `--brand-card-selected-*` (preservando `TagBadge`, ícone colorido da categoria, ícones de status e `Sparkles`).
4. **Clientes, Funcionários & Localizador:**
   - `ClientsManager.tsx` & `ClientProfilePage.tsx`: ícones sólidos de cabeçalho e modais (`Novo Cliente` / `Editar Cliente`), botões primários, foco em inputs/selects, hover de link do cliente, botão `Ocultar Ata` / `Detalhes`, botão destrutivo `Excluir` (`bg-brand-danger hover:bg-brand-danger-hover dark:bg-rose-600 dark:hover:bg-rose-700`) — preservando pills categóricos `Atendimentos`/`Reuniões`, avatares e backdrops.
   - `EmployeesManager.tsx` & `EmployeesPage.tsx`: botões primários, cartões radio de cargo selecionados (borda/check), foco em inputs, spinner, botão destrutivo (`bg-brand-danger`) — preservando badges/dots de cargo e backdrops.
   - `PhoneFinderPage.tsx`, `PhoneCardTile.tsx`, `PhoneCardFormModal.tsx`, `PairingCodeModal.tsx`, `AppDownloadModal.tsx`: ícones sólidos de cabeçalho/modais, pílulas de filtro ativo, botões primários (`Novo Card`, `Parear Dispositivo`, `Criar Card`, `Salvar Alterações`, `Baixar APK`, `Gerar novo código`), barra de progresso de pareamento, foco em inputs, botão destrutivo `Excluir Card` (`bg-brand-danger`) — preservando botão semântico `Localizar` e badges `Online`/`Offline`.
5. **Configurações (`SettingsPage.tsx` + `src/components/settings/ThemeSettingsSection.tsx`):**
   - Nova aba **Aparência** (`Palette` icon, pill `Temas`) como 1ª aba, acessível a todos os cargos.
   - Abas ativas usam `border-brand-accent text-brand-accent dark:border-white dark:text-white`.
   - Botões estruturais (`Nova Tag`, `Criar Tag`, `Nova Categoria` via `--brand-action-blue*` + `dark:bg-blue-600`, `Criar/Atualizar Categoria`), foco em inputs, checkboxes estruturais (`accent-brand-action-blue`) e spinners migram para tokens semânticos; confirmações de exclusão usam `bg-brand-danger`.
   - **Isolamento preservado:** `PRESET_COLORS`, `<input type="color">`, `TagBadge`, `<CategoryIconPicker accentColor={catColor} />`, prévia de card de Categoria, ícones de categoria na lista e badge `Admin` permanecem intocados.

### 7.6. UX da Seção "Aparência" (`src/components/settings/ThemeSettingsSection.tsx`)
- **Banner explicativo** no mesmo padrão visual das abas Tags e Categorias explicando personalização individual de tema e logo.
- **Aviso contextual em Dark Mode** (exibido somente quando `theme === "dark"`): informa que no modo escuro a variação da logo acompanha o tema escolhido, enquanto as cores de realce da interface são aplicadas no modo claro — com botão de ação rápida `"Alternar para Modo Claro"`.
- **Grade de Cartões de Tema (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)** populada dinamicamente a partir de `BRAND_THEMES`:
  - **Miniatura fiel em modo claro** (usando `t.preview.*` inline + `<BrandLogo themeId={t.id} mode="light" height={18} />`): simula mini sidebar ativa, botão primário, botão de gravação suave e card selecionado com pill `"Aberto"`, permitindo comparar os temas instantaneamente mesmo quando outro tema ou o modo escuro está ativo.
  - Nome, badge (`Clássico` / `Logo Relix`), descrição curta, dot + código hexadecimal (`#0F172A` / `#E11D48`) e selo `"Ativo"` com check no tema selecionado.
  - Clique aplica imediatamente o tema no contexto e `localStorage`, com feedback visual imediato.

---

## 8. Verificação, Homologação e Entrega

1. **Verificação técnica:** `npx tsc --noEmit`, `npm run build` (`prisma generate && vite build`) e testes automatizados do registry/tema + auditoria visual (Playwright ou inspeção em ambos os temas e modos claro/escuro).
2. **Critérios de aceite:**
   - Tema `default` (modo claro) = 100% fiel ao visual atual.
   - Tema `relix` (modo claro) = todos os realces dos 7 prints e controles mapeados em `#E11D48` (`rose-600`), com contraste distinto nos botões de exclusão (`#991b1b`).
   - Modo escuro = 0 alterações nas cores de UI; `<BrandLogo />` acompanha a variante dark do tema selecionado.
   - Cores personalizadas de Tags e Categorias de Atendimento = 0 alterações.
   - Recarregamento da página (F5) = preserva tema sem flash (anti-FOUC).
3. **Homologação em `localhost`:** instalar dependências se necessário e iniciar servidor local (`npm run dev`) para validação pessoal do usuário e eventuais ajustes.
4. **PR e Merge:** somente após o OK explícito do usuário na homologação em `localhost`, publicar branch, abrir PR, aprovar automaticamente e realizar merge conforme permissão concedida.

---

## 9. O Que Fica a Cargo do Implementador (Left to Builder)
- Micro-detalhes de espaçamento, tipografia interna e proporções da miniatura visual nos cartões de `ThemeSettingsSection.tsx`, seguindo a linguagem visual de `SettingsPage.tsx`.
- Organização interna de eventuais classes utilitárias compostas no `globals.css` (ex.: `.brand-card-selected` para combinar borda + ring + glow usando `var(--brand-card-selected-*)` sem colidir com `.dark`).
- Divisão do trabalho em frentes paralelas com subagentes durante a fase de implementação (após aprovação deste documento e elaboração do plano de execução).
