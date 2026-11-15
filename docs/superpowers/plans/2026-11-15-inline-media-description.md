# Inserção de Mídia Inline no Campo de Descrição — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar editor multimodal inline no campo de descrição de atendimentos (`WorkLogForm.tsx`), permitindo inserção de mídias entre as palavras (via drag-and-drop local, drag-and-drop da lista inferior e colar prints com Ctrl+V), drop cursor visual, chips atômicos com miniatura, sincronização bidirecional com a lista de anexos e envio intercalado (`interleaved`) para o Google Gemini.

**Architecture:** Componente customizado `InlineMediaEditor.tsx` em React 19 + TypeScript + Tailwind CSS usando `contentEditable="true"`, gerenciado com a Selection/Range API nativa do DOM para garantir zero dependências externas. Sincronização de estado bidirecional com a lista de anexos do formulário via identificadores únicos de mídia. Backend e Gemini (`worklogs.routes.ts`, `report-processor.ts`, `gemini.ts`) adaptados para persistir e processar arrays multimodais intercalados de texto e imagens.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Express 5, Prisma ORM 5 (SQLite), Google GenAI SDK (`@google/genai`).

**Spec:** [docs/superpowers/specs/2026-11-15-inline-media-description-design.md](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-15-inline-media-description-design.md)

---

## Global Constraints

- Proibido salvar arquivos ou gravações na pasta `public/` (regra permanente de privacidade do projeto).
- Proibido utilizar frameworks pesados de rich-text de terceiros (TipTap, Lexical, Draft.js) para evitar inchaço no bundle e incompatibilidades com o React 19.
- O campo de descrição deve funcionar de forma idêntica tanto para "Novo Atendimento" quanto para o formulário pós "Gravar Tela".
- Verificação obrigatória com `npx vite build` e testes E2E antes de concluir a entrega.
- Todas as alterações devem ser desenvolvidas na branch `feature/inline-media-description` e submetidas via Pull Request.

## Review Focus

1. **Arquivos não-imagem arrastados para o texto:** Devem exibir ícone correspondente e nome truncado no chip; no payload para o Gemini, arquivos não aceitos em binário (como `.xlsx`) devem virar marcadores textuais `[Arquivo anexado: planilha.xlsx]` para evitar erro 400 da API da Google.
2. **Exclusão atômica via teclado:** Pressionar Backspace ou Delete logo após/antes de um chip deve remover o chip inteiro sem deixar resquícios de tags HTML quebradas ou nós vazios no DOM.
3. **Múltiplos arquivos ou duplicatas:** Cada anexo deve receber um `mediaId` único (ex: `media_${Date.now()}_${random}`), permitindo remover uma instância sem afetar arquivos com o mesmo nome.
4. **Retrocompatibilidade com texto puro:** Chamados criados sem mídia inline devem continuar funcionando perfeitamente, com `descriptionInterleaved` nulo/vazio e fallback limpo para `reportedProblem`.
5. **Preservação de quebras de linha e espaços:** O parser do editor deve converter tags `<div>`, `<p>` e `<br>` em `\n` limpos sem perder espaçamento entre as palavras e os chips inline.

---

## Task Structure

### Task 1: Atualização do Schema do Prisma e Persistência no Banco

**Files:**
- Modify: `prisma/schema.prisma:40-65`
- Test: `scripts/test-prisma-schema.ts`

**Interfaces:**
- Produces: `WorkLog.descriptionInterleaved: String?` (coluna opcional no SQLite para armazenar o JSON do array intercalado).

- [ ] **Step 1: Adicionar campo `descriptionInterleaved` no modelo `WorkLog` em `prisma/schema.prisma`**
  ```prisma
  descriptionInterleaved String? @db.Text // JSON estruturado alternando blocos de texto e referências de mídia
  ```

- [ ] **Step 2: Sincronizar o schema com o banco de dados local via Prisma**
  Run: `npx prisma db push`
  Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Criar teste de verificação do Prisma Client**
  Create `scripts/test-prisma-schema.ts` verificando que o Prisma Client reconhece o campo `descriptionInterleaved` em consultas e inserções.
  Run: `npx tsx scripts/test-prisma-schema.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add prisma/schema.prisma scripts/test-prisma-schema.ts
  git commit -m "feat(db): add descriptionInterleaved column to WorkLog model"
  ```

---

### Task 2: Componente `InlineMediaEditor.tsx` & Parser Intercalado

**Files:**
- Create: `src/components/common/InlineMediaEditor.tsx`
- Create: `src/lib/inline-media-parser.ts`
- Test: `scripts/test-inline-media-parser.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AttachedMediaItem {
    id: string;
    file: File;
    name: string;
    size: number;
    mimeType: string;
    previewUrl: string;
  }

  export interface InterleavedBlock {
    type: "text" | "media";
    content?: string;
    mediaId?: string;
    filename?: string;
    mimeType?: string;
    fileIndex?: number;
  }

  export function parseEditorDomToInterleaved(container: HTMLElement, mediaMap: Map<string, AttachedMediaItem>): {
    plainText: string;
    interleaved: InterleavedBlock[];
    insertedMediaIds: Set<string>;
  };
  ```

- [ ] **Step 1: Escrever teste de unidade para o parser intercalado**
  Create `scripts/test-inline-media-parser.ts` testando:
  - Texto antes, chip de imagem, texto no meio, chip de documento, texto final.
  - Quebras de linha e nós aninhados normais do DOM.
  - Extração limpa de `plainText` com marcadores `[Imagem: foto.png]` e array `interleaved` ordenado.

- [ ] **Step 2: Rodar teste para verificar que falha**
  Run: `npx tsx scripts/test-inline-media-parser.ts`
  Expected: FAIL (módulo ainda não existe).

- [ ] **Step 3: Implementar `src/lib/inline-media-parser.ts`**
  Implementar função recursiva que percorre `childNodes`, identificando nós de texto (`Node.TEXT_NODE`) e chips de mídia (`[data-media-id]`).

- [ ] **Step 4: Rodar teste do parser para verificar sucesso**
  Run: `npx tsx scripts/test-inline-media-parser.ts`
  Expected: PASS

- [ ] **Step 5: Implementar `src/components/common/InlineMediaEditor.tsx`**
  - Container `div contentEditable="true"` com estilos do Tailwind idênticos aos inputs do HubSupport.
  - Suporte a Drop Cursor visual durante `onDragOver` usando `document.caretRangeFromPoint` / `caretPositionFromPoint`.
  - Manipulação de `onDrop` para:
    1) Arquivos locais do SO (`e.dataTransfer.files`).
    2) Drag interno de mídia existente (`e.dataTransfer.getData("application/x-hubsupport-media-id")`).
  - Manipulação de `onPaste`: intercepta itens com `image/*`, converte em File/AttachedMediaItem e insere o chip inline na seleção atual.
  - Manipulação de `onKeyDown`: remoção atômica em Backspace/Delete quando o cursor estiver adjacente a um chip `contenteditable="false"`.
  - Renderização do chip com thumbnail para imagens ou ícone para outros arquivos, nome truncado e botão `×` para exclusão.
  - Notificação de mudança de conteúdo via callback `onChange(plainText, interleaved, insertedMediaIds)`.

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/inline-media-parser.ts src/components/common/InlineMediaEditor.tsx scripts/test-inline-media-parser.ts
  git commit -m "feat(ui): create InlineMediaEditor with atomic chips and interleaved parser"
  ```

---

### Task 3: Integração no `WorkLogForm.tsx` & Sincronização Bidirecional

**Files:**
- Modify: `src/components/WorkLogForm.tsx:424-437, 577-691, 190-230`
- Test: `scripts/test-worklog-form-interleaved.ts`

**Interfaces:**
- Consumes: `InlineMediaEditor`, `AttachedMediaItem`, `InterleavedBlock` de Task 2.
- Produces: `WorkLogForm` submetendo `FormData` com `reportedProblem`, `descriptionInterleaved` (JSON string) e arquivos `media`.

- [ ] **Step 1: Substituir `<textarea id="reportedProblem">` pelo `<InlineMediaEditor>` em `WorkLogForm.tsx`**
  - Manter labels, obrigatoriedade e mensagens de acessibilidade.
  - Conectar estado de mídias anexadas (`mediaItems: AttachedMediaItem[]`).

- [ ] **Step 2: Atualizar a lista inferior de anexos com drag-and-drop e badge "No texto"**
  - Adicionar `draggable={true}` e `onDragStart={(e) => e.dataTransfer.setData("application/x-hubsupport-media-id", item.id)}` aos cards de mídia da lista inferior.
  - Exibir badge sutil índigo/azul `[✓ No texto]` nos cards da lista cujos IDs estejam presentes em `insertedMediaIds`.
  - Permitir que, se o chip for excluído do texto, o badge desapareça imediatamente e o item permaneça na lista inferior.
  - Se o usuário clicar em "Remover" na lista inferior, remover o anexo da lista E remover seus chips correspondentes do editor de texto.

- [ ] **Step 3: Ajustar `handleSubmit` em `WorkLogForm.tsx`**
  - Inserir `descriptionInterleaved` serializado em JSON no `formData.set("descriptionInterleaved", JSON.stringify(interleaved))`.
  - Enviar todos os arquivos físicos (`media`) mapeados no formulário.
  - Manter compatibilidade com `activeRecordedVideo` para o fluxo de "Gravar Tela".

- [ ] **Step 4: Verificar compilação do Vite**
  Run: `npx vite build`
  Expected: PASS (zero erros de TypeScript).

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/WorkLogForm.tsx
  git commit -m "feat(form): integrate InlineMediaEditor with two-way attachment sync"
  ```

---

### Task 4: Backend REST API e Persistência (`worklogs.routes.ts`)

**Files:**
- Modify: `src/server/routes/worklogs.routes.ts:213-360`
- Test: `scripts/test-worklogs-route-interleaved.ts`

**Interfaces:**
- Consumes: `descriptionInterleaved` enviado via `multipart/form-data`.
- Produces: Registro `WorkLog` persistido no SQLite contendo `descriptionInterleaved` atualizado com as URLs salvas das mídias.

- [ ] **Step 1: Criar teste de integração da rota `POST /api/worklogs` com payload intercalado**
  Create `scripts/test-worklogs-route-interleaved.ts` testando criação de chamado com texto e mídias intercaladas.

- [ ] **Step 2: Atualizar `POST /api/worklogs` em `src/server/routes/worklogs.routes.ts`**
  - Extrair `descriptionInterleaved` de `req.body`.
  - Correlacionar os IDs das mídias do array intercalado com os caminhos finais gravados no storage (`/uploads/timestamp-nome`).
  - Persistir o JSON resultante em `prisma.workLog.create({ data: { ..., descriptionInterleaved } })`.
  - Garantir que o job assíncrono `processAiReportJob(newLog.id)` seja acionado normalmente.

- [ ] **Step 3: Executar teste de integração**
  Run: `npx tsx scripts/test-worklogs-route-interleaved.ts`
  Expected: PASS (registro criado com `descriptionInterleaved` preenchido no SQLite).

- [ ] **Step 4: Commit**
  ```bash
  git add src/server/routes/worklogs.routes.ts scripts/test-worklogs-route-interleaved.ts
  git commit -m "feat(api): persist descriptionInterleaved in POST /api/worklogs"
  ```

---

### Task 5: Pipeline Multimodal do Gemini AI (`gemini.ts` & `report-processor.ts`)

**Files:**
- Modify: `src/lib/gemini.ts:490-620, 237-440`
- Modify: `src/lib/report-processor.ts:48-120`
- Test: `scripts/test-gemini-interleaved-prompt.ts`

**Interfaces:**
- Consumes: `workLog.descriptionInterleaved` e arquivos do storage.
- Produces: Payload multimodal do Gemini com partes de texto e imagens ordenadas na sequência da narrativa + mídias complementares em anexo.

- [ ] **Step 1: Criar teste para o montador de prompt multimodal intercalado**
  Create `scripts/test-gemini-interleaved-prompt.ts` validando:
  - Alternância correta de `{ text: "..." }` e `{ inlineData: { mimeType, data: base64 } }`.
  - Inclusão de mídias não citadas no texto na seção *"Mídias Complementares em Anexo"*.
  - Conversão de arquivos não-imagem em texto contextual descritivo.

- [ ] **Step 2: Atualizar `analyzeFormWithGemini` em `src/lib/gemini.ts`**
  - Se `descriptionInterleaved` estiver presente, iterar pelos blocos gerando as partes do `contents`:
    - Bloco de texto -> objeto `{ text: block.content }`.
    - Bloco de imagem -> objeto `{ inlineData: { mimeType, data: base64 } }`.
    - Arquivo de planilha/doc não suportado em binário -> `{ text: `\n[Arquivo em anexo: ${block.filename}]\n` }`.
  - Para arquivos da lista geral que não apareceram no texto intercalado, anexar ao final sob a seção *"### Mídias Complementares em Anexo"*.

- [ ] **Step 3: Atualizar `analyzeRecordingWithGemini` para suportar imagens inline da descrição**
  - Se houver gravação de tela E imagens inline na descrição, incluir as imagens inline junto com o vídeo no array `contents: [videoPart, ...imageParts, prompt]`.

- [ ] **Step 4: Atualizar `report-processor.ts` para carregar `descriptionInterleaved`**
  - Passar `workLog.descriptionInterleaved` para as funções de análise de IA.

- [ ] **Step 5: Executar teste do pipeline do Gemini**
  Run: `npx tsx scripts/test-gemini-interleaved-prompt.ts`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/gemini.ts src/lib/report-processor.ts scripts/test-gemini-interleaved-prompt.ts
  git commit -m "feat(ai): support interleaved multimodal prompt and complementary media in Gemini"
  ```

---

### Task 6: Verificação de Build, Testes E2E e Entrega

**Files:**
- Test: All tests in `scripts/` and existing test suite.

- [ ] **Step 1: Executar build completo do projeto**
  Run: `npm run build`
  Expected: Compilação limpa do Vite e Prisma sem warnings ou erros.

- [ ] **Step 2: Executar testes de regressão existentes**
  Run: `npx tsx scripts/test-agenda-meeting-notes-e2e.ts`
  Expected: Todos os testes passando com sucesso.

- [ ] **Step 3: Criar Pull Request no GitHub**
  - Push da branch `feature/inline-media-description`.
  - Abrir PR referenciando a issue e solicitando merge após aprovação da CI.
