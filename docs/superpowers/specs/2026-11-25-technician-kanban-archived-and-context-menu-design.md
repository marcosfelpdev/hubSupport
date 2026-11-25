# Especificação de Design — Área de Arquivados e Menu de Contexto no Kanban Técnico

**Data:** 2026-11-25  
**Status:** Proposto (Aguardando Aprovação)  
**Autor:** Antigravity Agent  
**Contexto:** HubSupport / Relix — Painel de Atendimentos Técnicos (`TechnicianPage.tsx` e `TechnicianKanbanBoard.tsx`)

---

## 1. Contexto e Objetivos

O **Painel Técnico** do Relix é o centro de comando operacional onde os técnicos gerenciam chamados distribuídos em colunas kanban (*Backlog*, *Pendências*, *Em progresso*, *Validação*, *Finalizadas*).

Atualmente:
1. Chamados cancelados, duplicados ou desconsiderados acabam poluindo as colunas do Kanban ou precisam ser excluídos definitivamente (o que perde o histórico de atendimento).
2. Para mover um card ou editar suas informações, o usuário depende exclusivamente do arrasto (drag-and-drop) ou de abrir o modal detalhado, sem uma opção rápida de menu de contexto com o botão direito.

**Objetivos da funcionalidade:**
- **Área de Arquivados:** Criar uma tela dedicada no painel técnico acessada por um botão `[ 📦 Arquivados (N) ]` ao lado do alternador de visualização (*Kanban / Lista*), permitindo arquivar cards e visualizá-los em uma tela isolada e limpa, com possibilidade de restaurá-los à sua coluna de origem ou excluí-los.
- **Menu de Contexto do Botão Direito:** Implementar um menu flutuante elegante ao clicar com o botão direito nos cards do Kanban, contendo as ações:
  - ✏️ **Editar** (abre o modal de edição existente `EditWorkLogModal`);
  - ➡️ **Transferir para...** (submenu ou lista das colunas: *Backlog*, *Pendências*, *Em progresso*, *Validação*, *Finalizadas*);
  - 📦 **Arquivar** (remove do Kanban ativo e move para Arquivados);
  - 🗑️ **Excluir** (em destaque vermelho com confirmação).

---

## 2. Abordagens Consideradas e Decisão

### Abordagem 1 (Escolhida): Flag Atômica `isArchived` no Banco + Tela Dedicada + Menu de Contexto Customizado
- **Modelo:** Adição dos campos `isArchived Boolean @default(false)` e `archivedAt DateTime?` no modelo `WorkLog` do Prisma.
- **Vantagem Principal:** O chamado mantém preservado o seu `status` original (ex.: se estava em "Em progresso" ou "Validação"). Ao ser restaurado dos arquivados, o card retorna exatamente para a coluna onde o técnico parou, sem perda de rastreabilidade.
- **Experiência do Usuário:** A visualização de arquivados abre como uma tela completa com navegação rápida de volta ao Kanban (`[ ← Voltar ao Quadro Kanban ]`).

### Abordagem 2 (Descartada): Status Puro "Arquivado" via String
- Alterar apenas a string `status = "Arquivado"`.
- **Motivo de Descarte:** Perde o histórico da coluna onde o card estava, forçando o chamado a voltar sempre para o *Backlog* e misturando etapas de trabalho com arquivamento administrativo.

---

## 3. Arquitetura de Dados e Contratos de API

### 3.1. Alteração no Banco de Dados (`prisma/schema.prisma`)
```prisma
model WorkLog {
  // ... campos existentes ...
  isArchived             Boolean   @default(false)
  archivedAt             DateTime?
  // ...
}
```

### 3.2. Endpoints da API REST (`src/server/routes/worklogs.routes.ts`)
1. **`GET /api/worklogs/technical`**
   - Atualizado para filtrar `where: { isArchived: false, ... }`, garantindo que itens arquivados não apareçam nas colunas ativas do Kanban nem na lista tradicional padrão.
2. **`GET /api/worklogs/archived`**
   - Retorna todos os chamados técnicos onde `isArchived: true`, ordenados por `archivedAt: desc`.
3. **`PATCH /api/worklogs/:id/archive`**
   - Atualiza `isArchived: true` e `archivedAt: new Date()`.
   - Registra auditoria/histórico seguro.
4. **`PATCH /api/worklogs/:id/unarchive`**
   - Atualiza `isArchived: false` e `archivedAt: null`.
   - Restaura o card para o quadro imediatamente.
5. **`DELETE /api/worklogs/:id`**
   - Exclusão física definitiva já existente no backend, protegida por autenticação.

---

## 4. Arquitetura de Frontend e Componentes

### 4.1. Cabeçalho de `TechnicianPage.tsx`
- Adição do botão de arquivados posicionado imediatamente ao lado do seletor de visualização:
  ```
  [ 🔄 Atualizar ]   [ 📦 Arquivados (3) ]   [ [ Quadro Kanban (Operações) ]  [ Lista Tradicional ] ]
  ```
- O botão exibe o contador dinâmico de itens arquivados.
- Ao clicar, altera `viewMode = "archived"`.

### 4.2. Nova Tela: `TechnicianArchivedView.tsx`
- **Barra de Ações Superior:**
  - Botão `[ ← Voltar ao Quadro Kanban ]` com transição suave;
  - Título com contador: "Chamados Arquivados (N)";
  - Campo de busca instantânea (filtra por título, solicitante, cliente ou problema relatado).
- **Grade de Cards Arquivados:**
  - Reutiliza a identidade visual corporativa do Relix (cards brancos/dark, bordas sutis, tags de categoria e cliente);
  - Exibe a data de arquivamento e a etapa de origem (ex.: "Arquivado de: Em progresso");
  - Botão **"Restaurar ao Kanban"** (`ArchiveRestore`): desarquiva e devolve o card para o quadro;
  - Botão **"Excluir"** (`Trash2`): abre confirmação para exclusão definitiva.
- **Empty State:** Ilustração com ícone `Inbox` ou `Archive` e mensagem amigável quando não houver itens arquivados.

### 4.3. Menu de Contexto: `KanbanCardContextMenu.tsx`
- **Trigger:** Captura do evento `onContextMenu` em cada card do Kanban (`ReportCardMinimized`).
- **Posicionamento:** Posicionado nas coordenadas `(x, y)` do clique com clamp para não ultrapassar a viewport (`window.innerWidth`, `window.innerHeight`).
- **Estrutura Visual:**
  - Container flutuante via `createPortal` com `z-50`, backdrop invisível para fechar ao clicar fora, bordas suaves `rounded-xl`, sombra `shadow-xl`, tema claro e escuro.
- **Itens do Menu:**
  1. ✏️ **Editar Chamado:** Dispara o `EditWorkLogModal` existente.
  2. ➡️ **Transferir para...:**
     - Submenu/lista expansível contendo as 5 colunas do quadro (*Backlog*, *Pendências*, *Em progresso*, *Validação*, *Finalizadas*).
     - Identifica a coluna atual e a desabilita.
     - Respeita as regras de negócio do quadro (ex.: transferência para validação / reprovação).
  3. 📦 **Arquivar Chamado:** Chama a API de arquivamento com atualização otimista (o card desaparece suavemente do Kanban).
  4. 🗑️ **Excluir Chamado:** Em vermelho no rodapé do menu, solicitando confirmação prévia.
- **Fechamento:** Fecha ao teclar `Escape`, ao clicar fora ou ao executar qualquer ação.

---

## 5. Tratamento de Casos de Borda

1. **Card clicado perto da borda inferior ou direita da tela:** O cálculo do menu inverterá o offset (abrindo para cima ou para a esquerda) evitando barras de rolagem artificiais na página.
2. **Desarquivar card de chamado excluído/modificado:** Validação atômica no backend; se o chamado não existir mais, retorna `404` com feedback claro.
3. **Card transferido para "Finalizadas" pelo menu de contexto:** A regra mandatória de validação continua ativa (se tentar mover diretamente para Finalizadas sem aprovação prévia, alerta e direciona para Validação).
4. **Fechamento de menus simultâneos:** Apenas um menu de contexto pode existir aberto por vez.

---

## 6. Próximo Passo

Com a sua aprovação deste design doc, iniciaremos a criação do plano de execução detalhado (`writing-plans`) e a implementação passo a passo.
