import type { QuoteLineKind, QuoteVatRate } from "./QuoteEnums";
import type { QuoteNode } from "./QuoteSection";

export type QuoteLibraryTab = "library" | "old_quotes" | "imports" | "works" | "supplies" | "labor" | "templates";

export type QuoteLibraryItemType = QuoteLineKind | "ouvrage" | "texte" | "section_modele";

export type QuoteLibraryItem = {
  id: string;
  type: QuoteLibraryItemType;
  title: string;
  family: string | null;
  description: string | null;
  unit: string | null;
  purchaseUnitPriceHt: number;
  saleUnitPriceHt: number;
  vatRate: QuoteVatRate;
  marginRate: number;
  supplierId: string | null;
  supplierReference: string | null;
  payload: Record<string, unknown>;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QuoteLibraryTemplate = {
  id: string;
  title: string;
  family: string | null;
  type: "devis" | "section" | "ouvrage";
  description: string | null;
  nodes: QuoteNode[];
  isFavorite: boolean;
  createdAt: string;
};

export type QuoteImportRow = {
  id: string;
  filename: string;
  source: "csv" | "xlsx";
  status: "pending" | "processed" | "failed";
  rowCount: number;
  errorMessage: string | null;
  createdAt: string;
};

export type QuoteLibraryFilters = {
  tab: QuoteLibraryTab;
  query: string;
  family: string;
  type: string;
  favoritesOnly: boolean;
  page: number;
  pageSize: number;
};

export type QuoteLibraryDataset = {
  items: QuoteLibraryItem[];
  templates: QuoteLibraryTemplate[];
  imports: QuoteImportRow[];
  total: number;
};
