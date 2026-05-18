import { jsPDF } from "jspdf";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import type { QuoteBuilderFlatRow, QuoteBuilderQuote } from "./types";

const PAGE = {
  width: 210,
  height: 297,
  marginX: 14,
  footerY: 286,
};

const COLORS = {
  navy: [15, 39, 71] as const,
  blue: [59, 130, 246] as const,
  softBlue: [219, 234, 254] as const,
  paleBlue: [239, 246, 255] as const,
  slate: [15, 23, 42] as const,
  muted: [100, 116, 139] as const,
  border: [226, 232, 240] as const,
  surface: [248, 250, 252] as const,
};

type PdfTotals = ReturnType<typeof calculateQuoteBuilderTotals>;

export function createQuoteBuilderPdf(quote: QuoteBuilderQuote) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const totals = calculateQuoteBuilderTotals(quote);
  const rows = flattenQuoteBuilder(quote.nodes);

  let y = drawFirstPageHeader(pdf, quote);
  y = drawQuoteTable(pdf, rows, y);
  y = ensureSpace(pdf, y + 8, 78);
  y = drawTotalsBlock(pdf, totals, y);
  y = drawLegalBlocks(pdf, quote, y + 8);
  drawSignatureBlock(pdf, y + 4);
  drawPageFooters(pdf);

  return pdf;
}

export function getQuoteBuilderPdfBlob(quote: QuoteBuilderQuote) {
  return createQuoteBuilderPdf(quote).output("blob");
}

export function downloadQuoteBuilderPdf(quote: QuoteBuilderQuote) {
  createQuoteBuilderPdf(quote).save(`${sanitizeFilename(quote.number)}.pdf`);
}

function drawFirstPageHeader(pdf: jsPDF, quote: QuoteBuilderQuote) {
  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, PAGE.width, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("BATIPRO / CB RENOVATION", PAGE.marginX, 11);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Devis travaux - document commercial", PAGE.marginX, 18);

  pdf.setTextColor(...COLORS.slate);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  pdf.text(`Devis ${clean(quote.number)}`, PAGE.marginX, 46);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(`Date : ${formatDate(quote.date)}`, PAGE.marginX, 54);
  pdf.text(`Valable jusqu'au : ${quote.validUntil ? formatDate(quote.validUntil) : "a definir"}`, PAGE.marginX, 60);
  if (quote.workStartDate) pdf.text(`Debut travaux : ${formatDate(quote.workStartDate)}`, PAGE.marginX, 66);
  if (quote.estimatedDurationValue) pdf.text(`Duree estimee : ${quote.estimatedDurationValue} ${quote.estimatedDurationUnit}`, PAGE.marginX, 72);

  drawCard(pdf, 118, 36, 78, 40, "Client", [clean(quote.clientName) || "Client a definir", clean(quote.siteAddress) || "Adresse chantier a definir"]);
  if (quote.description) {
    drawCard(pdf, PAGE.marginX, 82, 182, 24, "Projet", splitText(pdf, clean(quote.description), 168, 2));
    return 116;
  }
  return 86;
}

function drawCard(pdf: jsPDF, x: number, y: number, width: number, height: number, label: string, lines: string[]) {
  pdf.setDrawColor(...COLORS.border);
  pdf.setFillColor(...COLORS.surface);
  pdf.roundedRect(x, y, width, height, 2.5, 2.5, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(label.toUpperCase(), x + 5, y + 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...COLORS.slate);
  lines.slice(0, 4).forEach((line, index) => pdf.text(line || "-", x + 5, y + 15 + index * 6));
}

function drawQuoteTable(pdf: jsPDF, rows: QuoteBuilderFlatRow[], startY: number) {
  let y = startY;
  drawTableHeader(pdf, y);
  y += 9;

  for (const row of rows) {
    const rowHeight = estimateRowHeight(pdf, row);
    y = ensureSpace(pdf, y, rowHeight + 4, () => drawTableHeader(pdf, 22));
    if (y === 22) y += 9;

    if (row.node.type === "section") {
      pdf.setFillColor(...COLORS.softBlue);
      pdf.setDrawColor(...COLORS.border);
      pdf.rect(PAGE.marginX, y - 5, 182, rowHeight, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...COLORS.slate);
      pdf.text(`${row.number}  ${clean(row.node.title)}`, PAGE.marginX + 4, y);
      y += rowHeight;
      continue;
    }

    if (row.node.type === "subsection") {
      pdf.setFillColor(...COLORS.surface);
      pdf.rect(PAGE.marginX, y - 5, 182, rowHeight, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.slate);
      pdf.text(`${row.number}  ${clean(row.node.title)}`, PAGE.marginX + 8, y);
      y += rowHeight;
      continue;
    }

    pdf.setDrawColor(241, 245, 249);
    pdf.line(PAGE.marginX, y + rowHeight - 6, 196, y + rowHeight - 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLORS.slate);
    pdf.text(row.number, PAGE.marginX + 4, y);
    pdf.text(splitText(pdf, clean(row.node.title), 76), 42, y, { maxWidth: 76 });
    pdf.text(formatNumber(row.node.quantity), 126, y, { align: "right" });
    pdf.text(formatUnit(row.node.unit), 140, y);
    pdf.text(formatCurrency(row.node.unitPriceHt), 162, y, { align: "right" });
    pdf.text(`${row.node.vatRate}%`, 174, y, { align: "right" });
    pdf.setFont("helvetica", "bold");
    pdf.text(formatCurrency(row.totalHt), 194, y, { align: "right" });
    y += rowHeight;
  }

  return y;
}

function drawTableHeader(pdf: jsPDF, y: number) {
  pdf.setFillColor(...COLORS.blue);
  pdf.roundedRect(PAGE.marginX, y - 6, 182, 10, 1.5, 1.5, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("N°", PAGE.marginX + 4, y);
  pdf.text("Designation", 42, y);
  pdf.text("Qte", 126, y, { align: "right" });
  pdf.text("Unite", 140, y);
  pdf.text("PU HT", 162, y, { align: "right" });
  pdf.text("TVA", 174, y, { align: "right" });
  pdf.text("Total HT", 194, y, { align: "right" });
  pdf.setTextColor(...COLORS.slate);
}

function drawTotalsBlock(pdf: jsPDF, totals: PdfTotals, y: number) {
  const x = 116;
  pdf.setDrawColor(...COLORS.border);
  pdf.setFillColor(...COLORS.surface);
  pdf.roundedRect(x, y, 80, 36, 2.5, 2.5, "FD");
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.slate);
  pdf.text("Total HT", x + 6, y + 9);
  pdf.text(formatCurrency(totals.totalHt), x + 74, y + 9, { align: "right" });
  pdf.text("TVA", x + 6, y + 16);
  pdf.text(formatCurrency(totals.totalVat), x + 74, y + 16, { align: "right" });
  pdf.setFillColor(...COLORS.blue);
  pdf.rect(x, y + 23, 80, 13, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.text("NET A PAYER", x + 6, y + 31);
  pdf.text(formatCurrency(totals.totalTtc), x + 74, y + 31, { align: "right" });
  pdf.setTextColor(...COLORS.slate);

  return y + 36;
}

function drawLegalBlocks(pdf: jsPDF, quote: QuoteBuilderQuote, y: number) {
  y = drawTextBlock(pdf, "Conditions de paiement", quote.paymentTerms, y);
  y = drawTextBlock(pdf, "Gestion des dechets", "Gestion et evacuation des dechets selon les modalites prevues au devis.", y);
  y = drawTextBlock(pdf, "Mentions legales", quote.legalMentions, y);
  if (quote.footerNotes) y = drawTextBlock(pdf, "Notes", quote.footerNotes, y);
  return y;
}

function drawTextBlock(pdf: jsPDF, title: string, content: string, y: number) {
  const lines = splitText(pdf, clean(content || "-"), 176);
  const height = Math.max(16, 9 + lines.length * 4.5);
  y = ensureSpace(pdf, y, height);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(title, PAGE.marginX, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.2);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(lines, PAGE.marginX, y + 6, { maxWidth: 176 });
  return y + height;
}

function drawSignatureBlock(pdf: jsPDF, y: number) {
  y = ensureSpace(pdf, y, 40);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(118, y, 78, 34, 2.5, 2.5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Bon pour accord", 123, y + 8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Date, nom et signature du client", 123, y + 15);
}

function drawPageFooters(pdf: jsPDF) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...COLORS.border);
    pdf.line(PAGE.marginX, PAGE.footerY - 5, 196, PAGE.footerY - 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.muted);
    pdf.text("Batipro - Devis commercial", PAGE.marginX, PAGE.footerY);
    pdf.text(`Page ${page}/${pages}`, 196, PAGE.footerY, { align: "right" });
  }
}

function ensureSpace(pdf: jsPDF, y: number, height: number, onNewPage?: () => void) {
  if (y + height <= PAGE.footerY - 8) return y;
  pdf.addPage();
  const nextY = 22;
  onNewPage?.();
  return nextY;
}

function estimateRowHeight(pdf: jsPDF, row: QuoteBuilderFlatRow) {
  if (row.node.type === "section") return 11;
  if (row.node.type === "subsection") return 9;
  return Math.max(9, splitText(pdf, clean(row.node.title), 76).length * 5);
}

function splitText(pdf: jsPDF, value: string, maxWidth: number, maxLines?: number) {
  const lines = pdf.splitTextToSize(value || "-", maxWidth) as string[];
  return typeof maxLines === "number" ? lines.slice(0, maxLines) : lines;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatUnit(value: string) {
  if (value === "m2") return "m²";
  if (value === "m3") return "m³";
  return value;
}

function clean(value: string) {
  return value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
}

function sanitizeFilename(value: string) {
  return clean(value).replace(/[^a-z0-9_-]+/gi, "-");
}
