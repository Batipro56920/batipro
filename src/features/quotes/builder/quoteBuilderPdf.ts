import { jsPDF } from "jspdf";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import type { QuoteBuilderQuote } from "./types";

export function downloadQuoteBuilderPdf(quote: QuoteBuilderQuote) {
  const pdf = new jsPDF();
  const totals = calculateQuoteBuilderTotals(quote);
  let y = 18;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(`Devis ${quote.number}`, 14, y);
  y += 10;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Client: ${quote.clientName}`, 14, y);
  y += 6;
  pdf.text(`Adresse: ${quote.siteAddress || "-"}`, 14, y);
  y += 8;
  pdf.text(`Description: ${quote.description || "-"}`, 14, y, { maxWidth: 180 });
  y += 14;

  for (const row of flattenQuoteBuilder(quote.nodes)) {
    if (y > 270) {
      pdf.addPage();
      y = 18;
    }
    const prefix = row.number;
    if (row.node.type === "section") {
      pdf.setFont("helvetica", "bold");
      pdf.text(`${prefix} ${row.node.title}`, 14, y);
      y += 7;
      continue;
    }
    if (row.node.type === "subsection") {
      pdf.setFont("helvetica", "bold");
      pdf.text(`${prefix} ${row.node.title}`, 18, y);
      y += 6;
      continue;
    }
    pdf.setFont("helvetica", "normal");
    pdf.text(`${prefix} ${row.node.title}`, 22, y, { maxWidth: 100 });
    pdf.text(`${row.node.quantity} ${row.node.unit}`, 132, y);
    pdf.text(formatCurrency(row.node.unitPriceHt), 152, y);
    pdf.text(formatCurrency(row.totalHt), 178, y, { align: "right" });
    y += 6;
  }

  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total HT: ${formatCurrency(totals.totalHt)}`, 130, y);
  y += 6;
  pdf.text(`TVA: ${formatCurrency(totals.totalVat)}`, 130, y);
  y += 6;
  pdf.text(`Total TTC: ${formatCurrency(totals.totalTtc)}`, 130, y);
  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.text("Conditions de paiement", 14, y);
  y += 6;
  pdf.text(quote.paymentTerms || "-", 14, y, { maxWidth: 180 });

  pdf.save(`${quote.number}.pdf`);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
