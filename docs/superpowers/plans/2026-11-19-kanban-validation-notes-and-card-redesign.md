# Kanban Validation Workflow, Notes, Report Editing & Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar governança obrigatória de validação no Kanban, notas e recusa justificada de homologação, edição e histórico de relatórios, e redesign minimalista dos cards minimizados com ícones no topo direito.

**Architecture:** Modelagem de notas (`WorkLogNote`) no Prisma/Postgres, rotas REST de edição (`PUT /api/worklogs/:id`) e notas (`POST/GET /api/worklogs/:id/notes`), intercepções no `handleDrop` do Kanban técnico com modal obrigatório de justificativa de reprovação e alerta de validação prévia para finalização, seção de histórico e notas no card maximizado, e refatoração do `ReportCardMinimized` para ícones semânticos de status e categoria no canto superior direito sem faixa de rodapé.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Express 5, Prisma ORM 5, PostgreSQL (Supabase).

**Spec:** `docs/superpowers/specs/2026-11-19-kanban-validation-notes-and-card-redesign-design.md`

## Global Constraints
- Nenhuma operação pode mover um chamado diretamente para a coluna "Finalizadas" via drag-and-drop; o sistema deve forçar a ida para "Validação" com notificação visual.
- A finalização do chamado é restrita ao clique no botão "Aprovar Solução" no card em validação.
- O retorno de um card da coluna "Validação" para colunas anteriores exige justificativa obrigatória, gerando uma nota do tipo `rejection` e ativando indicador no card minimizado.
- Qualquer edição no relatório deve registrar um evento descritivo no histórico de status do atendimento (`WorkLogStatusHistory`).
- O card minimizado não deve possuir faixa de rodapé nem texto por extenso de status; apenas ícones proporcionais no canto superior direito.
- Build de produção (`npx vite build`) e typecheck (`npx tsc --noEmit`) devem passar com zero erros.

## Review Focus
- Tentativa de arrastar card para "Finalizadas" sem passar por validação.
- Tentativa de recuar card de "Validação" sem fornecer justificativa (deve ser bloqueada tanto no front quanto com 400 no backend).
- Edição de relatório por usuário comum e técnico registrando autor e data no histórico.
- Renderização limpa do card minimizado sem rodapé e com ícones corretos de categoria e status.
- Persistência e integridade referencial das notas associadas ao atendimento.

---

### Task 1: Modelagem Prisma e Migração de Banco (`WorkLogNote`)
**Files:**
- Modify: `prisma/schema.prisma`
- Test: `scripts/test-validation-notes-db.ts`

- [ ] Adicionar modelo `WorkLogNote` no `prisma/schema.prisma` com `workLogId`, `userId`, `content`, `type` ("general" | "rejection"), `createdAt`, `updatedAt`.
- [ ] Adicionar campo `hasValidationRejection Boolean @default(false)` e relação `notes WorkLogNote[]` no modelo `WorkLog`.
- [ ] Executar `npx prisma db push` para aplicar no PostgreSQL.
- [ ] Criar script `scripts/test-validation-notes-db.ts` verificando criação de notas, integridade relacional e flags.
- [ ] Commit: `feat(database): modelo WorkLogNote e flag hasValidationRejection no Prisma`.

---

### Task 2: Backend REST API (Edição, Notas e Validação Estrita)
**Files:**
- Modify: `src/server/routes/worklogs.routes.ts`
- Modify: `src/services/api.ts`
- Test: `scripts/test-validation-notes-api.ts`

- [ ] Incluir relação `notes` no `defaultWorkLogInclude` com dados do usuário autor ordenados por `createdAt: "desc"`.
- [ ] Atualizar `PATCH /api/worklogs/:id/status`:
  - Se `existing.status` for `"Validação"` e o novo status for `"Backlog"`, `"Pendências"` ou `"Em progresso"`: exigir `rejectionReason` (string não vazia). Salvar nota `type = "rejection"`, setar `hasValidationRejection = true`, e registrar no histórico.
  - Se a rota receber requisição para mover direto para `"Solucionado"` sem passar pelo botão de aprovação, redirecionar para `"Validação"`.
- [ ] Implementar rota `PUT /api/worklogs/:id` para edição completa de dados do atendimento por usuários autenticados, registrando alteração no histórico.
- [ ] Implementar rotas `GET /api/worklogs/:id/notes` e `POST /api/worklogs/:id/notes`.
- [ ] Atualizar cliente `api.worklogs` em `src/services/api.ts` com métodos `update`, `getNotes`, `addNote`, e parâmetro `rejectionReason` em `updateStatus`.
- [ ] Criar e executar `scripts/test-validation-notes-api.ts`.
- [ ] Commit: `feat(api): rotas de notas, edicao de relatorios e trava de validacao estrita`.

---

### Task 3: Redesign do Card Minimizado (`ReportCardMinimized.tsx`)
**Files:**
- Modify: `src/components/ReportCardMinimized.tsx`

- [ ] Remover a faixa inferior de rodapé (`footerConfig` div).
- [ ] Remover o pill de status textual largo do canto superior direito.
- [ ] Criar helper de ícone semântico de status:
  - *Backlog:* `Inbox` (`text-indigo-500`)
  - *Pendências:* `Clock` (`text-amber-500`)
  - *Em progresso:* `Hourglass` (`text-sky-500`)
  - *Validação:* `ShieldAlert` (`text-purple-500`)
  - *Finalizadas / Solucionado:* `CheckCircle2` (`text-emerald-500`)
- [ ] Inserir no canto superior direito:
  - Ícone de IA (Sparkles).
  - Ícone indicador de recusa prévia (se `hasValidationRejection` for true, ícone `AlertTriangle` âmbar com tooltip).
  - Ícone de Categoria: obtido via `getCategoryIconComponent(log.category?.icon)` estilizado com a cor da categoria e tooltip com o nome.
  - Ícone de Status: ícone semântico com tooltip do status atual.
- [ ] Manter proporções e layout limpo mantendo altura de `185px`.
- [ ] Commit: `feat(cards): redesign do card minimizado com icones de categoria e status sem rodape`.

---

### Task 4: Fluxo de Drag-and-Drop e Governança no Kanban (`TechnicianKanbanBoard.tsx`)
**Files:**
- Create: `src/components/dashboard/ValidationRejectionModal.tsx`
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`

- [ ] Criar componente `ValidationRejectionModal.tsx`:
  - Modal limpo e focado, alertando que o chamado está retornando de Validação.
  - Campo textarea obrigatório para preencher o motivo da recusa.
  - Botão de confirmar bloqueado se o motivo estiver vazio.
  - Botão de cancelar que aborta a movimentação e mantém o card em Validação.
- [ ] Em `TechnicianKanbanBoard.tsx`:
  - No `handleDrop`:
    - Se `targetColId === "finalizadas"`:
      - Interceptar e bloquear.
      - Disparar aviso na tela: *"Atenção: Todo atendimento precisa passar pela coluna de Validação e ser aprovado no botão 'Aprovar Solução'."*
      - Mover o card para `validacao` no estado local e no backend.
    - Se o card estiver em `validacao` e for solto em `backlog`, `pendencias` ou `em_progresso`:
      - Interceptar o drop e abrir o `ValidationRejectionModal` guardando `{ logId, targetColId, newStatus }`.
      - Ao submeter a justificativa no modal: chamar `api.worklogs.updateStatus(logId, newStatus, rejectionReason)` e persistir.
- [ ] Commit: `feat(kanban): governanca de validacao no drag-and-drop e modal obrigatorio de recusa`.

---

### Task 5: Edição de Relatório e Painel de Notas no Card Maximizado (`WorkLogDetailContent.tsx`)
**Files:**
- Modify: `src/components/dashboard/WorkLogDetailContent.tsx`

- [ ] No banner de Validação:
  - Ao clicar em "Reprovar / Retornar": abrir o modal de justificativa obrigatória antes de disparar o retorno.
- [ ] Adicionar seção de "Histórico de Notas e Apontamentos":
  - Listagem de notas com destaque em notas de reprovação de validação (`type === "rejection"`).
  - Formulário para adicionar nova nota livre em qualquer momento.
- [ ] Adicionar botão "Editar Atendimento" no cabeçalho do detalhe:
  - Abre modal ou modo inline de edição dos dados (título, solicitante, cliente/escritório, problema, solução).
  - Ao salvar, envia `api.worklogs.update(id, data)` e atualiza o histórico em tempo real.
- [ ] Commit: `feat(details): secao de notas, historico de edicoes e fluxo de recusa no card maximizado`.

---

### Task 6: Testes E2E, Verificação de Qualidade e Merge
**Files:**
- Create: `scripts/test-validation-flow-e2e.ts`

- [ ] Criar suíte E2E automatizada cobrindo:
  1. Bloqueio de arraste direto para finalizadas (redirecionando para validação).
  2. Aprovação legítima pelo botão "Aprovar Solução" movendo para Solucionado.
  3. Recuo de validação para "Em progresso" com justificativa obrigatória e gravação de `WorkLogNote`.
  4. Validação do indicador sutil no card minimizado e na listagem geral.
  5. Edição de dados do chamado com registro no histórico.
- [ ] Executar `npx tsx scripts/test-validation-flow-e2e.ts`.
- [ ] Executar `npx tsc --noEmit` e `npx vite build` (zero erros).
- [ ] Criar Pull Request no GitHub, acompanhar CI e mesclar na `main`.
