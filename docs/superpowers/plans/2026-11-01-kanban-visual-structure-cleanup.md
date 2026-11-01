# Kanban Panel Visual Structure & Styling Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar, corrigir e padronizar toda a estrutura visual e código de estilo do Painel Técnico e do Quadro Kanban (incluindo cards de atendimento e modal de detalhes), eliminando estilos inline rígidos e adotando o design system moderno em Tailwind CSS v4.

**Architecture:** Substituição sistemática de estilos inline manuais por classes utilitárias do Tailwind CSS v4 e variáveis de design (`globals.css`), aprimorando a hierarquia tipográfica, estados de drag & drop, badges de status, adaptabilidade responsiva e transições suaves.

**Tech Stack:** React 19, TypeScript 5, Vite 8, Tailwind CSS v4, Lucide Icons, Prisma/REST API client.

**Spec:** Contexto de modernização de UI e padronização do módulo técnico do HubSupport.

---

## Global Constraints

- Manter 100% da integridade da lógica de negócios existente (filtros, drag-and-drop, resolução de chamados, persistência na API).
- Não quebrar contratos de props ou tipos da API (`WorkLogItem`, `ColumnId`, `ReportCardMinimizedProps`, etc.).
- Utilizar exclusivamente Tailwind CSS v4 e variáveis semânticas de cor definidas em `src/styles/globals.css`.
- Preservar acessibilidade visual, contraste no tema escuro e comportamento responsivo em telas menores e widescreen.
- Validar a compilação do projeto com `npm run build` a cada entrega.

---

## Review Focus

1. **Responsividade do Grid do Kanban:** As 4 colunas mantêm layout limpo sem quebra involuntária e com scroll horizontal gracioso em telas menores.
2. **Feedback de Drag & Drop:** Indicadores visuais claros e feedback de soltar (drop target) ao arrastar cards entre colunas.
3. **Truncamento e Quebra de Texto nos Cards:** Nenhum título ou nome de solicitante é cortado indevidamente por `height` estático.
4. **Alinhamento e Espaçamento dos Modais:** O modal de detalhes abre centralizado, com rolagem interna suave no corpo e botões de ação fixos no rodapé.
5. **Consistência de Cores e Temas:** Cores de status (Solucionado, Em progresso, Pendências, Backlog) padronizadas entre Kanban, Cards e Modal.

---

## Tasks

### Task 1: Refatorar Layout e Cabeçalho de `src/pages/TechnicianPage.tsx`
**Files:**
- Modify: `src/pages/TechnicianPage.tsx`

- [ ] Substituir os estilos inline do container principal por classes Tailwind (`max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6`).
- [ ] Padronizar o cabeçalho: título com tipografia semântica, badge moderna "🔧 Equipe Técnica" com efeito glass, e exibição elegante da data formatada.
- [ ] Harmonizar os controles do cabeçalho: botão "Atualizar" com estado de loading animado e Toggle Switcher (Quadro Kanban vs Lista Tradicional) com transições visuais refinadas.
- [ ] Validar estados de carregamento (spinner) e erro (alerta) com classes Tailwind.
- [ ] Executar `npm run build` e confirmar compilação.

---

### Task 2: Refatorar Barra de Ferramentas e Filtros em `src/components/dashboard/TechnicianKanbanBoard.tsx`
**Files:**
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`

- [x] Converter a barra de filtros de estilos inline para classes Tailwind (`bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6 shadow-sm`).
- [x] Estilizar os inputs e selects com foco acessível (`focus:ring-2 focus:ring-indigo-500/30`), ícone de busca alinhado e placeholders nítidos.
- [x] Adicionar chips/badges informativos de contagem rápida (Total de chamados, Ação Técnica e Implementação).
- [x] Garantir alinhamento flexível e responsivo para telas móveis e desktop.
- [x] Executar `npm run build` e confirmar compilação.

---

### Task 3: Refatorar Colunas e Estados de Drag & Drop em `src/components/dashboard/TechnicianKanbanBoard.tsx`
**Files:**
- Modify: `src/components/dashboard/TechnicianKanbanBoard.tsx`

- [x] Padronizar os cabeçalhos das colunas (Backlog, Pendências, Em progresso, Finalizadas) com badges de contagem harmoniosas e bordas sutis.
- [x] Estilizar as zonas de drop (`drag-over`) com borda tracejada e destaque sutil iluminado (`border-indigo-500/50 bg-indigo-500/5`).
- [x] Implementar estado vazio elegante para colunas sem cards (ícone sutil + texto "Nenhum chamado nesta etapa").
- [x] Ajustar altura e rolagem da coluna (`max-h-[calc(100vh-280px)] overflow-y-auto pr-1`) garantindo visual fluido.
- [x] Executar `npm run build` e confirmar compilação.

---

### Task 4: Modernizar e Padronizar `src/components/ReportCardMinimized.tsx`
**Files:**
- Modify: `src/components/ReportCardMinimized.tsx`

- [x] Remover alturas fixas e rígidas (`height: 50px`) que quebram o layout do card e adotar flexbox responsivo com `min-h-[140px]`.
- [x] Linha superior: TagBadge, código identificador sutil (`#id`), e pill de status refinada.
- [x] Bloco central: Título com tipografia semântica, contraste adequado e line-clamp de 2 linhas natural.
- [x] Linha inferior de metadados: Solicitante e empresa com ícone de usuário, data formatada e tipografia limpa.
- [x] Rodapé de categoria: Barra inferior com cores suaves para Ação Técnica (azul/ciano), Implementação (roxo/índigo) ou Suporte.
- [x] Efeitos de hover e drag: `transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-600 cursor-grab active:cursor-grabbing`.
- [x] Executar `npm run build` e confirmar compilação.

---

### Task 5: Refatorar e Polir `src/components/dashboard/ReportDetailsModal.tsx`
**Files:**
- Modify: `src/components/dashboard/ReportDetailsModal.tsx`

- [x] Converter o backdrop e a janela do modal para Tailwind (`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4`).
- [x] Estruturar o modal com cabeçalho fixo, corpo rolável (`overflow-y-auto max-h-[75vh]`) e rodapé de ações fixo.
- [x] Harmonizar as seções de dados: Resumo Executivo, Propostas de Melhoria, Detalhamento Técnico e Transcrição/Áudio.
- [x] Estilizar os botões de ação ("Marcar como Solucionado", "Baixar Relatório PDF", "Fechar") com estados de hover, loading e disabled.
- [x] Executar `npm run build` e confirmar compilação.

---

### Task 6: Verificação Completa e Integração Final
**Files:**
- Verify: `src/pages/TechnicianPage.tsx`
- Verify: `src/components/dashboard/TechnicianKanbanBoard.tsx`
- Verify: `src/components/ReportCardMinimized.tsx`
- Verify: `src/components/dashboard/ReportDetailsModal.tsx`

- [ ] Executar `npm run build` para garantir zero erros de TypeScript e compilação do Vite.
- [ ] Validar compatibilidade dos componentes e visual consistente em conjunto.
- [ ] Registrar o resumo das melhorias e preparar as ideias de identidade visual para a próxima etapa.

