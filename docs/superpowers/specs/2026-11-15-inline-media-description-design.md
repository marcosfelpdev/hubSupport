# Design Doc: Inserção de Mídia Inline no Campo de Descrição de Atendimentos

**Data:** 2026-11-15  
**Autor:** Antigravity  
**Status:** Proposto / Aprovado pelo Usuário  

---

## 1. Contexto & Necessidade

No HubSupport, ao registrar atendimentos via **"Novo Atendimento"** ou **"Gravar Tela"**, o operador descreve o incidente e as ações realizadas no campo de texto `reportedProblem` e anexa arquivos em uma área separada no rodapé do formulário.

Atualmente, esse campo de descrição é um `<textarea>` tradicional. Quando múltiplos prints, comprovantes e fotos são anexados, o atendente precisa referenciar manualmente na escrita frases como *"conforme print 2"* ou *"veja a imagem anexada"*. Além disso, os modelos de IA (Google Gemini) recebem o texto em bloco e as imagens em lista separada, sem a correlação espacial exata de qual imagem comprova qual etapa da narrativa.

O objetivo desta funcionalidade é implementar a **inserção de mídia inline dentro do fluxo do texto** no campo de descrição:
- A mídia entra como um elemento atômico inline (chip compacto com thumbnail e nome) no ponto exato onde for solta ou colada.
- O Google Gemini recebe um payload multimodal intercalado (`interleaved`), conectando cada trecho do texto à sua respectiva imagem na sequência exata da frase.

---

## 2. Abordagens Consideradas

### Abordagem 1: Editor Nativo Customizado React + ContentEditable com Chips Atômicos (Escolhida)
* **Descrição:** Criação de um componente dedicado `InlineMediaEditor.tsx` baseado em `contentEditable="true"`. Utiliza a API nativa de Range e Selection do DOM para manipulação de nós de texto e nós inline atômicos (`<span contenteditable="false" data-media-id="...">`). A sincronização com o estado de arquivos do formulário (`mediaFiles`) ocorre através de identificadores únicos (`mediaId`).
* **Vantagens:** 
  - Zero dependências externas no bundle, sem risco de incompatibilidades com o React 19.
  - Fidelidade visual absoluta aos inputs existentes do HubSupport em Tailwind CSS (temas Claro e Escuro).
  - Controle preciso sobre o cursor indicador de drop (`caretRangeFromPoint` / `caretPositionFromPoint`), remoção atômica por teclado (Backspace/Delete) e drag-and-drop de arquivos locais e internos.
  - Parser determinístico e veloz para extrair a lista intercalada (`interleaved`).
* **Trade-off:** Exige manipulação atenta de eventos de DOM e normalização de nós de texto adjacentes.
* **Decisão:** Escolhida pelo usuário por entregar a melhor experiência visual e de performance sem inflar dependências.

### Abordagem 2: Framework de Rich Text (TipTap / Lexical)
* **Descrição:** Instalação de biblioteca de rich text completa e criação de NodeView customizada para os chips.
* **Trade-off:** Adiciona peso considerável ao bundle e potenciais conflitos de peer-dependencies com React 19. Sobrecarga desnecessária para um único campo de entrada.
* **Decisão:** Descartada.

### Abordagem 3: Textarea com Tokens Marcadores (ex: `[[media:id]]`)
* **Descrição:** Manter o `<textarea>` e inserir marcações de texto.
* **Trade-off:** Não exibe thumbnails reais inline, nem chips atômicos com botões de remoção no fluxo do texto.
* **Decisão:** Descartada por não atender aos requisitos funcionais e visuais estabelecidos.

---

## 3. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
1. **Três formas de inserção de mídia:**
   - **Drag-and-drop de arquivos locais:** Arrastar arquivos do sistema operacional e soltá-los entre as palavras do texto.
   - **Drag-and-drop interno:** Arrastar uma mídia já presente na lista inferior de anexos para dentro do texto.
   - **Colar via teclado (Ctrl+V / Cmd+V):** Colar imagem da área de transferência inserindo o chip no ponto atual do cursor (caret).
2. **Indicador de posição (Drop Cursor):** Linha indicadora visual destacada durante o `dragover`, mostrando entre quais caracteres/palavras o chip será solto.
3. **Representação Inline Atômica:**
   - Chip inline compacto com thumbnail pequena, nome truncado do arquivo e botão discreto de remoção (`×`).
   - Navegável como um bloco único com as setas do teclado (esquerda/direita pula o chip inteiro).
   - Apagável diretamente com Backspace ou Delete.
4. **Sincronização bidirecional com a lista de anexos:**
   - Arquivos inseridos no texto são adicionados à lista de anexos geral (`mediaFiles`).
   - Mídias que estão inseridas no texto exibem um badge *"No texto"* na lista inferior.
   - Se o chip for removido do texto, a mídia permanece na lista inferior, mas perde o badge *"No texto"*.
   - Se uma mídia for removida da lista inferior, todos os seus chips correspondentes no texto são removidos automaticamente.
5. **Estrutura de dados intercalada (`interleaved`):**
   - Parser que gera a sequência: `Array<{ type: "text", content: string } | { type: "media", mediaId: string, filename: string, mimeType: string, fileIndex: number }>`.
   - Envio do payload via `FormData` (`descriptionInterleaved`) para a rota `POST /api/worklogs`.
   - Adaptação do backend e do `analyzeFormWithGemini` para enviar ao Gemini os blocos ordenados de texto e imagem.
6. **Prevenção de comportamento padrão:**
   - Bloquear a abertura de arquivos em nova aba pelo navegador durante `dragover` e `drop`.
   - Feedback instantâneo via `URL.createObjectURL` com thumbnail e estado de processamento se aplicável.

### Não-Metas (Non-Goals)
- Não alterar os outros campos do formulário (Título, Solicitante, Escritório, Tags).
- Não alterar a rotina de gravação de vídeo nem o player de gravação de tela.
- Não alterar neste momento a pré-visualização expandida de mídias fora do formulário, a formatação do PDF final ou o modal de relatório maximizado (serão tratados nos tópicos subsequentes).

### Anti-Metas (Anti-Goals)
- NUNCA salvar arquivos ou gravações na pasta `public/` (regra permanente de privacidade do projeto).
- NUNCA quebrar o envio padrão de formulários sem mídia inline (compatibilidade retroativa com atendimentos de texto puro).
- NUNCA perder o texto já digitado ao soltar um arquivo ou remover um chip.

---

## 4. Arquitetura e Componentes

### 4.1. `InlineMediaEditor.tsx` (`src/components/common/InlineMediaEditor.tsx`)
Componente React que encapsula a área editável:
- **Elemento Raiz:** `div` com `contentEditable="true"`, estilizada com classes do Tailwind idênticas ao design system (bordas `border-slate-200 dark:border-slate-800`, foco `focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400`, fundo `bg-white dark:bg-[#0b0f19]`).
- **Estado de Mídias:** Mapeamento `mediaMap: Map<string, { id: string, file: File, previewUrl: string, name: string }>` compartilhado ou controlado via props.
- **Eventos:**
  - `onDragOver`: Atualiza o cursor visual (Drop Cursor) usando `document.caretRangeFromPoint(e.clientX, e.clientY)` (ou `caretPositionFromPoint` com fallback). Bloqueia o comportamento padrão (`e.preventDefault()`).
  - `onDragLeave`: Remove o indicador visual de Drop Cursor.
  - `onDrop`: Extrai arquivos (`e.dataTransfer.files`) ou o payload de mídia interna (`e.dataTransfer.getData("application/x-hubsupport-media-id")`). Cria o chip inline no Range calculado, anexa o arquivo se for novo e atualiza a sincronização.
  - `onPaste`: Intercepta itens do clipboard. Se houver `image/*`, impede o paste de texto puro/HTML cru, converte o blob em arquivo, gera o chip na seleção atual e anexa à lista.
  - `onKeyDown`: Trata navegação e remoção atômica para Backspace e Delete quando o cursor estiver adjacente a um chip `contenteditable="false"`.
  - `onInput`: Notifica alterações de conteúdo para atualizar o estado do formulário e recalcular o texto/interleaved.

### 4.2. Estrutura do Chip Inline
```html
<span 
  contenteditable="false" 
  data-media-id="med_12345" 
  class="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 select-none align-middle shadow-2xs group"
>
  <img src="blob:..." class="w-4 h-4 rounded object-cover" alt="thumbnail" />
  <span class="max-w-[120px] truncate">screenshot.png</span>
  <button type="button" data-action="remove-chip" class="opacity-60 hover:opacity-100 hover:text-rose-500 transition-opacity">
    <X className="w-3 h-3" />
  </button>
</span>
```

### 4.3. Drop Cursor Indicador
Elemento visual (linha vertical azul/índigo de 2px de espessura com pequena terminação no topo) inserido temporariamente no DOM no Range do cursor durante o arrasto, ou renderizado via coordenadas flutuantes absolutas para máxima fluidez visual.

### 4.4. Integração no `WorkLogForm.tsx`
- Substitui o `<textarea id="reportedProblem">` pelo `<InlineMediaEditor />`.
- Os itens da lista de anexos no rodapé tornam-se arrastáveis (`draggable={true}`) com `onDragStart` definindo `application/x-hubsupport-media-id`.
- Cada item na lista de anexos exibe uma tag sutil `"No texto"` quando seu ID estiver presente nos chips do editor.
- Ao submeter o formulário:
  - Gera `reportedProblem` em texto limpo (com nomes de referências como fallback para compatibilidade).
  - Gera `descriptionInterleaved` em JSON e adiciona ao `FormData`.

### 4.5. Persistência no Banco de Dados (`prisma/schema.prisma`)
- Adição do campo opcional no modelo `WorkLog`:
  ```prisma
  descriptionInterleaved String? @db.Text // JSON estruturado alternando blocos de texto e referências de mídia
  ```
- Isso garante que reprocessamento de IA (`retry-ai`), histórico de atendimentos e rotas de consulta mantenham a ordem exata das frases e mídias sem perda de dados após reiniciar o servidor ou em caso de falha transitória da IA.

### 4.6. Backend (`worklogs.routes.ts`) e Gemini (`gemini.ts`)
- A rota `POST /api/worklogs` lê o campo `descriptionInterleaved` (se presente) e o persiste no `WorkLog.descriptionInterleaved`.
- **Suporte Multimodal no Gemini:**
  - Em `analyzeFormWithGemini`: monta a lista de partes do Gemini alternando objetos `{ text: block.content }` e `{ inlineData: { mimeType, data: base64 } }` na ordem exata da narrativa.
  - **Mídias complementares:** Anexos da lista geral que não foram inseridos inline no texto são anexados ao final do prompt do Gemini sob a seção *"Mídias Complementares em Anexo"*, garantindo que nenhuma evidência enviada pelo operador seja descartada na análise da IA.
  - Para arquivos não suportados diretamente em binário pela API do Gemini (ex: `.xlsx`, `.docx`), o parser converte o bloco inline em texto contextual descritivo `[Arquivo anexado: documento.xlsx]` para evitar erros 400 da API da Google.
  - Em `analyzeRecordingWithGemini` (fluxo com gravação de tela): havendo gravação E imagens inline na descrição, o Gemini recebe o vídeo na Files API e as partes de texto e imagens no prompt multimodal combinado.

---

## 5. Decisões Consolidadas
1. **Mídias complementares:** Arquivos anexados que não foram inseridos no fluxo do texto são incluídos ao final do prompt da IA como evidências complementares.
2. **Persistência durável:** O campo `descriptionInterleaved` será salvo na tabela `WorkLog`, garantindo suporte nativo a retries e visualizações futuras.
3. **Suporte de tipos no editor:** Imagens exibem thumbnail em miniatura. Caso o usuário arraste um PDF, vídeo ou documento para o texto, o chip exibirá ícone representativo e nome. No payload da IA, imagens e PDFs são convertidos em dados binários (`inlineData`); documentos como planilhas entram como marcadores textuais descritivos.
4. **Multimodalidade híbrida com gravação de tela:** Quando houver gravação de tela (`recordedVideo`) combinada com imagens inline na descrição, ambas as evidências (vídeo e imagens da descrição) serão fornecidas ao modelo Gemini.


