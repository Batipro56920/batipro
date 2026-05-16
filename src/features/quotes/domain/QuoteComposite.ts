import type { QuoteComponentKind, QuoteVatRate } from "./QuoteEnums";

export type QuoteCompositeComponent = {
  id: string;
  kind: QuoteComponentKind;
  label: string;
  quantity: number;
  unit: string;
  purchaseUnitPriceHt: number;
  saleUnitPriceHt: number;
  vatRate: QuoteVatRate;
  supplierId: string | null;
  supplierReference: string | null;
  order: number;
};
