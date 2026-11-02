# Filtro por Período de Atendimentos & Desbloqueio de Histórico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a visualização de todos os atendimentos históricos anteriores no feed e implementar um filtro flexível por período de datas (Opção B - Popover suspenso com atalhos e seleção personalizada De/Até) com precisão de fuso horário local brasileiro.

**Architecture:** 
1. No backend Express, ajustar `GET /api/worklogs` para remover o bloqueio rígido do dia atual, retornando todo o histórico por padrão e aceitando parâmetros opcionais `startDate` e `endDate`.
2. No frontend React, criar um componente modular `DateRangePopover.tsx` com atalhos rápidos ("Hoje", "Últimos 7 dias", "Últimos 30 dias", "Este mês", "Todos") e campos de data inicial e final.
3. Integrar o popover na barra de filtros de `DashboardClient.tsx`, substituindo a comparação UTC instável por extração de data no fuso local (`toLocalDateStr`).

**Tech Stack:** Node.js, Express, Prisma ORM, SQLite, React 19, TypeScript, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-02-worklog-date-range-filter-design.md`

## Global Constraints
- Preserve existing authentication, role hierarchies, and worklog/reports pipelines.
- Do not move recordings or PDFs to `public/`.
- Ensure light and dark themes (CloudNexus) remain 100% consistent across all modifications.
- Fuso horário deve refletir a data local do navegador/usuário (evitar desvios de UTC causados por `.toISOString()`).

## Review Focus
- Visualização de chamados anteriores: Atendimentos de outubro e dias passados devem aparecer imediatamente na listagem.
- Filtro por período específico: Filtrar, por exemplo, de 15/10/2026 a 18/10/2026 deve exibir estritamente os chamados desse intervalo.
- Atalhos rápidos: Clicar em "Hoje", "Últimos 7 dias" ou "Este mês" deve selecionar instantaneamente o intervalo correto.
- Limpeza de filtros: O botão "Limpar filtros" e o botão "Limpar" do popover devem restaurar a visualização completa.
- Edge cases: Início maior que fim deve ser tratado amigavelmente; campos em branco não devem quebrar a listagem.

---

### Task 1: Backend History Unlocking & Date Range API Query
**Role/Subagent:** `self` (Backend Specialist)
**Files:**
- Modify: `src/server/routes/worklogs.routes.ts`
- Modify: `src/services/api.ts`

- [ ] **Step 1:** In `src/server/routes/worklogs.routes.ts`, update `router.get("/")`:
  - Extract query params: `startDate` (`req.query.startDate as string`) and `endDate` (`req.query.endDate as string`).
  - If `startDate` or `endDate` are provided, parse dates:
    - `startDate`: `new Date(`${startDate}T00:00:00.000`)` (ou fuso local).
    - `endDate`: `new Date(`${endDate}T23:59:59.999`)`.
    - Apply `where.createdAt = { gte?: start, lte?: end }`.
  - When no date or type params are passed, do NOT restrict to `today`! Return all logs ordered by `createdAt: "desc"`.
- [ ] **Step 2:** In `src/services/api.ts`, update `api.worklogs.getDaily()` / add `api.worklogs.getAll(params?: { startDate?: string; endDate?: string })` accepting optional query params.
- [ ] **Step 3:** Test endpoint with PowerShell `Invoke-RestMethod` to verify that 25 historical logs are returned.
- [ ] **Step 4:** Run `npx tsc --noEmit` and commit: `feat(api): desbloquear historico completo de atendimentos e suportar filtro de datas`.

---

### Task 2: Modular Date Range Picker Popover Component (Option B)
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Create: `src/components/dashboard/DateRangePopover.tsx`

- [ ] **Step 1:** Create `src/components/dashboard/DateRangePopover.tsx`:
  - Props:
    ```ts
    interface DateRangePopoverProps {
      startDate: string; // YYYY-MM-DD
      endDate: string;   // YYYY-MM-DD
      onChange: (range: { startDate: string; endDate: string; label?: string }) => void;
      onClear: () => void;
    }
    ```
  - Button trigger styled with CloudNexus pill design (`[📅 Filtrar Período ▾]` or formatted date `15/10 - 02/11`).
  - Dropdown popover panel:
    - Quick presets: "Hoje", "Ontem", "Últimos 7 dias", "Últimos 30 dias", "Este mês", "Todos os períodos".
    - Date inputs: "Data Inicial" (`<input type="date">`) e "Data Final" (`<input type="date">`).
    - Action buttons: "Aplicar" e "Limpar".
  - Handle click outside to close popover.
  - Complete Dark Mode and Light Mode support.
- [ ] **Step 2:** Run `npx tsc --noEmit` and commit: `feat(ui): criar componente DateRangePopover com atalhos rapidos e datas personalizadas`.

---

### Task 3: Integration into `DashboardClient.tsx`
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/DashboardClient.tsx`

- [ ] **Step 1:** In `src/components/DashboardClient.tsx`:
  - Replace filter state `date: ""` with `startDate: ""` and `endDate: ""` and `dateLabel: ""`.
  - Add `toLocalDateStr(date: Date | string): string` helper.
  - Replace old single date input with `<DateRangePopover>`.
  - Update `filteredLogs` memo to filter by `(startDate ? logDate >= startDate : true) && (endDate ? logDate <= endDate : true)`.
  - Update "Limpar filtros" button to clear `startDate` and `endDate`.
- [ ] **Step 2:** Run `npx vite build` to ensure clean compile.
- [ ] **Step 3:** Commit: `feat(dashboard): integrar filtro por periodo de datas no feed de atendimentos`.

---

### Task 4: Full QA Audit & Verification
**Role/Subagent:** `qa-verifier` (QA Specialist)
**Files:**
- Full repository audit

- [ ] **Step 1:** Run `npx tsc --noEmit` and verify 0 TypeScript errors.
- [ ] **Step 2:** Run `npx vite build` and verify clean production build.
- [ ] **Step 3:** Verify that all 25 historical logs are visible when no date filter is active.
- [ ] **Step 4:** Verify that selecting a period (e.g. 15 de outubro a 18 de outubro) filters accurately.
- [ ] **Step 5:** Verify Light and Dark mode rendering.
- [ ] **Step 6:** Update plan checkmarks and finalize.

