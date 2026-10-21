# Regras Permanentes do Projeto — HubSupport

1. **Privacidade e Armazenamento Privado:**
   Gravações de tela (`storage/recordings/`) e relatórios em PDF (`storage/reports/`) NUNCA devem ser movidos para a pasta `public/`. O acesso a esses arquivos deve ser exclusivamente intermediado por rotas de API autenticadas (`/api/reports/:id/download` e `/api/reports/:id/recording`), validando a sessão ativa via token JWT / cookies.

2. **Convenções do Backend Node.js / Express & React SPA:**
   Mantenha a API REST padronizada em `src/server/routes/`. Todas as rotas autenticadas devem aplicar o middleware `authenticateToken`. Em jobs em segundo plano (`setImmediate`), execute o processamento de forma não-bloqueante (`processAiReportJob`) sem travar o ciclo de vida das requisições HTTP e com captura abrangente de erros em blocos `try/catch`. O frontend React SPA em `src/` deve consumir o backend exclusivamente pela camada de serviços em `src/services/api.ts`.

3. **Ciclo de Vida do Gemini & Limpeza da Files API:**
   Ao processar vídeos na API do Google Gemini (`@google/genai`), implemente polling com timeout aguardando o estado `ACTIVE` do arquivo na nuvem. É obrigatório deletar o arquivo remoto temporário via `ai.files.delete` dentro de um bloco `finally` para evitar acúmulo desnecessário de dados e consumo de cota.

4. **Resiliência e Esquemas Estritos de IA:**
   Toda geração estruturada pelo Gemini deve usar `responseSchema` com tipagem JSON estrita e valores de fallback robustos caso campos parciais venham nulos. Mantenha o mecanismo de retentativas com backoff exponencial e rotação de modelos candidatos para mitigar erros temporários de cota ou indisponibilidade (códigos 429 e 503).

5. **Integridade do Banco de Dados & Prisma:**
   Qualquer alteração em `prisma/schema.prisma` deve ser sincronizada localmente com `npx prisma db push`. Mantenha a compatibilidade com a hierarquia de cargos do sistema (`ADMIN`, `USER`, `SUPPORT`, `TECHNICIAN`, `MANAGER`) e garanta que o script de seed (`npm run seed`) continue operando de forma idempotente.
