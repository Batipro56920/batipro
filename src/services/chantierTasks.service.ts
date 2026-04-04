// src/services/chantierTasks.service.ts
import { supabase } from "../lib/supabaseClient";

/* =========================================================
   TYPES
   ========================================================= */

export type TaskStatus = "A_FAIRE" | "EN_COURS" | "FAIT";
export type TaskQualityStatus =
  | "a_faire"
  | "en_cours"
  | "termine_intervenant"
  | "valide_admin"
  | "a_reprendre";
export type TaskAdminValidationStatus = "non_verifie" | "valide" | "a_reprendre";
export type TaskPriority = "basse" | "normale" | "haute" | "urgente";

export type ChantierTaskRow = {
  id: string;
  chantier_id: string;

  titre: string;
  titre_terrain: string | null;
  libelle_devis_original: string | null;
  devis_ligne_id: string | null;
  task_template_id: string | null;
  task_template_label: string | null;
  corps_etat: string | null;
  lot: string | null;
  zone_id: string | null;
  etape_metier: string | null;
  description_technique: string | null;
  caracteristiques: string[];
  priorite: TaskPriority;
  prix_unitaire_devis_ht: number | null;
  montant_total_devis_ht: number | null;
  tva_taux_devis: number | null;
  cout_estime_ht: number | null;
  cout_matiere_estime_ht: number | null;
  cout_mo_estime_ht: number | null;
  date: string | null; // date prévue (ancienne logique)
  status: TaskStatus;
  quality_status: TaskQualityStatus;
  admin_validation_status: TaskAdminValidationStatus;
  validated_by: string | null;
  validated_at: string | null;
  reprise_reason: string | null;

  intervenant_id: string | null;

  quantite: number | null;
  unite: string | null;
  temps_prevu_h: number | null;

  // ? TEMPS V1 (optionnel)
  date_debut: string | null; // YYYY-MM-DD
  date_fin: string | null; // YYYY-MM-DD
  temps_reel_h: number | null;
  progress_admin_offset_percent: number | null;
  progress_admin_offset_updated_at: string | null;
  progress_admin_offset_updated_by: string | null;
  duration_days: number;
  order_index: number;

  created_at?: string | null;
  updated_at?: string | null;
};

type CreateTaskPayload = {
  chantier_id: string;
  titre: string;
  titre_terrain?: string | null;
  libelle_devis_original?: string | null;
  devis_ligne_id?: string | null;
  task_template_id?: string | null;
  task_template_label?: string | null;
  corps_etat?: string | null;
  lot?: string | null;
  zone_id?: string | null;
  etape_metier?: string | null;
  description_technique?: string | null;
  caracteristiques?: string[];
  priorite?: TaskPriority;
  prix_unitaire_devis_ht?: number | string | null;
  montant_total_devis_ht?: number | string | null;
  tva_taux_devis?: number | string | null;
  cout_estime_ht?: number | string | null;
  cout_matiere_estime_ht?: number | string | null;
  cout_mo_estime_ht?: number | string | null;
  date?: string | null;
  status?: TaskStatus;
  quality_status?: TaskQualityStatus;
  admin_validation_status?: TaskAdminValidationStatus;
  reprise_reason?: string | null;
  intervenant_id?: string | null;

  quantite?: number | string | null;
  unite?: string | null;
  temps_prevu_h?: number | string | null;

  // ? TEMPS V1 (optionnel)
  date_debut?: string | null;
  date_fin?: string | null;
  temps_reel_h?: number | null;
  duration_days?: number | null;
  order_index?: number | null;
};

export type TaskPlanningColumnsStatus = {
  planningColumnsMissing: boolean;
  expectedPlanningColumns: ["duration_days", "order_index"];
};

export type ChantierTasksFetchResult = TaskPlanningColumnsStatus & {
  tasks: ChantierTaskRow[];
};

type UpdateTaskPatch = Partial<
  Pick<
    ChantierTaskRow,
    | "titre"
    | "titre_terrain"
    | "libelle_devis_original"
    | "devis_ligne_id"
    | "task_template_id"
    | "task_template_label"
    | "corps_etat"
    | "lot"
    | "zone_id"
    | "etape_metier"
    | "description_technique"
    | "caracteristiques"
    | "priorite"
    | "prix_unitaire_devis_ht"
    | "montant_total_devis_ht"
    | "tva_taux_devis"
    | "cout_estime_ht"
    | "cout_matiere_estime_ht"
    | "cout_mo_estime_ht"
    | "date"
    | "status"
    | "quality_status"
    | "admin_validation_status"
    | "validated_by"
    | "validated_at"
    | "reprise_reason"
    | "intervenant_id"
    | "quantite"
    | "unite"
    | "temps_prevu_h"
    | "date_debut"
    | "date_fin"
    | "temps_reel_h"
    | "duration_days"
    | "order_index"
  >
>;

const TASK_SELECT = [
  "id",
  "chantier_id",
  "titre",
  "titre_terrain",
  "libelle_devis_original",
  "devis_ligne_id",
  "task_template_id",
  "task_template_label",
  "corps_etat",
  "lot",
  "zone_id",
  "etape_metier",
  "description_technique",
  "caracteristiques",
  "priorite",
  "prix_unitaire_devis_ht",
  "montant_total_devis_ht",
  "tva_taux_devis",
  "cout_estime_ht",
  "cout_matiere_estime_ht",
  "cout_mo_estime_ht",
  "date",
  "status",
  "quality_status",
  "admin_validation_status",
  "validated_by",
  "validated_at",
  "reprise_reason",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "temps_reel_h",
  "progress_admin_offset_percent",
  "progress_admin_offset_updated_at",
  "progress_admin_offset_updated_by",
  "duration_days",
  "order_index",
  "created_at",
  "updated_at",
].join(",");

const TASK_SELECT_V2 = [
  "id",
  "chantier_id",
  "titre",
  "titre_terrain",
  "libelle_devis_original",
  "devis_ligne_id",
  "corps_etat",
  "lot",
  "zone_id",
  "etape_metier",
  "date",
  "status",
  "quality_status",
  "admin_validation_status",
  "validated_by",
  "validated_at",
  "reprise_reason",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "temps_reel_h",
  "progress_admin_offset_percent",
  "progress_admin_offset_updated_at",
  "progress_admin_offset_updated_by",
  "duration_days",
  "order_index",
  "created_at",
  "updated_at",
].join(",");

const TASK_SELECT_LEGACY = [
  "id",
  "chantier_id",
  "titre",
  "corps_etat",
  "lot",
  "date",
  "status",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "temps_reel_h",
  "created_at",
  "updated_at",
].join(",");

let chantierTasksSupportsTerrainTitleColumns: boolean | null = null;
let chantierTasksSupportsV3Columns: boolean | null = null;

function normalizeQualityStatus(value: unknown): TaskQualityStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "en_cours") return "en_cours";
  if (raw === "termine_intervenant") return "termine_intervenant";
  if (raw === "valide_admin") return "valide_admin";
  if (raw === "a_reprendre") return "a_reprendre";
  return "a_faire";
}

function normalizeAdminValidationStatus(value: unknown): TaskAdminValidationStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "valide") return "valide";
  if (raw === "a_reprendre") return "a_reprendre";
  return "non_verifie";
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "basse") return "basse";
  if (raw === "haute") return "haute";
  if (raw === "urgente") return "urgente";
  return "normale";
}

function normalizeCaracteristiques(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function deriveQualityStatusFromTaskStatus(status: TaskStatus | undefined): TaskQualityStatus {
  if (status === "FAIT") return "termine_intervenant";
  if (status === "EN_COURS") return "en_cours";
  return "a_faire";
}

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const raw = value.trim().replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return null;
}

function cleanPatch(patch: UpdateTaskPatch) {
  const cleaned: any = { ...patch };

  // chaînes
  if (typeof cleaned.titre === "string") cleaned.titre = cleaned.titre.trim();
  if (typeof cleaned.titre_terrain === "string") cleaned.titre_terrain = cleaned.titre_terrain.trim();
  if (typeof cleaned.libelle_devis_original === "string") cleaned.libelle_devis_original = cleaned.libelle_devis_original.trim();
  if (typeof cleaned.task_template_id === "string") cleaned.task_template_id = cleaned.task_template_id.trim();
  if (typeof cleaned.task_template_label === "string") cleaned.task_template_label = cleaned.task_template_label.trim();
  if (typeof cleaned.corps_etat === "string") cleaned.corps_etat = cleaned.corps_etat.trim();
  if (typeof cleaned.lot === "string") cleaned.lot = cleaned.lot.trim();
  if (typeof cleaned.zone_id === "string") cleaned.zone_id = cleaned.zone_id.trim();
  if (typeof cleaned.etape_metier === "string") cleaned.etape_metier = cleaned.etape_metier.trim();
  if (typeof cleaned.description_technique === "string") cleaned.description_technique = cleaned.description_technique.trim();
  if (typeof cleaned.reprise_reason === "string") cleaned.reprise_reason = cleaned.reprise_reason.trim();
  if (typeof cleaned.unite === "string") cleaned.unite = cleaned.unite.trim();

  // vides -> null
  if (cleaned.corps_etat === "") cleaned.corps_etat = null;
  if (cleaned.lot === "") cleaned.lot = null;
  if (cleaned.titre_terrain === "") cleaned.titre_terrain = null;
  if (cleaned.libelle_devis_original === "") cleaned.libelle_devis_original = null;
  if (cleaned.task_template_id === "") cleaned.task_template_id = null;
  if (cleaned.task_template_label === "") cleaned.task_template_label = null;
  if (cleaned.date === "") cleaned.date = null;
  if (cleaned.zone_id === "") cleaned.zone_id = null;
  if (cleaned.etape_metier === "") cleaned.etape_metier = null;
  if (cleaned.description_technique === "") cleaned.description_technique = null;
  if (cleaned.reprise_reason === "") cleaned.reprise_reason = null;
  if (cleaned.date_debut === "") cleaned.date_debut = null;
  if (cleaned.date_fin === "") cleaned.date_fin = null;
  if (cleaned.intervenant_id === "") cleaned.intervenant_id = null;
  if (cleaned.unite === "") cleaned.unite = null;
  if (cleaned.lot !== undefined && cleaned.corps_etat === undefined) cleaned.corps_etat = cleaned.lot;
  if (cleaned.corps_etat !== undefined && cleaned.lot === undefined) cleaned.lot = cleaned.corps_etat;

  // temps réel
  if (cleaned.temps_reel_h !== undefined) {
    cleaned.temps_reel_h = normalizeNumber(cleaned.temps_reel_h);
  }
  if (cleaned.quantite !== undefined) {
    cleaned.quantite = normalizeNumber(cleaned.quantite);
  }
  if (cleaned.temps_prevu_h !== undefined) {
    cleaned.temps_prevu_h = normalizeNumber(cleaned.temps_prevu_h);
  }
  if (cleaned.prix_unitaire_devis_ht !== undefined) {
    cleaned.prix_unitaire_devis_ht = normalizeNumber(cleaned.prix_unitaire_devis_ht);
  }
  if (cleaned.montant_total_devis_ht !== undefined) {
    cleaned.montant_total_devis_ht = normalizeNumber(cleaned.montant_total_devis_ht);
  }
  if (cleaned.tva_taux_devis !== undefined) {
    cleaned.tva_taux_devis = normalizeNumber(cleaned.tva_taux_devis);
  }
  if (cleaned.cout_estime_ht !== undefined) {
    cleaned.cout_estime_ht = normalizeNumber(cleaned.cout_estime_ht);
  }
  if (cleaned.cout_matiere_estime_ht !== undefined) {
    cleaned.cout_matiere_estime_ht = normalizeNumber(cleaned.cout_matiere_estime_ht);
  }
  if (cleaned.cout_mo_estime_ht !== undefined) {
    cleaned.cout_mo_estime_ht = normalizeNumber(cleaned.cout_mo_estime_ht);
  }
  if (cleaned.duration_days !== undefined) {
    const duration = normalizeNumber(cleaned.duration_days);
    cleaned.duration_days = duration === null ? 1 : Math.max(1, Math.trunc(duration));
  }
  if (cleaned.order_index !== undefined) {
    const orderIndex = normalizeNumber(cleaned.order_index);
    cleaned.order_index = orderIndex === null ? 0 : Math.max(0, Math.trunc(orderIndex));
  }

  // aucune obligation demandée par toi,
  // mais on garde une petite sécurité: si titre fourni, il ne doit pas être vide
  if (cleaned.titre !== undefined && !cleaned.titre) {
    throw new Error("Le titre ne peut pas être vide.");
  }
  if (cleaned.titre !== undefined && cleaned.titre_terrain === undefined) {
    cleaned.titre_terrain = cleaned.titre;
  }
  if (cleaned.status !== undefined && cleaned.quality_status === undefined) {
    cleaned.quality_status = deriveQualityStatusFromTaskStatus(cleaned.status);
  }
  if (cleaned.quality_status !== undefined) {
    cleaned.quality_status = normalizeQualityStatus(cleaned.quality_status);
  }
  if (cleaned.admin_validation_status !== undefined) {
    cleaned.admin_validation_status = normalizeAdminValidationStatus(cleaned.admin_validation_status);
  }
  if (cleaned.priorite !== undefined) {
    cleaned.priorite = normalizeTaskPriority(cleaned.priorite);
  }
  if (cleaned.caracteristiques !== undefined) {
    cleaned.caracteristiques = normalizeCaracteristiques(cleaned.caracteristiques);
  }
  if (cleaned.task_template_label === undefined && cleaned.titre !== undefined) {
    cleaned.task_template_label = cleaned.titre;
  }

  return cleaned as UpdateTaskPatch;
}

function normalizeTaskRow(row: any): ChantierTaskRow {
  const offsetRaw = normalizeNumber(row?.progress_admin_offset_percent);

  return {
    ...row,
    titre_terrain:
      String(row?.titre_terrain ?? "").trim() || String(row?.titre ?? "").trim() || "Sans titre",
    libelle_devis_original: row?.libelle_devis_original ?? null,
    devis_ligne_id: row?.devis_ligne_id ?? null,
    task_template_id: row?.task_template_id ?? null,
    task_template_label:
      String(row?.task_template_label ?? "").trim() ||
      String(row?.titre ?? "").trim() ||
      String(row?.lot ?? "").trim() ||
      "Tâche chantier",
    progress_admin_offset_percent: offsetRaw === null ? 0 : Math.max(-100, Math.min(100, Number(offsetRaw))),
    progress_admin_offset_updated_at: row?.progress_admin_offset_updated_at ?? null,
    progress_admin_offset_updated_by: row?.progress_admin_offset_updated_by ?? null,
    zone_id: row?.zone_id ?? null,
    etape_metier: row?.etape_metier ?? null,
    description_technique: row?.description_technique ?? null,
    caracteristiques: normalizeCaracteristiques(row?.caracteristiques),
    priorite: normalizeTaskPriority(row?.priorite),
    prix_unitaire_devis_ht: normalizeNumber(row?.prix_unitaire_devis_ht),
    montant_total_devis_ht: normalizeNumber(row?.montant_total_devis_ht),
    tva_taux_devis: normalizeNumber(row?.tva_taux_devis),
    cout_estime_ht: normalizeNumber(row?.cout_estime_ht),
    cout_matiere_estime_ht: normalizeNumber(row?.cout_matiere_estime_ht),
    cout_mo_estime_ht: normalizeNumber(row?.cout_mo_estime_ht),
    quality_status: normalizeQualityStatus(row?.quality_status),
    admin_validation_status: normalizeAdminValidationStatus(row?.admin_validation_status),
    validated_by: row?.validated_by ?? null,
    validated_at: row?.validated_at ?? null,
    reprise_reason: row?.reprise_reason ?? null,
    duration_days: Math.max(1, Number(row?.duration_days ?? 1)),
    order_index: Math.max(0, Math.trunc(Number(row?.order_index ?? 0))),
  } as ChantierTaskRow;
}

function sortTaskRows(rows: ChantierTaskRow[]): ChantierTaskRow[] {
  return [...rows].sort((a, b) => {
    const orderDiff = Number(a.order_index ?? 0) - Number(b.order_index ?? 0);
    if (orderDiff !== 0) return orderDiff;

    const aCreated = Date.parse(String(a.created_at ?? "")) || 0;
    const bCreated = Date.parse(String(b.created_at ?? "")) || 0;
    if (aCreated !== bCreated) return aCreated - bCreated;

    return String(a.titre ?? "").localeCompare(String(b.titre ?? ""), "fr");
  });
}

function isMissingTaskPlanningColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  if (!msg) return false;
  return (
    msg.includes("column") &&
    msg.includes("chantier_tasks") &&
    (
      msg.includes("duration_days") ||
      msg.includes("order_index") ||
      msg.includes("progress_admin_offset_percent")
    )
  );
}

function isMissingTaskColumnError(error: { message?: string } | null, column: string): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes(column.toLowerCase()) &&
    (
      msg.includes("schema cache") ||
      (msg.includes("column") && msg.includes("does not exist")) ||
      msg.includes("could not find")
    ) &&
    msg.includes("chantier_tasks")
  );
}

function stripTerrainTitleColumns<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  delete (next as Record<string, unknown>).titre_terrain;
  delete (next as Record<string, unknown>).libelle_devis_original;
  return next;
}

function stripTaskV2Columns<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  delete (next as Record<string, unknown>).zone_id;
  delete (next as Record<string, unknown>).etape_metier;
  delete (next as Record<string, unknown>).quality_status;
  delete (next as Record<string, unknown>).admin_validation_status;
  delete (next as Record<string, unknown>).validated_by;
  delete (next as Record<string, unknown>).validated_at;
  delete (next as Record<string, unknown>).reprise_reason;
  delete (next as Record<string, unknown>).duration_days;
  delete (next as Record<string, unknown>).order_index;
  return next;
}

function stripTaskV3Columns<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  delete (next as Record<string, unknown>).task_template_id;
  delete (next as Record<string, unknown>).task_template_label;
  delete (next as Record<string, unknown>).description_technique;
  delete (next as Record<string, unknown>).caracteristiques;
  delete (next as Record<string, unknown>).priorite;
  delete (next as Record<string, unknown>).prix_unitaire_devis_ht;
  delete (next as Record<string, unknown>).montant_total_devis_ht;
  delete (next as Record<string, unknown>).tva_taux_devis;
  delete (next as Record<string, unknown>).cout_estime_ht;
  delete (next as Record<string, unknown>).cout_matiere_estime_ht;
  delete (next as Record<string, unknown>).cout_mo_estime_ht;
  return next;
}

function hasMissingTerrainTitleColumnsError(error: { message?: string } | null): boolean {
  return (
    isMissingTaskColumnError(error, "titre_terrain") ||
    isMissingTaskColumnError(error, "libelle_devis_original")
  );
}

function hasMissingTaskV3ColumnsError(error: { message?: string } | null): boolean {
  return (
    isMissingTaskColumnError(error, "task_template_id") ||
    isMissingTaskColumnError(error, "task_template_label") ||
    isMissingTaskColumnError(error, "description_technique") ||
    isMissingTaskColumnError(error, "caracteristiques") ||
    isMissingTaskColumnError(error, "priorite") ||
    isMissingTaskColumnError(error, "prix_unitaire_devis_ht") ||
    isMissingTaskColumnError(error, "montant_total_devis_ht") ||
    isMissingTaskColumnError(error, "tva_taux_devis") ||
    isMissingTaskColumnError(error, "cout_estime_ht") ||
    isMissingTaskColumnError(error, "cout_matiere_estime_ht") ||
    isMissingTaskColumnError(error, "cout_mo_estime_ht")
  );
}

/* =========================================================
   QUERIES
   ========================================================= */

export async function getTasksByChantierIdDetailed(chantierId: string): Promise<ChantierTasksFetchResult> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const first = await supabase
    .from("chantier_tasks")
    .select(chantierTasksSupportsV3Columns === false ? TASK_SELECT_V2 : TASK_SELECT)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (!first.error) {
    if (chantierTasksSupportsV3Columns !== false) {
      chantierTasksSupportsV3Columns = true;
    }
    return {
      tasks: sortTaskRows((first.data ?? []).map(normalizeTaskRow)),
      planningColumnsMissing: false,
      expectedPlanningColumns: ["duration_days", "order_index"],
    };
  }

  if (chantierTasksSupportsV3Columns !== false && hasMissingTaskV3ColumnsError(first.error)) {
    chantierTasksSupportsV3Columns = false;
    const fallbackV2 = await supabase
      .from("chantier_tasks")
      .select(TASK_SELECT_V2)
      .eq("chantier_id", chantierId)
      .order("created_at", { ascending: false });

    if (!fallbackV2.error) {
      return {
        tasks: sortTaskRows((fallbackV2.data ?? []).map(normalizeTaskRow)),
        planningColumnsMissing: false,
        expectedPlanningColumns: ["duration_days", "order_index"],
      };
    }

    if (!isMissingTaskPlanningColumnsError(fallbackV2.error)) throw fallbackV2.error;
  } else if (!isMissingTaskPlanningColumnsError(first.error)) {
    throw first.error;
  }

  const fallback = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_LEGACY)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });
  if (fallback.error) throw fallback.error;
  return {
    tasks: sortTaskRows((fallback.data ?? []).map(normalizeTaskRow)),
    planningColumnsMissing: true,
    expectedPlanningColumns: ["duration_days", "order_index"],
  };
}

export async function getTasksByChantierId(chantierId: string): Promise<ChantierTaskRow[]> {
  const result = await getTasksByChantierIdDetailed(chantierId);
  return result.tasks;
}

export async function createTask(payload: CreateTaskPayload) {
  const chantier_id = payload?.chantier_id;
  const titre = (payload?.titre ?? "").trim();

  if (!chantier_id) throw new Error("chantier_id manquant.");
  if (!titre) throw new Error("titre manquant.");

  const quantiteValue = normalizeNumber(payload.quantite);
  const tempsPrevuValue = normalizeNumber(payload.temps_prevu_h);

  const insertRow: any = {
    chantier_id,
    titre,
    titre_terrain: (payload?.titre_terrain ?? payload?.titre ?? "").trim() || titre,
    libelle_devis_original: (payload?.libelle_devis_original ?? "").trim() || null,
    devis_ligne_id: payload?.devis_ligne_id ?? null,
    task_template_id: payload?.task_template_id ?? null,
    task_template_label:
      (payload?.task_template_label ?? payload?.titre ?? "").trim() || titre,
    corps_etat: payload.corps_etat ?? payload.lot ?? null,
    lot: payload.lot ?? payload.corps_etat ?? null,
    zone_id: payload.zone_id ?? null,
    etape_metier: (payload.etape_metier ?? "").trim() || null,
    description_technique: (payload.description_technique ?? "").trim() || null,
    caracteristiques: normalizeCaracteristiques(payload.caracteristiques),
    priorite: normalizeTaskPriority(payload.priorite),
    prix_unitaire_devis_ht: normalizeNumber(payload.prix_unitaire_devis_ht),
    montant_total_devis_ht: normalizeNumber(payload.montant_total_devis_ht),
    tva_taux_devis: normalizeNumber(payload.tva_taux_devis),
    cout_estime_ht: normalizeNumber(payload.cout_estime_ht),
    cout_matiere_estime_ht: normalizeNumber(payload.cout_matiere_estime_ht),
    cout_mo_estime_ht: normalizeNumber(payload.cout_mo_estime_ht),
    date: payload.date ?? null,
    status: payload.status ?? "A_FAIRE",
    quality_status: payload.quality_status ?? deriveQualityStatusFromTaskStatus(payload.status ?? "A_FAIRE"),
    admin_validation_status: payload.admin_validation_status ?? "non_verifie",
    validated_by: null,
    validated_at: null,
    reprise_reason: (payload.reprise_reason ?? "").trim() || null,
    intervenant_id: payload.intervenant_id ?? null,
    quantite: quantiteValue === null ? 1 : quantiteValue,
    unite: (payload.unite ?? "").trim() || null,
    temps_prevu_h: tempsPrevuValue ?? null,

    // ? temps (optionnel)
    date_debut: payload.date_debut ?? null,
    date_fin: payload.date_fin ?? null,
    temps_reel_h: payload.temps_reel_h ?? null,
    duration_days: Math.max(1, Math.trunc(normalizeNumber(payload.duration_days) ?? 1)),
    order_index: Math.max(0, Math.trunc(normalizeNumber(payload.order_index) ?? 0)),
  };

  const insertWithSchemaColumns =
    chantierTasksSupportsV3Columns === false ? stripTaskV3Columns(insertRow) : insertRow;
  const insertWithTerrainColumns =
    chantierTasksSupportsTerrainTitleColumns !== false
      ? insertWithSchemaColumns
      : stripTerrainTitleColumns(insertWithSchemaColumns);

  const first = await supabase
    .from("chantier_tasks")
    .insert([insertWithTerrainColumns])
    .select(chantierTasksSupportsV3Columns === false ? TASK_SELECT_V2 : TASK_SELECT)
    .single();

  if (!first.error) {
    if (chantierTasksSupportsTerrainTitleColumns !== false) {
      chantierTasksSupportsTerrainTitleColumns = true;
    }
    if (chantierTasksSupportsV3Columns !== false) {
      chantierTasksSupportsV3Columns = true;
    }
    return normalizeTaskRow(first.data);
  }

  let baseInsert = insertWithTerrainColumns;
  let baseError = first.error;

  if (chantierTasksSupportsV3Columns !== false && hasMissingTaskV3ColumnsError(first.error)) {
    chantierTasksSupportsV3Columns = false;
    baseInsert = stripTaskV3Columns(insertWithTerrainColumns);
    const retryWithoutV3Columns = await supabase
      .from("chantier_tasks")
      .insert([baseInsert])
      .select(TASK_SELECT_V2)
      .single();

    if (!retryWithoutV3Columns.error) {
      if (chantierTasksSupportsTerrainTitleColumns !== false) {
        chantierTasksSupportsTerrainTitleColumns = true;
      }
      return normalizeTaskRow(retryWithoutV3Columns.data);
    }
    baseError = retryWithoutV3Columns.error;
  }

  if (chantierTasksSupportsTerrainTitleColumns !== false && hasMissingTerrainTitleColumnsError(baseError)) {
    chantierTasksSupportsTerrainTitleColumns = false;
    baseInsert = stripTerrainTitleColumns(
      chantierTasksSupportsV3Columns === false ? stripTaskV3Columns(insertRow) : insertRow,
    );
    const retryWithoutTerrainColumns = await supabase
      .from("chantier_tasks")
      .insert([baseInsert])
      .select(chantierTasksSupportsV3Columns === false ? TASK_SELECT_V2 : TASK_SELECT)
      .single();

    if (!retryWithoutTerrainColumns.error) {
      return normalizeTaskRow(retryWithoutTerrainColumns.data);
    }
    baseError = retryWithoutTerrainColumns.error;
  }

  if (!isMissingTaskPlanningColumnsError(baseError)) throw baseError;

  const legacyInsert = stripTaskV2Columns({ ...baseInsert });
  delete (legacyInsert as Record<string, unknown>).devis_ligne_id;

  const fallback = await supabase
    .from("chantier_tasks")
    .insert([legacyInsert])
    .select(TASK_SELECT_LEGACY)
    .single();

  if (fallback.error) throw fallback.error;
  return normalizeTaskRow(fallback.data);
}

export async function updateTask(id: string, patch: UpdateTaskPatch) {
  if (!id) throw new Error("id tâche manquant.");

  const cleaned = cleanPatch(patch);
  const updateWithSchemaColumns =
    chantierTasksSupportsV3Columns === false ? stripTaskV3Columns(cleaned) : cleaned;
  const updateWithTerrainColumns =
    chantierTasksSupportsTerrainTitleColumns !== false
      ? updateWithSchemaColumns
      : stripTerrainTitleColumns(updateWithSchemaColumns);

  const first = await supabase
    .from("chantier_tasks")
    .update(updateWithTerrainColumns as any)
    .eq("id", id)
    .select(chantierTasksSupportsV3Columns === false ? TASK_SELECT_V2 : TASK_SELECT)
    .single();

  if (!first.error) {
    if (chantierTasksSupportsTerrainTitleColumns !== false) {
      chantierTasksSupportsTerrainTitleColumns = true;
    }
    if (chantierTasksSupportsV3Columns !== false) {
      chantierTasksSupportsV3Columns = true;
    }
    return normalizeTaskRow(first.data);
  }

  let basePatch: Record<string, unknown> = { ...updateWithTerrainColumns };
  let baseError = first.error;

  if (chantierTasksSupportsV3Columns !== false && hasMissingTaskV3ColumnsError(first.error)) {
    chantierTasksSupportsV3Columns = false;
    basePatch = stripTaskV3Columns(updateWithTerrainColumns);
    const retryWithoutV3Columns = await supabase
      .from("chantier_tasks")
      .update(basePatch as any)
      .eq("id", id)
      .select(TASK_SELECT_V2)
      .single();

    if (!retryWithoutV3Columns.error) {
      if (chantierTasksSupportsTerrainTitleColumns !== false) {
        chantierTasksSupportsTerrainTitleColumns = true;
      }
      return normalizeTaskRow(retryWithoutV3Columns.data);
    }
    baseError = retryWithoutV3Columns.error;
  }

  if (chantierTasksSupportsTerrainTitleColumns !== false && hasMissingTerrainTitleColumnsError(baseError)) {
    chantierTasksSupportsTerrainTitleColumns = false;
    basePatch = stripTerrainTitleColumns(
      chantierTasksSupportsV3Columns === false ? stripTaskV3Columns(cleaned) : cleaned,
    );
    const retryWithoutTerrainColumns = await supabase
      .from("chantier_tasks")
      .update(basePatch as any)
      .eq("id", id)
      .select(chantierTasksSupportsV3Columns === false ? TASK_SELECT_V2 : TASK_SELECT)
      .single();

    if (!retryWithoutTerrainColumns.error) {
      return normalizeTaskRow(retryWithoutTerrainColumns.data);
    }
    baseError = retryWithoutTerrainColumns.error;
  }

  if (!isMissingTaskPlanningColumnsError(baseError)) throw baseError;

  const legacyPatch: Record<string, unknown> = stripTaskV2Columns({ ...basePatch });

  const fallback = await supabase
    .from("chantier_tasks")
    .update(legacyPatch as any)
    .eq("id", id)
    .select(TASK_SELECT_LEGACY)
    .single();

  if (fallback.error) throw fallback.error;
  return normalizeTaskRow(fallback.data);
}

export async function deleteTasksByIds(taskIds: string[]): Promise<void> {
  const ids = (taskIds ?? []).filter(Boolean);
  if (!ids.length) return;

  const { error } = await supabase.from("chantier_tasks").delete().in("id", ids);
  if (error) throw error;
}

export async function adminSetTaskProgressOffset(taskId: string, offset: number | null): Promise<void> {
  if (!taskId) throw new Error("id tâche manquant.");

  const parsedOffset =
    offset === null || offset === undefined ? null : Math.max(-100, Math.min(100, Number(offset)));
  if (parsedOffset !== null && !Number.isFinite(parsedOffset)) {
    throw new Error("Ajustement invalide.");
  }

  const { error } = await (supabase as any).rpc("admin_set_task_progress_offset", {
    p_task_id: taskId,
    p_offset: parsedOffset,
  });

  if (error) throw error;
}



