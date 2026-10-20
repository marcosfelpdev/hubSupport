# HubSupport — Memória Operacional do Projeto

> **Status:** Ativo | **Última Atualização:** 2026-10-20 | **Bootstrap Realizado**

---

## 1. Visão Geral e Objetivo
O **HubSupport** é um sistema corporativo completo para registro, acompanhamento e resolução de atendimentos diários de suporte técnico, equipado com **gravação de tela e áudio no navegador** e **geração automatizada de relatórios técnicos executivos via IA multimodal (Google Gemini 2.0 Flash) e PDFKit**.

- **Público-alvo:** Equipes de suporte técnico, desenvolvimento (devs), analistas operacionais e gestores.
- **Diferencial:** Transforma atendimentos com gravações de tela em relatórios técnicos formais com transcrição e propostas de melhoria estruturadas em minutos, sem esforço manual.

---

## 2. Stack Tecnológica & Convenções
- **Framework:** Next.js 16.4.1 (App Router, Turbopack, React 19, TypeScript 5).
- **Estilização:** Tailwind CSS v4 + Design System Dark Glassmorphism.
- **Banco de Dados & ORM:** SQLite local via Prisma ORM 5.22.0 (`prisma/schema.prisma`). *[CONFIRMADO: Mantido nesta fase; migração futura planejada]*
- **Hospedagem Planejada:** Render (Web Service Node.js com necessidade de Render Disk para persistência do SQLite e `storage/`). *[CONFIRMADO]*
- **Autenticação:** NextAuth v5 (`next-auth@5.0.0-beta.32`), JWT session em cookies seguros, `bcryptjs`.
- **Inteligência Artificial:** SDK oficial `@google/genai` (^2.30.0), Google Files API + Gemini 2.0 Flash (`gemini-2.0-flash` e fallbacks), `responseSchema` JSON estrito. Chave da API: **Plano Gratuito** (requer resiliência estrita para cotas de RPM/TPM). *[CONFIRMADO]*
- **Geração de PDF:** `pdfkit` (^0.20.2), renderização vetorial com paginação dinâmica e cabeçalhos corporativos.
- **Mídia no Navegador:** Web APIs `getDisplayMedia`, `MediaRecorder`, Web Audio API (mixagem mic + display e alertas sonoros).
- **Testes & Scripts:** Playwright (^1.64.1) e TSX (`tsx prisma/seed.ts`, scripts em `scripts/`).

---

## 3. Decisões de Arquitetura Chave (com Datas)
- **2026-10-15 (Setup & Redesign Inicial):** Criação da base com Next.js 16 e Prisma SQLite. Redesign do Dashboard com abertura de modal centralizado, painel lateral de detalhes e introdução do sistema de papéis (`ADMIN`, `USER`, `SUPPORT`, `TECHNICIAN`, `MANAGER`).
- **2026-10-16 (Ações Técnicas & Anexos):** Inclusão de flags booleanas `technicalAction` e `implementation` no `WorkLog`, e suporte a uploads múltiplos de mídia (`public/uploads`).
- **2026-10-17 (Painel Técnico & Notificações em Tempo Real):** Rota `/dashboard/tecnico`, criação da entidade `Notification`, disparo automático para técnicos quando chamados tiverem ação técnica ou implementação, e sino de notificações com áudio sintetizado nativo.
- **2026-10-18 (Gravação de Tela & Pipeline de IA Gemini + PDF):**
  - Gravação de tela com áudio mixado no client;
  - Gravações salvas em diretório privado seguro (`storage/recordings/`);
  - Processamento assíncrono em background (`processAiReportJob`) via Google Files API e Gemini JSON estrito;
  - Geração de PDF corporativo de 2 a 4 páginas em `storage/reports/`;
  - Rotas de download autenticadas (`/api/reports/[id]/download` e `/recording`);
  - Polling reativo no card expandido (`AiReportSection`) com botão de retentativa (`retryAiReport`).
- **2026-10-20 (Merge na Main & Definições de Ambiente):**
  - Unificação da branch de funcionalidade na `main` e inicialização da memória operacional em `.agents/memory/`.
  - Confirmação de hosting no Render, manutenção do SQLite nesta fase, cota gratuita da API Gemini e manutenção do filtro diário do Dashboard.

---

## 4. Mapa de Arquivos Importantes
- **Entrypoints & Páginas:**
  - `src/app/page.tsx` — Redirecionamento inicial baseado em auth.
  - `src/app/login/page.tsx` — Login moderno com visual glassmorphism.
  - `src/app/dashboard/page.tsx` & `DashboardClient.tsx` — Dashboard geral de atendimentos e filtros (padrão dia atual).
  - `src/app/dashboard/tecnico/page.tsx` & `TechnicianDashboardClient.tsx` — Fila técnica e resolução.
  - `src/app/dashboard/funcionarios/page.tsx` — Gestão de usuários (restrita a ADMIN).
- **Core de IA & Processamento de Relatórios:**
  - `src/lib/gemini.ts` — Conexão `@google/genai`, Files API, prompt formal, schema JSON e retry logic.
  - `src/lib/report-processor.ts` — Orquestrador do job assíncrono (`pending` -> `processing` -> `completed` / `failed`).
  - `src/lib/pdf-generator.ts` — Compilador vetorial PDFKit (capa, propostas, detalhamento, transcrição).
- **Rotas de API Protegidas:**
  - `src/app/api/reports/[id]/download/route.ts` — Download seguro do relatório PDF.
  - `src/app/api/reports/[id]/recording/route.ts` — Streaming seguro da gravação de tela.
- **Server Actions:**
  - `src/actions/worklog.ts` — Criação de log, upload de gravação, resolução e retry do relatório.
  - `src/actions/notifications.ts` — Listagem e marcação de lidas.
  - `src/actions/employees.ts` — CRUD de funcionários com validação de `ADMIN`.
- **Componentes Principais:**
  - `src/components/ScreenRecorderButton.tsx` — Captura de display + mic e cronômetro.
  - `src/components/AiReportSection.tsx` — Card com status da IA, erro, retentativa e botão de download.
  - `src/components/NotificationBell.tsx` — Sino com sintetizador de áudio Web Audio API.
  - `src/components/WorkLogForm.tsx` — Formulário de novo atendimento com preview de vídeo.
- **Banco de Dados & Autenticação:**
  - `prisma/schema.prisma` — Modelos `User`, `WorkLog`, `Notification`, `AiReport`.
  - `src/auth.ts` & `src/middleware.ts` — NextAuth v5 Credentials e proteção de rotas.

---

## 5. Armadilhas, Gotchas e Restrições Técnicas
1. **Deploy no Render & SQLite Persistente:** O Render possui sistema de arquivos efêmero por padrão em Web Services gratuitos. Para o SQLite (`dev.db`) e os arquivos em `storage/` não serem apagados a cada deploy ou restart, é mandatório configurar um **Render Disk** montado ou planejar a migração antes do deploy final.
2. **Cotas da Chave Gratuita do Gemini:** Como a chave é gratuita, limites de taxa (ex: 15 RPM / limites diários de tokens) podem causar erros `429 RESOURCE_EXHAUSTED`. O mecanismo de retry exponencial e modelos de fallback em `src/lib/gemini.ts` são vitais.
3. **Armazenamento Privado Obrigatório:** Gravações de tela e relatórios em PDF NUNCA devem ir para `public/`. Ficam em `storage/` e são servidos exclusivamente via endpoints autenticados para evitar vazamento de dados corporativos.
4. **Limpeza da Google Files API:** Sempre deletar o arquivo remoto da nuvem (`ai.files.delete`) no bloco `finally` de `src/lib/gemini.ts` para não acumular consumo desnecessário de cota/armazenamento.
5. **Next.js 16 Breaking Changes:** O `params` de dynamic routes deve ser tratado como Promise (`const { id } = await params`). Server Actions não devem depender de `window` ou disparar `revalidatePath` em contextos desvinculados de requisição sem `try/catch`.

---

## 6. Próximos Passos & Backlog Ativo
- [ ] Preparar ajustes necessários para o deploy no Render (configuração de disco persistente para `prisma/dev.db` e `storage/` ou Dockerfile adequado).
- [ ] Monitoramento do consumo da cota gratuita da API do Gemini em testes com gravações reais mais longas.
- [ ] Exportação em lote de atendimentos para planilha (Excel/CSV) e múltiplos relatórios.
- [ ] Substituir o polling do frontend por Server-Sent Events (SSE) ou WebSockets quando for necessário tempo real de alta escala.
- [ ] Planejar migração futura de SQLite para PostgreSQL antes da escala pública da aplicação.

---

## 7. Índice de Sessões
- [2026-10-20-bootstrap.md](file:///c:/Users/mfana/projetos/hubSupport/.agents/memory/sessions/2026-10-20-bootstrap.md) — Unificação na main, mapeamento do projeto e bootstrap da memória operacional.
