export interface StructuredReportDataForFormat {
  title?: string | null;
  subtitle?: string | null;
  date?: string | null;
  department?: string | null;
  participants?: string | null;
  platformAnalyzed?: string | null;
  executiveSummary?: string | null;
  proposals?: Array<{
    item: string;
    description: string;
    category?: string;
    priority?: string;
  }> | null;
  detailingTopic?: string | null;
  detailingParagraphs?: string[] | null;
  referrals?: string | null;
  transcript?: Array<{
    speaker?: string;
    role?: string;
    timestamp?: string;
    text: string;
  }> | null;
}

export interface FallbackReportContext {
  title?: string | null;
  requester?: string | null;
  clientOrOffice?: string | null;
  reportedProblem?: string | null;
  actionTaken?: string | null;
  status?: string | null;
  createdAt?: Date | string | null;
}

/**
 * Converte os dados estruturados de um relatório de IA (ou fallback de atendimento)
 * em um texto limpo, elegante e padronizado para cópia e compartilhamento.
 */
export function formatReportAsText(
  structured?: StructuredReportDataForFormat | null,
  context?: FallbackReportContext | null
): string {
  const sections: string[] = [];

  const mainTitle = (structured?.title || context?.title || "Relatório de Atendimento Técnico").trim();
  sections.push(`📋 ${mainTitle.toUpperCase()}`);

  if (structured?.subtitle) {
    sections.push(`Subtítulo: ${structured.subtitle.trim()}`);
  }

  const meta: string[] = [];
  const dateStr =
    structured?.date ||
    (context?.createdAt
      ? typeof context.createdAt === "string"
        ? context.createdAt.slice(0, 10)
        : new Date(context.createdAt).toLocaleDateString("pt-BR")
      : "");
  if (dateStr) meta.push(`• Data: ${dateStr}`);

  const dept = structured?.department || context?.clientOrOffice;
  if (dept) meta.push(`• Departamento / Cliente: ${dept}`);

  const participants = structured?.participants || (context?.requester ? `${context.requester} (Solicitante)` : "");
  if (participants) meta.push(`• Participantes: ${participants}`);

  if (structured?.platformAnalyzed) {
    meta.push(`• Plataforma / Sistema: ${structured.platformAnalyzed}`);
  }
  if (context?.status) {
    meta.push(`• Status do Atendimento: ${context.status}`);
  }

  if (meta.length > 0) {
    sections.push(`📌 INFORMAÇÕES GERAIS\n${meta.join("\n")}`);
  }

  const summary = (
    structured?.executiveSummary ||
    (structured as any)?.summary ||
    context?.reportedProblem ||
    ""
  ).trim();
  if (summary) {
    sections.push(`📝 RESUMO EXECUTIVO\n${summary}`);
  }

  if (context?.actionTaken && (!structured?.proposals || structured.proposals.length === 0)) {
    sections.push(`⚡ AÇÃO REALIZADA\n${context.actionTaken.trim()}`);
  }

  if (Array.isArray(structured?.proposals) && structured.proposals.length > 0) {
    const propLines = structured.proposals.map((p, idx) => {
      const priorityTag = p.priority ? `[${p.priority}] ` : "";
      let itemStr = `${idx + 1}. ${priorityTag}${p.item}`;
      if (p.description) itemStr += `\n   Descrição: ${p.description}`;
      if (p.category) itemStr += `\n   Categoria: ${p.category}`;
      return itemStr;
    });
    sections.push(`💡 PROPOSTAS E SUGESTÕES\n${propLines.join("\n\n")}`);
  }

  const detailingParagraphs = structured?.detailingParagraphs || [];
  if (structured?.detailingTopic || detailingParagraphs.length > 0) {
    const topicHeader = structured?.detailingTopic ? `: ${structured.detailingTopic}` : "";
    const paras = detailingParagraphs.join("\n\n");
    sections.push(`🔍 DETALHAMENTO TÉCNICO${topicHeader}\n${paras}`);
  }

  if (structured?.referrals) {
    sections.push(`🎯 ENCAMINHAMENTOS\n${structured.referrals.trim()}`);
  }

  if (Array.isArray(structured?.transcript) && structured.transcript.length > 0) {
    const transcriptLines = structured.transcript.map((t) => {
      const timeTag = t.timestamp ? `[${t.timestamp}] ` : "";
      const roleTag = t.role ? ` (${t.role})` : "";
      return `${timeTag}${t.speaker || "Participante"}${roleTag}: ${t.text}`;
    });
    sections.push(`🎙️ TRANSCRIÇÃO / REGISTRO DE DIÁLOGO\n${transcriptLines.join("\n")}`);
  }

  sections.push("--------------------------------------------------\nGerado via HubSupport");

  return sections.join("\n\n").trim();
}

/**
 * Utilitário seguro para copiar texto para a área de transferência com fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continua para o fallback de textarea
    }
  }

  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}
