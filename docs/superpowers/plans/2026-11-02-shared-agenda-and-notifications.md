# Shared Agenda, Employee Assignment & 15-Minute Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a globally shared team calendar backed by SQLite/Prisma with employee meeting assignment, 15-minute advance notifications with sound and visual badge alert for the assigned employee, and enable the notification bell for all users in the system.

**Architecture:**
- **Database & Model:** Add `AgendaEvent` to `prisma/schema.prisma` with relation to `User` (`employeeId`, `createdById`), meeting metadata, and `notificationSent` tracker. Synchronize with `npx prisma db push`.
- **Backend API & Scheduler:** Create `src/server/routes/agenda.routes.ts` providing CRUD operations. Implement a non-blocking interval worker `src/server/jobs/agendaNotificationJob.ts` that checks every 30 seconds for upcoming meetings scheduled within 15 minutes, generating a targeted `Notification` for `event.employeeId`.
- **Frontend & UI:** Enable `<NotificationBell />` for all users in `src/components/TopBar.tsx`. Connect `BasicAgenda.tsx` to `api.agenda` and add the employee selection dropdown between the category dropdown and "Salvar" button (as specified in screenshot).

**Tech Stack:** Node.js, Express, Prisma ORM, SQLite, React 19, TypeScript, Tailwind CSS v4, Lucide React, Web Audio API.

**Spec:** Pedido do usuário para agenda global compartilhada, dropdown de funcionário no agendamento, notificações 15 min antes apenas para o usuário designado (com som e sino) e liberação do sino de notificações para todos os cargos.

## Global Constraints
- Preserve existing authentication, role hierarchies, and worklog/reports pipelines.
- Do not move recordings or PDFs to `public/`.
- Ensure light and dark themes (CloudNexus) remain 100% consistent across all modifications.
- Meeting notifications must target ONLY the employee assigned to that meeting (`event.employeeId`).

## Review Focus
- Event synchronization: All users viewing the dashboard see the exact same shared agenda.
- 15-minute notification trigger: A meeting scheduled for 10:00 triggers a notification between 09:45 and 10:00 only for the assigned employee.
- Sound & Visual Badge: Web Audio tone plays and red unread counter badge increments when the notification is fetched.
- TopBar access: Non-technician users (e.g. `USER`, `MANAGER`, `SUPPORT`) have full access to `NotificationBell`.
- Edge cases: Events without assigned employee do not crash; completed events do not trigger reminders.

---

### Task 1: Database Model & Agenda REST API
**Role/Subagent:** `self` (Backend Specialist)
**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/server/routes/agenda.routes.ts`
- Modify: `src/server/app.ts`
- Modify: `src/services/api.ts`

- [ ] **Step 1:** Update `prisma/schema.prisma` to include `AgendaEvent` model:
  ```prisma
  model AgendaEvent {
    id               String    @id @default(cuid())
    date             String    // YYYY-MM-DD
    time             String    // HH:mm
    title            String
    category         String    // "Reunião" | "Atendimento" | "Técnico" | "Lembrete"
    completed        Boolean   @default(false)
    employeeId       String?
    employee         User?     @relation("AssignedAgendaEvents", fields: [employeeId], references: [id], onDelete: SetNull)
    createdById      String?
    createdBy        User?     @relation("CreatedAgendaEvents", fields: [createdById], references: [id], onDelete: SetNull)
    notificationSent Boolean   @default(false)
    createdAt        DateTime  @default(now())
    updatedAt        DateTime  @updatedAt
  }
  ```
  Add relations `assignedEvents AgendaEvent[] @relation("AssignedAgendaEvents")` and `createdEvents AgendaEvent[] @relation("CreatedAgendaEvents")` to `User`.
- [ ] **Step 2:** Run `npm run db:push` to synchronize the Prisma schema with SQLite.
- [ ] **Step 3:** Create `src/server/routes/agenda.routes.ts` with authenticated routes:
  - `GET /api/agenda`: Returns all events ordered by date and time, including `employee: { select: { id: true, name: true, email: true, role: true } }` and `createdBy: { select: { id: true, name: true } }`.
  - `POST /api/agenda`: Validates `date`, `time`, `title`, `category`, and optional `employeeId`. Creates event with `createdById: req.user.id`.
  - `PATCH /api/agenda/:id`: Allows toggling `completed` or updating event fields.
  - `DELETE /api/agenda/:id`: Deletes event by ID.
- [ ] **Step 4:** Register `app.use("/api/agenda", agendaRoutes);` in `src/server/app.ts`.
- [ ] **Step 5:** Add typed methods in `src/services/api.ts` under `api.agenda`: `getAll()`, `create(...)`, `toggleCompleted(...)`, and `delete(...)`.
- [ ] **Step 6:** Run `npx tsc --noEmit` and commit: `feat(agenda): criar modelo prisma e endpoints da agenda global`.

---

### Task 2: 15-Minute Notification Worker & Global TopBar Bell
**Role/Subagent:** `self` (Backend / System Specialist)
**Files:**
- Create: `src/server/jobs/agendaNotificationJob.ts`
- Modify: `src/server/index.ts`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/NotificationBell.tsx`

- [ ] **Step 1:** Create `src/server/jobs/agendaNotificationJob.ts`:
  - Query active events where `completed == false`, `notificationSent == false`, and `employeeId != null`.
  - For each event, compute scheduled Date using `event.date` (YYYY-MM-DD) and `event.time` (HH:mm) in local timezone.
  - Check if time difference `(eventDateTime - now)` is between 0 and 15 minutes (or past up to 5 minutes if server was starting).
  - Create a `Notification` for `userId: event.employeeId`:
    - `title: "Lembrete de Reunião (em 15 min)"`
    - `message: `Você tem a reunião "${event.title}" agendada para às ${event.time}. Prepare-se!``
  - Mark `event.notificationSent = true`.
- [ ] **Step 2:** In `src/server/index.ts`, start `startAgendaNotificationJob()` with a 30-second interval (`setInterval`).
- [ ] **Step 3:** In `src/components/TopBar.tsx`, remove the `isTechnician &&` restriction so that `<NotificationBell />` is rendered for all logged-in users.
- [ ] **Step 4:** In `src/components/NotificationBell.tsx`, add an icon for meeting notifications (e.g. `Calendar` or `Clock` icon when `notification.title.includes("Reunião")` or workLog is null) and ensure popover styling in both light and dark modes.
- [ ] **Step 5:** Run `npx vite build` and commit: `feat(notifications): implementar worker de alerta 15min e sino global para todos os usuarios`.

---

### Task 3: Shared Calendar UI & Employee Selector Dropdown
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/dashboard/BasicAgenda.tsx`
- Modify: `src/pages/DashboardOverviewPage.tsx`

- [x] **Step 1:** Update `src/components/dashboard/BasicAgenda.tsx`:
  - Replace `localStorage` loading with API calls to `api.agenda.getAll()`.
  - Fetch active employees using `api.employees.getAll()`.
  - Update the "Novo Compromisso" form line (conforme imagem do usuário):
    - Position `[Hora 10:00]` | `[Categoria Reunião v]` | `[Dropdown Selecionar Funcionário v]` | `[Botão Salvar]`.
    - Dropdown: `<select value={newEmployeeId} onChange={...}>` with options `<option value="">Sem responsável</option>` and list of employees.
  - In event list cards:
    - Display assigned employee pill / avatar: `👤 {event.employee?.name || "Equipe"}`.
    - Checkbox to toggle `completed` sending `api.agenda.toggleCompleted(id, !completed)`.
    - Delete button calling `api.agenda.delete(id)`.
  - Apply CloudNexus styling for both Light mode and Dark mode.
- [x] **Step 2:** In `src/pages/DashboardOverviewPage.tsx`, pass necessary context or ensure `BasicAgenda` mounts and renders cleanly in the 3rd column of the dashboard.
- [x] **Step 3:** Run `npx vite build` and commit: `feat(ui): adicionar seletor de funcionario no formulario da agenda e sincronizacao global`.

---

### Task 4: Full QA Audit & Verification
**Role/Subagent:** `qa-verifier` (QA Specialist)
**Files:**
- Full repository audit

- [ ] **Step 1:** Run `npx tsc --noEmit` and confirm 0 TypeScript errors.
- [ ] **Step 2:** Run `npx vite build` and verify clean production build.
- [ ] **Step 3:** Audit:
  - Calendar events created by one user appear for all users.
  - Assigned employee dropdown functions smoothly.
  - Non-technician users see the notification bell in the topbar.
  - Meeting scheduled in 15 minutes sends notification exclusively to the assigned employee, with sound tone.
- [ ] **Step 4:** Mark all plan steps as completed and report findings.

