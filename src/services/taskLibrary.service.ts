import { supabase } from "../lib/supabaseClient";
import {
  duplicateTaskTemplatePreparation,
  type TaskTemplateEquipmentItemInput,
  type TaskTemplateFeeItemInput,
  type TaskTemplateLaborItemInput,
  type TaskTemplateMaterialRatioInput,
} from "./taskTemplatePreparation.service";

export type TaskTemplateRow = {
  id: string;
  titre: string;
  lot: string | null;
  unite: string | null;
  quantite_defaut: number | null;
  temps_prevu_par_unite_h: number | null;
  remarques: string | null;
  description_technique: string | null;
  caracteristiques: string[];
  cout_reference_unitaire_ht: number | null;
  /** Coût horaire retenu pour cette tâche ; null = coût horaire moyen des salariés. */
  labor_hourly_cost_ht: number | null;
  /** Marge appliquée au déboursé de cette tâche ; null = marge par défaut du chiffrage. */
  target_margin_rate: number | null;
  quote_visible: boolean;
  chantier_visible: boolean;
  labor_items: TaskTemplateLaborItemInput[];
  fee_items: TaskTemplateFeeItemInput[];
  /** Listes et mode opératoire préparés par Coco, conservés tels quels pour l'ouvrier. */
  coco_preparation: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type TaskTemplateInput = {
  titre: string;
  lot?: string | null;
  unite?: string | null;
  quantite_defaut?: number | null;
  temps_prevu_par_unite_h?: number | null;
  remarques?: string | null;
  description_technique?: string | null;
  caracteristiques?: string[];
  cout_reference_unitaire_ht?: number | null;
  labor_hourly_cost_ht?: number | null;
  target_margin_rate?: number | null;
  quote_visible?: boolean;
  chantier_visible?: boolean;
  labor_items?: TaskTemplateLaborItemInput[];
  fee_items?: TaskTemplateFeeItemInput[];
  coco_preparation?: Record<string, unknown> | null;
  preparation_materials?: TaskTemplateMaterialRatioInput[];
  preparation_equipment?: TaskTemplateEquipmentItemInput[];
};

function normalizeForMatch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForMatch(value: unknown): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function findBestTaskTemplateMatch(
  input: {
    task_template_label?: string | null;
    title?: string | null;
    source_line?: string | null;
    lot?: string | null;
  },
  templates: TaskTemplateRow[],
): TaskTemplateRow | null {
  if (!templates.length) return null;

  const normalizedLabel = normalizeForMatch(input.task_template_label);
  const normalizedTitle = normalizeForMatch(input.title);
  const normalizedSource = normalizeForMatch(input.source_line);
  const normalizedLot = normalizeForMatch(input.lot);

  const titleTokens = new Set([
    ...tokenizeForMatch(input.task_template_label),
    ...tokenizeForMatch(input.title),
    ...tokenizeForMatch(input.source_line),
  ]);

  let best: { row: TaskTemplateRow; score: number } | null = null;

  for (const row of templates) {
    const rowTitle = normalizeForMatch(row.titre);
    const rowLot = normalizeForMatch(row.lot);
    const rowTokens = tokenizeForMatch(row.titre);

    let score = 0;
    if (normalizedLabel && rowTitle === normalizedLabel) score += 200;
    else if (normalizedTitle && rowTitle === normalizedTitle) score += 180;
    else if (normalizedSource && rowTitle && normalizedSource.includes(rowTitle)) score += 120;

    const overlap = rowTokens.filter((token) => titleTokens.has(token)).length;
    score += overlap * 18;

    if (normalizedLot && rowLot && normalizedLot === rowLot) score += 24;
    if (normalizedLot && rowLot && normalizedLot !== rowLot) score -= 12;

    if (!best || score > best.score) {
      best = { row, score };
    }
  }

  return best && best.score >= 36 ? best.row : null;
}

const SELECT_V2 = [
  "id",
  "titre",
  "lot",
  "unite",
  "quantite_defaut",
  "temps_prevu_par_unite_h",
  "remarques",
  "description_technique",
  "caracteristiques",
  "cout_reference_unitaire_ht",
  "labor_hourly_cost_ht",
  "target_margin_rate",
  "quote_visible",
  "chantier_visible",
  "labor_items",
  "fee_items",
  "coco_preparation",
  "created_at",
  "updated_at",
].join(", ");

const SELECT_LEGACY = [
  "id",
  "titre",
  "lot",
  "unite",
  "quantite_defaut",
  "temps_prevu_par_unite_h",
  "remarques",
  "created_at",
  "updated_at",
].join(", ");

let supportsV2Columns: boolean | null = null;

// Le test doit rester sur l'absence réelle de la table : sans la condition
// "does not exist", une simple violation de contrainte (message du type
// 'null value in column "lot" of relation "task_templates"') était rapportée à
// l'utilisateur comme une table manquante, avec un conseil d'appliquer les migrations.
function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  if (!msg.includes("task_templates")) return false;
  return msg.includes("does not exist") || msg.includes("schema cache");
}

/**
 * PostgREST garde en memoire la liste des colonnes. Juste apres une migration,
 * une colonne qui existe vraiment peut etre refusee : "could not find the
 * column ... in the schema cache". Ce n'est pas une base d'ancienne generation,
 * c'est un cache perime, et il se recharge tout seul en quelques secondes.
 *
 * Confondre les deux coutait cher : l'ecriture etait rejouee sans les colonnes
 * concernees, elle reussissait, et la valeur saisie disparaissait sans le
 * moindre message. Toute la session basculait ensuite en lecture ancienne.
 */
function isSchemaCacheError(error: { code?: string; message?: string } | null): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  return code === "PGRST204" || msg.includes("schema cache");
}

type SupabaseResult<T> = { data: T; error: { code?: string; message?: string } | null };

/** Rejoue une fois la meme requete, inchangee, le temps que le cache se recharge. */
async function withSchemaCacheRetry<T>(run: () => PromiseLike<SupabaseResult<T>>): Promise<SupabaseResult<T>> {
  const first = await run();
  if (!first.error || !isSchemaCacheError(first.error)) return first;
  await new Promise((resolve) => setTimeout(resolve, 900));
  return run();
}

function isMissingV2ColumnsError(error: { code?: string; message?: string } | null): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  if (isSchemaCacheError(error)) return false;
  if (code === "42703") return true;
  return (
    msg.includes("task_templates") &&
    (msg.includes("description_technique") ||
      msg.includes("caracteristiques") ||
      msg.includes("cout_reference_unitaire_ht") ||
      msg.includes("labor_hourly_cost_ht") ||
      msg.includes("target_margin_rate") ||
      msg.includes("quote_visible") ||
      msg.includes("chantier_visible") ||
      msg.includes("labor_items") ||
      msg.includes("fee_items") ||
      msg.includes("coco_preparation"))
  );
}

function normalizeCaracteristiques(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
}

function normalizeLaborItems(raw: unknown): TaskTemplateLaborItemInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: String(item?.id ?? crypto.randomUUID()),
    resourceType: item?.resourceType === "employee_role" || item?.resourceType === "subcontractor" ? item.resourceType : "manual",
    employeeId: item?.employeeId ?? null,
    intervenantId: item?.intervenantId ?? null,
    duration: normalizeNumber(item?.duration),
    unit: String(item?.unit ?? "h").trim() || "h",
    hourlyCost: normalizeNumber(item?.hourlyCost),
    hourlySalePrice: normalizeNumber(item?.hourlySalePrice),
    note: String(item?.note ?? "").trim() || null,
  }));
}

function normalizeFeeItems(raw: unknown): TaskTemplateFeeItemInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: String(item?.id ?? crypto.randomUUID()),
    type:
      item?.type === "equipment_rental" || item?.type === "consumables" || item?.type === "fixed_fee"
        ? item.type
        : "other",
    designation: String(item?.designation ?? "").trim(),
    amountCostHt: normalizeNumber(item?.amountCostHt),
    amountSaleHt: normalizeNumber(item?.amountSaleHt),
    note: String(item?.note ?? "").trim() || null,
  })).filter((item) => item.designation);
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row: any): TaskTemplateRow {
  return {
    id: String(row?.id ?? ""),
    titre: String(row?.titre ?? "").trim(),
    lot: row?.lot ?? null,
    unite: row?.unite ?? null,
    quantite_defaut: normalizeNumber(row?.quantite_defaut),
    temps_prevu_par_unite_h: normalizeNumber(row?.temps_prevu_par_unite_h),
    remarques: row?.remarques ?? null,
    description_technique: row?.description_technique ?? null,
    caracteristiques: normalizeCaracteristiques(row?.caracteristiques),
    cout_reference_unitaire_ht: normalizeNumber(row?.cout_reference_unitaire_ht),
    labor_hourly_cost_ht: normalizeNumber(row?.labor_hourly_cost_ht),
    target_margin_rate: normalizeNumber(row?.target_margin_rate),
    quote_visible: row?.quote_visible !== false,
    chantier_visible: row?.chantier_visible !== false,
    labor_items: normalizeLaborItems(row?.labor_items),
    fee_items: normalizeFeeItems(row?.fee_items),
    coco_preparation:
      row?.coco_preparation && typeof row.coco_preparation === "object"
        ? (row.coco_preparation as Record<string, unknown>)
        : null,
    created_at: String(row?.created_at ?? ""),
    updated_at: String(row?.updated_at ?? ""),
  };
}

function normalizeInput(input: TaskTemplateInput) {
  const titre = String(input.titre ?? "").trim();
  if (!titre) throw new Error("Le titre est obligatoire.");

  const quantiteDefaut = normalizeNumber(input.quantite_defaut);
  const tempsPrevuParUnite = normalizeNumber(input.temps_prevu_par_unite_h);
  const coutReference = normalizeNumber(input.cout_reference_unitaire_ht);

  if (input.quantite_defaut !== null && input.quantite_defaut !== undefined && quantiteDefaut === null) {
    throw new Error("Quantité défaut invalide.");
  }
  if (
    input.temps_prevu_par_unite_h !== null &&
    input.temps_prevu_par_unite_h !== undefined &&
    tempsPrevuParUnite === null
  ) {
    throw new Error("Temps par unité invalide.");
  }
  if (
    input.cout_reference_unitaire_ht !== null &&
    input.cout_reference_unitaire_ht !== undefined &&
    coutReference === null
  ) {
    throw new Error("Coût de référence invalide.");
  }

  return {
    titre,
    lot: String(input.lot ?? "").trim() || null,
    unite: String(input.unite ?? "").trim() || null,
    quantite_defaut: quantiteDefaut,
    temps_prevu_par_unite_h: tempsPrevuParUnite,
    remarques: String(input.remarques ?? "").trim() || null,
    description_technique: String(input.description_technique ?? "").trim() || null,
    caracteristiques: normalizeCaracteristiques(input.caracteristiques),
    cout_reference_unitaire_ht: coutReference,
    labor_hourly_cost_ht: normalizeNumber(input.labor_hourly_cost_ht),
    target_margin_rate: normalizeNumber(input.target_margin_rate),
    quote_visible: input.quote_visible,
    chantier_visible: input.chantier_visible,
    labor_items: normalizeLaborItems(input.labor_items),
    fee_items: normalizeFeeItems(input.fee_items),
    coco_preparation: input.coco_preparation ?? null,
  };
}

/**
 * Une ecriture qui "reussit" en ayant perdu des champs en route est pire
 * qu'une erreur : l'utilisateur croit avoir enregistre, referme, et retrouve
 * un champ vide sans avoir jamais vu de message. On compare donc ce qui a ete
 * envoye a ce que la base renvoie, et on le dit.
 */
function assertWritePersisted(payload: ReturnType<typeof normalizeInput>, row: TaskTemplateRow): void {
  const checks: Array<[string, number | null, number | null]> = [
    ["coût horaire", payload.labor_hourly_cost_ht, row.labor_hourly_cost_ht],
    ["marge", payload.target_margin_rate, row.target_margin_rate],
    ["coût de référence", payload.cout_reference_unitaire_ht, row.cout_reference_unitaire_ht],
    ["temps par unité", payload.temps_prevu_par_unite_h, row.temps_prevu_par_unite_h],
  ];
  const dropped = checks
    .filter(([, sent, saved]) => sent !== null && Number(saved ?? NaN) !== Number(sent))
    .map(([label]) => label);
  if (!dropped.length) return;
  throw new Error(
    `La base n'a pas conservé : ${dropped.join(", ")}. Le reste de la tâche est enregistré. Rechargez la page et réessayez ; si cela se reproduit, prévenez l'administrateur.`,
  );
}

function stripV2Columns<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  delete (next as Record<string, unknown>).description_technique;
  delete (next as Record<string, unknown>).caracteristiques;
  delete (next as Record<string, unknown>).cout_reference_unitaire_ht;
  delete (next as Record<string, unknown>).labor_hourly_cost_ht;
  delete (next as Record<string, unknown>).target_margin_rate;
  delete (next as Record<string, unknown>).quote_visible;
  delete (next as Record<string, unknown>).chantier_visible;
  delete (next as Record<string, unknown>).labor_items;
  delete (next as Record<string, unknown>).fee_items;
  delete (next as Record<string, unknown>).coco_preparation;
  return next;
}

async function fetchSingle(id: string): Promise<TaskTemplateRow> {
  const { data, error } = await supabase
    .from("task_templates")
    .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
    .eq("id", id)
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const fallback = await supabase
        .from("task_templates")
        .select(SELECT_LEGACY)
        .eq("id", id)
        .single();
      if (fallback.error) throw new Error(fallback.error.message);
      return normalizeRow(fallback.data);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  return normalizeRow(data);
}

export async function list(): Promise<TaskTemplateRow[]> {
  const { data, error } = await supabase
    .from("task_templates")
    .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const fallback = await supabase
        .from("task_templates")
        .select(SELECT_LEGACY)
        .order("updated_at", { ascending: false });
      if (fallback.error) {
        if (isMissingTableError(fallback.error)) return [];
        throw new Error(fallback.error.message);
      }
      return (fallback.data ?? []).map(normalizeRow);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  return (data ?? []).map(normalizeRow);
}

export async function create(input: TaskTemplateInput): Promise<TaskTemplateRow> {
  const payload = normalizeInput(input);
  const { data, error } = await withSchemaCacheRetry(() =>
    supabase
      .from("task_templates")
      .insert(supportsV2Columns === false ? stripV2Columns(payload) : payload)
      .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
      .single(),
  );

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const retry = await supabase
        .from("task_templates")
        .insert(stripV2Columns(payload))
        .select(SELECT_LEGACY)
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return normalizeRow(retry.data);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  const saved = normalizeRow(data);
  if (supportsV2Columns !== false) assertWritePersisted(payload, saved);
  return saved;
}

export async function update(id: string, input: TaskTemplateInput): Promise<TaskTemplateRow> {
  if (!id) throw new Error("id template manquant.");
  const payload = normalizeInput(input);
  const { data, error } = await withSchemaCacheRetry(() =>
    supabase
      .from("task_templates")
      .update(supportsV2Columns === false ? stripV2Columns(payload) : payload)
      .eq("id", id)
      .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
      .single(),
  );

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const retry = await supabase
        .from("task_templates")
        .update(stripV2Columns(payload))
        .eq("id", id)
        .select(SELECT_LEGACY)
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return normalizeRow(retry.data);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  const saved = normalizeRow(data);
  if (supportsV2Columns !== false) assertWritePersisted(payload, saved);
  return saved;
}

export async function remove(id: string): Promise<void> {
  if (!id) throw new Error("id template manquant.");
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    throw new Error(error.message);
  }
}

export async function duplicate(id: string): Promise<TaskTemplateRow> {
  const source = await fetchSingle(id);
  const duplicated = await create({
    titre: `${source.titre} (copie)`,
    lot: source.lot,
    unite: source.unite,
    quantite_defaut: source.quantite_defaut,
    temps_prevu_par_unite_h: source.temps_prevu_par_unite_h,
    remarques: source.remarques,
    description_technique: source.description_technique,
    caracteristiques: source.caracteristiques,
    cout_reference_unitaire_ht: source.cout_reference_unitaire_ht,
    labor_hourly_cost_ht: source.labor_hourly_cost_ht,
    target_margin_rate: source.target_margin_rate,
    quote_visible: source.quote_visible,
    chantier_visible: source.chantier_visible,
    labor_items: source.labor_items,
    fee_items: source.fee_items,
    coco_preparation: source.coco_preparation,
  });

  await duplicateTaskTemplatePreparation(source.id, duplicated.id);

  return duplicated;
}
