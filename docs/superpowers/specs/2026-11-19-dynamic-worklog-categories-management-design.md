# Design Doc: Gerenciamento Dinâmico de Categorias de Atendimento

**Data:** 2026-11-19  
**Autor:** Antigravity  
**Status:** Em Revisão / Alinhado com o Usuário  

---

## 1. Visão Geral & Problema a Resolver

Atualmente no HubSupport, as categorias de tipo de atendimento (Ação Técnica, Implementação, Prompt e Ideia) são codificadas de forma estática (*hardcoded*):
- Existem 4 colunas booleanas dedicadas no modelo `WorkLog` do Prisma.
- O backend aplica regras fixas de notificação (`role: "TECHNICIAN"`) e direcionamento para o Kanban.
- O formulário de atendimento renderiza 4 botões fixos com ícones e textos estáticos.

Para que o HubSupport seja uma plataforma SaaS escalável e personalizável para diferentes negócios e equipes:
1. **Gestão Dinâmica:** Permitir que administradores gerenciem (cadastrem, editem, reordenem e excluam/desativem) suas próprias categorias de atendimento na aba **Configurações**.
2. **Customização Completa:** Cada categoria poderá ter seu próprio nome, subtítulo, ícone visual (Lucide), cor temática, papel a ser notificado (`TECHNICIAN`, `ADMIN`, `MANAGER`, etc.), flag de direcionamento para o Kanban técnico e trava de status inicial (ex: travar em "Backlog").
3. **Seleção Única:** No formulário de abertura de chamados, o usuário poderá selecionar **no máximo uma categoria por atendimento** (comutação tipo rádio customizado, podendo desmarcar se desejar registrar um chamado simples).
4. **Restrição RBAC:** **Apenas administradores (`role === 'ADMIN'`)** têm permissão para acessar a aba e executar operações de CRUD dessas categorias.

---

## 2. Abordagens Consideradas

### Abordagem 1: Entidade Dedicada no Banco (`WorkLogCategory`) com Relação 1:N e Espelho Retrocompatível [Escolhida]
* **Como funciona:**
  - Cria-se a tabela `WorkLogCategory` no Prisma com todos os atributos visuais e regras de negócio.
  - O modelo `WorkLog` ganha a chave estrangeira opcional `categoryId String?` apontando para `WorkLogCategory`.
  - Como o usuário determinou que agora a seleção é **única**, a relação é limpa e direta: `WorkLog` pertence a 0 ou 1 `WorkLogCategory`.
  - Para garantir **zero regressão**, na criação/edição de um `WorkLog`, o backend sincroniza tanto o `categoryId` quanto os 4 campos booleanos legados (`technicalAction`, `implementation`, `isPrompt`, `isIdea`) mapeados pelo slug da categoria.
  - Um script de seed idempotente inicializa as 4 categorias nativas e vincula os chamados existentes.
* **Vantagens:** 
  - Estrutura relacional robusta e indexada.
  - 100% retrocompatível com qualquer relatório ou consulta antiga.
  - Simplicidade máxima nas regras de negócios e consultas.

### Abordagem 2: Configuração em JSON em tabela genérica de Settings
* **Como funciona:** Salva um array de categorias dentro de uma coluna JSON `system_settings`.
* **Desvantagens:** Perde integridade referencial, índices de busca no banco, e dificulta relatórios relacionais e métricas no Kanban.
* **Decisão:** Descartada em favor da Abordagem 1.

---

## 3. Especificação do Modelo de Dados & Prisma

```prisma
model WorkLogCategory {
  id             String    @id @default(cuid())
  slug           String    @unique // ex: "technical_action", "implementation", "prompt", "idea", ou gerado pelo nome
  name           String    // ex: "Ação Técnica", "Prompt", "Infraestrutura"
  subtitle       String?   // ex: "Demanda técnica / dev"
  icon           String    @default("cog") // Chave do ícone Lucide: "cog", "rocket", "sparkles", "lightbulb", "wrench", "shield", etc.
  color          String    @default("#3b82f6") // Cor hexadecimal da categoria
  notifyRole     String?   // "TECHNICIAN" | "ADMIN" | "MANAGER" | "USER" | null (nenhum)
  targetKanban   Boolean   @default(true) // Direciona para o Kanban Técnico?
  lockStatus     Boolean   @default(true) // Trava status inicial na criação?
  targetStatus   String?   @default("Backlog") // Status forçado quando lockStatus for true
  active         Boolean   @default(true) // Visível no formulário?
  order          Int       @default(0) // Ordem de exibição na grade
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  workLogs       WorkLog[]
}
```

No modelo `WorkLog`:
```prisma
model WorkLog {
  // ... campos existentes ...
  categoryId      String?
  category        WorkLogCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  // ... campos legados mantidos para retrocompatibilidade:
  technicalAction Boolean @default(false)
  implementation  Boolean @default(false)
  isPrompt        Boolean @default(false)
  isIdea          Boolean @default(false)
}
```

---

## 4. Arquitetura da API REST (`/api/categories`)

Rotas dedicadas em `src/server/routes/categories.routes.ts`:
1. `GET /api/categories`:
   - Autenticado (qualquer usuário logado pode listar categorias ativas para montar o formulário e Kanban).
   - Se query `?all=true` for enviada por Admin, retorna também categorias inativas.
2. `POST /api/categories`:
   - **Exclusivo para ADMIN** (`authenticateToken` + `requireAdmin`).
   - Valida nome obrigatório, gera slug único, salva ícone, cor, notifyRole, flags e ordem.
3. `PUT /api/categories/:id`:
   - **Exclusivo para ADMIN**.
   - Atualiza dados da categoria.
4. `DELETE /api/categories/:id`:
   - **Exclusivo para ADMIN**.
   - Se houver chamados vinculados, desativa (`active = false`) ou desvincula via `SetNull` com confirmação.

---

## 5. Interface do Usuário (UI / UX)

### 5.1. Nova Aba em Configurações (`SettingsPage.tsx`):
- O cabeçalho de abas em `/settings` passa a ter:
  - `Tags do Sistema` (disponível como hoje)
  - `Categorias de Atendimento` (**exibida apenas se `user.role === 'ADMIN'`**)
- Listagem elegante em tabela/cards com:
  - Miniatura do Card (como aparecerá no formulário: ícone + nome + subtítulo + badge de cor)
  - Notificação configurada (badge: `Técnicos`, `Administradores`, etc.)
  - Regras de Fluxo (chips: `Kanban: Sim`, `Trava: Backlog`)
  - Ações: Editar e Ativar/Desativar ou Excluir.
- Modal de Criação / Edição:
  - Campo de Nome e Subtítulo.
  - Grade visual de Ícones Lucide para clique (Cog, Rocket, Sparkles, Lightbulb, Wrench, Server, Shield, Bug, Code, HelpCircle, Zap, Palette, FileText, Database).
  - Seletor de cores da paleta padrão do sistema.
  - Dropdown "Notificar Função ao Criar" (`Nenhum`, `Técnicos (TECHNICIAN)`, `Administradores (ADMIN)`, `Gerentes (MANAGER)`).
  - Switch "Exibir no Kanban Técnico".
  - Switch "Travar Status Inicial" + campo do status travado (padrão: "Backlog").

### 5.2. Formulário de Atendimento (`WorkLogForm.tsx`):
- Consome a lista de categorias via `api.categories.getAll()`.
- Grade responsiva 2x2 com `grid grid-cols-1 sm:grid-cols-2 gap-3`.
- **Comportamento de Seleção Única:**
  - Clicar em um card seleciona aquela categoria (`selectedCategoryId = id`).
  - Clicar em um card já selecionado desmarca (`selectedCategoryId = null`).
  - Se a categoria selecionada tiver `lockStatus === true`, o dropdown de status é travado em `targetStatus` (com badge `<Lock /> Fixo em {targetStatus}`).

### 5.3. Kanban e Cards Compactos:
- Os cards minimizados e detalhes passam a renderizar o badge com base na `category` vinculada (nome, cor e ícone dinâmicos).
- Os filtros do Kanban exibem dinamicamente as categorias ativas que possuem `targetKanban === true`.

---

## 6. Plano de Entrega e Verificação
1. **Prisma & Migração:** Schema + `prisma db push` + seed de categorias iniciais.
2. **Backend API:** Rotas de CRUD com proteção `requireAdmin` e integração no `POST /api/worklogs`.
3. **Frontend Settings:** Interface administrativa na aba de Configurações restrita a ADMIN.
4. **Frontend Form & Kanban:** Seleção única dinâmica no formulário e badges atualizados.
5. **QA & Build:** Testes automatizados cobrindo criação, permissão RBAC (usuário comum barrado de alterar categorias) e `npx vite build`.
