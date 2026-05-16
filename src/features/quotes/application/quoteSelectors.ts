import { calculateQuoteTotals, flattenQuoteNodes } from "./quoteCalculations";
import { numberQuoteNodes } from "./quoteNumbering";
import type { Quote } from "../domain/Quote";

export const selectQuoteTotals = (quote: Quote) => calculateQuoteTotals(quote);

export const selectFlatQuoteNodes = (quote: Quote) => flattenQuoteNodes(quote.nodes);

export const selectNumberedQuoteNodes = (quote: Quote) => numberQuoteNodes(quote.nodes);

export const selectQuoteHeader = (quote: Quote) => ({
  id: quote.id,
  number: quote.number,
  status: quote.status,
  dirtyKey: `${quote.number}:${quote.status}`,
});
