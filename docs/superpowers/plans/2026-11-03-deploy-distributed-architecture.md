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

- [ ] **Step 1.1:** Atualizar `prisma/schema.prisma` alterando o provider para `postgresql` e configurando `directUrl`:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
- [ ] **Step 1.2:** Ajustar colunas de texto extenso no schema para `@db.Text` (ex: `reportedProblem`, `actionTaken`, `media`, `structuredData`, `message`).
- [ ] **Step 1.3:** Atualizar `.env.example` com o formato das URLs do Supabase (pooler porta 6543 e direct porta 5432).
- [ ] **Step 1.4:** Executar `npx prisma generate` e verificar compilação de tipos.
- [ ] **Step 1.5:** Criar script de teste automatizado `scripts/test-prisma-connection.ts` para testar tanto conexão local quanto Postgres quando as credenciais forem fornecidas.
- [ ] **Step 1.6:** Commit das alterações da Task 1.

---

### Task 2: Implementação do Serviço de Armazenamento Cloudflare R2
**Files to create/modify:**
- `package.json` (adicionar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`)
- `src/server/services/r2Storage.ts` (novo serviço com fallback para disco local)
- `src/server/routes/worklogs.routes.ts` (upload via Multer e streaming autenticado)
- `src/lib/pdf-generator.ts` (upload direto do buffer PDF para o R2)
- `src/lib/report-processor.ts` (leitura temporária para envio ao Gemini)

- [ ] **Step 2.1:** Instalar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` como dependências de produção.
- [ ] **Step 2.2:** Criar `src/server/services/r2Storage.ts` implementando:
  - Inicialização do `S3Client` apontando para o endpoint do Cloudflare R2: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
  - Detecção de credenciais: se faltar `R2_ACCOUNT_ID`, operar em modo local (`fs`), caso contrário operar no R2.
  - Funções: `uploadBuffer(buffer, key, contentType)`, `getObjectStream(key)`, `getPresignedUrl(key)`, `deleteObject(key)`.
- [ ] **Step 2.3:** Refatorar `src/server/routes/worklogs.routes.ts`:
  - Multer configurado com `memoryStorage` quando R2 estiver ativo.
  - Endpoint de gravação (`POST /:id/recording`) e anexos (`POST /:id/attachments`) enviando buffers para `r2Storage`.
  - Endpoint de streaming (`GET /api/reports/:id/recording`) obtendo stream do R2 e transmitindo para a resposta HTTP com suporte a range de vídeo.
- [ ] **Step 2.4:** Refatorar `src/lib/pdf-generator.ts` para acumular o PDF em memória (buffer) e enviar via `r2Storage.uploadBuffer(...)`.
- [ ] **Step 2.5:** Refatorar `src/lib/report-processor.ts` para baixar o stream do R2 para `/tmp` temporário apenas durante a análise multimodal com o Gemini, limpando ao final.
- [ ] **Step 2.6:** Executar suite de verificação com `npx tsc --noEmit` e `npm run build`.
- [ ] **Step 2.7:** Commit das alterações da Task 2.

---

### Task 3: Preparação e Configuração do Backend para o Render
**Files to create/modify:**
- `package.json`
- `render.yaml` (Blueprint declarativo opcional para o Render)
- `src/server/app.ts` e `src/server/index.ts`

- [ ] **Step 3.1:** Mover `"tsx"` de `devDependencies` para `dependencies` no `package.json`.
- [ ] **Step 3.2:** Adicionar script de produção: `"start": "prisma generate && tsx src/server/index.ts"`.
- [ ] **Step 3.3:** Validar a rota `GET /api/health` em `src/server/app.ts` garantindo tempo de resposta < 10ms para os pings do UptimeRobot.
- [ ] **Step 3.4:** Criar `render.yaml` configurando o serviço Web gratuito do Render com comando de build (`npm install && npm run build && npx prisma db push`) e start.
- [ ] **Step 3.5:** Commit das alterações da Task 3.

---

### Task 4: Configuração do Frontend para Cloudflare Pages
**Files to create/modify:**
- `public/_redirects`
- `vite.config.mts`

- [ ] **Step 4.1:** Criar `public/_redirects` com as regras de roteamento e proxy:
  ```text
  /api/*  https://hubsupport-api.onrender.com/api/:splat  200
  /*      /index.html                                     200
  ```
- [ ] **Step 4.2:** Testar `npm run build` e confirmar que `dist/_redirects` é gerado corretamente na raiz da compilação.
- [ ] **Step 4.3:** Commit das alterações da Task 4.

---

### Task 5: Guia Prático Passo a Passo com o Usuário
- [ ] **Step 5.1:** Conectar conta Supabase (obter `DATABASE_URL` e `DIRECT_URL`).
- [ ] **Step 5.2:** Conectar bucket Cloudflare R2 (obter Account ID, Access Key, Secret Key e Bucket Name).
- [ ] **Step 5.3:** Conectar repositório ao Render (configurar variáveis de ambiente e rodar primeiro deploy).
- [ ] **Step 5.4:** Configurar monitor UptimeRobot para ping a cada 10 min em `/api/health`.
- [ ] **Step 5.5:** Conectar repositório ao Cloudflare Pages e validar acesso online completo.

