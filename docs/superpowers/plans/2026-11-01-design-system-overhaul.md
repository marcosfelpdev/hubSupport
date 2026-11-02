# Design System Overhaul — CloudNexus Aesthetic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the visual identity and styling of HubSupport across all pages, components, and modals to match the high-end, clean CloudNexus SaaS aesthetic shown in the reference video (`media_1793540854463_d928f5fa.mp4`), preserving 100% of internal logic and data presentation.

**Architecture:** Establish a modern, cohesive design token system in Tailwind CSS and `globals.css` with a crisp light canvas (`#f8f9fa`), pure white cards (`#ffffff`), subtle borders (`#e5e7eb`), high-contrast slate typography (`#0f172a`), solid dark primary buttons (`#0f172a`), refined status pill badges with indicator dots, and slide-over/modal drawer ergonomics. Dispatch specialized style subagents to refactor navigation, kanban, dashboard overview, ticket feeds, creation forms, and modal viewers in an orderly, coordinated sequence with verification after every step.

**Tech Stack:** React 19, Tailwind CSS v4, Lucide React, Vite, TypeScript.

**Spec:** Visual reference video `C:/Users/mfana/.gemini/antigravity/brain/496165e6-564d-41fa-80b1-6a4a0dca066d/.user_uploaded/media_1793540854463_d928f5fa.mp4` (CloudNexus UI).

---

## Global Constraints

- **Preserve Internal Logic:** Never modify backend API routes, Prisma schemas, JWT authentication, Gemini report generation jobs, PDF generation, or screen recording mechanisms.
- **Preserve Data Integrity:** Never remove, hide, or alter any information currently presented (client, requester, date, tag, problem description, action taken, AI structured report, status, media attachments). How information is styled can change; what information is shown cannot.
- **Strict TypeScript & Build:** Every task must pass `npx vite build` with 0 errors before moving forward.
- **No Random Inline Styles:** Replace scattered inline styles with consistent Tailwind utility classes and CSS variables.

---

## Review Focus

1. **Information Completeness:** All ticket fields (requester, client, tag, status, technical action, implementation, media count, date) remain visible on cards and modals.
2. **Interactive States:** Drag-and-drop on Kanban columns and file upload dropzones work seamlessly with clear visual cues.
3. **Modal & PDF Viewer Integrity:** The PDF preview iframe and non-looping media gallery remain completely functional in the new theme.
4. **Theme Contrast & Readability:** Text hierarchy is crisp, with high-contrast slate text on light surfaces and clear badge colors.
5. **No Regressions on Build:** Zero TypeScript errors and clean bundle compilation.

---

## Tasks Breakdown

### Task 1: Design Tokens & Global CSS Setup
**Agent:** `ui-styler`
**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/components/TagBadge.tsx`

**Deliverables:**
- Define CSS custom properties for CloudNexus light palette:
  - `--bg-canvas`: `#f8f9fa` (app background)
  - `--bg-surface`: `#ffffff` (card/modal background)
  - `--bg-subtle`: `#f1f5f9` (header/table stripe)
  - `--border-subtle`: `#e5e7eb` (border standard)
  - `--border-focus`: `#0f172a` (active border)
  - `--text-primary`: `#0f172a` (high contrast)
  - `--text-secondary`: `#475569` (readable body)
  - `--text-muted`: `#94a3b8` (subtitles/meta)
  - `--accent-primary`: `#0f172a` (solid dark buttons)
- Implement utility classes for pill badges with status dots, clean borders, and soft shadows (`shadow-xs`, `shadow-sm`).
- Ensure `TagBadge.tsx` supports clean light-theme pill rendering with colored dot and translucent background.
- Verify: `npx vite build`.

---

### Task 2: Navigation Shell (Sidebar & TopBar)
**Agent:** `ui-styler` (assisted by layout specialist)
**Files:**
- Modify: `src/layouts/DashboardLayout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/TopBar.tsx`

**Deliverables:**
- Migrate `Sidebar.tsx` from inline styles to pure Tailwind:
  - Clean light surface (`bg-[#f8f9fa] border-r border-slate-200`).
  - Modern brand header with workspace switcher pill (`[ HubSupport • Matriz SP ▾ ]`).
  - Active navigation item with solid dark pill (`bg-slate-900 text-white shadow-xs font-semibold`).
  - Inactive navigation items with subtle hover (`text-slate-600 hover:text-slate-900 hover:bg-slate-200/50`).
  - Recording indicator seamlessly integrated.
  - User footer with avatar, name, role badge, and logout trigger.
- Refactor `TopBar.tsx`:
  - Search pill with search icon and keyboard shortcut badge (`Ctrl + K`).
  - Quick filters / Context pill dropdown.
  - Notification bell with unread badge.
- Verify: `npx vite build`.

---

### Task 3: Technician Kanban Board & Report Cards
**Agent:** `ui-styler`
**Files:**
- Modify: `src/pages/TechnicianPage.tsx`
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`
- Modify: `src/components/ReportCardMinimized.tsx`

**Deliverables:**
- Redesign `TechnicianPage.tsx` header with clean CloudNexus title, view switchers (Kanban / Lista), and search.
- Redesign `TechnicianKanbanBoard.tsx`:
  - Columns with soft neutral background (`bg-slate-100/70 border border-slate-200/70 rounded-2xl`).
  - Column headers with colored dot indicator, bold title, and rounded count pill.
  - Drag-and-drop feedback with subtle dashed blue border and light blue glow.
- Redesign `ReportCardMinimized.tsx`:
  - Crisp pure white card (`bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-xs hover:shadow-md transition-all`).
  - Top line: Platform TagBadge + Status pill with dot.
  - Title: Bold slate-900 text with clean line clamp.
  - Requester and Client metadata in clean muted slate typography.
  - Action footer: Attachment badge (`paperclip`), technical action / implementation tags, and AI processing pulse icon.
  - Active/maximized state with subtle slate ring (`ring-2 ring-slate-900`).
- Verify: `npx vite build`.

---

### Task 4: Ticket Details & Report Modal (CloudNexus Slide-over & Modal)
**Agent:** `ui-styler`
**Files:**
- Modify: `src/components/dashboard/ReportDetailsModal.tsx`

**Deliverables:**
- Redesign the modal shell with clean white surface, subtle slate border, and soft dark backdrop.
- Details View:
  - Header: Title, status pill, platform tag, close button `✕`.
  - Content sections in structured clean white cards with subtle borders:
    - Descrição do Atendimento (clean typography).
    - Solução / Ação Realizada (with subtle emerald border/accent).
    - AI Report section with structured proposals, detail paragraphs, and referrals.
  - Header Actions: Solid dark "Visualizar PDF" and "Mídias ({count})" buttons.
- PDF Viewer View:
  - Clean light toolbar with document title, "Exportar" download button (solid dark), "Detalhes" back button, and close `✕`.
  - White container for PDF iframe.
- Media Gallery View:
  - Clean preview frame flanked by left and right non-looping chevron buttons.
  - Centered thumbnail rail directly below the main media frame.
- Verify: `npx vite build`.

---

### Task 5: Dashboard Overview & Ticket Feed
**Agent:** `ui-styler`
**Files:**
- Modify: `src/pages/DashboardOverviewPage.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/WorkLogFeed.tsx`

**Deliverables:**
- Redesign `DashboardOverviewPage.tsx`:
  - Summary metric cards in pure white with subtle borders, big bold numbers, and subtitle indicators.
  - Recent activity feed matching the CloudNexus table style (clean table rows, hover highlight, status pills).
- Redesign `WorkLogFeed.tsx`:
  - Filter bar with search, platform filter, status filter.
  - Table rows with pure white background, hover state `#f8fafc`, subtle divider lines `#f1f5f9`.
  - Action buttons (view report, details).
- Verify: `npx vite build`.

---

### Task 6: Ticket Creation Form (WorkLogForm) & Settings Page
**Agent:** `ui-styler`
**Files:**
- Modify: `src/components/WorkLogForm.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/EmployeesPage.tsx`

**Deliverables:**
- Redesign `WorkLogForm.tsx`:
  - Form container in pure white (`bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8`).
  - Inputs with crisp light styling (`bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 rounded-lg`).
  - Status select disabled when technical action / implementation is selected with lock icon and helper text.
  - Platform tags selection as clean colored pills with active ring.
  - Media upload dropzone with clean dashed border, upload cloud icon, and drag hover highlight.
- Redesign `SettingsPage.tsx` and `EmployeesPage.tsx` with matching clean table and card components.
- Verify: `npx vite build`.

---

### Task 7: Full QA Verification & Visual Regression Check
**Agent:** `qa-verifier`
**Files:**
- Full codebase check
- Run `npx vite build`
- Verify authentication, screen recording flow, kanban status updates, and modals.

**Deliverables:**
- Zero TypeScript errors.
- Clean production bundle.
- Complete visual consistency matching CloudNexus reference video.

