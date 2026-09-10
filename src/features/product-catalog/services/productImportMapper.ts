import type { SupplierRow } from "../../../services/suppliers.service";
import type { DocumentUnit } from "../../document-engine";
import type {
  ProductCatalogDraft,
  ProductCatalogItem,
  ProductDocument,
  ProductKnowledge,
  ProductSupplierPrice,
} from "../domain/types";
import { uploadProductDocumentFile } from "../infrastructure/productDocumentStorage";

export type ProductDraftPatch = Partial<ProductCatalogDraft | ProductCatalogItem>;

/**
 * Traduit ce que Coco a compris d'une fiche produit en champs du catalogue.
 * Partage entre l'import d'une fiche unique et l'import en lot pour que les
 * deux chemins remplissent exactement les memes donnees.
 */
export function buildProductPatch(
  currentProduct: ProductCatalogDraft | ProductCatalogItem,
  knowledge: ProductKnowledge,
  importedDocuments: ProductDocument[],
  suppliers: SupplierRow[],
  text: string,
): ProductDraftPatch {
  const identity = knowledge.identity.value;
  const supplierInfo = knowledge.supplier.value;
  const pricing = knowledge.pricing.value;

  const supplierName = normalizeText(supplierInfo.supplier);
  const supplier = findSupplierByName(suppliers, supplierName);
  const purchasePrice = positivePrice(pricing.purchasePrice) ?? extractPrice(text) ?? positivePrice(currentProduct.standardPurchasePriceHt);
  const marginRate = positiveNumber(currentProduct.targetMarginRate) ?? 30;
  const salePrice = positivePrice(pricing.recommendedSalePrice) ?? computeSalePrice(purchasePrice, marginRate) ?? positivePrice(currentProduct.recommendedSalePriceHt);
  const unit = normalizeUnit(identity.unit) || currentProduct.unit;
  const supplierPrice = buildSupplierPrice(knowledge, supplier, purchasePrice);

  return {
    designation: normalizeText(identity.designation) ?? currentProduct.designation,
    manufacturerReference: normalizeText(identity.manufacturerReference) ?? currentProduct.manufacturerReference,
    brand: normalizeText(identity.brand) ?? currentProduct.brand,
    category: currentProduct.category ?? "Materiaux",
    unit,
    vatRate: positiveNumber(pricing.vat) ?? currentProduct.vatRate,
    mainSupplierId: supplier?.id ?? currentProduct.mainSupplierId,
    mainSupplierName: supplier?.name ?? supplierName ?? currentProduct.mainSupplierName,
    standardPurchasePriceHt: purchasePrice ?? currentProduct.standardPurchasePriceHt,
    recommendedSalePriceHt: salePrice ?? currentProduct.recommendedSalePriceHt,
    supplierPrices: supplierPrice ? mergeSupplierPrice(currentProduct.supplierPrices, supplierPrice) : currentProduct.supplierPrices,
    documents: [...currentProduct.documents, ...importedDocuments],
    knowledge,
  };
}

/**
 * Rapproche un nom lu dans un document d'un fournisseur du carnet d'adresses.
 * L'egalite stricte ne suffit pas : un site marchand signe "Rouenel" ce que
 * Batipro enregistre sous "Rouenel Aubade". On accepte donc l'inclusion d'un
 * nom dans l'autre, puis le partage d'un mot distinctif. En cas d'ambiguite
 * entre deux fournisseurs aussi proches, on prefere ne rien decider.
 */
export function findSupplierByName(suppliers: SupplierRow[], rawName: string | null | undefined): SupplierRow | null {
  const needle = normalizeKey(rawName ?? "");
  if (!needle) return null;

  const needleTokens = needle.split(" ").filter((token) => token.length >= 4);
  const scored = suppliers
    .map((row) => {
      const name = normalizeKey(row.name);
      if (!name) return { row, score: 0 };
      if (name === needle) return { row, score: 3 };
      if (containsWord(name, needle) || containsWord(needle, name)) return { row, score: 2 };
      const nameTokens = new Set(name.split(" "));
      return { row, score: needleTokens.some((token) => nameTokens.has(token)) ? 1 : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  const best = scored[0];
  const tied = scored.filter((entry) => entry.score === best.score);
  return tied.length === 1 ? best.row : null;
}

/** Inclusion sur des mots entiers : "rouenel" est dans "rouenel aubade", pas dans "rouenelle". */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `) || haystack.startsWith(`${needle} `) || haystack.endsWith(` ${needle}`);
}

export function buildSupplierPrice(
  knowledge: ProductKnowledge,
  supplier: SupplierRow | null,
  purchasePrice: number | null,
): ProductSupplierPrice | null {
  const supplierName = normalizeText(knowledge.supplier.value.supplier);
  if (purchasePrice === null || purchasePrice <= 0) return null;
  if (!supplier && !supplierName) return null;

  const usage = knowledge.materialUsage.value;
  const coverageM2 = positiveNumber(usage.coverage);
  return {
    id: crypto.randomUUID(),
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? supplierName ?? "",
    priceHt: purchasePrice,
    discountPercent: null,
    startDate: null,
    endDate: null,
    packaging: normalizeText(knowledge.identity.value.conditionnement),
    minimumQuantity: positiveNumber(usage.minimumOrder),
    deliveryLeadTimeDays: null,
    coverageM2,
    pricePerM2Ht: coverageM2 ? computeCoverageUnitPrice(purchasePrice, coverageM2) : null,
  };
}

/**
 * Depose chaque fichier dans le bucket des fiches produits et construit le
 * ProductDocument correspondant. Un echec de stockage ne fait pas echouer
 * l'analyse : la fiche reste exploitable, seule la piece jointe manque.
 */
export async function storeProductFiles(
  productId: string,
  files: File[],
): Promise<{ documents: ProductDocument[]; notes: string[] }> {
  const notes: string[] = [];
  const documents = await Promise.all(files.map(async (file) => {
    const id = crypto.randomUUID();
    let url: string | null = null;
    try {
      url = await uploadProductDocumentFile({ productId, documentId: id, file });
    } catch (err: any) {
      notes.push(`${file.name} : analyse faite, mais le fichier n'a pas pu etre enregistre (${err?.message ?? "erreur inconnue"}).`);
    }
    return {
      id,
      kind: "technical_sheet" as const,
      name: file.name,
      url,
      usage: { task: true, doe: true },
      notes: url
        ? "Fiche importee et conservee, reprise automatiquement dans le DOE."
        : "Fichier importe pour analyse automatique de la fiche produit.",
      analysis: null,
    };
  }));
  return { documents, notes };
}

export function mergeSupplierPrice(prices: ProductSupplierPrice[], candidate: ProductSupplierPrice): ProductSupplierPrice[] {
  const exists = prices.some((price) => {
    const sameSupplier = candidate.supplierId
      ? price.supplierId === candidate.supplierId
      : normalizeKey(price.supplierName) === normalizeKey(candidate.supplierName);
    return sameSupplier && price.priceHt === candidate.priceHt && normalizeKey(price.packaging) === normalizeKey(candidate.packaging);
  });
  return exists ? prices : [...prices, candidate];
}

export function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text : null;
}

export function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeUnit(unit: unknown): DocumentUnit {
  const value = normalizeKey(unit);
  if (["m2", "m 2"].includes(value)) return "m2";
  if (["m3", "m 3"].includes(value)) return "m3";
  if (["ml", "m", "metre lineaire"].includes(value)) return "ml";
  if (["kg", "kilo", "g", "gramme", "grammes"].includes(value)) return "kg";
  if (["l", "litre", "litres"].includes(value)) return "l";
  if (["h", "heure"].includes(value)) return "h";
  if (["forfait", "ens", "ensemble"].includes(value)) return "forfait";
  return "u";
}

export function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function positivePrice(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function extractPrice(text: string): number | null {
  const match = text.match(/(?:prix|achat|tarif)[^0-9]{0,80}([0-9]+(?:[\s.,][0-9]{2})?)/i);
  return parseLooseNumber(match?.[1]);
}

export function parseLooseNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text.replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

export function computeCoverageUnitPrice(price: number | null, coverageM2: number | null): number | null {
  if (price === null || coverageM2 === null || coverageM2 <= 0) return null;
  return Math.round((price / coverageM2) * 100) / 100;
}

export function computeSalePrice(purchasePrice: number | null, marginRate: number): number | null {
  if (purchasePrice === null) return null;
  return Math.round(purchasePrice * (1 + marginRate / 100) * 100) / 100;
}

/**
 * Produit vierge servant de base a un import (fiche unique ou lot).
 */
export function createEmptyProductDraft(): ProductCatalogDraft {
  return {
    designation: "",
    internalReference: "",
    manufacturerReference: "",
    brand: "",
    category: "",
    unit: "u",
    vatRate: 20,
    mainSupplierId: null,
    mainSupplierName: null,
    standardPurchasePriceHt: 0,
    recommendedSalePriceHt: 0,
    targetMarginRate: 30,
    isSellable: true,
    supplierPrices: [],
    documents: [],
    knowledge: null,
  };
}

/* ------------------------------------------------------------------ *
 * Regroupement des fichiers d'un import en lot
 *
 * Un meme produit arrive souvent en plusieurs fichiers : la fiche
 * technique d'un cote, la capture du tarif fournisseur de l'autre. On
 * analyse chaque fichier separement, puis on rapproche ceux qui parlent
 * du meme produit pour n'en creer qu'un seul.
 * ------------------------------------------------------------------ */

const IDENTITY_STOP_WORDS = new Set([
  "de", "du", "des", "la", "le", "les", "et", "en", "pour", "par", "avec",
  "sur", "aux", "un", "une", "ref", "reference", "produit", "fiche", "prix",
  "tarif", "mm", "cm", "kg", "ht", "ttc", "eur", "euro", "euros",
]);

export type ProductImportSignature = {
  ean: string | null;
  reference: string | null;
  tokens: string[];
  /** Tokens contenant un chiffre : calibre, section, dimension. Ce sont eux qui separent deux variantes. */
  specTokens: string[];
  hasIdentity: boolean;
  hasPrice: boolean;
};

function identityTokens(...values: Array<string | null | undefined>): string[] {
  const tokens = normalizeKey(values.filter(Boolean).join(" "))
    .split(" ")
    .filter((token) => {
      if (IDENTITY_STOP_WORDS.has(token)) return false;
      // Un calibre tient parfois en deux caracteres ("2A", "6A") et c'est
      // justement lui qui distingue deux variantes d'une meme reference.
      if (/\d/.test(token)) return token.length >= 2;
      return token.length >= 3;
    });
  return Array.from(new Set(tokens));
}

export function buildImportSignature(knowledge: ProductKnowledge): ProductImportSignature {
  const identity = knowledge.identity.value;
  const supplier = knowledge.supplier.value;
  const pricing = knowledge.pricing.value;
  const tokens = identityTokens(identity.designation, identity.brand, identity.manufacturer);
  const specTokens = tokens.filter((token) => /\d/.test(token));
  return {
    ean: normalizeText(identity.ean),
    reference: normalizeKey(identity.manufacturerReference ?? supplier.supplierReference ?? "") || null,
    tokens,
    specTokens,
    // Une capture de tarif donne un prix mais rarement une designation complete.
    hasIdentity: tokens.length >= 2 && Boolean(normalizeText(identity.designation)),
    hasPrice: positivePrice(pricing.purchasePrice) !== null || positivePrice(pricing.recommendedSalePrice) !== null,
  };
}

/**
 * 0 = rien a voir, 1 = certitude. L'EAN et la reference fabricant sont des
 * identifiants exacts ; a defaut on compare le vocabulaire des designations
 * (coefficient de Dice), ce qui rapproche "Plaque BA13 hydrofuge Placo" et
 * "Placo BA13 hydro".
 */
export function scoreSignatureMatch(a: ProductImportSignature, b: ProductImportSignature): number {
  // Un identifiant present des deux cotes tranche dans les deux sens : egal il
  // prouve l'identite, different il prouve que ce sont deux produits distincts.
  if (a.ean && b.ean) return a.ean === b.ean ? 1 : 0;
  if (a.reference && b.reference) return a.reference === b.reference ? 0.95 : 0;

  // Deux calibres qui se contredisent : "Resi9 XP 10A" n'est pas "Resi9 XP 16A",
  // meme si tout le reste de la designation est identique. Un cote plus detaille
  // que l'autre reste compatible : la capture de tarif est souvent plus courte
  // que la fiche technique.
  if (hasContradictorySpecs(a.specTokens, b.specTokens)) return 0;

  if (!a.tokens.length || !b.tokens.length) return 0;
  const bTokens = new Set(b.tokens);
  const shared = a.tokens.filter((token) => bTokens.has(token)).length;
  if (!shared) return 0;
  return (2 * shared) / (a.tokens.length + b.tokens.length);
}

function hasContradictorySpecs(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const bSet = new Set(b);
  const aSet = new Set(a);
  const onlyInA = a.some((token) => !bSet.has(token));
  const onlyInB = b.some((token) => !aSet.has(token));
  return onlyInA && onlyInB;
}

export const PRODUCT_MATCH_THRESHOLD = 0.55;

/**
 * Fusionne les analyses d'un meme produit. L'identite vient du fichier le plus
 * riche (la fiche technique), les prix du premier fichier qui en donne un (la
 * capture de tarif), et toutes les pieces sont conservees.
 */
export function mergeProductPatches(patches: ProductDraftPatch[]): ProductDraftPatch {
  if (patches.length === 1) return patches[0];

  const merged: ProductDraftPatch = { ...patches[0] };
  const documents = [...(patches[0].documents ?? [])];
  const supplierPrices = [...(patches[0].supplierPrices ?? [])];

  for (const patch of patches.slice(1)) {
    for (const document of patch.documents ?? []) {
      if (!documents.some((existing) => existing.id === document.id)) documents.push(document);
    }
    for (const price of patch.supplierPrices ?? []) {
      supplierPrices.push(...mergeSupplierPrice(supplierPrices, price).slice(supplierPrices.length));
    }

    if (!normalizeText(merged.designation) && normalizeText(patch.designation)) merged.designation = patch.designation;
    if (!normalizeText(merged.brand) && normalizeText(patch.brand)) merged.brand = patch.brand;
    if (!normalizeText(merged.manufacturerReference) && normalizeText(patch.manufacturerReference)) {
      merged.manufacturerReference = patch.manufacturerReference;
    }
    if (!merged.mainSupplierName && patch.mainSupplierName) {
      merged.mainSupplierName = patch.mainSupplierName;
      merged.mainSupplierId = patch.mainSupplierId;
    }
    if (!positivePrice(merged.standardPurchasePriceHt) && positivePrice(patch.standardPurchasePriceHt)) {
      merged.standardPurchasePriceHt = patch.standardPurchasePriceHt;
    }
    if (!positivePrice(merged.recommendedSalePriceHt) && positivePrice(patch.recommendedSalePriceHt)) {
      merged.recommendedSalePriceHt = patch.recommendedSalePriceHt;
    }
  }

  merged.documents = documents;
  merged.supplierPrices = supplierPrices;
  return merged;
}
