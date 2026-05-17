import { jsPDF } from "jspdf";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import type { QuoteBuilderQuote } from "./types";

export function downloadQuoteBuilderPdf(quote: QuoteBuilderQuote) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const totals = calculateQuoteBuilderTotals(quote);
  let y = 18;

  drawCompanyHeader(pdf);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(`Devis n° ${quote.number}`, 14, y + 28);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Date : ${formatDate(quote.date)}`, 14, y + 36);
  pdf.text(`Validite : ${quote.validUntil ? formatDate(quote.validUntil) : "a definir"}`, 14, y + 42);

  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(122, 22, 74, 34, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.text(safe(quote.clientName), 126, 32);
  pdf.setFont("helvetica", "normal");
  pdf.text(safe(quote.siteAddress || "-"), 126, 39, { maxWidth: 62 });

  y = 68;
  if (quote.description) {
    pdf.setFont("helvetica", "normal");
    pdf.text(safe(quote.description), 14, y, { maxWidth: 180 });
    y += 16;
  }

  drawTableHeader(pdf, y);
  y += 8;
  for (const row of flattenQuoteBuilder(quote.nodes)) {
    if (y > 260) {
      pdf.addPage();
      y = 18;
      drawTableHeader(pdf, y);
      y += 8;
    }
    if (row.node.type === "section") {
      pdf.setFillColor(219, 234, 254);
      pdf.rect(14, y - 5, 182, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.text(`${row.number} ${safe(row.node.title)}`, 18, y);
      y += 8;
      continue;
    }
    if (row.node.type === "subsection") {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(14, y - 5, 182, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.text(`${row.number} ${safe(row.node.title)}`, 20, y);
      y += 7;
      continue;
    }
    pdf.setFont("helvetica", "normal");
    pdf.text(row.number, 18, y);
    pdf.text(safe(row.node.title), 34, y, { maxWidth: 78 });
    pdf.text(String(row.node.quantity), 122, y, { align: "right" });
    pdf.text(row.node.unit, 136, y);
    pdf.text(formatCurrency(row.node.unitPriceHt), 160, y, { align: "right" });
    pdf.text(`${row.node.vatRate}%`, 172, y, { align: "right" });
    pdf.text(formatCurrency(row.totalHt), 194, y, { align: "right" });
    y += 7;
  }

  y += 8;
  if (y > 230) {
    pdf.addPage();
    y = 18;
  }
  drawTotals(pdf, totals, y);
  y += 42;

  pdf.setFont("helvetica", "bold");
  pdf.text("Conditions de paiement", 14, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(safe(quote.paymentTerms || "-"), 14, y + 7, { maxWidth: 182 });
  y += 24;

  pdf.setFont("helvetica", "bold");
  pdf.text("Mentions legales", 14, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(safe(quote.legalMentions || "-"), 14, y + 7, { maxWidth: 182 });
  y += 28;

  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(122, y, 74, 28, 2, 2);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Signature client", 126, y + 8);
  pdf.setTextColor(15, 23, 42);

  pdf.save(`${quote.number}.pdf`);
}

function drawCompanyHeader(pdf: jsPDF) {
  pdf.setFillColor(15, 39, 71);
  pdf.rect(0, 0, 210, 14, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("BATIPRO / CB RENOVATION", 14, 9);
  pdf.setTextColor(15, 23, 42);
}

function drawTableHeader(pdf: jsPDF, y: number) {
  pdf.setFillColor(59, 130, 246);
  pdf.rect(14, y - 5, 182, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("N°", 18, y);
  pdf.text("Designation", 34, y);
  pdf.text("Qte", 122, y, { align: "right" });
  pdf.text("Unite", 136, y);
  pdf.text("PU HT", 160, y, { align: "right" });
  pdf.text("TVA", 172, y, { align: "right" });
  pdf.text("Total HT", 194, y, { align: "right" });
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
}

function drawTotals(pdf: jsPDF, totals: ReturnType<typeof calculateQuoteBuilderTotals>, y: number) {
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(116, y, 80, 32, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.text("Total HT", 122, y + 8);
  pdf.text(formatCurrency(totals.totalHt), 190, y + 8, { align: "right" });
  pdf.text("TVA", 122, y + 15);
  pdf.text(formatCurrency(totals.totalVat), 190, y + 15, { align: "right" });
  pdf.setFillColor(59, 130, 246);
  pdf.rect(116, y + 21, 80, 11, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.text("NET A PAYER", 122, y + 28);
  pdf.text(formatCurrency(totals.totalTtc), 190, y + 28, { align: "right" });
  pdf.setTextColor(15, 23, 42);
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function safe(value: string) {
  return value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
}
