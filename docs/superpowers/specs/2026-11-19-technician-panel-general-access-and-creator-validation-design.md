# Design Spec — Acesso Geral ao Painel Técnico e Validação Exclusiva pelo Criador

## 1. Visão Geral
Atualmente, o acesso ao Painel Técnico (`/dashboard/tecnico`) e Kanban é restrito apenas a usuários com perfil `TECHNICIAN` e `ADMIN`. Além disso, qualquer técnico ou administrador tem permissão para homologar atendimentos na fase de "Validação" clicando em "Aprovar Solução".

Esta alteração define duas diretrizes centrais:
1. **Acesso Universal:** Todos os usuários autenticados (independentemente do papel `ADMIN`, `TECHNICIAN`, `USER`, `MANAGER`, `SUPPORT`) terão acesso ao Painel Técnico, ao quadro Kanban e suas funcionalidades (incluindo menu na Sidebar e rotas protegidas).
2. **Governança Estrita de Validação (Criador Original):** Apenas o usuário que inicialmente criou o relatório (`workLog.userId === currentUser.id`) pode validar/aprovar a solução e transitar o atendimento para `Solucionado`. Demais usuários e técnicos continuam podendo visualizar, editar, adicionar notas e reprovar/retornar o chamado se necessário, mas a aprovação final é restrita ao autor original da solicitação.

---

## 2. Arquitetura e Alterações Propostas

### 2.1 Frontend: Rotas e Navegação
- **`src/App.tsx`:**
  - Remover `allowedRoles={["TECHNICIAN", "ADMIN"]}` da rota `/dashboard/tecnico`, mantendo apenas o `ProtectedRoute` comum de autenticação.
- **`src/components/Sidebar.tsx`:**
  - Exibir o item de menu "Painel Técnico" incondicionalmente no bloco "GESTÃO" para todos os usuários logados.

### 2.2 Backend: Governança REST API (`src/server/routes/worklogs.routes.ts`)
- **`PATCH /api/worklogs/:id/resolve`:**
  - Remover `requireTechnicianOrAdmin`, aplicando apenas `authenticateToken`.
  - Validar estritamente a autoria:
    ```ts
    if (existing.userId !== req.user!.id) {
      res.status(403).json({
        error: "Apenas o usuário que inicialmente criou o relatório pode validar e aprovar a solução.",
      });
      return;
    }
    ```
- **`PATCH /api/worklogs/:id/status`:**
  - Caso `isToFinished`: se o status for direcionado a `Solucionado` a partir de `Validação`, verificar se `existing.userId === req.user!.id`. Se não for, retornar `403 Forbidden`.
- **`PATCH /api/worklogs/:id/assign`:**
  - Remover `requireTechnicianManagerOrAdmin`, mantendo `authenticateToken`, permitindo que os usuários autenticados possam assumir ou designar tarefas no kanban.

### 2.3 Frontend: Interface do Card Maximizado & Visualização Técnica
- **`src/components/dashboard/WorkLogDetailContent.tsx`:**
  - Calcular `isCreator = !!(currentUser?.id && (currentLog.userId === currentUser.id || log.userId === currentUser.id));`
  - Liberar visualização do banner de validação para todos os usuários autenticados quando o chamado estiver em `Validação`.
  - Botão "Aprovar Solução":
    - Habilitado exclusivamente quando `isCreator === true`.
    - Quando `!isCreator`: botão desabilitado (`disabled`), com cursor `not-allowed`, estilo atenuado e tooltip explicando que a aprovação é exclusiva do criador.
    - Exibir aviso informativo no banner: `🔒 Aprovação restrita ao autor original deste relatório ({creatorName})`.
  - No dropdown de status (`handleSelectStatus`), caso o usuário tente selecionar "Solucionado" sem ser o criador, bloquear com mensagem amigável no estado `statusError`.
- **`src/components/TechnicianDashboardClient.tsx`:**
  - Verificar se `selectedLog.userId === currentUserId`. Se não for, desabilitar o botão "Marcar como Solucionado".

---

## 3. Testes e Critérios de Aceite
1. Usuário com role `USER` consegue acessar `/dashboard/tecnico` e carregar o Kanban.
2. Usuário com role `USER` vê o menu "Painel Técnico" na Sidebar.
3. Se um Técnico ou Admin tentar aprovar um chamado que NÃO foi criado por ele, a API bloqueia com status `403` e o botão na UI permanece desabilitado com aviso explicativo.
4. O autor original do chamado (mesmo sendo `USER`) consegue clicar em "Aprovar Solução" e o atendimento é concluído com sucesso (`status = "Solucionado"`).
5. Build de produção (`npm run build`) e verificação de tipos (`npx tsc --noEmit`) sem erros.
