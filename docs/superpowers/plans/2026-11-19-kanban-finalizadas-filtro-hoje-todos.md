# Filtro Toggle "Hoje" / "Todos" na Coluna de Finalizadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o filtro toggle "Hoje" / "Todos" no cabeçalho da coluna "Finalizadas" no Kanban Técnico (`TechnicianKanbanBoard.tsx`), com estado inicial padrão "Hoje" e cálculo preciso da data de conclusão via `statusHistory`.

**Architecture & Files:**
- `src/components/dashboard/TechnicianKanbanBoard.tsx`: Adicionar estado `finishedFilter`, função auxiliar de data `isFinalizedToday`, filtragem dos cards da coluna `finalizadas` e o componente visual do segmented toggle no cabeçalho.
- `scripts/test-kanban-finished-filter.ts`: Script de teste automatizado para validar a lógica de filtragem temporal (cards de hoje, ontem, histórico ausente, múltiplos status no histórico).

---

### Task 1: Lógica de Filtragem e Teste Automatizado

- [ ] **Step 1:** Criar o script de teste `scripts/test-kanban-finished-filter.ts` cobrindo cenários:
  1. Card com `statusHistory` indicando finalização hoje.
  2. Card com `statusHistory` indicando finalização em data anterior (ontem).
  3. Card sem `statusHistory` com `updatedAt` hoje.
  4. Card sem `statusHistory` com `updatedAt` anterior.
  5. Múltiplas transições no histórico (pegando a mais recente com `toStatus === "Solucionado"`).
- [ ] **Step 2:** Executar o teste com `npx tsx scripts/test-kanban-finished-filter.ts` e confirmar que falha (ou roda com a lógica importada).
- [ ] **Step 3:** Implementar e exportar a função `isFinalizedToday(log: WorkLogItem): boolean` em `src/components/dashboard/TechnicianKanbanBoard.tsx`.
- [ ] **Step 4:** Re-executar o script de teste e confirmar que todos os cenários passam.

---

### Task 2: Implementação do Componente Visual do Toggle e Integração de Estado

- [ ] **Step 1:** Adicionar o estado `finishedFilter: "hoje" | "todos"` com valor inicial `"hoje"` em `TechnicianKanbanBoard.tsx`.
- [ ] **Step 2:** Atualizar a geração de `columnsData`:
  - Na coluna `finalizadas`, se `finishedFilter === "hoje"`, filtrar com `isFinalizedToday(log)`.
  - Guardar a contagem total de finalizadas para exibir no tooltip.
- [ ] **Step 3:** Renderizar o controle segmentado no cabeçalho da coluna `finalizadas`:
  - Pílula compacta com botões `Hoje` e `Todos`.
  - Estilização Tailwind consistente com tema claro/escuro.
  - Tooltip no badge numérico informando o total geral quando em modo "Hoje".
- [ ] **Step 4:** Verificar a compilação do TypeScript com `npx tsc --noEmit`.

---

### Task 3: Verificação Completa e Build

- [ ] **Step 1:** Executar testes automatizados com `npx tsx scripts/test-kanban-finished-filter.ts`.
- [ ] **Step 2:** Executar checagem de tipos estrita com `npx tsc --noEmit`.
- [ ] **Step 3:** Executar compilação completa da aplicação com `npm run build`.
- [ ] **Step 4:** Fazer commit das alterações e revisar.
