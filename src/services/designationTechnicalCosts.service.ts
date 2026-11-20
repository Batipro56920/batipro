import type { ChantierTaskRow } from "./chantierTasks.service";
import type { DevisLigneRow } from "./devis.service";
import type { TaskTemplateRow } from "./taskLibrary.service";
import type { CompanyHourlyRates } from "./indirectCosts.service";
import type { TaskTemplateMaterialRatioRow, TaskTemplateEquipmentItemRow } from "./taskTemplatePreparation.service";
import { taskTemplateUnitCost } from "./taskCostBasis";

/** One designation can have many technical tasks; one task belongs to at most one designation.
 * The link is the existing chantier_tasks.devis_ligne_id column: no parallel mapping table.
 */
export type TechnicalTaskCost = {
  status: "calculated" | "incomplete";
  reason: string | null;
  quantity: number;
  hours: number;
  laborHt: number;
  materialsHt: number;
  consumablesHt: number;
  equipmentHt: number;
  /** Included in laborHt: never add again to total. */
  indirectIncludedHt: number;
  totalHt: number | null;
};

export type DesignationCostSummary = {
  saleHt: number | null;
  costHt: number | null;
  marginHt: number | null;
  complete: boolean;
  linkedTasks: number;
};

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTechnicalTaskCost(
  task: ChantierTaskRow,
  templates: Map<string, TaskTemplateRow>,
  materials: Record<string, TaskTemplateMaterialRatioRow[]>,
  equipment: Record<string, TaskTemplateEquipmentItemRow[]>,
  rates: CompanyHourlyRates | null,
): TechnicalTaskCost {
  const quantity = Number(task.quantite);
  const id = task.task_template_id ?? "";
  const template = templates.get(id);
  const incomplete = (reason: string): TechnicalTaskCost => ({
    status: "incomplete", reason, quantity: Number.isFinite(quantity) ? quantity : 0,
    hours: 0, laborHt: 0, materialsHt: 0, consumablesHt: 0,
    equipmentHt: 0, indirectIncludedHt: 0, totalHt: null,
  });
  if (!template) return incomplete("Tâche bibliothèque non associée");
  // Historical PDF imports created one pseudo-task per designation and matched
  // a library model automatically, sometimes to a completely different trade.
  // Never treat those mismatched links as validated technical work.
  const normalize = (value: string | null | undefined) => String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
  if (task.libelle_devis_original && normalize(task.titre_terrain ?? task.titre) !== normalize(template.titre)) {
    return incomplete("Ancienne tâche importée : confirmer la tâche technique bibliothèque");
  }
  if (!Number.isFinite(Number(template.temps_prevu_par_unite_h)) || Number(template.temps_prevu_par_unite_h) <= 0) {
    return incomplete("Temps de main-d'œuvre par unité manquant dans la bibliothèque");
  }
  if (!Number.isFinite(quantity) || quantity <= 0) return incomplete("Quantité non renseignée");
  if (!rates || rates.averageEmployeeHourlyCostHt <= 0 || rates.productiveHoursPerYear <= 0) {
    return incomplete("Coût horaire productif non paramétré");
  }
  if (template.unite && task.unite &&
      template.unite.trim().toLowerCase().replace("²", "2") !== task.unite.trim().toLowerCase().replace("²", "2")) {
    return incomplete("Unité différente de la bibliothèque");
  }
  const templateMaterials = materials[id] ?? [];
  if (templateMaterials.some((row) =>
    row.ratio_quantity > 0 && (row.purchase_price_ht === null || !Number.isFinite(row.purchase_price_ht)))) {
    return incomplete("Prix d'achat manquant pour un matériau/consommable");
  }
  const templateEquipment = equipment[id] ?? [];
  if (templateEquipment.some((row) =>
    row.is_required && (!row.equipment_asset_id || !rates.equipmentAssets.some((asset) => asset.id === row.equipment_asset_id && asset.active)))) {
    return incomplete("Matériel requis sans fiche d'amortissement active");
  }
  // A technical task has its own template cost; an imported quote's estimated_cost_ht is never a source.
  const unit = taskTemplateUnitCost(template, templateMaterials, rates, templateEquipment);
  const feeItems = template.fee_items ?? [];
  if (feeItems.some((fee) => fee.amountCostHt === null || !Number.isFinite(fee.amountCostHt))) {
    return incomplete("Frais ou consommables sans coût renseigné");
  }
  const consumablesHt = feeItems.filter((fee) => fee.type === "consumables")
    .reduce((sum, fee) => sum + Number(fee.amountCostHt ?? 0), 0) * quantity;
  const otherFeesHt = feeItems.filter((fee) => fee.type !== "consumables")
    .reduce((sum, fee) => sum + Number(fee.amountCostHt ?? 0), 0) * quantity;
  // Indirects are already included in unit.laborHt, not added twice.
  return {
    status: "calculated", reason: null, quantity,
    hours: round(unit.hours * quantity),
    laborHt: round(unit.laborHt * quantity),
    materialsHt: round(unit.materialsHt * quantity + otherFeesHt),
    consumablesHt: round(consumablesHt),
    equipmentHt: round(unit.equipmentHt * quantity),
    indirectIncludedHt: round(unit.indirectHt * quantity),
    totalHt: round(unit.costHt * quantity + consumablesHt + otherFeesHt),
  };
}

export function computeDesignationCost(
  designation: DevisLigneRow,
  tasks: ChantierTaskRow[],
  costs: Map<string, TechnicalTaskCost>,
): DesignationCostSummary {
  const quantity = Number(designation.quantite);
  const unitPrice = Number(designation.prix_unitaire_ht);
  const saleHt = designation.quantite !== null && designation.prix_unitaire_ht !== null &&
    Number.isFinite(quantity) && Number.isFinite(unitPrice) ? round(quantity * unitPrice) : null;
  const linked = tasks.filter((task) => task.devis_ligne_id === designation.id);
  const complete = linked.length > 0 && linked.every((task) => costs.get(task.id)?.status === "calculated");
  const costHt = complete ? round(linked.reduce((sum, task) => sum + (costs.get(task.id)?.totalHt ?? 0), 0)) : null;
  return {
    saleHt, costHt,
    marginHt: saleHt !== null && costHt !== null ? round(saleHt - costHt) : null,
    complete, linkedTasks: linked.length,
  };
}
