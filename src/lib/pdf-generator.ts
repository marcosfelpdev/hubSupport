import PDFDocument from "pdfkit";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { StructuredReportData, WorkLogContext } from "./gemini";
import { uploadBuffer, getFileBuffer } from "../server/services/r2Storage";

const REPORTS_DIR = path.join(process.cwd(), "storage", "reports");

async function ensureReportsDir() {
  try {
    await fsp.access(REPORTS_DIR);
  } catch {
    await fsp.mkdir(REPORTS_DIR, { recursive: true });
  }
}

export interface GeneratePdfOptions {
  workLogId: string;
  data: StructuredReportData;
  context: WorkLogContext;
  mediaUrls?: string[];
  imageBuffers?: Array<{ filename: string; buffer: Buffer }>;
}

/**
 * Utilitários de manipulação e harmonização de cores
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = (hex || "#3b82f6").replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) {
    return { r: 59, g: 130, b: 246 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

function blendWithWhite(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const blendedR = r * factor + 255 * (1 - factor);
  const blendedG = g * factor + 255 * (1 - factor);
  const blendedB = b * factor + 255 * (1 - factor);
  return rgbToHex(blendedR, blendedG, blendedB);
}

function darkenColor(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

function getContrastingTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.55) {
    return darkenColor(hex, 0.45);
  }
  return hex;
}

interface ResolvedEvidence {
  filename: string;
  caption: string;
  buffer?: Buffer;
  error?: boolean;
}

/**
 * Resolução assíncrona de evidências visuais (buffers de imagens)
 */
async function resolveEvidenceImages(
  options: GeneratePdfOptions
): Promise<ResolvedEvidence[]> {
  const { data, mediaUrls, imageBuffers } = options;
  const results: ResolvedEvidence[] = [];
  const processedFilenames = new Set<string>();

  const isImageFile = (filenameOrPath: string) => {
    const lower = filenameOrPath.toLowerCase();
    return (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif")
    );
  };

  // 1. Processa imageBuffers se fornecidos diretamente (testes ou memória)
  if (imageBuffers && imageBuffers.length > 0) {
    for (const item of imageBuffers) {
      if (!isImageFile(item.filename)) continue;
      const fn = path.basename(item.filename);
      processedFilenames.add(fn);

      const captionMatch = data.evidenceCaptions?.find(
        (c) => path.basename(c.filename) === fn || c.filename.includes(fn)
      );
      const caption = captionMatch?.caption || `Evidência visual: ${fn}`;

      results.push({
        filename: fn,
        caption,
        buffer: item.buffer,
      });
    }
  }

  // 2. Processa evidenceCaptions estruturadas que ainda não foram carregadas
  if (data.evidenceCaptions && data.evidenceCaptions.length > 0) {
    for (const item of data.evidenceCaptions) {
      const fn = path.basename(item.filename);
      if (processedFilenames.has(fn)) continue;
      processedFilenames.add(fn);

      let buffer: Buffer | undefined;
      let error = false;

      const matchedMediaUrl = mediaUrls?.find(
        (u) => path.basename(u) === fn || u.includes(fn)
      );
      const targetPath = matchedMediaUrl || item.filename;

      try {
        buffer = await getFileBuffer(targetPath);
      } catch {
        const localCandidates = [
          path.join(process.cwd(), targetPath),
          path.join(process.cwd(), "public", targetPath),
          path.join(process.cwd(), "storage", targetPath),
          path.join(process.cwd(), "storage", "worklogs", targetPath),
        ];
        for (const candidate of localCandidates) {
          if (fs.existsSync(candidate)) {
            try {
              buffer = await fsp.readFile(candidate);
              break;
            } catch {}
          }
        }
      }

      if (!buffer) {
        error = true;
      }

      results.push({
        filename: fn,
        caption: item.caption,
        buffer,
        error,
      });
    }
  }

  // 3. Processa mediaUrls adicionais de imagem se houver
  if (mediaUrls && mediaUrls.length > 0) {
    for (const url of mediaUrls) {
      if (!isImageFile(url)) continue;
      const fn = path.basename(url);
      if (processedFilenames.has(fn)) continue;
      processedFilenames.add(fn);

      let buffer: Buffer | undefined;
      let error = false;

      try {
        buffer = await getFileBuffer(url);
      } catch {
        const localCandidates = [
          path.join(process.cwd(), url),
          path.join(process.cwd(), "public", url),
          path.join(process.cwd(), "storage", url),
        ];
        for (const candidate of localCandidates) {
          if (fs.existsSync(candidate)) {
            try {
              buffer = await fsp.readFile(candidate);
              break;
            } catch {}
          }
        }
      }

      if (!buffer) {
        error = true;
      }

      results.push({
        filename: fn,
        caption: `Evidência visual: ${fn}`,
        buffer,
        error,
      });
    }
  }

  return results;
}

export async function generateReportPdf(options: GeneratePdfOptions): Promise<string> {
  const { workLogId, data, context } = options;
  await ensureReportsDir();

  // Pré-carrega buffers das imagens antes de iniciar renderização do PDFKit
  const evidenceImages = await resolveEvidenceImages(options);

  const fileName = `relatorio-${workLogId}-${Date.now()}.pdf`;

  return new Promise((resolve, reject) => {
    let rawTitle = context.title || data.title || "Relatório Técnico de Atendimento";
    // Remove qualquer prefixo acidental "Nota XX"
    const docTitle = rawTitle.replace(/^Nota\s+\d+[\s:\-–—]*/i, "").trim() || rawTitle;

    const doc = new PDFDocument({
      size: "A4", // 595.28 x 841.89 pt
      margins: { top: 48, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: docTitle,
        Author: "Relix AI",
        Subject: `Atendimento ${workLogId}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        const key = `storage/reports/${fileName}`;
        await uploadBuffer(pdfBuffer, key, "application/pdf");
        resolve(key);
      } catch (err) {
        reject(err);
      }
    });
    doc.on("error", (err) => {
      reject(err);
    });

    // Identidade visual dinâmica conectada à cor da tag
    const tagColor = context.tagColor || "#f59e0b";
    const tagBg = blendWithWhite(tagColor, 0.12);
    const tagBorder = blendWithWhite(tagColor, 0.4);
    const tagTextColor = getContrastingTextColor(tagColor);

    // Paleta corporativa
    const titleNavy = "#0f172a";
    const subtitleGray = "#475569";
    const sectionDark = "#1e293b";
    const bodyDark = "#334155";
    const mutedGray = "#64748b";
    const borderGray = "#e2e8f0";
    const boxBg = "#f8fafc";

    const PAGE_BOTTOM_LIMIT = 745;

    function checkPageBreak(neededHeight: number) {
      if (doc.y + neededHeight > PAGE_BOTTOM_LIMIT) {
        doc.addPage();
        doc.y = 48;
      }
    }

    function drawSectionTitle(title: string) {
      checkPageBreak(35);
      doc.moveDown(0.3);
      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor(sectionDark)
        .text(title.toUpperCase(), 50, doc.y, { characterSpacing: 0.3 });
      doc.moveDown(0.35);
    }

    // -------------------------------------------------------------
    // 1. Cabeçalho Dinâmico
    // -------------------------------------------------------------
    const headerStartY = 48;

    // Badge da Tag no topo esquerdo (Pílula suave com cor temática)
    const platformText = (context.platform || data.platformAnalyzed || "ATENDIMENTO").toUpperCase();
    doc.font("Helvetica-Bold").fontSize(7.5);
    const tagTextWidth = doc.widthOfString(platformText);
    const tagPillWidth = Math.max(tagTextWidth + 18, 70);
    doc
      .roundedRect(50, headerStartY, tagPillWidth, 17, 3.5)
      .fillAndStroke(tagBg, tagBorder);
    doc
      .fillColor(tagTextColor)
      .text(platformText, 50, headerStartY + 4.5, { width: tagPillWidth, align: "center" });

    // Badge de Data no topo direito (Pílula sutil)
    const dateStr =
      data.date ||
      (context.createdAt
        ? new Date(context.createdAt).toLocaleDateString("pt-BR")
        : new Date().toLocaleDateString("pt-BR"));
    doc.font("Helvetica-Bold").fontSize(7.5);
    const dateTextWidth = doc.widthOfString(dateStr);
    const datePillWidth = dateTextWidth + 18;
    const datePillX = 545 - datePillWidth;
    doc
      .roundedRect(datePillX, headerStartY, datePillWidth, 17, 3.5)
      .fillAndStroke("#f1f5f9", "#e2e8f0");
    doc
      .fillColor("#475569")
      .text(dateStr, datePillX, headerStartY + 4.5, { width: datePillWidth, align: "center" });

    // Título Principal com barra vertical na cor da tag
    const titleY = headerStartY + 26;
    doc.font("Helvetica-Bold").fontSize(14);
    const titleHeight = doc.heightOfString(docTitle, { width: 480 });

    const subtitleText = context.clientOrOffice || data.subtitle || data.department || "";
    doc.font("Helvetica").fontSize(9);
    const subtitleHeight = subtitleText ? doc.heightOfString(subtitleText, { width: 480 }) : 0;

    const barHeight = Math.max(titleHeight + (subtitleText ? subtitleHeight + 3 : 0), 28);
    doc.rect(50, titleY, 3.5, barHeight).fill(tagColor);

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(titleNavy)
      .text(docTitle, 60, titleY, { width: 480 });

    if (subtitleText) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(subtitleGray)
        .text(subtitleText, 60, titleY + titleHeight + 2, { width: 480 });
    }

    doc.y = titleY + barHeight + 14;

    // -------------------------------------------------------------
    // 2. Card de Metadados (4 Quadrantes em container arredondado)
    // -------------------------------------------------------------
    checkPageBreak(65);
    const cardY = doc.y;
    const cardWidth = 495;
    const cardHeight = 56;
    const halfWidth = cardWidth / 2;
    const halfHeight = cardHeight / 2;

    doc
      .roundedRect(50, cardY, cardWidth, cardHeight, 5)
      .fillAndStroke(boxBg, borderGray);

    // Divisórias internas discretas
    doc
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .moveTo(50, cardY + halfHeight)
      .lineTo(545, cardY + halfHeight)
      .stroke();

    doc
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .moveTo(50 + halfWidth, cardY)
      .lineTo(50 + halfWidth, cardY + cardHeight)
      .stroke();

    // Quadrante 1 (Top-Left): SOLICITANTE
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(mutedGray)
      .text("SOLICITANTE", 60, cardY + 5.5, { width: halfWidth - 20, characterSpacing: 0.3 });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(titleNavy)
      .text(context.requester || "Não informado", 60, cardY + 14, {
        width: halfWidth - 20,
        ellipsis: true,
      });

    // Quadrante 2 (Top-Right): SUPORTE
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(mutedGray)
      .text("SUPORTE", 50 + halfWidth + 10, cardY + 5.5, {
        width: halfWidth - 20,
        characterSpacing: 0.3,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(titleNavy)
      .text(context.authorName || "Equipe de Atendimento", 50 + halfWidth + 10, cardY + 14, {
        width: halfWidth - 20,
        ellipsis: true,
      });

    // Quadrante 3 (Bottom-Left): AMBIENTE DA ROTA
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(mutedGray)
      .text("AMBIENTE DA ROTA", 60, cardY + halfHeight + 5.5, {
        width: halfWidth - 20,
        characterSpacing: 0.3,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(titleNavy)
      .text(data.routeEnvironment || "Interface / Rota Padrão", 60, cardY + halfHeight + 14, {
        width: halfWidth - 20,
        ellipsis: true,
      });

    // Quadrante 4 (Bottom-Right): NATUREZA DO DOCUMENTO
    const docNature =
      data.documentNature ||
      (context.technicalAction
        ? "Relato de QA e Investigação Técnica"
        : context.implementation
        ? "Especificação de Melhoria e Novas Features"
        : "Relatório Técnico de Atendimento");

    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(mutedGray)
      .text("NATUREZA DO DOCUMENTO", 50 + halfWidth + 10, cardY + halfHeight + 5.5, {
        width: halfWidth - 20,
        characterSpacing: 0.3,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(tagTextColor)
      .text(docNature, 50 + halfWidth + 10, cardY + halfHeight + 14, {
        width: halfWidth - 20,
        ellipsis: true,
      });

    doc.y = cardY + cardHeight + 14;

    // -------------------------------------------------------------
    // 3. Resumo Executivo em caixa com fundo cinza neutro
    // -------------------------------------------------------------
    if (data.executiveSummary) {
      const summaryContent = data.executiveSummary;
      const textHeight = doc.heightOfString(summaryContent, {
        width: 465,
        lineGap: 2.5,
      });
      const boxHeight = textHeight + 28;

      checkPageBreak(boxHeight + 10);

      const boxTop = doc.y;
      doc
        .roundedRect(50, boxTop, 495, boxHeight, 4)
        .fillAndStroke(boxBg, borderGray);

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(titleNavy)
        .text("Resumo Executivo", 65, boxTop + 8);

      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor(bodyDark)
        .text(summaryContent, 65, boxTop + 22, {
          width: 465,
          lineGap: 2.5,
          align: "justify",
        });

      doc.y = boxTop + boxHeight + 14;
    }

    // -------------------------------------------------------------
    // 4. Análise de Comportamento (Cards Comparativos Lado a Lado)
    // -------------------------------------------------------------
    if (data.currentBehavior || data.expectedBehavior) {
      const colWidth = 242;
      const colGap = 11;
      const cardPad = 8;
      const innerWidth = colWidth - cardPad * 2;

      const currentText = data.currentBehavior || "Comportamento não relatado.";
      const expectedText = data.expectedBehavior || "Comportamento esperado não especificado.";

      doc.font("Helvetica").fontSize(8);
      const currentHeight = doc.heightOfString(currentText, { width: innerWidth, lineGap: 2 });
      const expectedHeight = doc.heightOfString(expectedText, { width: innerWidth, lineGap: 2 });

      const maxContentH = Math.max(currentHeight, expectedHeight);
      const cardHeight = maxContentH + 32;

      checkPageBreak(cardHeight + 15);

      const cardsY = doc.y;

      // Card Vermelho: × Comportamento Atual (Anomalia)
      doc
        .roundedRect(50, cardsY, colWidth, cardHeight, 4)
        .fillAndStroke("#fef2f2", "#fca5a5");

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#dc2626")
        .text("× Comportamento Atual (Anomalia)", 50 + cardPad, cardsY + 8, { width: innerWidth });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#374151")
        .text(currentText, 50 + cardPad, cardsY + 23, {
          width: innerWidth,
          lineGap: 2,
          align: "justify",
        });

      // Card Verde: ✓ Comportamento Esperado
      const rightCardX = 50 + colWidth + colGap;
      doc
        .roundedRect(rightCardX, cardsY, colWidth, cardHeight, 4)
        .fillAndStroke("#f0fdf4", "#86efac");

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#16a34a")
        .text("✓ Comportamento Esperado", rightCardX + cardPad, cardsY + 8, { width: innerWidth });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#374151")
        .text(expectedText, rightCardX + cardPad, cardsY + 23, {
          width: innerWidth,
          lineGap: 2,
          align: "justify",
        });

      doc.y = cardsY + cardHeight + 14;
    }

    // -------------------------------------------------------------
    // 5. Evidências Visuais Registradas (Grade 2 Colunas com Legendas)
    // -------------------------------------------------------------
    if (evidenceImages.length > 0) {
      drawSectionTitle("EVIDÊNCIAS VISUAIS REGISTRADAS");

      const cardWidth = 242;
      const colGap = 11;
      const cardHeight = 155;
      const bannerHeight = 28;
      const imgAreaHeight = cardHeight - bannerHeight - 6;

      for (let i = 0; i < evidenceImages.length; i += 2) {
        checkPageBreak(cardHeight + 15);
        const rowY = doc.y;

        for (let c = 0; c < 2; c++) {
          const idx = i + c;
          if (idx >= evidenceImages.length) break;

          const imgItem = evidenceImages[idx];
          const cardX = 50 + c * (cardWidth + colGap);

          // Borda externa e fundo do card
          doc
            .roundedRect(cardX, rowY, cardWidth, cardHeight, 4)
            .fillAndStroke("#f8fafc", "#e2e8f0");

          // Faixa escura inferior com a legenda
          const bannerY = rowY + cardHeight - bannerHeight;
          doc
            .roundedRect(cardX, bannerY, cardWidth, bannerHeight, 3)
            .fill("#0f172a");

          let formattedCaption = imgItem.caption;
          if (!/^\d+\./.test(formattedCaption.trim())) {
            formattedCaption = `${idx + 1}. ${formattedCaption}`;
          }

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#f8fafc")
            .text(formattedCaption, cardX + 6, bannerY + 5, {
              width: cardWidth - 12,
              height: bannerHeight - 6,
              lineGap: 1.5,
              ellipsis: true,
            });

          // Desenho da imagem com tratamento de falhas
          let rendered = false;
          if (imgItem.buffer && !imgItem.error) {
            try {
              doc.image(imgItem.buffer, cardX + 4, rowY + 4, {
                fit: [cardWidth - 8, imgAreaHeight],
                align: "center",
                valign: "center",
              });
              rendered = true;
            } catch {
              rendered = false;
            }
          }

          if (!rendered) {
            // Fallback gracioso caso a imagem esteja ausente ou corrompida
            doc
              .font("Helvetica-Bold")
              .fontSize(7.5)
              .fillColor("#64748b")
              .text("EVIDÊNCIA VISUAL", cardX + 4, rowY + 36, {
                width: cardWidth - 8,
                align: "center",
              });

            doc
              .font("Helvetica")
              .fontSize(7)
              .fillColor("#94a3b8")
              .text("Arquivo de imagem não renderizável", cardX + 4, rowY + 48, {
                width: cardWidth - 8,
                align: "center",
              });

            doc
              .font("Helvetica")
              .fontSize(6.5)
              .fillColor("#cbd5e1")
              .text(imgItem.filename, cardX + 4, rowY + 60, {
                width: cardWidth - 8,
                align: "center",
                ellipsis: true,
              });
          }
        }

        doc.y = rowY + cardHeight + 14;
      }
    }

    // -------------------------------------------------------------
    // 6. Seção Técnica de Investigação (se data.isTechnicalReport)
    // -------------------------------------------------------------
    if (data.isTechnicalReport || context.technicalAction) {
      drawSectionTitle("INVESTIGAÇÃO TÉCNICA E HIPÓTESES DE CAUSA RAIZ");

      // Banner âmbar: AVISO DE CONTEXTO INVESTIGATIVO
      const noticeText =
        data.investigativeNotice ||
        "AVISO DE CONTEXTO INVESTIGATIVO: As hipóteses, fluxogramas de gargalo e blocos de código abaixo representam diretrizes analíticas preliminares baseadas em telemetria e inspeção de comportamento, servindo como guia investigativo para agentes autônomos e desenvolvedores, sujeitas à validação técnica no codebase.";

      doc.font("Helvetica").fontSize(7.5);
      const noticeTextHeight = doc.heightOfString(noticeText, { width: 470, lineGap: 2 });
      const bannerBoxHeight = noticeTextHeight + 16;

      checkPageBreak(bannerBoxHeight + 10);
      const bannerY = doc.y;

      doc
        .roundedRect(50, bannerY, 495, bannerBoxHeight, 3.5)
        .fillAndStroke("#fffbeb", "#fef3c7");

      doc
        .rect(50, bannerY, 3.5, bannerBoxHeight)
        .fill("#f59e0b");

      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor("#b45309")
        .text(noticeText, 60, bannerY + 8, {
          width: 475,
          lineGap: 2,
          align: "justify",
        });

      doc.y = bannerY + bannerBoxHeight + 14;

      // Hipótese Diagnóstica
      if (data.diagnosticHypothesis) {
        if (data.diagnosticHypothesis.topic) {
          checkPageBreak(25);
          doc
            .font("Helvetica-Bold")
            .fontSize(9.5)
            .fillColor(titleNavy)
            .text(data.diagnosticHypothesis.topic, 50, doc.y);
          doc.moveDown(0.25);
        }

        if (data.diagnosticHypothesis.paragraphs && data.diagnosticHypothesis.paragraphs.length > 0) {
          for (const para of data.diagnosticHypothesis.paragraphs) {
            doc.font("Helvetica").fontSize(8.5);
            const paraH = doc.heightOfString(para, { width: 495, lineGap: 2.5 }) + 8;
            checkPageBreak(paraH);

            doc
              .font("Helvetica")
              .fontSize(8.5)
              .fillColor(bodyDark)
              .text(para, 50, doc.y, {
                width: 495,
                lineGap: 2.5,
                align: "justify",
              });
            doc.moveDown(0.35);
          }
        }
        doc.moveDown(0.2);
      }

      // Diagrama Lógico de Gargalo (Caixa Visual)
      if (data.logicalDiagram) {
        const diagTitle = data.logicalDiagram.title || "GARGALO LÓGICO IDENTIFICADO";
        const diagContainerH = 88;
        checkPageBreak(diagContainerH + 15);

        const diagY = doc.y;
        doc
          .roundedRect(50, diagY, 495, diagContainerH, 4)
          .fillAndStroke(boxBg, borderGray);

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor(subtitleGray)
          .text(diagTitle.toUpperCase(), 62, diagY + 8, {
            width: 471,
            characterSpacing: 0.3,
          });

        const boxY = diagY + 23;
        const subBoxW = 213;
        const subBoxH = 55;

        // Caixa Esquerda: ESTADO GLOBAL
        doc
          .roundedRect(62, boxY, subBoxW, subBoxH, 3.5)
          .fillAndStroke("#ffffff", "#cbd5e1");

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor(titleNavy)
          .text(data.logicalDiagram.leftBoxTitle || "ESTADO GLOBAL", 68, boxY + 6, {
            width: subBoxW - 12,
            ellipsis: true,
          });

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#475569")
          .text(data.logicalDiagram.leftBoxContent || "", 68, boxY + 18, {
            width: subBoxW - 12,
            lineGap: 1.5,
          });

        // Operador Central
        const opX = 275;
        const opW = 45;
        doc
          .font("Helvetica-Bold")
          .fontSize(16)
          .fillColor("#dc2626")
          .text(data.logicalDiagram.operator || "≠", opX, boxY + 16, {
            width: opW,
            align: "center",
          });

        // Caixa Direita: EVENTO
        const rightBoxX = 320;
        doc
          .roundedRect(rightBoxX, boxY, subBoxW, subBoxH, 3.5)
          .fillAndStroke("#ffffff", "#cbd5e1");

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor(titleNavy)
          .text(data.logicalDiagram.rightBoxTitle || "EVENTO DISPARADO", rightBoxX + 6, boxY + 6, {
            width: subBoxW - 12,
            ellipsis: true,
          });

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#475569")
          .text(data.logicalDiagram.rightBoxContent || "", rightBoxX + 6, boxY + 18, {
            width: subBoxW - 12,
            lineGap: 1.5,
          });

        doc.y = diagY + diagContainerH + 14;
      }

      // Sugestão de Código (Monospace)
      if (data.codeSuggestion && data.codeSuggestion.code) {
        const codeLang = (data.codeSuggestion.language || "CODE").toUpperCase();
        const codeTitle = data.codeSuggestion.title || "Sugestão de Implementação / Correção";
        const codeLines = data.codeSuggestion.code.split("\n");
        const codeBodyHeight = codeLines.length * 10.5 + 16;
        const totalCodeHeight = 22 + codeBodyHeight;

        checkPageBreak(totalCodeHeight + 15);

        const codeTop = doc.y;

        // Fundo escuro do card
        doc
          .roundedRect(50, codeTop, 495, totalCodeHeight, 4)
          .fill("#0f172a");

        // Barra de cabeçalho do código
        doc
          .roundedRect(50, codeTop, 495, 22, 4)
          .fill("#1e293b");
        doc
          .rect(50, codeTop + 12, 495, 10)
          .fill("#1e293b");

        // Textos do cabeçalho
        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor("#94a3b8")
          .text(codeLang, 62, codeTop + 6.5);

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor("#f1f5f9")
          .text(codeTitle, 160, codeTop + 6.5, {
            width: 375,
            align: "right",
            ellipsis: true,
          });

        // Código em fonte Courier
        doc
          .font("Courier")
          .fontSize(7.5)
          .fillColor("#e2e8f0")
          .text(data.codeSuggestion.code, 62, codeTop + 28, {
            width: 471,
            lineGap: 2,
          });

        doc.y = codeTop + totalCodeHeight + 6;

        if (data.codeSuggestion.explanation) {
          checkPageBreak(25);
          doc
            .font("Helvetica-Oblique")
            .fontSize(7.5)
            .fillColor(mutedGray)
            .text(data.codeSuggestion.explanation, 50, doc.y, {
              width: 495,
              lineGap: 2,
              align: "justify",
            });
          doc.moveDown(0.4);
        }
      }

      // Diretrizes para Investigação
      if (data.investigationGuidelines && data.investigationGuidelines.length > 0) {
        checkPageBreak(35);
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(titleNavy)
          .text("DIRETRIZES RECOMENDADAS PARA INVESTIGAÇÃO", 50, doc.y);
        doc.moveDown(0.3);

        for (const guide of data.investigationGuidelines) {
          doc.font("Helvetica").fontSize(8);
          const gHeight = doc.heightOfString(guide, { width: 475, lineGap: 2 }) + 6;
          checkPageBreak(gHeight);

          doc
            .font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(tagTextColor)
            .text("• ", 50, doc.y, { continued: true });

          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(bodyDark)
            .text(guide, {
              width: 485,
              lineGap: 2,
            });
          doc.moveDown(0.25);
        }
        doc.moveDown(0.3);
      }
    }

    // -------------------------------------------------------------
    // 7. Seções Legadas / Retrocompatibilidade (Propostas e Detalhamento)
    // -------------------------------------------------------------
    if (data.proposals && data.proposals.length > 0) {
      drawSectionTitle("PROPOSTAS DE MELHORIA DE FLUXO DE TRABALHO");

      checkPageBreak(60);

      const tableTop = doc.y;
      const headerHeight = 22;
      const colItemW = 115;
      const colDescW = 225;
      const colCatW = 95;
      const colPrioW = 60;

      doc
        .rect(50, tableTop, 495, headerHeight)
        .fill(titleNavy);

      doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Item", 58, tableTop + 7, { width: colItemW - 10 });
      doc.text("Descrição da Funcionalidade", 50 + colItemW + 8, tableTop + 7, {
        width: colDescW - 16,
      });
      doc.text("Categoria", 50 + colItemW + colDescW + 8, tableTop + 7, {
        width: colCatW - 16,
        align: "center",
      });
      doc.text("Prioridade", 50 + colItemW + colDescW + colCatW + 8, tableTop + 7, {
        width: colPrioW - 16,
        align: "center",
      });

      let currentY = tableTop + headerHeight;

      data.proposals.forEach((prop) => {
        const descH = doc.heightOfString(prop.description, { width: colDescW - 16, lineGap: 2 });
        const itemH = doc.heightOfString(prop.item, { width: colItemW - 14, lineGap: 2 });
        const rowHeight = Math.max(descH, itemH, 26) + 12;

        checkPageBreak(rowHeight + 10);
        if (doc.y !== currentY) {
          currentY = doc.y;
        }

        doc
          .rect(50, currentY, 495, rowHeight)
          .strokeColor(borderGray)
          .lineWidth(0.7)
          .stroke();

        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor(titleNavy)
          .text(prop.item, 58, currentY + 8, { width: colItemW - 14, lineGap: 1.5 });

        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(bodyDark)
          .text(prop.description, 50 + colItemW + 8, currentY + 8, {
            width: colDescW - 16,
            lineGap: 2,
            align: "justify",
          });

        const badgeWidth = 84;
        const badgeHeight = 16;
        const badgeX = 50 + colItemW + colDescW + (colCatW - badgeWidth) / 2;
        const badgeY = currentY + (rowHeight - badgeHeight) / 2;

        doc
          .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3)
          .fillAndStroke(tagBg, tagBorder);

        doc
          .fontSize(7)
          .font("Helvetica-Bold")
          .fillColor(tagTextColor)
          .text(prop.category.toUpperCase(), badgeX, badgeY + 4, {
            width: badgeWidth,
            align: "center",
          });

        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(bodyDark)
          .text(prop.priority, 50 + colItemW + colDescW + colCatW + 8, currentY + (rowHeight - 8) / 2 - 2, {
            width: colPrioW - 16,
            align: "center",
          });

        currentY += rowHeight;
        doc.y = currentY;
      });

      doc.y += 14;
    }

    if (data.detailingTopic || (data.detailingParagraphs && data.detailingParagraphs.length > 0)) {
      drawSectionTitle("DETALHAMENTO E JUSTIFICATIVA DA SUGESTÃO");

      if (data.detailingTopic) {
        checkPageBreak(25);
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor(titleNavy)
          .text(data.detailingTopic, 50, doc.y);
        doc.moveDown(0.25);
      }

      if (data.detailingParagraphs && data.detailingParagraphs.length > 0) {
        data.detailingParagraphs.forEach((para) => {
          checkPageBreak(35);
          doc
            .fontSize(8.5)
            .font("Helvetica")
            .fillColor(bodyDark)
            .text(para, 50, doc.y, {
              width: 495,
              lineGap: 3,
              align: "justify",
            });
          doc.moveDown(0.4);
        });
      }
    }

    if (data.referrals) {
      drawSectionTitle("ENCAMINHAMENTOS E PRÓXIMOS PASSOS");
      checkPageBreak(35);
      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor(bodyDark)
        .text(data.referrals, 50, doc.y, {
          width: 495,
          lineGap: 3,
          align: "justify",
        });
      doc.moveDown(0.5);
    }

    // -------------------------------------------------------------
    // 8. Transcrição do Diálogo Registrado (se presente)
    // -------------------------------------------------------------
    if (data.transcript && data.transcript.length > 0) {
      drawSectionTitle("TRANSCRIÇÃO INTEGRAL DO DIÁLOGO REGISTRADO");

      data.transcript.forEach((line) => {
        const speakerLabel = `${line.speaker}${line.role ? ` (${line.role})` : ""}: `;
        const timestampLabel = `[${line.timestamp}] `;
        const fullContent = `${speakerLabel}${timestampLabel}${line.text}`;

        const itemHeight = doc.heightOfString(fullContent, { width: 495, lineGap: 2.5 }) + 6;
        checkPageBreak(itemHeight);

        doc
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .fillColor(titleNavy)
          .text(speakerLabel, 50, doc.y, { continued: true })
          .font("Helvetica")
          .fillColor(mutedGray)
          .text(timestampLabel, { continued: true })
          .font("Helvetica")
          .fillColor(bodyDark)
          .text(line.text, {
            width: 495,
            lineGap: 2.5,
            align: "justify",
          });

        doc.moveDown(0.35);
      });
    }

    // -------------------------------------------------------------
    // 9. Rodapé Institucional Padronizado em Todas as Páginas
    // -------------------------------------------------------------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Linha divisória fina
      doc
        .strokeColor(borderGray)
        .lineWidth(0.5)
        .moveTo(50, 785)
        .lineTo(545, 785)
        .stroke();

      // Texto institucional à esquerda
      const platformFooter = context.platform || data.platformAnalyzed || "Relix";
      const clientFooter = context.clientOrOffice || data.department || "Atendimento Geral";
      const leftFooterText = `Relatório Técnico de Suporte - ${platformFooter} (${clientFooter})`;

      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(mutedGray)
        .text(leftFooterText, 50, 793, {
          width: 380,
          lineBreak: false,
          ellipsis: true,
        });

      // Numeração de página à direita
      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(mutedGray)
        .text(`Página ${i + 1} de ${range.count}`, 440, 793, {
          width: 105,
          align: "right",
          lineBreak: false,
        });

      doc.page.margins.bottom = oldBottomMargin;
    }

    doc.end();
  });
}
