import type { DocumentConditionSheet } from "./types";

export const DEFAULT_DOCUMENT_CONDITIONS = [
  { id: "empty_premises", label: "Les locaux ou zones d'intervention doivent etre vides et accessibles avant le demarrage." },
  { id: "water_point", label: "Un point d'eau utilisable doit etre mis a disposition de l'entreprise." },
  { id: "electricity", label: "Une alimentation electrique fonctionnelle doit etre disponible sur place." },
  { id: "site_access", label: "Les acces chantier, stationnements et zones de livraison doivent etre libres." },
  { id: "keys_access", label: "Les cles, badges ou autorisations d'acces doivent etre fournis avant intervention." },
  { id: "fragile_items", label: "Les objets fragiles, meubles et effets personnels doivent etre deplaces ou proteges par le client." },
  { id: "working_hours", label: "Les horaires d'intervention convenus doivent etre respectes par les parties." },
  { id: "hidden_networks", label: "Le client doit signaler les reseaux, canalisations ou contraintes non visibles connus." },
  { id: "waste_area", label: "Une zone temporaire doit etre autorisee pour le stockage des materiaux et dechets de chantier." },
  { id: "change_requests", label: "Toute demande supplementaire non prevue au devis fera l'objet d'une validation avant execution." },
];

export function buildDocumentConditionSheet(selectedIds: string[]): DocumentConditionSheet | null {
  const conditions = DEFAULT_DOCUMENT_CONDITIONS.filter((condition) => selectedIds.includes(condition.id));
  if (!conditions.length) return null;
  return {
    enabled: true,
    title: "Fiche de conditions chantier",
    signatureText: "Le client reconnait avoir pris connaissance des conditions chantier selectionnees et les accepte avec le devis.",
    conditions,
  };
}
