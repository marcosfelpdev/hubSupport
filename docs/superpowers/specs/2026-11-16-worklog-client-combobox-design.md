# Design Doc: Campo de Escritório/Cliente como Combobox no Formulário de Atendimentos

**Data:** 2026-11-16  
**Autor:** Antigravity  
**Status:** Proposto / Aprovado pelo Usuário  

---

## 1. Contexto & Necessidade

No formulário de novo atendimento (`WorkLogForm.tsx`), o campo **"Escritório / Cliente"** era um campo de texto livre (`<input type="text">`). Com isso, os operadores podiam digitar variações de nomes (ex: "Trynux", "trynux", "Matriz SP"), o que dificultava o agrupamento e impedia que os atendimentos fossem associados automaticamente ao perfil oficial do cliente (`/clients/:id`).

O objetivo desta melhoria é transformar o campo **"Escritório / Cliente"** em um **Combobox direto com busca em tempo real**, carregado a partir dos clientes cadastrados no sistema (`api.clients.getAll()`), garantindo que:
1. O usuário possa digitar rapidamente o nome do cliente e ver as sugestões em um dropdown suspenso.
2. Ao selecionar, o chamado seja formalmente atrelado ao `clientId` correspondente.
3. O histórico do cliente na plataforma receba automaticamente todos os atendimentos direcionados a ele.

---

## 2. Abordagens Consideradas

### Abordagem 1: Combobox Direto com Autocomplete Suspenso (Escolhida)
* **Descrição:** O campo mantém a experiência ágil de um input de texto com ícone de busca. Ao focar ou digitar, abre-se uma lista suspensa filtrando os clientes cadastrados em tempo real. Clicar em uma opção ou navegar com o teclado (`ArrowDown`, `ArrowUp`, `Enter`) seleciona o cliente, fixa seu `clientId` e preenche o nome. Um botão de limpar (`×`) permite remover a seleção para buscar outro.
* **Vantagens:** Agilidade e velocidade máxima de cadastro (foco e digitação imediatos com 1 único clique).
* **Decisão:** Escolhida pelo usuário.

### Abordagem 2: Seletor Popover com Botão de Disparo + Busca
* **Descrição:** Botão seletor estático que abre um popover com campo de busca no topo (similar ao seletor de responsáveis em `WorkLogDetailContent.tsx`).
* **Desvantagens:** Exige dois cliques para começar a buscar e adiciona camadas visuais desnecessárias em um formulário de preenchimento rápido.
* **Decisão:** Descartada.

---

## 3. Metas, Não-Metas e Restrições

### Metas (Goals)
1. **Carregamento dinâmico de clientes:**
   - Buscar a lista de clientes cadastrados via `api.clients.getAll()` na inicialização do formulário.
2. **Experiência de Combobox no formulário:**
   - Campo com ícone (`Building2` ou `Search`) e placeholder descritivo ("Buscar ou selecionar cliente...").
   - Dropdown suspenso exibindo lista de clientes filtrados conforme o usuário digita.
   - Mensagem de estado vazio amigável ("Nenhum cliente encontrado com esse nome").
   - Suporte a seleção por clique e teclado (`Enter`, setas cima/baixo, `Escape` para fechar).
   - Botão para limpar a seleção (`X` no canto direito do input).
   - Fechamento automático ao clicar fora (`useRef` + `mousedown` listener).
3. **Validação e Envio de Dados:**
   - O campo é obrigatório (`*`).
   - Se o usuário tentar enviar o formulário sem selecionar um cliente cadastrado válido, exibir alerta amigável de validação ("Por favor, selecione um cliente cadastrado.").
   - No `handleSubmit`, injetar tanto `clientId` quanto `clientOrOffice` (nome do cliente) no `FormData`.
4. **Resiliente e Idempotente:**
   - Limpeza correta de estado (`selectedClientId`, `clientSearchTerm`) ao submeter ou resetar o formulário.

### Não-Metas (Non-Goals)
- Não alterar as rotas do backend (a rota `POST /api/worklogs` já suporta `clientId` nativamente em `src/server/routes/worklogs.routes.ts`).
- Não alterar a tela de cadastro de clientes (`ClientsManager.tsx`).

---

## 4. Especificação Visual e Comportamento do Combobox

```tsx
// Estados principais
const [clients, setClients] = useState<ClientItem[]>([]);
const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
const [clientSearch, setClientSearch] = useState<string>("");
const [isClientDropdownOpen, setIsClientDropdownOpen] = useState<boolean>(false);

// Filtragem em tempo real
const filteredClients = useMemo(() => {
  if (!clientSearch.trim()) return clients;
  const q = clientSearch.toLowerCase();
  return clients.filter((c) => c.name.toLowerCase().includes(q));
}, [clients, clientSearch]);
```

### Layout do Campo:
* **Container relativo** com referência para detecção de clique fora (`useRef`).
* **Input de texto** com classes Tailwind idênticas aos demais campos do formulário (`Solicitante`, `Título`), garantindo harmonia visual no modo claro e escuro.
* **Dropdown suspenso:**
  - `absolute z-50 mt-1.5 w-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-60 overflow-y-auto`.
  - Itens com `hover:bg-slate-100 dark:hover:bg-slate-800/80` e indicação de item ativo.

---

## 5. Próximos Passos
Após aprovação deste documento de design pelo usuário:
1. Invocar a habilidade `writing-plans` para estruturar o plano de implementação detalhado.
2. Executar as tarefas via subagentes autônomos (`subagent-driven-development`).
3. Validar a compilação com `npx vite build` e testes automatizados.
