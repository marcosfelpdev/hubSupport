# Sessão: 2026-10-20 — Migração de Stack (Next.js -> React + TypeScript Puro & Express REST)

## 1. Contexto & Motivação
- A stack baseada em Next.js foi descontinuada no projeto HubSupport em razão da mudança de plataforma de deploy (não será mais hospedado na Vercel).
- A aplicação foi refatorada por etapas completas, adotando:
  - **Frontend:** React 19 puro + TypeScript (Single Page Application via Vite 8, React Router 7 e Tailwind CSS v4).
  - **Backend:** Node.js + Express 5 + TypeScript puro, com autenticação JWT e rotas REST.
  - **Core de Negócio Preservado:** Prisma ORM com SQLite, Google Gemini 2.0 Flash (`@google/genai`), compilação vetorial PDFKit (`pdfkit`), mixagem Web Audio API e diretórios privados de gravação e relatórios (`storage/`).

---

## 2. Plano de Etapas & Status
- [x] **Etapa 1:** Construção do Backend API REST & Autenticação (Node.js + Express + TypeScript + Prisma).
- [x] **Etapa 2:** Configuração do Frontend SPA (React + TypeScript + Vite + Roteamento).
- [x] **Etapa 3:** Migração e Desacoplamento dos Componentes & Telas (substituição de Server Actions por REST).
- [x] **Etapa 4:** Limpeza de dependências obsoletas do Next.js, scripts de produção e atualização de regras e memória.

---

## 3. Reavaliações por Etapa

### Reavaliação da Etapa 1 (Backend REST & Auth)
- Criado servidor Express em `src/server/` com roteamento modular, cookies HTTP-only, CORS e middlewares de segurança.
- Implementado `src/server/auth.ts` com tokens JWT (7 dias de expiração), `authenticateToken`, `requireAdmin` e `requireTechnicianOrAdmin`.
- Implementadas rotas REST equivalentes às Server Actions e handlers do Next.js:
  - `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.
  - `/api/worklogs` (filtros `daily` e `technical`, upload multipart via Multer, disparo em segundo plano do relatório de IA).
  - `/api/worklogs/:id/resolve`, `/api/worklogs/:id/retry-ai`, `/api/worklogs/:id/ai-status`.
  - `/api/reports/:id/download` e `/api/reports/:id/recording` (streaming privado com validação de sessão).
  - `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/read-all`.
  - `/api/employees` (CRUD completo com validação de admin e bcrypt).
- Desacoplado `src/lib/report-processor.ts` de `next/cache`, mantendo 100% íntegro o processamento multimodal e geração de PDF.
- Validação via chamadas HTTP reais aprovada com sucesso.

### Reavaliação da Etapa 2 (Configuração do Frontend SPA)
- Criado `vite.config.ts` com `@vitejs/plugin-react`, `@tailwindcss/vite`, aliases `@/*` e proxy para desenvolvimento.
- Criado `index.html` com fontes Inter do Google Fonts.
- Criado `src/services/api.ts` como cliente HTTP centralizado com injeção automática de Bearer Token e cookies.
- Criado `src/contexts/AuthContext.tsx` para substituição do `next-auth/react`.
- Criados `ProtectedRoute.tsx`, `DashboardLayout.tsx`, `App.tsx` e `main.tsx`.
- Criadas páginas `LoginPage.tsx`, `DashboardPage.tsx`, `TechnicianPage.tsx` e `EmployeesPage.tsx`.

### Reavaliação da Etapa 3 (Migração de Componentes)
- Desacoplados os componentes da biblioteca do Next.js:
  - `Sidebar.tsx`: substituído `next/link` e `next/navigation` por `react-router-dom` (`Link`, `useLocation`) e `useAuth().logout`.
  - `NotificationBell.tsx`: adaptado para `useNavigate` e chamadas a `api.notifications`.
  - `DashboardHeader.tsx`: adaptado para `useAuth().logout`.
  - `AiReportSection.tsx`: polling e retry atualizados para `api.worklogs.getAiStatus` e `api.worklogs.retryAi`.
  - `WorkLogForm.tsx`: envio de formulário com anexo e gravação migrado para `api.worklogs.create`.
  - `DashboardClient.tsx` e `TechnicianDashboardClient.tsx`: migrados para `src/components/` com callbacks reativas de atualização de estado.
  - `EmployeesManager.tsx`: migrado para `api.employees` sem necessidade de recarregamento manual da página (`window.location.reload`).
- Compilação da SPA com `npx vite build` realizada com sucesso em **865ms**.

### Reavaliação da Etapa 4 (Limpeza, Scripts e Governança)
- Removidos 226 pacotes legados do Next.js (`next`, `next-auth`, `@auth/prisma-adapter`, `eslint-config-next`, `@tailwindcss/turbopack`).
- Removidos arquivos legados (`next.config.ts`, `next-env.d.ts`, `src/middleware.ts`, `src/auth.ts`, `src/app/`, `src/actions/`, etc.).
- `package.json` atualizado com scripts unificados: `npm run dev` (concurrently backend + Vite), `npm run build`, `npm start`, `npm run seed`.
- `tsconfig.json` limpo de referências do Next.js.
- Regras permanentes atualizadas em `GEMINI.md` e diretrizes consolidadas em `AGENTS.md`.
- Memória operacional sincronizada em `MEMORY.md`.

---

## 4. Testes de Integridade Finais & Hotfixes
- **Compilação do Frontend:** `npx vite build` executado sem erros.
- **Servidor Unificado:** `npm start` inicia o servidor Express, disponibiliza a API REST e entrega a SPA no endpoint raiz e nas rotas dinâmicas com fallback.
- **Autenticação & Dashboard:** Validado o login via API e entrega da tela de login glassmorphism.
- **Hotfix (React Router `useSearchParams`):** Corrigida a desestruturação de `useSearchParams()` em `TechnicianDashboardClient.tsx` de objeto (`const searchParams = useSearchParams()`) para tupla (`const [searchParams] = useSearchParams()`), padrão da biblioteca `react-router-dom`.

