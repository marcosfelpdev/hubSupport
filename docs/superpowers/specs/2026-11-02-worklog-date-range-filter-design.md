# Design Doc: Filtro por Período de Atendimentos & Correção de Histórico

**Data:** 2026-11-02  
**Autor:** Antigravity  
**Status:** Proposto  

---

## 1. Contexto & Problema

Na tela de atendimentos (`/dashboard/atendimentos`):
1. **Histórico bloqueado:** O endpoint backend `GET /api/worklogs` restringe as buscas unicamente para o dia corrente (`createdAt >= today && createdAt < tomorrow`). Por esse motivo, o frontend não recebia nenhum dos 23 chamados cadastrados em dias anteriores no banco de dados.
2. **Filtro de data limitado e bug de timezone:** O filtro visual atual possui apenas um campo simples para uma única data e utiliza `.toISOString().split("T")[0]`, o que gera incompatibilidade com o fuso horário brasileiro (UTC-3). Além disso, não permite filtrar por períodos (ex: *3 de junho a 15 de outubro*).

---

## 2. Abordagem Escolhida (Opção B)

O usuário optou pela **Opção B**:
- Um botão compacto na barra de filtros: `[📅 Filtrar Período ▾]`.
- Ao clicar, abre um popover suspenso flutuante com:
  - **Atalhos Rápidos:** "Hoje", "Últimos 7 dias", "Últimos 30 dias", "Este mês", "Limpar / Todos".
  - **Campos de Data Personalizada:** "Data inicial (De)" e "Data final (Até)".
  - **Feedback visual no botão:** Exibe o período ativo (ex: `03/06/2026 - 15/10/2026` ou `Hoje`) com destaque visual quando ativo e botão `x` para limpeza rápida.

---

## 3. Especificações Técnicas

### Backend (`src/server/routes/worklogs.routes.ts`)
- No `GET /api/worklogs`:
  - Aceitar parâmetros opcionais de consulta: `startDate` e `endDate` (formato `YYYY-MM-DD`).
  - Quando especificados, construir filtro Prisma:
    - `startDate`: início do dia em horário local/UTC (`00:00:00.000`).
    - `endDate`: final do dia em horário local/UTC (`23:59:59.999`).
  - Se nenhum parâmetro de data ou tipo for passado, retornar **todos os atendimentos** ordenados por `createdAt: desc`, permitindo que o frontend carregue o histórico completo e faça filtros instantâneos sem recarregar a página desnecessariamente.

### Frontend (`src/components/DashboardClient.tsx` & `src/pages/DashboardPage.tsx`)
- **Estado de Filtros:**
  - Substituir `date: string` por `startDate: string` e `endDate: string` (ambos em formato `YYYY-MM-DD`).
- **Função Utilitária de Data Local:**
  - Extração de data local confiável: `toLocalDateString(date)` utilizando `getFullYear()`, `getMonth() + 1` e `getDate()`.
  - Comparação: `(!startDate || logDate >= startDate) && (!endDate || logDate <= endDate)`.
- **Componente Popover (`DateRangePopover`):**
  - Renderizado inline com controle de clique externo (`handleClickOutside`).
  - Totalmente estilizado no tema CloudNexus (suporte completo a Light e Dark Mode).
  - Presets calculam automaticamente as datas correspondentes em formato ISO local.

---

## 4. Critérios de Sucesso
- Todos os 25 chamados históricos aparecem no feed da tela de atendimentos.
- O filtro por data única continua funcionando (selecionando mesmo dia em início e fim ou atalho "Hoje").
- O filtro por período (ex: de 15 de outubro a 2 de novembro) exibe rigorosamente os chamados compreendidos no intervalo.
- `npx tsc --noEmit` e `npm run build` aprovados com 0 erros.
