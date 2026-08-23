import {
  generateTaskTemplateWithCoco,
  type CocoTaskTemplateContext,
  type CocoTaskTemplateResult,
} from "../../coco/cocoOrchestrator";
import { getBestSupplierPrice, listProductCatalogItems, type ProductCatalogItem } from "../index";

export type TaskTemplateCocoMaterialInput = {
  id: string;
  product_id: string;
  material_name: string;
  source_unit: string;
  ratio_quantity: string;
  ratio_unit: string;
  loss_percent: string;
  supplier_id: string;
  purchase_price_ht: string;
  sale_price_ht: string;
  price_source: string;
  manual_override: boolean;
  notes: string;
};

export type TaskTemplateCocoEquipmentInput = {
  id: string;
  equipment_name: string;
  is_required: boolean;
  default_quantity: string;
  unit: string;
  notes: string;
};

export type TaskTemplateCocoLaborInput = {
  id: string;
  resourceType: "manual" | "employee_role" | "subcontractor";
  duration: string;
  unit: string;
  hourlyCost: string;
  hourlySalePrice: string;
  note: string;
};

export type TaskTemplateCocoFeeInput = {
  id: string;
  type: "equipment_rental" | "consumables" | "fixed_fee" | "other";
  designation: string;
  amountCostHt: string;
  amountSaleHt: string;
  note: string;
};

export type TaskTemplateCocoContext = {
  title: string;
  unit: string;
  lot: string;
  defaultQuantity: string;
  timePerUnit: string;
  referenceUnitCostHt: string;
  usage: string;
  existingTechnicalDescription: string;
  existingCharacteristics: string;
  existingNotes: string;
  materials: TaskTemplateCocoMaterialInput[];
  equipment: TaskTemplateCocoEquipmentInput[];
  labor: TaskTemplateCocoLaborInput[];
  fees: TaskTemplateCocoFeeInput[];
  costSummary: CocoTaskTemplateContext["costSummary"];
  products?: ProductCatalogItem[];
  lotProfile?: Record<string, unknown> | null;
};

export type TaskTemplateCocoResult = CocoTaskTemplateResult;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberField(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function productContext(product: ProductCatalogItem, supplierId: string | null) {
  const bestPrice = getBestSupplierPrice(product, supplierId || undefined) ?? getBestSupplierPrice(product);
  return {
    id: product.id,
    designation: product.designation,
    internalReference: product.internalReference,
    manufacturerReference: product.manufacturerReference,
    brand: product.brand,
    category: product.category,
    unit: product.unit,
    vatRate: product.vatRate,
    standardPurchasePriceHt: product.standardPurchasePriceHt,
    recommendedSalePriceHt: product.recommendedSalePriceHt,
    targetMarginRate: product.targetMarginRate,
    mainSupplierId: product.mainSupplierId,
    mainSupplierName: product.mainSupplierName,
    bestSupplierPrice: bestPrice,
    supplierPrices: product.supplierPrices,
    documentSources: product.documents.map((document) => ({
      kind: document.kind,
      name: document.name,
    })),
    notes: product.notes ?? null,
    knowledge: product.knowledge ?? null,
  };
}

function enrichMaterial(row: TaskTemplateCocoMaterialInput, products: ProductCatalogItem[]) {
  const product = row.product_id ? products.find((item) => item.id === row.product_id) ?? null : null;
  const supplierId = text(row.supplier_id) || null;
  return {
    id: row.id,
    materialName: text(row.material_name),
    sourceUnit: text(row.source_unit),
    ratioQuantity: numberField(row.ratio_quantity),
    ratioUnit: text(row.ratio_unit),
    lossPercent: numberField(row.loss_percent),
    supplierId,
    purchasePriceHt: numberField(row.purchase_price_ht),
    salePriceHt: numberField(row.sale_price_ht),
    priceSource: text(row.price_source),
    manualOverride: row.manual_override === true,
    notes: text(row.notes) || null,
    product: product ? productContext(product, supplierId) : null,
  };
}

export async function generateWithCoco(input: TaskTemplateCocoContext): Promise<TaskTemplateCocoResult> {
  const catalog = input.products?.length ? input.products : await listProductCatalogItems();
  return generateTaskTemplateWithCoco({
    task: {
      title: text(input.title),
      unit: text(input.unit),
      lot: text(input.lot),
      usage: text(input.usage),
      defaultQuantity: numberField(input.defaultQuantity),
      timePerUnit: numberField(input.timePerUnit),
      referenceUnitCostHt: numberField(input.referenceUnitCostHt),
      existingTechnicalDescription: text(input.existingTechnicalDescription),
      existingCharacteristics: text(input.existingCharacteristics),
      existingNotes: text(input.existingNotes),
    },
    materials: input.materials.map((row) => enrichMaterial(row, catalog)),
    labor: input.labor.map((row) => ({
      id: row.id,
      resourceType: row.resourceType,
      duration: numberField(row.duration),
      unit: text(row.unit) || "h",
      hourlyCost: numberField(row.hourlyCost),
      hourlySalePrice: numberField(row.hourlySalePrice),
      note: text(row.note),
    })),
    equipment: input.equipment.map((row) => ({
      id: row.id,
      name: text(row.equipment_name),
      required: row.is_required === true,
      defaultQuantity: numberField(row.default_quantity),
      unit: text(row.unit),
      notes: text(row.notes),
    })),
    fees: input.fees.map((row) => ({
      id: row.id,
      type: row.type,
      designation: text(row.designation),
      amountCostHt: numberField(row.amountCostHt),
      amountSaleHt: numberField(row.amountSaleHt),
      note: text(row.note),
    })),
    costSummary: input.costSummary,
    lotProfile: input.lotProfile ?? null,
  });
}
