# Design Doc: Governança do Kanban, Notas de Validação, Edição de Relatórios e Redesign do Card Minimizado

- **Data:** 19/11/2026
- **Status:** Aprovado
- **Autor:** Antigravity / HubSupport Team

---

## 1. Visão Geral e Objetivos

Este documento especifica a modernização do fluxo operacional do Kanban Técnico e a reestruturação visual dos cartões de atendimento minimizados no HubSupport.

### Objetivos Principais:
1. **Governança Estrita de Validação:** Impedir que chamados técnicos sejam finalizados diretamente via arrasto. Todo atendimento deve obrigatoriamente passar pela coluna de **Validação** e só pode ser finalizado pelo clique explícito no botão **"Aprovar Solução"**. Caso o usuário tente arrastar para a coluna "Finalizadas", o sistema emite notificação e move o card diretamente para a coluna "Validação".
2. **Ciclo de Recusa com Justificativa Obrigatória:** Se um atendimento em "Validação" for devolvido para etapas anteriores (*Backlog*, *Pendências* ou *Em progresso*), o preenchimento de uma nota com o motivo da reprovação é estritamente obrigatório. Essa justificativa fica gravada no histórico do chamado.
3. **Indicador Visual de Reprovação no Card:** No card minimizado, um sinalizador visual sutil (ícone com tooltip informativo) indica que a solução anterior não foi aprovada na validação, sem poluir a interface.
4. **Notas e Edição de Relatórios:** Criação de entidade relacional `WorkLogNote` para permitir anotações livres e apontamentos da equipe técnica. Habilitação de edição de dados do relatório por qualquer usuário autenticado, com registro obrigatório de auditoria no histórico do chamado.
5. **Redesign do Card Minimizado:**
   - Remoção completa da faixa de rodapé inferior (antiga tarja de categoria).
   - Remoção do badge textual de status (`• Em progresso`, `• Backlog`, etc.).
   - Inserção de ícones compactos no canto superior direito:
     - **Ícone de Categoria:** Ícone e cor configurados no banco (`WorkLogCategory`), mantendo tamanho proporcional.
     - **Ícone de Status:** Ícone semântico padronizado (`Inbox` para Backlog, `Clock` para Pendências, `Hourglass` para Em progresso, `ShieldAlert` para Validação e `CheckCircle2` para Finalizado).

---

## 2. Arquitetura e Modelagem de Dados

### 2.1 Modelo Prisma (`prisma/schema.prisma`)
Adição do modelo `WorkLogNote` e flag de rastreio de reprovação:

```prisma
model WorkLogNote {
  id         String   @id @default(cuid())
  workLogId  String
  workLog    WorkLog  @relation(fields: [workLogId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content    String   @db.Text
  type       String   @default("general") // "general" | "rejection"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

Atualização no modelo `WorkLog`:
```prisma
model WorkLog {
  // ... campos existentes ...
  hasValidationRejection Boolean       @default(false)
  notes                  WorkLogNote[]
}
```

Atualização no modelo `WorkLogStatusHistory` para suportar auditoria de edições:
- `fromStatus` e `toStatus` passam a suportar `"Edição de Relatório"`, ou o detalhe da modificação no histórico.

---

## 3. Endpoints REST da API

1. **`PATCH /api/worklogs/:id/status`**:
   - Valida se o status de origem era `"Validação"` e o novo status é anterior (`"Backlog"`, `"Pendências"`, `"Em progresso"`).
   - Exige obrigatoriamente o envio de `rejectionReason: string` (mínimo de 3 caracteres). Caso ausente, retorna `400 Bad Request`.
   - Na transação: atualiza o status, cria o registro em `WorkLogStatusHistory`, cria um registro em `WorkLogNote` com `type = "rejection"` e seta `hasValidationRejection = true`.
   - Se a requisição tentar mover diretamente para `"Solucionado"` ou `"Finalizadas"` via status genérico, rejeita com `400` orientando o uso do endpoint de resolução formal ou move para `"Validação"`.

2. **`PUT /api/worklogs/:id`**:
   - Permite que usuários autenticados editem campos do atendimento (`title`, `requester`, `clientOrOffice`, `reportedProblem`, `actionTaken`, `tagId`, `categoryId`).
   - Registra uma entrada no `WorkLogStatusHistory` com `fromStatus: "Edição de Dados"`, `toStatus: "Atualizado por [Nome]"` para manter a rastreabilidade completa.

3. **`GET /api/worklogs/:id/notes` & `POST /api/worklogs/:id/notes`**:
   - Listagem e criação de notas gerais para o atendimento.

4. **`defaultWorkLogInclude`**:
   - Passa a incluir `notes: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" } }`.

---

## 4. Interface e Experiência do Usuário (UI/UX)

### 4.1 Card Minimizado (`ReportCardMinimized.tsx`)
- **Linha Superior Direita:**
  - `TagBadge` do cliente/departamento à esquerda.
  - À direita:
    - Se houver `isAiGenerating` ou `isAiCompleted`: Sparkles mantido.
    - Se houver `hasValidationRejection` ou nota de rejeição recente: ícone sutil `RotateCcw` ou `AlertTriangle` em cor âmbar (`text-amber-500`) com tooltip `"Atenção: Atendimento reprovado na validação anterior"`.
    - Ícone de Categoria: renderizado via `getCategoryIconComponent` com a cor da categoria e tooltip com o nome.
    - Ícone de Status:
      - *Backlog:* `Inbox` (cor slate/indigo)
      - *Pendências:* `Clock` (cor âmbar)
      - *Em progresso:* `Hourglass` (cor azul céu / sky)
      - *Validação:* `ShieldAlert` (cor roxo / purple)
      - *Finalizadas:* `CheckCircle2` (cor verde esmeralda)
- **Eliminação do Rodapé:** remoção total da div inferior de rodapé. Card ganha mais respiro interno mantendo a altura padronizada de `185px`.

### 4.2 Kanban Board (`TechnicianKanbanBoard.tsx`)
- **Intercepção de Arraste para Finalizadas:**
  - Se `targetColId === "finalizadas"`:
    - Cancela a ida para finalizadas.
    - Exibe Toast/Alerta: *"Atenção: O atendimento precisa obrigatoriamente passar por validação antes da finalização."*
    - Move o card para a coluna `validacao` (`Validação`).
- **Intercepção de Arraste de Validação para Trás:**
  - Se `currentColumn === "validacao"` e `targetColId !== "validacao"`:
    - Abre o modal de justificativa obrigatória (`ValidationRejectionModal`).
    - Somente ao submeter a justificativa, o card é movido para o status destino e a nota é salva.
    - Se cancelar, o card permanece em `validacao`.

### 4.3 Modal de Detalhes Maximizado (`WorkLogDetailContent.tsx`)
- **Seção de Notas:** lista de anotações com destaque visual para justificativas de recusa e campo para nova nota.
- **Botão Editar Atendimento:** permite alternar para modo de edição de formulário com salvamento via `PUT /api/worklogs/:id`.
- **Botão Reprovar no Banner de Validação:** abre o mesmo modal de justificativa obrigatória antes de voltar para "Em progresso".
- **Botão Aprovar Solução:** continua sendo a via oficial de aprovação e finalização para a coluna "Finalizadas".
