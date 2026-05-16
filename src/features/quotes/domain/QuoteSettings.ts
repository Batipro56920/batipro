import type { QuoteVatRate } from "./QuoteEnums";

export type QuoteSettings = {
  defaultVatRate: QuoteVatRate;
  defaultDepositPercent: number;
  showMargins: boolean;
  showReferences: boolean;
  showVatColumn: boolean;
  showQuantityColumns: boolean;
  hideCompositeDetails: boolean;
};

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  defaultVatRate: 20,
  defaultDepositPercent: 30,
  showMargins: true,
  showReferences: false,
  showVatColumn: true,
  showQuantityColumns: true,
  hideCompositeDetails: false,
};
