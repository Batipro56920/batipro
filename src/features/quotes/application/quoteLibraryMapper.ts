import type { QuoteLibraryItem } from "../domain/QuoteLibrary";
import type { QuoteNode } from "../domain/QuoteSection";
import type { QuoteCompositeNode, QuoteLineNode, QuoteTextNode } from "../domain/QuoteLine";
import { DEFAULT_QUOTE_SETTINGS } from "../domain/QuoteSettings";

export function quoteLibraryItemToNode(item: QuoteLibraryItem, order: number): QuoteNode {
  const base = {
    id: crypto.randomUUID(),
    persistedId: null,
    parentId: null,
    title: item.title,
    order,
  };

  if (item.type === "section_modele") {
    return { ...base, type: "section", children: [] };
  }

  if (item.type === "texte") {
    return { ...base, type: "text", content: item.description ?? item.title } satisfies QuoteTextNode;
  }

  if (item.type === "ouvrage") {
    return {
      ...base,
      type: "composite",
      quantity: 1,
      unit: item.unit ?? "u",
      vatRate: item.vatRate,
      reference: item.id,
      pricingMode: "margin",
      targetMarginRate: item.marginRate,
      fixedSellingPriceHt: null,
      components: Array.isArray(item.payload.components) ? (item.payload.components as QuoteCompositeNode["components"]) : [],
    } satisfies QuoteCompositeNode;
  }

  return {
    ...base,
    type: "line",
    kind: item.type,
    quantity: 1,
    unit: item.unit ?? (item.type === "main_oeuvre" ? "h" : "u"),
    saleUnitPriceHt: item.saleUnitPriceHt,
    purchaseUnitPriceHt: item.purchaseUnitPriceHt,
    vatRate: item.vatRate ?? DEFAULT_QUOTE_SETTINGS.defaultVatRate,
    reference: item.id,
  } satisfies QuoteLineNode;
}
