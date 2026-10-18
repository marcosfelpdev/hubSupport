import { GoogleGenAI, createPartFromUri } from "@google/genai";
import fs from "fs/promises";
import path from "path";

export interface ProposalItem {
  item: string;
  description: string;
  category: string;
  priority: string;
}

export interface DialogueLine {
  speaker: string;
  role: string;
  timestamp: string; // Ex: "00:38"
  text: string;
}

export interface StructuredReportData {
  title: string;
  subtitle: string;
  date?: string;
  department: string;
  participants: string;
  platformAnalyzed: string;
  executiveSummary: string;
  proposals: ProposalItem[];
  detailingTopic: string;
  detailingParagraphs: string[];
  referrals: string;
  transcript: DialogueLine[];
}

export interface WorkLogContext {
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  authorName: string;
  createdAt: Date | string;
}

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Título formal do relatório. Exemplo: 'Relatório de Sugestões de Melhoria no Sistema' ou 'Relatório de Atendimento Técnico e Diagnóstico'",
    },
    subtitle: {
      type: "string",
      description: "Subtítulo objetivo resumindo a demanda. Exemplo: 'Solicitação de Exportação de Dados em Lote para Planilhamento'",
    },
    date: {
      type: "string",
      description: "Data do atendimento no formato DD/MM/AAAA",
    },
    department: {
      type: "string",
      description: "Departamento e/ou Cliente/Escritório envolvido. Exemplo: 'Cível Processual | IEP Advogados'",
    },
    participants: {
      type: "string",
      description: "Participantes identificados com seus respectivos papéis. Exemplo: 'Raynara (Operação), Marcos (Suporte)'",
    },
    platformAnalyzed: {
      type: "string",
      description: "Nome da plataforma, software ou módulo analisado durante a gravação",
    },
    executiveSummary: {
      type: "string",
      description: "Resumo executivo formal em um parágrafo claro sobre o que foi tratado na reunião/atendimento",
    },
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: {
            type: "string",
            description: "Nome do item ou funcionalidade numerado. Exemplo: '1. Exportação de Dados em Lote (PDF/Excel)'",
          },
          description: {
            type: "string",
            description: "Descrição clara e técnica da funcionalidade solicitada ou proposta",
          },
          category: {
            type: "string",
            description: "Categoria da melhoria/ação em caixa alta. Exemplo: 'UX / EXPORTAÇÃO', 'BUG / CORREÇÃO', 'INTEGRAÇÃO', 'RELATÓRIOS'",
          },
          priority: {
            type: "string",
            description: "Prioridade atribuída: 'Alta', 'Média' ou 'Baixa'",
          },
        },
        required: ["item", "description", "category", "priority"],
      },
      description: "Lista de propostas de melhoria de fluxo de trabalho ou itens técnicos levantados",
    },
    detailingTopic: {
      type: "string",
      description: "Subtítulo do detalhamento. Exemplo: 'Necessidade Operacional de Planilhamento' ou 'Diagnóstico e Justificativa da Falha'",
    },
    detailingParagraphs: {
      type: "array",
      items: { type: "string" },
      description: "Parágrafos detalhados explicando o contexto operacional, o problema enfrentado na prática e a justificativa da solução",
    },
    referrals: {
      type: "string",
      description: "Encaminhamentos da reunião: o que o suporte técnico avaliou, confirmou, combinou e repassou (ex: repassar à equipe de desenvolvimento / Dev)",
    },
    transcript: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speaker: {
            type: "string",
            description: "Nome do interlocutor. Ex: 'Raynara' ou 'Marcos'",
          },
          role: {
            type: "string",
            description: "Papel do interlocutor. Ex: 'Cível Processual' ou 'Suporte'",
          },
          timestamp: {
            type: "string",
            description: "Marcação temporal no formato MM:SS. Exemplo: '00:38', '01:24'",
          },
          text: {
            type: "string",
            description: "Transcrição literal da fala do interlocutor",
          },
        },
        required: ["speaker", "role", "timestamp", "text"],
      },
      description: "Transcrição cronológica integral das falas do áudio da reunião/atendimento",
    },
  },
  required: [
    "title",
    "subtitle",
    "department",
    "participants",
    "platformAnalyzed",
    "executiveSummary",
    "proposals",
    "detailingTopic",
    "detailingParagraphs",
    "referrals",
    "transcript",
  ],
};

/**
 * Modelos candidatos suportados pelo Google Gemini com suporte multimodal (vídeo).
 * gemini-3.8-flash é a versão mais moderna recomendada pela API do Gemini.
 */
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL?.trim(),
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
].filter((m): m is string => Boolean(m && m.length > 0));

export async function analyzeRecordingWithGemini(
  videoFilePath: string,
  context: WorkLogContext
): Promise<StructuredReportData> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "A chave GEMINI_API_KEY não está configurada no ambiente. Configure-a no arquivo .env."
    );
  }

  // 1. Validação de existência e integridade do arquivo local
  let stats;
  try {
    stats = await fs.stat(videoFilePath);
  } catch {
    throw new Error(`Arquivo de vídeo não encontrado no caminho: ${videoFilePath}`);
  }

  if (stats.size === 0) {
    throw new Error("O arquivo de gravação de tela está vazio (0 bytes).");
  }

  // 2. Validação do formato e MIME type real do arquivo
  const ext = path.extname(videoFilePath).toLowerCase();
  if (ext !== ".webm" && ext !== ".mp4") {
    throw new Error(`Formato de gravação não suportado: "${ext}". São aceitos apenas vídeos .webm ou .mp4.`);
  }
  const mimeType = ext === ".mp4" ? "video/mp4" : "video/webm";

  // 3. Sanitização dos dados do contexto do atendimento
  const safeContext = {
    requester: context.requester?.trim() || "Não informado",
    clientOrOffice: context.clientOrOffice?.trim() || "Não informado",
    reportedProblem: context.reportedProblem?.trim() || "Não informado",
    actionTaken: context.actionTaken?.trim() || "Não informado",
    status: context.status?.trim() || "Pendente",
    technicalAction: !!context.technicalAction,
    implementation: !!context.implementation,
    authorName: context.authorName?.trim() || "Técnico do suporte",
    createdAt: context.createdAt
      ? new Date(context.createdAt).toLocaleString("pt-BR")
      : "Data não informada",
  };

  const ai = new GoogleGenAI({ apiKey });

  // 4. Upload do vídeo para a Files API do Gemini
  console.log(`[Gemini] Iniciando upload do vídeo: ${path.basename(videoFilePath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  
  const uploadResult = await ai.files.upload({
    file: videoFilePath,
    config: {
      mimeType,
    },
  });

  const remoteFileName = uploadResult.name;
  if (!remoteFileName) {
    throw new Error("A API do Gemini não retornou o identificador do arquivo enviado.");
  }

  console.log(`[Gemini] Vídeo enviado com sucesso. Identificador remoto: ${remoteFileName}`);

  // 5. Aguarda o arquivo ficar no estado ACTIVE na infraestrutura do Google
  let fileInfo = await ai.files.get({ name: remoteFileName });
  let attempts = 0;
  const maxAttempts = 30; // Até 60 segundos aguardando processamento

  while (fileInfo.state === "PROCESSING" && attempts < maxAttempts) {
    console.log(`[Gemini] Processando vídeo na nuvem... tentativa ${attempts + 1}/${maxAttempts}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    fileInfo = await ai.files.get({ name: remoteFileName });
    attempts++;
  }

  if (fileInfo.state === "FAILED") {
    try {
      await ai.files.delete({ name: remoteFileName });
    } catch {
      // ignore cleanup error
    }
    throw new Error("O processamento do vídeo falhou na API do Google Gemini.");
  }

  if (fileInfo.state !== "ACTIVE") {
    try {
      await ai.files.delete({ name: remoteFileName });
    } catch {
      // ignore cleanup error
    }
    throw new Error("Tempo limite excedido aguardando a ativação do vídeo na nuvem.");
  }

  const fileUri = fileInfo.uri || uploadResult.uri;
  if (!fileUri) {
    try {
      await ai.files.delete({ name: remoteFileName });
    } catch {
      // ignore cleanup error
    }
    throw new Error("URI do arquivo não foi disponibilizada pela API do Gemini.");
  }

  try {
    // 6. Construção da Parte de Mídia (fileData com fileUri e mimeType)
    // Usamos createPartFromUri da SDK oficial do Gemini para garantir que
    // a oneof 'data' no Protobuf da requisição seja preenchida corretamente com 'fileData'.
    const videoPart = createPartFromUri(fileUri, mimeType);

    // 7. Montagem do prompt com instruções e dados do formulário
    const prompt = `
Você é um assistente sênior especialista em suporte técnico corporativo e documentação executiva de atendimentos e reuniões.
Analise detalhadamente a gravação de tela em anexo (áudio com as falas e vídeo com as interações de tela) juntamente com as informações do formulário de atendimento fornecido abaixo.

Gere um relatório executivo técnico e formal, estritamente no formato JSON definido, seguindo o padrão padrão de relatório corporativo da empresa:

### Informações do Atendimento:
- Solicitante: ${safeContext.requester}
- Escritório / Cliente: ${safeContext.clientOrOffice}
- Problema Relatado: ${safeContext.reportedProblem}
- Ação Realizada: ${safeContext.actionTaken}
- Status Atual: ${safeContext.status}
- Classificação: ${safeContext.technicalAction ? "Ação Técnica (Dev)" : ""} ${safeContext.implementation ? "Implementação/Sugestão de Melhoria" : ""}
- Registrado por: ${safeContext.authorName}
- Data de Registro: ${safeContext.createdAt}

### Regras de Extração e Estruturação:
1. **Título e Subtítulo**:
   - Defina um título formal adequado. Ex: "Relatório de Sugestões de Melhoria no Sistema" ou "Relatório de Atendimento Técnico e Diagnóstico".
   - Defina um subtítulo conciso e descritivo da necessidade levantada. Ex: "Solicitação de Exportação de Dados em Lote para Planilhamento".
2. **Metadados (Data, Departamento, Participantes, Plataforma)**:
   - Data no formato DD/MM/AAAA.
   - Departamento: inclua o setor e escritório/cliente, ex: "Cível Processual | ${safeContext.clientOrOffice}".
   - Participantes: liste cada pessoa identificada com seu papel entre parênteses, ex: "${safeContext.requester} (Operação), ${safeContext.authorName} (Suporte)".
   - Plataforma Analisada: identifique o nome do sistema ou software demonstrado no vídeo (ex: ERP Jurídico, Módulo de Protocolos, Sistema Web).
3. **Resumo Executivo**:
   - Um parágrafo formal e objetivo formalizando o que foi demandado ou analisado durante o atendimento e qual o objetivo para a operação.
4. **Propostas de Melhoria de Fluxo de Trabalho (Tabela)**:
   - Para cada funcionalidade ou melhoria discutida, gere um item com:
     - item: nome numerado (ex: "1. Exportação de Dados em Lote (PDF/Excel)")
     - description: descrição clara e precisa do que a funcionalidade deve fazer
     - category: categoria em letras maiúsculas (ex: "UX / EXPORTAÇÃO", "INTEGRAÇÃO", "BANCO DE DADOS", "BUG / CORREÇÃO")
     - priority: prioridade ("Alta", "Média" ou "Baixa")
5. **Detalhamento e Justificativa da Sugestão**:
   - detailingTopic: um subtítulo adequado (ex: "Necessidade Operacional de Planilhamento").
   - detailingParagraphs: parágrafos que expliquem a rotina da equipe, o volume de dados demonstrado em tela (ex: número de protocolos/processos), as limitações da interface atual e como a solução eliminará trabalho manual e erros.
6. **Encaminhamentos da Reunião**:
   - Descreva a conclusão prática da interação, o que o suporte técnico avaliou na tela, a confirmação de que a demanda será documentada e os próximos passos com a equipe técnica/desenvolvimento.
7. **Transcrição Integral do Áudio da Reunião**:
   - Transcreva cronologicamente o diálogo com timestamps precisos no formato [MM:SS].
   - Identifique quem está falando e seu papel (ex: speaker: "${safeContext.requester}", role: "Cível Processual", timestamp: "00:38", text: "...").
   - Inclua as falas do suporte técnico e do usuário com fidelidade ao áudio gravado.
`;

    // 8. Envio da requisição com mecanismo resiliente de tentativa e modelos candidatos
    let lastError: unknown;
    let responseText: string | undefined;

    for (const model of CANDIDATE_MODELS) {
      console.log(`[Gemini] Tentando gerar relatório estruturado com o modelo: ${model}...`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [videoPart, prompt],
            config: {
              responseMimeType: "application/json",
              responseSchema: REPORT_SCHEMA,
              temperature: 0.2, // Baixa temperatura para precisão e aderência factual
            },
          });

          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const isRateLimitOrDemand =
            errMsg.includes("503") ||
            errMsg.includes("429") ||
            errMsg.includes("high demand") ||
            errMsg.includes("quota") ||
            errMsg.includes("RESOURCE_EXHAUSTED");

          console.warn(`[Gemini] Falha na tentativa ${attempt} com modelo ${model}: ${errMsg}`);

          if (isRateLimitOrDemand && attempt < 3) {
            const backoffMs = attempt * 2000;
            console.log(`[Gemini] Aguardando ${backoffMs}ms antes da próxima tentativa...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          break; // Passa para o próximo modelo candidato se houver
        }
      }

      if (responseText) {
        break;
      }
    }

    if (!responseText) {
      throw lastError || new Error("Não foi possível obter resposta dos modelos do Google Gemini.");
    }

    console.log("[Gemini] Resposta estruturada recebida com sucesso!");
    const parsedData = JSON.parse(responseText) as Partial<StructuredReportData>;

    // Formata a data atual em DD/MM/AAAA se não vier
    const todayFormatted = new Date().toLocaleDateString("pt-BR");

    return {
      title: parsedData.title || "Relatório de Sugestões de Melhoria no Sistema",
      subtitle: parsedData.subtitle || `Solicitação referente a ${safeContext.clientOrOffice}`,
      date: parsedData.date || todayFormatted,
      department: parsedData.department || safeContext.clientOrOffice,
      participants: parsedData.participants || `${safeContext.requester} (Operação), ${safeContext.authorName} (Suporte)`,
      platformAnalyzed: parsedData.platformAnalyzed || "Sistema Corporativo",
      executiveSummary: parsedData.executiveSummary || safeContext.reportedProblem,
      proposals: Array.isArray(parsedData.proposals) && parsedData.proposals.length > 0
        ? parsedData.proposals
        : [
            {
              item: "1. Melhoria no Fluxo Operacional",
              description: safeContext.actionTaken || safeContext.reportedProblem,
              category: safeContext.technicalAction ? "AÇÃO TÉCNICA" : "OPERAÇÃO",
              priority: "Alta",
            },
          ],
      detailingTopic: parsedData.detailingTopic || "Detalhamento e Justificativa da Solicitação",
      detailingParagraphs: Array.isArray(parsedData.detailingParagraphs) && parsedData.detailingParagraphs.length > 0
        ? parsedData.detailingParagraphs
        : [safeContext.reportedProblem, safeContext.actionTaken],
      referrals: parsedData.referrals || `Demanda registrada no atendimento pelo suporte (${safeContext.authorName}) e encaminhada para acompanhamento.`,
      transcript: Array.isArray(parsedData.transcript) ? parsedData.transcript : [],
    };
  } finally {
    // 9. Limpeza: remove o arquivo temporário dos servidores do Google
    try {
      console.log(`[Gemini] Removendo arquivo temporário: ${remoteFileName}`);
      await ai.files.delete({ name: remoteFileName });
    } catch (cleanupErr) {
      console.warn("[Gemini] Aviso ao deletar arquivo temporário da Files API:", cleanupErr);
    }
  }
}
