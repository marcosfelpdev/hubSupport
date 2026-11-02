# Padronização da Apresentação de Cards Maximizados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Padronizar a apresentação de cards maximizados na tela de atendimento para seguir a estrutura rica do card maximizado do Kanban (cabeçalho com metadados unificados, grid lado a lado de problema/solução, seção rica de relatório de IA com resumo executivo, propostas de melhoria com badges de prioridade, botões de ação integrados e banner sob demanda).

**Architecture:**
1. Criar o componente central reutilizável `src/components/dashboard/WorkLogDetailContent.tsx`, extraindo e aprimorando a lógica de exibição rica existente em `ReportDetailsModal.tsx`, incluindo suporte a relatórios estruturados de IA (`structuredData`), estados de carregamento e o banner sob demanda para chamados manuais.
2. Integrar `WorkLogDetailContent` na coluna direita da tela de atendimento (`src/components/DashboardClient.tsx`), fornecendo visualizador de PDF embutido/modal e carrossel de mídias.
3. Integrar `WorkLogDetailContent` na tela de atendimento do técnico (`src/components/TechnicianDashboardClient.tsx`), utilizando o slot `footerActions` para acomodar a ação de "Marcar como Solucionado".
4. Refatorar `ReportDetailsModal.tsx` para compartilhar as mesmas estruturas e utilitários visuais, garantindo paridade total entre as telas.
5. Conduzir auditoria de QA com `qa-verifier` executando `npx tsc --noEmit`, `npx vite build` e verificação nos temas Claro e Escuro.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Vite, Express, Prisma ORM.

**Spec:** `docs/superpowers/specs/2026-11-02-standardized-worklog-detail-card-design.md`

## Global Constraints
- Manter o posicionamento e o container do card maximizado na coluna direita das telas de atendimento (`lg:col-span-7 xl:col-span-8`).
- Preservar total compatibilidade com o Design System CloudNexus nos temas Claro e Escuro (`bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800`).
- Manter suporte completo à geração sob demanda de IA para chamados sem relatório criado via "+ Novo Atendimento".
- Não mover relatórios em PDF nem vídeos para `public/`; acessar sempre via rotas autenticadas da API.

## Review Focus
- Paridade visual com a Imagem 2 (Kanban): ícone de status, título, badges de tag/status/ação técnica, metadados em linha única, grid de 2 colunas para descrição e solução.
- Apresentação rica de IA: quando `structuredData` estiver disponível, exibir o título formal, subtítulo, botões de ação (Mídias, Vídeo, Visualizar PDF), Resumo Executivo e Propostas & Melhorias com badges coloridos de prioridade (Alta/Média/Baixa).
- Apresentação quando IA não foi gerada: exibir o banner convidativo de geração sob demanda com botão `[✨ Gerar Relatório com IA]`.
- Abertura de PDF e Mídias: garantir que os botões `Visualizar PDF` e `Mídias (N)` funcionem perfeitamente a partir do card maximizado.
- Ações específicas de perfil: na tela de técnicos, garantir que a ação de "Marcar como Solucionado" permaneça acessível.

---

### Task 1: Componente Reutilizável `WorkLogDetailContent`
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Create: `src/components/dashboard/WorkLogDetailContent.tsx`

- [x] **Step 1:** Criar `src/components/dashboard/WorkLogDetailContent.tsx`:
  - Definir interfaces `WorkLogDetailContentProps`, `StructuredReportData` e `StatusPillConfig`.
  - Implementar cabeçalho padronizado:
    - Ícone no quadrado arredondado (`CheckCircle2` verde se solucionado, `FileText` cinza se não).
    - Título (`log.title || log.clientOrOffice`).
    - Badges: `statusPill`, `TagBadge`, `Ação Técnica` (laranja), `Implementação` (roxo).
    - Metadados: `Cliente: ...` • `Solicitante: ...` • `Registrado em: ...` • `Plataforma: ...`.
  - Implementar grid de Descrição & Solução:
    - 2 colunas responsivas (`grid-cols-1 md:grid-cols-2 gap-3.5`).
    - "Descrição do Atendimento" e "Solução / Ação Realizada" (com ícone `CheckCircle2` verde).
  - Implementar bloco de IA:
    - Se `structuredData`: Card com ícone `Sparkles`, título e subtítulo gerados pela IA, botões de ação (`Vídeo`, `Mídias (N)`, `Visualizar PDF`), bloco `Resumo Executivo`, lista de `Propostas & Melhorias Identificadas` com badges de prioridade (Alta, Média, Baixa) e `Detalhamento Técnico` se presente.
    - Se `status === "pending"` ou `"processing"`: Exibir status e barra de progresso com polling.
    - Se `!aiReport`: Exibir banner com botão `[✨ Gerar Relatório com IA]` sob demanda.
  - Slot `footerActions` para botões adicionais no rodapé.
- [x] **Step 2:** Executar `npx tsc --noEmit` para garantir 0 erros de tipagem.
- [x] **Step 3:** Commit: `feat(ui): criar componente WorkLogDetailContent padronizado para exibicao de atendimentos`.

---

### Task 2: Integração na Tela de Atendimento Principal (`DashboardClient.tsx`)
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/DashboardClient.tsx`

- [x] **Step 1:** Atualizar `src/components/DashboardClient.tsx`:
  - Substituir o conteúdo vertical antigo do painel direito pelo novo `WorkLogDetailContent`.
  - Integrar visualizador de PDF modal/embutido para quando o usuário clicar em "Visualizar PDF".
  - Integrar abertura do modal de mídias quando o usuário clicar no botão de mídias do card.
  - Manter suporte ao estado vazio caso nenhum atendimento esteja selecionado.
- [x] **Step 2:** Executar `npx vite build` para validar a compilação.
- [x] **Step 3:** Commit: `feat(ui): adotar estrutura padronizada do card maximizado na tela de atendimento principal`.

---

### Task 3: Integração na Tela de Técnicos (`TechnicianDashboardClient.tsx`)
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/TechnicianDashboardClient.tsx`

- [x] **Step 1:** Atualizar `src/components/TechnicianDashboardClient.tsx`:
  - Substituir o conteúdo antigo pelo novo `WorkLogDetailContent`.
  - Passar o botão "Marcar como Solucionado" através do prop `footerActions`.
  - Conectar os callbacks de "Visualizar PDF" e "Mídias".
- [x] **Step 2:** Executar `npx tsc --noEmit` e verificar tipos.
- [x] **Step 3:** Commit: `feat(ui): padronizar card maximizado na tela de atendimento do tecnico`.

---

### Task 4: Alinhamento e Paridade com o Modal do Kanban (`ReportDetailsModal.tsx`)
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/dashboard/ReportDetailsModal.tsx`

- [x] **Step 1:** Ajustar `ReportDetailsModal.tsx` para compartilhar as mesmas definições ou renderizar `WorkLogDetailContent`, garantindo 100% de consistência visual e manutenibilidade unificada.
- [x] **Step 2:** Executar `npx vite build`.
- [x] **Step 3:** Commit: `refactor(ui): unificar apresentacao visual do modal do kanban com o novo componente padrao`.

---

### Task 5: Auditoria de QA e Verificação de Regressão
**Role/Subagent:** `qa-verifier` (QA Specialist)
**Files:**
- Full codebase audit

- [ ] **Step 1:** Executar `npx tsc --noEmit` e `npm run build`.
- [ ] **Step 2:** Validar a renderização da tela de atendimentos com chamados com IA gerada (resumo, propostas, badges de prioridade) e sem IA gerada (banner sob demanda).
- [ ] **Step 3:** Validar visualização de PDFs e mídias a partir do card maximizado.
- [ ] **Step 4:** Validar temas Claro e Escuro.
- [ ] **Step 5:** Registrar aprovação final no plano.

