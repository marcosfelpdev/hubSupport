# Plano de Implementação — Acesso Geral ao Painel Técnico e Validação Exclusiva pelo Criador

## Task 1: Backend — Acesso REST API e Validação Estrita pelo Criador
- **Arquivos:** `src/server/routes/worklogs.routes.ts`
- **Ações:**
  1. Em `PATCH /api/worklogs/:id/resolve`:
     - Remover o middleware `requireTechnicianOrAdmin`, aplicando apenas `authenticateToken`.
     - Validar `if (existing.userId !== req.user!.id)` -> retornar status 403 com mensagem clara.
  2. Em `PATCH /api/worklogs/:id/status`:
     - Ao tentar definir `Solucionado` a partir de `Validação`, verificar se `existing.userId === req.user!.id`. Se não for o criador, retornar status 403.
  3. Em `PATCH /api/worklogs/:id/assign`:
     - Remover `requireTechnicianManagerOrAdmin` e usar `authenticateToken`.

## Task 2: Frontend — Acesso Geral na Navegação e Rotas
- **Arquivos:** `src/App.tsx`, `src/components/Sidebar.tsx`
- **Ações:**
  1. Em `src/App.tsx`:
     - Remover `allowedRoles={["TECHNICIAN", "ADMIN"]}` da rota `/dashboard/tecnico`.
  2. Em `src/components/Sidebar.tsx`:
     - Exibir o item "Painel Técnico" incondicionalmente no grupo "GESTÃO".

## Task 3: Frontend — Regra Visual no Card Maximizado e Dashboard
- **Arquivos:** `src/components/dashboard/WorkLogDetailContent.tsx`, `src/components/TechnicianDashboardClient.tsx`
- **Ações:**
  1. Em `src/components/dashboard/WorkLogDetailContent.tsx`:
     - Calcular `isCreator`.
     - Permitir `canApproveOrRejectValidation = !!currentUser`.
     - No botão "Aprovar Solução", desabilitar se `!isCreator` com title explicativo e feedback sutil.
     - Em `handleSelectStatus`, bloquear seleção direta de "Solucionado" por não-criadores.
  2. Em `src/components/TechnicianDashboardClient.tsx`:
     - Desabilitar botão "Marcar como Solucionado" se `selectedLog.userId !== currentUserId`.

## Task 4: Testes Automatizados E2E e Validação de Build
- **Arquivos:** `scripts/test-creator-validation-e2e.ts`
- **Ações:**
  1. Escrever suíte cobrindo criação por usuário comum, tentativa de aprovação por técnico (bloqueada com 403) e aprovação pelo criador (sucesso).
  2. Executar script com `npx tsx scripts/test-creator-validation-e2e.ts`.
  3. Executar `npx tsc --noEmit` e `npm run build`.
