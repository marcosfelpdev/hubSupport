# Design Doc: Filtro Toggle "Hoje" / "Todos" na Coluna de Finalizadas do Kanban

**Data:** 19/11/2026  
**Status:** Aprovado em alinhamento prévio  
**Escopo:** Pequena mudança de UI/UX (Small change)

## 1. Contexto & Motivação (Intent & Why)
No painel técnico do Kanban (`/dashboard/tecnico`), a coluna "Finalizadas" acumula todos os relatórios concluídos ao longo do tempo. Com o aumento do volume de atendimentos concluídos, a coluna fica sobrecarregada, dificultando a visualização rápida e limpa do fluxo de trabalho finalizado na data corrente ("Hoje").

## 2. Objetivos & Não-Objetivos
- **Objetivos:**
  - Adicionar um seletor toggle compacto em formato de pílula segmentada (`Hoje` | `Todos`) no cabeçalho da coluna "Finalizadas".
  - O filtro deve vir pré-selecionado por padrão em **"Hoje"**.
  - Exibir apenas os cards finalizados na data atual quando "Hoje" estiver ativo, ou todos os cards finalizados quando "Todos" estiver selecionado.
  - Atualizar dinamicamente o badge contador da coluna conforme o filtro selecionado (ex: `Hoje (3)` ou `Todos (22)`).
  - Incluir tooltip informativo no badge de contagem.
- **Não-Objetivos:**
  - Não alterar a barra superior global de filtros.
  - Não modificar as outras colunas do Kanban (Backlog, Pendências, Em Progresso, Validação).
  - Não alterar regras de negócio de transição de status no backend.
- **Anti-Objetivos:**
  - Não aumentar a altura do cabeçalho da coluna nem quebrar o layout responsivo das colunas do Kanban.

## 3. Abordagens Consideradas (Approaches)
1. **Filtro global na barra superior:**
   - *Desvantagem:* Afetaria a lógica global e poluiria a barra superior com um controle que só faz sentido para a coluna "Finalizadas".
2. **Toggle no cabeçalho da coluna "Finalizadas" (Abordagem Selecionada):**
   - *Vantagem:* Posicionado exatamente onde o usuário demarcou visualmente (entre o título "Finalizadas" e o badge numérico). Foco contextual imediato, ergonômico e limpo.

## 4. Detalhes Decididos
- **Posicionamento:** No cabeçalho da coluna `finalizadas` em `TechnicianKanbanBoard.tsx`, entre o título e o badge de contagem.
- **Estado Padrão:** `"hoje"`.
- **Detecção de Data de Finalização:**
  - Verifica no `statusHistory` a entrada mais recente onde `toStatus` é `"Solucionado"`.
  - Compara a data dessa entrada com a data atual do usuário (`toDateString()` ou comparação de ano, mês, dia).
  - Fallback seguro para `log.updatedAt` ou `log.createdAt` se `statusHistory` não contiver o registro.
- **Estilo:** Estilo pílula segmentada (`p-0.5 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg text-[10px] font-semibold`), com botão ativo em `bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold`.
