# Alteração Global de Status e Linha do Tempo de Histórico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que qualquer usuário altere o status de um atendimento já criado diretamente no card maximizado e exibir no canto inferior do card uma linha do tempo de histórico detalhando quem realizou cada alteração de status, a transição ocorrida e a data/hora.

**Architecture:**
1. No schema do Prisma (`prisma/schema.prisma`), criar o modelo `WorkLogStatusHistory` com relações com `WorkLog` e `User`. Sincronizar com o banco via `npx prisma db push`.
2. No backend (`src/server/routes/worklogs.routes.ts`), atualizar `PATCH /api/worklogs/:id/status` para gravar a transição de status no histórico e retornar o histórico atualizado. Atualizar `GET /api/worklogs` para incluir `statusHistory` com os dados do usuário.
3. No cliente de API (`src/services/api.ts`), adicionar as tipagens de `WorkLogStatusHistoryItem` e atualizar os métodos correspondentes.
4. No componente `src/components/dashboard/WorkLogDetailContent.tsx`, transformar o badge de status do cabeçalho em um seletor interativo com feedback visual e implementar a seção visual de Linha do Tempo de Histórico no canto inferior do card.
5. Realizar auditoria completa de QA com `qa-verifier` validando tipagem, compilação, transições de status e integridade visual nos modos Claro e Escuro.

**Tech Stack:** Node.js, Express, Prisma ORM, SQLite, React 19, TypeScript, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-02-worklog-status-change-and-history-timeline-design.md`

## Global Constraints
- Escopo global de edição: qualquer usuário autenticado pode alterar o status.
- Preservar compatibilidade total com o Design System CloudNexus nos temas Claro e Escuro.
- Toda alteração de status deve registrar um registro correspondente em `WorkLogStatusHistory` com o ID do usuário da sessão JWT.
- Ao atualizar o schema, certificar-se de que o Prisma Client seja gerado sem conflitos de arquivo no Windows.

## Review Focus
- Seletor de status: deve permitir alternar facilmente entre os status sem travar ou quebrar o layout.
- Persistência e auditoria: a alteração deve persistir no banco e refletir instantaneamente na linha do tempo.
- Linha do tempo: exibe nome do autor da mudança, transição de status e data/hora com linha conectora vertical.
- Não alteração quando selecionado o mesmo status: se o usuário selecionar o status que já está ativo, nenhuma linha redundante deve ser criada no histórico.

---

### Task 1: Modelo de Dados no Prisma e Migração do Banco
**Role/Subagent:** `self` (Backend / Database Specialist)
**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1:** Adicionar modelo `WorkLogStatusHistory` em `prisma/schema.prisma`:
  ```prisma
  model WorkLogStatusHistory {
    id          String   @id @default(cuid())
    workLogId   String
    workLog     WorkLog  @relation(fields: [workLogId], references: [id], onDelete: Cascade)
    fromStatus  String
    toStatus    String
    changedById String
    changedBy   User     @relation(fields: [changedById], references: [id], onDelete: Cascade)
    createdAt   DateTime @default(now())
  }
  ```
  Adicionar relações em `WorkLog` (`statusHistory WorkLogStatusHistory[]`) e `User` (`statusChanges WorkLogStatusHistory[]`).
- [x] **Step 2:** Parar temporariamente o processo de watch do backend (`task-1819`), executar `npx prisma db push` e reiniciar o watch do backend.
- [x] **Step 3:** Executar `npx tsc --noEmit` para verificar a integridade dos tipos gerados pelo Prisma.
- [x] **Step 4:** Commit: `feat(db): adicionar modelo WorkLogStatusHistory para auditoria de transicoes de status`.

---

### Task 2: Rotas de API e Cliente HTTP
**Role/Subagent:** `self` (Backend Specialist)
**Files:**
- Modify: `src/server/routes/worklogs.routes.ts`
- Modify: `src/services/api.ts`

- [x] **Step 1:** Em `src/server/routes/worklogs.routes.ts`:
  - Na rota `PATCH /:id/status`:
    - Validar existência do chamado.
    - Se `workLog.status !== status.trim()`:
      - Atualizar `workLog.status`.
      - Criar registro em `prisma.workLogStatusHistory.create` com `workLogId`, `fromStatus: workLog.status`, `toStatus: status.trim()`, `changedById: req.user.id`.
      - Buscar histórico atualizado ordenado por `createdAt: "asc"`.
    - Retornar `{ success: true, status: updated.status, history }`.
  - Na rota `GET /` e `GET /:id`:
    - Incluir `statusHistory` com `changedBy: { select: { id: true, name: true, role: true } }` ordenado por `createdAt: "asc"`.
  - Na rota `POST /` (criação):
    - Criar o primeiro registro de histórico: `fromStatus: "Criação"`, `toStatus: finalStatus`, `changedById: user.id`.
- [x] **Step 2:** Em `src/services/api.ts`:
  - Adicionar interface `WorkLogStatusHistoryItem`.
  - Adicionar campo `statusHistory?: WorkLogStatusHistoryItem[]` em `WorkLogItem`.
  - Atualizar método `api.worklogs.updateStatus` para retornar o histórico atualizado.
- [x] **Step 3:** Executar `npx tsc --noEmit` e commit: `feat(api): persistir e retornar historico de alteracoes de status dos atendimentos`.

---

### Task 3: Seletor Interativo de Status e Linha do Tempo Visual
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/dashboard/WorkLogDetailContent.tsx`

- [x] **Step 1:** Em `src/components/dashboard/WorkLogDetailContent.tsx`:
  - Atualizar o cabeçalho do card:
    - Transformar a pílula de status em um dropdown/seletor interativo estilizado no padrão CloudNexus.
    - Permitir a seleção entre as opções: `Realizado`, `Em andamento`, `Solucionado`, `Aguardando reunião`, `Não foi possível realizar`, `Backlog`.
    - Ao selecionar novo status, disparar chamada assíncrona a `api.worklogs.updateStatus(log.id, newStatus)` com spinner discreto e feedback em tempo real.
    - Atualizar o estado local e chamar `onRefresh?.()` para atualizar as listagens globais.
  - Implementar seção de Linha do Tempo no canto inferior do card:
    - Container estilizado com cabeçalho "Histórico de Alterações de Status" e ícone `Clock` / `History`.
    - Lista vertical de eventos com linha conectora cinza/slate e marcadores coloridos com dots.
    - Cada item exibe:
      - Nome de quem realizou a alteração e badge com seu cargo.
      - Transição de status estilizada: `Status Anterior ➔ Novo Status`.
      - Timestamp formatado em português (`DD/MM/AAAA às HH:mm`).
    - Suporte a rolagem caso haja muitas alterações.
- [x] **Step 2:** Validar funcionamento e consistência nos temas Claro e Escuro.
- [x] **Step 3:** Executar `npx vite build` para checagem de build.
- [x] **Step 4:** Commit: `feat(ui): seletor interativo de status e linha do tempo de historico no card maximizado`.

---

### Task 4: Auditoria de QA e Verificação de Regressão
**Role/Subagent:** `qa-verifier` (QA Specialist)
**Files:**
- Full codebase audit

- [x] **Step 1:** Executar `npx tsc --noEmit` e `npx vite build`.
- [x] **Step 2:** Testar alteração de status em chamados reais pelo seletor e verificar persistência no banco e na linha do tempo.
- [x] **Step 3:** Verificar se as listagens refletem o novo status imediatamente.
- [x] **Step 4:** Validar temas Claro e Escuro.
- [x] **Step 5:** Registrar aprovação no plano e concluir a entrega.

