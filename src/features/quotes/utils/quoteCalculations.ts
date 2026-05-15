import type { QuoteLine, QuoteTotals, QuoteVatRate } from "../types";

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function getQuoteLineTotalHt(line: QuoteLine): number {
  if (line.kind === "section" || line.kind === "subsection" || line.kind === "text" || line.kind === "page_break") {
    return 0;
  }
  return roundMoney(Math.max(0, line.quantity) * Math.max(0, line.unitPriceHt));
}

export function calculateQuoteTotals(lines: QuoteLine[]): QuoteTotals {
  const vatMap = new Map<QuoteVatRate, { baseHt: number; vatAmount: number }>();
  let totalHt = 0;
  let purchaseCostHt = 0;

  for (const line of lines) {
    const lineTotal = getQuoteLineTotalHt(line);
    const vatAmount = roundMoney(lineTotal * (line.vatRate / 100));
    const current = vatMap.get(line.vatRate) ?? { baseHt: 0, vatAmount: 0 };
    vatMap.set(line.vatRate, {
      baseHt: roundMoney(current.baseHt + lineTotal),
      vatAmount: roundMoney(current.vatAmount + vatAmount),
    });
    totalHt = roundMoney(totalHt + lineTotal);
    purchaseCostHt = roundMoney(purchaseCostHt + Math.max(0, line.purchaseCostHt) * Math.max(0, line.quantity));
  }

  const totalVat = roundMoney([...vatMap.values()].reduce((sum, row) => sum + row.vatAmount, 0));
  const marginHt = roundMoney(totalHt - purchaseCostHt);
  return {
    totalHt,
    totalVat,
    totalTtc: roundMoney(totalHt + totalVat),
    marginHt,
    marginRate: totalHt ? roundMoney((marginHt / totalHt) * 100) : 0,
    vatBreakdown: [...vatMap.entries()].map(([rate, row]) => ({ rate, ...row })),
  };
}
