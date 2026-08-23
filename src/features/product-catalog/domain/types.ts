import type { DocumentUnit } from "../../document-engine";

export type ProductDocumentKind = "technical_sheet" | "manual" | "sds" | "certification" | "photo" | "other";

export type ProductSupplierPrice = {
  id: string;
  supplierId: string | null;
  supplierName: string;
  priceHt: number;
  discountPercent: number | null;
  startDate: string | null;
  endDate: string | null;
  packaging: string | null;
  minimumQuantity: number | null;
  deliveryLeadTimeDays: number | null;
  coverageM2?: number | null;
  pricePerM2Ht?: number | null;
};

export type ProductDocument = {
  id: string;
  kind: ProductDocumentKind;
  name: string;
  url: string | null;
  analysis?: {
    materialUsage?: unknown;
    [key: string]: unknown;
  } | null;
};

export type ProductKnowledgeBlock<T> = {
  value: T;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  sourceDocument: string | null;
};

export type ProductKnowledge = {
  identity: ProductKnowledgeBlock<{
    designation: string | null;
    brand: string | null;
    manufacturer: string | null;
    manufacturerReference: string | null;
    ean: string | null;
    conditionnement: string | null;
    unit: DocumentUnit | null;
  }>;
  supplier: ProductKnowledgeBlock<{
    supplier: string | null;
    supplierReference: string | null;
    supplierProductCode: string | null;
  }>;
  pricing: ProductKnowledgeBlock<{
    purchasePrice: number | null;
    recommendedSalePrice: number | null;
    currency: string | null;
    vat: number | null;
  }>;
  materialUsage: ProductKnowledgeBlock<{
    ratioQuantity: number | null;
    ratioUnit: string | null;
    sourceUnit: string | null;
    lossPercent: number | null;
    minimumOrder: number | null;
    coverage: number | null;
  }>;
  application: ProductKnowledgeBlock<{
    interior: boolean;
    exterior: boolean;
    wall: boolean;
    floor: boolean;
    ceiling: boolean;
    wood: boolean;
    metal: boolean;
    placo: boolean;
    concrete: boolean;
    facade: boolean;
  }>;
  supports: ProductKnowledgeBlock<string[]>;
  forbiddenSupports: ProductKnowledgeBlock<string[]>;
  tools: ProductKnowledgeBlock<string[]>;
  consumables: ProductKnowledgeBlock<string[]>;
  PPE: ProductKnowledgeBlock<string[]>;
  weatherLimits: ProductKnowledgeBlock<{
    minTemperature: number | null;
    maxTemperature: number | null;
    humidity: string | null;
    frost: string | null;
    rain: string | null;
    wind: string | null;
    sun: string | null;
  }>;
  dryingTimes: ProductKnowledgeBlock<string[]>;
  procedure: ProductKnowledgeBlock<string[]>;
  controls: ProductKnowledgeBlock<string[]>;
  commonMistakes: ProductKnowledgeBlock<string[]>;
  doe: ProductKnowledgeBlock<string[]>;
  fieldExperience: ProductKnowledgeBlock<string[]>;
  confidence: ProductKnowledgeBlock<{
    global: "high" | "medium" | "low";
    missingInformation: string[];
  }>;
};

export type ProductCatalogItem = {
  id: string;
  designation: string;
  internalReference: string | null;
  manufacturerReference: string | null;
  brand: string | null;
  category: string | null;
  unit: DocumentUnit;
  vatRate: number;
  mainSupplierId: string | null;
  mainSupplierName: string | null;
  standardPurchasePriceHt: number;
  recommendedSalePriceHt: number;
  targetMarginRate: number;
  isSellable: boolean;
  supplierPrices: ProductSupplierPrice[];
  documents: ProductDocument[];
  notes?: string | null;
  knowledge?: ProductKnowledge | null;
  analysis?: {
    materialUsage?: unknown;
    [key: string]: unknown;
  } | null;
  priceHistory: Array<{
    id: string;
    purchasePriceHt: number | null;
    salePriceHt: number | null;
    changedAt: string;
    source: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ProductCatalogDraft = Omit<ProductCatalogItem, "id" | "createdAt" | "updatedAt" | "priceHistory">;
