# Design Doc: Novas Categorias de Atendimento — "Prompt" e "Ideia"

**Data:** 2026-11-19  
**Autor:** Antigravity  
**Status:** Proposto / Aprovado pelo Usuário  

---

## 1. Contexto & Necessidade

No HubSupport, o formulário de novo atendimento (`WorkLogForm.tsx`) disponibilizava duas categorias opcionais de demanda: **Ação Técnica** e **Implementação**. Ao marcar qualquer uma delas, o chamado era automaticamente classificado como demanda para a equipe técnica, com o status inicial fixado em **"Backlog"** e direcionamento para o Kanban dos técnicos.

Com o avanço das atividades de inteligência artificial e geração de valor contínuo para os clientes, duas novas frentes tornaram-se fundamentais no fluxo de trabalho:
1. **Prompt:** Demandas focadas em engenharia, calibração, teste e refino de prompts de IA para os produtos e clientes.
2. **Ideia:** Registro de insights, sugestões de inovação, melhorias de UX/arquitetura ou novas oportunidades trazidas pelo atendimento.

Ambas as categorias devem direcionar o chamado para a equipe técnica no Kanban com o status inicial obrigatoriamente travado em **"Backlog"**, preservando o mesmo comportamento ágil e seguro das categorias existentes.

---

## 2. Abordagens Consideradas

### Abordagem 1: Flags Booleanas Independentes (Checkboxes Combináveis) — [Escolhida]
* **Descrição:** 
  - Adiciona `isPrompt Boolean @default(false)` e `isIdea Boolean @default(false)` no modelo `WorkLog` do Prisma.
  - O bloco de tipo de atendimento no formulário (`WorkLogForm.tsx`) se expande para uma grade de 4 cards responsivos, permitindo selecionar uma ou mais categorias simultaneamente caso um chamado envolva, por exemplo, "Implementação" e "Prompt".
  - Se qualquer uma das 4 categorias estiver ativa (`technicalAction || implementation || isPrompt || isIdea`), o seletor de status inicial é fixado em "Backlog".
  - O Kanban técnico (`TechnicianKanbanBoard.tsx`) e os cards compactos (`ReportCardMinimized.tsx`) passam a exibir e filtrar os novos tipos com cores e ícones exclusivos.
* **Vantagens:** 100% retrocompatível, mantém o padrão visual atual e não restringe artificialmente chamados híbridos.
* **Decisão:** Escolhida pelo usuário.

### Abordagem 2: Categoria Única Exclusiva (Radio Button)
* **Descrição:** Substitui os checkboxes por um campo enum de seleção única.
* **Desvantagens:** Impede chamados multidisciplinares e exigiria migração complexa de registros históricos onde técnicos marcaram ação técnica e implementação juntas.
* **Decisão:** Descartada.

---

## 3. Metas, Não-Metas e Restrições

### Metas (Goals)
1. **Modelagem de Dados & Prisma:**
   - Adicionar `isPrompt Boolean @default(false)` e `isIdea Boolean @default(false)` no modelo `WorkLog` em `prisma/schema.prisma`.
   - Executar `npx prisma db push` para sincronizar o banco.
2. **Backend API (`worklogs.routes.ts`):**
   - Receber `isPrompt` e `isIdea` no `POST /api/worklogs`.
   - Considerar `isTechnicalOrBacklogDemand = isTechnicalAction || isImplementation || isPrompt || isIdea`.
   - Se qualquer um for verdadeiro: fixar status inicial em "Backlog" e notificar técnicos ativos (`role: "TECHNICIAN"`).
   - Incluir chamados com `isPrompt: true` ou `isIdea: true` na rota de Kanban técnico (`/api/worklogs/kanban`).
3. **Frontend — Formulário de Atendimento (`WorkLogForm.tsx`):**
   - Grade fluida de 4 cards responsivos (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`):
     1. **Ação Técnica:** Ícone `Cog`, Cor Âmbar (`#f59e0b`), subtítulo *"Demanda técnica / dev"*
     2. **Implementação:** Ícone `Rocket`, Cor Azul (`#3b82f6`), subtítulo *"Novas features / setup"*
     3. **Prompt:** Ícone `Sparkles`, Cor Esmeralda (`#10b981`), subtítulo *"Engenharia / Ajuste de prompt de IA"*
     4. **Ideia:** Ícone `Lightbulb`, Cor Violeta/Púrpura (`#8b5cf6`), subtítulo *"Sugestão de melhoria / Inovação"*
   - Se qualquer categoria estiver marcada: travar o dropdown de status em "Backlog" com badge `<Lock /> Fixo em Backlog`.
   - Enviar `isPrompt` e `isIdea` no `FormData` ao submeter.
4. **Frontend — Kanban e Cards (`TechnicianKanbanBoard.tsx` & `ReportCardMinimized.tsx`):**
   - No `ReportCardMinimized`: badges coloridos no rodapé para Prompt (verde esmeralda) e Ideia (violeta).
   - No `TechnicianKanbanBoard`: opções de filtro rápido para "Prompt" e "Ideia" com contadores métricos atualizados.
   - No `WorkLogDetailContent`: exibição dos chips de tipo ativos no cabeçalho do detalhe.
5. **Tipagem (`src/services/api.ts`):**
   - Atualizar a interface `WorkLogItem` com `isPrompt?: boolean` e `isIdea?: boolean`.

### Não-Metas (Non-Goals)
- Não alterar a inteligência de relatórios AI (`gemini.ts`) neste primeiro momento além de passar as flags no contexto.
- Não alterar as regras das colunas do Kanban.

---

## 4. Especificação Visual dos Cards

```tsx
// Grid container no formulário
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 bg-slate-50/70 dark:bg-[#0b0f19]/60 border border-slate-200 dark:border-slate-800 rounded-xl">
  {/* 1. Ação Técnica (Âmbar) */}
  {/* 2. Implementação (Azul) */}
  {/* 3. Prompt (Esmeralda) */}
  {/* 4. Ideia (Violeta) */}
</div>
```

### Paleta Visual:
* **Ação Técnica:** `bg-amber-500` / `ring-amber-300` / `text-amber-900 dark:text-amber-200`
* **Implementação:** `bg-blue-500` / `ring-blue-300` / `text-blue-900 dark:text-blue-200`
* **Prompt:** `bg-emerald-500` / `ring-emerald-300` / `text-emerald-900 dark:text-emerald-200`
* **Ideia:** `bg-violet-500` / `ring-violet-300` / `text-violet-900 dark:text-violet-200`

---

## 5. Próximos Passos
Após aprovação deste documento de design pelo usuário:
1. Invocar a habilidade `writing-plans` para estruturar o plano de tarefas atômicas e testáveis.
2. Executar via `subagent-driven-development` com subagentes especializados para backend, formulário, kanban/cards e testes automatizados de QA.
3. Validar com `npx vite build` e suíte de testes de integração.
