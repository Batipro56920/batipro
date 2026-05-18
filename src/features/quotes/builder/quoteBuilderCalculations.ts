import Decimal from "decimal.js";
import type { QuoteBuilderItem, QuoteBuilderQuote, QuoteBuilderSection, QuoteBuilderTotals } from "./types";
import { flattenQuoteBuilderWithDocumentEngine, quoteBuilderToBusinessDocument } from "./quoteBuilderDocumentAdapter";

export function flattenQuoteBuilder(nodes: QuoteBuilderSection[]) {
  return flattenQuoteBuilderWithDocumentEngine(nodes);
}

export function calculateQuoteBuilderTotals(quote: QuoteBuilderQuote): QuoteBuilderTotals {
  const document = quoteBuilderToBusinessDocument(quote);
  const totals = document.totals!;
  return {
    totalHt: totals.totalHt,
    totalVat: totals.totalVat,
    totalTtc: totals.totalTtc,
    depositTtc: totals.depositAmount,
    remainingTtc: totals.remainingAmount,
    vatBreakdown: totals.vatBreakdown.map((entry) => ({ rate: entry.rate, baseHt: entry.baseHt, vat: entry.vatAmount })),
  };
}

export function itemTotalHt(item: QuoteBuilderItem) {
  return new Decimal(item.quantity || 0).mul(item.unitPriceHt || 0);
}

export function money(value: Decimal) {
  return Number(value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
}
