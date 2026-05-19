import { jsPDF } from "jspdf";
import { calculateDocumentTotals } from "../application/documentCalculations";
import { flattenDocumentNodes } from "../application/documentNumbering";
import { getDocumentTemplate } from "../domain/documentTemplates";
import type { BusinessDocument, DocumentItemNode, FlatDocumentNode } from "../domain/types";

const PAGE = { width: 210, height: 297, marginX: 14, contentWidth: 182, footerY: 285 };
const COLORS = {
  navy: [15, 39, 71] as const,
  blue: [37, 99, 235] as const,
  lightBlue: [219, 234, 254] as const,
  surface: [248, 250, 252] as const,
  border: [226, 232, 240] as const,
  slate: [15, 23, 42] as const,
  muted: [100, 116, 139] as const,
  white: [255, 255, 255] as const,
};

export function createBusinessDocumentPdf(document: BusinessDocument) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const rows = flattenDocumentNodes(document.nodes);
  const totals = document.totals ?? calculateDocumentTotals(document);
  const template = getDocumentTemplate(document);

  let y = drawHeader(pdf, document);
  y = drawDocumentTable(pdf, document, rows, y);
  y = drawTotals(pdf, document, totals, y + 8);
  y = drawTerms(pdf, document, y + 8);

  if (template.showSignature) {
    y = ensureSpace(pdf, y, 36, () => drawContinuationHeader(pdf, document));
    drawSignature(pdf, template.signatureLabel, y);
  }

  drawFooters(pdf, document);
  return pdf;
}

export function downloadBusinessDocumentPdf(document: BusinessDocument) {
  createBusinessDocumentPdf(document).save(`${sanitizeFilename(document.number)}.pdf`);
}

function drawHeader(pdf: jsPDF, document: BusinessDocument) {
  const template = getDocumentTemplate(document);

  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, PAGE.width, 30, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(safe(document.company.displayName || "Batipro"), PAGE.marginX, 11);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.3);
  pdf.text(safe(document.company.address || document.company.email || document.company.phone || "ERP chantier et rénovation"), PAGE.marginX, 18);
  if (document.company.siret) pdf.text(`SIRET ${safe(document.company.siret)}`, PAGE.marginX, 24);

  pdf.setFillColor(...COLORS.blue);
  pdf.roundedRect(142, 8, 54, 14, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.8);
  pdf.text(safe(template.accentLabel.toUpperCase()), 169, 17, { align: "center" });

  pdf.setTextColor(...COLORS.slate);
  pdf.setFontSize(22);
  pdf.text(`${safe(template.label)} ${safe(document.number)}`, PAGE.marginX, 48);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.6);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(`Date : ${formatDate(document.issueDate)}`, PAGE.marginX, 56);
  if (document.validityDate) pdf.text(`Validite : ${formatDate(document.validityDate)}`, PAGE.marginX, 62);
  if (document.dueDate) pdf.text(`Echeance : ${formatDate(document.dueDate)}`, PAGE.marginX, 68);

  drawInfoCard(pdf, 112, 38, 84, 38, template.recipientLabel, [
    document.recipient.displayName || "Destinataire a definir",
    document.recipient.contactName || "",
    document.siteAddress || document.recipient.address || "Adresse a definir",
    document.recipient.email || document.recipient.phone || "",
  ]);

  if (document.description) {
    const lines = split(pdf, safe(document.description), 168, 4);
    drawInfoCard(pdf, PAGE.marginX, 82, 182, Math.max(24, 14 + lines.length * 4.7), "Objet", lines);
    return 112;
  }

  return 86;
}

function drawDocumentTable(pdf: jsPDF, document: BusinessDocument, rows: FlatDocumentNode[], startY: number) {
  let y = startY;
  y = ensureSpace(pdf, y, 14, () => drawContinuationHeader(pdf, document));
  drawTableHeader(pdf, y);
  y += 9;

  rows.forEach((row) => {
    const height = rowHeight(pdf, row);
    y = ensureSpace(pdf, y, height + 2, () => {
      drawContinuationHeader(pdf, document);
      drawTableHeader(pdf, 42);
    });
    if (y === 42) y += 9;
    drawRow(pdf, row, y, height);
    y += height;
  });

  return y;
}

function drawRow(pdf: jsPDF, row: FlatDocumentNode, y: number, height: number) {
  if (row.node.type === "section") {
    pdf.setFillColor(...COLORS.lightBlue);
    pdf.setDrawColor(...COLORS.border);
    pdf.rect(PAGE.marginX, y - 5, PAGE.contentWidth, height, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...COLORS.slate);
    pdf.text(row.number, 18, y + 1);
    pdf.text(safe(row.node.title), 34, y + 1, { maxWidth: 132 });
    return;
  }

  if (row.node.type === "subsection") {
    pdf.setFillColor(...COLORS.surface);
    pdf.rect(PAGE.marginX, y - 5, PAGE.contentWidth, height, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.8);
    pdf.setTextColor(...COLORS.slate);
    pdf.text(row.number, 22, y);
    pdf.text(safe(row.node.title), 38, y, { maxWidth: 128 });
    return;
  }

  if (row.node.type === "text") {
    pdf.setDrawColor(...COLORS.border);
    pdf.line(PAGE.marginX, y + height - 5, 196, y + height - 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(split(pdf, safe(row.node.content), 160, 5), 22, y);
    return;
  }

  if (row.node.type === "pagebreak") {
    pdf.setTextColor(...COLORS.muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text("Saut de page", 22, y);
    return;
  }

  if (row.node.type === "signature") return;

  const item = row.node as DocumentItemNode;
  const total = item.quantity * item.unitPriceHt * (1 - (item.discountRate ?? 0) / 100);
  pdf.setDrawColor(241, 245, 249);
  pdf.line(PAGE.marginX, y + height - 5, 196, y + height - 5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.2);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(row.number, 18, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(safe(item.title), 34, y, { maxWidth: 78 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.4);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(kindLabel(item.kind), 34, y + 4.5);
  const notes = [item.description, item.clientNotes].filter(Boolean).join(" - ");
  if (notes) pdf.text(split(pdf, safe(notes), 80, 3), 34, y + 9);
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(formatNumber(item.quantity), 126, y, { align: "right" });
  pdf.text(unitLabel(item.unit), 140, y);
  pdf.text(formatCurrency(item.unitPriceHt), 163, y, { align: "right" });
  pdf.text(`${formatNumber(item.vatRate)}%`, 176, y, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.text(formatCurrency(total), 194, y, { align: "right" });
}

function drawTotals(pdf: jsPDF, document: BusinessDocument, totals: NonNullable<BusinessDocument["totals"]>, startY: number) {
  let y = ensureSpace(pdf, startY, 58, () => drawContinuationHeader(pdf, document));
  const x = 118;
  const w = 78;
  pdf.setFillColor(...COLORS.surface);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(x, y, w, 48, 3, 3, "FD");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...COLORS.slate);
  totalLine(pdf, "Total HT", totals.totalHt, x + 6, y + 9);
  totalLine(pdf, "TVA", totals.totalVat, x + 6, y + 17);
  pdf.setFont("helvetica", "bold");
  totalLine(pdf, "Total TTC", totals.totalTtc, x + 6, y + 26);
  pdf.setFillColor(...COLORS.blue);
  pdf.roundedRect(x + 4, y + 32, w - 8, 11, 2, 2, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.text("NET A PAYER", x + 8, y + 39);
  pdf.text(formatCurrency(totals.totalTtc), x + w - 8, y + 39, { align: "right" });
  pdf.setTextColor(...COLORS.slate);

  if (totals.vatBreakdown.length) {
    y += 58;
    y = ensureSpace(pdf, y, 12 + totals.vatBreakdown.length * 7, () => drawContinuationHeader(pdf, document));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("Ventilation TVA", PAGE.marginX, y);
    pdf.setFont("helvetica", "normal");
    totals.vatBreakdown.forEach((line, index) => {
      const rowY = y + 8 + index * 6;
      pdf.text(`${formatNumber(line.rate)}%`, PAGE.marginX, rowY);
      pdf.text(formatCurrency(line.baseHt), 72, rowY, { align: "right" });
      pdf.text(formatCurrency(line.vatAmount), 112, rowY, { align: "right" });
    });
  }

  return y + 10 + totals.vatBreakdown.length * 6;
}

function drawTerms(pdf: jsPDF, document: BusinessDocument, startY: number) {
  const template = getDocumentTemplate(document);
  const blocks = [
    [template.legalBlockTitle, document.terms.paymentTerms],
    ["Mentions legales", document.terms.legalMentions],
    ["Gestion des dechets", document.terms.wasteManagement],
    ["Notes", document.terms.footerNotes],
  ].filter(([, value]) => String(value ?? "").trim());

  let y = startY;
  blocks.forEach(([title, value]) => {
    const lines = split(pdf, safe(String(value)), 170, 8);
    const height = 11 + lines.length * 4.3;
    y = ensureSpace(pdf, y, height, () => drawContinuationHeader(pdf, document));
    pdf.setFillColor(...COLORS.surface);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(PAGE.marginX, y, PAGE.contentWidth, height, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.2);
    pdf.setTextColor(...COLORS.slate);
    pdf.text(safe(String(title)), PAGE.marginX + 5, y + 7);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(lines, PAGE.marginX + 5, y + 13);
    y += height + 5;
  });

  return y;
}

function drawSignature(pdf: jsPDF, label: string, y: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...COLORS.slate);
  pdf.text(safe(label), PAGE.marginX, y);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(PAGE.marginX, y + 5, 82, 24, 2, 2);
  pdf.roundedRect(114, y + 5, 82, 24, 2, 2);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Client", PAGE.marginX + 5, y + 13);
  pdf.text("Entreprise", 119, y + 13);
}

function drawContinuationHeader(pdf: jsPDF, document: BusinessDocument) {
  const template = getDocumentTemplate(document);
  pdf.addPage();
  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, PAGE.width, 22, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(`${safe(template.label)} ${safe(document.number)}`, PAGE.marginX, 13);
  pdf.setFont("helvetica", "normal");
  pdf.text(safe(document.recipient.displayName || "Destinataire"), 118, 13);
  pdf.setTextColor(...COLORS.slate);
}

function drawFooters(pdf: jsPDF, document: BusinessDocument) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...COLORS.border);
    pdf.line(PAGE.marginX, PAGE.footerY - 6, 196, PAGE.footerY - 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(safe([document.company.displayName, document.company.phone, document.company.email].filter(Boolean).join(" | ")), PAGE.marginX, PAGE.footerY);
    pdf.text(`${page}/${pages}`, 196, PAGE.footerY, { align: "right" });
  }
}

function drawInfoCard(pdf: jsPDF, x: number, y: number, width: number, height: number, title: string, lines: string[]) {
  pdf.setFillColor(...COLORS.surface);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(x, y, width, height, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(safe(title.toUpperCase()), x + 5, y + 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.7);
  pdf.setTextColor(...COLORS.slate);
  lines.filter(Boolean).slice(0, 6).forEach((line, index) => pdf.text(safe(line), x + 5, y + 15 + index * 4.7, { maxWidth: width - 10 }));
}

function drawTableHeader(pdf: jsPDF, y: number) {
  pdf.setFillColor(...COLORS.blue);
  pdf.roundedRect(PAGE.marginX, y - 6, PAGE.contentWidth, 10, 1.5, 1.5, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.6);
  pdf.text("N", 18, y);
  pdf.text("Designation", 34, y);
  pdf.text("Qte", 126, y, { align: "right" });
  pdf.text("Unite", 140, y);
  pdf.text("PU HT", 163, y, { align: "right" });
  pdf.text("TVA", 176, y, { align: "right" });
  pdf.text("Total HT", 194, y, { align: "right" });
  pdf.setTextColor(...COLORS.slate);
}

function totalLine(pdf: jsPDF, label: string, value: number, x: number, y: number) {
  pdf.text(label, x, y);
  pdf.text(formatCurrency(value), 190, y, { align: "right" });
}

function rowHeight(pdf: jsPDF, row: FlatDocumentNode) {
  if (row.node.type === "section") return 11;
  if (row.node.type === "subsection") return 9;
  if (row.node.type === "text") return Math.max(9, split(pdf, safe(row.node.content), 160, 8).length * 4.5 + 3);
  if (row.node.type === "pagebreak") return 7;
  if (row.node.type === "signature") return 0;
  const item = row.node as DocumentItemNode;
  const notes = [item.description, item.clientNotes].filter(Boolean).join(" - ");
  return Math.max(8, 9 + split(pdf, safe(notes), 80, 4).length * 4);
}

function ensureSpace(_pdf: jsPDF, y: number, required: number, onNewPage: () => void) {
  if (y + required <= 270) return y;
  onNewPage();
  return 42;
}

function split(pdf: jsPDF, text: string, width: number, maxLines: number) {
  const lines = pdf.splitTextToSize(text || "", width) as string[];
  return lines.slice(0, maxLines);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value || 0);
}

function unitLabel(value: string) {
  if (value === "m2") return "m²";
  if (value === "m3") return "m³";
  return value;
}

function kindLabel(value: string) {
  const labels: Record<string, string> = {
    fourniture: "Fourniture",
    main_oeuvre: "Main d'oeuvre",
    sous_traitance: "Sous-traitance",
    materiel: "Materiel",
    divers: "Divers",
    ouvrage: "Ouvrage",
    frais: "Frais",
  };
  return labels[value] ?? value;
}

function sanitizeFilename(value: string) {
  return safe(value).replace(/[^a-zA-Z0-9._-]+/g, "_") || "document";
}

function safe(value: string) {
  return String(value ?? "")
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[•]/g, "-");
}
