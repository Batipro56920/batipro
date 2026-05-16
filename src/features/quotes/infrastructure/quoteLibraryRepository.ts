import { supabase } from "../../../lib/supabaseClient";
import type { QuoteLibraryDataset, QuoteLibraryFilters, QuoteLibraryItem, QuoteLibraryItemType, QuoteLibraryTemplate, QuoteImportRow } from "../domain/QuoteLibrary";
import type { QuoteVatRate } from "../domain/QuoteEnums";

const db = supabase as any;

type ItemRow = {
  id: string;
  type: QuoteLibraryItemType;
  title: string;
  family: string | null;
  description: string | null;
  unit: string | null;
  purchase_unit_price_ht: number | null;
  sale_unit_price_ht: number | null;
  vat_rate: number | null;
  margin_rate: number | null;
  supplier_id: string | null;
  supplier_reference: string | null;
  payload: Record<string, unknown> | null;
  tags: string[] | null;
  is_favorite: boolean | null;
  created_at: string;
  updated_at: string;
};

type TemplateRow = {
  id: string;
  title: string;
  family: string | null;
  type: "devis" | "section" | "ouvrage";
  description: string | null;
  nodes: any[];
  is_favorite: boolean | null;
  created_at: string;
};

type ImportRow = {
  id: string;
  filename: string;
  source: "csv" | "xlsx";
  status: "pending" | "processed" | "failed";
  row_count: number;
  error_message: string | null;
  created_at: string;
};

export async function listQuoteLibrary(filters: QuoteLibraryFilters): Promise<QuoteLibraryDataset> {
  const [items, templates, imports] = await Promise.all([
    listItems(filters),
    filters.tab === "templates" || filters.tab === "library" ? listTemplates(filters) : Promise.resolve([]),
    filters.tab === "imports" ? listImports() : Promise.resolve([]),
  ]);
  return { items, templates, imports, total: items.length + templates.length + imports.length };
}

export async function createQuoteLibraryItem(input: Partial<QuoteLibraryItem> & { title: string; type: QuoteLibraryItemType }) {
  const organization_id = await currentOrgId();
  const row = toItemDb(input, organization_id);
  const { data, error } = await db.from("quote_library_items").insert([row]).select("*").single();
  if (error) throw error;
  return mapItem(data as ItemRow);
}

export async function updateQuoteLibraryItem(id: string, patch: Partial<QuoteLibraryItem>) {
  const { data, error } = await db.from("quote_library_items").update(toItemDb(patch)).eq("id", id).select("*").single();
  if (error) throw error;
  return mapItem(data as ItemRow);
}

export async function deleteQuoteLibraryItem(id: string) {
  const { error } = await db.from("quote_library_items").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function toggleQuoteLibraryFavorite(item: QuoteLibraryItem) {
  return updateQuoteLibraryItem(item.id, { isFavorite: !item.isFavorite });
}

export async function importQuoteLibraryFile(file: File) {
  const organization_id = await currentOrgId();
  const source = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  const rows = await parseImportRows(file);
  const { data: importRow, error: importError } = await db
    .from("quote_imports")
    .insert([{ organization_id, filename: file.name, source, status: "processed", row_count: rows.length }])
    .select("*")
    .single();
  if (importError) throw importError;

  if (rows.length) {
    const payload = rows.map((row) =>
      toItemDb(
        {
          type: normalizeType(row.type),
          title: row.title,
          family: row.family,
          description: row.description,
          unit: row.unit,
          purchaseUnitPriceHt: Number(row.purchaseUnitPriceHt || 0),
          saleUnitPriceHt: Number(row.saleUnitPriceHt || 0),
          vatRate: normalizeVat(Number(row.vatRate || 20)),
        },
        organization_id,
      ),
    );
    const { error } = await db.from("quote_library_items").insert(payload);
    if (error) throw error;
  }

  return mapImport(importRow as ImportRow);
}

async function listItems(filters: QuoteLibraryFilters): Promise<QuoteLibraryItem[]> {
  let query = db.from("quote_library_items").select("*").is("archived_at", null).order("updated_at", { ascending: false });
  const type = typeForTab(filters.tab);
  if (type) query = query.eq("type", type);
  if (filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.family !== "all") query = query.eq("family", filters.family);
  if (filters.favoritesOnly) query = query.eq("is_favorite", true);
  if (filters.query.trim()) query = query.or(`title.ilike.%${escapeLike(filters.query)}%,description.ilike.%${escapeLike(filters.query)}%,family.ilike.%${escapeLike(filters.query)}%`);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { data, error } = await query.range(from, to);
  if (error) throw error;
  return (data ?? []).map((row: ItemRow) => mapItem(row));
}

async function listTemplates(filters: QuoteLibraryFilters): Promise<QuoteLibraryTemplate[]> {
  let query = db.from("quote_library_templates").select("*").is("archived_at", null).order("updated_at", { ascending: false });
  if (filters.query.trim()) query = query.or(`title.ilike.%${escapeLike(filters.query)}%,description.ilike.%${escapeLike(filters.query)}%,family.ilike.%${escapeLike(filters.query)}%`);
  const { data, error } = await query.limit(50);
  if (error) throw error;
  return (data ?? []).map((row: TemplateRow) => ({
    id: row.id,
    title: row.title,
    family: row.family,
    type: row.type,
    description: row.description,
    nodes: row.nodes ?? [],
    isFavorite: Boolean(row.is_favorite),
    createdAt: row.created_at,
  }));
}

async function listImports(): Promise<QuoteImportRow[]> {
  const { data, error } = await db.from("quote_imports").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []).map((row: ImportRow) => mapImport(row));
}

function mapItem(row: ItemRow): QuoteLibraryItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    family: row.family,
    description: row.description,
    unit: row.unit,
    purchaseUnitPriceHt: Number(row.purchase_unit_price_ht ?? 0),
    saleUnitPriceHt: Number(row.sale_unit_price_ht ?? 0),
    vatRate: normalizeVat(Number(row.vat_rate ?? 20)),
    marginRate: Number(row.margin_rate ?? 0),
    supplierId: row.supplier_id,
    supplierReference: row.supplier_reference,
    payload: row.payload ?? {},
    tags: row.tags ?? [],
    isFavorite: Boolean(row.is_favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImport(row: ImportRow): QuoteImportRow {
  return { id: row.id, filename: row.filename, source: row.source, status: row.status, rowCount: row.row_count, errorMessage: row.error_message, createdAt: row.created_at };
}

function toItemDb(input: Partial<QuoteLibraryItem> & { title?: string; type?: QuoteLibraryItemType }, organization_id?: string) {
  return {
    ...(organization_id ? { organization_id } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.family !== undefined ? { family: input.family } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
    ...(input.purchaseUnitPriceHt !== undefined ? { purchase_unit_price_ht: input.purchaseUnitPriceHt } : {}),
    ...(input.saleUnitPriceHt !== undefined ? { sale_unit_price_ht: input.saleUnitPriceHt } : {}),
    ...(input.vatRate !== undefined ? { vat_rate: input.vatRate } : {}),
    ...(input.marginRate !== undefined ? { margin_rate: input.marginRate } : {}),
    ...(input.supplierId !== undefined ? { supplier_id: input.supplierId } : {}),
    ...(input.supplierReference !== undefined ? { supplier_reference: input.supplierReference } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.isFavorite !== undefined ? { is_favorite: input.isFavorite } : {}),
    updated_at: new Date().toISOString(),
  };
}

async function parseImportRows(file: File): Promise<Array<Record<string, any>>> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return rows.map((row) => ({
    type: row.type || row.Type || row.TYPE,
    title: row.title || row.titre || row.Titre || row.designation || row.Designation,
    family: row.family || row.famille || row.Famille || row.lot || row.Lot,
    description: row.description || row.Description,
    unit: row.unit || row.unite || row.Unite,
    purchaseUnitPriceHt: row.purchaseUnitPriceHt || row.prix_achat_ht || row["prix achat ht"],
    saleUnitPriceHt: row.saleUnitPriceHt || row.prix_vente_ht || row["prix vente ht"],
    vatRate: row.vatRate || row.tva || row.TVA,
  })).filter((row) => row.title);
}

async function currentOrgId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (!id) throw new Error("Utilisateur non authentifie.");
  return id;
}

function typeForTab(tab: string): QuoteLibraryItemType | null {
  if (tab === "works") return "ouvrage";
  if (tab === "supplies") return "fourniture";
  if (tab === "labor") return "main_oeuvre";
  return null;
}

function normalizeType(value: unknown): QuoteLibraryItemType {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized.includes("main") || normalized === "mo") return "main_oeuvre";
  if (normalized.includes("ouvrage")) return "ouvrage";
  if (normalized.includes("texte")) return "texte";
  if (normalized.includes("section")) return "section_modele";
  if (normalized.includes("materiel")) return "materiel";
  if (normalized.includes("traitance")) return "sous_traitance";
  if (normalized.includes("divers")) return "divers";
  return "fourniture";
}

function normalizeVat(value: number): QuoteVatRate {
  if (value === 0 || value === 5.5 || value === 10 || value === 20) return value;
  return 20;
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "");
}
