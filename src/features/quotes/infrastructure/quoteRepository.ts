import {
  createCrmQuoteItemFromTemplate,
  deleteCrmQuoteItem,
  loadCrmDataset,
  loadCrmQuoteEngineData,
  updateCrmQuote,
  updateCrmQuoteItem,
} from "../../../services/crm.service";
import type { CrmDataset, CrmQuoteEngineData } from "../../../services/crm.service";
import type { Quote } from "../domain/Quote";
import { flattenQuoteForPersistence, mapQuoteNodeToItemPatch, mapQuoteToQuotePatch } from "./quoteMapper";

export type QuoteWorkspaceData = {
  dataset: CrmDataset;
  engine: CrmQuoteEngineData;
};

export async function loadQuoteWorkspaceData(quoteId: string): Promise<QuoteWorkspaceData> {
  const [dataset, engine] = await Promise.all([loadCrmDataset(), loadCrmQuoteEngineData(quoteId)]);
  return { dataset, engine };
}

export async function saveQuote(quote: Quote, original: CrmQuoteEngineData) {
  if (!quote.id) throw new Error("Devis introuvable.");
  await updateCrmQuote(quote.id, mapQuoteToQuotePatch(quote));

  const persisted = new Set(original.items.map((item) => item.id));
  const nextPersisted = new Set<string>();

  for (const row of flattenQuoteForPersistence(quote)) {
    const patch = mapQuoteNodeToItemPatch(row.node, quote.id, row.order);
    if (row.node.persistedId && persisted.has(row.node.persistedId)) {
      nextPersisted.add(row.node.persistedId);
      await updateCrmQuoteItem(row.node.persistedId, patch);
      continue;
    }
    await createCrmQuoteItemFromTemplate({
      quote_id: quote.id,
      lineType: patch.line_type,
      designation: patch.designation,
      description: patch.description,
      quantity: patch.quantite,
      unit: patch.unite,
      unitPriceHt: patch.sale_unit_price_ht,
      tvaRate: patch.tva_rate,
      ordre: row.order,
    });
  }

  for (const item of original.items) {
    if (!nextPersisted.has(item.id)) await deleteCrmQuoteItem(item.id, quote.id);
  }
}
