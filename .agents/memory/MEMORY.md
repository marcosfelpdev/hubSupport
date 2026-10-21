# HubSupport — Memória Operacional do Projeto

> **Status:** Ativo | **Última Atualização:** 2026-10-20 | **Migração de Stack Concluída (React + Express)**

---

## 1. Visão Geral e Objetivo
O **HubSupport** é um sistema corporativo completo para registro, acompanhamento e resolução de atendimentos diários de suporte técnico, equipado com **gravação de tela e áudio no navegador** e **geração automatizada de relatórios técnicos executivos via IA multimodal (Google Gemini 2.0 Flash) e PDFKit**.

- **Público-alvo:** Equipes de suporte técnico, desenvolvimento (devs), analistas operacionais e gestores.
- **Diferencial:** Transforma atendimentos com gravações de tela em relatórios técnicos formais com transcrição e propostas de melhoria estruturadas em minutos, sem esforço manual.

---

## 2. Stack Tecnológica & Convenções
- **Frontend:** React 19 puro + TypeScript 5 (Single Page Application via Vite 8, React Router 7, Tailwind CSS v4, Lucide Icons).
- **Backend:** Node.js + Express 5 + TypeScript puro (`src/server/`), CORS com credenciais, Multer para uploads multipart, Cookie Parser.
- **Banco de Dados & ORM:** SQLite local via Prisma ORM 5.22.0 (`prisma/schema.prisma`). *[Mantido nesta fase; deploy com Render Disk]*
- **Hospedagem Planejada:** Render (Web Service único Node.js servindo API REST e arquivos estáticos da SPA em `dist/`, montando Render Disk para `prisma/dev.db` e `storage/`).
- **Autenticação:** JWT nativo (`jsonwebtoken`), cookies HTTP-only seguros + cabeçalho `Authorization: Bearer <token>`, senhas com `bcryptjs`.
- **Inteligência Artificial:** SDK oficial `@google/genai` (^2.30.0), Google Files API + Gemini 2.0 Flash (`gemini-2.0-flash` e fallbacks), `responseSchema` JSON estrito.
- **Geração de PDF:** `pdfkit` (^0.20.2), renderização vetorial corporativa com capas, tabelas e transcrição sincronizada.
- **Mídia no Navegador:** Web APIs `getDisplayMedia`, `MediaRecorder`, Web Audio API (mixagem mic + display e alertas sonoros).

---

## 3. Decisões de Arquitetura Chave (com Datas)
- **2026-10-15 (Setup Inicial):** Criação da base e modelos Prisma com papéis (`ADMIN`, `USER`, `SUPPORT`, `TECHNICIAN`, `MANAGER`).
- **2026-10-16 (Ações Técnicas & Anexos):** Flags `technicalAction` e `implementation` e uploads múltiplos de mídia (`public/uploads`).
- **2026-10-17 (Painel Técnico & Notificações):** Rota `/dashboard/tecnico`, entidade `Notification`, disparo para técnicos e sino sonoro via Web Audio API.
- **2026-10-18 (Gravação de Tela & Pipeline de IA Gemini + PDF):**
  - Gravação de tela com áudio mixado no client;
  - Gravações salvas em diretório privado seguro (`storage/recordings/`);
  - Processamento assíncrono em background (`processAiReportJob`) via Google Files API e Gemini JSON estrito;
  - Geração de PDF corporativo em `storage/reports/` e rotas de download autenticadas;
  - Polling reativo no card expandido (`AiReportSection`) com botão de retentativa (`retryAi`).
- **2026-10-20 (Migração de Stack: Next.js -> React + TypeScript + Express):**
  - Descontinuação do Next.js visando liberdade de deploy fora da Vercel.
  - Divisão limpa em Frontend SPA (React 19 + Vite) e Backend REST puro (Node.js + Express 5).
  - Centralização de requisições do frontend em `src/services/api.ts` e sessão em `AuthContext`.
  - Preservação total das regras de negócio, pipeline Gemini 2.0 Flash e compilador PDFKit.

---

## 4. Mapa de Arquivos Importantes
- **Entrypoints & Frontend:**
  - `index.html` — Entrada HTML com tipografia Inter.
  - `src/main.tsx` & `src/App.tsx` — Roteamento React Router SPA (`/login`, `/dashboard`, `/dashboard/tecnico`, `/dashboard/funcionarios`).
  - `src/contexts/AuthContext.tsx` — Provedor de sessão e tokens JWT.
  - `src/components/ProtectedRoute.tsx` — Guarda de rotas com controle de acesso por papéis.
  - `src/layouts/DashboardLayout.tsx` — Layout padrão com `Sidebar`, `TopBar` e `ScreenRecordingProvider`.
  - `src/services/api.ts` — Camada cliente REST unificada.
- **Páginas da Aplicação:**
  - `src/pages/LoginPage.tsx` — Login com design glassmorphism.
  - `src/pages/DashboardPage.tsx` & `DashboardClient.tsx` — Dashboard geral e novo atendimento.
  - `src/pages/TechnicianPage.tsx` & `TechnicianDashboardClient.tsx` — Fila técnica e resolução de chamados.
  - `src/pages/EmployeesPage.tsx` & `EmployeesManager.tsx` — Gestão de funcionários (restrito a ADMIN).
- **Backend Node.js & API REST (`src/server/`):**
  - `src/server/index.ts` — Inicialização do servidor Express (porta 4000).
  - `src/server/app.ts` — Middlewares, CORS, estáticos e roteador central.
  - `src/server/auth.ts` — Validação JWT e middlewares `authenticateToken`, `requireAdmin`, `requireTechnicianOrAdmin`.
  - `src/server/routes/auth.routes.ts` — `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.
  - `src/server/routes/worklogs.routes.ts` — CRUD de atendimentos, upload Multer e disparo do relatório.
  - `src/server/routes/reports.routes.ts` — Download seguro de PDF e streaming de vídeo gravado.
  - `src/server/routes/notifications.routes.ts` — Notificações da equipe técnica.
  - `src/server/routes/employees.routes.ts` — Gerenciamento de colaboradores.
- **Core de IA & Processamento de Relatórios:**
  - `src/lib/gemini.ts` — Conexão `@google/genai`, Files API, prompt formal, schema JSON e retry logic.
  - `src/lib/report-processor.ts` — Orquestrador do job assíncrono em segundo plano.
  - `src/lib/pdf-generator.ts` — Compilador vetorial PDFKit (capa, propostas, detalhamento, transcrição).

---

## 5. Armadilhas, Gotchas e Restrições Técnicas
1. **Deploy no Render & SQLite Persistente:** O Render possui sistema de arquivos efêmero por padrão em Web Services gratuitos. Para o SQLite (`prisma/dev.db`) e os arquivos em `storage/` não serem apagados a cada restart, é mandatório configurar um **Render Disk** montado (ex: `/data` com symlinks ou env `DATABASE_URL="file:/data/dev.db"`).
2. **Armazenamento Privado Obrigatório:** Gravações de tela e relatórios em PDF NUNCA devem ir para `public/`. Ficam em `storage/` e são servidos exclusivamente via rotas autenticadas (`/api/reports/:id/download` e `/api/reports/:id/recording`).
3. **Limpeza da Google Files API:** Sempre deletar o arquivo remoto da nuvem (`ai.files.delete`) no bloco `finally` de `src/lib/gemini.ts` para não acumular consumo desnecessário de cota/armazenamento.
4. **Cotas da Chave Gratuita do Gemini:** Como a chave é gratuita, limites de taxa exigem backoff exponencial e rotação de modelos candidatos em `src/lib/gemini.ts`.

---

## 6. Próximos Passos & Backlog Ativo
- [ ] Configuração final para deploy no Render com Dockerfile ou render.yaml especificando o Render Disk montado.
- [ ] Exportação em lote de atendimentos para planilha (Excel/CSV) e múltiplos relatórios.
- [ ] Substituir o polling leve do frontend por WebSockets ou SSE para notificações em tempo real.
- [ ] Planejar migração futura de SQLite para PostgreSQL antes da escala pública da aplicação.

---

## 7. Índice de Sessões
- [2026-10-20-bootstrap.md](file:///c:/Users/mfana/projetos/hubSupport/.agents/memory/sessions/2026-10-20-bootstrap.md) — Unificação na main, mapeamento do projeto e bootstrap da memória operacional.
- [2026-10-20-stack-migration.md](file:///c:/Users/mfana/projetos/hubSupport/.agents/memory/sessions/2026-10-20-stack-migration.md) — Refatoração e migração completa de Next.js para React + TypeScript puro e Express REST.
