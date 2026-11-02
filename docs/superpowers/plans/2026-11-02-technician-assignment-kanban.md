# Assinatura e Atribuição de Responsável no Kanban Técnico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o técnico assuma ("assine") um card no Kanban definindo-se como responsável pela tarefa com 1 clique (`[✋ Assumir Tarefa]`) ou atribua a outro técnico, exibindo o responsável tanto no card maximizado quanto no card minimizado das colunas do Kanban.

**Architecture:**
1. No schema do Prisma (`prisma/schema.prisma`), adicionar `assignedToId` e relação `assignedTo User?` em `WorkLog`, e sincronizar com o banco via `npx prisma db push`.
2. No backend (`src/server/routes/worklogs.routes.ts`), criar endpoint `PATCH /api/worklogs/:id/assign` e incluir `assignedTo` nas consultas do `defaultWorkLogInclude`.
3. No cliente de API (`src/services/api.ts`), atualizar `WorkLogItem` e adicionar método `api.worklogs.assign(id, assignedToId)`.
4. No componente `src/components/dashboard/WorkLogDetailContent.tsx`, implementar o bloco de Responsável Técnico com o botão `[✋ Assumir Tarefa]`, dropdown de seleção de técnicos da equipe e opção de desatribuir.
5. No componente `src/components/ReportCardMinimized.tsx`, exibir o avatar compacto do técnico responsável no rodapé do card.
6. Executar auditoria completa com `qa-verifier` validando tipagem, compilação, fluxo de atribuição no Kanban e compatibilidade com os modos Claro e Escuro.

**Tech Stack:** Node.js, Express, Prisma ORM, SQLite, React 19, TypeScript, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-02-technician-assignment-kanban-design.md`

## Global Constraints
- Preservar integridade de sessões e autenticação JWT.
- Garantir que qualquer usuário autorizado possa assumir ou designar responsáveis.
- Suporte total aos modos Claro e Escuro do Design System CloudNexus.
- Não quebrar o seed idempotente (`npm run seed`) ou schemas existentes.

## Review Focus
- Ação de 1 clique `[✋ Assumir Tarefa]`: atribui imediatamente o usuário logado com feedback visual.
- Seleção de outro responsável: lista os técnicos/usuários disponíveis para atribuição.
- Desatribuir: permite remover o responsável caso o chamado precise voltar para a fila geral sem dono.
- Card minimizado: exibe avatar e tooltip do responsável de forma elegante e não intrusiva.
- Sincronização em tempo real: a mudança no card maximizado deve refletir imediatamente na listagem/coluna sem recarregar a página.

---

### Task 1: Modelo de Dados no Prisma e Migração
**Role/Subagent:** `self` (Backend / Database Specialist)
**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1:** Adicionar campos no schema:
  - Em `WorkLog`:
    ```prisma
    assignedToId     String?
    assignedTo       User?     @relation("AssignedWorkLogs", fields: [assignedToId], references: [id], onDelete: SetNull)
    ```
  - Em `User`:
    ```prisma
    assignedWorkLogs WorkLog[] @relation("AssignedWorkLogs")
    ```
- [ ] **Step 2:** Pausar o servidor watch (`task-2116`), executar `npx prisma db push` e reiniciar o watch.
- [ ] **Step 3:** Executar `npx tsc --noEmit` para verificar tipos gerados pelo Prisma.
- [ ] **Step 4:** Commit: `feat(db): adicionar campo assignedToId para atribuicao de responsavel no WorkLog`.

---

### Task 2: Rotas de API e Cliente HTTP
**Role/Subagent:** `self` (Backend Specialist)
**Files:**
- Modify: `src/server/routes/worklogs.routes.ts`
- Modify: `src/services/api.ts`

- [ ] **Step 1:** Em `src/server/routes/worklogs.routes.ts`:
  - Atualizar `defaultWorkLogInclude`:
    ```ts
    assignedTo: {
      select: { id: true, name: true, email: true, role: true },
    },
    ```
  - Criar rota `PATCH /:id/assign`:
    - `authenticateToken`.
    - Body: `{ assignedToId: string | null }`.
    - Validar existência do chamado.
    - Se `assignedToId` informado, validar existência do usuário.
    - Atualizar `prisma.workLog.update({ where: { id }, data: { assignedToId } })`.
    - Se houve alteração de responsável, registrar no histórico ou notificar se aplicável.
    - Retornar `{ success: true, assignedTo: updated.assignedTo }`.
- [ ] **Step 2:** Em `src/services/api.ts`:
  - Atualizar interface `WorkLogItem` e `WorkLogDetailData` com `assignedToId?: string | null` e `assignedTo?: { id: string; name: string; email: string; role?: string | null } | null`.
  - Adicionar método `api.worklogs.assign(id: string, assignedToId: string | null)`.
- [ ] **Step 3:** Executar `npx tsc --noEmit` e commit: `feat(api): endpoint e cliente para atribuicao de responsavel no atendimento`.

---

### Task 3: Bloco de Responsável no Card Maximizado (`WorkLogDetailContent.tsx`)
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/dashboard/WorkLogDetailContent.tsx`

- [x] **Step 1:** Em `src/components/dashboard/WorkLogDetailContent.tsx`:
  - Adicionar bloco "Responsável Técnico" com suporte a:
    - Se `!log.assignedTo`: Botão destacado `[✋ Assumir Tarefa]` que atribui ao usuário atual com 1 clique, e botão/seletor de atribuição a outros membros da equipe.
    - Se `log.assignedTo`: Avatar com iniciais, nome, badge de cargo, indicador `(Você)` se for o próprio usuário, e botão para alterar ou desatribuir.
    - Disparar `api.worklogs.assign(log.id, targetUserId)` com feedback de loading e chamar `onRefresh?.()`.
- [x] **Step 2:** Validar funcionamento e consistência nos temas Claro e Escuro.
- [x] **Step 3:** Commit: `feat(ui): adicionar controle de responsavel e botao assumir tarefa no card maximizado`.

---

### Task 4: Exibição do Responsável no Card Minimizado (`ReportCardMinimized.tsx`)
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/ReportCardMinimized.tsx`

- [x] **Step 1:** Em `src/components/ReportCardMinimized.tsx`:
  - Adicionar `assignedTo?: { id: string; name: string; email?: string; role?: string | null } | null` na interface `ReportCardMinimizedLog`.
  - Na linha de metadados inferior (ao lado da data e anexos), renderizar o avatar compacto do responsável com as iniciais do nome, cor de destaque e tooltip "Responsável: [Nome]".
- [x] **Step 2:** Validar renderização nas colunas do Kanban.
- [x] **Step 3:** Commit: `feat(ui): exibir avatar do responsavel atribuido no card minimizado do kanban`.

---

### Task 5: Auditoria de QA e Verificação de Regressão
**Role/Subagent:** `qa-verifier` (QA Specialist)
**Files:**
- Full codebase audit

- [ ] **Step 1:** Executar `npx tsc --noEmit` e `npm run build`.
- [ ] **Step 2:** Testar fluxo de assumir tarefa, atribuir a outro técnico, e desatribuir.
- [ ] **Step 3:** Validar reflexo visual instantâneo no Kanban e nas listagens.
- [ ] **Step 4:** Validar temas Claro e Escuro.
- [ ] **Step 5:** Registrar aprovação no plano e concluir a entrega.

