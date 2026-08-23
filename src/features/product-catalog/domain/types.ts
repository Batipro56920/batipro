import type { DocumentUnit } from "../../document-engine";

export type ProductDocumentKind =
  | "technical_sheet"
  | "manual"
  | "application_scope"
  | "work_method"
  | "sds"
  | "certification"
  | "photo"
  | "other";

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

export type ProductDocumentUsage = {
  task: boolean;
  doe: boolean;
};

export type ProductMaterialUsage = {
  ratioQuantity: number;
  ratioUnit: string;
  sourceUnit: string;
  lossPercent: number | null;
  confidence: number | null;
  reasoning: string | null;
};

export type ProductDocumentAnalysis = {
  materialUsage?: ProductMaterialUsage | null;
  source?: string | null;
  confidence?: number | null;
};

export type ProductDocument = {
  id: string;
  kind: ProductDocumentKind;
  name: string;
  url: string | null;
  usage?: ProductDocumentUsage;
  notes?: string | null;
  analysis?: ProductDocumentAnalysis | null;
  /**
   * Charge utile de connaissance IA produit.
   * Portee par un pseudo-document (KNOWLEDGE_DOCUMENT_ID) tant que la table
   * product_catalog_items n'expose pas de colonne dediee. Ce champ DOIT etre
   * preserve par normalizeProductDocuments, sinon la connaissance Coco est
   * silencieusement perdue a chaque sauvegarde.
   */
  knowledge?: ProductKnowledge | null;
};

/**
 * Analyse produit heritee, lue depuis une eventuelle colonne `analysis`.
 * Absente du schema actuel : conservee en lecture defensive uniquement.
 */
export type ProductLegacyAnalysis = {
  materialUsage?: ProductMaterialUsage | null;
  [key: string]: unknown;
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
  analysis?: ProductLegacyAnalysis | null;
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
