import PDFDocument from "pdfkit";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { StructuredReportData, WorkLogContext } from "./gemini";

const REPORTS_DIR = path.join(process.cwd(), "storage", "reports");

async function ensureReportsDir() {
  try {
    await fsp.access(REPORTS_DIR);
  } catch {
    await fsp.mkdir(REPORTS_DIR, { recursive: true });
  }
}

interface GeneratePdfOptions {
  workLogId: string;
  data: StructuredReportData;
  context: WorkLogContext;
}

export async function generateReportPdf({
  workLogId,
  data,
  context,
}: GeneratePdfOptions): Promise<string> {
  await ensureReportsDir();

  const fileName = `relatorio-${workLogId}-${Date.now()}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4", // 595.28 x 841.89 pt
      margins: { top: 48, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: data.title || "Relatório de Sugestões de Melhoria no Sistema",
        Author: "HubSupport AI",
        Subject: `Atendimento ${workLogId}`,
      },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Paleta de cores corporativa baseada no modelo
    const accentBlue = "#2563eb"; // Barra de destaque e badges
    const titleNavy = "#0f172a"; // Títulos principais e cabeçalho de tabela
    const subtitleGray = "#475569"; // Subtítulo
    const sectionBlue = "#1e3a8a"; // Títulos de seções numeradas
    const bodyDark = "#334155"; // Texto padrão
    const mutedGray = "#64748b"; // Metadados e rodapés
    const borderGray = "#e2e8f0"; // Bordas
    const boxBg = "#f8fafc"; // Fundo do Resumo Executivo
    const badgeBg = "#dbeafe"; // Fundo da tag de Categoria
    const badgeText = "#1d4ed8"; // Texto da tag de Categoria

    const PAGE_BOTTOM_LIMIT = 745;

    function checkPageBreak(neededHeight: number) {
      if (doc.y + neededHeight > PAGE_BOTTOM_LIMIT) {
        doc.addPage();
        doc.y = 48;
      }
    }

    // 1. Cabeçalho com barra vertical azul
    const headerStartY = doc.y;
    const titleText = data.title || "Relatório de Sugestões de Melhoria no Sistema";
    const subtitleText = data.subtitle || `Solicitação de Atendimento - ${context.clientOrOffice}`;

    // Barra vertical azul na esquerda
    doc
      .rect(50, headerStartY, 3.5, 36)
      .fill(accentBlue);

    // Título Principal
    doc
      .fontSize(15)
      .font("Helvetica-Bold")
      .fillColor(titleNavy)
      .text(titleText, 60, headerStartY, { width: 485 });

    // Subtítulo
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(subtitleGray)
      .text(subtitleText, 60, headerStartY + 20, { width: 485 });

    doc.y = headerStartY + 45;

    // 2. Metadados (Data, Departamento, Participantes, Plataforma Analisada)
    const metaY1 = doc.y;
    const dateStr = data.date || new Date(context.createdAt).toLocaleDateString("pt-BR");
    const deptStr = data.department || `${context.clientOrOffice}`;
    const participantsStr = data.participants || `${context.requester} (Operação), ${context.authorName} (Suporte)`;
    const platformStr = data.platformAnalyzed || "Sistema Web ERP";

    // Coluna 1 Linha 1 (Data)
    doc
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .fillColor(titleNavy)
      .text("Data: ", 50, metaY1, { continued: true, width: 215 })
      .font("Helvetica")
      .fillColor(bodyDark)
      .text(dateStr, { width: 215 });

    // Coluna 2 Linha 1 (Departamento)
    doc
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .fillColor(titleNavy)
      .text("Departamento: ", 275, metaY1, { continued: true, width: 270 })
      .font("Helvetica")
      .fillColor(bodyDark)
      .text(deptStr, { width: 270, ellipsis: true });

    // Coluna 1 Linha 2 (Participantes)
    const metaY2 = metaY1 + 14;
    doc
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .fillColor(titleNavy)
      .text("Participantes: ", 50, metaY2, { continued: true, width: 215 })
      .font("Helvetica")
      .fillColor(bodyDark)
      .text(participantsStr, { width: 215, ellipsis: true });

    // Coluna 2 Linha 2 (Plataforma Analisada)
    doc
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .fillColor(titleNavy)
      .text("Plataforma Analisada: ", 275, metaY2, { continued: true, width: 270 })
      .font("Helvetica")
      .fillColor(bodyDark)
      .text(platformStr, { width: 270, ellipsis: true });

    doc.y = metaY2 + 22;

    // 3. Resumo Executivo em caixa com fundo cinza-claro
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
        .fontSize(9.5)
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

      doc.y = boxTop + boxHeight + 16;
    }

    // Função auxiliar para títulos de seções
    function drawSectionTitle(title: string) {
      checkPageBreak(35);
      doc.moveDown(0.3);
      doc
        .fontSize(10.5)
        .font("Helvetica-Bold")
        .fillColor(sectionBlue)
        .text(title.toUpperCase(), 50, doc.y, { characterSpacing: 0.3 });
      doc.moveDown(0.35);
    }

    // 4. Seção 1: PROPOSTAS DE MELHORIA DE FLUXO DE TRABALHO (Tabela)
    if (data.proposals && data.proposals.length > 0) {
      drawSectionTitle("1. PROPOSTAS DE MELHORIA DE FLUXO DE TRABALHO");

      checkPageBreak(60);

      const tableTop = doc.y;
      const headerHeight = 22;
      const colItemW = 115;
      const colDescW = 225;
      const colCatW = 95;
      const colPrioW = 60;

      // Fundo escuro do cabeçalho da tabela
      doc
        .rect(50, tableTop, 495, headerHeight)
        .fill(titleNavy);

      // Textos do cabeçalho
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Item", 58, tableTop + 7, { width: colItemW - 10 });
      doc.text("Descrição da Funcionalidade", 50 + colItemW + 8, tableTop + 7, { width: colDescW - 16 });
      doc.text("Categoria", 50 + colItemW + colDescW + 8, tableTop + 7, { width: colCatW - 16, align: "center" });
      doc.text("Prioridade", 50 + colItemW + colDescW + colCatW + 8, tableTop + 7, { width: colPrioW - 16, align: "center" });

      let currentY = tableTop + headerHeight;

      data.proposals.forEach((prop) => {
        const descH = doc.heightOfString(prop.description, { width: colDescW - 16, lineGap: 2 });
        const itemH = doc.heightOfString(prop.item, { width: colItemW - 14, lineGap: 2 });
        const rowHeight = Math.max(descH, itemH, 26) + 12;

        checkPageBreak(rowHeight + 10);
        if (doc.y !== currentY) {
          currentY = doc.y;
        }

        // Borda da linha da tabela
        doc
          .rect(50, currentY, 495, rowHeight)
          .strokeColor(borderGray)
          .lineWidth(0.7)
          .stroke();

        // Coluna 1: Item
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor(titleNavy)
          .text(prop.item, 58, currentY + 8, { width: colItemW - 14, lineGap: 1.5 });

        // Coluna 2: Descrição da Funcionalidade
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(bodyDark)
          .text(prop.description, 50 + colItemW + 8, currentY + 8, {
            width: colDescW - 16,
            lineGap: 2,
            align: "justify",
          });

        // Coluna 3: Categoria (Badge estilo pill azul)
        const badgeWidth = 84;
        const badgeHeight = 16;
        const badgeX = 50 + colItemW + colDescW + (colCatW - badgeWidth) / 2;
        const badgeY = currentY + (rowHeight - badgeHeight) / 2;

        doc
          .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3)
          .fillAndStroke(badgeBg, "#bfdbfe");

        doc
          .fontSize(7)
          .font("Helvetica-Bold")
          .fillColor(badgeText)
          .text(prop.category.toUpperCase(), badgeX, badgeY + 4, {
            width: badgeWidth,
            align: "center",
          });

        // Coluna 4: Prioridade
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

    // 5. Seção 2: DETALHAMENTO E JUSTIFICATIVA DA SUGESTÃO
    drawSectionTitle("2. DETALHAMENTO E JUSTIFICATIVA DA SUGESTÃO");

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

    // 6. Seção 3: ENCAMINHAMENTOS DA REUNIÃO
    if (data.referrals) {
      drawSectionTitle("3. ENCAMINHAMENTOS DA REUNIÃO");
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

    // 7. Seção 4: TRANSCRIÇÃO INTEGRAL DO ÁUDIO DA REUNIÃO
    if (data.transcript && data.transcript.length > 0) {
      drawSectionTitle("4. TRANSCRIÇÃO INTEGRAL DO ÁUDIO DA REUNIÃO");

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

    // 8. Rodapé corporativo padronizado em todas as páginas
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Linha separadora do rodapé
      doc
        .strokeColor(borderGray)
        .lineWidth(0.5)
        .moveTo(50, 785)
        .lineTo(545, 785)
        .stroke();

      // Texto institucional à esquerda
      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(mutedGray)
        .text(
          "Relatório de Sugestões de Fluxo & Transcrição",
          50,
          793,
          { width: 350, lineBreak: false }
        );

      // Numeração de página à direita
      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(mutedGray)
        .text(`Página ${i + 1} de ${range.count}`, 450, 793, {
          width: 95,
          align: "right",
          lineBreak: false,
        });

      doc.page.margins.bottom = oldBottomMargin;
    }

    doc.end();

    stream.on("finish", () => {
      resolve(filePath);
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}
