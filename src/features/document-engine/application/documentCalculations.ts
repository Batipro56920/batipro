import Decimal from "decimal.js";
import type { BusinessDocument, BusinessDocumentNode, DocumentItemComponent, DocumentItemNode, DocumentTotals, DocumentVatBreakdown } from "../domain/types";

export function calculateDocumentTotals(document: BusinessDocument): DocumentTotals {
  const lines = collectItemNodes(document.nodes);
  const totalHt = lines.reduce((sum, line) => sum.plus(calculateLineTotalHt(line)), money(0));
  const subtotalHt = lines.reduce((sum, line) => sum.plus(money(line.quantity).times(line.unitPriceHt)), money(0));
  const discountHt = subtotalHt.minus(totalHt);
  const totalVat = lines.reduce((sum, line) => sum.plus(calculateLineVat(line)), money(0));
  const totalTtc = totalHt.plus(totalVat);
  const depositAmount = calculateDeposit(document, totalTtc);
  const costHt = lines.reduce((sum, line) => sum.plus(calculateLineCostHt(line)), money(0));
  const marginHt = totalHt.minus(costHt);

  return {
    subtotalHt: toNumber(subtotalHt),
    discountHt: toNumber(discountHt),
    totalHt: toNumber(totalHt),
    totalVat: toNumber(totalVat),
    totalTtc: toNumber(totalTtc),
    depositAmount: toNumber(depositAmount),
    remainingAmount: toNumber(totalTtc.minus(depositAmount)),
    costHt: toNumber(costHt),
    marginHt: toNumber(marginHt),
    marginRate: totalHt.gt(0) ? toNumber(marginHt.div(totalHt).times(100)) : 0,
    vatBreakdown: calculateVatBreakdown(lines),
  };
}

export function calculateLineTotalHt(line: DocumentItemNode) {
  const gross = money(line.quantity).times(line.unitPriceHt);
  const discount = gross.times(money(line.discountRate ?? 0).div(100));
  return gross.minus(discount);
}

export function calculateComponentTotalHt(component: DocumentItemComponent) {
  return money(component.quantity).times(component.unitPriceHt);
}

export function calculateMeasuredQuantity(unit: string, length?: number | null, width?: number | null, height?: number | null, fallback = 1) {
  if (unit === "ml") return toNumber(money(length ?? fallback));
  if (unit === "m2") return toNumber(money(length ?? fallback).times(width ?? 1));
  if (unit === "m3") return toNumber(money(length ?? fallback).times(width ?? 1).times(height ?? 1));
  return fallback;
}

function collectItemNodes(nodes: BusinessDocumentNode[]) {
  const result: DocumentItemNode[] = [];
  nodes.forEach((node) => {
    if (node.type === "line" || node.type === "composite") result.push(node);
    if (node.type === "section" || node.type === "subsection") result.push(...collectItemNodes(node.children));
  });
  return result;
}

function calculateLineVat(line: DocumentItemNode) {
  return calculateLineTotalHt(line).times(line.vatRate).div(100);
}

function calculateLineCostHt(line: DocumentItemNode) {
  if (line.components?.length) {
    return line.components.reduce((sum, component) => sum.plus(money(component.costPriceHt ?? component.unitPriceHt).times(component.quantity)), money(0));
  }
  return money(line.costPriceHt ?? 0).times(line.quantity);
}

function calculateDeposit(document: BusinessDocument, totalTtc: Decimal) {
  if (typeof document.terms.depositAmount === "number") return money(document.terms.depositAmount);
  if (typeof document.terms.depositPercent === "number") return totalTtc.times(document.terms.depositPercent).div(100);
  return money(0);
}

function calculateVatBreakdown(lines: DocumentItemNode[]): DocumentVatBreakdown[] {
  const grouped = new Map<number, { baseHt: Decimal; vatAmount: Decimal }>();
  lines.forEach((line) => {
    const current = grouped.get(line.vatRate) ?? { baseHt: money(0), vatAmount: money(0) };
    grouped.set(line.vatRate, {
      baseHt: current.baseHt.plus(calculateLineTotalHt(line)),
      vatAmount: current.vatAmount.plus(calculateLineVat(line)),
    });
  });
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .map(([rate, value]) => ({ rate, baseHt: toNumber(value.baseHt), vatAmount: toNumber(value.vatAmount) }));
}

function money(value: number | string) {
  return new Decimal(value || 0);
}

function toNumber(value: Decimal) {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}
