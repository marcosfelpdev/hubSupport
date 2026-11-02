# Especificação de Design — Alteração Global de Status e Linha do Tempo de Histórico

**Data:** 02/11/2026  
**Status:** Aprovado  
**Autor:** Antigravity / Pair Programming  

---

## 1. Visão Geral e Objetivo
Permitir que qualquer usuário autenticado do sistema possa alterar o status de um atendimento já registrado diretamente através do card maximizado (ex: alterar de "Em andamento" para "Realizado" após a conclusão da demanda). 
Todas as alterações terão escopo global e serão registradas de forma auditável em uma **linha do tempo de histórico** exibida no canto inferior do card maximizado, mostrando quem alterou, a transição de status (`fromStatus ➔ toStatus`) e o horário da alteração.

---

## 2. Modelo de Dados & Banco de Dados (Prisma SQLite)
Criação do modelo `WorkLogStatusHistory`:
```prisma
model WorkLogStatusHistory {
  id          String   @id @default(cuid())
  workLogId   String
  workLog     WorkLog  @relation(fields: [workLogId], references: [id], onDelete: Cascade)
  fromStatus  String
  toStatus    String
  changedById String
  changedBy   User     @relation(fields: [changedById], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
}
```
Relações adicionadas em `WorkLog` (`statusHistory WorkLogStatusHistory[]`) e em `User` (`statusChanges WorkLogStatusHistory[]`).

---

## 3. Endpoints da API REST
1. **Criação de Atendimento (`POST /api/worklogs`):**
   - Registra o primeiro evento no histórico (`fromStatus: "Registro Inicial"`, `toStatus: finalStatus`, `changedById: user.id`).
2. **Atualização de Status (`PATCH /api/worklogs/:id/status`):**
   - Autenticado via `authenticateToken`.
   - Verifica se o status mudou. Caso tenha mudado:
     - Atualiza `workLog.status`.
     - Insere registro em `WorkLogStatusHistory` com `fromStatus`, `toStatus` e `changedById = req.user.id`.
     - Retorna `{ success: true, status: updated.status, history: updatedHistory }`.
3. **Listagem e Consulta (`GET /api/worklogs` e `GET /api/worklogs/:id`):**
   - Inclui `statusHistory` com os dados do usuário (`changedBy: { select: { id: true, name: true, role: true } }`), ordenado cronologicamente (`createdAt: "desc"` ou `"asc"`).

---

## 4. Interface do Usuário (UI/UX)
1. **Seletor de Status Interativo no Cabeçalho do Card (`WorkLogDetailContent.tsx`):**
   - O badge de status atual do card se torna um dropdown/menu interativo elegante.
   - Opções padronizadas:
     - `Realizado`
     - `Em andamento`
     - `Solucionado`
     - `Aguardando reunião`
     - `Não foi possível realizar`
     - `Backlog`
   - Exibe indicador de atualização enquanto a requisição `PATCH` é executada e atualiza o estado local e global via `onRefresh`.
2. **Linha do Tempo no Canto Inferior do Card:**
   - Seção intitulada **Histórico de Alterações de Status** com ícone `Clock` / `History`.
   - Cada evento da linha do tempo exibe:
     - Linha vertical conectora e dot colorido conforme a categoria do status.
     - Nome do colaborador que realizou a alteração e cargo (ex: Administrador, Suporte, Técnico).
     - Pílula de transição: `Status Anterior ➔ Novo Status`.
     - Data e hora formatadas em português (`DD/MM/AAAA às HH:mm`).
   - Totalmente compatível com o Design System CloudNexus nos modos Claro e Escuro.
