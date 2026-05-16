import type { QuoteCompositeComponent, QuoteCompositeSummary } from "../domain/QuoteComposite";
import type { QuoteCompositeNode } from "../domain/QuoteLine";
import type { QuoteComponentKind } from "../domain/QuoteEnums";

function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function createCompositeComponent(kind: QuoteComponentKind): QuoteCompositeComponent {
  return {
    id: crypto.randomUUID(),
    kind,
    label: defaultComponentLabel(kind),
    quantity: 1,
    unit: kind === "main_oeuvre" ? "h" : "u",
    purchaseUnitPriceHt: 0,
    saleUnitPriceHt: 0,
    vatRate: 20,
    supplierId: null,
    supplierReference: null,
    order: 0,
  };
}

export function calculateComponentCost(component: QuoteCompositeComponent): number {
  return money(Math.max(0, component.quantity) * Math.max(0, component.purchaseUnitPriceHt));
}

export function calculateComponentSale(component: QuoteCompositeComponent): number {
  return money(Math.max(0, component.quantity) * Math.max(0, component.saleUnitPriceHt));
}

export function calculateComponentMargin(component: QuoteCompositeComponent): number {
  return money(calculateComponentSale(component) - calculateComponentCost(component));
}

export function calculateComponentMarginRate(component: QuoteCompositeComponent): number {
  const sale = calculateComponentSale(component);
  return sale ? money((calculateComponentMargin(component) / sale) * 100) : 0;
}

export function calculateCompositeSummary(node: QuoteCompositeNode): QuoteCompositeSummary {
  const deboursSec = money(node.components.reduce((sum, component) => sum + calculateComponentCost(component), 0));
  const componentsSellingPrice = money(node.components.reduce((sum, component) => sum + calculateComponentSale(component), 0));
  const sellingPrice = node.pricingMode === "fixed_price" && node.fixedSellingPriceHt !== null ? money(node.fixedSellingPriceHt) : componentsSellingPrice;
  const marginAmount = money(sellingPrice - deboursSec);
  const vat = money(sellingPrice * (node.vatRate / 100));
  return {
    deboursSec,
    marginRate: sellingPrice ? money((marginAmount / sellingPrice) * 100) : 0,
    marginAmount,
    sellingPrice,
    vat,
    totalTtc: money(sellingPrice + vat),
  };
}

export function applyCompositeMargin(node: QuoteCompositeNode, marginRate: number): QuoteCompositeNode {
  const normalizedRate = Math.max(0, Math.min(99, marginRate));
  return {
    ...node,
    pricingMode: "margin",
    targetMarginRate: normalizedRate,
    fixedSellingPriceHt: null,
    components: node.components.map((component) => {
      const saleUnitPriceHt = component.purchaseUnitPriceHt / (1 - normalizedRate / 100);
      return { ...component, saleUnitPriceHt: money(saleUnitPriceHt) };
    }),
  };
}

export function applyCompositeFixedPrice(node: QuoteCompositeNode, fixedSellingPriceHt: number): QuoteCompositeNode {
  return {
    ...node,
    pricingMode: "fixed_price",
    fixedSellingPriceHt: money(Math.max(0, fixedSellingPriceHt)),
  };
}

export function addCompositeComponent(node: QuoteCompositeNode, kind: QuoteComponentKind): QuoteCompositeNode {
  const next = createCompositeComponent(kind);
  return { ...node, components: [...node.components, { ...next, order: node.components.length + 1, vatRate: node.vatRate }] };
}

export function updateCompositeComponent(node: QuoteCompositeNode, componentId: string, patch: Partial<QuoteCompositeComponent>): QuoteCompositeNode {
  return { ...node, components: node.components.map((component) => (component.id === componentId ? { ...component, ...patch } : component)) };
}

export function removeCompositeComponent(node: QuoteCompositeNode, componentId: string): QuoteCompositeNode {
  return { ...node, components: node.components.filter((component) => component.id !== componentId).map((component, index) => ({ ...component, order: index + 1 })) };
}

export function duplicateCompositeComponent(node: QuoteCompositeNode, componentId: string): QuoteCompositeNode {
  const index = node.components.findIndex((component) => component.id === componentId);
  if (index < 0) return node;
  const copy = { ...node.components[index], id: crypto.randomUUID(), label: `${node.components[index].label} copie` };
  const components = [...node.components];
  components.splice(index + 1, 0, copy);
  return { ...node, components: components.map((component, orderIndex) => ({ ...component, order: orderIndex + 1 })) };
}

function defaultComponentLabel(kind: QuoteComponentKind): string {
  if (kind === "main_oeuvre") return "Main-d'oeuvre";
  if (kind === "materiel") return "Materiel";
  if (kind === "sous_traitance") return "Sous-traitance";
  if (kind === "divers") return "Divers";
  if (kind === "texte") return "Texte";
  return "Fourniture";
}
