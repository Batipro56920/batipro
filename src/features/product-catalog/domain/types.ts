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
};

export type ProductDocument = {
  id: string;
  kind: ProductDocumentKind;
  name: string;
  url: string | null;
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
