import Decimal from "decimal.js";
import type { QuoteBuilderFlatRow, QuoteBuilderItem, QuoteBuilderQuote, QuoteBuilderSection, QuoteBuilderTotals } from "./types";

export function flattenQuoteBuilder(nodes: QuoteBuilderSection[]): QuoteBuilderFlatRow[] {
  const rows: QuoteBuilderFlatRow[] = [];
  nodes.forEach((section, sectionIndex) => {
    const sectionNo = `${sectionIndex + 1}`;
    rows.push(toFlatRow(section, sectionNo, 0, null));
    if (section.collapsed) return;
    section.children.forEach((child, childIndex) => {
      const childNo = `${sectionNo}.${childIndex + 1}`;
      rows.push(toFlatRow(child, childNo, 1, section.id));
      if (child.type !== "subsection" || child.collapsed) return;
      child.children.forEach((item, itemIndex) => rows.push(toFlatRow(item, `${childNo}.${itemIndex + 1}`, 2, child.id)));
    });
  });
  return rows;
}

export function calculateQuoteBuilderTotals(quote: QuoteBuilderQuote): QuoteBuilderTotals {
  const buckets = new Map<number, { baseHt: Decimal; vat: Decimal }>();
  for (const row of flattenQuoteBuilder(quote.nodes)) {
    if (row.node.type !== "item") continue;
    const lineHt = itemTotalHt(row.node);
    const vat = lineHt.mul(row.node.vatRate).div(100);
    const bucket = buckets.get(row.node.vatRate) ?? { baseHt: new Decimal(0), vat: new Decimal(0) };
    buckets.set(row.node.vatRate, { baseHt: bucket.baseHt.add(lineHt), vat: bucket.vat.add(vat) });
  }

  const totalHt = Array.from(buckets.values()).reduce((sum, bucket) => sum.add(bucket.baseHt), new Decimal(0));
  const totalVat = Array.from(buckets.values()).reduce((sum, bucket) => sum.add(bucket.vat), new Decimal(0));
  const totalTtc = totalHt.add(totalVat);
  const depositTtc = totalTtc.mul(quote.settings.depositPercent).div(100);
  return {
    totalHt: money(totalHt),
    totalVat: money(totalVat),
    totalTtc: money(totalTtc),
    depositTtc: money(depositTtc),
    remainingTtc: money(totalTtc.sub(depositTtc)),
    vatBreakdown: Array.from(buckets.entries()).map(([rate, bucket]) => ({ rate, baseHt: money(bucket.baseHt), vat: money(bucket.vat) })),
  };
}

export function itemTotalHt(item: QuoteBuilderItem) {
  return new Decimal(item.quantity || 0).mul(item.unitPriceHt || 0);
}

function toFlatRow(node: QuoteBuilderFlatRow["node"], number: string, depth: number, parentId: string | null): QuoteBuilderFlatRow {
  const totalHt = node.type === "item" ? money(itemTotalHt(node)) : 0;
  const vatAmount = node.type === "item" ? money(new Decimal(totalHt).mul(node.vatRate).div(100)) : 0;
  return { id: node.id, number, depth, parentId, node, totalHt, vatAmount, totalTtc: money(new Decimal(totalHt).add(vatAmount)) };
}

export function money(value: Decimal) {
  return Number(value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
}
