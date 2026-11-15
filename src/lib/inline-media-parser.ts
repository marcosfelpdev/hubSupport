export interface AttachedMediaItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  previewUrl: string;
}

export interface InterleavedBlock {
  type: "text" | "media";
  content?: string;
  mediaId?: string;
  filename?: string;
  mimeType?: string;
  fileIndex?: number;
  storagePath?: string;
  mediaUrl?: string;
}

const BLOCK_TAGS = new Set([
  "DIV",
  "P",
  "LI",
  "UL",
  "OL",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "TR",
]);

export function formatMediaTag(filename: string, mimeType: string): string {
  if (mimeType.startsWith("image/")) {
    return `[Imagem: ${filename}]`;
  }
  if (mimeType.startsWith("video/")) {
    return `[Vídeo: ${filename}]`;
  }
  if (mimeType.startsWith("audio/")) {
    return `[Áudio: ${filename}]`;
  }
  return `[Arquivo: ${filename}]`;
}

export function generateMediaId(): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  return `media_${timestamp}_${rand}`;
}

export function createAttachedMediaItem(file: File): AttachedMediaItem {
  const id = generateMediaId();
  const previewUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : "";
  return {
    id,
    file,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    previewUrl,
  };
}

type RawToken =
  | { type: "text"; text: string }
  | { type: "newline" }
  | { type: "media"; mediaId: string; filename: string; mimeType: string };

/**
 * Percorre os nós do container DOM contentEditable em ordem, identificando textos,
 * quebras de linha e chips de mídia marcados com `data-media-id`.
 */
export function parseEditorDomToInterleaved(
  container: HTMLElement | null | undefined,
  mediaMap: Map<string, AttachedMediaItem> = new Map()
): {
  plainText: string;
  interleaved: InterleavedBlock[];
  insertedMediaIds: Set<string>;
} {
  const insertedMediaIds = new Set<string>();

  if (!container || !container.childNodes || container.childNodes.length === 0) {
    return {
      plainText: "",
      interleaved: [],
      insertedMediaIds,
    };
  }

  const rawTokens: RawToken[] = [];

  function walk(node: any, isRoot: boolean) {
    if (!node) return;

    // Node de Texto (TEXT_NODE === 3)
    if (node.nodeType === 3) {
      const text = node.textContent || "";
      if (text.length > 0) {
        rawTokens.push({ type: "text", text });
      }
      return;
    }

    // Node de Elemento (ELEMENT_NODE === 1)
    if (node.nodeType === 1) {
      // Verifica se é chip de mídia (não deve processar nós internos)
      const mediaId =
        node.getAttribute?.("data-media-id") ||
        (node.dataset ? node.dataset.mediaId : null);

      if (mediaId) {
        insertedMediaIds.add(mediaId);
        const item = mediaMap.get(mediaId);
        const filename =
          item?.name || node.getAttribute?.("data-filename") || "arquivo";
        const mimeType =
          item?.mimeType ||
          node.getAttribute?.("data-mimetype") ||
          "application/octet-stream";

        rawTokens.push({
          type: "media",
          mediaId,
          filename,
          mimeType,
        });
        return;
      }

      const tag = (node.nodeName || "").toUpperCase();

      // Quebra de linha explícita (<br>)
      if (tag === "BR") {
        rawTokens.push({ type: "newline" });
        return;
      }

      const isBlock = !isRoot && BLOCK_TAGS.has(tag);

      // Limite inicial de bloco: adiciona quebra se não houver
      if (isBlock && rawTokens.length > 0 && rawTokens[rawTokens.length - 1].type !== "newline") {
        rawTokens.push({ type: "newline" });
      }

      // Percorre filhos
      if (node.childNodes && node.childNodes.length > 0) {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i], false);
        }
      }

      // Limite final de bloco: adiciona quebra se não houver
      if (isBlock && rawTokens.length > 0 && rawTokens[rawTokens.length - 1].type !== "newline") {
        rawTokens.push({ type: "newline" });
      }
    }
  }

  // Percorre a partir da raiz
  walk(container, true);

  // Remove quebras de linha excedentes no início e fim
  let startIndex = 0;
  while (startIndex < rawTokens.length && rawTokens[startIndex].type === "newline") {
    startIndex++;
  }

  let endIndex = rawTokens.length - 1;
  while (endIndex >= startIndex && rawTokens[endIndex].type === "newline") {
    endIndex--;
  }

  const tokens = rawTokens.slice(startIndex, endIndex + 1);

  // Se não sobraram tokens, retorna vazio
  if (tokens.length === 0) {
    return {
      plainText: "",
      interleaved: [],
      insertedMediaIds,
    };
  }

  // Monta plainText e interleaved ordenado
  let plainText = "";
  const interleaved: InterleavedBlock[] = [];

  for (const token of tokens) {
    if (token.type === "text" || token.type === "newline") {
      const textChunk = token.type === "newline" ? "\n" : token.text;
      plainText += textChunk;

      const lastBlock = interleaved[interleaved.length - 1];
      if (lastBlock && lastBlock.type === "text") {
        lastBlock.content = (lastBlock.content || "") + textChunk;
      } else {
        interleaved.push({
          type: "text",
          content: textChunk,
        });
      }
    } else if (token.type === "media") {
      const tag = formatMediaTag(token.filename, token.mimeType);
      plainText += tag;

      interleaved.push({
        type: "media",
        mediaId: token.mediaId,
        filename: token.filename,
        mimeType: token.mimeType,
      });
    }
  }

  // Normalização caso o texto contenha apenas espaços vazios e nenhuma mídia
  if (insertedMediaIds.size === 0 && plainText.trim() === "") {
    return {
      plainText: "",
      interleaved: [],
      insertedMediaIds,
    };
  }

  return {
    plainText,
    interleaved,
    insertedMediaIds,
  };
}

/**
 * Trunca nomes de arquivos no padrão clássico de meio, preservando o início,
 * o final do nome e a extensão original.
 *
 * Exemplos:
 * truncateMiddle("Captura de tela 2026-10-15 003713.png", 16) -> "Captu...3713.png"
 * truncateMiddle("Captura de tela 2026-10-15 003713.png", 18) -> "Captura...3713.png"
 * truncateMiddle("relatorio_mensal_de_vendas_consolidado", 16) -> "relato...didado"
 */
export function truncateMiddle(filename: string, maxLength: number = 16): string {
  if (!filename) return "";
  if (maxLength <= 0) return "";
  if (filename.length <= maxLength) return filename;
  if (maxLength <= 3) return filename.slice(0, maxLength);

  const lastDot = filename.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < filename.length - 1;

  if (hasExtension) {
    const ext = filename.slice(lastDot);
    const base = filename.slice(0, lastDot);
    const avail = maxLength - 3;
    const nameAvail = avail - ext.length;

    if (nameAvail >= 1) {
      const frontChars = Math.max(1, Math.round(nameAvail * 0.6));
      const backChars = nameAvail - frontChars;
      const front = base.slice(0, frontChars);
      const back = backChars > 0 ? base.slice(-backChars) : "";
      return `${front}...${back}${ext}`;
    }
  }

  // Se não tem extensão ou se a extensão é muito longa para caber
  const avail = maxLength - 3;
  const frontChars = Math.ceil(avail / 2);
  const backChars = avail - frontChars;
  const front = filename.slice(0, frontChars);
  const back = backChars > 0 ? filename.slice(-backChars) : "";
  return `${front}...${back}`;
}
