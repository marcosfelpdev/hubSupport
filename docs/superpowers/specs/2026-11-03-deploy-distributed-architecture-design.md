# Design Doc: Arquitetura Distribuída e Deploy do HubSupport

**Data:** 03 de Novembro de 2026  
**Status:** Em Revisão  
**Autores:** Equipe HubSupport & AI Pair Programmer  

---

## 1. Visão Geral e Objetivos

O objetivo deste projeto é preparar e desacoplar a arquitetura do **HubSupport** para um deploy em produção resiliente, com persistência real de dados e mídias, custo praticamente zero e alta disponibilidade, utilizando uma estrutura distribuída e desacoplada:

1. **Frontend SPA (React 19 + Vite):** Hospedado no **Cloudflare Pages** com distribuição global via CDN Edge, SSL automático e tráfego ilimitado.
2. **Backend API (Express 5 + TypeScript):** Executado no **Render Web Service (Plano Gratuito)** com mecanismo de **Keep-Alive (Ping periódico a cada 10 min)** para evitar a hibernação de 15 minutos e manter ativos o servidor e o worker de lembretes da agenda.
3. **Banco de Dados Relacional:** **Supabase PostgreSQL** (Tier gratuito com 500 MB e connection pooling Supavisor integrado via Prisma ORM).
4. **Armazenamento de Mídias e Relatórios:** **Cloudflare R2** (Bucket compatível com S3, 10 GB gratuitos de armazenamento e **custo zero de egress/download de dados**).

---

## 2. Diagrama de Arquitetura e Fluxo de Dados

```mermaid
flowchart TD
    Client["Navegador do Usuário / PWA"]

    subgraph Cloudflare["Infraestrutura Cloudflare"]
        CFPages["Cloudflare Pages (SPA React / Vite)"]
        CFR2["Cloudflare R2 (Bucket S3: Vídeos e PDFs)"]
    end

    subgraph BackendHost["Render Cloud"]
        Express["API Express 5 (Node.js)"]
        AgendaJob["Worker Agenda (15min check)"]
    end

    subgraph DatabaseCloud["Supabase Cloud"]
        PgPool["Supavisor (Pooler 6543)"]
        Postgres[("PostgreSQL 500MB")]
    end

    subgraph ExternalAI["Google Cloud AI"]
        Gemini["Google Gemini 2.0 Flash (Multimodal)"]
    end

    subgraph Monitor["Keep-Alive Service"]
        UptimeRobot["UptimeRobot / Cron Job (Ping 10 min)"]
    end

    Client -->|"Acessa SPA (Assets rápidos)"| CFPages
    Client -->|"Chamadas REST (/api/* com JWT)"| Express
    UptimeRobot -->|"GET /api/health (Mantém acordado)"| Express

    Express -->|"Prisma ORM (Pooler)"| PgPool --> Postgres
    Express -->|"Upload/Download mídias & relatórios"| CFR2
    Express -->|"Processa gravação de tela com IA"| Gemini
    Gemini -->|"Gera diagnóstico estruturado"| Express
```

---

## 3. Especificações Técnicas e Componentes

### 3.1. Banco de Dados: Prisma ORM + Supabase PostgreSQL
- **Migração do Schema:**
  - Alterar o `datasource db` de `provider = "sqlite"` para `provider = "postgresql"` em `prisma/schema.prisma`.
  - Configurar suporte a connection pooling do Supabase:
    - `DATABASE_URL`: Conexão transacional via pooler (porta `6543` com `?pgbouncer=true&connection_limit=1`).
    - `DIRECT_URL`: Conexão direta ao PostgreSQL (porta `5432`) para comandos de schema (`prisma db push` / `prisma migrate`).
- **Compatibilidade dos Modelos:**
  - Os tipos `String`, `Boolean`, `DateTime`, `Int` já existentes no schema são 100% suportados no PostgreSQL.
  - Atualizar campos textuais longos (como `media`, `reportedProblem`, `actionTaken`, `structuredData`) para `@db.Text` para otimização no Postgres.
  - O script de seed (`prisma/seed.ts`) continuará operando de forma idempotente para inicializar os usuários de demonstração e tags padrão.

### 3.2. Armazenamento de Arquivos: Cloudflare R2 (S3-Compatible SDK)
- **Instalação de Dependência:**
  - `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`.
- **Serviço Centralizado de Armazenamento (`src/server/services/r2Storage.ts`):**
  - Métodos utilitários:
    - `uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string>`
    - `getFileStream(key: string): Promise<Readable>`
    - `getPresignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>`
    - `deleteFile(key: string): Promise<void>`
  - Estrutura de pastas no bucket R2:
    - `recordings/{workLogId}-{timestamp}.mp4`
    - `reports/{workLogId}-{timestamp}.pdf`
    - `uploads/{timestamp}-{originalName}`
- **Refatoração dos Endpoints Existentes:**
  - **Uploads com Multer:** Configurar `multer.memoryStorage()` para envio direto do buffer para o R2, eliminando dependência do sistema de arquivos local (`fs`).
  - **Geração de PDF (`pdfkit`):** Gerar o documento PDF em stream/buffer em memória e fazer o upload do buffer diretamente para o R2.
  - **Download e Streaming:** A rota `/api/reports/:id/download` e `/api/reports/:id/recording` utilizará streams do R2 com headers HTTP adequados (`Range`, `Content-Length`, `Content-Type: video/webm|mp4`).
  - **Integração com Gemini:** O arquivo temporário será baixado do R2 para `/tmp` em stream exclusivamente durante o ciclo de envio para a API do Google Gemini (`ai.files.upload`), sendo deletado localmente e remotamente no bloco `finally` (conforme exigido em `GEMINI.md`).

### 3.3. Backend API no Render: Configuração & Keep-Alive
- **Scripts do `package.json`:**
  - Mover `"tsx"` para `"dependencies"` ou criar build dedicado do backend para garantir execução de `npm start` em ambientes de produção com `--omit=dev`.
  - Adicionar script de inicialização de produção: `prisma generate && tsx src/server/index.ts`.
- **Keep-Alive Ping (Zero Hibernação):**
  - Manter rota `GET /api/health` leve (retornando status `ok` e timestamp sem tocar no banco a cada ping).
  - Documentar e fornecer a configuração do **UptimeRobot** (monitor HTTP a cada 10 minutos direcionado para `https://hubsupport-api.onrender.com/api/health`).
  - Com essa chamada a cada 10 min, o Render nunca entra no sleep timer de 15 minutos, garantindo resposta instantânea e execução ininterrupta do `agendaNotificationJob`.

### 3.4. Frontend no Cloudflare Pages: Distribuição e Proxy
- **Build de Produção:**
  - Comando de build no Cloudflare Pages: `npm run build` (saída: pasta `dist`).
- **Proxy de API e CORS:**
  - O Cloudflare Pages suporta arquivo `public/_redirects`:
    ```text
    /api/*  https://hubsupport-api.onrender.com/api/:splat  200
    /*      /index.html                                     200
    ```
  - **Vantagem:** O frontend continua chamando rotas relativas (`/api/auth/login`, `/api/worklogs`), sem precisar reescrever as URLs do cliente e sem qualquer problema de bloqueio de CORS ou cookies de terceiros!

---

## 4. Variáveis de Ambiente Necessárias

### Backend (Render Dashboard):
```env
NODE_ENV=production
PORT=4000
JWT_SECRET=super_segredo_jwt_producao_2026_hubsupport
GEMINI_API_KEY=sua_chave_gemini_aqui

# Supabase PostgreSQL
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# Cloudflare R2
R2_ACCOUNT_ID=seu_cloudflare_account_id
R2_ACCESS_KEY_ID=sua_access_key_r2
R2_SECRET_ACCESS_KEY=sua_secret_access_key_r2
R2_BUCKET_NAME=hubsupport-storage
R2_PUBLIC_DOMAIN=https://... (opcional para URLs públicas de assets)
```

### Frontend (Cloudflare Pages):
- Nenhuma variável obrigatória necessária caso use o proxy do `_redirects`!

---

## 5. Estratégia de Transição e Validação

1. **Fase 1 (Prisma & Supabase):** Atualizar `schema.prisma`, validar conexão com Supabase e executar o seed.
2. **Fase 2 (R2 Storage Service):** Implementar módulo do S3/R2 e refatorar upload de vídeos, geração de relatórios PDF e streaming de vídeo.
3. **Fase 3 (Deploy Backend & Ping):** Configurar `render.yaml` ou configurações no painel do Render e ativar UptimeRobot.
4. **Fase 4 (Deploy Frontend):** Configurar `_redirects` e conectar o repositório ao Cloudflare Pages.
5. **Fase 5 (Testes de Ponta a Ponta):** Validar login, criação de chamado, upload de vídeo, geração de relatório de IA com Gemini, download de PDF e notificações de agenda em produção.

