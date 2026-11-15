# Reordenação dos Campos e Grid Quadrado Compacto de Mídias — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reordenar os blocos do formulário `WorkLogForm.tsx` posicionando "Anexar Mídia" imediatamente após "Descrição", e transformar a lista de mídias anexadas em uma grade fluida de cards quadrados compactos com preview em destaque e truncamento clássico de nomes.

**Architecture:** Modificação do layout JSX em `WorkLogForm.tsx` mantendo a integridade da lógica de estado, submissão e sincronização bidirecional criada no Tópico 1. Criação de função utilitária `truncateMiddle` para truncamento clássico inteligente preservando nome e extensão.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React.

**Spec:** [docs/superpowers/specs/2026-11-15-form-order-and-compact-media-grid-design.md](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-15-form-order-and-compact-media-grid-design.md)

---

## Global Constraints

- Manter 100% da integridade de sincronização bidirecional com o editor inline (`InlineMediaEditor`).
- Os cards devem continuar totalmente arrastáveis (`draggable`) para dentro do campo de descrição.
- O botão `×` de remoção deve revogar URLs temporárias e remover chips correspondentes do editor.
- Verificação obrigatória com `npm run build` e testes automatizados.
- Desenvolver em branch de funcionalidade (`feature/form-order-compact-media-grid`) e submeter via Pull Request.

## Review Focus

1. **Nomes de arquivos muito longos:** Devem ser truncados de forma limpa pelo `truncateMiddle` (ex: `Captura de tela 2026-10-15 003713.png` -> `Captura...3713.png`) sem vazar ou quebrar a largura do card.
2. **Arquivos não-imagem anexados:** Devem exibir fundo neutro com ícone do tipo (`FileText`, `Video`, etc.) e rótulo de extensão sem falhar ao tentar renderizar `<img>`.
3. **Arrasto fluido do card para o editor:** O evento `onDragStart` deve funcionar perfeitamente a partir do card quadrado com `e.dataTransfer.setData("application/x-hubsupport-media-id", item.id)`.
4. **Visibilidade do botão de exclusão:** O botão `×` flutuante deve ter contraste garantido contra fotos claras ou escuras via `bg-black/50 hover:bg-rose-600`.
5. **Responsividade da grade:** A grade deve acomodar cards em telas menores (mobile/modal estreito) e expandir fluidamente em telas maiores (`grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5`).

---

## Task Structure

### Task 1: Utilitário de Truncamento Clássico (`truncateMiddle`)

**Files:**
- Modify: `src/lib/inline-media-parser.ts`
- Test: `scripts/test-truncate-middle.ts`

**Interfaces:**
- Produces: `truncateMiddle(filename: string, maxLength?: number): string`

- [ ] **Step 1: Criar teste de unidade para `truncateMiddle`**
  Create `scripts/test-truncate-middle.ts` testando:
  - Nomes curtos (sem truncamento).
  - Nomes longos com extensão (ex: `Captura de tela 2026-10-15 003713.png` -> `Captura...3713.png`).
  - Nomes longos sem extensão.
  - Caracteres especiais e múltiplos pontos.

- [ ] **Step 2: Implementar `truncateMiddle` em `src/lib/inline-media-parser.ts`**
  Adicionar a função utilitária exportada `truncateMiddle(filename: string, maxLength: number = 18): string`.

- [ ] **Step 3: Executar teste de unidade**
  Run: `npx tsx scripts/test-truncate-middle.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add src/lib/inline-media-parser.ts scripts/test-truncate-middle.ts
  git commit -m "feat(ui): add truncateMiddle helper for media cards"
  ```

---

### Task 2: Reordenação dos Campos e Grid Quadrado em `WorkLogForm.tsx`

**Files:**
- Modify: `src/components/WorkLogForm.tsx`
- Test: `scripts/test-worklog-form-interleaved.ts`

**Interfaces:**
- Consumes: `truncateMiddle`, `attachedMedia`, `insertedMediaIds`
- Produces: Novo layout ordenado de formulário e grade fluida de cards quadrados.

- [ ] **Step 1: Reordenar as seções do JSX em `WorkLogForm.tsx`**
  Mover o bloco de **Anexar Mídia** (Dropzone + lista de anexos) para ficar logo abaixo de **Descrição**, antes de **Tag de Plataforma** e **Tipo de Atendimento**.

- [ ] **Step 2: Substituir a lista de arquivos por Grade Fluida de Cards Quadrados**
  - Container: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 mt-3`.
  - Card quadrado: `aspect-square rounded-xl overflow-hidden relative border border-slate-200 dark:border-slate-800 ...`.
  - Miniatura: `object-cover w-full h-full` para imagens; ícone SVG + extensão para PDFs/vídeos/docs.
  - Botão de remoção flutuante no topo direito: `w-5 h-5 rounded-md bg-black/50 hover:bg-rose-600 text-white`.
  - Badge flutuante `✓ No texto` no topo esquerdo: `bg-indigo-600/90 text-white text-[9px]`.
  - Faixa inferior translúcida com gradiente e nome truncado via `truncateMiddle(item.name, 16)`.
  - Atributo `draggable={!isPending}` e `onDragStart`.

- [ ] **Step 3: Atualizar teste automatizado do formulário**
  Executar `npx tsx scripts/test-worklog-form-interleaved.ts` para garantir que todas as 45 asserções continuam passando.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/WorkLogForm.tsx scripts/test-worklog-form-interleaved.ts
  git commit -m "feat(form): reorder fields and implement compact square media grid"
  ```

---

### Task 3: Verificação, Build e Pull Request

**Files:**
- Test: Todos os scripts de teste e `npm run build`.

- [ ] **Step 1: Executar compilação completa**
  Run: `npm run build`
  Expected: PASS com zero erros.

- [ ] **Step 2: Executar testes de regressão**
  Run: `npx tsx scripts/test-worklogs-route-interleaved.ts`
  Run: `npx tsx scripts/test-gemini-interleaved-prompt.ts`
  Run: `npx tsx scripts/test-agenda-meeting-notes-e2e.ts`
  Expected: Todos PASS.

- [ ] **Step 3: Criar Pull Request no GitHub**
  - Push da branch `feature/form-order-compact-media-grid`.
  - Criar PR no GitHub e acompanhar checks.
