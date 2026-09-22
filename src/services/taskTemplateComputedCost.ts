import { getCompanyHourlyRates } from "./indirectCosts.service";
import { listTaskTemplatePreparationByTemplateIds } from "./taskTemplatePreparation.service";
import type { TaskTemplateRow } from "./taskLibrary.service";
import { taskTemplateUnitCost } from "./taskCostBasis";

/**
 * Prix de revient d'un modele de tache, calcule.
 *
 * Il existait jusqu'ici un "cout de reference" saisi a la main sur chaque
 * modele. Personne ne le mettait a jour : il affichait 62,24 EUR la ou le
 * calcul reel donnait 30,07 EUR, et il servait de prix dans l'import de devis,
 * le pre-devis de visite et les listes CRM. Une seule verite desormais : le
 * deboursé issu des materiaux, de la main d'oeuvre et des couts indirects.
 *
 * Une seule lecture des ratios et des taux pour toute une liste : appele par
 * des ecrans qui affichent des dizaines de modeles.
 */
export async function loadTaskTemplateUnitCosts(templates: TaskTemplateRow[]): Promise<Map<string, number>> {
  const rows = (templates ?? []).filter((template) => template && template.id);
  const costs = new Map<string, number>();
  if (!rows.length) return costs;

  const [preparation, rates] = await Promise.all([
    listTaskTemplatePreparationByTemplateIds(rows.map((template) => template.id)),
    getCompanyHourlyRates().catch(() => null),
  ]);

  for (const template of rows) {
    const materials = preparation.materialsByTemplateId[template.id] ?? [];
    costs.set(template.id, taskTemplateUnitCost(template, materials, rates).costHt);
  }
  return costs;
}
