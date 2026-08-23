import { supabase } from "../lib/supabaseClient";

const TABLE = "task_template_lot_profiles";
const CACHE_KEY = "batipro.task-template-lot-profiles.cache.v1";

export type TaskTemplateLotProfile = {
  id: string;
  name: string;
  keywords: string[];
  laborMarginRate: number;
  equipmentMarginRate: number;
  materialsMarginRate: number;
  feesMarginRate: number;
  defaultUnit: string | null;
  averageTimeHours: number | null;
  qualityControls: string[];
  commonMistakes: string[];
  chantierInstructions: string[];
  defaultEquipment: string[];
  defaultPpe: string[];
  defaultConsumables: string[];
  doeDocuments: string[];
  fieldReturns: string[];
  /**
   * Usage metier par defaut du lot (repris du systeme localStorage de main :
   * `TaskTemplateLotProfile.defaultUsage`).
   */
  defaultQuoteVisible: boolean;
  defaultChantierVisible: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskTemplateLotProfileInput = Omit<TaskTemplateLotProfile, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

type LotProfileRow = {
  id: string;
  name: string;
  keywords: string[] | null;
  labor_margin_rate: number | null;
  equipment_margin_rate: number | null;
  materials_margin_rate: number | null;
  fees_margin_rate: number | null;
  default_unit: string | null;
  average_time_hours: number | null;
  quality_controls: string[] | null;
  common_mistakes: string[] | null;
  chantier_instructions: string[] | null;
  default_equipment: string[] | null;
  default_ppe: string[] | null;
  default_consumables: string[] | null;
  doe_documents: string[] | null;
  field_returns: string[] | null;
  default_quote_visible?: boolean | null;
  default_chantier_visible?: boolean | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

/**
 * `*` volontairement, et non une liste explicite de colonnes.
 * `default_quote_visible` et `default_chantier_visible` sont ajoutees par la
 * migration 20260823170000 : tant qu'elle n'est pas appliquee, les demander
 * nommement ferait echouer la requete (42703) et basculerait toute la liste sur
 * les profils par defaut. Avec `*`, elles sont simplement absentes de la ligne
 * et `fromRow` retombe sur `true`.
 */
const SELECT = "*";

export const DEFAULT_LOT_PROFILES: TaskTemplateLotProfile[] = [
  defaultProfile("Peinture", ["peinture", "impression", "finition", "facade"], 30, "m2", 0.18, 30),
  defaultProfile("Plâtrerie", ["placo", "cloison", "doublage", "ba13"], 28, "m2", 0.45, 20),
  defaultProfile("Electricité", ["prise", "tableau", "cable", "gaine"], 30, "u", 0.75, 10),
  defaultProfile("Façade", ["facade", "ravalement", "enduit"], 30, "m2", 0.35, 40),
  defaultProfile("ITE", ["ite", "isolant", "trame", "cheville"], 28, "m2", 0.85, 50),
  defaultProfile("Plomberie", ["plomberie", "sanitaire", "evacuation"], 30, "u", 1, 60),
  defaultProfile("Couverture", ["toiture", "tuile", "zinguerie"], 28, "m2", 0.6, 70),
  defaultProfile("Menuiserie", ["porte", "fenetre", "pose"], 28, "u", 1.5, 80),
  defaultProfile("Carrelage", ["carrelage", "faience", "joint"], 30, "m2", 0.65, 90),
  defaultProfile("Sol", ["sol", "parquet", "pvc", "ragréage"], 30, "m2", 0.45, 100),
  defaultProfile("VRD", ["vrd", "tranchee", "reseau"], 25, "ml", 0.55, 110),
  defaultProfile("Maçonnerie", ["maconnerie", "beton", "parpaing"], 28, "m2", 0.75, 120),
];

function defaultProfile(
  name: string,
  keywords: string[],
  materialsMarginRate: number,
  defaultUnit: string,
  averageTimeHours: number,
  sortOrder: number,
): TaskTemplateLotProfile {
  return {
    id: `default-${sortOrder}`,
    name,
    keywords,
    laborMarginRate: 35,
    equipmentMarginRate: 25,
    materialsMarginRate,
    feesMarginRate: 20,
    defaultUnit,
    averageTimeHours,
    qualityControls: [],
    commonMistakes: [],
    chantierInstructions: [],
    defaultEquipment: [],
    defaultPpe: [],
    defaultConsumables: [],
    doeDocuments: [],
    fieldReturns: [],
    defaultQuoteVisible: true,
    defaultChantierVisible: true,
    sortOrder,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  };
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function fromRow(row: LotProfileRow): TaskTemplateLotProfile {
  return {
    id: row.id,
    name: String(row.name ?? "").trim(),
    keywords: strings(row.keywords),
    laborMarginRate: number(row.labor_margin_rate, 30),
    equipmentMarginRate: number(row.equipment_margin_rate, 25),
    materialsMarginRate: number(row.materials_margin_rate, 30),
    feesMarginRate: number(row.fees_margin_rate, 20),
    defaultUnit: String(row.default_unit ?? "").trim() || null,
    averageTimeHours: nullableNumber(row.average_time_hours),
    qualityControls: strings(row.quality_controls),
    commonMistakes: strings(row.common_mistakes),
    chantierInstructions: strings(row.chantier_instructions),
    defaultEquipment: strings(row.default_equipment),
    defaultPpe: strings(row.default_ppe),
    defaultConsumables: strings(row.default_consumables),
    doeDocuments: strings(row.doe_documents),
    fieldReturns: strings(row.field_returns),
    defaultQuoteVisible: row.default_quote_visible !== false,
    defaultChantierVisible: row.default_chantier_visible !== false,
    sortOrder: Math.trunc(number(row.sort_order, 0)),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: TaskTemplateLotProfileInput) {
  return {
    id: input.id?.startsWith("default-") ? undefined : input.id,
    name: input.name.trim(),
    keywords: strings(input.keywords),
    labor_margin_rate: Math.max(0, input.laborMarginRate),
    equipment_margin_rate: Math.max(0, input.equipmentMarginRate),
    materials_margin_rate: Math.max(0, input.materialsMarginRate),
    fees_margin_rate: Math.max(0, input.feesMarginRate),
    default_unit: input.defaultUnit?.trim() || null,
    average_time_hours: input.averageTimeHours === null ? null : Math.max(0, input.averageTimeHours),
    quality_controls: strings(input.qualityControls),
    common_mistakes: strings(input.commonMistakes),
    chantier_instructions: strings(input.chantierInstructions),
    default_equipment: strings(input.defaultEquipment),
    default_ppe: strings(input.defaultPpe),
    default_consumables: strings(input.defaultConsumables),
    doe_documents: strings(input.doeDocuments),
    field_returns: strings(input.fieldReturns),
    default_quote_visible: input.defaultQuoteVisible !== false,
    default_chantier_visible: input.defaultChantierVisible !== false,
    sort_order: Math.trunc(input.sortOrder ?? 0),
    is_active: input.isActive !== false,
  };
}

function cacheProfiles(profiles: TaskTemplateLotProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(profiles));
  } catch {
    // Offline cache is opportunistic.
  }
}

function readCachedProfiles(): TaskTemplateLotProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isMissingSchemaError(error: { code?: string; message?: string } | null) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return code === "42P01" || code === "42703" || message.includes("task_template_lot_profiles") || message.includes("schema cache");
}

export async function listTaskTemplateLotProfiles(): Promise<TaskTemplateLotProfile[]> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select(SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .overrideTypes<LotProfileRow[]>();

  if (error) {
    if (isMissingSchemaError(error)) return readCachedProfiles().length ? readCachedProfiles() : DEFAULT_LOT_PROFILES;
    const cached = readCachedProfiles();
    if (cached.length) return cached;
    throw new Error(error.message);
  }

  const profiles = (data ?? []).map(fromRow);
  cacheProfiles(profiles);
  return profiles.length ? profiles : DEFAULT_LOT_PROFILES;
}

function isMissingUsageColumnError(error: { code?: string; message?: string } | null) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    String(error?.code ?? "") === "42703" &&
    (message.includes("default_quote_visible") || message.includes("default_chantier_visible"))
  );
}

function upsertLotProfileRow(row: Record<string, unknown>) {
  return supabase
    .from(TABLE as any)
    .upsert(row, { onConflict: "id" })
    .select(SELECT)
    .single()
    .overrideTypes<LotProfileRow>();
}

export async function saveTaskTemplateLotProfile(input: TaskTemplateLotProfileInput): Promise<TaskTemplateLotProfile> {
  if (!input.name.trim()) throw new Error("Nom du lot obligatoire.");

  const row = toRow(input) as Record<string, unknown>;
  let result = await upsertLotProfileRow(row);

  // Tant que la migration 20260823170000 n'est pas appliquee, les colonnes
  // d'usage metier n'existent pas : on reessaie sans elles plutot que d'echouer.
  if (result.error && isMissingUsageColumnError(result.error)) {
    const rowWithoutUsage: Record<string, unknown> = { ...row };
    delete rowWithoutUsage.default_quote_visible;
    delete rowWithoutUsage.default_chantier_visible;
    result = await upsertLotProfileRow(rowWithoutUsage);
  }

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Enregistrement du lot sans retour de la base.");
  const saved = fromRow(result.data);
  const next = await listTaskTemplateLotProfiles();
  cacheProfiles(next);
  return saved;
}

export async function deleteTaskTemplateLotProfile(id: string): Promise<void> {
  if (!id || id.startsWith("default-")) return;
  const { error } = await supabase.from(TABLE as any).delete().eq("id", id);
  if (error) throw new Error(error.message);
  cacheProfiles(await listTaskTemplateLotProfiles());
}

/**
 * Correspondance exacte par nom, puis repli par mots-cles.
 * Le repli par mots-cles reprend `matchTaskTemplateLotProfile` du systeme
 * localStorage de main, afin qu'un lot saisi librement ("Peinture facade")
 * retrouve son profil ("Facade") sans saisie exacte.
 */
export function findLotProfileByName(
  profiles: TaskTemplateLotProfile[],
  value: string | null | undefined,
): TaskTemplateLotProfile | null {
  const normalized = normalizeLot(value);
  if (!normalized) return null;

  const exact = profiles.find((profile) => normalizeLot(profile.name) === normalized);
  if (exact) return exact;

  return (
    profiles.find((profile) =>
      profile.keywords.some((keyword) => {
        const normalizedKeyword = normalizeLot(keyword);
        return Boolean(normalizedKeyword) && normalized.includes(normalizedKeyword);
      }),
    ) ?? null
  );
}

export function normalizeLot(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
