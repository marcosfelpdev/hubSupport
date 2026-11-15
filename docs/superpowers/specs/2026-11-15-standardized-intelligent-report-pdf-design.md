# Design Doc: Padronização Inteligente do Modelo de Relatório em PDF

**Data:** 2026-11-15  
**Autor:** Antigravity  
**Status:** Proposto / Aprovado pelo Usuário  

---

## 1. Contexto & Necessidade

No HubSupport, os relatórios em PDF compilados via PDFKit e Google Gemini seguiam um leiaute tabular clássico simples. Os 3 novos modelos de referência estabelecem um novo padrão corporativo de **Relato de QA e Investigação Técnica**, combinando:
- Identidade visual dinâmica conectada à cor da tag da plataforma.
- Inclusão visual de evidências reais (imagens e prints anexados desenhados no documento com legendas).
- Blocos comparativos de usabilidade (`Comportamento Atual` vs `Comportamento Esperado`).
- Seção técnica para desenvolvedores (quando for ação técnica ou implementação) com hipótese diagnóstica, fluxograma/diagrama lógico de gargalo e blocos de código sugerido.
- Regra de autocrítica na IA para evitar alucinações ou deduções vagas quando o chamado não fornecer contexto suficiente.

---

## 2. Decisões Estruturais e Visuais

### 2.1. Dinâmica de Cores Reativas da Plataforma
A cor de contraste principal do PDF será derivada diretamente da cor da tag selecionada no chamado (`tag.color`, ex: `#f59e0b` para *Trynux Process*, `#10b981` para *Chat Trynux*, `#06b6d4` para *Lab Trynux*, etc.).
- **Barra de destaque vertical** no topo ao lado do título.
- **Pílula de identificação da tag** no topo esquerdo (fundo suave com 12% de opacidade, borda e texto na cor da tag).
- **Rótulo "NATUREZA DO DOCUMENTO"** no card de metadados.
- **Subtítulos de seções de destaque**.

### 2.2. Cabeçalho e Título
- **Tag da Plataforma:** Badge no canto superior esquerdo com nome em caixa alta e cor temática.
- **Data:** Badge em pílula no canto superior direito (`DD/MM/AAAA`).
- **Título Principal:** Texto literal preenchido no campo `title` do formulário (sem nenhuma numeração como "Nota XX").
- **Subtítulo:** Nome do Cliente / Escritório (`clientOrOffice`).

### 2.3. Card de Metadados (4 Quadrantes)
Container arredondado (`rounded-xl` com fundo neutro e borda sutil) contendo:
- **SOLICITANTE:** Nome e setor do solicitante.
- **SUPORTE:** Nome do técnico/atendente responsável.
- **AMBIENTE DA ROTA:** Caminho da rota/interface afetada (ex: `Módulo de Documentos (Listagem)` ou `/casos/notas`).
- **NATUREZA DO DOCUMENTO:**
  - Se `technicalAction === true`: **Relato de QA e Investigação Técnica**
  - Se `implementation === true`: **Especificação de Melhoria e Novas Features**
  - Senão: **Relatório Técnico de Atendimento**

### 2.4. Resumo Executivo
Card com cantos arredondados e fundo `#f8fafc` contendo síntese executiva elaborada pela IA em texto justificado.

### 2.5. Evidências Visuais e Mídias no PDF
O motor baixa os buffers reais das imagens do storage R2/local e as desenha no documento via PDFKit:
- **Mídias Inline:** Inseridas no fluxo da narrativa logo abaixo do parágrafo a que se referem (ou em duas colunas texto/imagem quando a imagem for vertical).
- **Mídias Complementares:** Dispostas em grade elegante (2 por linha) com cantos arredondados, borda sutil e faixa escura inferior com a legenda gerada pela IA (ex: *"1. Estado com 2 documentos selecionados"*).

### 2.6. Análise de Comportamento (Cards Comparativos Lado a Lado)
Dois cards com bordas coloridas dispostos lado a lado:
- **Card Vermelho (`× Comportamento Atual` / Anomalia):** Borda e título vermelhos (`#ef4444`), descrevendo o problema ocorrido.
- **Card Verde (`✓ Comportamento Esperado`):** Borda e título verdes (`#10b981`), descrevendo o comportamento ideal.
- **Diretriz de Autocrítica da IA:** A IA pode deduzir o comportamento esperado se este não estiver explícito no texto; porém, se a dedução for considerada vaga ou carente de contexto suficiente, a IA omite o campo para evitar suposições sem base.

### 2.7. Seção Técnica de Investigação (Somente se Ação Técnica ou Implementação)
- **Aviso de Contexto Investigativo:** Banner superior com borda esquerda âmbar (`#f59e0b`), fundo `#fffbeb`, alertando que as hipóteses servem para guiar a equipe técnica e agentes de IA.
- **Hipótese Diagnóstica / Análise de DOM e Estado:** Parágrafos explicando a divergência técnica (ex: desconexão de estado, omissão de IDs, manipulação incorreta de histórico).
- **Diagrama Lógico de Gargalo (Caixa Visual):** Quadro ilustrando a divergência entre estado e evento (ex: `ESTADO GLOBAL [IDs] ≠ EVENTO ON_DRAG [Payload]`).
- **Sugestão de Código (Code Snippet):** Caixa com fundo escuro (`#0f172a`), cantos arredondados, cabeçalho de linguagem e código com tipografia monospace sugerindo a solução técnica. Omitido se não houver base sólida.
- **Diretrizes para Investigação:** Lista de itens para auditoria pelo time técnico.

### 2.8. Rodapé Institucional em Todas as Páginas
- Linha divisória fina (`#e2e8f0`).
- `Relatório Técnico de Suporte - [Plataforma] ([Cliente])` à esquerda.
- `Página X de Y` à direita.

---

## 3. Arquitetura do Schema de IA (`REPORT_SCHEMA`)

O esquema estruturado do Gemini em `src/lib/gemini.ts` será atualizado com os novos campos estritos:
```typescript
{
  title: string,
  clientOrOffice: string,
  routeEnvironment: string,
  documentNature: string,
  executiveSummary: string,
  currentBehavior?: string,
  expectedBehavior?: string,
  evidenceCaptions?: Array<{ filename: string, caption: string }>,
  isTechnicalReport: boolean,
  investigativeNotice?: string,
  diagnosticHypothesis?: {
    topic: string,
    paragraphs: string[]
  },
  logicalDiagram?: {
    title: string,
    leftBoxTitle: string,
    leftBoxContent: string,
    operator: string, // ex: "≠" ou "--✕-->"
    rightBoxTitle: string,
    rightBoxContent: string
  },
  codeSuggestion?: {
    language: string,
    title: string,
    code: string,
    explanation: string
  },
  investigationGuidelines?: string[],
  transcript?: Array<{ speaker: string, role?: string, timestamp: string, text: string }>
}
```

---

## 4. O que fica a cargo do Desenvolvedor (Builder)
- Cálculo exato de quebra de página de imagens no PDFKit para não sobrepor o rodapé (`PAGE_BOTTOM_LIMIT = 740`).
- Conversão segura de cor hexadecimal para RGB no PDFKit.
- Suporte a imagens em formatos `.png`, `.jpg`, `.jpeg`, `.webp`.
