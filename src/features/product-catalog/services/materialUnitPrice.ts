import type { ProductCatalogItem, ProductSupplierPrice } from "../domain/types";
import { normalizeUnit } from "./productMaterialAutofill.service";

/**
 * Prix d'achat exprime dans l'unite du ratio, et non dans celle du produit.
 *
 * Le catalogue connait deux prix pour un meme produit : celui du colis (9 EUR
 * la plaque) et celui ramene a l'unite du produit (3 EUR le m2, une plaque
 * couvrant 3 m2). Le ratio d'une tache, lui, peut etre ecrit dans l'une ou
 * l'autre : "0,4 plaque par m2" ou "1,05 m2 par m2".
 *
 * Jusqu'ici le prix retenu etait toujours celui a l'unite du produit, quelle
 * que soit l'unite du ratio. Un ratio en plaques se chiffrait donc au prix du
 * m2 : 0,4 x 3 EUR = 1,20 EUR au lieu de 0,4 x 9 EUR = 3,60 EUR. Le materiau
 * etait sous-evalue d'autant de fois qu'un colis contient d'unites.
 */

export type MaterialPriceBasis = "unite_produit" | "colis" | "indetermine";

export type MaterialUnitPrice = {
  /** Prix pour une unite du ratio, ou null si le catalogue n'en donne aucun. */
  priceHt: number | null;
  basis: MaterialPriceBasis;
  /** Contenu d'un colis, dans l'unite du produit. */
  packageQuantity: number | null;
  productUnit: string | null;
  ratioUnit: string | null;
};

/**
 * Unites de mesure. Tout le reste ("plaque", "sac", "pot", "rouleau") compte
 * des colis : ce sont des emballages, pas des mesures.
 */
const MEASUREMENT_UNITS = new Set(["m2", "m3", "ml", "kg", "g", "l", "u", "h"]);

/**
 * Mots d'emballage. normalizeUnit les traduit en unites de mesure — "pot"
 * devient "l", "sac" devient "kg" — ce qui efface justement l'information
 * dont on a besoin : un ratio en pots se chiffre au prix du pot, pas au litre.
 * On les reconnait donc sur le mot brut, avant toute normalisation.
 */
const PACKAGE_WORDS = new Set([
  "plaque", "sac", "pot", "seau", "colis", "rouleau", "botte", "boite", "paquet",
  "carton", "bidon", "cartouche", "panneau", "palette", "lot", "piece",
]);

function rawWord(value: unknown): string {
  const word = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  // Pluriel simple : "plaques" et "plaque" designent le meme emballage.
  return word.endsWith("s") && word.length > 2 ? word.slice(0, -1) : word;
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function activeSupplierPrices(product: ProductCatalogItem): ProductSupplierPrice[] {
  const today = new Date().toISOString().slice(0, 10);
  return (Array.isArray(product.supplierPrices) ? product.supplierPrices : []).filter(
    (price) => (!price.startDate || price.startDate <= today) && (!price.endDate || price.endDate >= today),
  );
}

/** Le colis le moins cher a l'unite, comme partout ailleurs dans le catalogue. */
function bestPrice(product: ProductCatalogItem): ProductSupplierPrice | null {
  const unitPriceOf = (price: ProductSupplierPrice) => {
    const explicit = positive(price.pricePerM2Ht);
    if (explicit !== null) return explicit;
    const packagePrice = positive(price.priceHt);
    const quantity = positive(price.coverageM2);
    return packagePrice !== null && quantity !== null ? packagePrice / quantity : (packagePrice ?? Number.POSITIVE_INFINITY);
  };
  return activeSupplierPrices(product).sort((a, b) => unitPriceOf(a) - unitPriceOf(b))[0] ?? null;
}

export function resolveMaterialUnitPrice(product: ProductCatalogItem, rawRatioUnit: unknown): MaterialUnitPrice {
  const ratioWord = rawWord(rawRatioUnit);
  const productWord = rawWord(product.unit);
  const ratioUnit = normalizeUnit(rawRatioUnit);
  const productUnit = normalizeUnit(product.unit);
  const price = bestPrice(product);
  const packageQuantity = price ? positive(price.coverageM2) : null;
  const packagePriceHt = price ? positive(price.priceHt) : null;
  const perProductUnit =
    (price ? positive(price.pricePerM2Ht) : null) ??
    (packagePriceHt !== null && packageQuantity !== null ? Math.round((packagePriceHt / packageQuantity) * 100) / 100 : null) ??
    positive(product.standardPurchasePriceHt);

  const base = { packageQuantity, productUnit, ratioUnit };

  // Le meme mot des deux cotes : le produit est vendu dans l'unite du ratio.
  if (!ratioWord || ratioWord === productWord) {
    return { ...base, priceHt: perProductUnit, basis: "unite_produit" };
  }

  // Le ratio compte des emballages : c'est le prix du colis qu'il faut.
  if (PACKAGE_WORDS.has(ratioWord) && packagePriceHt !== null) {
    return { ...base, priceHt: packagePriceHt, basis: "colis" };
  }

  // Meme unite une fois normalisee ("m 2" et "m2") : prix a l'unite du produit.
  if (ratioUnit && productUnit && ratioUnit === productUnit) {
    return { ...base, priceHt: perProductUnit, basis: "unite_produit" };
  }

  // Unite inconnue au bataillon, mais un colis existe : ce sont des colis.
  if (ratioUnit && !MEASUREMENT_UNITS.has(ratioUnit) && packagePriceHt !== null) {
    return { ...base, priceHt: packagePriceHt, basis: "colis" };
  }

  // Deux unites de mesure differentes (des kg pour un produit vendu au litre),
  // ou aucun colis connu : aucune conversion possible. On ne devine pas, on
  // rend le prix a l'unite du produit en disant qu'il ne correspond pas.
  return { ...base, priceHt: perProductUnit, basis: "indetermine" };
}

/** Ce que couvre le prix, dit en clair pour que l'ecart se voie a l'oeil. */
export function describeMaterialPriceBasis(resolved: MaterialUnitPrice): string {
  if (resolved.priceHt === null) return "Aucun prix d'achat dans la fiche produit.";
  const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(resolved.priceHt);
  const unit = resolved.ratioUnit || resolved.productUnit || "u";

  if (resolved.basis === "colis") {
    const contenu =
      resolved.packageQuantity !== null && resolved.productUnit
        ? ` (colis de ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(resolved.packageQuantity)} ${resolved.productUnit})`
        : "";
    return `Achat ${amount} / ${unit}${contenu}`;
  }
  if (resolved.basis === "indetermine") {
    return `Achat ${amount} / ${resolved.productUnit || "u"} — mais le ratio est en ${unit} : le prix ne correspond pas a cette unite.`;
  }
  return `Achat ${amount} / ${unit}`;
}
