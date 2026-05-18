import { jsPDF } from "jspdf";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import { validateQuoteBuilderForDocumentEngine } from "./quoteBuilderDocumentAdapter";
import type { QuoteBuilderFlatRow, QuoteBuilderItem, QuoteBuilderQuote } from "./types";

const PAGE = { width: 210, height: 297, marginX: 14, contentWidth: 182, footerY: 284 };

const COLORS = {
  navy: [15, 39, 71] as const,
  blue: [59, 130, 246] as const,
  blueDark: [37, 99, 235] as const,
  section: [219, 234, 254] as const,
  subsection: [241, 245, 249] as const,
  surface: [248, 250, 252] as const,
  border: [226, 232, 240] as const,
  slate: [15, 23, 42] as const,
  muted: [100, 116, 139] as const,
  white: [255, 255, 255] as const,
};

type PdfTotals = ReturnType<typeof calculateQuoteBuilderTotals>;

export function createQuoteBuilderPdf(quote: QuoteBuilderQuote) {
  validateQuoteBuilderForDocumentEngine(quote);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const rows = flattenQuoteBuilder(quote.nodes);
  const totals = calculateQuoteBuilderTotals(quote);

  let y = drawCoverHeader(pdf, quote);
  y = drawQuoteTable(pdf, quote, rows, y);
  y = drawFinancialSummary(pdf, totals, y + 8);
  y = drawCommercialConditions(pdf, quote, y + 8);
  drawSignatureBlock(pdf, y + 4);
  drawFooters(pdf, quote);

  return pdf;
}

export function getQuoteBuilderPdfBlob(quote: QuoteBuilderQuote) {
  return createQuoteBuilderPdf(quote).output("blob");
}

export function downloadQuoteBuilderPdf(quote: QuoteBuilderQuote) {
  createQuoteBuilderPdf(quote).save(`${sanitizeFilename(quote.number)}.pdf`);
}

function drawCoverHeader(pdf: jsPDF, quote: QuoteBuilderQuote) {
  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, PAGE.width, 30, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("CB RENOVATION", PAGE.marginX, 11);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("Entreprise de renovation - Devis travaux", PAGE.marginX, 18);
  pdf.text("SIRET / assurance decennale / RC Pro a renseigner", PAGE.marginX, 24);

  pdf.setFillColor(...COLORS.blue);
  pdf.roundedRect(144, 8, 52, 14, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("DEVIS", 153, 17);

  pdf.setTextColor(...COLORS.slate);
  pdf.setFontSize(22);
  pdf.text(`Devis ${clean(quote.number)}`, PAGE.marginX, 46);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(`Date : ${formatDate(quote.date)}`, PAGE.marginX, 54);
  pdf.text(`Validite : ${quote.validUntil ? formatDate(quote.validUntil) : "a definir"}`, PAGE.marginX, 60);
  if (quote.workStartDate) pdf.text(`Debut travaux : ${formatDate(quote.workStartDate)}`, PAGE.marginX, 66);
  if (quote.estimatedDurationValue) pdf.text(`Duree estimee : ${quote.estimatedDurationValue} ${quote.estimatedDurationUnit}`, PAGE.marginX, 72);

  drawInfoCard(pdf, 112, 38, 84, 38, "Client", [
    clean(quote.clientName) || "Client a definir",
    clean(quote.siteAddress) || "Adresse chantier a definir",
  ]);

  const description = clean(quote.description || "");
  if (description) {
    const lines = split(pdf, description, 168, 4);
    drawInfoCard(pdf, PAGE.marginX, 82, 182, Math.max(26, 14 + lines.length * 5), "Projet", lines);
    return 116;
  }

  return 86;
}

function drawInfoCard(pdf: jsPDF, x: number, y: number, width: number, height: number, title: string, lines: string[]) {
  pdf.setFillColor(...COLORS.surface);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(x, y, width, height, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(title.toUpperCase(), x + 5, y + 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.2);
  pdf.setTextColor(...COLORS.slate);
  lines.slice(0, 6).forEach((line, index) => pdf.text(line || "-", x + 5, y + 15 + index * 5));
}

function drawQuoteTable(pdf: jsPDF, quote: QuoteBuilderQuote, rows: QuoteBuilderFlatRow[], startY: number) {
  let y = startY;
  y = ensureSpace(pdf, y, 13, () => drawContinuationHeader(pdf, quote));
  drawTableHeader(pdf, y);
  y += 9;

  rows.forEach((row) => {
    if (row.node.type === "section") {
      const height = 11;
      y = ensureSpace(pdf, y, height + 2, () => {
        drawContinuationHeader(pdf, quote);
        drawTableHeader(pdf, 42);
      });
      if (y === 42) y += 9;
      drawSectionRow(pdf, row, sectionSubtotal(row, rows), y);
      y += height;
      return;
    }

    if (row.node.type === "subsection") {
      const height = 9;
      y = ensureSpace(pdf, y, height + 2, () => {
        drawContinuationHeader(pdf, quote);
        drawTableHeader(pdf, 42);
      });
      if (y === 42) y += 9;
      drawSubsectionRow(pdf, row, y);
      y += height;
      return;
    }

    const item = row.node as QuoteBuilderItem;
    const height = itemRowHeight(pdf, item, quote);
    y = ensureSpace(pdf, y, height + 2, () => {
      drawContinuationHeader(pdf, quote);
      drawTableHeader(pdf, 42);
    });
    if (y === 42) y += 9;
    drawItemRow(pdf, row, item, quote, y, height);
    y += height;
  });

  return y;
}

function drawContinuationHeader(pdf: jsPDF, quote: QuoteBuilderQuote) {
  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, PAGE.width, 22, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(`Devis ${clean(quote.number)}`, PAGE.marginX, 13);
  pdf.setFont("helvetica", "normal");
  pdf.text(clean(quote.clientName) || "Client", 118, 13);
  pdf.setTextColor(...COLORS.slate);
}

function drawTableHeader(pdf: jsPDF, y: number) {
  pdf.setFillColor(...COLORS.blueDark);
  pdf.roundedRect(PAGE.marginX, y - 6, PAGE.contentWidth, 10, 1.5, 1.5, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  pdf.text("N", 18, y);
  pdf.text("Designation", 34, y);
  pdf.text("Qte", 126, y, { align: "right" });
  pdf.text("Unite", 140, y);
  pdf.text("PU HT", 161, y, { align: "right" });
  pdf.text("TVA", 174, y, { align: "right" });
  pdf.text("Total HT", 194, y, { align: "right" });
  pdf.setTextColor(...COLORS.slate);
}

function drawSectionRow(pdf: jsPDF, row: QuoteBuilderFlatRow, subtotal: number, y: number) {
  pdf.setFillColor(...COLORS.section);
  pdf.setDrawColor(...COLORS.border);
  pdf.rect(PAGE.marginX, y - 5, PAGE.contentWidth, 11, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(row.number, 18, y + 1);
  pdf.text(`Lot - ${clean(row.node.title)}`, 34, y + 1, { maxWidth: 112 });
  pdf.setFontSize(8.5);
  pdf.text(`Sous-total ${formatCurrency(subtotal)}`, 194, y + 1, { align: "right" });
}

function drawSubsectionRow(pdf: jsPDF, row: QuoteBuilderFlatRow, y: number) {
  pdf.setFillColor(...COLORS.subsection);
  pdf.rect(PAGE.marginX, y - 5, PAGE.contentWidth, 9, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(row.number, 22, y);
  pdf.text(clean(row.node.title), 38, y, { maxWidth: 120 });
}

function drawItemRow(pdf: jsPDF, row: QuoteBuilderFlatRow, item: QuoteBuilderItem, quote: QuoteBuilderQuote, y: number, height: number) {
  pdf.setDrawColor(241, 245, 249);
  pdf.line(PAGE.marginX, y + height - 5, 196, y + height - 5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.4);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(row.number, 18, y);

  pdf.setFont("helvetica", "bold");
  pdf.text(clean(item.title), 34, y, { maxWidth: 80 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.4);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(kindLabel(item.kind), 34, y + 4.5);

  let noteY = y + 9;
  const notes = [item.description, item.clientNote].filter(Boolean).join(" - ");
  if (notes) {
    pdf.text(split(pdf, clean(notes), 82, 3), 34, noteY, { maxWidth: 82 });
    noteY += split(pdf, clean(notes), 82, 3).length * 4;
  }

  if (item.type === "item" && item.kind === "ouvrage" && item.compositeItems?.length && !quote.settings.hideCompositeDetails) {
    pdf.setFontSize(7);
    item.compositeItems.slice(0, 6).forEach((component) => {
      pdf.text(`- ${kindLabel(component.kind)} : ${clean(component.title)} (${formatNumber(component.quantity)} ${formatUnit(component.unit)})`, 38, noteY, { maxWidth: 78 });
      noteY += 3.6;
    });
  }

  pdf.setFontSize(8.3);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(formatNumber(item.quantity), 126, y, { align: "right" });
  pdf.text(formatUnit(item.unit), 140, y);
  pdf.text(formatCurrency(item.unitPriceHt), 161, y, { align: "right" });
  pdf.text(`${item.vatRate}%`, 174, y, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.text(formatCurrency(row.totalHt), 194, y, { align: "right" });
}

function drawFinancialSummary(pdf: jsPDF, totals: PdfTotals, y: number) {
  y = ensureSpace(pdf, y, 68);
  drawVatBreakdown(pdf, totals, PAGE.marginX, y);
  drawTotalsBlock(pdf, totals, 116, y);
  return y + 68;
}

function drawVatBreakdown(pdf: jsPDF, totals: PdfTotals, x: number, y: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.slate);
  pdf.text("Ventilation TVA", x, y + 5);
  pdf.setDrawColor(...COLORS.border);
  pdf.setFillColor(...COLORS.surface);
  pdf.roundedRect(x, y + 9, 86, 10 + Math.max(1, totals.vatBreakdown.length) * 7, 2.5, 2.5, "FD");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Taux", x + 5, y + 16);
  pdf.text("Base HT", x + 43, y + 16, { align: "right" });
  pdf.text("TVA", x + 80, y + 16, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.slate);
  totals.vatBreakdown.forEach((entry, index) => {
    const rowY = y + 23 + index * 7;
    pdf.text(`${entry.rate}%`, x + 5, rowY);
    pdf.text(formatCurrency(entry.baseHt), x + 43, rowY, { align: "right" });
    pdf.text(formatCurrency(entry.vat), x + 80, rowY, { align: "right" });
  });
}

function drawTotalsBlock(pdf: jsPDF, totals: PdfTotals, x: number, y: number) {
  pdf.setFillColor(...COLORS.surface);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(x, y, 80, 58, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.slate);
  drawMoneyLine(pdf, "Total HT", totals.totalHt, x + 6, y + 9);
  drawMoneyLine(pdf, "TVA", totals.totalVat, x + 6, y + 17);
  drawMoneyLine(pdf, "Total TTC", totals.totalTtc, x + 6, y + 25, true);
  pdf.setFillColor(...COLORS.blue);
  pdf.rect(x, y + 31, 80, 13, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.text("NET A PAYER", x + 6, y + 39);
  pdf.text(formatCurrency(totals.totalTtc), x + 74, y + 39, { align: "right" });
  pdf.setTextColor(...COLORS.slate);
  pdf.setFontSize(8);
  drawMoneyLine(pdf, `Acompte ${formatNumber((totals.depositTtc / Math.max(totals.totalTtc, 1)) * 100)}%`, totals.depositTtc, x + 6, y + 51);
  drawMoneyLine(pdf, "Reste a payer", totals.remainingTtc, x + 6, y + 58);
}

function drawMoneyLine(pdf: jsPDF, label: string, value: number, x: number, y: number, strong = false) {
  pdf.setFont("helvetica", strong ? "bold" : "normal");
  pdf.text(label, x, y);
  pdf.text(formatCurrency(value), x + 68, y, { align: "right" });
}

function drawCommercialConditions(pdf: jsPDF, quote: QuoteBuilderQuote, y: number) {
  y = drawTextBlock(pdf, "Conditions de paiement", quote.paymentTerms, y);
  y = drawTextBlock(pdf, "Gestion des dechets", "Gestion et evacuation des dechets selon les modalites prevues au devis.", y);
  y = drawTextBlock(pdf, "Mentions legales", quote.legalMentions, y);
  if (quote.footerNotes) y = drawTextBlock(pdf, "Notes de bas de page", quote.footerNotes, y);
  return y;
}

function drawTextBlock(pdf: jsPDF, title: string, content: string, y: number) {
  const lines = split(pdf, clean(content || "-"), 174);
  const height = Math.max(18, 11 + lines.length * 4.2);
  y = ensureSpace(pdf, y, height);
  pdf.setFillColor(...COLORS.surface);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(PAGE.marginX, y, PAGE.contentWidth, height - 3, 2.5, 2.5, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(title, PAGE.marginX + 5, y + 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(lines, PAGE.marginX + 5, y + 13, { maxWidth: 172 });
  return y + height;
}

function drawSignatureBlock(pdf: jsPDF, y: number) {
  y = ensureSpace(pdf, y, 46);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.slate);
  pdf.text("Acceptation du devis", PAGE.marginX, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Le client reconnait avoir pris connaissance du devis et des conditions associees.", PAGE.marginX, y + 11, { maxWidth: 92 });

  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(118, y, 78, 36, 2.5, 2.5);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Bon pour accord", 123, y + 8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Date, nom et signature du client", 123, y + 15);
}

function drawFooters(pdf: jsPDF, quote: QuoteBuilderQuote) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...COLORS.border);
    pdf.line(PAGE.marginX, PAGE.footerY - 5, 196, PAGE.footerY - 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`Batipro - ${clean(quote.number)}`, PAGE.marginX, PAGE.footerY);
    pdf.text(`Page ${page}/${pages}`, 196, PAGE.footerY, { align: "right" });
  }
}

function ensureSpace(pdf: jsPDF, y: number, height: number, onNewPage?: () => void) {
  if (y + height <= PAGE.footerY - 8) return y;
  pdf.addPage();
  onNewPage?.();
  return onNewPage ? 42 : 22;
}

function itemRowHeight(pdf: jsPDF, item: QuoteBuilderItem, quote: QuoteBuilderQuote) {
  const titleLines = split(pdf, clean(item.title), 80).length;
  const noteLines = split(pdf, clean([item.description, item.clientNote].filter(Boolean).join(" - ")), 82, 3).length;
  const componentLines = item.kind === "ouvrage" && item.compositeItems?.length && !quote.settings.hideCompositeDetails ? Math.min(item.compositeItems.length, 6) : 0;
  return Math.max(10, 6 + titleLines * 4 + noteLines * 4 + componentLines * 3.6);
}

function sectionSubtotal(row: QuoteBuilderFlatRow, rows: QuoteBuilderFlatRow[]) {
  return rows
    .filter((candidate) => candidate.node.type === "item" && candidate.number.startsWith(`${row.number}.`))
    .reduce((sum, candidate) => sum + candidate.totalHt, 0);
}

function split(pdf: jsPDF, value: string, maxWidth: number, maxLines?: number) {
  const content = value.trim() || "-";
  const lines = pdf.splitTextToSize(content, maxWidth) as string[];
  return typeof maxLines === "number" ? lines.slice(0, maxLines) : lines;
}

function kindLabel(kind: string) {
  if (kind === "main_oeuvre") return "Main d'oeuvre";
  if (kind === "sous_traitance") return "Sous-traitance";
  if (kind === "materiel") return "Materiel";
  if (kind === "ouvrage") return "Ouvrage compose";
  if (kind === "divers") return "Divers";
  return "Fourniture";
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function formatUnit(value: string) {
  if (value === "m2") return "m2";
  if (value === "m3") return "m3";
  return value;
}

function clean(value: string) {
  return value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
}

function sanitizeFilename(value: string) {
  return clean(value).replace(/[^a-z0-9_-]+/gi, "-");
}
