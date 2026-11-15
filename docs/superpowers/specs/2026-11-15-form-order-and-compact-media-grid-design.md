# Design Doc: Reordenação dos Campos e Grid Quadrado Compacto de Mídias

**Data:** 2026-11-15  
**Autor:** Antigravity  
**Status:** Proposto / Aprovado pelo Usuário  

---

## 1. Contexto & Necessidade

No formulário de atendimentos (`WorkLogForm.tsx`), a área de **Anexar Mídia** estava posicionada no rodapé da página (após a seleção de tags e tipos de atendimento). Com a recente introdução do editor inline na **Descrição**, ter a área de mídias logo abaixo da descrição torna a experiência de arrastar e soltar muito mais intuitiva e ágil, pois o operador visualiza os anexos e o texto lado a lado sem necessidade de rolar a tela.

Além disso, a lista de mídias selecionadas utilizava cartões horizontais compridos em linha única (`flex-col`), ocupando muito espaço vertical à medida que mais arquivos eram anexados.

O objetivo desta melhoria é:
1. Reordenar os blocos do formulário para posicionar **Anexar Mídia** imediatamente após **Descrição**.
2. Substituir a lista de cartões retangulares por uma **grade fluida de cards quadrados e compactos** com pré-visualização em destaque, nome curto truncado no padrão clássico, botão de exclusão rápido e badge `✓ No texto`.

---

## 2. Abordagens Consideradas

### Abordagem 1: Card Quadrado com Thumbnail em Área Cheia e Overlays Sutis (Escolhida)
* **Descrição:** Cards com proporção quadrada (~100x100px ou `aspect-square`) distribuídos em grade fluida responsiva (`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5`). A miniatura ocupa a área total com `object-cover rounded-xl`. O botão de remoção `×` fica no canto superior direito sobre fundo translúcido; o badge `✓ No texto` fica no canto superior esquerdo; a base possui gradiente suave escurecido com o nome do arquivo truncado de forma clássica (ex: `Captura...3713.png`) e tooltip completo.
* **Vantagens:** Máximo destaque visual para a imagem/print em tamanho compacto, sem quebrar o layout e mantendo facilidade de arraste para a descrição.
* **Decisão:** Escolhida pelo usuário.

### Abordagem 2: Card Quadrado Dividido (Miniatura no Topo + Faixa Inferior Sólida)
* **Descrição:** Card dividido com 65% para a miniatura e 35% para um bloco de texto sólido.
* **Desvantagens:** Reduz a área visível do print em cards compactos, poluindo a visualização.
* **Decisão:** Descartada.

---

## 3. Metas, Não-Metas e Restrições

### Metas (Goals)
1. **Reordenação precisa dos campos:**
   - 1) Título do chamado
   - 2) Solicitante e Escritório/Cliente
   - 3) Descrição (`InlineMediaEditor`)
   - 4) **Anexar Mídia** (Dropzone + lista de anexos)
   - 5) **Tag de Plataforma** (obrigatória)
   - 6) **Tipo de Atendimento** (Ação Técnica / Implementação)
   - 7) Botão Salvar Atendimento
2. **Grade fluida de mídias anexadas:**
   - Grid responsivo que acomoda múltiplas mídias em linha e quebra automaticamente conforme o espaço.
   - Cards quadrados compactos com cantos arredondados (`rounded-xl`), bordas elegantes e sombra sutil.
3. **Miniatura e Pré-visualização:**
   - Imagens utilizam a `previewUrl` em área cheia com `object-cover`.
   - Arquivos não-imagem (PDFs, vídeos, planilhas) exibem fundo neutro com ícone SVG centralizado (`FileText`, `Video`, `Paperclip`).
4. **Truncamento clássico de nome:**
   - Helper de truncamento preservando o início e a extensão (ex: `Captura...3713.png`), evitando que nomes longos estourem o card.
   - Atributo `title` com o nome original completo para leitura por hover.
5. **Manutenção das funcionalidades anteriores:**
   - Arrastar o card quadrado para o campo de descrição (`draggable={true}` com `application/x-hubsupport-media-id`).
   - Exibição do badge `✓ No texto` no topo do card.
   - Botão `×` de remoção no topo direito revogando a URL e removendo chips correspondentes do editor.

### Não-Metas (Non-Goals)
- Não alterar lógica de envio, backend ou rotas de API.
- Não alterar validações de obrigatoriedade dos campos.

---

## 4. Estrutura do Card Quadrado Compacto

```tsx
<div
  draggable={!isPending}
  onDragStart={(e) => {
    e.dataTransfer.setData("application/x-hubsupport-media-id", item.id);
    e.dataTransfer.effectAllowed = "copyMove";
  }}
  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-2xs cursor-grab active:cursor-grabbing hover:border-slate-400 dark:hover:border-slate-600 transition-all select-none"
  title={`${item.name} (${formatBytes(item.size)})`}
>
  {/* Miniatura ou Ícone */}
  {isImage ? (
    <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-slate-400">
      <FileIcon className="w-6 h-6 mb-1 text-slate-500" />
      <span className="text-[10px] font-medium uppercase tracking-wider">{ext}</span>
    </div>
  )}

  {/* Badge No texto */}
  {insertedMediaIds.has(item.id) && (
    <div className="absolute top-1.5 left-1.5 z-10 bg-indigo-600/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5 backdrop-blur-xs">
      <Check className="w-2.5 h-2.5 stroke-[3]" />
      <span>No texto</span>
    </div>
  )}

  {/* Botão Remover */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      removeMediaItem(item.id);
    }}
    disabled={isPending}
    className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-md bg-black/50 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs"
  >
    <X className="w-3 h-3" />
  </button>

  {/* Faixa inferior com nome truncado clássico */}
  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 pt-4 text-left pointer-events-none">
    <p className="text-[10px] font-medium text-white truncate leading-tight">
      {truncateMiddle(item.name, 14)}
    </p>
    <span className="text-[9px] text-white/70">{formatBytes(item.size)}</span>
  </div>
</div>
```
