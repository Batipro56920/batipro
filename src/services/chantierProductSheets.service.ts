import { supabase } from "../lib/supabaseClient";
import type { ProductCatalogItem, ProductDocument } from "../features/product-catalog";
import { listProductCatalogItems } from "../features/product-catalog";
import {
  downloadProductDocument,
  isStoredProductDocumentPath,
} from "../features/product-catalog/infrastructure/productDocumentStorage";
import { listByChantier, uploadDocument, type ChantierDocumentRow } from "./chantierDocuments.service";
import { listDoeItemsByChantierId, upsertDoeItem } from "./chantierDoe.service";

export const PRODUCT_SHEET_CATEGORY = "Fiches produits";
const PRODUCT_SHEET_DOCUMENT_TYPE = "Fiche technique produit";

export type ChantierProductSheet = {
  product: ProductCatalogItem;
  document: ProductDocument;
  /** Titre stable du document chantier, sert aussi de cle anti-doublon. */
  title: string;
};

function sheetTitle(product: ProductCatalogItem, document: ProductDocument): string {
  const productLabel = product.designation?.trim() || "Produit";
  const documentLabel = document.name?.trim() || "fiche technique";
  return `${productLabel} — ${documentLabel}`;
}

async function listChantierProductIds(chantierId: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("chantier_material_preparations")
    .select("product_id")
    .eq("chantier_id", chantierId)
    .not("product_id", "is", null);
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as Array<{ product_id: string | null }>)
    .map((row) => String(row.product_id ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

/**
 * Fiches produits reprises au DOE : documents marques "A reprendre dans le DOE"
 * sur les produits reellement prepares pour ce chantier, et dont le fichier a
 * bien ete conserve. Un document sans piece jointe n'a rien a faire dans un DOE.
 */
export async function listChantierProductSheets(chantierId: string): Promise<ChantierProductSheet[]> {
  if (!chantierId) throw new Error("chantierId manquant.");
  const productIds = await listChantierProductIds(chantierId);
  if (!productIds.length) return [];

  const wanted = new Set(productIds);
  const products = (await listProductCatalogItems()).filter((product) => wanted.has(product.id));

  const sheets: ChantierProductSheet[] = [];
  for (const product of products) {
    for (const document of product.documents) {
      if (document.usage?.doe !== true) continue;
      if (!isStoredProductDocumentPath(document.url)) continue;
      sheets.push({ product, document, title: sheetTitle(product, document) });
    }
  }
  return sheets;
}

export type ProductSheetImportResult = {
  added: number;
  alreadyPresent: number;
  errors: string[];
};

/**
 * Copie les fiches produits du chantier dans ses documents, puis les ajoute au
 * DOE. La copie est volontaire : le DOE est un livrable fige, il ne doit pas
 * changer si la fiche du catalogue est mise a jour plus tard.
 */
export async function importProductSheetsIntoDoe(chantierId: string): Promise<ProductSheetImportResult> {
  const sheets = await listChantierProductSheets(chantierId);
  const result: ProductSheetImportResult = { added: 0, alreadyPresent: 0, errors: [] };
  if (!sheets.length) return result;

  const existingDocuments = await listByChantier(chantierId);
  const existingByTitle = new Map<string, ChantierDocumentRow>(
    existingDocuments
      .filter((row: ChantierDocumentRow) => (row.category ?? "") === PRODUCT_SHEET_CATEGORY)
      .map((row: ChantierDocumentRow) => [String(row.title ?? "").trim(), row] as const),
  );
  const doeItems = await listDoeItemsByChantierId(chantierId);
  const doeDocumentIds = new Set(doeItems.map((item) => item.document_id));
  let nextSortOrder = doeItems.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1;

  for (const sheet of sheets) {
    try {
      let documentId = existingByTitle.get(sheet.title)?.id ?? null;

      if (!documentId) {
        const blob = await downloadProductDocument(String(sheet.document.url));
        const file = new File([blob], sheet.document.name || "fiche-produit.pdf", {
          type: blob.type || "application/octet-stream",
        });
        const uploaded = await uploadDocument({
          chantierId,
          file,
          title: sheet.title,
          category: PRODUCT_SHEET_CATEGORY,
          documentType: PRODUCT_SHEET_DOCUMENT_TYPE,
          visibility_mode: "GLOBAL",
        });
        documentId = uploaded.id;
      }

      if (doeDocumentIds.has(documentId)) {
        result.alreadyPresent += 1;
        continue;
      }

      await upsertDoeItem({ chantier_id: chantierId, document_id: documentId, sort_order: nextSortOrder });
      doeDocumentIds.add(documentId);
      nextSortOrder += 1;
      result.added += 1;
    } catch (err: any) {
      result.errors.push(`${sheet.title} : ${err?.message ?? "reprise impossible"}`);
    }
  }

  return result;
}
