import type { QuoteVatRate } from "./QuoteEnums";

export type QuoteVatBreakdown = {
  rate: QuoteVatRate;
  baseHt: number;
  amount: number;
};

export type QuoteTotals = {
  sellHt: number;
  vat: number;
  ttc: number;
  dryCostHt: number;
  marginHt: number;
  marginRate: number;
  depositAmountTtc: number;
  remainingToInvoiceTtc: number;
  vatBreakdown: QuoteVatBreakdown[];
};

export const EMPTY_QUOTE_TOTALS: QuoteTotals = {
  sellHt: 0,
  vat: 0,
  ttc: 0,
  dryCostHt: 0,
  marginHt: 0,
  marginRate: 0,
  depositAmountTtc: 0,
  remainingToInvoiceTtc: 0,
  vatBreakdown: [],
};
