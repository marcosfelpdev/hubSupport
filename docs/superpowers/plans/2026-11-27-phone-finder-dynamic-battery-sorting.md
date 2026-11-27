# Ordenação Dinâmica por Carga no Localizador de Celulares — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar ordenação dinâmica por nível de carga no Localizador de Celulares (`PhoneFinderPage.tsx`), priorizando aparelhos com menor bateria descarregando no início da lista, com reatividade contínua via WebSocket.

**Architecture:** Módulo isolado e puro de ordenação `src/utils/phoneCardSorting.ts` implementando o algoritmo de duas camadas de risco (descarregando 0-100, carregando 1000-1100, sem telemetria 2000, com desempate alfabético por nome). Integração reativa no `useMemo` do `PhoneFinderPage.tsx` e feedback visual no cabeçalho dos filtros.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Node.js `assert`, `tsx`.

**Spec:** [docs/superpowers/specs/2026-11-27-phone-finder-dynamic-battery-sorting-design.md](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-27-phone-finder-dynamic-battery-sorting-design.md)

---

## Global Constraints

- **Prioridade Máxima para Descarregando:** Celulares descarregando (`isCharging: false`) devem sempre preceder celulares conectados ao carregador (`isCharging: true`), independentemente do percentual.
- **Ordem Crescente de Nível:** Em cada grupo, celulares com menor percentual numérico de carga vêm primeiro (ex: 5% antes de 20%, 20% antes de 80%).
- **Preservação de Última Leitura Conhecida:** Aparelhos offline ou desconectados que já possuem telemetria em `card.battery` usam o último nível informado.
- **Sem Telemetria ao Final:** Aparelhos que nunca emitiram dados de bateria (`card.battery == null`) ficam ao final da lista.
- **Desempate Estável:** Em caso de mesmo peso e nível, desempate alfabético natural (`name.localeCompare(..., "pt-BR", { numeric: true })`).
- **Verificação Obrigatória:** Build limpo sem erros de tipo via `npm run build` e execução dos testes automatizados via `tsx`.

---

## Review Focus

1. **Aparelho com 5% Carregando vs Aparelho com 40% Descarregando:** O aparelho de 40% descarregando DEVE aparecer antes do aparelho de 5% carregando, pois o de 40% está em risco ativo de desligar.
2. **Empate de Nível de Carga:** Se dois aparelhos tiverem 50% de bateria e ambos estiverem descarregando, a ordem deve ser estritamente alfabética pelo nome.
3. **Chegada de Evento WebSocket:** Quando o socket despacha `onCardBattery`, a lista deve reposicionar o card imediatamente sem recarregar a página.
4. **Cards sem Telemetria:** Aparelhos recém-criados ou nunca pareados com `battery: null` não podem quebrar a ordenação e devem aparecer ao final.
5. **Combinação com Filtros Existentes:** A busca por texto (`searchTerm`) e o filtro de presença (`statusFilter: online/offline/unpaired`) devem continuar funcionando perfeitamente em conjunto com a ordenação.

---

## Task Structure

### Task 1: Módulo Puro de Ordenação e Testes Automatizados

**Files:**
- Create: `src/utils/phoneCardSorting.ts`
- Create: `scripts/test-phone-card-sorting.ts`

**Interfaces:**
- Produces: `getBatteryWeight(card: PhoneCardItem): number`
- Produces: `sortPhoneCardsByBattery(cards: PhoneCardItem[]): PhoneCardItem[]`

- [ ] **Step 1: Criar teste automatizado com os cenários de ordenação**
  Criar `scripts/test-phone-card-sorting.ts` testando:
  - Ordenação crescente de bateria para aparelhos descarregando.
  - Celulares descarregando antes de celulares carregando (ex: 50% descarregando antes de 10% carregando).
  - Celulares carregando ordenados entre si do menor para o maior.
  - Aparelhos sem telemetria ao final.
  - Desempate por nome.
  - Preservação de última telemetria em aparelhos offline.

- [ ] **Step 2: Executar teste para validar que falha (RED)**
  Run: `npx tsx scripts/test-phone-card-sorting.ts`
  Expected: Falha por módulo inexistente.

- [ ] **Step 3: Implementar `src/utils/phoneCardSorting.ts`**
  Implementar as funções `getBatteryWeight` e `sortPhoneCardsByBattery`.

- [ ] **Step 4: Executar teste para validar que passa (GREEN)**
  Run: `npx tsx scripts/test-phone-card-sorting.ts`
  Expected: Todos os testes aprovados com sucesso.

- [ ] **Step 5: Commit do Módulo e Testes**
  Commit: `feat(phoneFinder): create battery sorting utility and unit tests`

---

### Task 2: Integração no `PhoneFinderPage.tsx` e Indicador Visual

**Files:**
- Modify: `src/pages/PhoneFinderPage.tsx:365-395`
- Modify: `src/pages/PhoneFinderPage.tsx:490-530`

**Interfaces:**
- Modifies: `filteredCards` no `PhoneFinderPage.tsx` para aplicar `sortPhoneCardsByBattery`.
- Modifies: Barra de filtros para exibir badge indicativo de ordenação por menor carga.

- [ ] **Step 1: Importar `sortPhoneCardsByBattery` em `PhoneFinderPage.tsx`**
  Importar a função utilitária de `../utils/phoneCardSorting`.

- [ ] **Step 2: Aplicar a ordenação no hook `useMemo` de `filteredCards`**
  Garantir que os cards filtrados passem por `sortPhoneCardsByBattery(filtered)`.

- [ ] **Step 3: Adicionar indicador visual de ordenação na barra de controles**
  Incluir badge sutil com ícone `BatteryMedium` ou `Zap` informando "Prioridade por menor carga".

- [ ] **Step 4: Validar tipagem com `npx tsc --noEmit`**
  Run: `npx tsc --noEmit`
  Expected: 0 erros de tipo.

- [ ] **Step 5: Commit da Integração**
  Commit: `feat(phoneFinder): integrate dynamic battery sorting in phone finder page`

---

### Task 3: Verificação Geral, Testes E2E e Build de Produção

- [ ] **Step 1: Executar suíte de testes de ordenação**
  Run: `npx tsx scripts/test-phone-card-sorting.ts`

- [ ] **Step 2: Compilação de Produção**
  Run: `npm run build`
  Expected: Vite SPA e Prisma Client compilados com 0 erros.
