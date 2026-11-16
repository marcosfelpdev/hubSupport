# Client Personal Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow assigning and managing a "Gestor Pessoal" (Personal Manager) for each client, reflected in the client list card/row and at the top of the client's profile page, with a dedicated client edit modal.

**Architecture:** Extend Prisma schema to relate `Client.managerId` with `User`, synchronize database via `prisma db push`, update Express routes in `clients.routes.ts` (`GET /`, `POST /`, `GET /:id`, and new `PUT /:id`), update `api.ts`, add the employee selector to create/edit modals in `ClientsManager.tsx` with a new table column, and display a prominent manager card and edit action in `ClientProfilePage.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React (`UserCheck`, `Pencil`, `Building2`), Express 5, Prisma ORM, SQLite / PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-16-client-personal-manager-design.md`

## Global Constraints

- Retain backward compatibility: `managerId` is optional (`nullable`).
- Ensure `onDelete: SetNull` so deleting an employee never deletes the client or corrupts data.
- Any registered employee (`User`) can be assigned as personal manager regardless of role.
- Keep 100% theme consistency with dark/light mode Tailwind styling.
- All code must pass `npx vite build` with zero TypeScript errors.

## Review Focus

- Null manager handling: Display clean "Não atribuído" state without errors or layout shifts when `managerId` is null.
- Employee selection: List active employees returned from `api.employees.getAll()` with their respective role.
- Edit modal persistence: Editing client name or personal manager updates both the database and UI state immediately.
- Profile header integration: The personal manager card renders prominently below the client title with avatar, name, and role.
- Referential integrity: Updating or removing a manager does not affect worklogs or events linked to that client.

---

### Task 1: Prisma Schema & Backend API for Client Manager

**Files:**
- Modify: `prisma/schema.prisma:14-28, 124-131`
- Modify: `src/server/routes/clients.routes.ts:1-120, 198-230`
- Modify: `src/services/api.ts:170-185, 510-530`
- Test: `scripts/test-client-manager-feature.ts`

- [x] **Step 1: Update Prisma schema and sync database**
  Add `managerId String?` and `manager User? @relation("ClientManager", fields: [managerId], references: [id], onDelete: SetNull)` to `model Client`. Add `managedClients Client[] @relation("ClientManager")` to `model User`. Run `npx prisma db push`.
- [x] **Step 2: Update Express client routes in `src/server/routes/clients.routes.ts`**
  - In `GET /api/clients`: include `manager: { select: { id: true, name: true, email: true, role: true } }`.
  - In `POST /api/clients`: accept optional `managerId` in `req.body`, validate existence if provided, and save.
  - In `GET /api/clients/:id`: include `manager: { select: { id: true, name: true, email: true, role: true } }`.
  - Add `PUT /api/clients/:id`: allow updating `name` (with uniqueness check excluding current client) and `managerId` (validate or set null).
- [x] **Step 3: Update `src/services/api.ts`**
  - Update `ClientItem` interface to include `managerId?: string | null` and `manager?: { id: string; name: string; email: string; role?: string } | null`.
  - Add `api.clients.update(id: string, data: { name?: string; managerId?: string | null })`.
- [x] **Step 4: Create integration test script**
  Create `scripts/test-client-manager-feature.ts` testing create client with manager, update manager, remove manager, fetch list, and fetch profile.
- [x] **Step 5: Run integration test and verify passing**
  Execute `npx tsx scripts/test-client-manager-feature.ts` and confirm all tests pass.
- [x] **Step 6: Commit changes**
  `git add prisma/schema.prisma src/server/routes/clients.routes.ts src/services/api.ts scripts/test-client-manager-feature.ts && git commit -m "feat(backend): add manager relation to Client and update API routes"`

---

### Task 2: Frontend Client List & Edit Modal (`ClientsManager.tsx`)

**Files:**
- Modify: `src/components/ClientsManager.tsx`

- [x] **Step 1: Fetch employees in `ClientsManager.tsx`**
  Fetch active employees via `api.employees.getAll()` on mount to populate the manager selector.
- [x] **Step 2: Add Gestor Pessoal selector to "Novo Cliente" modal**
  Add `<select>` in the create modal allowing the user to pick an employee as manager or choose "Nenhum gestor atribuído".
- [x] **Step 3: Implement "Editar Cliente" modal**
  Add state `editingClient: ClientItem | null`, `editName`, `editManagerId`. Render an edit modal allowing the user to update the client's name and personal manager via `api.clients.update()`.
- [x] **Step 4: Add "Gestor Pessoal" column in client table and Edit action button**
  Add table header and cell for "Gestor Pessoal" showing an avatar with initials, manager name, and role tag. Add `Pencil` edit button in the actions column opening the edit modal.
- [x] **Step 5: Verify build with `npx vite build`**
  Ensure clean compilation without TypeScript errors.
- [x] **Step 6: Commit changes**
  `git add src/components/ClientsManager.tsx && git commit -m "feat(clients): add personal manager selector and edit modal to ClientsManager"`

---

### Task 3: Client Profile Header & Quick Edit Modal (`ClientProfilePage.tsx`)

**Files:**
- Modify: `src/pages/ClientProfilePage.tsx`

- [x] **Step 1: Render Personal Manager card in top header**
  In the header section of `ClientProfilePage.tsx` (below client title and info), render an elegant card showing the assigned Personal Manager (avatar, name, role) or "Sem gestor atribuído".
- [x] **Step 2: Add "Editar Cliente" button and modal to ClientProfilePage**
  Add an "Editar Cliente" button (`Pencil`) in the top action area of the header. Clicking opens a client edit modal (name + manager selector), saving via `api.clients.update()` and refreshing profile data in place.
- [x] **Step 3: Verify build with `npx vite build`**
  Confirm zero compilation or typing errors.
- [x] **Step 4: Commit changes**
  `git add src/pages/ClientProfilePage.tsx && git commit -m "feat(clients): display personal manager and edit action on ClientProfilePage"`

---

### Task 4: Comprehensive QA Integration Test & Final Verification

**Files:**
- Modify: `scripts/test-client-manager-feature.ts`
- Modify: `docs/superpowers/plans/2026-11-16-client-personal-manager.md`

- [x] **Step 1: Run comprehensive backend test suite**
  Execute `npx tsx scripts/test-client-manager-feature.ts` and verify 100% pass rate.
- [x] **Step 2: Run frontend production build**
  Execute `npx vite build` and verify clean build.
- [x] **Step 3: Mark plan complete and commit**
  Update all checkboxes in `docs/superpowers/plans/2026-11-16-client-personal-manager.md` to `[x]` and commit.
