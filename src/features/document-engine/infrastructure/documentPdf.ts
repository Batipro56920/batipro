import { jsPDF } from "jspdf";
import { calculateDocumentTotals } from "../application/documentCalculations";
import { flattenDocumentNodes } from "../application/documentNumbering";
import type { BusinessDocument } from "../domain/types";

export function createBusinessDocumentPdf(document: BusinessDocument) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const rows = flattenDocumentNodes(document.nodes);
  const totals = document.totals ?? calculateDocumentTotals(document);
  let y = 22;

  pdf.setFillColor(15, 39, 71);
  pdf.rect(0, 0, 210, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(document.company.displayName || "Batipro", 14, 11);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(20);
  pdf.text(`${clean(document.title)} ${clean(document.number)}`, 14, y + 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Date : ${formatDate(document.issueDate)}`, 14, y + 26);

  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(118, y + 8, 78, 30, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.text(clean(document.recipient.displayName || "Destinataire"), 124, y + 18);
  pdf.setFont("helvetica", "normal");
  pdf.text(clean(document.siteAddress || document.recipient.address || "-"), 124, y + 25, { maxWidth: 64 });

  y = 68;
  drawTableHeader(pdf, y);
  y += 8;
  rows.forEach((row) => {
    if (y > 260) {
      pdf.addPage();
      y = 22;
      drawTableHeader(pdf, y);
      y += 8;
    }
    if (row.node.type === "section") {
      pdf.setFillColor(219, 234, 254);
      pdf.rect(14, y - 5, 182, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.text(`${row.number} ${clean(row.node.title)}`, 18, y);
      y += 8;
      return;
    }
    if (row.node.type === "subsection") {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(14, y - 5, 182, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.text(`${row.number} ${clean(row.node.title)}`, 20, y);
      y += 7;
      return;
    }
    if (row.node.type === "text") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const lines = pdf.splitTextToSize(clean(row.node.content), 160);
      pdf.text(lines, 22, y);
      y += Math.max(7, lines.length * 4.5) + 2;
      return;
    }
    if (row.node.type === "signature") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(clean(row.node.title || "Signature"), 22, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(clean(row.node.signerName || "A signer"), 70, y);
      y += 9;
      return;
    }
    if (row.node.type === "line" || row.node.type === "composite") {
      pdf.setFont("helvetica", "normal");
      pdf.text(row.number, 18, y);
      pdf.text(clean(row.node.title), 34, y, { maxWidth: 88 });
      pdf.text(String(row.node.quantity), 136, y, { align: "right" });
      pdf.text(formatCurrency(row.node.quantity * row.node.unitPriceHt), 194, y, { align: "right" });
      y += 7;
    }
  });

  if (y > 230) {
    pdf.addPage();
    y = 22;
  }
  pdf.setFont("helvetica", "bold");
  pdf.text("Total HT", 130, y + 10);
  pdf.text(formatCurrency(totals.totalHt), 194, y + 10, { align: "right" });
  pdf.text("TVA", 130, y + 17);
  pdf.text(formatCurrency(totals.totalVat), 194, y + 17, { align: "right" });
  pdf.setFillColor(59, 130, 246);
  pdf.rect(124, y + 23, 72, 11, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.text("TOTAL TTC", 130, y + 31);
  pdf.text(formatCurrency(totals.totalTtc), 194, y + 31, { align: "right" });

  return pdf;
}

export function downloadBusinessDocumentPdf(document: BusinessDocument) {
  createBusinessDocumentPdf(document).save(`${clean(document.number)}.pdf`);
}

function drawTableHeader(pdf: jsPDF, y: number) {
  pdf.setFillColor(59, 130, 246);
  pdf.rect(14, y - 5, 182, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("N", 18, y);
  pdf.text("Designation", 34, y);
  pdf.text("Qte", 136, y, { align: "right" });
  pdf.text("Total HT", 194, y, { align: "right" });
  pdf.setTextColor(15, 23, 42);
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function clean(value: string) {
  return value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
}
