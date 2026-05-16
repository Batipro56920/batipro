import type { Quote } from "../domain/Quote";
import type { QuoteCompositeNode, QuoteLineNode } from "../domain/QuoteLine";
import type { QuoteNode } from "../domain/QuoteSection";
import type { QuoteTotals } from "../domain/QuoteTotals";
import type { QuoteVatRate } from "../domain/QuoteEnums";
import { calculateCompositeSummary } from "./quoteCompositeEngine";

function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function getNodeSellHt(node: QuoteNode): number {
  if (node.type === "line") return money(Math.max(0, node.quantity) * Math.max(0, node.saleUnitPriceHt));
  if (node.type === "composite") return money(Math.max(0, node.quantity) * calculateCompositeSummary(node).sellingPrice);
  return 0;
}

export function getNodeDryCostHt(node: QuoteNode): number {
  if (node.type === "line") return money(Math.max(0, node.quantity) * Math.max(0, node.purchaseUnitPriceHt));
  if (node.type === "composite") return money(Math.max(0, node.quantity) * getCompositeUnitDryCostHt(node));
  return 0;
}

export function getNodeVatRate(node: QuoteNode): QuoteVatRate {
  if (node.type === "line" || node.type === "composite") return node.vatRate;
  return 0;
}

export function calculateQuoteTotals(quote: Quote): QuoteTotals {
  const vatMap = new Map<QuoteVatRate, { baseHt: number; amount: number }>();
  let sellHt = 0;
  let dryCostHt = 0;

  for (const node of flattenQuoteNodes(quote.nodes)) {
    const nodeSellHt = getNodeSellHt(node);
    const nodeDryCostHt = getNodeDryCostHt(node);
    const vatRate = getNodeVatRate(node);
    const vatAmount = money(nodeSellHt * (vatRate / 100));
    const current = vatMap.get(vatRate) ?? { baseHt: 0, amount: 0 };
    vatMap.set(vatRate, { baseHt: money(current.baseHt + nodeSellHt), amount: money(current.amount + vatAmount) });
    sellHt = money(sellHt + nodeSellHt);
    dryCostHt = money(dryCostHt + nodeDryCostHt);
  }

  const vat = money([...vatMap.values()].reduce((sum, row) => sum + row.amount, 0));
  const ttc = money(sellHt + vat);
  const marginHt = money(sellHt - dryCostHt);
  const depositAmountTtc = money(ttc * (Math.max(0, quote.settings.defaultDepositPercent) / 100));

  return {
    sellHt,
    vat,
    ttc,
    dryCostHt,
    marginHt,
    marginRate: sellHt ? money((marginHt / sellHt) * 100) : 0,
    depositAmountTtc,
    remainingToInvoiceTtc: money(ttc - depositAmountTtc),
    vatBreakdown: [...vatMap.entries()]
      .filter(([, row]) => row.baseHt > 0 || row.amount > 0)
      .map(([rate, row]) => ({ rate, ...row })),
  };
}

export function flattenQuoteNodes(nodes: QuoteNode[]): QuoteNode[] {
  const flat: QuoteNode[] = [];
  for (const node of [...nodes].sort((a, b) => a.order - b.order)) {
    flat.push(node);
    if (node.type === "section" || node.type === "subsection") {
      flat.push(...flattenQuoteNodes(node.children));
    }
  }
  return flat;
}

export function getCompositeUnitSellHt(node: QuoteCompositeNode): number {
  return calculateCompositeSummary(node).sellingPrice;
}

export function getCompositeUnitDryCostHt(node: QuoteCompositeNode): number {
  return money(node.components.reduce((sum, component) => sum + Math.max(0, component.quantity) * Math.max(0, component.purchaseUnitPriceHt), 0));
}

export function isBillableNode(node: QuoteNode): node is QuoteLineNode | QuoteCompositeNode {
  return node.type === "line" || node.type === "composite";
}
