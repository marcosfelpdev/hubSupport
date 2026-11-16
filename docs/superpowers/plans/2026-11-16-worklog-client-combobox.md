# WorkLog Client Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the free-text "Escritório / Cliente" field in `WorkLogForm.tsx` into an interactive combobox with live search filtering populated by registered clients (`api.clients.getAll()`), binding each worklog to `clientId` and directing it to the client's history.

**Architecture:** Create an accessible, modular `ClientCombobox` component with real-time text filtering, keyboard navigation (ArrowUp, ArrowDown, Enter, Escape), outside-click detection, and clear action. Integrate it into `WorkLogForm.tsx`, fetching clients dynamically and injecting both `clientId` and `clientOrOffice` into `FormData` on submit, with strict validation ensuring a registered client is selected.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React (`Building2`, `ChevronDown`, `Check`, `X`, `Search`), Express 5, Prisma ORM, SQLite.

**Spec:** `docs/superpowers/specs/2026-11-16-worklog-client-combobox-design.md`

## Global Constraints

- Never break backward compatibility for existing worklogs without `clientId`.
- Retain `clientOrOffice` as the client's readable name for reports, tables, and PDF templates.
- Ensure 100% theme consistency with existing dark/light mode Tailwind styling.
- All builds must pass `npx vite build` with zero TypeScript errors or warnings.

## Review Focus

- Input with non-matching search: Displays friendly "Nenhum cliente encontrado" state and prevents submitting unselected free text.
- Keyboard navigation: User can navigate results with `ArrowDown` / `ArrowUp` and confirm with `Enter` without opening/clicking with mouse.
- Dropdown click-outside: Clicking outside the combobox container automatically closes the dropdown.
- Form reset: After successful submission or form reset, combobox input and selection state clear cleanly.
- Historical association: Submitting a worklog with `clientId` immediately appears in the client's profile history (`/clients/:id`).

---

### Task 1: Create Reusable `ClientCombobox` Component

**Files:**
- Create: `src/components/ClientCombobox.tsx`
- Test: `scripts/test-client-combobox-logic.ts`

- [x] **Step 1: Write unit test script for combobox filter & state logic**
  Create `scripts/test-client-combobox-logic.ts` checking case-insensitive filtering, substring matches, accent tolerance/normalization, and selection mapping.
- [x] **Step 2: Run test script to verify failure / initial requirements**
  Execute `npx tsx scripts/test-client-combobox-logic.ts` and confirm expected behaviors.
- [x] **Step 3: Implement `ClientCombobox.tsx`**
  Build `src/components/ClientCombobox.tsx` with:
  - Props: `clients: ClientItem[]`, `selectedClient: ClientItem | null`, `onSelectClient: (client: ClientItem | null) => void`, `disabled?: boolean`, `error?: string`.
  - State: `searchQuery`, `isOpen`, `highlightedIndex`.
  - UI: Input with `Building2` leading icon, clear `X` button when selected, `ChevronDown` toggle, and floating dropdown with filtered list, empty state, and check icon on active selection.
  - Event handlers: `onKeyDown` (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), `useRef` + `useEffect` outside-click listener.
- [x] **Step 4: Run test script and verify passing**
  Execute `npx tsx scripts/test-client-combobox-logic.ts` and ensure all tests pass.
- [x] **Step 5: Commit changes**
  `git add src/components/ClientCombobox.tsx scripts/test-client-combobox-logic.ts && git commit -m "feat(ui): add reusable ClientCombobox component"`

---

### Task 2: Integrate `ClientCombobox` into `WorkLogForm.tsx`

**Files:**
- Modify: `src/components/WorkLogForm.tsx:50-130, 260-350, 520-545`
- Test: `scripts/test-worklog-client-combobox.ts`

- [x] **Step 1: Add client state and fetching in `WorkLogForm.tsx`**
  Import `api` and `ClientItem` type. Add `const [clients, setClients] = useState<ClientItem[]>([])` and `const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null)`. Fetch clients via `api.clients.getAll()` in `useEffect`.
- [x] **Step 2: Replace text input with `ClientCombobox`**
  In line ~525 of `WorkLogForm.tsx`, replace the `<input id="clientOrOffice" ...>` with `<ClientCombobox clients={clients} selectedClient={selectedClient} onSelectClient={setSelectedClient} disabled={isPending} />`.
- [x] **Step 3: Update `handleSubmit` validation and FormData injection**
  In `handleSubmit`:
  - Validate that `selectedClient` is not null (if null, set error message "Por favor, selecione um cliente cadastrado.").
  - In `formData`, set `formData.set("clientId", selectedClient.id)` and `formData.set("clientOrOffice", selectedClient.name)`.
  - On success, reset `setSelectedClient(null)`.
- [x] **Step 4: Run build check**
  Execute `npx vite build` to ensure complete TypeScript typing correctness.
- [x] **Step 5: Commit changes**
  `git add src/components/WorkLogForm.tsx && git commit -m "feat(worklogs): integrate ClientCombobox into WorkLogForm"`

---

### Task 3: Comprehensive QA Integration Test & Verification

**Files:**
- Create: `scripts/test-worklog-client-combobox.ts`
- Modify: `docs/superpowers/plans/2026-11-16-worklog-client-combobox.md`

- [x] **Step 1: Write integration test script**
  Create `scripts/test-worklog-client-combobox.ts` to test:
  1. Fetching clients from API.
  2. Creating a WorkLog with `clientId` and `clientOrOffice`.
  3. Querying `/api/clients/:id` to verify the new worklog is in the client's history.
  4. Testing validation rejection when required client is missing.
- [x] **Step 2: Execute integration test suite**
  Run `npx tsx scripts/test-worklog-client-combobox.ts` and inspect assertion results.
- [x] **Step 3: Execute `npx vite build`**
  Verify production compilation succeeds without errors.
- [x] **Step 4: Commit changes and mark plan complete**
  `git add scripts/test-worklog-client-combobox.ts && git commit -m "test: add integration test for worklog client combobox"`
