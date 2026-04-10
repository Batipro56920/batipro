import { listChantierChangeOrders } from "./chantierChangeOrders.service";
import { listChantierTimeEntriesByChantierId } from "./chantierTimeEntries.service";
import { listDevisByChantier, listDevisLignes } from "./devis.service";
import { supabase } from "../lib/supabaseClient";
import { getTasksByChantierId, type ChantierTaskRow } from "./chantierTasks.service";
import { listChantierPurchaseRequests, type ChantierPurchaseRequestRow } from "./chantierPurchaseRequests.service";

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

export type ChantierBudgetDashboard = {
  settings: ChantierBudgetSettingsRow;
  settingsSchemaReady: boolean;
  chiffreAffairesBaseHt: number;
  avenantsValidesHt: number;
  chiffreAffairesPrevuHt: number;
  coutMoPrevuHt: number;
  coutMoReelHt: number;
  achatsPrevusHt: number;
  achatsReelsHt: number;
  coutPrevuHt: number;
  coutReelHt: number;
  margePrevueHt: number;
  margeReelleHt: number;
  margePrevuePct: number;
  margeReellePct: number;
  depassementBudgetHt: number;
  alertes: string[];
  lots: ChantierBudgetLotRow[];
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
    const parsed = Number(value.trim().replace(",", "."));
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

export async function loadChantierBudgetDashboard(chantierId: string): Promise<ChantierBudgetDashboard> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const [settingsResult, devis, tasks, timeEntries, purchaseResult, changeOrdersResult] = await Promise.all([
    getBudgetSettings(chantierId),
    listDevisByChantier(chantierId),
    getTasksByChantierId(chantierId),
    listChantierTimeEntriesByChantierId(chantierId),
    listChantierPurchaseRequests(chantierId),
    listChantierChangeOrders(chantierId),
  ]);

  const devisLignesGroups = await Promise.all(devis.map((row) => listDevisLignes(row.id)));
  const chiffreAffairesBaseHt = devisLignesGroups
    .flat()
    .reduce((sum, line) => {
      const quantite = normalizeNumber(line.quantite);
      const prixUnitaire = normalizeNumber(line.prix_unitaire_ht);
      return sum + quantite * prixUnitaire;
    }, 0);

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const settings = settingsResult.settings;
  const lotsMap = new Map<string, ChantierBudgetLotRow>();

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
    const lotRow = ensureLot(resolveTaskLot(task));
    lotRow.temps_prevu_h += normalizeNumber(task.temps_prevu_h);
    lotRow.cout_mo_prevu_ht += normalizeNumber(task.temps_prevu_h) * settings.taux_horaire_mo_ht;
  });

  timeEntries.forEach((entry) => {
    const task = entry.task_id ? taskById.get(entry.task_id) : undefined;
    const lotRow = ensureLot(resolveTaskLot(task));
    lotRow.temps_reel_h += normalizeNumber(entry.duration_hours);
    lotRow.cout_mo_reel_ht += normalizeNumber(entry.duration_hours) * settings.taux_horaire_mo_ht;
  });

  purchaseResult.requests.forEach((request) => {
    const task = request.task_id ? taskById.get(request.task_id) : undefined;
    const lotRow = ensureLot(resolveTaskLot(task));
    lotRow.achats_prevus_ht += normalizeNumber((request as any).cout_prevu_ht);
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
    .filter((row) => row.statut === "valide" || row.statut === "realise")
    .reduce((sum, row) => sum + normalizeNumber(row.impact_cout_ht), 0);
  const chiffreAffairesPrevuHt = chiffreAffairesBaseHt + avenantsValidesHt;
  const coutMoPrevuHt = lots.reduce((sum, row) => sum + row.cout_mo_prevu_ht, 0);
  const coutMoReelHt = lots.reduce((sum, row) => sum + row.cout_mo_reel_ht, 0);
  const achatsPrevusHt = lots.reduce((sum, row) => sum + row.achats_prevus_ht, 0);
  const achatsReelsHt = lots.reduce((sum, row) => sum + row.achats_reels_ht, 0);
  const coutPrevuHt = coutMoPrevuHt + achatsPrevusHt;
  const coutReelHt = coutMoReelHt + achatsReelsHt;
  const margePrevueHt = chiffreAffairesPrevuHt - coutPrevuHt;
  const margeReelleHt = chiffreAffairesPrevuHt - coutReelHt;
  const margePrevuePct = safePct(margePrevueHt, chiffreAffairesPrevuHt);
  const margeReellePct = safePct(margeReelleHt, chiffreAffairesPrevuHt);
  const depassementBudgetHt = Math.max(0, coutReelHt - coutPrevuHt);
  const alertes: string[] = [];

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
    achatsPrevusHt,
    achatsReelsHt,
    coutPrevuHt,
    coutReelHt,
    margePrevueHt,
    margeReelleHt,
    margePrevuePct,
    margeReellePct,
    depassementBudgetHt,
    alertes,
    lots,
    achats: purchaseResult.requests,
  };
}
