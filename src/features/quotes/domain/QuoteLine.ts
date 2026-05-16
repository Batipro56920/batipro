import type { QuoteLineKind, QuoteNodeType, QuoteVatRate } from "./QuoteEnums";
import type { QuoteCompositeComponent } from "./QuoteComposite";

export type QuoteNodeBase = {
  id: string;
  persistedId: string | null;
  type: QuoteNodeType;
  parentId: string | null;
  title: string;
  order: number;
};

export type QuoteLineNode = QuoteNodeBase & {
  type: "line";
  kind: QuoteLineKind;
  quantity: number;
  unit: string;
  saleUnitPriceHt: number;
  purchaseUnitPriceHt: number;
  vatRate: QuoteVatRate;
  reference: string | null;
};

export type QuoteCompositeNode = QuoteNodeBase & {
  type: "composite";
  quantity: number;
  unit: string;
  vatRate: QuoteVatRate;
  reference: string | null;
  components: QuoteCompositeComponent[];
};

export type QuoteTextNode = QuoteNodeBase & {
  type: "text";
  content: string;
};

export type QuotePageBreakNode = QuoteNodeBase & {
  type: "pagebreak";
};

export type QuoteBillableNode = QuoteLineNode | QuoteCompositeNode;
