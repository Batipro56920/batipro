/**
 * Categories proposees a la creation d'un produit.
 *
 * Le champ reste libre : un produit qui n'entre dans aucune de ces cases se
 * saisit tel quel. Ces valeurs ne sont qu'un point de depart, pour que deux
 * produits du meme corps d'etat ne finissent pas sous deux libelles differents
 * ("Elec", "electricite", "Électricité") — ce qui casserait le filtre du
 * catalogue, qui compare les categories a l'identique.
 */
export const DEFAULT_PRODUCT_CATEGORIES = [
  "Électricité",
  "Plomberie / Sanitaire",
  "Chauffage / Climatisation",
  "Ventilation",
  "Menuiserie intérieure",
  "Menuiserie extérieure / Fermetures",
  "Plâtrerie / Cloisons",
  "Isolation",
  "Maçonnerie / Gros œuvre",
  "Charpente / Couverture",
  "Étanchéité",
  "Carrelage / Faïence",
  "Revêtements de sol",
  "Peinture / Revêtements muraux",
  "Serrurerie / Métallerie",
  "Quincaillerie / Fixations",
  "Outillage / Consommables",
  "EPI / Sécurité",
  "Aménagements extérieurs / VRD",
  "Divers",
] as const;

/** Comparaison tolerante aux accents, a la casse et a la ponctuation. */
export function normalizeCategoryKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Les categories deja utilisees dans le catalogue passent devant : ce sont
 * celles de l'entreprise. La liste standard complete, sans doublon.
 */
export function buildCategorySuggestions(used: Array<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const label = value.trim();
    if (!label) return;
    const key = normalizeCategoryKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(label);
  };

  for (const value of used) push(String(value ?? ""));
  for (const value of DEFAULT_PRODUCT_CATEGORIES) push(value);

  return result;
}
