# Animações de Layout Fluidas no Localizador de Celulares — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar transições fluidas de reposicionamento com física de mola no Localizador de Celulares usando a biblioteca `motion`, permitindo que os cards deslizem suavemente ao mudar de ordem com a telemetria de bateria.

**Architecture:** Instalação do pacote `motion` oficial para React 19. Envelopamento do grid e dos cards em `src/pages/PhoneFinderPage.tsx` com `<motion.div layout>` e `<AnimatePresence mode="popLayout">`, com parâmetros calibrados de mola (`stiffness: 320, damping: 28`).

**Tech Stack:** React 19, TypeScript, `motion` (v12+ / Framer Motion), Tailwind CSS, Vite.

**Spec:** [docs/superpowers/specs/2026-11-27-phone-finder-fluid-layout-animations-design.md](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-27-phone-finder-fluid-layout-animations-design.md)

---

## Global Constraints

- **Compatibilidade com React 19:** Utilizar o pacote oficial `motion` (exportado de `motion/react`) que suporta nativamente React 19 sem conflitos de peerDependencies.
- **Transição com Aceleração por Hardware:** As animações de layout devem utilizar `layout` para executar interpolações na GPU sem recálculo de reflow pesado.
- **Calibração de Física Natural:** Evitar oscilações excessivas ou lentidão — usar `type: "spring", stiffness: 320, damping: 28` para sensação tátil e firme.
- **Modo popLayout no AnimatePresence:** Evitar que cards que estão saindo empurrem repentinamente os vizinhos de forma desajeitada.
- **Verificação Obrigatória:** `npm run build` deve compilar perfeitamente com 0 erros de tipagem ou de bundling.

---

## Review Focus

1. **Reordenação Dinâmica por Bateria:** Quando a ordenação de `filteredCards` mudar devido a telemetria, os cards afetados devem deslizar até a nova coordenada sem saltos bruscos.
2. **Filtragem por Busca ou Status:** Ao digitar na busca ou alternar chips (Online/Offline/Todos), os cards filtrados devem desvanecer e os restantes devem se rearranjar suavemente.
3. **Cliques e Interações durante a Animação:** Botões de Localizar, Vibrar e Menu de contexto devem continuar clicáveis e funcionais mesmo durante transições.
4. **Desempenho no Navegador:** 60 FPS estáveis na GPU sem engasgos ou travamento da thread principal.

---

## Task Structure

### Task 1: Instalação da Dependência `motion`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Instalar o pacote oficial `motion`**
  Run: `npm i motion`

- [ ] **Step 2: Verificar compilação com `npx tsc --noEmit`**
  Run: `npx tsc --noEmit`
  Expected: 0 erros de tipo.

- [ ] **Step 3: Commit da dependência**
  Commit: `build: add motion dependency for fluid layout animations`

---

### Task 2: Integração de Layout Animations em `PhoneFinderPage.tsx`

**Files:**
- Modify: `src/pages/PhoneFinderPage.tsx:840-870`

**Interfaces:**
- Consumes: `motion`, `AnimatePresence` de `motion/react`.
- Wraps: Grid de cards e itens individuais com `<motion.div layout>`.

- [ ] **Step 1: Importar `motion` e `AnimatePresence` no topo de `PhoneFinderPage.tsx`**
  ```tsx
  import { motion, AnimatePresence } from "motion/react";
  ```

- [ ] **Step 2: Atualizar o container de grid com `motion.div` e `AnimatePresence`**
  Envelopar o grid com:
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
          <PhoneCardTile ... />
        </motion.div>
      ))}
    </AnimatePresence>
  </motion.div>
  ```

- [ ] **Step 3: Validar tipagem com `npx tsc --noEmit`**
  Run: `npx tsc --noEmit`
  Expected: 0 erros.

- [ ] **Step 4: Commit da integração**
  Commit: `feat(phoneFinder): add fluid layout spring animations to phone cards grid`

---

### Task 3: Verificação Geral e Build de Produção

- [ ] **Step 1: Executar testes automatizados do projeto**
  Run: `npx tsx scripts/test-phone-card-sorting.ts`

- [ ] **Step 2: Compilação de Produção**
  Run: `npm run build`
  Expected: Build concluído com sucesso e 0 erros.
