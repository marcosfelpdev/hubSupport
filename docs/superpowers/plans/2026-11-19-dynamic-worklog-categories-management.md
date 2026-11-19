# Gerenciamento Dinâmico de Categorias de Atendimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as categorias de tipo de atendimento totalmente dinâmicas e gerenciáveis pela administração na aba de Configurações, com suporte a customização de nome, subtítulo, ícone, cor, gatilho de notificação por função, direcionamento para o Kanban e trava de status inicial, aplicando seleção única no formulário de atendimento e garantindo retrocompatibilidade total com o histórico.

**Architecture:** 
- Entidade `WorkLogCategory` no Prisma com relacionamento 1:N com `WorkLog` (`categoryId`).
- Endpoints REST em `/api/categories` com proteção RBAC estrita (`requireAdmin` para modificações).
- Aba administrativa exclusiva para administradores em `SettingsPage.tsx` com catálogo visual de ícones Lucide, paleta de cores e regras de fluxo.
- Formulário `WorkLogForm.tsx` alimentado dinamicamente via API com seleção única tipo rádio customizado e trava automática de status.
- Badges e filtros do Kanban técnico adaptados dinamicamente para ler a categoria vinculada.
- Espelhamento nos campos booleanos legados (`technicalAction`, `implementation`, `isPrompt`, `isIdea`) para preservar integridade de dados históricos.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Node.js, Express 5, Prisma ORM, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-19-dynamic-worklog-categories-management-design.md`

## Global Constraints
- Apenas usuários com `role: "ADMIN"` podem criar, editar, alterar ou excluir categorias de atendimento.
- No formulário de chamados, o usuário pode selecionar no máximo UMA categoria (seleção única com desmarcação permitida).
- O layout de duas colunas (`grid grid-cols-1 sm:grid-cols-2 gap-3`) deve ser preservado para qualquer quantidade de categorias.
- Não quebrar chamados existentes nem consultas antigas: espelhar flags legadas no backend.
- Verificação obrigatória com `npx vite build` e suíte de testes de integração com 100% de aprovação.

## Review Focus
1. Usuário não-admin (role `USER` ou `TECHNICIAN`) tentando acessar rotas de mutação de categorias recebe `403 Forbidden`.
2. Criação de WorkLog com categoria que possui `lockStatus: true` força status inicial em `targetStatus` (ex: "Backlog").
3. Criação de WorkLog com categoria que possui `notifyRole: "TECHNICIAN"` dispara notificação exclusivamente para técnicos ativos.
4. Desmarcar o card de categoria restaura a liberdade de escolha do status inicial no formulário.
5. Chamados antigos criados com flags booleanas mantêm exibição de seus badges sem erros de `undefined`.

---

## Tasks

### Task 1: Modelagem Prisma, Banco de Dados & Seed Idempotente
**Files:**
- Modify: `prisma/schema.prisma`
- Create/Modify: `scripts/seed.ts`
- Test: `scripts/test-categories-db.ts`

- [ ] Adicionar modelo `WorkLogCategory` no `prisma/schema.prisma` com campos: `id`, `slug`, `name`, `subtitle`, `icon`, `color`, `notifyRole`, `targetKanban`, `lockStatus`, `targetStatus`, `active`, `order`, `createdAt`, `updatedAt`, `workLogs`.
- [ ] Adicionar relacionamento `categoryId String?` e `category WorkLogCategory?` em `WorkLog`.
- [ ] Executar `npx prisma db push` para sincronizar o banco localmente.
- [ ] Atualizar script de seed (`scripts/seed.ts`) com as 4 categorias padrão (`Ação Técnica`, `Implementação`, `Prompt`, `Ideia`) e vincular chamados existentes através de seus booleanos.
- [ ] Criar e rodar teste `scripts/test-categories-db.ts` validando a existência e queries relacionais.
- [ ] Commit das alterações da Task 1.

---

### Task 2: Backend REST API (`/api/categories`) e Integração em `worklogs.routes.ts`
**Files:**
- Create: `src/server/routes/categories.routes.ts`
- Modify: `src/server/index.ts`
- Modify: `src/server/routes/worklogs.routes.ts`
- Modify: `src/services/api.ts`
- Test: `scripts/test-categories-api.ts`

- [ ] Criar `src/server/routes/categories.routes.ts` com rotas `GET /` (público/autenticado), `POST /` (ADMIN), `PUT /:id` (ADMIN), `DELETE /:id` (ADMIN).
- [ ] Adicionar middleware `requireAdmin` garantindo que apenas administradores realizem mutações.
- [ ] Registrar `/api/categories` em `src/server/index.ts`.
- [ ] Atualizar `POST /api/worklogs` em `src/server/routes/worklogs.routes.ts`:
  - Receber `categoryId`.
  - Se categoria informada, consultar suas regras (`lockStatus`, `targetStatus`, `targetKanban`, `notifyRole`).
  - Disparar notificações dinâmicas para os usuários com `role === category.notifyRole`.
  - Espelhar flags booleanas legadas com base no slug ou mapeamento para compatibilidade.
- [ ] Adicionar tipos e métodos em `src/services/api.ts` (`api.categories.getAll`, `create`, `update`, `delete`).
- [ ] Criar teste de integração `scripts/test-categories-api.ts` cobrindo RBAC (403 para não-admin) e fluxo de chamados.
- [ ] Commit das alterações da Task 2.

---

### Task 3: Interface Administrativa de Gestão na aba Configurações (`SettingsPage.tsx`)
**Files:**
- Create: `src/components/CategoryIconPicker.tsx`
- Modify: `src/pages/SettingsPage.tsx`

- [ ] Criar componente `src/components/CategoryIconPicker.tsx` exibindo catálogo visual amigável com ícones do Lucide (Cog, Rocket, Sparkles, Lightbulb, Wrench, Server, Shield, Bug, Code, HelpCircle, Zap, Palette, FileText, Database, Terminal, Cpu).
- [ ] Na `SettingsPage.tsx`, verificar a role do usuário logado via contexto de autenticação:
  - Exibir a aba **"Categorias de Atendimento"** exclusivamente se `user.role === 'ADMIN'`.
- [ ] Construir tabela e cards visuais das categorias cadastradas com prévia exata do card do formulário.
- [ ] Implementar modal de criação e edição com validações:
  - Nome e subtítulo.
  - Seletor visual de ícones (`CategoryIconPicker`).
  - Paleta de cores do sistema.
  - Seletor de função a notificar (`TECHNICIAN`, `ADMIN`, `MANAGER`, etc. ou `Nenhum`).
  - Switches de direcionamento para Kanban e trava de status inicial.
- [ ] Implementar confirmação de exclusão / desativação segura.
- [ ] Commit das alterações da Task 3.

---

### Task 4: Atualização do Formulário de Atendimento com Seleção Única (`WorkLogForm.tsx`)
**Files:**
- Modify: `src/components/WorkLogForm.tsx`

- [ ] Carregar categorias ativas via `api.categories.getAll()` no carregamento do formulário.
- [ ] Substituir os 4 hooks booleanos fixos por um único estado `selectedCategoryId: string | null`.
- [ ] Implementar comportamento de seleção única:
  - Clicar em um card seleciona a categoria.
  - Clicar novamente no card selecionado desmarca.
- [ ] Renderizar dinamicamente os cards na grade `grid grid-cols-1 sm:grid-cols-2 gap-3`, aplicando a cor, ícone, título e subtítulo dinâmicos da categoria.
- [ ] Quando uma categoria com `lockStatus: true` for selecionada:
  - Travar o seletor de status inicial para `targetStatus` com badge visual `<Lock /> Fixo em {targetStatus}`.
  - Ao desmarcar, restaurar a livre escolha de status inicial.
- [ ] Submeter `categoryId` no payload do formulário.
- [ ] Commit das alterações da Task 4.

---

### Task 5: Atualização do Kanban Técnico e Badges Dinâmicos
**Files:**
- Modify: `src/components/ReportCardMinimized.tsx`
- Modify: `src/components/dashboard/WorkLogDetailContent.tsx`
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`

- [ ] No `ReportCardMinimized.tsx`: renderizar o badge com base na `category` vinculada (ícone dinâmico, cor de fundo/borda e nome), mantendo fallback para as flags booleanas antigas se `category` for nulo.
- [ ] No `WorkLogDetailContent.tsx`: exibir o chip dinâmico da categoria no cabeçalho do chamado.
- [ ] No `TechnicianKanbanBoard.tsx`: carregar as categorias que possuem `targetKanban: true` e exibir abas de filtro dinâmicas além de "Todos".
- [ ] Commit das alterações da Task 5.

---

### Task 6: Suíte de Testes Automatizados E2E & Build Final
**Files:**
- Create: `scripts/test-dynamic-categories-e2e.ts`

- [ ] Criar script de teste E2E `scripts/test-dynamic-categories-e2e.ts` testando:
  1. Criação de nova categoria customizada por ADMIN.
  2. Tentativa de criação por usuário comum (bloqueado com 403).
  3. Criação de chamado selecionando a categoria customizada.
  4. Validação da trava em Backlog e da geração de notificação para a role configurada.
  5. Consulta no Kanban técnico e verificação da retrocompatibilidade com chamados legados.
  6. Limpeza idempotente dos dados de teste.
- [ ] Executar `npx tsx scripts/test-dynamic-categories-e2e.ts` garantindo 100% de sucesso.
- [ ] Executar `npx vite build` garantindo zero erros de compilação TypeScript e Vite.
- [ ] Commit final e preparação para entrega.
