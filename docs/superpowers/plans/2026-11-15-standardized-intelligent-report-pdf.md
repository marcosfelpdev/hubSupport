# Padronização Inteligente do Modelo de Relatório em PDF — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o novo padrão corporativo de relatórios técnicos em PDF com PDFKit e Google Gemini, integrando cores reativas da tag da plataforma, inclusão visual de evidências/prints reais com legendas, cards comparativos de comportamento (`Comportamento Atual` vs `Comportamento Esperado`), e seção técnica com hipótese diagnóstica, fluxograma de gargalo e blocos de código sugerido.

**Architecture:** Atualização do `REPORT_SCHEMA` e prompt do Google Gemini em `src/lib/gemini.ts` com regras estritas de autocensura para evitar deduções vagas. Refatoração modular de `src/lib/pdf-generator.ts` criando renderizadores vetoriais em PDFKit com cálculo dinâmico de aspect ratio de imagens, paginação inteligente (`Página X de Y`) e estilização profissional.

**Tech Stack:** Node.js, TypeScript, PDFKit (`pdfkit`), Google GenAI SDK (`@google/genai`), Prisma ORM, Cloudflare R2 Storage.

**Spec:** [docs/superpowers/specs/2026-11-15-standardized-intelligent-report-pdf-design.md](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-15-standardized-intelligent-report-pdf-design.md)

---

## Global Constraints

- O título do documento deve ser exatamente o texto preenchido no campo `title` do chamado (sem qualquer numeração "Nota XX").
- A cor de destaque principal do relatório deve ser reativa, herdando a cor da tag da plataforma selecionada (`tag.color` hex).
- Mídias inline devem ser desenhadas no fluxo narrativo e mídias complementares em grade elegante com legendas.
- Diagramas e blocos de código devem ser gerados apenas para atendimentos de *Ação Técnica* ou *Implementação*, com filtro rigoroso de autocensura (omitindo o bloco se for vago).
- Manter o padrão de privacidade do projeto: arquivos temporários da Files API do Gemini deletados no `finally` e PDFs salvos em storage privado (`storage/reports/`).
- Verificação obrigatória com `npm run build` e suíte de testes automatizados.
- Desenvolver em branch de funcionalidade (`feature/standardized-intelligent-report-pdf`) e submeter via Pull Request.

## Review Focus

1. **Quebra de página dinâmica em imagens:** O motor do PDFKit deve calcular dinamicamente a altura das imagens e legendas para nunca cortar uma imagem ou legenda na linha do rodapé.
2. **Cores da Tag (Hex para RGB):** O PDFKit aceita strings hexadecimais, mas tintura com opacidade (alpha) exige conversão segura para RGB/RGBA sem lançar exceções.
3. **Imagens que falham ao carregar ou corrompidas:** Caso uma imagem não possa ser lida do storage, o gerador deve exibir um card de fallback elegante com o nome do arquivo em vez de travar o processo.
4. **Retrocompatibilidade com relatórios sem código ou sem imagens:** Chamados simples sem evidências ou sem código devem renderizar perfeitamente omitindo seções não aplicáveis sem deixar espaços em branco vazios.
5. **Autocensura da IA em deduções vagas:** Quando o operador registrar uma descrição sucinta, a IA não deve alucinar códigos fictícios nem diagramas sem sentido.

---

## Task Structure

### Task 1: Atualização dos Tipos, Schema do Gemini e Contexto

**Files:**
- Modify: `src/lib/gemini.ts:1-120, 230-620`
- Modify: `src/lib/report-processor.ts:40-100`
- Test: `scripts/test-gemini-schema-update.ts`

**Interfaces:**
- Produces: `StructuredReportData` atualizado e `REPORT_SCHEMA` estrito no Gemini SDK.
- Produces: `WorkLogContext.tagColor?: string` transmitido para o gerador de PDF.

- [ ] **Step 1: Criar teste de validação do schema e prompt estruturado**
  Create `scripts/test-gemini-schema-update.ts` validando a estrutura e os novos campos (`currentBehavior`, `expectedBehavior`, `evidenceCaptions`, `routeEnvironment`, `documentNature`, `diagnosticHypothesis`, `logicalDiagram`, `codeSuggestion`).

- [ ] **Step 2: Atualizar `StructuredReportData` e `REPORT_SCHEMA` em `src/lib/gemini.ts`**
  - Adicionar campos tipados no `StructuredReportData`.
  - Definir novos nós no `REPORT_SCHEMA` com tipos JSON estritos e descrições claras para o modelo.
  - Atualizar os prompts em `analyzeRecordingWithGemini` e `analyzeFormWithGemini` com as novas instruções corporativas, regras de dedução e filtro de autocensura.

- [ ] **Step 3: Atualizar `report-processor.ts` para repassar `tagColor`**
  - Passar `tagColor: workLog.tag?.color || "#3b82f6"` no `context` para `generateReportPdf`.

- [ ] **Step 4: Executar teste do schema**
  Run: `npx tsx scripts/test-gemini-schema-update.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/gemini.ts src/lib/report-processor.ts scripts/test-gemini-schema-update.ts
  git commit -m "feat(ai): update Gemini report schema for intelligent QA and investigation structure"
  ```

---

### Task 2: Refatoração Modular do Gerador de PDF (`pdf-generator.ts`)

**Files:**
- Modify: `src/lib/pdf-generator.ts`
- Test: `scripts/test-pdf-generator-new-format.ts`

**Interfaces:**
- Consumes: `GeneratePdfOptions` com `data: StructuredReportData`, `context: WorkLogContext`, mídias do storage.
- Produces: Arquivo PDF vetorial de alta fidelidade salvo em `storage/reports/`.

- [ ] **Step 1: Escrever teste de compilação vetorial de PDF**
  Create `scripts/test-pdf-generator-new-format.ts` gerando um relatório completo em PDF contendo:
  - Cabeçalho dinâmico com cor de tag personalizada (`#f59e0b`).
  - Card de metadados em 4 quadrantes.
  - Cards comparativos de comportamento (`× Atual` em vermelho vs `✓ Esperado` em verde).
  - Grade de evidências visuais com imagens reais e legendas inferiores.
  - Banner investigativo âmbar.
  - Diagrama lógico de gargalo (`ESTADO GLOBAL ≠ EVENTO ON_DRAG`).
  - Bloco de código monospace com fundo `#0f172a`.
  - Rodapé corporativo em todas as páginas com numeração dinâmica.

- [ ] **Step 2: Implementar renderizadores modulares em `src/lib/pdf-generator.ts`**
  - Helper de conversão Hex para RGB e cores dinâmicas da tag.
  - Bloco 1: Cabeçalho com barra vertical na cor da tag, badge de plataforma, data e título literal.
  - Bloco 2: Card de Metadados (4 quadrantes: Solicitante, Suporte, Ambiente da Rota, Natureza do Documento).
  - Bloco 3: Resumo Executivo em caixa com fundo cinza neutro e cantos arredondados.
  - Bloco 4: Cards Comparativos de Comportamento lado a lado (`× Comportamento Atual` vs `✓ Comportamento Esperado`).
  - Bloco 5: Evidências Visuais (imagens reais lidas via `getFileBuffer`, redimensionadas proporcionalmente com legendas escuras inferiores).
  - Bloco 6: Seção Técnica Investigativa (Banner âmbar, Hipótese Diagnóstica, Caixa de Diagrama Lógico de Gargalo e Bloco de Código Monospace).
  - Bloco 7: Transcrição de Áudio (quando presente).
  - Bloco 8: Rodapé institucional em todas as páginas (`Relatório Técnico de Suporte - [Plataforma] ([Cliente])` e `Página X de Y`).

- [ ] **Step 3: Executar teste de geração de PDF**
  Run: `npx tsx scripts/test-pdf-generator-new-format.ts`
  Expected: PASS (arquivo gerado com sucesso, tamanho válido e páginas bufferizadas).

- [ ] **Step 4: Commit**
  ```bash
  git add src/lib/pdf-generator.ts scripts/test-pdf-generator-new-format.ts
  git commit -m "feat(pdf): modernize PDFKit report generator with dynamic tags, cards, code blocks and visual evidence"
  ```

---

### Task 3: Verificação Completa, Build e Pull Request

**Files:**
- Test: Todas as suítes de teste e `npm run build`.

- [ ] **Step 1: Executar compilação completa de produção**
  Run: `npm run build`
  Expected: PASS com 0 erros.

- [ ] **Step 2: Executar testes de regressão existentes**
  Run: `npx tsx scripts/test-worklogs-route-interleaved.ts`
  Run: `npx tsx scripts/test-gemini-interleaved-prompt.ts`
  Run: `npx tsx scripts/test-agenda-meeting-notes-e2e.ts`
  Expected: Todos PASS.

- [ ] **Step 3: Criar Pull Request no GitHub**
  - Push da branch `feature/standardized-intelligent-report-pdf`.
  - Criar PR no GitHub, acompanhar os checks de CI e realizar o merge.
