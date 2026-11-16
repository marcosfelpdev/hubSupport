# Design Doc: Gestor Pessoal de Clientes no HubSupport

**Data:** 2026-11-16  
**Autor:** Antigravity  
**Status:** Proposto / Aprovado pelo Usuário  

---

## 1. Contexto & Necessidade

No HubSupport, cada cliente cadastrado na plataforma possui um relacionamento próximo com a equipe de suporte e tecnologia. Para aprimorar o atendimento personalizado e a governança das contas, cada cliente deve poder ter um **Gestor Pessoal** atribuído (um colaborador cadastrado na plataforma, modelo `User`).

Essa informação deve ser facilmente gerenciada e ficar evidente em dois pontos estratégicos do sistema:
1. **Na Lista de Clientes (`ClientsManager.tsx`):** Em cada card/linha da tabela, exibindo o avatar, nome e cargo do gestor responsável (ou indicação de "Não atribuído").
2. **No Perfil do Cliente (`ClientProfilePage.tsx`):** Na parte superior do cabeçalho, com destaque visual mostrando o colaborador responsável e permitindo edição rápida através de um modal de edição de cliente.

---

## 2. Abordagens Consideradas

### Abordagem 1: Modal Completo de Gestão de Cliente (Criação & Edição de Nome + Gestor Pessoal) — [Escolhida]
* **Descrição:** 
  - Expansão do modelo `Client` no Prisma para suportar `managerId` relacionado a `User` (`onDelete: SetNull`).
  - Suporte nas rotas da API para criação (`POST /api/clients`), atualização (`PUT /api/clients/:id`) e listagem/detalhes incluindo o objeto `manager`.
  - Modal de edição acessível tanto pelo botão de ação de edição na listagem de clientes quanto por um botão *"Editar Cliente"* no topo da página de perfil do cliente.
  - Seletor de colaboradores ativos (`api.employees.getAll()`) com identificação de nome e cargo.
* **Vantagens:** Solução unificada e escalável que atende tanto à definição inicial no cadastro quanto à alteração ou troca de gestor a qualquer momento, sem exigir saída da tela em que o operador se encontra.
* **Decisão:** Escolhida pelo usuário.

### Abordagem 2: Modal Focado Apenas na Troca de Gestor
* **Descrição:** Modal simplificado apenas para alternar o ID do colaborador.
* **Desvantagens:** Impede a edição de outros dados do cliente (como nome da empresa) no mesmo fluxo.
* **Decisão:** Descartada.

---

## 3. Metas, Não-Metas e Restrições

### Metas (Goals)
1. **Modelagem de Dados & Integridade Referencial:**
   - Adicionar campo opcional `managerId String?` e relação `manager User? @relation("ClientManager", fields: [managerId], references: [id], onDelete: SetNull)` no modelo `Client`.
   - Adicionar campo reverso `managedClients Client[] @relation("ClientManager")` no modelo `User`.
   - Sincronizar o banco de dados via `npx prisma db push`.
2. **Camada de API Backend (`clients.routes.ts`):**
   - Atualizar `GET /api/clients` e `GET /api/clients/:id` para incluir o gestor com campos `{ id, name, email, role }`.
   - Atualizar `POST /api/clients` para aceitar `managerId` opcional.
   - Criar rota `PUT /api/clients/:id` para atualizar `name` e/ou `managerId`.
3. **Camada de Serviço Frontend (`api.ts`):**
   - Atualizar interface `ClientItem` com `managerId` e `manager`.
   - Implementar método `api.clients.update(id, { name, managerId })`.
4. **Interface da Lista de Clientes (`ClientsManager.tsx`):**
   - No modal "Novo Cliente", adicionar seletor de Gestor Pessoal com lista de colaboradores (`api.employees.getAll()`).
   - Adicionar modal de "Editar Cliente" para atualizar nome e gestor pessoal.
   - Nova coluna/chip na tabela de clientes com avatar (iniciais), nome do gestor e cargo (ou tag *"Sem gestor"*).
   - Botão de edição (`Pencil`) na linha de cada cliente.
5. **Interface do Perfil do Cliente (`ClientProfilePage.tsx`):**
   - No cabeçalho superior (abaixo do nome do cliente), adicionar card/badge de destaque para o Gestor Pessoal com ícone `UserCheck`, avatar colorido, nome e cargo.
   - Botão *"Editar Cliente"* no topo direito do cabeçalho que abre o modal de edição e atualiza os dados em tempo real.

### Não-Metas (Non-Goals)
- Não restringir a seleção de gestor a apenas um cargo específico (qualquer colaborador cadastrado pode ser gestor pessoal, conforme especificado pelo usuário).
- Não alterar a lógica de associação de WorkLogs e reuniões ao cliente.

---

## 4. Especificação de Interface e Componentes

### 4.1. Badge de Gestor Pessoal (Lista de Clientes)
```tsx
{client.manager ? (
  <div className="flex items-center gap-2">
    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center border border-slate-200 dark:border-slate-700">
      {getInitials(client.manager.name)}
    </div>
    <div className="min-w-0">
      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block truncate">
        {client.manager.name}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
        {client.manager.role}
      </span>
    </div>
  </div>
) : (
  <span className="text-xs text-slate-400 dark:text-slate-500 italic">
    Não atribuído
  </span>
)}
```

### 4.2. Card de Destaque no Topo do Perfil
```tsx
<div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#161f33] border border-slate-200 dark:border-slate-800">
  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
    {data.client.manager ? getInitials(data.client.manager.name) : <UserCheck className="w-3.5 h-3.5" />}
  </div>
  <div className="text-xs">
    <span className="text-slate-400 dark:text-slate-500 mr-1.5 font-medium">Gestor Pessoal:</span>
    <span className="font-semibold text-slate-900 dark:text-white">
      {data.client.manager ? `${data.client.manager.name} (${data.client.manager.role})` : "Não definido"}
    </span>
  </div>
</div>
```

---

## 5. Próximos Passos
Após aprovação deste design doc:
1. Invocar a habilidade `writing-plans` para estruturar o plano de implementação em tarefas atômicas e testáveis.
2. Executar via `subagent-driven-development` com subagentes dedicados para schema/backend, UI e testes QA.
3. Validar compilação e testes E2E antes de submeter PR e finalizar a branch.
