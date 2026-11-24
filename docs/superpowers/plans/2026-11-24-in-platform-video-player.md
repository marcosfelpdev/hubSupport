# Player de Vídeo In-Platform Personalizado — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o download automático e forçado das gravações de tela nos relatórios por um player de vídeo personalizado integrado à plataforma Relix, com design system consistente (modo claro/escuro, controles minimalistas, controle de velocidade e atalhos), streaming eficiente com suporte a HTTP Range Requests e botão secundário para download manual.

**Architecture:** A rota backend `/api/reports/:id/recording` é ajustada para aceitar o parâmetro `?view=inline`, definindo `Content-Disposition: inline` e cache inteligente de sessão (`Cache-Control: private, max-age=3600`) enquanto preserva `Accept-Ranges: bytes` e streaming via Cloudflare R2 / disco local. No frontend, criamos o componente reutilizável `VideoPlayerModal.tsx` via `createPortal`, integrando controles customizados com barra de progresso, volume, aceleração de playback (1x a 2x), tela cheia e atalhos de teclado. Integramos o componente a `WorkLogDetailContent`, `ReportDetailsModal`, `DashboardClient` e `TechnicianDashboardClient`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Express 5, Node.js HTTP Streaming, Cloudflare R2 Storage (AWS S3 SDK).

**Spec / Referência:** [docs/superpowers/specs/2026-11-24-in-platform-video-player-design.md](file:///c:/Users/mfana/projetos/hubSupport/docs/superpowers/specs/2026-11-24-in-platform-video-player-design.md) (baseado nas diretrizes aprovadas de consumo de banda e nas imagens de referência de prévia de gravação da plataforma).

---

## Global Constraints

- **Privacidade e Armazenamento Privado:** As gravações de tela (`storage/recordings/` ou bucket R2) **nunca** devem ser expostas na pasta pública `public/`. O acesso deve ser intermediado pela rota autenticada `/api/reports/:id/recording` com validação de token JWT / cookies.
- **Retrocompatibilidade:** O download direto continua disponível através do botão secundário "Baixar Gravação" no header do player e quando a rota for chamada sem `?view=inline`.
- **Streaming Parcial (Range Requests):** O player deve tirar proveito das requisições parciais `Range: bytes=start-end` com resposta `206 Partial Content` para não baixar o vídeo inteiro desnecessariamente.
- **Design System Relix:** O player deve seguir rigorosamente a estética da plataforma (bordas arredondadas `rounded-2xl`, suporte a modo claro e escuro, backdrop blur, paleta de cores corporativa, tipografia e ícones do Lucide).
- **Verificação Obrigatória:** Build limpo sem erros de tipo com `npm run build` (`npx vite build` + compilação Prisma) antes de concluir qualquer tarefa.

---

## Review Focus

1. **Autenticação em tags `<video>`:** O elemento `<video src="...">` no HTML5 não envia headers HTTP customizados (`Authorization: Bearer`). A rota deve continuar suportando `req.query.token` ou cookies de sessão para autenticar o stream.
2. **Buffer e seek em WebM sem índice de duração no navegador:** Vídeos gerados via `MediaRecorder` em navegadores Chrome/Edge às vezes possuem duração infinita/NaN até que os metadados sejam lidos. O player deve tratar `duration` de forma segura (com fallback quando `isFinite(duration)` for falso).
3. **Controle de Memória e Listeners:** Limpeza de listeners de teclado (`Space`, `ArrowLeft`, `ArrowRight`, `Escape`) e cancelamento de timers de ocultação automática de controles quando o modal for desmontado.
4. **Fullscreen seguro:** O toggle de tela cheia deve funcionar no container do player usando a Fullscreen API padrão (`requestFullscreen` / `exitFullscreen`), adaptando os botões da interface.
5. **Comportamento em conexões lentas:** Spinner de carregamento visível enquanto o vídeo estiver em estado de buffer (`waiting` / `seeking`).

---

## Task Structure

### Task 1: Rota Backend de Streaming Inline & Cliente API

**Files:**
- Modify: `src/server/routes/reports.routes.ts:56-108`
- Modify: `src/services/api.ts:615-625`
- Test: `scripts/test-recording-inline-stream.ts`

**Interfaces:**
- Consumes: `getFileStream(rawVideoPath, range)` de `src/server/services/r2Storage.ts`.
- Produces: `api.worklogs.getViewRecordingUrl(id: string): string` gerando `/api/reports/:id/recording?view=inline&token=...`.
- Produces: Resposta HTTP com cabeçalho `Content-Disposition: inline` quando `req.query.view === "inline"`.

- [ ] **Step 1: Criar teste de verificação da rota de streaming inline**
  Criar `scripts/test-recording-inline-stream.ts` que valida se a rota `/api/reports/:id/recording?view=inline` retorna `Content-Disposition: inline`, `Accept-Ranges: bytes` e status `200` ou `206 Partial Content`.

- [ ] **Step 2: Atualizar rota `reports.routes.ts`**
  - Identificar `const isInline = req.query.view === "inline";`
  - Definir `Content-Disposition`: `${isInline ? "inline" : "attachment"}; filename="${downloadFileName}"`
  - Definir `Cache-Control`: `${isInline ? "private, max-age=3600" : "private, no-cache, no-store, must-revalidate"}`
  - Manter suporte integral a `Range`, `Content-Range`, `Content-Length` e `Accept-Ranges: bytes`.

- [ ] **Step 3: Adicionar helper `getViewRecordingUrl` em `src/services/api.ts`**
  - Implementar `getViewRecordingUrl(id: string): string` na seção `api.worklogs`.

- [ ] **Step 4: Executar teste e validar rota**
  Run: `npx tsx scripts/test-recording-inline-stream.ts`

---

### Task 2: Componente do Player Personalizado (`VideoPlayerModal.tsx`)

**Files:**
- Create: `src/components/dashboard/VideoPlayerModal.tsx`

**Interfaces:**
- Consumes: `WorkLogItem`, `WorkLogDetailData`, `api.worklogs.getViewRecordingUrl`, `api.worklogs.getDownloadRecordingUrl`.
- Produces: `<VideoPlayerModal isOpen={boolean} onClose={() => void} log={WorkLogDetailData | null} videoUrl?: string />`

- [ ] **Step 1: Implementar o componente `VideoPlayerModal.tsx`**
  - Portal React (`createPortal`) com container de modal estilizado (`fixed inset-0 z-50 bg-slate-900/70 dark:bg-black/85 backdrop-blur-sm`).
  - **Barra Superior (Header):**
    - Ícone de vídeo em container circular/quadrado estilizado.
    - Título do chamado / gravação e subtítulo com cliente, data e solicitante.
    - Botão "Baixar Gravação" (`api.worklogs.getDownloadRecordingUrl(log.id)`).
    - Botão "Fechar" (`X`).
  - **Palco Central de Vídeo:**
    - Moldura em `bg-black rounded-2xl overflow-hidden relative group`.
    - Tag `<video>` referenciando a URL inline autenticada.
    - Overlay central com ícone grande de Play/Pause com animação suave de opacidade.
    - Loading spinner de buffering (`waiting` event).
  - **Barra de Controles Customizada:**
    - Botão Play / Pause (`Play` / `Pause` da Lucide).
    - Botões de salto de tempo: Voltar 5s (`RotateCcw`) e Avançar 5s (`RotateCw`).
    - Indicador de tempo: `MM:SS / MM:SS`.
    - Linha do tempo (Scrubber / Progress bar): barra deslizante interativa com preenchimento colorido e hover time.
    - Controle de Volume: botão de mute (`Volume2`, `Volume1`, `VolumeX`) com mini-slider responsivo.
    - Seletor de Velocidade (Playback Rate): `0.75x`, `1x`, `1.25x`, `1.5x`, `2x`.
    - Botão Tela Cheia (`Maximize` / `Minimize`).
  - **Atalhos de Teclado:**
    - `Space` / `K`: Play / Pause.
    - `ArrowLeft` / `ArrowRight`: Voltar / Avançar 5s.
    - `ArrowUp` / `ArrowDown`: Aumentar / Diminuir volume 10%.
    - `M`: Mutar / Desmutar.
    - `F`: Tela Cheia.
    - `Escape`: Fechar modal (ou sair de tela cheia se estiver em tela cheia).
  - **Auto-hide de controles:**
    - Ocultar a barra de controles após 2.5 segundos de inatividade do mouse enquanto o vídeo estiver tocando.

- [ ] **Step 2: Validação de tipos do componente**
  Run: `npx tsc --noEmit`

---

### Task 3: Integração no Detalhe do Chamado e Modais de Visualização

**Files:**
- Modify: `src/components/dashboard/WorkLogDetailContent.tsx:135-170, 1640-1660, 1820-1910, 2010-2030`
- Modify: `src/components/dashboard/ReportDetailsModal.tsx:40-90, 150-160, 430-460`
- Modify: `src/components/DashboardClient.tsx:300-340`
- Modify: `src/components/TechnicianDashboardClient.tsx:380-420`

**Interfaces:**
- Consumes: `<VideoPlayerModal>` em todos os fluxos onde um chamado com vídeo é inspecionado.
- Produces: Prop `onOpenVideoModal?: (log: WorkLogItem | WorkLogDetailData) => void` em `WorkLogDetailContentProps`.

- [ ] **Step 1: Atualizar `WorkLogDetailContent.tsx`**
  - Adicionar prop `onOpenVideoModal?: (log: WorkLogItem | WorkLogDetailData) => void` em `WorkLogDetailContentProps`.
  - Substituir o botão `<a>` de download direto (linha 1644) por um botão que dispara `onOpenVideoModal(log)` com visual idêntico ao atual (mantendo o ícone `Video` e texto `Vídeo`).
  - Atualizar os links de gravação nas caixas de status de IA (linhas 1829, 1862, 1899) para permitir "Assistir gravação" e "Baixar".
  - Atualizar o botão de vídeo no rodapé (linha 2015) para abrir o player.

- [ ] **Step 2: Atualizar `ReportDetailsModal.tsx`**
  - Adicionar estado `viewingVideo: boolean` e integrar `VideoPlayerModal`.
  - Conectar `onOpenVideoModal={() => setViewingVideo(true)}` ao renderizar `WorkLogDetailContent`.
  - Renderizar `<VideoPlayerModal isOpen={viewingVideo} onClose={() => setViewingVideo(false)} log={log} />`.

- [ ] **Step 3: Atualizar `DashboardClient.tsx` e `TechnicianDashboardClient.tsx`**
  - Adicionar estado `videoPlayerLog: WorkLogItem | null` em ambos os clientes de dashboard.
  - Conectar `onOpenVideoModal={(log) => setVideoPlayerLog(log as WorkLogItem)}`.
  - Renderizar `<VideoPlayerModal isOpen={!!videoPlayerLog} onClose={() => setVideoPlayerLog(null)} log={videoPlayerLog} />`.

---

### Task 4: Player Estilizado na Galeria de Mídias & Verificação Completa

**Files:**
- Modify: `src/components/MediaGalleryModal.tsx:90-130`
- Modify: `src/components/dashboard/ReportDetailsModal.tsx:345-360`

**Interfaces:**
- Produces: Visualização de vídeos anexados na galeria com container escuro e controles refinados consistentes com o tema.

- [ ] **Step 1: Otimizar reprodução de vídeos em `MediaGalleryModal.tsx`**
  - Garantir que tags `<video>` exibidas na galeria de mídias tenham moldura e controles elegantes alinhados ao visual do novo player.

- [ ] **Step 2: Executar build e verificação estática geral**
  Run: `npm run build`
  Expected: Sucesso total na compilação do Vite SPA e geração do cliente Prisma.

- [ ] **Step 3: Criar branch de feature e Pull Request**
  - Commits limpos e organizados por componente.
  - Squash merge para a branch `main` após aprovação.
