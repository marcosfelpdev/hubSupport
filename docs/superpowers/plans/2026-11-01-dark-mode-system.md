# Dark Mode System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive Dark Mode across the entire HubSupport platform following the CloudNexus Dark design system, featuring a segmented toggle in the lower sidebar.

**Architecture:** A lightweight React `ThemeContext` manages `"light" | "dark"` state, persisting to `localStorage` and toggling the `.dark` class on `document.documentElement`. Tailwind v4 custom dark variant and semantic CSS tokens in `globals.css` drive colors across all components with zero layout shifts.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Vite.

**Spec:** Documento de Design CloudNexus Dark aprovado pelo usuário (fundo `#090d16`, superfícies `#111726` / `#161f33`, bordas `#1e293b`, textos `#f8fafc` / `#cbd5e1`, alternador Claro/Escuro no rodapé da Sidebar).

## Global Constraints
- Preserve all existing backend routes, APIs, authentication, and database schemas.
- Do not remove or alter any information or layout metadata presented on screen.
- Keep the light mode design 100% intact when in light mode.
- Maintain consistent CloudNexus aesthetics in both light and dark modes.

## Review Focus
- LocalStorage persistence: Theme selection persists across browser reloads.
- Backdrop and Modals: Modals and lightbox overlays remain high-contrast and legible in dark mode.
- Smooth transitions: Zero visual flashes or broken text contrast during theme toggling.
- Full viewport coverage: Dark mode canvas covers the entire screen, sidebar, and body background.

---

### Task 1: Theme Infrastructure & Tokens
**Files:**
- Create: `src/contexts/ThemeContext.tsx`
- Modify: `src/styles/globals.css`
- Modify: `src/App.tsx`

- [ ] **Step 1:** Create `ThemeContext.tsx` with `"light" | "dark"` state, initialization from `localStorage` (`hubsupport_theme`), helper `toggleTheme()`, and synchronization with `document.documentElement.classList`.
- [ ] **Step 2:** Update `globals.css` with `@custom-variant dark (&:where(.dark, .dark *));` and `.dark` CSS tokens (`--bg-primary: #090d16`, `--bg-secondary: #111726`, `--bg-card: #111726`, `--border: #1e293b`, `--text-primary: #f8fafc`, `--text-secondary: #cbd5e1`, `--text-muted: #64748b`).
- [ ] **Step 3:** Wrap application routes with `<ThemeProvider>` in `src/App.tsx`.
- [ ] **Step 4:** Run `npx vite build` to ensure clean build.
- [ ] **Step 5:** Commit: `feat(theme): criar ThemeContext e tokens globais CloudNexus Dark`.

---

### Task 2: Theme Toggle in Sidebar & Layout Shell
**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/layouts/DashboardLayout.tsx`
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1:** In `Sidebar.tsx`, add the segmented theme switch `[ ☀️ Claro | 🌙 Escuro ]` in the footer area above user card and logout.
- [ ] **Step 2:** Adapt `Sidebar.tsx` surfaces, borders, and navigation links with `dark:` variants (`dark:bg-[#0b0f19] dark:border-slate-800 dark:text-slate-200`).
- [ ] **Step 3:** Adapt `TopBar.tsx` header background, borders, and quick search pill (`dark:bg-[#0b0f19]/80 dark:border-slate-800 dark:text-slate-100`).
- [ ] **Step 4:** Adapt `DashboardLayout.tsx` main canvas background (`dark:bg-[#090d16]`).
- [ ] **Step 5:** Run `npx vite build` and commit: `feat(navigation): implementar alternador de tema na Sidebar e casca escura`.

---

### Task 3: Technician Kanban Board & Report Cards
**Files:**
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`
- Modify: `src/components/ReportCardMinimized.tsx`
- Modify: `src/pages/TechnicianPage.tsx`

- [x] **Step 1:** Update `TechnicianPage.tsx` header, view switcher, and sync controls with `dark:` classes.
- [x] **Step 2:** Update `TechnicianKanbanBoard.tsx` column containers, headers, count pills, and filter bar with `dark:bg-[#111726] dark:border-slate-800 dark:text-slate-100`.
- [x] **Step 3:** Update `ReportCardMinimized.tsx` cards with dark surfaces, hover effects, and accessible status dots.
- [x] **Step 4:** Run `npx vite build` and commit: `feat(kanban): adaptar painel Kanban e cards técnicos para modo escuro`.

---

### Task 4: Dashboards, WorkLog Feed & AI Report Section
**Files:**
- Modify: `src/pages/DashboardOverviewPage.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/DashboardClient.tsx`
- Modify: `src/components/TechnicianDashboardClient.tsx`
- Modify: `src/components/WorkLogFeed.tsx`
- Modify: `src/components/AiReportSection.tsx`

- [ ] **Step 1:** Update `DashboardOverviewPage.tsx` statistics summary cards, recent list, and agenda with `dark:` classes.
- [ ] **Step 2:** Update `DashboardClient.tsx` and `TechnicianDashboardClient.tsx` expanded detail panels, info blocks, and problem description boxes.
- [ ] **Step 3:** Update `WorkLogFeed.tsx` and `AiReportSection.tsx` with CloudNexus dark cards, status badges, and action buttons.
- [ ] **Step 4:** Run `npx vite build` and commit: `feat(dashboard): adaptar telas de atendimento e relatorios IA para modo escuro`.

---

### Task 5: Modals, Media Gallery & Form
**Files:**
- Modify: `src/components/dashboard/ReportDetailsModal.tsx`
- Modify: `src/components/MediaGalleryModal.tsx`
- Modify: `src/components/WorkLogForm.tsx`

- [ ] **Step 1:** Adapt `ReportDetailsModal.tsx` modal window, PDF viewer container, tabs, and action toolbar with dark theme styling.
- [ ] **Step 2:** Adapt `MediaGalleryModal.tsx` lightbox, central stage, and bottom thumbnails rail for dark mode.
- [ ] **Step 3:** Adapt `WorkLogForm.tsx` form inputs, radio selectors, tags picker, and dropzone with `dark:bg-slate-900/60 dark:border-slate-700 dark:text-white`.
- [ ] **Step 4:** Run `npx vite build` and commit: `feat(modals): suportar modo escuro em modais, galeria de midias e formulario`.

---

### Task 6: Settings, Employees Manager & Login Page
**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/components/EmployeesManager.tsx`
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1:** Update `SettingsPage.tsx` tag management cards, tabs, and tag creation modals with dark styling.
- [ ] **Step 2:** Update `EmployeesManager.tsx` table, filter bar, employee modals, and role badges with dark styling.
- [ ] **Step 3:** Update `LoginPage.tsx` card, inputs, and branding for dark aesthetic.
- [ ] **Step 4:** Run `npx vite build` and commit: `feat(settings): adaptar configuracoes, funcionarios e login para modo escuro`.

---

### Task 7: Full QA Audit & Verification
**Files:**
- Verify: Full project via subagent `qa-verifier`

- [ ] **Step 1:** Execute `npx tsc --noEmit` and confirm 0 TypeScript errors.
- [ ] **Step 2:** Execute `npx vite build` and verify clean production assets.
- [ ] **Step 3:** Audit theme switching back and forth (Light <-> Dark) to ensure no regressions.
- [ ] **Step 4:** Final commit and report.

