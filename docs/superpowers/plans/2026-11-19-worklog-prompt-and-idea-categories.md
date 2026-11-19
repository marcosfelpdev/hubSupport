# WorkLog Prompt and Idea Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the worklog category options by adding "Prompt" and "Ideia" alongside "Ação Técnica" and "Implementação", locking the initial status in Backlog when selected, routing to the technician Kanban, and displaying themed badges across cards and detail views.

**Architecture:** Extend Prisma `WorkLog` schema with `isPrompt` and `isIdea` booleans, synchronize SQLite/Postgres with `prisma db push`, update Express routes in `worklogs.routes.ts` to enforce status locking and technician notifications, expand `WorkLogForm.tsx` to render 4 responsive category cards with dedicated color palettes and icons (`Cog`, `Rocket`, `Sparkles`, `Lightbulb`), and update `ReportCardMinimized.tsx`, `TechnicianKanbanBoard.tsx`, and `WorkLogDetailContent.tsx` to display and filter by all 4 categories.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React (`Cog`, `Rocket`, `Sparkles`, `Lightbulb`, `Lock`, `Check`), Express 5, Prisma ORM, SQLite / PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-19-worklog-prompt-and-idea-categories-design.md`

## Global Constraints

- Retain 100% backward compatibility for existing worklogs (`isPrompt` and `isIdea` default to `false`).
- Retain existing behavior: marking any of the 4 categories locks initial status to "Backlog" with the `<Lock /> Fixo em Backlog` badge.
- Preserve full theme consistency across dark/light modes.
- All code must compile cleanly via `npx vite build` with zero TypeScript errors.

## Review Focus

- Multi-selection support: Users can select any combination of the 4 categories (or none).
- Status locking logic: Selecting `isPrompt` or `isIdea` locks status dropdown to "Backlog" and disables manual status change during creation.
- Reset integrity: Submitting the form or resetting it clears `isPrompt` and `isIdea` back to `false`.
- Kanban routing & filtering: Tickets marked with `isPrompt` or `isIdea` appear in the technician Kanban and filter tabs.
- Card badge styling: `ReportCardMinimized.tsx` renders clear, color-coded badges for Prompt (emerald) and Ideia (violet).

---

### Task 1: Prisma Schema & Backend API for Prompt and Idea Categories

**Files:**
- Modify: `prisma/schema.prisma:45-55`
- Modify: `src/server/routes/worklogs.routes.ts:80-100, 200-210, 275-290, 435-485, 515-545`
- Modify: `src/services/api.ts:25-45, 60-80`
- Test: `scripts/test-worklog-prompt-idea-backend.ts`

- [x] **Step 1: Update Prisma schema and sync database**
  Add `isPrompt Boolean @default(false)` and `isIdea Boolean @default(false)` to `model WorkLog`. Run `npx prisma db push`.
- [x] **Step 2: Update Express worklogs routes in `src/server/routes/worklogs.routes.ts`**
  - Accept `isPrompt` and `isIdea` in `POST /api/worklogs`.
  - Calculate `isBacklogDemand = isTechnicalAction || isImplementation || isPromptBool || isIdeaBool`.
  - Set `status: isBacklogDemand ? "Backlog" : status.trim()`.
  - Persist `isPrompt` and `isIdea` in `prisma.workLog.create`.
  - Include `isPrompt: true` and `isIdea: true` in technician notifications and in `/api/worklogs/kanban` query filter.
- [x] **Step 3: Update `src/services/api.ts`**
  Add `isPrompt?: boolean` and `isIdea?: boolean` to `WorkLogItem` interface.
- [x] **Step 4: Create backend automated integration test**
  Create `scripts/test-worklog-prompt-idea-backend.ts` testing creation with `isPrompt`, `isIdea`, status locking to "Backlog", query in Kanban, and technician notifications.
- [x] **Step 5: Run integration test and verify passing**
  Execute `npx tsx scripts/test-worklog-prompt-idea-backend.ts` and confirm 100% pass rate.
- [x] **Step 6: Commit changes**
  `git add prisma/schema.prisma src/server/routes/worklogs.routes.ts src/services/api.ts scripts/test-worklog-prompt-idea-backend.ts && git commit -m "feat(backend): add isPrompt and isIdea to WorkLog and API routes"`

---

### Task 2: Form UI Expansion with 4 Category Cards (`WorkLogForm.tsx`)

**Files:**
- Modify: `src/components/WorkLogForm.tsx:50-60, 315-355, 490-520, 820-890`

- [x] **Step 1: Add state and status locking logic in `WorkLogForm.tsx`**
  Add `const [isPrompt, setIsPrompt] = useState(false);` and `const [isIdea, setIsIdea] = useState(false);`. Update `const isTechnicalOrImplementation = technicalAction || implementation || isPrompt || isIdea;`.
- [x] **Step 2: Update `handleSubmit` FormData and reset**
  In `handleSubmit`:
  - `formData.set("isPrompt", isPrompt ? "on" : "off");`
  - `formData.set("isIdea", isIdea ? "on" : "off");`
  - On reset, `setIsPrompt(false); setIsIdea(false);`.
- [x] **Step 3: Render 4 Category Cards in responsive grid**
  Update the category container to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`:
  - 1. Ação Técnica: `Cog`, Amber (`#f59e0b`), "Demanda técnica / dev"
  - 2. Implementação: `Rocket`, Blue (`#3b82f6`), "Novas features / setup"
  - 3. Prompt: `Sparkles`, Emerald (`#10b981`), "Engenharia / Ajuste de prompt de IA"
  - 4. Ideia: `Lightbulb`, Violet (`#8b5cf6`), "Sugestão de melhoria / Inovação"
- [x] **Step 4: Verify build with `npx vite build`**
  Confirm zero TypeScript or compilation errors.
- [x] **Step 5: Commit changes**
  `git add src/components/WorkLogForm.tsx && git commit -m "feat(worklogs): add Prompt and Idea category cards to WorkLogForm"`

---

### Task 3: Kanban Filters, Mini Cards & WorkLog Detail

**Files:**
- Modify: `src/components/ReportCardMinimized.tsx:140-165, 230-245`
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx:230-265, 330-360`
- Modify: `src/components/dashboard/WorkLogDetailContent.tsx:75-90, 900-925`

- [x] **Step 1: Update `ReportCardMinimized.tsx` badge rendering**
  Update `getFooterConfig` to handle `isPrompt` and `isIdea`:
  - If `isPrompt`: badge with emerald styling.
  - If `isIdea`: badge with violet styling.
  - Multi-tag label combinations (e.g. "Prompt · Ideia", "Ação Técnica · Prompt").
- [x] **Step 2: Update `TechnicianKanbanBoard.tsx` filters and totalizers**
  Add filter options for "Prompt" and "Ideia" in `filterType`, and add metric count indicators for `promptCount` and `ideaCount`.
- [x] **Step 3: Update `WorkLogDetailContent.tsx`**
  Render badges for `isPrompt` (Emerald chip with `Sparkles`) and `isIdea` (Violet chip with `Lightbulb`) in the worklog detail header.
- [x] **Step 4: Verify build with `npx vite build`**
  Confirm zero TypeScript or compilation errors.
- [x] **Step 5: Commit changes**
  `git add src/components/ReportCardMinimized.tsx src/components/dashboard/TechnicianKanbanBoard.tsx src/components/dashboard/WorkLogDetailContent.tsx && git commit -m "feat(kanban): add badges and filters for Prompt and Idea categories"`

---

### Task 4: Comprehensive QA Integration Test & Final Verification

**Files:**
- Modify: `scripts/test-worklog-prompt-idea-backend.ts`
- Modify: `docs/superpowers/plans/2026-11-19-worklog-prompt-and-idea-categories.md`

- [x] **Step 1: Execute full backend test suite**
  Run `npx tsx scripts/test-worklog-prompt-idea-backend.ts` and verify 100% pass rate.
- [x] **Step 2: Execute regression tests**
  Run `npx tsx scripts/test-worklog-client-combobox.ts` and `npx tsx scripts/test-client-manager-feature.ts`.
- [x] **Step 3: Run production build check**
  Run `npx vite build` and ensure clean output.
- [x] **Step 4: Mark plan complete and commit**
  Update all checkboxes in `docs/superpowers/plans/2026-11-19-worklog-prompt-and-idea-categories.md` to `[x]` and commit.
