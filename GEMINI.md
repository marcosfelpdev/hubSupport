# Regras Permanentes do Projeto — HubSupport

1. **Privacidade e Armazenamento Privado:**
   Gravações de tela (`storage/recordings/`) e relatórios em PDF (`storage/reports/`) NUNCA devem ser movidos para a pasta `public/`. O acesso a esses arquivos deve ser exclusivamente intermediado por rotas de API autenticadas (`/api/reports/[id]/download` e `/recording`), validando a sessão ativa no NextAuth.

2. **Convenções do Next.js 16 & Server Actions:**
   Trate sempre os parâmetros de rotas dinâmicas como Promises assíncronas (`const { id } = await params`). Valide a autenticação do usuário com `await auth()` no início de qualquer Server Action. Em jobs em segundo plano (`setImmediate`), envolva invocações de `revalidatePath` em blocos `try/catch` para evitar exceções fora do ciclo de vida da requisição HTTP.

3. **Ciclo de Vida do Gemini & Limpeza da Files API:**
   Ao processar vídeos na API do Google Gemini (`@google/genai`), implemente polling com timeout aguardando o estado `ACTIVE` do arquivo na nuvem. É obrigatório deletar o arquivo remoto temporário via `ai.files.delete` dentro de um bloco `finally` para evitar acúmulo desnecessário de dados e consumo de cota.

4. **Resiliência e Esquemas Estritos de IA:**
   Toda geração estruturada pelo Gemini deve usar `responseSchema` com tipagem JSON estrita e valores de fallback robustos caso campos parciais venham nulos. Mantenha o mecanismo de retentativas com backoff exponencial e rotação de modelos candidatos para mitigar erros temporários de cota ou indisponibilidade (códigos 429 e 503).

5. **Integridade do Banco de Dados & Prisma:**
   Qualquer alteração em `prisma/schema.prisma` deve ser sincronizada localmente com `npx prisma db push`. Mantenha a compatibilidade com a hierarquia de cargos do sistema (`ADMIN`, `USER`, `SUPPORT`, `TECHNICIAN`, `MANAGER`) e garanta que o script de seed (`npm run seed`) continue operando de forma idempotente.
