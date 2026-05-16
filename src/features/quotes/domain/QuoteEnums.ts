export type QuoteStatus = "draft" | "saved" | "sent" | "signed" | "refused" | "expired" | "cancelled";

export type QuoteNodeType = "section" | "subsection" | "line" | "composite" | "text" | "pagebreak";

export type QuoteLineKind = "fourniture" | "main_oeuvre" | "sous_traitance" | "materiel" | "divers";

export type QuoteComponentKind = QuoteLineKind | "texte";

export type QuoteVatRate = 0 | 5.5 | 10 | 20;

export const QUOTE_VAT_RATES: QuoteVatRate[] = [0, 5.5, 10, 20];

export const BILLABLE_NODE_TYPES = new Set<QuoteNodeType>(["line", "composite"]);
