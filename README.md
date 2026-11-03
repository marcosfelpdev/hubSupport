# HubSupport

Sistema corporativo de registro, acompanhamento de atendimentos e geração automatizada de relatórios executivos com inteligência artificial multimodal (Google Gemini 2.0 Flash) e compilação vetorial em PDF (PDFKit).

---

## 🛠️ Arquitetura e Tecnologias

- **Frontend**: Single Page Application (SPA) com React 19, TypeScript e Vite
- **Backend**: API REST em Node.js com Express 5 e TypeScript
- **Estilização**: Tailwind CSS v4 + Design System Dark Glassmorphism
- **Banco de Dados**: Prisma ORM 5 com suporte a PostgreSQL (produção) e SQLite (desenvolvimento)
- **Autenticação**: JWT seguro via cabeçalho `Authorization: Bearer <token>` e query string autenticada
- **Inteligência Artificial**: SDK oficial `@google/genai` (Files API + Gemini 2.0 Flash com Schema JSON estrito e contingência)
- **Armazenamento de Arquivos**: Cloudflare R2 (produção) com fallback para armazenamento local privado (`storage/`)
- **Geração de PDF**: `pdfkit` (gerador vetorial com paginação dinâmica e cabeçalhos corporativos)
- **Captura de Tela**: APIs nativas do navegador (`navigator.mediaDevices.getDisplayMedia` e `MediaRecorder`) com mixagem de áudio via Web Audio API

---

## 📋 Pré-requisitos & Configuração

### 1. Clonar e Instalar Dependências

```bash
npm install
```

### 2. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto baseado no arquivo `.env.example`:

```bash
cp .env.example .env
```

Configure as variáveis de ambiente necessárias:
- `DATABASE_URL` e `DIRECT_URL`: Strings de conexão com o banco de dados.
- `JWT_SECRET`: Chave secreta de alta entropia para assinatura dos tokens JWT.
- `GEMINI_API_KEY`: Chave de API do Google Gemini (obtenha em [Google AI Studio](https://aistudio.google.com/app/apikey)).
- `R2_*`: Credenciais do Cloudflare R2 para armazenamento de gravações e relatórios em produção.

> [!IMPORTANT]
> NUNCA comite arquivos `.env` ou credenciais de produção no repositório. O arquivo `.env` está devidamente listado no `.gitignore`.

### 3. Banco de Dados e Seed

Sincronize o schema com o banco de dados e execute o seed inicial:

```bash
npx prisma db push
npm run seed
```

As credenciais dos usuários de demonstração gerados pelo seed podem ser customizadas no arquivo `.env` (`ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, etc.).

### 4. Executar em Desenvolvimento

```bash
npm run dev
```

O comando iniciará concorrentemente:
- **Backend API**: porta 4000
- **Frontend SPA**: porta 3000

---

## 🎥 Fluxo de Gravação de Tela & Relatórios com Gemini

1. **Iniciar Gravação**: No Dashboard, clique em **"Gravação de Tela"**. O navegador solicitará autorização para capturar a tela/aba/janela e o áudio.
2. **Indicador em Tempo Real**: Durante a gravação, o botão exibe um indicador pulsante e um cronômetro com o tempo decorrido.
3. **Finalização Automática**: Ao clicar em **"Finalizar Gravação"**, o modal de atendimento é aberto automaticamente com o vídeo anexado.
4. **Revisão e Envio**: O usuário confere os dados do formulário, visualiza a prévia do vídeo e salva o atendimento.
5. **Processamento Assíncrono**:
   - O atendimento é registrado imediatamente e o vídeo é enviado de forma segura para o Cloudflare R2 (ou armazenamento privado local).
   - Um job em segundo plano envia o vídeo para a API do Google Gemini (`gemini-2.0-flash`) com instruções estruturadas e extrai os dados factuais da gravação em formato JSON padronizado.
   - O gerador `pdfkit` monta o relatório em PDF com layout profissional, salvando no storage privado.
   - Arquivos temporários são excluídos dos servidores da Google Files API após a conclusão.
6. **Acompanhamento e Download**:
   - No card expandido, a seção **"Relatório gerado por IA"** reflete os estados: `Aguardando` ➔ `Processando IA` ➔ `Concluído` (ou `Falha` com botão de retentativa).
   - Os botões **"Baixar gravação"** e **"Baixar relatório PDF"** realizam o download seguro através das rotas autenticadas `/api/reports/:id/recording` e `/api/reports/:id/download`.

---

## 🔒 Segurança e Privacidade de Dados

- **Armazenamento Privado**: Os vídeos gravados e relatórios gerados nunca são expostos em diretórios estáticos públicos (`public/`).
- **Download Autenticado**: O acesso às rotas de download valida rigorosamente o token de sessão ativo via JWT.
- **Credenciais Protegidas**: A `GEMINI_API_KEY` e chaves de acesso ao Cloudflare R2 permanecem restritas ao ambiente do backend.
- **Limpeza de Arquivos Remotos**: Todo arquivo temporário enviado à Files API do Google é excluído imediatamente após o término do processamento.

---

## 🧪 Testes Automatizados

```bash
# Teste de geração de PDF e relacionamentos:
npx tsx scripts/test-pdf-and-ai-report.ts

# Teste de conexão com o Cloudflare R2:
npx tsx scripts/test-r2-connection.ts
```
