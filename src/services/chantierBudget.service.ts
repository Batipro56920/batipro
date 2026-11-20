import { listChantierChangeOrders } from "./chantierChangeOrders.service";
import { listChantierTimeEntriesByChantierId } from "./chantierTimeEntries.service";
import { listDevisByChantier, listDevisLignes } from "./devis.service";
import { supabase } from "../lib/supabaseClient";
import { getTasksByChantierId, type ChantierTaskRow } from "./chantierTasks.service";
import { listChantierPurchaseRequests, type ChantierPurchaseRequestRow } from "./chantierPurchaseRequests.service";
import { listIntervenants } from "./intervenants.service";
import { configuredWorkerRates, sumLaborValues, valueLaborEntry } from "./laborCostValuation.service";
import { getChantierMaterialCost } from "./productStock.service";
import { getCompanyHourlyRates } from "./indirectCosts.service";
import { list as listTaskTemplates } from "./taskLibrary.service";
import { listTaskTemplatePreparationByTemplateIds } from "./taskTemplatePreparation.service";
import { computeTechnicalTaskCost, type TechnicalTaskCost } from "./designationTechnicalCosts.service";

export type ChantierBudgetSettingsRow = {
  chantier_id: string;
  taux_horaire_mo_ht: number;
  objectif_marge_pct: number;
  commentaire: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierBudgetLotRow = {
  lot: string;
  temps_prevu_h: number;
  temps_reel_h: number;
  cout_mo_prevu_ht: number;
  cout_mo_reel_ht: number;
  achats_prevus_ht: number;
  achats_reels_ht: number;
};

export type ChantierLaborCostSummary = {
  chantierId: string;
  hours: number;
  hourlyRateHt: number;
  laborCostHt: number;
  hoursUsingChantierRate: number;
  hoursUsingSnapshot: number;
  usesDefaultRate: boolean;
};

export type ChantierBudgetTaskRow = {
  taskId: string | null;
  title: string;
  lot: string;
  plannedHours: number;
  actualHours: number;
  plannedLaborCostHt: number;
  actualLaborCostHt: number;
  plannedCostComplete: boolean;
};

export type ChantierBudgetDashboard = {
  settings: ChantierBudgetSettingsRow;
  settingsSchemaReady: boolean;
  chiffreAffairesBaseHt: number;
  avenantsValidesHt: number;
  chiffreAffairesPrevuHt: number;
  coutMoPrevuHt: number;
  coutMoReelHt: number;
  coutMoReelIndirectHt: number | null;
  coutMoReelCompletHt: number | null;
  achatsPrevusHt: number;
  achatsReelsHt: number;
  achatsSaisisHt: number;
  /** Coût matières venant des mouvements de stock rattachés au chantier. */
  achatsLivresHt: number;
  coutPrevuHt: number;
  /** Null until all technical tasks are linked to priced templates. */
  coutTechniquePrevuHt: number | null;
  previsionTechniqueComplete: boolean;
  previsionTechniqueManquants: string[];
  /** Real cost including overheads where the company rates are configured. */
  coutReelCompletHt: number | null;
  coutReelHt: number;
  margePrevueHt: number;
  margeReelleHt: number;
  margePrevuePct: number;
  margeReellePct: number;
  depassementBudgetHt: number;
  alertes: string[];
  lots: ChantierBudgetLotRow[];
  taskLabor: ChantierBudgetTaskRow[];
  achats: ChantierPurchaseRequestRow[];
};

const DEFAULT_SETTINGS: ChantierBudgetSettingsRow = {
  chantier_id: "",
  taux_horaire_mo_ht: 48,
  objectif_marge_pct: 25,
  commentaire: null,
  created_at: null,
  updated_at: null,
};

const SETTINGS_SELECT = [
  "chantier_id",
  "taux_horaire_mo_ht",
  "objectif_marge_pct",
  "commentaire",
  "created_at",
  "updated_at",
].join(",");

function fromBudgetSettings() {
  return (supabase as any).from("chantier_budget_settings");
}

function normalizeNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const withoutSpaces = value.trim().replace(/[\s\u00A0]/g, "");
    const raw =
      withoutSpaces.includes(",") && withoutSpaces.includes(".")
        ? withoutSpaces.replace(/\./g, "").replace(",", ".")
        : withoutSpaces.replace(",", ".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return 0;
}

function safePct(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

function isMissingBudgetSettingsSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return (
    msg.includes("chantier_budget_settings") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function normalizeSettingsRow(row: any, chantierId: string): ChantierBudgetSettingsRow {
  return {
    chantier_id: row?.chantier_id ?? chantierId,
    taux_horaire_mo_ht: Math.max(0, normalizeNumber(row?.taux_horaire_mo_ht) || DEFAULT_SETTINGS.taux_horaire_mo_ht),
    objectif_marge_pct: Math.max(0, normalizeNumber(row?.objectif_marge_pct) || DEFAULT_SETTINGS.objectif_marge_pct),
    commentaire: String(row?.commentaire ?? "").trim() || null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function resolveTaskLot(task: ChantierTaskRow | undefined): string {
  return String(task?.corps_etat ?? task?.lot ?? "Sans lot").trim() || "Sans lot";
}

async function getBudgetSettings(
  chantierId: string,
): Promise<{ settings: ChantierBudgetSettingsRow; schemaReady: boolean }> {
  const { data, error } = await fromBudgetSettings()
    .select(SETTINGS_SELECT)
    .eq("chantier_id", chantierId)
    .maybeSingle();

  if (!error) {
    return {
      settings: normalizeSettingsRow(data ?? { chantier_id: chantierId }, chantierId),
      schemaReady: true,
    };
  }

  if (isMissingBudgetSettingsSchemaError(error)) {
    return {
      settings: { ...DEFAULT_SETTINGS, chantier_id: chantierId },
      schemaReady: false,
    };
  }

  throw error;
}

export async function upsertChantierBudgetSettings(
  chantierId: string,
  patch: {
    taux_horaire_mo_ht?: number | string | null;
    objectif_marge_pct?: number | string | null;
    commentaire?: string | null;
  },
): Promise<ChantierBudgetSettingsRow> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const current = await getBudgetSettings(chantierId);
  if (!current.schemaReady) {
    throw new Error("Migration budget chantier non appliquee sur Supabase.");
  }

  const payload = {
    chantier_id: chantierId,
    taux_horaire_mo_ht: Math.max(
      0,
      normalizeNumber(patch.taux_horaire_mo_ht ?? current.settings.taux_horaire_mo_ht) ||
        DEFAULT_SETTINGS.taux_horaire_mo_ht,
    ),
    objectif_marge_pct: Math.max(
      0,
      normalizeNumber(patch.objectif_marge_pct ?? current.settings.objectif_marge_pct) ||
        DEFAULT_SETTINGS.objectif_marge_pct,
    ),
    commentaire:
      typeof patch.commentaire === "string"
        ? patch.commentaire.trim() || null
        : current.settings.commentaire,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await fromBudgetSettings()
    .upsert(payload, { onConflict: "chantier_id" })
    .select(SETTINGS_SELECT)
    .maybeSingle();

  if (error) throw error;
  return normalizeSettingsRow(data ?? payload, chantierId);
}

export async function listChantierLaborCostSummaries(
  chantierIds: string[],
  period: { from?: string | null; to?: string | null } = {},
): Promise<ChantierLaborCostSummary[]> {
  const ids = Array.from(new Set(chantierIds.filter(Boolean)));
  if (!ids.length) return [];

  const fetchTimeEntries = async (withSnapshot: boolean) => {
    let query = (supabase as any)
      .from("chantier_time_entries")
      .select(withSnapshot
        ? "chantier_id,intervenant_id,duration_hours,work_date,hourly_cost_snapshot_ht,hourly_cost_snapshot_source"
        : "chantier_id,intervenant_id,duration_hours,work_date")
      .in("chantier_id", ids);
    if (period.from) query = query.gte("work_date", period.from);
    if (period.to) query = query.lte("work_date", period.to);
    return query;
  };
  const loadTimeRows = async () => {
    const latest = await fetchTimeEntries(true);
    if (!latest.error) return latest;
    const errorText = String(latest.error.message ?? "").toLowerCase();
    if (!["hourly_cost_snapshot_ht", "42703"].some((token) => errorText.includes(token))
        && latest.error.code !== "42703") return latest;
    return fetchTimeEntries(false);
  };

  const [settingsResult, timeResult, intervenants] = await Promise.all([
    fromBudgetSettings()
      .select("chantier_id,taux_horaire_mo_ht")
      .in("chantier_id", ids),
    loadTimeRows(),
    listIntervenants(),
  ]);

  let settingsSchemaReady = true;
  const settingsByChantierId = new Map<string, number>();
  if (settingsResult.error) {
    if (!isMissingBudgetSettingsSchemaError(settingsResult.error)) throw settingsResult.error;
    settingsSchemaReady = false;
  } else {
    (settingsResult.data ?? []).forEach((row: any) => {
      settingsByChantierId.set(
        String(row.chantier_id),
        Math.max(0, normalizeNumber(row.taux_horaire_mo_ht) || DEFAULT_SETTINGS.taux_horaire_mo_ht),
      );
    });
  }

  if (timeResult.error) throw timeResult.error;

  const individualRateById = configuredWorkerRates(intervenants);
  const totalsByChantierId = new Map<string, ReturnType<typeof valueLaborEntry>[]>();
  (timeResult.data ?? []).forEach((row: any) => {
    const chantierId = String(row.chantier_id ?? "");
    if (!chantierId) return;
    const chantierRate = settingsByChantierId.get(chantierId) ?? DEFAULT_SETTINGS.taux_horaire_mo_ht;
    const cost = valueLaborEntry({
      chantier_id: chantierId,
      intervenant_id: String(row.intervenant_id ?? ""),
      duration_hours: normalizeNumber(row.duration_hours),
      hourly_cost_snapshot_ht: row.hourly_cost_snapshot_ht,
      hourly_cost_snapshot_source: row.hourly_cost_snapshot_source,
    }, individualRateById, chantierRate);
    const values = totalsByChantierId.get(chantierId) ?? [];
    values.push(cost);
    totalsByChantierId.set(chantierId, values);
  });

  return ids.map((chantierId) => {
    const totals = sumLaborValues(totalsByChantierId.get(chantierId) ?? []);
    const hasConfiguredRate = settingsSchemaReady && settingsByChantierId.has(chantierId);
    const chantierRate = settingsByChantierId.get(chantierId) ?? DEFAULT_SETTINGS.taux_horaire_mo_ht;
    return {
      chantierId,
      hours: totals.hours,
      hourlyRateHt: totals.hours > 0 ? totals.laborCostHt / totals.hours : chantierRate,
      laborCostHt: totals.laborCostHt,
      hoursUsingChantierRate: totals.hoursUsingChantierRate,
      hoursUsingSnapshot: totals.hoursUsingSnapshot,
      usesDefaultRate: totals.hoursUsingChantierRate > 0 && !hasConfiguredRate,
    };
  });
}

export async function loadChantierBudgetDashboard(chantierId: string): Promise<ChantierBudgetDashboard> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const [settingsResult, devis, tasks, timeEntries, purchaseResult, changeOrdersResult, materialCostHt, intervenants, companyRates] = await Promise.all([
    getBudgetSettings(chantierId),
    listDevisByChantier(chantierId),
    getTasksByChantierId(chantierId),
    listChantierTimeEntriesByChantierId(chantierId),
    listChantierPurchaseRequests(chantierId),
    listChantierChangeOrders(chantierId),
    getChantierMaterialCost(chantierId),
    listIntervenants(),
    getCompanyHourlyRates().catch(() => null),
  ]);

  const devisLignesGroups = await Promise.all(devis.map((row) => listDevisLignes(row.id)));
  const chiffreAffairesBaseHt = devisLignesGroups
    .flat()
    .reduce((sum, line) => {
      const quantite = normalizeNumber(line.quantite);
      const prixUnitaire = normalizeNumber(line.prix_unitaire_ht);
      return sum + quantite * prixUnitaire;
    }, 0);

  const [templates, prep] = await (async () => {
    const templates = await listTaskTemplates();
    const prep = await listTaskTemplatePreparationByTemplateIds(templates.map((template) => template.id));
    return [templates, prep] as const;
  })();
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const technicalCosts = new Map<string, TechnicalTaskCost>();
  const previsionTechniqueManquants: string[] = [];
  for (const task of tasks) {
    const cost = computeTechnicalTaskCost(
      task, templateMap,
      prep.schemaReady ? prep.materialsByTemplateId : {},
      prep.schemaReady ? prep.equipmentByTemplateId : {},
      prep.schemaReady ? companyRates : null,
    );
    technicalCosts.set(task.id, cost);
    if (cost.status === "incomplete") {
      previsionTechniqueManquants.push(`${task.titre_terrain || task.titre} : ${cost.reason ?? "chiffrage incomplet"}`);
    }
  }
  if (!prep.schemaReady) previsionTechniqueManquants.push("Ratios de bibliothèque indisponibles");
  const previsionTechniqueComplete = prep.schemaReady && tasks.length > 0 && previsionTechniqueManquants.length === 0;

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const settings = settingsResult.settings;
  const lotsMap = new Map<string, ChantierBudgetLotRow>();
  const taskLaborMap = new Map<string, ChantierBudgetTaskRow>();
  const individualRateById = configuredWorkerRates(intervenants);
  let hoursUsingChantierRate = 0;
  let employeeHours = 0;
  const employeeIds = new Set(intervenants.filter((person) => person.status === "employee").map((person) => person.id));

  function ensureLot(lot: string): ChantierBudgetLotRow {
    const normalizedLot = String(lot || "Sans lot").trim() || "Sans lot";
    const existing = lotsMap.get(normalizedLot);
    if (existing) return existing;
    const created: ChantierBudgetLotRow = {
      lot: normalizedLot,
      temps_prevu_h: 0,
      temps_reel_h: 0,
      cout_mo_prevu_ht: 0,
      cout_mo_reel_ht: 0,
      achats_prevus_ht: 0,
      achats_reels_ht: 0,
    };
    lotsMap.set(normalizedLot, created);
    return created;
  }

  tasks.forEach((task) => {
    const lot = resolveTaskLot(task);
    const lotRow = ensureLot(lot);
    const technical = technicalCosts.get(task.id);
    const plannedHours = technical?.status === "calculated" ? technical.hours : normalizeNumber(task.temps_prevu_h);
    const plannedLaborCostHt = technical?.status === "calculated" ? technical.laborHt : 0;
    lotRow.temps_prevu_h += plannedHours;
    lotRow.cout_mo_prevu_ht += plannedLaborCostHt;
    if (technical?.status === "calculated") {
      // Materials, consumables and dedicated equipment form the non-labor
      // technical forecast. Purchase requests are not added a second time.
      lotRow.achats_prevus_ht += technical.materialsHt + technical.consumablesHt + technical.equipmentHt;
    }
    taskLaborMap.set(task.id, {
      taskId: task.id,
      title: task.titre || "Tâche",
      lot,
      plannedHours,
      actualHours: 0,
      plannedLaborCostHt,
      actualLaborCostHt: 0,
      plannedCostComplete: technical?.status === "calculated",
    });
  });

  timeEntries.forEach((entry) => {
    const task = entry.task_id ? taskById.get(entry.task_id) : undefined;
    const lotRow = ensureLot(resolveTaskLot(task));
    lotRow.temps_reel_h += normalizeNumber(entry.duration_hours);
    const valuation = valueLaborEntry({
      chantier_id: chantierId,
      intervenant_id: entry.intervenant_id,
      duration_hours: entry.duration_hours,
      hourly_cost_snapshot_ht: entry.hourly_cost_snapshot_ht,
      hourly_cost_snapshot_source: entry.hourly_cost_snapshot_source,
    }, individualRateById, settings.taux_horaire_mo_ht);
    lotRow.cout_mo_reel_ht += valuation.laborCostHt;
    const key = task?.id ?? "__unassigned__";
    const currentTask = taskLaborMap.get(key) ?? {
      taskId: null, title: "Heures sans tâche", lot: resolveTaskLot(undefined),
      plannedHours: 0, actualHours: 0, plannedLaborCostHt: 0, actualLaborCostHt: 0, plannedCostComplete: false,
    };
    currentTask.actualHours += valuation.hours;
    currentTask.actualLaborCostHt += valuation.laborCostHt;
    taskLaborMap.set(key, currentTask);
    hoursUsingChantierRate += valuation.hoursUsingChantierRate;
    if (employeeIds.has(entry.intervenant_id)) employeeHours += valuation.hours;
  });

  purchaseResult.requests.forEach((request) => {
    const task = request.task_id ? taskById.get(request.task_id) : undefined;
    const lotRow = ensureLot(resolveTaskLot(task));
    // Planned resources are sourced from the task template. A purchase
    // request is the execution of that plan, never another planned expense.
    lotRow.achats_reels_ht += normalizeNumber((request as any).cout_reel_ht);
  });

  const lots = [...lotsMap.values()].sort(
    (a, b) =>
      b.cout_mo_reel_ht +
      b.achats_reels_ht -
      (a.cout_mo_reel_ht + a.achats_reels_ht) ||
      a.lot.localeCompare(b.lot, "fr"),
  );

  const avenantsValidesHt = changeOrdersResult.changeOrders
    .filter(
      (row) =>
        row.type_ecart === "travaux_supplementaires" &&
        ["valide_client", "en_cours", "termine", "facture"].includes(row.statut),
    )
    .reduce((sum, row) => sum + normalizeNumber((row as any).total_ht ?? row.impact_cout_ht), 0);

  const chiffreAffairesPrevuHt = chiffreAffairesBaseHt + avenantsValidesHt;
  const coutMoPrevuHt = lots.reduce((sum, row) => sum + row.cout_mo_prevu_ht, 0);
  const coutMoReelHt = lots.reduce((sum, row) => sum + row.cout_mo_reel_ht, 0);
  // Coût complet indicatif, séparé du déboursé direct utilisé dans les marges
  // existantes. Ne jamais ajouter ces frais une seconde fois au coût des tâches.
  const coutMoReelIndirectHt = companyRates
    ? employeeHours * (companyRates.overheadRatePerHour + companyRates.amortizationRatePerHour)
    : null;
  const coutMoReelCompletHt = coutMoReelIndirectHt === null ? null : coutMoReelHt + coutMoReelIndirectHt;
  const achatsPrevusHt = lots.reduce((sum, row) => sum + row.achats_prevus_ht, 0);
  const achatsSaisisHt = lots.reduce((sum, row) => sum + row.achats_reels_ht, 0);
  // Les bons de livraison lus sur le terrain s'ajoutent aux achats saisis au
  // bureau : ce sont deux sources distinctes du meme cout matieres.
  const achatsLivresHt = normalizeNumber(materialCostHt);
  const achatsReelsHt = achatsSaisisHt + achatsLivresHt;
  const coutPrevuHt = coutMoPrevuHt + achatsPrevusHt;
  const coutTechniquePrevuHt = previsionTechniqueComplete ? coutPrevuHt : null;
  const coutReelHt = coutMoReelHt + achatsReelsHt;
  const coutReelCompletHt = coutMoReelCompletHt === null ? null : coutMoReelCompletHt + achatsReelsHt;
  const margePrevueHt = chiffreAffairesPrevuHt - coutPrevuHt;
  const margeReelleHt = chiffreAffairesPrevuHt - coutReelHt;
  const margePrevuePct = safePct(margePrevueHt, chiffreAffairesPrevuHt);
  const margeReellePct = safePct(margeReelleHt, chiffreAffairesPrevuHt);
  const depassementBudgetHt = Math.max(0, coutReelHt - coutPrevuHt);
  const alertes: string[] = [];
  if (hoursUsingChantierRate > 0) alertes.push(`${hoursUsingChantierRate.toLocaleString("fr-FR")} h valorisées au taux chantier faute de coût individuel.`);

  if (depassementBudgetHt > 0) {
    alertes.push(`Depassement budget de ${Math.round(depassementBudgetHt)} EUR HT`);
  }
  if (margeReellePct < settings.objectif_marge_pct) {
    alertes.push(`Marge reelle sous objectif (${margeReellePct.toFixed(1)} % / ${settings.objectif_marge_pct.toFixed(1)} %)`);
  }
  if (!purchaseResult.schemaReady) {
    alertes.push("Migration couts achats non appliquee");
  }

  return {
    settings,
    settingsSchemaReady: settingsResult.schemaReady,
    chiffreAffairesBaseHt,
    avenantsValidesHt,
    chiffreAffairesPrevuHt,
    coutMoPrevuHt,
    coutMoReelHt,
    coutMoReelIndirectHt,
    coutMoReelCompletHt,
    achatsPrevusHt,
    achatsReelsHt,
    achatsSaisisHt,
    achatsLivresHt,
    coutPrevuHt,
    coutTechniquePrevuHt,
    previsionTechniqueComplete,
    previsionTechniqueManquants,
    coutReelCompletHt,
    coutReelHt,
    margePrevueHt,
    margeReelleHt,
    margePrevuePct,
    margeReellePct,
    depassementBudgetHt,
    alertes,
    lots,
    taskLabor: [...taskLaborMap.values()].sort((a,b) => b.actualLaborCostHt - a.actualLaborCostHt),
    achats: purchaseResult.requests,
  };
}
