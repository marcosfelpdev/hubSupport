# Detalhamento do Bootstrap de Memória — HubSupport
**Data:** 2026-10-20 | **Autor do Mapeamento:** Antigravity AI Assistant

---

## 1. Linha do Tempo e Histórico do Repositório Git

### 1.1 Fases do Projeto
- **Fase 1 (Fundação & Setup Base — 2026-10-15):**
  - Commit `213b0b3`: `chore: inicio estrutura base do projeto`
  - Setup do Next.js 16 com TypeScript, Tailwind CSS, Prisma com SQLite e NextAuth v5 com autenticação por credenciais (hash bcrypt).
  - Criação do modelo inicial `User` e `WorkLog` em `prisma/schema.prisma`.
- **Fase 2 (Redesign & Expansão de Perfis — 2026-10-15):**
  - Commit `7fa3278`: `feat: redesign dashboard com modal de atendimento, filtros e expansão de cargos`
  - Reestruturação do dashboard: abertura do formulário em modal centralizado, listagem de cards compactos à esquerda e visualização detalhada expandida à direita.
  - Implementação de filtros (solicitante, escritório, status, funcionário, data).
  - Expansão de cargos em `src/lib/roles.ts`: `ADMIN`, `USER`, `SUPPORT`, `TECHNICIAN`, `MANAGER`.
- **Fase 3 (Atendimento Técnico & Uploads — 2026-10-16):**
  - Commit `f31826f`: `feat: checklist ação técnica/implementação e anexo de mídia nos atendimentos`
  - Introdução das flags `technicalAction` e `implementation` para categorizar chamados que demandam intervenção técnica/desenvolvimento.
  - Suporte a anexo de múltiplos arquivos de imagem/documento com salvamento em `public/uploads/`.
  - Commits `483c4d8` a `c167fe7`: Ajustes visuais recorrentes de posicionamento e layout dos badges/ícones dos cards minimizados e expandidos com Lucide Icons.
- **Fase 4 (Painel Técnico & Notificações — 2026-10-17):**
  - Commit `a7d5384`: `feat: adicionar painel tecnico com notificacoes e botao de chamado solucionado`
  - Criação da tabela `Notification` vinculada a `User` e `WorkLog`.
  - Criação da rota `/dashboard/tecnico` exclusiva para visualização de chamados técnicos e botão "Solucionado" para encerramento de atendimentos.
  - Criação do componente `NotificationBell.tsx` na barra superior.
  - Commit `14bd6fb`: `feat: adicionar alerta sonoro para novas notificacoes tecnicas` via Web Audio API nativa.
- **Fase 5 (Gravação de Tela & Relatórios Técnicos por IA — 2026-10-18):**
  - Branch dedicada: `feature/screen-recording-gemini-reports`.
  - Commit `d2d7f1e`: `feat: adicionar gravacao de tela e relatorios tecnicos com Gemini e PDF`
  - Captura de áudio e tela nativa (`ScreenRecorderButton.tsx`).
  - Armazenamento privado em `storage/recordings/` e `storage/reports/`.
  - Integração com `@google/genai` (Gemini 2.0 Flash / Files API).
  - Extração estrita via schema JSON (`REPORT_SCHEMA`).
  - Geração vetorial do relatório PDF corporativo com `pdfkit`.
  - Rotas autenticadas para download de relatório e vídeo.
  - Testes E2E com Playwright e scripts TSX.
- **Fase 6 (Unificação & Bootstrap — 2026-10-20):**
  - Merge da feature para a branch `main` via fast-forward.
  - Execução deste bootstrap de memória técnica operacional.

---

## 2. Resumo de Conversas e Reconstituição de Contexto
[CONFIRMADO no git log, BACKLOG.md, README.md e código]
1. **Problema Original do Negócio:** A equipe de suporte registrava chamados de clientes e escritórios, mas os atendimentos complexos que envolviam reuniões, demonstrações em tela e pedidos de novas funcionalidades exigiam documentação manual demorada, frequentemente incompleta ou inconsistente para repassar aos desenvolvedores.
2. **Evolução da Solução:**
   - Inicialmente, foi construído um sistema de log de atendimentos diários com feed e autenticação (M1 a M4).
   - Em seguida, foi criada uma distinção para itens que eram "Ação Técnica" ou "Implementação", gerando fila própria para o time técnico.
   - O salto qualitativo ocorreu ao transformar o atendimento em um processo multimídia: o atendente grava a tela durante o suporte/reunião; o sistema processa a gravação com Gemini multimodal; a IA gera o diagnóstico, resumo executivo, tabela de melhorias com prioridades, justificativa detalhada e transcrição com timestamps; e o PDFKit gera um documento executivo formatado pronto para entrega à diretoria ou ao time de engenharia.
3. **Ambiente Antigravity:**
   - Durante este bootstrap, as pastas protegidas de sessões passadas do IDE Antigravity (`brain` e `config`) não permitiram listagem direta externa por regras de proteção do sistema.
   - Toda a história foi reconstruída diretamente da verdade de código, commits git detalhados, schemas e scripts de teste.

---

## 3. Análise Profunda do Produto

### 3.1 Público-Alvo e Papéis de Usuário
- **ADMIN:** Gestão completa de usuários (criação, edição, bloqueio e exclusão de funcionários). Acesso irrestrito a todos os atendimentos e relatórios.
- **TECHNICIAN (Técnico):** Acesso prioritário à rota `/dashboard/tecnico`. Recebe alertas sonoros e notificações em tempo real sempre que um atendimento é marcado como ação técnica ou implementação. Pode marcar atendimentos como "Solucionado".
- **SUPPORT (Suporte) & USER (Colaborador):** Registram novos atendimentos diários, gravam reuniões e telas, acompanham o status dos relatórios e efetuam download dos PDFs.
- **MANAGER (Gestor):** Visão analítica dos atendimentos e relatórios gerados para tomada de decisão e validação de prioridades operacionais.

### 3.2 Fluxo Ponta a Ponta de um Atendimento com Relatório IA
1. **Captura no Navegador:**
   - O operador clica no botão "Gravação de Tela" (`ScreenRecorderButton.tsx`).
   - O navegador aciona `navigator.mediaDevices.getDisplayMedia` (captura de tela + áudio da tela) e `navigator.mediaDevices.getUserMedia` (microfone).
   - Um `AudioContext` mixa os dois fluxos de áudio para garantir que tanto o som do sistema quanto a fala do operador sejam gravados com sincronia.
   - Um `MediaRecorder` gera chunks de vídeo `.webm` (ou `.mp4` se suportado).
2. **Submissão do Formulário:**
   - Ao finalizar a gravação, o modal de atendimento é aberto com os dados da gravação anexados (`WorkLogForm.tsx`).
   - O formulário submete via Server Action `createWorkLog` (`src/actions/worklog.ts`).
   - O vídeo é validado (limite de 100MB) e salvo na pasta privada do servidor: `storage/recordings/`.
   - É criado o registro em `WorkLog` e criada a linha vinculada em `AiReport` com status `pending`.
3. **Processamento Assíncrono (`processAiReportJob`):**
   - O processamento é disparado em segundo plano via `setImmediate`, sem travar a resposta HTTP do usuário.
   - Status do `AiReport` muda para `processing`.
   - O vídeo é enviado para a **Google Files API** via `@google/genai` (`ai.files.upload`).
   - O sistema aguarda em polling ativo até que o estado do arquivo remoto passe de `PROCESSING` para `ACTIVE`.
4. **Interpretação e Estruturação Multimodal (`gemini.ts`):**
   - O modelo Gemini recebe a mídia e o prompt estruturado com instruções formais de suporte corporativo.
   - O Gemini aplica a restrição estrita do `REPORT_SCHEMA` com `responseMimeType: "application/json"`.
   - Dados extraídos: Título, Subtítulo, Departamento, Participantes, Plataforma Analisada, Resumo Executivo, Propostas de Melhoria com Categoria e Prioridade, Tópico e Parágrafos de Detalhamento Técnico, Encaminhamentos, e Transcrição Integral com Timestamps e identificação dos interlocutores.
   - **Limpeza:** No bloco `finally`, o arquivo é imediatamente apagado da infraestrutura do Google (`ai.files.delete`).
5. **Geração do Documento PDF (`pdf-generator.ts`):**
   - O `pdfkit` compila um PDF vetorial em padrão corporativo:
     - Cabeçalho institucional com barra azul de destaque e metadados organizados;
     - Caixa cinza de Resumo Executivo;
     - Tabela formal de Propostas de Melhoria com tags de categorias coloridas e badges de prioridade;
     - Seções de Detalhamento Operacional e Encaminhamentos;
     - Transcrição cronológica com caixas e marcações temporais [MM:SS];
     - Numeração de páginas dinâmica ("Página X de Y") e rodapés institucionais.
   - O arquivo PDF é gravado em `storage/reports/relatorio-{workLogId}-{timestamp}.pdf`.
   - `AiReport` é atualizado para status `completed` com o caminho do PDF e dados estruturados em JSON.
6. **Visualização e Download:**
   - O componente `AiReportSection.tsx` realiza polling leve do status.
   - Quando `completed`, exibe prévia das propostas de melhoria e botão seguro para download em `/api/reports/[id]/download`.
   - Caso ocorra falha (ex.: cota de API ou timeout), exibe mensagem amigável e botão de retentativa (`retryAiReport`), que reprocessa o vídeo local sem recriar o atendimento.

### 3.3 Segurança e Privacidade
- **Mídia Sensível Fora do Diretório Público:** Tanto os vídeos (`storage/recordings/`) quanto os relatórios (`storage/reports/`) ficam fora de `public/`.
- **Rotas com Verificação de Sessão:** Qualquer acesso a download ou reprodução valida sessão ativa do NextAuth.
- **Proteção de Chaves de API:** `GEMINI_API_KEY` só é referenciada no runtime do servidor (Server Action / lib).

### 3.4 Dívidas Técnicas e Riscos Identificados
1. **Concorrência do SQLite:** O SQLite é ideal para desenvolvimento e testes, mas em produção com múltiplos usuários escrevendo arquivos grandes e transações simultâneas de banco, pode gerar bloqueios (`SQLITE_BUSY`).
2. **Jobs em Background no Node/Next.js:** O uso de `setImmediate` para tarefas longas (upload + análise de vídeo de até 60s) pode ser interrompido caso o processo do servidor reinicie ou seja executado em ambientes serverless como Vercel (onde a execução encerra assim que a response é enviada). Em produção escalável, um Redis + BullMQ ou job queue dedicada seria ideal.
3. **Cotas da API do Google Gemini:** No tier gratuito ou com cotas restritas, limites de taxa (RPM/TPM) podem gerar erros `429 Too Many Requests`. O sistema já possui retry e backoff, mas cotas corporativas no Google Cloud são recomendadas.
4. **Filtro Padrão do Dashboard:** A query `getWorkLogs` filtra atendimentos apenas pelo dia corrente (`today`), o que oculta atendimentos de dias anteriores a menos que o filtro de data seja manualmente ajustado ou seja implementada paginação geral.
