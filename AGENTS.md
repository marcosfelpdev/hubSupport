# Diretrizes para Agentes de IA — HubSupport

Este projeto utiliza uma arquitetura moderna e desacoplada em **React + TypeScript puro (Single Page Application via Vite)** no frontend e **Node.js + Express + TypeScript** no backend.

## 1. Arquitetura da Aplicação
- **Frontend (`src/`):** SPA construída com React 19, TypeScript e Vite. Roteamento gerenciado pelo `react-router-dom`. Comunicação com a API via cliente HTTP tipado em `src/services/api.ts`.
- **Backend (`src/server/`):** API REST em Express 5, autenticação via JWT em cookies seguros e cabeçalho `Authorization: Bearer <token>`, e upload de arquivos via Multer.
- **ORM & Banco de Dados (`prisma/`):** Prisma ORM 5 com banco SQLite (`prisma/dev.db`).
- **Processamento de Relatórios & IA (`src/lib/`):** Google Gemini 2.0 Flash (`@google/genai`) e geração vetorial de relatórios corporativos com PDFKit (`pdfkit`).

## 2. Comandos Principais
- `npm run dev`: Inicia o backend (Express na porta 4000) e o frontend (Vite na porta 3000) concorrentemente.
- `npm run build`: Gera o cliente Prisma e compila a SPA em `dist/`.
- `npm start`: Inicia o servidor Node.js/Express em modo de produção servindo a API REST e os arquivos estáticos de `dist/`.
- `npm run seed`: Executa o seed idempotente do banco com usuários e chamados de teste.
- `npm run db:push`: Sincroniza o schema do Prisma com o SQLite.
