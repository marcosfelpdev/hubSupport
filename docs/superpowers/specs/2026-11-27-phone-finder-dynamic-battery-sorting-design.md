# Especificação de Design: Ordenação Dinâmica por Carga no Localizador de Celulares

**Data:** 27 de Novembro de 2026  
**Status:** Aguardando Aprovação  
**Branch Alvo:** `feature/phone-finder-battery-sorting`

---

## 1. Intenção e Contexto (Why)
Na tela do **Localizador de Celulares** (`PhoneFinderPage.tsx`), os operadores e técnicos precisam monitorar a saúde operacional dos aparelhos físicos vinculados à plataforma. Quando múltiplos celulares estão em uso no ambiente, aparelhos descarregando correm risco iminente de desligamento caso não sejam conectados a um carregador a tempo.

Atualmente, os cards dos celulares são exibidos na ordem padrão retornada pela API/banco, dificultando a identificação imediata dos dispositivos que necessitam de recarga prioritária.

O objetivo desta funcionalidade é tornar a lista dinâmica e auto-ordenada por risco de descarregamento, posicionando os aparelhos mais próximos de descarregar sempre no topo da tela e reagindo em tempo real às atualizações de telemetria recebidas via WebSocket.

---

## 2. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
1. **Priorização por Nível de Carga:** Ordenar os celulares em ordem crescente de nível de bateria (do menor para o maior percentual).
2. **Priorização de Aparelhos Descarregando:** Celulares fora do carregador (`isCharging: false`) devem ter prioridade máxima de exibição sobre aparelhos que já estão conectados na tomada (`isCharging: true`).
3. **Preservação de Última Leitura Conhecida:** Aparelhos sem conexão ativa ou offline que já emitiram telemetria mantêm a posição referente ao último nível de carga registrado.
4. **Reatividade Instantânea em Tempo Real:** Conforme eventos `card:battery` e `card:status` chegam pelo WebSocket, o card atualizado deve mover-se automaticamente para sua nova posição na lista.
5. **Critério de Desempate Estável:** Aparelhos com mesmo nível e status de carregador desempatam por ordem alfabética do nome do card.

### Não-Metas (Non-Goals)
- Não alterar a persistência em banco de dados SQLite para salvar a ordenação (a ordenação é computada dinamicamente no frontend).
- Não alterar o payload ou protocolo de telemetria emitido pelo app Android (`device:battery`).

### Anti-Metas (Anti-Goals)
- Celulares já conectados ao carregador não devem encobrir ou ficar à frente de celulares descarregando com risco de desligar.
- A reordenação contínua não deve causar perda de foco em inputs ou quebra de layout durante a rolagem.

---

## 3. Abordagens Consideradas

### Abordagem 1: Agrupamento em Duas Camadas de Risco (ESCOLHIDA)
- **Camada 1 (Crítica / Descarregando):** Aparelhos com `isCharging: false`, ordenados por `battery.level` ascendente (0% → 100%).
- **Camada 2 (Protegida / Carregando):** Aparelhos com `isCharging: true`, ordenados por `battery.level` ascendente (0% → 100%).
- **Camada 3 (Sem telemetria / Nunca informou carga):** Posicionados ao final da lista.
- **Justificativa da escolha:** Garante que qualquer celular em uso que esteja ficando sem bateria apareça antes de celulares que já foram devidamente plugados no carregador.

### Abordagem 2: Ordenação por Nível Absoluto com Desempate
- Todos os celulares ordenados estritamente por número de bateria (0% a 100%), usando o estado de carregamento apenas em caso de empate idêntico de percentual.
- **Descartada:** Um aparelho com 10% já carregando na tomada ficaria na frente de um com 25% descarregando na bancada.

---

## 4. Especificação Técnica da Ordenação

### Algoritmo do Comparador (`sortPhoneCardsByBattery`)

Para cada card `card`:
- Se possuir telemetria `card.battery`:
  - `level = Math.max(0, Math.min(100, Math.round(card.battery.level)))`
  - Se `!card.battery.isCharging`: Peso base = `0 + level` (escala 0 a 100)
  - Se `card.battery.isCharging`: Peso base = `1000 + level` (escala 1000 a 1100)
- Se não possuir telemetria (`card.battery == null`):
  - Peso base = `2000` (final da lista)

Critério de ordenação:
```ts
function getBatteryWeight(card: PhoneCardItem): number {
  if (!card.battery) return 2000;
  const level = Math.max(0, Math.min(100, Math.round(card.battery.level)));
  return card.battery.isCharging ? 1000 + level : level;
}

export function sortPhoneCardsByBattery(cards: PhoneCardItem[]): PhoneCardItem[] {
  return [...cards].sort((a, b) => {
    const weightA = getBatteryWeight(a);
    const weightB = getBatteryWeight(b);
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return a.name.localeCompare(b.name, "pt-BR", { numeric: true });
  });
}
```

### Integração no `PhoneFinderPage.tsx`
O hook `useMemo` de `filteredCards` passa a aplicar a ordenação logo após o filtro de busca e status:
```ts
const filteredAndSortedCards = useMemo(() => {
  const filtered = cards.filter(...);
  return sortPhoneCardsByBattery(filtered);
}, [cards, statusFilter, searchTerm]);
```
Como o WebSocket atualiza `cards` via `setCards` em `handleCardBattery`, qualquer evento reprocessa o `useMemo` instantaneamente.

---

## 5. Próximos Passos
Após aprovação deste documento:
1. Criar branch `feature/phone-finder-battery-sorting` a partir da `main`.
2. Invocar `superpowers:writing-plans` para estruturar o plano de tarefas e testes unitários.
3. Executar implementação e validação via `npx vitest` / `npm run build`.
