# Especificação de Design — Assinatura e Atribuição de Responsável no Kanban Técnico

**Data:** 02/11/2026  
**Status:** Aprovado  
**Autor:** Antigravity / Pair Programming  

---

## 1. Visão Geral e Objetivo
No painel Kanban da equipe técnica, os técnicos precisam assumir ("assinar") os chamados pelos quais serão responsáveis para organizar as filas de trabalho e dar visibilidade sobre quem está atuando em cada tarefa, exatamente como em ferramentas de Kanban consagradas (Jira, Trello, Linear).
A funcionalidade deve permitir:
1. **Card Maximizado (`ReportDetailsModal` / `WorkLogDetailContent`):**
   - Atribuir a si mesmo com 1 clique através do botão **`[✋ Assumir Tarefa]`**.
   - Selecionar qualquer outro técnico/colaborador da equipe via seletor/dropdown.
   - Exibir com clareza o responsável atual (avatar com iniciais, nome e cargo).
   - Permitir alterar ou desatribuir o responsável.
2. **Card Minimizado das Colunas do Kanban (`ReportCardMinimized`):**
   - Exibir no rodapé/metadados um avatar compacto do responsável atribuído com tooltip, facilitando a identificação imediata nas colunas do Kanban.

---

## 2. Modelo de Dados & Banco de Dados (Prisma SQLite)
No modelo `WorkLog` em `prisma/schema.prisma`:
```prisma
model WorkLog {
  // ... campos existentes
  assignedToId     String?
  assignedTo       User?     @relation("AssignedWorkLogs", fields: [assignedToId], references: [id], onDelete: SetNull)
}
```
No modelo `User`:
```prisma
model User {
  // ... campos existentes
  assignedWorkLogs WorkLog[] @relation("AssignedWorkLogs")
}
```

---

## 3. Endpoints da API REST
1. **Atribuição de Responsável (`PATCH /api/worklogs/:id/assign`):**
   - Autenticado via `authenticateToken`.
   - Body: `{ assignedToId: string | null }`.
   - Se `assignedToId` for fornecido: valida a existência do usuário no banco.
   - Atualiza `workLog.assignedToId`.
   - Retorna `{ success: true, assignedTo: updated.assignedTo }`.
2. **Consultas (`GET /api/worklogs`):**
   - O objeto `defaultWorkLogInclude` passa a incluir:
     `assignedTo: { select: { id: true, name: true, email: true, role: true } }`.

---

## 4. Interface do Usuário (UI/UX)
1. **Bloco de Responsável no Card Maximizado (`WorkLogDetailContent.tsx`):**
   - Integrado de forma limpa abaixo dos metadados do chamado.
   - Caso **Não Atribuído:**
     - Badge neutro com ícone `UserX` ou `UserPlus` indicando "Sem responsável".
     - Botão primário **`[✋ Assumir Tarefa]`** para atribuição rápida ao usuário logado.
     - Botão/menu para atribuir a outro membro da equipe.
   - Caso **Atribuído:**
     - Avatar circular com cor e iniciais do responsável.
     - Nome completo e badge do cargo.
     - Se o responsável for o próprio usuário logado: tag comemorativa/destaque `Você`.
     - Botão para alterar responsável ou desatribuir (`Desatribuir`).
2. **Visualização Rápida no Card Minimizado (`ReportCardMinimized.tsx`):**
   - Ao lado da data e mídias, exibe um mini-avatar circular com as iniciais do técnico e anel sutil, com tooltip `Responsável: [Nome]`.

---

## 5. Design System CloudNexus
- Padrão de cores e bordas harmônico nos temas Claro e Escuro (`bg-white dark:bg-[#111726]`, `border-slate-200 dark:border-slate-800`).
- Microinterações suaves ao assumir tarefa com indicador de carregamento discreto.
