# hubSupport - Backlog & Milestones (MVP)

> Sistema de Log de Atendimentos Diários para equipe de suporte.

## Milestones

### M1 - Setup & Infraestrutura
- [x] TASK-001: Criar projeto Next.js com TypeScript e Tailwind
- [x] TASK-002: Inicializar componentes base e design system
- [x] TASK-003: Instalar e configurar Prisma ORM com adapter SQLite
- [x] TASK-004: Criar schema.prisma com modelos User e WorkLog
- [x] TASK-005: Executar prisma db push
- [x] TASK-006: Criar singleton do Prisma Client

### M2 - Autenticação
- [x] TASK-007: Instalar NextAuth.js e dependências (bcryptjs, etc.)
- [x] TASK-008: Configurar auth.ts com Credentials Provider
- [x] TASK-009: Criar route handler NextAuth (/api/auth/[...nextauth])
- [x] TASK-010: Criar tela de Login com visual moderno e responsivo
- [x] TASK-011: Configurar middleware.ts para proteção de rotas
- [x] TASK-012: Criar AuthProvider wrapper
- [x] TASK-013: Script de seed para usuários iniciais (Ana Silva e Carlos Mendes)

### M3 - Interface Principal
- [x] TASK-014: Layout de dashboard com header, estatísticas e logout
- [x] TASK-015: Componente WorkLogFeed com identificação visual do autor e horários
- [x] TASK-016: Componente WorkLogForm com validação e feedback interativo
- [x] TASK-017: Server Action createWorkLog vinculada ao usuário da sessão
- [x] TASK-018: Feedback de sucesso/erro dinâmico
- [x] TASK-019: Revalidação automática do feed após criação de log

### M4 - Validação & Testes
- [x] TASK-020: Iniciar servidor dev (Turbopack na porta 3000)
- [x] TASK-021: Testar fluxo completo no browser via automação Playwright
- [x] TASK-022: Login com usuários de teste (Ana Silva e Carlos Mendes)
- [x] TASK-023: Criar múltiplos registros de atendimento
- [x] TASK-024: Verificar feed em tempo real e assinatura inequívoca do autor
- [x] TASK-025: Corrigir erros de Server Actions e cacheComponents do Next.js 16
