import { GoogleGenAI, createPartFromUri } from "@google/genai";
import fs from "fs/promises";
import path from "path";
import { getFileBuffer } from "../server/services/r2Storage";
import { InterleavedBlock } from "./inline-media-parser";

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
  subtitle?: string;
  date?: string;
  department: string;
  participants: string;
  platformAnalyzed: string;
  routeEnvironment?: string; // e.g. "Módulo de Documentos (Listagem)" or "casos/[codigo]/documentos"
  documentNature?: string; // e.g. "Relato de QA e Investigação Técnica", "Especificação de Melhoria e Novas Features", "Relatório Técnico de Atendimento"
  executiveSummary: string;
  currentBehavior?: string; // Comportamento Atual (Anomalia)
  expectedBehavior?: string; // Comportamento Esperado
  evidenceCaptions?: Array<{ filename: string; caption: string }>; // Legendas explicativas para as imagens
  isTechnicalReport?: boolean;
  investigativeNotice?: string; // "AVISO DE CONTEXTO INVESTIGATIVO..."
  diagnosticHypothesis?: {
    topic: string;
    paragraphs: string[];
  };
  logicalDiagram?: {
    title: string;
    leftBoxTitle: string;
    leftBoxContent: string;
    operator: string; // e.g. "≠" or "--✕-->"
    rightBoxTitle: string;
    rightBoxContent: string;
  };
  codeSuggestion?: {
    language: string;
    title: string;
    code: string;
    explanation?: string;
  };
  investigationGuidelines?: string[];
  proposals?: ProposalItem[];
  detailingTopic?: string;
  detailingParagraphs?: string[];
  referrals?: string;
  transcript?: DialogueLine[];
}

export interface WorkLogContext {
  title?: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken?: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  platform?: string;
  authorName: string;
  createdAt: Date | string;
  descriptionInterleaved?: string | null;
  tagColor?: string;
}

export const REPORT_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Título formal do relatório. Deve ser o texto exato do título fornecido no contexto sem numeração 'Nota XX'.",
    },
    subtitle: {
      type: "string",
      description: "Subtítulo objetivo resumindo a demanda ou identificando o cliente/escritório.",
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
      description: "Nome da plataforma, software ou módulo analisado durante o atendimento",
    },
    routeEnvironment: {
      type: "string",
      description: "Módulo, tela ou rota da URL onde a situação ocorre. Exemplo: 'Módulo de Documentos (Listagem)' ou '/casos/[codigo]/documentos'",
    },
    documentNature: {
      type: "string",
      description: "Natureza documental do relatório: 'Relato de QA e Investigação Técnica' (se Ação Técnica), 'Especificação de Melhoria e Novas Features' (se Implementação) ou 'Relatório Técnico de Atendimento' (caso padrão)",
    },
    executiveSummary: {
      type: "string",
      description: "Resumo executivo formal em um parágrafo claro sobre o que foi tratado na reunião ou chamado",
    },
    currentBehavior: {
      type: "string",
      description: "Descrição da anomalia, erro ou comportamento atual observado na prática",
    },
    expectedBehavior: {
      type: "string",
      description: "Descrição do comportamento esperado ideal do sistema. Se a dedução for vaga ou sem base sólida, omita este campo.",
    },
    evidenceCaptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Nome do arquivo ou identificador da imagem/print analisado",
          },
          caption: {
            type: "string",
            description: "Legenda descritiva curta e clara da evidência. Exemplo: '1. Estado com 2 documentos selecionados'",
          },
        },
        required: ["filename", "caption"],
      },
      description: "Legendas explicativas para cada print ou imagem anexada como evidência",
    },
    isTechnicalReport: {
      type: "boolean",
      description: "Indica se o relatório possui caráter técnico investigativo (Ação Técnica ou Implementação)",
    },
    investigativeNotice: {
      type: "string",
      description: "Aviso de contexto investigativo para orientar equipe de desenvolvimento e agentes de IA",
    },
    diagnosticHypothesis: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Tópico central da hipótese diagnóstica. Exemplo: 'Divergência entre Estado Global e Mutação de UI'",
        },
        paragraphs: {
          type: "array",
          items: { type: "string" },
          description: "Parágrafos detalhando a análise de causa raiz lógica, estado, DOM ou APIs",
        },
      },
      required: ["topic", "paragraphs"],
      description: "Hipótese diagnóstica e análise técnica da provável causa raiz",
    },
    logicalDiagram: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título do quadro comparativo lógico. Exemplo: 'Mapeamento do Gargalo Lógico'",
        },
        leftBoxTitle: {
          type: "string",
          description: "Título da caixa da esquerda. Exemplo: 'ESTADO GLOBAL [IDs]'",
        },
        leftBoxContent: {
          type: "string",
          description: "Conteúdo descritivo da caixa da esquerda",
        },
        operator: {
          type: "string",
          description: "Operador lógico ou símbolo comparativo de divergência (ex: '≠' ou '--✕-->')",
        },
        rightBoxTitle: {
          type: "string",
          description: "Título da caixa da direita. Exemplo: 'EVENTO ON_DRAG [Payload]'",
        },
        rightBoxContent: {
          type: "string",
          description: "Conteúdo descritivo da caixa da direita",
        },
      },
      required: [
        "title",
        "leftBoxTitle",
        "leftBoxContent",
        "operator",
        "rightBoxTitle",
        "rightBoxContent",
      ],
      description: "Quadro comparativo lógico resumindo o gargalo ou divergência",
    },
    codeSuggestion: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Linguagem de programação da sugestão técnica (ex: 'typescript', 'javascript', 'sql')",
        },
        title: {
          type: "string",
          description: "Título objetivo da implementação sugerida. Exemplo: 'Ajuste de Propagação do Array de IDs'",
        },
        code: {
          type: "string",
          description: "Trecho de código com a lógica de solução proposta",
        },
        explanation: {
          type: "string",
          description: "Explicação técnica sobre a resolução do gargalo",
        },
      },
      required: ["language", "title", "code", "explanation"],
      description: "Sugestão técnica de código com implementação de referência. Omita caso não haja base sólida ou aplicabilidade prática.",
    },
    investigationGuidelines: {
      type: "array",
      items: { type: "string" },
      description: "Itens técnicos objetivos para verificação e auditoria pelos desenvolvedores",
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
    "department",
    "participants",
    "platformAnalyzed",
    "routeEnvironment",
    "documentNature",
    "executiveSummary",
    "isTechnicalReport",
  ],
};


function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as { status?: number; statusCode?: number })?.status ||
                 (err as { status?: number; statusCode?: number })?.statusCode;
  if (status === 429 || status === 503) return true;

  const errMsg = err instanceof Error ? err.message : String(err);
  return (
    errMsg.includes("503") ||
    errMsg.includes("429") ||
    errMsg.includes("high demand") ||
    errMsg.includes("UNAVAILABLE") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.includes("quota") ||
    errMsg.includes("overloaded")
  );
}

export function formatGeminiErrorMessage(err: unknown): string {
  if (!err) return "Não foi possível obter resposta dos servidores de IA.";
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("503") ||
    msg.includes("high demand") ||
    msg.includes("UNAVAILABLE")
  ) {
    return "Os servidores do Google Gemini estão sob alta demanda temporária (Erro 503). Por favor, aguarde alguns instantes e clique em 'Tentar novamente'.";
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
    return "Limite de requisições do Gemini atingido temporariamente (Erro 429). Por favor, tente novamente em alguns instantes.";
  }
  if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("no longer available")) {
    return "O modelo de IA solicitado está indisponível no momento (Erro 404). Por favor, clique em 'Tentar novamente'.";
  }
  if (msg.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        return `Erro na comunicação com o Google Gemini: ${parsed.error.message}`;
      }
    } catch {
      // ignora erro de parse
    }
  }
  return msg;
}

const DEPRECATED_MODEL_PREFIXES = ["gemini-1.5", "gemini-2.0", "gemini-2.5"];

/**
 * Modelos candidatos suportados atualmente na API v1beta do Google Gemini com suporte multimodal.
 * Prioriza gemini-3.5-flash-lite e gemini-flash-lite-latest (baixa latência e alta disponibilidade),
 * seguidos pelos modelos Flash 3.x como fallback resiliente para mitigar erros 503 e 429.
 */
const envModel = process.env.GEMINI_MODEL?.trim();
const validEnvModel =
  envModel && !DEPRECATED_MODEL_PREFIXES.some((prefix) => envModel.startsWith(prefix))
    ? envModel
    : undefined;

const CANDIDATE_MODELS = Array.from(
  new Set(
    [
      validEnvModel,
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3-flash-preview",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-flash-latest",
    ].filter((m): m is string => Boolean(m && m.length > 0))
  )
);

export const SUPPORTED_GEMINI_INLINE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function isSupportedGeminiInlineMimeType(mimeType: string): boolean {
  return SUPPORTED_GEMINI_INLINE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function detectMimeType(filePathOrFilename: string, declaredMimeType?: string): string {
  if (declaredMimeType && declaredMimeType !== "application/octet-stream") {
    const lower = declaredMimeType.toLowerCase();
    if (lower === "image/jpg") return "image/jpeg";
    return lower;
  }
  const ext = path.extname(filePathOrFilename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".doc") return "application/msword";
  if (ext === ".csv") return "text/csv";
  if (ext === ".txt") return "text/plain";
  return declaredMimeType || "application/octet-stream";
}

export interface InterleavedPartText {
  text: string;
}

export interface InterleavedPartInlineData {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export type GeminiPartItem = InterleavedPartText | InterleavedPartInlineData;

export interface BuildInterleavedPartsResult {
  hasInterleaved: boolean;
  interleavedParts: GeminiPartItem[];
  complementaryParts: GeminiPartItem[];
  allParts: GeminiPartItem[];
  inlineImageParts: InterleavedPartInlineData[];
  usedMediaPaths: Set<string>;
}

function normalizeStoragePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function markUsedPath(
  used: Set<string>,
  resolvedPath: string,
  block: InterleavedBlock
) {
  const clean = normalizeStoragePath(resolvedPath);
  used.add(clean);
  used.add(`/${clean}`);
  if (block.storagePath) {
    const cleanStorage = normalizeStoragePath(block.storagePath);
    used.add(cleanStorage);
    used.add(`/${cleanStorage}`);
  }
  if (block.mediaUrl) {
    const cleanUrl = normalizeStoragePath(block.mediaUrl);
    used.add(cleanUrl);
    used.add(`/${cleanUrl}`);
  }
}

function isPathUsed(used: Set<string>, cleanPath: string, rawUrl: string): boolean {
  const clean = normalizeStoragePath(cleanPath);
  return (
    used.has(clean) ||
    used.has(`/${clean}`) ||
    used.has(rawUrl) ||
    used.has(normalizeStoragePath(rawUrl))
  );
}

/**
 * Constrói as partes multimodais do Gemini intercalando texto e imagens na ordem da narrativa,
 * além de incluir mídias complementares que não foram citadas diretamente no corpo do texto.
 */
export async function buildInterleavedGeminiParts(
  descriptionInterleaved: string | null | undefined,
  mediaUrls?: string[]
): Promise<BuildInterleavedPartsResult> {
  const result: BuildInterleavedPartsResult = {
    hasInterleaved: false,
    interleavedParts: [],
    complementaryParts: [],
    allParts: [],
    inlineImageParts: [],
    usedMediaPaths: new Set<string>(),
  };

  if (
    !descriptionInterleaved ||
    typeof descriptionInterleaved !== "string" ||
    !descriptionInterleaved.trim()
  ) {
    return result;
  }

  let blocks: InterleavedBlock[];
  try {
    const parsed = JSON.parse(descriptionInterleaved);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return result;
    }
    blocks = parsed;
  } catch (err) {
    console.warn("[Gemini] Falha ao analisar descriptionInterleaved como JSON:", err);
    return result;
  }

  result.hasInterleaved = true;

  // 1. Processar blocos intercalados na sequência narrativa
  for (const block of blocks) {
    if (!block) continue;

    if (block.type === "text") {
      const content = typeof block.content === "string" ? block.content : "";
      if (content.length > 0) {
        result.interleavedParts.push({ text: content });
      }
    } else if (block.type === "media") {
      // Resolução do caminho da mídia
      let resolvedPath: string | null = null;
      if (block.storagePath && typeof block.storagePath === "string") {
        resolvedPath = normalizeStoragePath(block.storagePath);
      } else if (block.mediaUrl && typeof block.mediaUrl === "string") {
        resolvedPath = normalizeStoragePath(block.mediaUrl);
      } else if (
        typeof block.fileIndex === "number" &&
        mediaUrls &&
        mediaUrls[block.fileIndex]
      ) {
        resolvedPath = normalizeStoragePath(mediaUrls[block.fileIndex]);
      } else if (block.filename && mediaUrls && mediaUrls.length > 0) {
        // Tenta encontrar em mediaUrls
        const found = mediaUrls.find((u) => {
          const norm = normalizeStoragePath(u);
          return (
            norm.endsWith(block.filename!) ||
            path.basename(norm) === block.filename
          );
        });
        if (found) {
          resolvedPath = normalizeStoragePath(found);
        }
      }

      if (!resolvedPath && block.filename) {
        resolvedPath = normalizeStoragePath(block.filename);
      }

      const mime = detectMimeType(
        resolvedPath || block.filename || "",
        block.mimeType
      );

      if (isSupportedGeminiInlineMimeType(mime)) {
        let loaded = false;
        if (resolvedPath) {
          try {
            const buffer = await getFileBuffer(resolvedPath);
            if (buffer && buffer.length > 0) {
              const inlinePart: InterleavedPartInlineData = {
                inlineData: {
                  mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
                  data: buffer.toString("base64"),
                },
              };
              result.interleavedParts.push(inlinePart);
              result.inlineImageParts.push(inlinePart);
              markUsedPath(result.usedMediaPaths, resolvedPath, block);
              console.log(
                `[Gemini] Mídia inline incluída: ${path.basename(
                  resolvedPath
                )} (${(buffer.length / 1024).toFixed(1)} KB)`
              );
              loaded = true;
            }
          } catch (err) {
            console.warn(
              `[Gemini] Aviso: não foi possível carregar mídia inline "${resolvedPath}":`,
              err
            );
          }
        }

        if (!loaded) {
          result.interleavedParts.push({
            text: `\n[Imagem anexada: ${
              block.filename || path.basename(resolvedPath || "imagem")
            }]\n`,
          });
          if (resolvedPath) {
            markUsedPath(result.usedMediaPaths, resolvedPath, block);
          }
        }
      } else {
        // Formato binário não suportado para inlineData (ex: .xlsx, .docx)
        result.interleavedParts.push({
          text: `\n[Arquivo anexado no texto: ${
            block.filename || "documento"
          }]\n`,
        });
        if (resolvedPath) {
          markUsedPath(result.usedMediaPaths, resolvedPath, block);
        }
      }
    }
  }

  // 2. Processar Mídias Complementares (arquivos anexados que não foram inseridos inline)
  if (mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    const complementaryItems: GeminiPartItem[] = [];

    for (const rawUrl of mediaUrls) {
      if (!rawUrl || typeof rawUrl !== "string") continue;
      const cleanPath = normalizeStoragePath(rawUrl);
      if (!cleanPath) continue;

      if (isPathUsed(result.usedMediaPaths, cleanPath, rawUrl)) {
        continue;
      }

      const mime = detectMimeType(cleanPath);
      if (isSupportedGeminiInlineMimeType(mime)) {
        try {
          const buffer = await getFileBuffer(cleanPath);
          if (buffer && buffer.length > 0) {
            complementaryItems.push({
              inlineData: {
                mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
                data: buffer.toString("base64"),
              },
            });
            result.usedMediaPaths.add(cleanPath);
            result.usedMediaPaths.add(`/${cleanPath}`);
            result.usedMediaPaths.add(rawUrl);
            console.log(
              `[Gemini] Mídia complementar incluída: ${path.basename(
                cleanPath
              )} (${(buffer.length / 1024).toFixed(1)} KB)`
            );
          }
        } catch (err) {
          console.warn(
            `[Gemini] Aviso: não foi possível carregar mídia complementar "${rawUrl}":`,
            err
          );
        }
      } else {
        // Arquivo complementar não-imagem (ex: planilha anexada)
        complementaryItems.push({
          text: `\n[Arquivo complementar anexado: ${path.basename(
            cleanPath
          )}]\n`,
        });
        result.usedMediaPaths.add(cleanPath);
        result.usedMediaPaths.add(`/${cleanPath}`);
        result.usedMediaPaths.add(rawUrl);
      }
    }

    if (complementaryItems.length > 0) {
      result.complementaryParts.push({
        text: "\n### Mídias Complementares em Anexo:\nAs seguintes mídias foram anexadas ao chamado pelo atendente como evidências complementares:\n",
      });
      result.complementaryParts.push(...complementaryItems);
    }
  }

  result.allParts = [...result.interleavedParts, ...result.complementaryParts];
  return result;
}

export interface SafeReportContext {
  title: string;
  requester: string;
  clientOrOffice: string;
  reportedProblem: string;
  actionTaken: string;
  status: string;
  technicalAction: boolean;
  implementation: boolean;
  platform: string;
  authorName: string;
  createdAt: string;
  tagColor?: string;
}

export function buildFinalStructuredReport(
  parsedData: Partial<StructuredReportData>,
  safeContext: SafeReportContext,
  isVideo: boolean = false
): StructuredReportData {
  const todayFormatted = new Date().toLocaleDateString("pt-BR");

  const defaultDocNature = safeContext.technicalAction
    ? "Relato de QA e Investigação Técnica"
    : safeContext.implementation
    ? "Especificação de Melhoria e Novas Features"
    : "Relatório Técnico de Atendimento";

  const defaultRoute = safeContext.platform
    ? `Módulo ${safeContext.platform}`
    : "Ambiente Web";

  const isTechnicalReport =
    typeof parsedData.isTechnicalReport === "boolean"
      ? parsedData.isTechnicalReport
      : safeContext.technicalAction || safeContext.implementation;

  const investigativeNotice =
    parsedData.investigativeNotice ||
    (isTechnicalReport
      ? "AVISO DE CONTEXTO INVESTIGATIVO: As hipóteses e diretrizes a seguir têm caráter de investigação técnica preliminar e servem para orientar desenvolvedores e agentes de IA na identificação e correção de causas raiz."
      : undefined);

  let defaultTranscript: DialogueLine[] = [];
  if (!isVideo) {
    defaultTranscript = [
      {
        speaker: safeContext.requester,
        role: "Solicitante",
        timestamp: "00:00",
        text: safeContext.reportedProblem,
      },
      ...(safeContext.actionTaken
        ? [
            {
              speaker: safeContext.authorName,
              role: "Suporte",
              timestamp: "00:01",
              text: safeContext.actionTaken,
            },
          ]
        : []),
    ];
  }

  return {
    title: safeContext.title || parsedData.title || "Relatório de Atendimento Técnico e Diagnóstico",
    subtitle:
      parsedData.subtitle ||
      (isVideo
        ? `Solicitação referente a ${safeContext.clientOrOffice}`
        : `Atendimento para ${safeContext.clientOrOffice}`),
    date: parsedData.date || todayFormatted,
    department: parsedData.department || safeContext.clientOrOffice,
    participants:
      parsedData.participants ||
      `${safeContext.requester} (${isVideo ? "Operação" : "Solicitante"}), ${
        safeContext.authorName
      } (Suporte)`,
    platformAnalyzed:
      parsedData.platformAnalyzed || safeContext.platform || "Sistema Corporativo",
    routeEnvironment: parsedData.routeEnvironment || defaultRoute,
    documentNature: parsedData.documentNature || defaultDocNature,
    executiveSummary: parsedData.executiveSummary || safeContext.reportedProblem,
    currentBehavior: parsedData.currentBehavior || safeContext.reportedProblem,
    expectedBehavior: parsedData.expectedBehavior,
    evidenceCaptions: Array.isArray(parsedData.evidenceCaptions)
      ? parsedData.evidenceCaptions
      : undefined,
    isTechnicalReport,
    investigativeNotice,
    diagnosticHypothesis: parsedData.diagnosticHypothesis,
    logicalDiagram: parsedData.logicalDiagram,
    codeSuggestion: parsedData.codeSuggestion,
    investigationGuidelines: Array.isArray(parsedData.investigationGuidelines)
      ? parsedData.investigationGuidelines
      : undefined,
    proposals:
      Array.isArray(parsedData.proposals) && parsedData.proposals.length > 0
        ? parsedData.proposals
        : [
            {
              item: isVideo
                ? "1. Melhoria no Fluxo Operacional"
                : "1. Tratamento da Demanda",
              description: safeContext.actionTaken || safeContext.reportedProblem,
              category: safeContext.technicalAction ? "AÇÃO TÉCNICA" : "OPERAÇÃO",
              priority: "Alta",
            },
          ],
    detailingTopic:
      parsedData.detailingTopic || "Detalhamento e Justificativa da Solicitação",
    detailingParagraphs:
      Array.isArray(parsedData.detailingParagraphs) &&
      parsedData.detailingParagraphs.length > 0
        ? parsedData.detailingParagraphs
        : [safeContext.reportedProblem, safeContext.actionTaken].filter(Boolean),
    referrals:
      parsedData.referrals ||
      `Demanda registrada no atendimento pelo suporte (${safeContext.authorName}) e encaminhada para acompanhamento.`,
    transcript:
      Array.isArray(parsedData.transcript) && parsedData.transcript.length > 0
        ? parsedData.transcript
        : defaultTranscript,
  };
}

export async function analyzeRecordingWithGemini(
  videoFilePath: string,
  context: WorkLogContext,
  mediaUrls?: string[]
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
    title: context.title?.trim() || "",
    requester: context.requester?.trim() || "Não informado",
    clientOrOffice: context.clientOrOffice?.trim() || "Não informado",
    reportedProblem: context.reportedProblem?.trim() || "Não informado",
    descriptionInterleaved: context.descriptionInterleaved || null,
    actionTaken: context.actionTaken?.trim() || "",
    status: context.status?.trim() || "Pendente",
    technicalAction: !!context.technicalAction,
    implementation: !!context.implementation,
    platform: context.platform?.trim() || "",
    authorName: context.authorName?.trim() || "Técnico do suporte",
    tagColor: context.tagColor?.trim() || "#3b82f6",
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
  const maxAttempts = 120; // Até 360 segundos (6 minutos) para vídeos de até 1GB
  const pollIntervalMs = 3000;

  while (fileInfo.state === "PROCESSING" && attempts < maxAttempts) {
    console.log(`[Gemini] Processando vídeo na nuvem... tentativa ${attempts + 1}/${maxAttempts}`);
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
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
    const videoPart = createPartFromUri(fileUri, mimeType);

    // 6.1. Carrega imagens inline da descrição (se houver)
    let inlineImageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    if (context.descriptionInterleaved) {
      try {
        const interleavedResult = await buildInterleavedGeminiParts(
          context.descriptionInterleaved,
          mediaUrls
        );
        inlineImageParts = interleavedResult.inlineImageParts;
        if (inlineImageParts.length > 0) {
          console.log(`[Gemini] ${inlineImageParts.length} imagem(ns) inline da descrição incluídas na análise de gravação.`);
        }
      } catch (err) {
        console.warn("[Gemini] Aviso: falha ao extrair imagens inline para gravação:", err);
      }
    }

    // 7. Montagem do prompt com instruções e dados do formulário
    const prompt = `
Você é um assistente sênior especialista em suporte técnico corporativo e documentação executiva de atendimentos e reuniões.
Analise detalhadamente a gravação de tela em anexo (áudio com as falas e vídeo com as interações de tela)${inlineImageParts.length > 0 ? " juntamente com as imagens e prints de tela anexados na descrição" : ""} juntamente com as informações do formulário de atendimento fornecido abaixo.

Gere um relatório executivo técnico e formal, estritamente no formato JSON definido, seguindo o padrão de relatório corporativo da empresa:

### Informações do Atendimento:
${safeContext.title ? `- Título do Chamado: ${safeContext.title}` : ""}
- Solicitante: ${safeContext.requester}
- Escritório / Cliente: ${safeContext.clientOrOffice}
- Descrição: ${safeContext.reportedProblem}
${inlineImageParts.length > 0 ? `- Imagens na Descrição: Foram incluídas ${inlineImageParts.length} imagem(ns)/prints no texto da descrição detalhando o problema.` : ""}
${safeContext.actionTaken ? `- Ação Realizada: ${safeContext.actionTaken}` : ""}
- Status Atual: ${safeContext.status}
- Classificação: ${safeContext.technicalAction ? "Ação Técnica (Dev)" : ""} ${safeContext.implementation ? "Implementação/Sugestão de Melhoria" : ""}
${safeContext.platform ? `- Plataforma / Sistema do Atendimento: ${safeContext.platform}` : ""}
- Registrado por: ${safeContext.authorName}
- Data de Registro: ${safeContext.createdAt}

### Regras de Extração e Estruturação:
1. **TÍTULO (title)**:
   - O título do documento deve ser o texto exato do campo título fornecido no contexto: "${safeContext.title || "Relatório de Atendimento Técnico e Diagnóstico"}". NUNCA adicionar numeração "Nota XX" ou alterar esse texto.
   - Subtítulo (subtitle): Defina um subtítulo conciso e descritivo da necessidade levantada ou escritório atendido (ex: "${safeContext.clientOrOffice}").

2. **NATUREZA DO DOCUMENTO (documentNature)**:
   - Se for Ação Técnica (technicalAction: true): "Relato de QA e Investigação Técnica"
   - Se for Implementação (implementation: true): "Especificação de Melhoria e Novas Features"
   - Senão: "Relatório Técnico de Atendimento"
   - O campo isTechnicalReport deve ser true se for Ação Técnica ou Implementação, e false caso contrário.

3. **AMBIENTE DA ROTA (routeEnvironment)**:
   - Identifique o módulo, tela ou rota da URL onde a situação ocorre (ex: "Módulo de Documentos (Listagem)" ou "/casos/[codigo]/documentos").

4. **METADADOS (date, department, participants, platformAnalyzed)**:
   - Data no formato DD/MM/AAAA.
   - Departamento: inclua o setor e escritório/cliente, ex: "Cível Processual | ${safeContext.clientOrOffice}".
   - Participantes: liste cada pessoa identificada com seu papel entre parênteses, ex: "${safeContext.requester} (Operação), ${safeContext.authorName} (Suporte)".
   - Plataforma Analisada: identifique o nome do sistema ou software demonstrado no vídeo (ex: ERP Jurídico, Módulo de Protocolos, Sistema Web). Caso identificado no formulário (${safeContext.platform || "não especificado"}), dê preferência a esse contexto.

5. **RESUMO EXECUTIVO (executiveSummary)**:
   - Um parágrafo formal e objetivo sintetizando o que foi demandado ou analisado durante o atendimento e qual o objetivo para a operação.

6. **ANÁLISE DE COMPORTAMENTO (currentBehavior e expectedBehavior)**:
   - currentBehavior: Descreva o erro, falha, gargalo ou comportamento atual observado na prática.
   - expectedBehavior: Descreva o comportamento esperado ideal do sistema.
   - DIRETRIZ DE AUTOCENSURA: Se o comportamento esperado não estiver explícito, deduza-o fundamentadamente; porém, se a dedução for vaga ou carente de contexto suficiente, omita expectedBehavior para evitar suposições sem base.

7. **EVIDÊNCIAS E LEGENDAS (evidenceCaptions)**:
   - Para cada imagem ou print de tela anexado/identificado, forneça em evidenceCaptions o filename e uma legenda descritiva curta e clara (ex: "1. Estado com 2 documentos selecionados", "2. Arquivo alocado na aba Sem pasta").

8. **SEÇÃO TÉCNICA INVESTIGATIVA (Somente para Ação Técnica ou Implementação - isTechnicalReport: true)**:
   - investigativeNotice: "AVISO DE CONTEXTO INVESTIGATIVO: As hipóteses e diretrizes a seguir têm caráter de investigação técnica preliminar e servem para orientar desenvolvedores e agentes de IA na identificação e correção de causas raiz."
   - diagnosticHypothesis: Objeto com topic (ex: "Divergência entre Estado Global e Mutação de UI") e paragraphs (parágrafos analisando provável causa raiz lógica: DOM, manipulação de estado, ciclo de vida, histórico ou APIs).
   - logicalDiagram: Quadro comparativo lógico resumindo o gargalo (ex: title: "Mapeamento do Gargalo Lógico", leftBoxTitle: "ESTADO GLOBAL [IDs]", leftBoxContent: "...", operator: "≠", rightBoxTitle: "EVENTO ON_DRAG [Payload]", rightBoxContent: "...").
   - codeSuggestion: Bloco de código com lógica sugerida de solução (JavaScript ou TypeScript) contendo language, title, code e explanation. Se não houver código aplicável ou base sólida, omita este campo.
   - investigationGuidelines: Lista de itens técnicos objetivos para verificação pelos desenvolvedores (ex: auditar ouvintes de eventos, verificar payload da mutation).
   - Se NÃO for Ação Técnica nem Implementação, omita estes campos técnicos.

9. **PROPOSTAS DE MELHORIA E DETALHAMENTO (proposals, detailingTopic, detailingParagraphs, referrals)**:
   - proposals: Tabela com propostas de melhoria de fluxo de trabalho ou itens técnicos levantados (item numerado, description, category em caixa alta, priority).
   - detailingTopic: Subtítulo adequado (ex: "Necessidade Operacional de Planilhamento" ou "Diagnóstico e Justificativa da Falha").
   - detailingParagraphs: Parágrafos detalhados explicando o contexto operacional, volume de dados e justificativa.
   - referrals: Encaminhamentos práticos da reunião e próximos passos com a equipe técnica.

10. **TRANSCRIÇÃO INTEGRAL DO ÁUDIO DA REUNIÃO (transcript)**:
   - Transcreva cronologicamente o diálogo com timestamps precisos no formato [MM:SS].
   - Identifique quem está falando e seu papel (speaker, role, timestamp, text).
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
            contents: [videoPart, ...inlineImageParts, prompt],
            config: {
              responseMimeType: "application/json",
              responseSchema: REPORT_SCHEMA,
              temperature: 0.2, // Baixa temperatura para precisão e aderência factual
            },
          });

          responseText = response.text;
          if (responseText && responseText.trim().length > 0) {
            break;
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const is404 = errMsg.includes("404") || errMsg.includes("NOT_FOUND") || errMsg.includes("no longer available");
          if (!lastError || !is404) {
            lastError = err;
          }
          console.warn(`[Gemini] Tentativa ${attempt} com modelo ${model} falhou: ${errMsg}`);

          if (isTransientError(err) && attempt < 3) {
            const delay = Math.pow(2, attempt) * 1500;
            console.log(`[Gemini] Erro de alta demanda/cota detectado. Aguardando ${delay}ms antes da tentativa ${attempt + 1}...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            // Se for erro permanente ou esgotou as tentativas do modelo, avança para o próximo modelo candidato
            break;
          }
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

    return buildFinalStructuredReport(parsedData, safeContext, true);
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


/**
 * Analisa atendimentos registrados manualmente via formulário (sem gravação de tela),
 * incluindo quaisquer mídias/imagens anexadas, e gera o relatório estruturado formal.
 */
export async function analyzeFormWithGemini(
  context: WorkLogContext,
  mediaUrls?: string[]
): Promise<StructuredReportData> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "A chave GEMINI_API_KEY não está configurada no ambiente. Configure-a no arquivo .env."
    );
  }

  // 1. Sanitização dos dados do contexto do atendimento
  const safeContext = {
    title: context.title?.trim() || "",
    requester: context.requester?.trim() || "Não informado",
    clientOrOffice: context.clientOrOffice?.trim() || "Não informado",
    reportedProblem: context.reportedProblem?.trim() || "Não informado",
    descriptionInterleaved: context.descriptionInterleaved || null,
    actionTaken: context.actionTaken?.trim() || "",
    status: context.status?.trim() || "Pendente",
    technicalAction: !!context.technicalAction,
    implementation: !!context.implementation,
    platform: context.platform?.trim() || "",
    authorName: context.authorName?.trim() || "Técnico do suporte",
    tagColor: context.tagColor?.trim() || "#3b82f6",
    createdAt: context.createdAt
      ? new Date(context.createdAt).toLocaleString("pt-BR")
      : "Data não informada",
  };

  const ai = new GoogleGenAI({ apiKey });

  // 2. Processa o conteúdo multimodal (intercalado ou legado)
  const interleavedResult = await buildInterleavedGeminiParts(
    context.descriptionInterleaved,
    mediaUrls
  );

  let legacyImageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  let totalMediaCount = 0;

  if (interleavedResult.hasInterleaved) {
    totalMediaCount = interleavedResult.allParts.filter(
      (p) => "inlineData" in p
    ).length;
  } else {
    // Modo legado: se descriptionInterleaved for nulo ou vazio
    if (mediaUrls && Array.isArray(mediaUrls)) {
      for (const rawUrl of mediaUrls) {
        try {
          const cleanPath = normalizeStoragePath(rawUrl);
          if (!cleanPath) continue;

          const mime = detectMimeType(cleanPath);
          if (isSupportedGeminiInlineMimeType(mime)) {
            const fileBuffer = await getFileBuffer(cleanPath);
            if (fileBuffer && fileBuffer.length > 0) {
              legacyImageParts.push({
                inlineData: {
                  mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
                  data: fileBuffer.toString("base64"),
                },
              });
              console.log(
                `[Gemini] Mídia/imagem anexada incluída na análise: ${path.basename(
                  cleanPath
                )} (${(fileBuffer.length / 1024).toFixed(1)} KB)`
              );
            }
          }
        } catch (err) {
          console.warn(`[Gemini] Aviso: não foi possível carregar mídia "${rawUrl}":`, err);
        }
      }
    }
    totalMediaCount = legacyImageParts.length;
  }

  // 3. Montagem do prompt executivo
  const prompt = `
Você é um assistente sênior especialista em suporte técnico corporativo e documentação executiva de atendimentos e chamados de TI.
Analise detalhadamente as informações registradas pelo atendimento técnico fornecidas abaixo${totalMediaCount > 0 ? " juntamente com as imagens e prints de tela em anexo" : ""}.

Gere um relatório executivo técnico e formal, estritamente no formato JSON definido, seguindo o padrão corporativo de relatório da empresa:

### Informações do Atendimento:
${safeContext.title ? `- Título do Chamado: ${safeContext.title}` : ""}
- Solicitante: ${safeContext.requester}
- Escritório / Cliente: ${safeContext.clientOrOffice}
- Descrição Detalhada do Problema / Demanda: ${safeContext.reportedProblem}
${safeContext.actionTaken ? `- Ação Realizada pelo Suporte: ${safeContext.actionTaken}` : ""}
- Status Atual: ${safeContext.status}
- Classificação: ${safeContext.technicalAction ? "Ação Técnica (Dev/Infra)" : ""} ${safeContext.implementation ? "Implementação/Sugestão de Melhoria" : ""}
${safeContext.platform ? `- Plataforma / Sistema do Atendimento: ${safeContext.platform}` : ""}
- Registrado por: ${safeContext.authorName}
- Data de Registro: ${safeContext.createdAt}
${totalMediaCount > 0 ? `- Mídias anexadas: Foram anexadas ${totalMediaCount} imagem(ns)/prints comprovando e detalhando a situação descrita.` : ""}
${interleavedResult.hasInterleaved ? "- Observação de Formato: A narrativa descritiva do atendimento foi estruturada de forma intercalada diretamente com as mídias e evidências no início desta solicitação." : ""}

### Diretrizes de Preenchimento dos Campos:
1. **TÍTULO (title)**:
   - O título do documento deve ser o texto exato do campo título fornecido no contexto: "${safeContext.title || "Relatório de Atendimento Técnico e Diagnóstico"}". NUNCA adicionar numeração "Nota XX" ou alterar o texto.
   - Subtítulo (subtitle): Conciso e objetivo (ex: "Atendimento referente a ${safeContext.clientOrOffice}").

2. **NATUREZA DO DOCUMENTO (documentNature)**:
   - Se for Ação Técnica (technicalAction: true): "Relato de QA e Investigação Técnica"
   - Se for Implementação (implementation: true): "Especificação de Melhoria e Novas Features"
   - Senão: "Relatório Técnico de Atendimento"
   - O campo isTechnicalReport deve ser true se for Ação Técnica ou Implementação, e false caso contrário.

3. **AMBIENTE DA ROTA (routeEnvironment)**:
   - Identifique o módulo, tela ou rota da URL onde a situação ocorre (ex: "Módulo de Documentos (Listagem)" ou "/casos/[codigo]/documentos"). Caso não especificado na descrição, deduza a partir da plataforma (${safeContext.platform || "Sistema Web"}).

4. **METADADOS (date, department, participants, platformAnalyzed)**:
   - Date no formato DD/MM/AAAA.
   - Department: setor e escritório/cliente, ex: "${safeContext.clientOrOffice}".
   - Participants: "${safeContext.requester} (Solicitante), ${safeContext.authorName} (Suporte)".
   - PlatformAnalyzed: "${safeContext.platform || "Sistema Corporativo"}".

5. **RESUMO EXECUTIVO (executiveSummary)**:
   - Parágrafo formal e bem redigido sintetizando a solicitação, a relevância para o cliente e a intervenção técnica realizada ou necessária.

6. **ANÁLISE DE COMPORTAMENTO (currentBehavior e expectedBehavior)**:
   - currentBehavior: Descreva o erro, falha, gargalo ou anomalia ocorrida na prática.
   - expectedBehavior: Descreva o comportamento esperado ideal do sistema.
   - DIRETRIZ DE AUTOCENSURA: Se o comportamento esperado não estiver explícito, deduza-o fundamentadamente; porém, se a dedução for vaga ou carente de contexto suficiente, omita expectedBehavior para evitar suposições sem base.

7. **EVIDÊNCIAS E LEGENDAS (evidenceCaptions)**:
   - Para cada imagem/print anexado, forneça em evidenceCaptions o filename e uma legenda descritiva curta e clara (ex: "1. Estado com 2 documentos selecionados", "2. Arquivo alocado na aba Sem pasta").

8. **SEÇÃO TÉCNICA INVESTIGATIVA (Somente para Ação Técnica ou Implementação - isTechnicalReport: true)**:
   - investigativeNotice: "AVISO DE CONTEXTO INVESTIGATIVO: As hipóteses e diretrizes a seguir têm caráter de investigação técnica preliminar e servem para orientar desenvolvedores e agentes de IA na identificação e correção de causas raiz."
   - diagnosticHypothesis: Tópico e parágrafos analisando provável causa raiz lógica (DOM, manipulação de estado, histórico, APIs).
   - logicalDiagram: Quadro comparativo lógico resumindo o gargalo (ex: ESTADO GLOBAL ≠ EVENTO ON_DRAG).
   - codeSuggestion: Bloco de código com lógica sugerida de solução (JavaScript ou TypeScript) contendo language, title, code e explanation. Se não houver código aplicável ou base sólida, omita este campo.
   - investigationGuidelines: Itens técnicos objetivos para verificação pelos desenvolvedores.
   - Se NÃO for Ação Técnica nem Implementação, omita estes campos técnicos.

9. **PROPOSTAS E AÇÕES RECOMENDADAS (proposals)**:
   - Liste de 1 a 3 itens de melhoria técnica, correção ou procedimento preventivo aplicável (item, description, category, priority).

10. **DETALHAMENTO TÉCNICO (detailingTopic e detailingParagraphs)**:
   - detailingTopic: Título do detalhamento.
   - detailingParagraphs: 2 ou mais parágrafos detalhados aprofundando o diagnóstico, impacto na rotina e justificativa técnica.

11. **ENCAMINHAMENTOS (referrals)**:
   - Próximos passos formais, encaminhamento para equipe técnica ou acompanhamento pós-atendimento.

12. **TRANSCRIÇÃO / REGISTRO DE CONTATO (transcript)**:
   - Como este atendimento foi documentado via formulário estruturado, crie um registro formal com os pontos de contato entre o solicitante e o suporte (ex: speaker: "${safeContext.requester}", role: "Solicitante", timestamp: "00:00", text: "${safeContext.reportedProblem}").
`;

  // 4. Chamada resiliente para os modelos candidatos
  let lastError: unknown;
  let responseText: string | undefined;

  const contents = interleavedResult.hasInterleaved
    ? [...interleavedResult.allParts, prompt]
    : [...legacyImageParts, prompt];

  for (const model of CANDIDATE_MODELS) {
    console.log(`[Gemini] Tentando gerar relatório estruturado de formulário com o modelo: ${model}...`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: REPORT_SCHEMA,
            temperature: 0.2,
          },
        });

        responseText = response.text;
        if (responseText && responseText.trim().length > 0) {
          break;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const is404 = errMsg.includes("404") || errMsg.includes("NOT_FOUND") || errMsg.includes("no longer available");
        if (!lastError || !is404) {
          lastError = err;
        }
        console.warn(`[Gemini] Tentativa ${attempt} com modelo ${model} falhou: ${errMsg}`);

        if (isTransientError(err) && attempt < 3) {
          const delay = Math.pow(2, attempt) * 1500;
          console.log(`[Gemini] Erro de alta demanda/cota detectado. Aguardando ${delay}ms antes da tentativa ${attempt + 1}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    if (responseText) {
      break;
    }
  }

  if (!responseText) {
    throw lastError || new Error("Não foi possível obter resposta dos modelos do Google Gemini.");
  }

  console.log("[Gemini] Resposta estruturada de formulário recebida com sucesso!");
  const parsedData = JSON.parse(responseText) as Partial<StructuredReportData>;

  return buildFinalStructuredReport(parsedData, safeContext, false);
}
