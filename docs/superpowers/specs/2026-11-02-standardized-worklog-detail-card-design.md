# Especificação de Design — Padronização da Apresentação de Cards Maximizados

**Data:** 02/11/2026  
**Status:** Aprovado  
**Autor:** Antigravity / Pair Programming  

---

## 1. Visão Geral e Objetivo
Atualmente, existe uma disparidade visual e funcional entre a exibição de atendimentos maximizados na tela de atendimentos (`DashboardClient.tsx` e `TechnicianDashboardClient.tsx`) e a exibição detalhada no Kanban (`ReportDetailsModal.tsx`).
No Kanban, a apresentação é muito mais moderna, estruturada e aderente ao projeto, destacando:
1. **Cabeçalho com metadados unificados:** Título, status pill, tag de plataforma, marcadores de *Ação Técnica* e *Implementação*, e linha de metadados compacta (*Cliente • Solicitante • Data • Plataforma*).
2. **Grid em 2 colunas lado a lado:** Descrição do Atendimento e Solução / Ação Realizada.
3. **Seção Rica de Relatório de IA:** Exibição do título estruturado, subtítulo, botões de ação integrados (*Mídias*, *Vídeo*, *Visualizar PDF*), **Resumo Executivo** e lista de **Propostas & Melhorias Identificadas** com tags de prioridade (*Alta, Média, Baixa*), além de detalhamento técnico.
4. **Resiliência para Atendimentos sem IA:** Banner inteligente sob demanda com o botão `[✨ Gerar Relatório com IA]` para chamados manuais que ainda não possuem análise, e estados de progresso (*pending* / *processing*).

O objetivo é definir essa estrutura do Kanban como **padrão universal do projeto**, aplicando-a ao card maximizado da tela de atendimentos sem alterar seu posicionamento na tela (mantendo-o na coluna da direita).

---

## 2. Arquitetura do Componente Reutilizável

Para evitar duplicação de código e garantir 100% de paridade entre todas as telas, criaremos o componente compartilhado:
`src/components/dashboard/WorkLogDetailContent.tsx`

### Props do Componente:
```typescript
interface WorkLogDetailContentProps {
  log: WorkLogItem;
  onRefresh?: () => void;
  footerActions?: React.ReactNode;
  onOpenPdfModal?: (logId: string) => void;
  onOpenMediaModal?: (log: WorkLogItem) => void;
}
```

### Seções Internas:
1. **Header do Chamado:**
   - Ícone de status no canto esquerdo (`CheckCircle2` verde se solucionado, `FileText` caso contrário).
   - Título em destaque (`log.title || log.clientOrOffice`).
   - Badges de status (`getStatusPill`), plataforma (`TagBadge`), `Ação Técnica` e `Implementação`.
   - Linha de metadados: `Cliente` • `Solicitante` • `Registrado em` • `Plataforma`.
2. **Grid de Descrição & Solução:**
   - 2 colunas responsivas (`grid-cols-1 md:grid-cols-2 gap-3.5`).
   - Coluna 1: `DESCRIÇÃO DO ATENDIMENTO` com texto formatado.
   - Coluna 2: `SOLUÇÃO / AÇÃO REALIZADA` com ícone verde `CheckCircle2`. Se não houver ação registrada, a coluna 1 ocupa a largura total.
3. **Seção de Relatório de IA Integrada:**
   - Se possuir relatório gerado (`structuredData`):
     - Cabeçalho com ícone `Sparkles`, título técnico formal da IA e subtítulo.
     - Botões de ação no canto superior direito:
       - `Vídeo` (se possuir gravação).
       - `Mídias (N)` (se houver anexos).
       - `Visualizar PDF` (botão escuro destacado com ícone `Eye`).
     - Divisória sutil.
     - Bloco `RESUMO EXECUTIVO`.
     - Bloco `PROPOSTAS & MELHORIAS IDENTIFICADAS` com cards individuais e badges de prioridade coloridos.
     - Bloco `Detalhamento Técnico` (se aplicável).
   - Se o relatório estiver em processamento/pendente:
     - Barra de progresso animada com indicador de status e polling ativo.
   - Se o relatório ainda não existir:
     - Banner convidativo com botão `[✨ Gerar Relatório com IA]` sob demanda.
4. **Slot de Ações do Rodapé (`footerActions`):**
   - Permite que a tela do técnico inclua o botão `Marcar como Solucionado` de forma desacoplada e consistente.

---

## 3. Visualização de PDF e Mídias
- Ao clicar em **Visualizar PDF**, um visualizador em modal moderno (ou a tela integrada com download/exportar e voltar) é acionado para exibir o PDF gerado diretamente na interface.
- Ao clicar em **Mídias**, o carrossel interativo exibe imagens e arquivos anexados com suporte a atalhos de teclado e miniaturas.

---

## 4. Requisitos de UI / CloudNexus Design System
- Fundo neutro com bordas sutis (`bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800`).
- Badges de prioridade:
  - Alta: `bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800`
  - Média: `bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800`
  - Baixa: `bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800`
- Tipografia: tamanhos padronizados com hierarquia clara (`text-base sm:text-lg font-bold`, rótulos `uppercase tracking-wider text-[10px]` ou `text-xs font-semibold`).

