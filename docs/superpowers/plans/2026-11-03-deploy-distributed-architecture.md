# Deploy da Arquitetura Distribuída do HubSupport — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o HubSupport para produção distribuída gratuita e de baixo custo, migrando o banco para Supabase (PostgreSQL), o armazenamento de mídias/relatórios para Cloudflare R2, o backend para Render (com Keep-Alive) e o frontend para Cloudflare Pages.

**Architecture:** A aplicação é desacoplada com o frontend SPA React 19 hospedado no Cloudflare Pages com proxy transparente `/api/*` para a API Express 5 no Render. O banco é hospedado no Supabase PostgreSQL via connection pooling do Prisma, e todos os arquivos pesados (gravações de tela e PDFs gerados por IA) são gerenciados no Cloudflare R2 com custo zero de download e persistência definitiva.

**Tech Stack:** React 19, Vite, Express 5, TypeScript, Prisma ORM, Supabase (PostgreSQL), Cloudflare R2 (@aws-sdk/client-s3), Google Gemini 2.0 Flash (@google/genai), PDFKit, Render, UptimeRobot, Cloudflare Pages.

**Spec:** [`docs/superpowers/specs/2026-11-03-deploy-distributed-architecture-design.md`](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-03-deploy-distributed-architecture-design.md)

---

## Global Constraints
- **Preservação do Modo Local:** O serviço de armazenamento deve detectar se as credenciais do R2 existem; se não existirem (ambiente de desenvolvimento local padrão), deve fazer fallback transparente para gravação na pasta local `storage/`, garantindo que `npm run dev` continue funcionando perfeitamente sem internet ou R2.
- **Segurança e Isolamento:** Vídeos e PDFs NUNCA devem ser públicos na raiz; o download e streaming devem ser autenticados via token JWT/cookies pelo backend.
- **Ciclo de Vida do Gemini:** O envio de vídeos para a API do Gemini a partir do R2 deve usar arquivo temporário em `/tmp` com exclusão obrigatória no bloco `finally` tanto localmente quanto no Google AI Studio (`ai.files.delete`).
- **Verificação Contínua:** `npx tsc --noEmit` e `npx vite build` devem passar com zero erros em cada etapa.

---

## Tasks

### Task 1: Migração do Prisma para Supabase (PostgreSQL)
**Files to create/modify:**
- `prisma/schema.prisma`
- `package.json`
- `.env.example`

- [x] **Step 1.1:** Atualizar `prisma/schema.prisma` alterando o provider para `postgresql` e configurando `directUrl`.
- [x] **Step 1.2:** Ajustar colunas de texto extenso no schema para `@db.Text` (ex: `reportedProblem`, `actionTaken`, `media`, `structuredData`, `message`).
- [x] **Step 1.3:** Atualizar `.env.example` com o formato das URLs do Supabase (pooler porta 6543 e direct porta 5432).
- [x] **Step 1.4:** Executar `npx prisma generate` e verificar compilação de tipos.
- [x] **Step 1.5:** Executar `npx prisma db push` e `npm run seed` inicializando a base limpa no Supabase.
- [x] **Step 1.6:** Commit das alterações da Task 1 (`230da62`).

---

### Task 2: Implementação do Serviço de Armazenamento Cloudflare R2
**Files to create/modify:**
- `package.json` (adicionar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`)
- `src/server/services/r2Storage.ts` (novo serviço com fallback para disco local)
- `src/server/routes/worklogs.routes.ts` (upload via Multer e streaming autenticado)
- `src/lib/pdf-generator.ts` (upload direto do buffer PDF para o R2)
- `src/lib/report-processor.ts` (leitura temporária para envio ao Gemini)

- [x] **Step 2.1:** Instalar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` como dependências de produção.
- [x] **Step 2.2:** Criar `src/server/services/r2Storage.ts` com suporte a `uploadBuffer`, `getFileStream`, `downloadToTempFile` e `deleteFile`.
- [x] **Step 2.3:** Refatorar `src/server/routes/worklogs.routes.ts` com `multer.memoryStorage` e persistência direta no R2.
- [x] **Step 2.4:** Refatorar `src/lib/pdf-generator.ts` para acumular o PDF em memória e enviar via `r2Storage.uploadBuffer(...)`.
- [x] **Step 2.5:** Refatorar `src/lib/report-processor.ts` para baixar temporariamente do R2 para `/tmp` durante análise com Gemini e limpar no `finally`.
- [x] **Step 2.6:** Executar suite de verificação com `npx tsc --noEmit` e `npm run build`.
- [x] **Step 2.7:** Commit das alterações da Task 2 (`3343d07`).

---

### Task 3: Preparação e Configuração do Backend para o Render
**Files to create/modify:**
- `package.json`
- `render.yaml` (Blueprint declarativo para o Render)
- `src/server/app.ts` e `src/server/index.ts`

- [x] **Step 3.1:** Mover `"tsx"` e dependências de build para `dependencies` no `package.json`.
- [x] **Step 3.2:** Adicionar script de produção: `"start": "tsx src/server/index.ts"`.
- [x] **Step 3.3:** Validar a rota `GET /api/health` em `src/server/app.ts` respondendo com status 200 OK.
- [x] **Step 3.4:** Criar `render.yaml` configurando o serviço Web gratuito do Render.
- [x] **Step 3.5:** Commit e deploy no Render com sucesso (`https://hubsupport-api.onrender.com`).

---

### Task 4: Configuração do Frontend para Cloudflare Pages
**Files to create/modify:**
- `public/_redirects`
- `functions/api/[[catchall]].ts`
- `functions/uploads/[[catchall]].ts`
- `src/services/api.ts`

- [x] **Step 4.1:** Criar `public/_redirects` e Cloudflare Pages Functions para proxy transparente da API.
- [x] **Step 4.2:** Configurar fallback dinâmico de produção em `src/services/api.ts` direcionando para a API no Render com CORS liberado.
- [x] **Step 4.3:** Deploy no Cloudflare Pages com sucesso (`https://hubsupport.pages.dev`).

---

### Task 5: Validação Integrada em Produção
- [x] **Step 5.1:** Conectar e validar Supabase PostgreSQL com usuários reais.
- [x] **Step 5.2:** Conectar e validar Cloudflare R2 com upload/download de teste.
- [x] **Step 5.3:** Validar API no Render com health check e login de administrador.
- [x] **Step 5.4:** Ativar monitor UptimeRobot para Keep-Alive anti-hibernação a cada 10 min.
- [x] **Step 5.5:** Validar acesso completo e login na SPA do Cloudflare Pages em `https://hubsupport.pages.dev`.
