/**
 * Reconnait un devis / facture fournisseur : un document dont le contenu est un
 * tableau de lignes d'articles, et non la description d'un seul produit.
 *
 * La distinction commande tout l'import : une fiche technique decrit un produit,
 * un devis en contient quinze. Analyses de la meme facon, les quinze lignes se
 * retrouvaient ecrasees en une seule fiche, avec les prix de deux articles
 * differents pris pour un prix d'achat et un prix de vente.
 */

/** Colonnes attendues dans l'en-tete d'un tableau d'articles. */
const HEADER_GROUPS: string[][] = [
  ["designation", "nomdelarticle", "libelle", "description", "article", "denomination"],
  ["quantite", "qte", "qty", "nbr", "nombre"],
  ["prixunit", "prixunitaire", "prixht", "pu", "punet", "prix", "tarif"],
  ["montant", "total", "montantht"],
];

/** Un document de commerce, par opposition a une documentation produit. */
const COMMERCIAL_MARKERS = [
  "devis",
  "facture",
  "avoir",
  "boncommande",
  "bondecommande",
  "bonlivraison",
  "bondelivraison",
  "remisedeprix",
  "offredeprix",
  "proformat",
  "proforma",
];

/** Lignes consecutives inspectees ensemble : un en-tete se repartit souvent sur plusieurs. */
const HEADER_WINDOW = 10;

function compact(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function matchedGroups(haystack: string): number {
  return HEADER_GROUPS.filter((group) => group.some((token) => haystack.includes(token))).length;
}

export type SupplierQuoteSignals = {
  isQuote: boolean;
  headerGroups: number;
  hasCommercialMarker: boolean;
};

/**
 * Un en-tete de tableau ne suffit pas — une fiche technique peut aligner des
 * caracteristiques en colonnes. On exige aussi que le document se presente
 * comme un document de commerce.
 */
export function detectSupplierQuote(text: string): SupplierQuoteSignals {
  const lines = text.split(/\r?\n/).map(compact).filter((line) => line.length > 0);
  const whole = lines.join("");
  const hasCommercialMarker = COMMERCIAL_MARKERS.some((marker) => whole.includes(marker));

  let headerGroups = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const window = lines.slice(index, index + HEADER_WINDOW).join("");
    const matched = matchedGroups(window);
    if (matched > headerGroups) headerGroups = matched;
    if (headerGroups === HEADER_GROUPS.length) break;
  }

  return {
    isQuote: hasCommercialMarker && headerGroups >= 3,
    headerGroups,
    hasCommercialMarker,
  };
}
