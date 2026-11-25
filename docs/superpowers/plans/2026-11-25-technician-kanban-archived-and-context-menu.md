# Área de Arquivados e Menu de Contexto no Kanban Técnico — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo de arquivamento de chamados técnicos com flag atômica no banco, tela dedicada acessível no cabeçalho do painel técnico e menu de contexto flutuante ao clicar com o botão direito nos cards do Kanban (Editar, Transferir de coluna, Arquivar e Excluir).

**Architecture:** Adição de `isArchived` e `archivedAt` no modelo `WorkLog` via Prisma (`prisma db push`). Criação dos endpoints `/api/worklogs/archived`, `/api/worklogs/:id/archive` e `/api/worklogs/:id/unarchive` no backend Express, filtrando itens arquivados fora do Kanban ativo. No frontend, criação dos componentes `KanbanCardContextMenu.tsx` (posicionado com clamp nas coordenadas do mouse) e `TechnicianArchivedView.tsx` (tela completa com busca e restauração), integrados em `TechnicianKanbanBoard.tsx` e `TechnicianPage.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Express 5, Prisma ORM 5, SQLite.

**Spec:** [docs/superpowers/specs/2026-11-25-technician-kanban-archived-and-context-menu-design.md](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-25-technician-kanban-archived-and-context-menu-design.md)

---

## Global Constraints

- **Preservação de Coluna:** Ao arquivar um chamado, seu campo `status` original não deve ser sobrescrito para que a restauração devolva o card para a mesma coluna de onde ele saiu.
- **Isolamento de Visão:** Chamados com `isArchived: true` nunca devem ser renderizados nas 5 colunas ativas do Kanban (`GET /api/worklogs/technical`).
- **Prevenção de Menu Nativo:** O evento `contextmenu` nos cards deve sempre executar `e.preventDefault()` e `e.stopPropagation()`.
- **Posicionamento sem Overflow:** O menu de contexto flutuante deve calcular suas dimensões e inverter para cima ou esquerda se o clique estiver muito próximo das bordas da tela.
- **Design System Relix:** Ambos os componentes devem seguir o tema corporativo da plataforma (suporte integral a dark/light mode, tipografia, bordas sutis e paleta de cores).
- **Verificação Obrigatória:** Build limpo sem erros de tipo via `npm run build` e execução de testes automatizados antes de concluir.

---

## Review Focus

1. **Tentativa de Transferência para "Finalizadas" via Menu de Contexto:** A regra de ouro do Kanban (passar obrigatoriamente pela coluna de Validação) deve ser respeitada caso o usuário tente transferir um card direto para Finalizadas via menu de contexto.
2. **Atualização Otimista e Contador de Arquivados:** Quando um card é arquivado ou restaurado, o contador no botão do cabeçalho `[ 📦 Arquivados (N) ]` e a lista de cards devem atualizar de forma reativa e consistente.
3. **Fechamento de Múltiplos Menus:** Apenas um menu de contexto pode existir aberto por vez; clicar fora, rolar o quadro ou pressionar `Escape` deve fechá-lo imediatamente.
4. **Permissões de Exclusão e Arquivamento:** Garantir que apenas usuários com permissão válida (`canDelete` / técnicos e admins) executem ações destrutivas.
5. **Estado Vazio (Empty State):** A tela de arquivados deve apresentar um visual polido quando não houver registros ou quando a busca não encontrar resultados.

---

## Task Structure

### Task 1: Schema do Prisma, Banco de Dados e Endpoints de API

**Files:**
- Modify: `prisma/schema.prisma:59-90`
- Modify: `src/server/routes/worklogs.routes.ts`
- Test: `scripts/test-worklog-archive-api.ts`

**Interfaces:**
- Produces: Campos `isArchived: boolean` e `archivedAt: Date | null` no modelo `WorkLog`.
- Produces: `GET /api/worklogs/archived` retornando lista de chamados técnicos arquivados.
- Produces: `PATCH /api/worklogs/:id/archive` e `PATCH /api/worklogs/:id/unarchive`.
- Modifies: `GET /api/worklogs/technical` para incluir `isArchived: false` na cláusula `where`.

- [ ] **Step 1: Atualizar `prisma/schema.prisma` com `isArchived` e `archivedAt`**
  Adicionar os campos no modelo `WorkLog`:
  ```prisma
  isArchived             Boolean   @default(false)
  archivedAt             DateTime?
  ```

- [ ] **Step 2: Sincronizar o banco SQLite local**
  Run: `npx prisma db push`

- [ ] **Step 3: Implementar rotas de arquivamento em `src/server/routes/worklogs.routes.ts`**
  - Filtrar `isArchived: false` em `GET /api/worklogs/technical`.
  - Adicionar rota `GET /api/worklogs/archived`.
  - Adicionar rotas `PATCH /:id/archive` e `PATCH /:id/unarchive`.

- [ ] **Step 4: Criar e rodar teste de integração da API**
  Criar `scripts/test-worklog-archive-api.ts` e executar:
  Run: `npx tsx scripts/test-worklog-archive-api.ts`

---

### Task 2: Cliente API Frontend e Tipagem

**Files:**
- Modify: `src/services/api.ts`

**Interfaces:**
- Produces: `WorkLogItem.isArchived?: boolean` e `WorkLogItem.archivedAt?: Date | string | null`.
- Produces: `api.worklogs.getArchived(): Promise<WorkLogItem[]>`.
- Produces: `api.worklogs.archive(id: string): Promise<WorkLogItem>`.
- Produces: `api.worklogs.unarchive(id: string): Promise<WorkLogItem>`.

- [ ] **Step 1: Atualizar interface `WorkLogItem` em `src/services/api.ts`**
  Adicionar propriedades `isArchived?: boolean; archivedAt?: Date | string | null;`.

- [ ] **Step 2: Adicionar métodos `getArchived`, `archive` e `unarchive` no objeto `api.worklogs`**

- [ ] **Step 3: Verificar tipagem estática**
  Run: `npx tsc --noEmit`

---

### Task 3: Componente de Menu de Contexto (`KanbanCardContextMenu.tsx`)

**Files:**
- Create: `src/components/dashboard/KanbanCardContextMenu.tsx`

**Interfaces:**
- Produces: `<KanbanCardContextMenu log={log} position={{ x, y }} onClose={fn} onEdit={fn} onMoveColumn={fn} onArchive={fn} onDelete={fn} />`
- Consumes: Ícones `Pencil`, `ArrowRight`, `Archive`, `Trash2` do Lucide.

- [ ] **Step 1: Implementar o componente `KanbanCardContextMenu.tsx`**
  - Renderizado via `createPortal` em `document.body`.
  - Cálculo de coordenadas com proteção de bordas de tela (`clamp`).
  - Submenu ou grupo dropdown para "Transferir para...".
  - Itens com hover states, separador sutil, e botão "Excluir" em tom avermelhado.
  - Listener global para clique fora e tecla `Escape`.

- [ ] **Step 2: Validar tipagem com `npx tsc --noEmit`**

---

### Task 4: Integração do Menu de Contexto no `TechnicianKanbanBoard.tsx`

**Files:**
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`

**Interfaces:**
- Consumes: `KanbanCardContextMenu`.
- Modifies: `ReportCardMinimized` onContextMenu handler.

- [ ] **Step 1: Adicionar estado `contextMenu` no `TechnicianKanbanBoard`**
  ```ts
  const [contextMenu, setContextMenu] = useState<{ log: WorkLogItem; x: number; y: number } | null>(null);
  ```

- [ ] **Step 2: Conectar evento `onContextMenu` nos cards**
  Interceptar o clique direito no container de card em `TechnicianKanbanBoard.tsx`.

- [ ] **Step 3: Conectar os handlers de Ação**
  - **Editar:** dispara `setSelectedLogForEdit(log)`.
  - **Transferir para Coluna:** dispara `handleDrop(targetCol, ...)` mantendo as travas de validação.
  - **Arquivar:** chama `api.worklogs.archive(log.id)`, remove o card da lista local com transição e exibe toast.
  - **Excluir:** abre modal/confirmação e chama `api.worklogs.delete(log.id)`.

- [ ] **Step 4: Validar tipagem com `npx tsc --noEmit`**

---

### Task 5: Componente da Tela de Arquivados (`TechnicianArchivedView.tsx`)

**Files:**
- Create: `src/components/dashboard/TechnicianArchivedView.tsx`

**Interfaces:**
- Produces: `<TechnicianArchivedView onBack={() => void} onRefreshKanban={() => void} />`
- Consumes: `api.worklogs.getArchived`, `api.worklogs.unarchive`, `api.worklogs.delete`.

- [ ] **Step 1: Implementar `TechnicianArchivedView.tsx`**
  - Topbar com botão `[ ← Voltar ao Quadro Kanban ]`, título, contador e campo de busca.
  - Estado de loading com skeletons/spinner.
  - Grade de cards arquivados exibindo título, cliente, categoria, data de arquivamento e coluna de origem.
  - Ação de **Restaurar ao Kanban** (`ArchiveRestore`): chama `api.worklogs.unarchive(id)` com animação de saída.
  - Ação de **Excluir Definitivamente** (`Trash2`) com modal de confirmação.
  - Empty state estilizado quando não houver itens arquivados.

- [ ] **Step 2: Validar tipagem com `npx tsc --noEmit`**

---

### Task 6: Integração do Botão e View Switcher em `TechnicianPage.tsx`

**Files:**
- Modify: `src/pages/TechnicianPage.tsx`

**Interfaces:**
- Modifies: `viewMode` para suportar `"kanban" | "classic" | "archived"`.
- Modifies: Cabeçalho para incluir o botão `[ 📦 Arquivados (N) ]` ao lado do toggle.

- [ ] **Step 1: Atualizar estado `viewMode` e buscar contador de arquivados**
  Adicionar `archivedCount` no cabeçalho.

- [ ] **Step 2: Renderizar botão `[ 📦 Arquivados ]` posicionado ao lado do switcher**
  Estilizado com badge numérico e ícone `Archive`.

- [ ] **Step 3: Renderizar `TechnicianArchivedView` quando `viewMode === "archived"`**

- [ ] **Step 4: Validar fluxo completo**

---

### Task 7: Verificação Geral, Testes E2E e Build de Produção

- [ ] **Step 1: Executar suíte de testes de ponta a ponta**
  Run: `npx tsx scripts/test-worklog-archive-api.ts`

- [ ] **Step 2: Compilação de Produção**
  Run: `npm run build`
  Expected: Vite SPA e Prisma Client compilados com 0 erros.

- [ ] **Step 3: Submissão de PR e Merge**
  Criar PR no GitHub, aprovar checks de CI e efetuar squash merge na branch `main`.
