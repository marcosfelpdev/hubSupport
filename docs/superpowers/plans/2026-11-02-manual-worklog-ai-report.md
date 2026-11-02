# Geração de Relatório com IA para Atendimentos Manuais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que chamados registrados sem gravação de tela através do botão "+ Novo Atendimento" possam ter relatórios técnicos e executivos gerados por IA sob demanda no card maximizado, analisando todas as informações do chamado e imagens anexadas com Google Gemini e compilando o PDF corporativo com PDFKit.

**Architecture:**
1. No backend, criar a função `analyzeFormWithGemini` em `src/lib/gemini.ts` e atualizar `src/lib/report-processor.ts` para processar chamados sem gravação de vídeo, aceitando imagens anexadas como partes multimodais.
2. Criar o endpoint `POST /api/worklogs/:id/generate-ai-report` em `src/server/routes/worklogs.routes.ts` e adicionar o método correspondente no cliente HTTP (`api.worklogs.generateAiReport`).
3. No componente `src/components/AiReportSection.tsx`, quando o chamado não possuir relatório gerado, renderizar o banner de ação destacado da Opção 1 com o botão `[✨ Gerar Relatório com IA]` e transição em tempo real para os estados de processamento e download do PDF.

**Tech Stack:** Node.js, Express, Prisma ORM, Google Gemini 2.0 Flash (`@google/genai`), PDFKit, React 19, TypeScript, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-02-manual-worklog-ai-report-design.md`

## Global Constraints
- Preserve existing authentication, role hierarchies, and worklog/reports pipelines.
- Do not move recordings or PDFs to `public/`.
- Ensure light and dark themes (CloudNexus) remain 100% consistent across all modifications.
- Sempre utilizar `REPORT_SCHEMA` estrito em JSON com fallback defensivo para a geração via Gemini.

## Review Focus
- Atendimentos sem vídeo: `AiReportSection` não deve mais retornar `null`, e sim o banner convidativo de geração de relatório.
- Processamento assíncrono: A requisição HTTP `POST /api/worklogs/:id/generate-ai-report` deve responder imediatamente com `{ success: true }`, enquanto o job executa em background (`setImmediate`).
- Polling em tempo real: O componente visual deve atualizar o status automaticamente de "pending" -> "processing" -> "completed" sem exigir F5 do usuário.
- Multimodalidade com imagens: Fotos/prints anexados ao chamado devem ser convertidos em partes de imagem compatíveis com a API do Gemini.
- Preservação do fluxo com gravação: Chamados que possuem gravação de tela continuam funcionando normalmente.

---

### Task 1: Gemini AI Service & Report Processor Extension
**Role/Subagent:** `self` (AI & Backend Specialist)
**Files:**
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/report-processor.ts`

- [x] **Step 1:** In `src/lib/gemini.ts`, implement `analyzeFormWithGemini(context: WorkLogContext, mediaUrls?: string[]): Promise<StructuredReportData>`:
  - Sanitiza o contexto do atendimento (`title`, `requester`, `clientOrOffice`, `reportedProblem`, `actionTaken`, `status`, `platform`, etc.).
  - Verifica arquivos de mídia anexados em `public/uploads` correspondentes aos caminhos em `mediaUrls`:
    - Para arquivos de imagem válidos (`.png`, `.jpg`, `.jpeg`, `.webp`), lê os bytes do disco e cria partes `inlineData: { mimeType, data: base64 }`.
  - Monta prompt executivo específico para relatórios baseados em formulário e mídias visuais.
  - Chama `ai.models.generateContent` com modelo `gemini-2.0-flash` e `responseSchema: REPORT_SCHEMA`.
  - Retorna `StructuredReportData` devidamente validado e sanitizado com fallbacks.
- [x] **Step 2:** In `src/lib/report-processor.ts`, update `processAiReportJob(workLogId: string)`:
  - Remove restrição rígida de `videoPath`.
  - Se `workLog.aiReport.videoPath` estiver presente, chama `analyzeRecordingWithGemini`.
  - Caso contrário, extrai os caminhos em `workLog.media` e chama `analyzeFormWithGemini`.
  - Compila o PDF através de `generateReportPdf({ workLogId, data: structuredData, context })`.
  - Atualiza o registro `AiReport` com `status: "completed"`, `pdfPath`, `structuredData`.
- [x] **Step 3:** Run `npx tsc --noEmit` and verify 0 type errors.
- [x] **Step 4:** Commit: `feat(ai): adicionar geracao de relatorios estruturados a partir de dados do chamado e midias`.

---

### Task 2: Backend REST Endpoint & API Client
**Role/Subagent:** `self` (Backend Specialist)
**Files:**
- Modify: `src/server/routes/worklogs.routes.ts`
- Modify: `src/services/api.ts`

- [x] **Step 1:** In `src/server/routes/worklogs.routes.ts`, add route `POST /:id/generate-ai-report`:
  - Aplica middleware `authenticateToken`.
  - Busca `workLog` por ID. Se não existir, retorna 404.
  - Se `workLog.aiReport?.status === "processing"`, retorna 400 informando que já está em processamento.
  - Realiza `prisma.aiReport.upsert` com `status: "pending"`, `startedAt: new Date()`, `errorMessage: null`.
  - Dispara `setImmediate(() => processAiReportJob(id))`.
  - Retorna `{ success: true }`.
- [x] **Step 2:** In `src/services/api.ts`, add under `api.worklogs`:
  ```ts
  async generateAiReport(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/worklogs/${id}/generate-ai-report`, {
      method: "POST",
    });
  }
  ```
- [x] **Step 3:** Run `npx tsc --noEmit` and commit: `feat(api): endpoint para geracao sob demanda de relatorios de IA`.

---

### Task 3: UI Banner & Action Button in `AiReportSection.tsx`
**Role/Subagent:** `ui-styler` (Frontend UI Specialist)
**Files:**
- Modify: `src/components/AiReportSection.tsx`

- [x] **Step 1:** In `src/components/AiReportSection.tsx`:
  - Quando `!report` (ou `report.status === null`):
    - Em vez de retornar `null`, renderizar o banner da Opção 1:
      - Caixa com gradiente suave índigo/ciano e bordas sutis.
      - Ícone vetorial `Sparkles`.
      - Título: "Relatório Executivo com IA".
      - Descrição: "Gere uma análise técnica formal e estruturada baseada nas informações e mídias deste atendimento."
      - Botão de ação: `[✨ Gerar Relatório com IA]` com estado de loading durante a requisição.
    - Ao clicar:
      - Chama `await api.worklogs.generateAiReport(workLogId)`.
      - Atualiza o estado local para `status: "pending"`.
      - O polling em `useEffect` detecta automaticamente a progressão para "processing" e depois para "completed".
  - Total suporte aos temas Claro e Escuro (CloudNexus).
- [x] **Step 2:** Run `npx vite build` and verify clean build.
- [x] **Step 3:** Commit: `feat(ui): banner inteligente no card maximizado para gerar relatorio de IA sob demanda`.

---

### Task 4: Full QA Audit & Verification
**Role/Subagent:** `qa-verifier` (QA Specialist)
**Files:**
- Full repository audit

- [ ] **Step 1:** Run `npx tsc --noEmit` e `npm run build`.
- [ ] **Step 2:** Testar chamado criado sem gravação de tela (como o exibido na imagem do usuário).
- [ ] **Step 3:** Validar que o botão aparece, pode ser acionado e conclui a geração do relatório.
- [ ] **Step 4:** Atualizar o plano e registrar relatório de aprovação.

