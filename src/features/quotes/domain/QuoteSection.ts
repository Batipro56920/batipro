import type { QuoteNodeBase } from "./QuoteLine";

export type QuoteSectionNode = QuoteNodeBase & {
  type: "section";
  children: QuoteNode[];
};

export type QuoteSubsectionNode = QuoteNodeBase & {
  type: "subsection";
  children: QuoteNode[];
};

export type QuoteNode =
  | QuoteSectionNode
  | QuoteSubsectionNode
  | import("./QuoteLine").QuoteLineNode
  | import("./QuoteLine").QuoteCompositeNode
  | import("./QuoteLine").QuoteTextNode
  | import("./QuoteLine").QuotePageBreakNode;
