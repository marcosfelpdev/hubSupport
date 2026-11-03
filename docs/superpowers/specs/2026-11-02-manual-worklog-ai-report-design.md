# Design Doc: Geração de Relatório com IA para Atendimentos Manuais

**Data:** 2026-11-02  
**Autor:** Antigravity  
**Status:** Proposto  

---

## 1. Contexto & Necessidade

No HubSupport, a geração automatizada de relatórios executivos via Google Gemini e compilação de PDF vetorial (PDFKit) estava restrita aos chamados que continham uma gravação de tela anexada (`recordedVideo`).

Quando um colaborador cadastra um chamado através do botão **"+ Novo Atendimento"** (sem gravar a tela), ele preenche detalhadamente título, solicitante, escritório/cliente, plataforma/tag, descrição minuciosa do problema, ações realizadas e pode anexar múltiplas mídias (fotos de erros, prints, comprovantes).

O usuário necessita de um botão **"Gerar Relatório"** no card maximizado para que a IA processe todo esse conteúdo cadastrado e produza o mesmo relatório executivo de alta fidelidade e o mesmo PDF corporativo padronizado.

---

## 2. Decisão de Interface (Opção 1)

Conforme alinhamento, a interface seguirá a **Opção 1**:
- Um banner inteligente em destaque posicionado dentro do card maximizado, logo abaixo do bloco de dados (solicitante / escritório / plataforma / mídias).
- **Layout do Banner:**
  - Ícone vetorial `Sparkles` com gradiente suave índigo/ciano CloudNexus.
  - Texto explicativo: *"Relatório Executivo com IA — Gere uma análise técnica formal e estruturada com base nas informações e mídias deste atendimento."*
  - Botão de ação: **`[✨ Gerar Relatório com IA]`**.
- Ao clicar, o card entra no estado de processamento em tempo real (*"Processando IA..."* com loader animado) e, ao concluir, exibe os botões de **Visualizar PDF** e **Baixar PDF**.

---

## 3. Arquitetura Técnica

### 3.1. Inteligência Artificial Multimodal (`src/lib/gemini.ts`)
- Criar a função `analyzeFormWithGemini(context: WorkLogContext, mediaUrls?: string[]): Promise<StructuredReportData>`:
  - Sanitiza os dados do formulário de forma idêntica à pipeline existente.
  - Se houver imagens anexadas (`.png`, `.jpg`, `.jpeg`, `.webp`) no diretório `public/uploads`:
    - Lê os arquivos locais e converte em `inlineData` (base64 + mimeType).
    - Envia as imagens para o modelo `gemini-2.0-flash` junto ao prompt estruturado.
  - Se não houver imagens:
    - O Gemini realiza a análise e estruturação baseando-se estritamente no contexto textual completo do atendimento.
  - Aplica o mesmo `REPORT_SCHEMA` estrito em JSON, garantindo uniformidade total com relatórios originados de vídeos.

### 3.2. Processador de Relatórios em Segundo Plano (`src/lib/report-processor.ts`)
- Ajustar `processAiReportJob(workLogId: string)`:
  - Remove o bloqueio obrigatório de `workLog.aiReport.videoPath`.
  - Se houver `videoPath`, continua executando `analyzeRecordingWithGemini`.
  - Se não houver `videoPath`, extrai `workLog.media` e executa `analyzeFormWithGemini`.
  - Gera o PDF vetorial através de `generateReportPdf`.
  - Atualiza o registro `AiReport` para `status: "completed"`, salvando o `pdfPath` e os dados estruturados.

### 3.3. Rota de API REST (`src/server/routes/worklogs.routes.ts`)
- `POST /api/worklogs/:id/generate-ai-report`:
  - Middleware: `authenticateToken`.
  - Verifica se o `workLog` existe.
  - Realiza upsert do `AiReport`:
    - `status: "pending"`
    - `startedAt: new Date()`
    - `errorMessage: null`
  - Dispara o job de forma não-bloqueante: `setImmediate(() => processAiReportJob(id))`.
  - Retorna `{ success: true }`.

### 3.4. Camada de Cliente HTTP (`src/services/api.ts`)
- Adicionar `api.worklogs.generateAiReport(id: string): Promise<{ success: boolean }>`.

### 3.5. Componente Visual (`src/components/AiReportSection.tsx`)
- Quando `initialReport` for nulo:
  - Renderiza o banner da **Opção 1**.
  - O clique chama `api.worklogs.generateAiReport` e atualiza o estado local para `status: "pending"`.
  - O polling existente a cada 3-4 segundos detecta a conclusão e exibe o relatório final.

---

## 4. Critérios de Aceite
- Chamados sem gravação de tela exibem o banner com o botão "Gerar Relatório com IA".
- O clique aciona o Gemini multimodal com os dados do formulário e imagens anexadas.
- O PDF corporativo é gerado e disponibilizado para visualização e download.
- 0 erros em `npx tsc --noEmit` e `npx vite build`.

