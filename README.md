# HubSupport

Sistema corporativo de registro, acompanhamento de atendimentos e geração automatizada de relatórios técnicos com inteligência artificial multimodal (Google Gemini) e PDFKit.

---

## 🚀 Branch da Funcionalidade

Esta funcionalidade foi desenvolvida na branch dedicada:
```bash
git checkout feature/screen-recording-gemini-reports
```

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: Next.js 16.4.1 (App Router, Turbopack, React 19)
- **Estilização**: Tailwind CSS v4 + Design System Dark Glassmorphism
- **Banco de Dados**: SQLite via Prisma ORM (`User`, `WorkLog`, `Notification`, `AiReport`)
- **Autenticação**: NextAuth v5 (sessão JWT via cookies protegidos)
- **Inteligência Artificial**: SDK oficial `@google/genai` (Files API + Gemini 2.0 Flash com Schema JSON estrito)
- **Geração de PDF**: `pdfkit` (gerador vetorial de alta definição com paginação dinâmica e cabeçalhos corporativos)
- **Captura de Tela**: APIs nativas do navegador (`navigator.mediaDevices.getDisplayMedia` e `MediaRecorder`)
- **Testes**: Playwright & TSX

---

## 📋 Pré-requisitos & Configuração

### 1. Clonar e Instalar Dependências

```bash
npm install
```

### 2. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="hub-support-super-secret-key-change-in-production-32chars"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="hub-support-super-secret-key-change-in-production-32chars"

# Chave oficial do Google Gemini AI
# Obtenha em: https://aistudio.google.com/app/apikey
GEMINI_API_KEY="SUA_CHAVE_GEMINI_AQUI"
```

### 3. Banco de Dados e Seed

Execute o push do schema Prisma e o seed de dados iniciais:

```bash
npx prisma db push
npm run seed
```

**Credenciais de Acesso Inicial (após seed):**
- **Admin**: `marcosf@hubsupport.com` / Senha: `076250@Ma`
- **Colaborador**: `ana@hubsupport.com` / Senha: `senha123`
- **Técnico**: `tecnico@hubsupport.com` / Senha: `senha123`

### 4. Executar em Desenvolvimento

```bash
npm run dev
```
Acesse: [http://localhost:3000](http://localhost:3000)

---

## 🎥 Fluxo de Gravação de Tela & Relatórios com Gemini

1. **Iniciar Gravação**: No Dashboard, clique em **"Gravação de Tela"**. O navegador solicitará autorização para capturar a tela/aba/janela e o áudio.
2. **Indicador em Tempo Real**: Durante a gravação, o botão exibe um indicador pulsante em vermelho e um cronômetro com o tempo decorrido.
3. **Finalização Automática**: Ao clicar em **"Finalizar Gravação"** (ou cancelar pela barra nativa do navegador), a gravação é consolidada e o modal de atendimento é aberto automaticamente com o vídeo anexado.
4. **Revisão e Envio**: O usuário confere os dados do formulário, visualiza o nome, tamanho e prévia do vídeo (podendo descartá-lo se desejar) e clica em **"Salvar"**.
5. **Processamento Assíncrono**:
   - O atendimento é registrado imediatamente no banco de dados e o vídeo é salvo em diretório privado seguro (`storage/recordings/`).
   - Um job em segundo plano envia o vídeo para a API do Google Gemini (`gemini-2.0-flash`) com instruções estruturadas e extrai os dados factuais da gravação em formato JSON padronizado.
   - O gerador `pdfkit` monta o relatório em PDF com layout profissional, paginação e cabeçalhos corporativos, salvando em `storage/reports/`.
   - Arquivos temporários são excluídos dos servidores da Google Files API após a conclusão.
6. **Acompanhamento e Download**:
   - No card expandido, a seção **"Relatório gerado por IA"** reflete os estados: `Aguardando` ➔ `Processando IA` ➔ `Disponível` (ou `Falha` com botão de retentativa).
   - O botão **"Baixar relatório PDF"** realiza o download seguro através da rota autenticada `/api/reports/[id]/download`.

---

## 🔒 Segurança e Privacidade de Dados

- **Armazenamento Privado**: Os vídeos gravados e relatórios gerados são armazenados na pasta local `storage/` (fora da pasta pública `public/`), impedindo qualquer acesso web não autorizado.
- **Download Autenticado**: A rota `/api/reports/[id]/download` valida rigorosamente a sessão ativa do usuário no NextAuth antes de liberar o fluxo de bytes do PDF.
- **Credenciais Protegidas**: A `GEMINI_API_KEY` permanece restrita ao ambiente do servidor backend, nunca sendo exposta ao frontend ou código client-side.
- **Limpeza de Arquivos Remotos**: O vídeo enviado temporariamente para a Files API do Google é excluído imediatamente após o término da geração do relatório.

---

## 🧪 Testes Automatizados

O projeto conta com rotinas de teste automatizadas para validação ponta a ponta:

```bash
# 1. Teste de geração de PDF e relacionamentos no banco SQLite:
npx tsx scripts/test-pdf-and-ai-report.ts

# 2. Teste E2E de interface, regressão e rota autenticada (Playwright):
node scripts/test-screen-recording-and-reports.js
```
