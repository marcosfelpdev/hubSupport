# Especificação de Design: Animações de Layout Fluidas no Localizador de Celulares

**Data:** 27 de Novembro de 2026  
**Status:** Aguardando Aprovação  
**Biblioteca:** `motion` (v12+ / Framer Motion oficial para React 19)

---

## 1. Intenção e Contexto (Why)
Com a implementação da ordenação dinâmica prioritária por menor carga de bateria no Localizador de Celulares, os cards mudam de posição conforme os eventos de telemetria chegam via WebSocket. Atualmente, os cards mudam de lugar instantaneamente ("piscam" na nova posição).

O objetivo desta funcionalidade é aplicar **física de molas realista (*spring physics*) e animações de layout fluidas** durante a reordenação, de modo que cada card deslize suavemente pela tela até sua nova posição no grid, enquanto os demais aparelhos abrem espaço de forma orgânica e contínua.

---

## 2. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
1. **Transições de Layout com Física de Mola:** Cada card reposicionado deve deslizar suavemente de sua posição original até a nova coordenada na grade quando a prioridade de bateria mudar.
2. **Reordenação Coletiva Suave:** Os cards vizinhos devem se deslocar harmoniosamente para acomodar a nova ordem.
3. **Entrada e Saída Animadas (`AnimatePresence`):** Criação, remoção ou filtragem de cards devem possuir transição suave de escala e opacidade.
4. **Resiliência a Múltiplos Eventos (Interrupções Suaves):** Se dois eventos chegarem em sequência rápida, a física de mola recalcula a rota sem sobressaltos ou cortes bruscos.
5. **Aceleração por Hardware (GPU):** A animação deve rodar a 60-120 FPS sem travar o thread principal do JavaScript.

### Não-Metas (Non-Goals)
- Não alterar a lógica de negócios da ordenação (`sortPhoneCardsByBattery`).
- Não alterar a transmissão dos eventos WebSocket no backend.

### Anti-Metas (Anti-Goals)
- Animações lentas demais que atrasem a reação do operador aos chamados ou alertas sonoros.
- Efeito "elástico exagerado" que cause enjoo visual (manter *damping* equilibrado em torno de 28-30).

---

## 3. Especificação Técnica da Implementação

### Dependência
- Instalação do pacote oficial `motion` (compatível com React 19):
  ```bash
  npm i motion
  ```

### Integração no `PhoneFinderPage.tsx`
Importar de `motion/react`:
```tsx
import { motion, AnimatePresence } from "motion/react";
```

Estrutura do Grid:
```tsx
<motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
  <AnimatePresence mode="popLayout">
    {filteredCards.map((card) => (
      <motion.div
        key={card.id}
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{
          layout: { type: "spring", stiffness: 320, damping: 28 },
          opacity: { duration: 0.2 },
        }}
        className="w-full"
      >
        <PhoneCardTile
          card={card}
          ...
        />
      </motion.div>
    ))}
  </AnimatePresence>
</motion.div>
```

---

## 4. Próximos Passos
Após aprovação deste documento:
1. Criar branch `feature/phone-finder-fluid-animations`.
2. Invocar `superpowers:writing-plans` para estruturar o plano de tarefas e testes.
3. Instalar `motion` e integrar no `PhoneFinderPage.tsx`.
4. Executar `npm run build` para validação de bundle e compilação.
