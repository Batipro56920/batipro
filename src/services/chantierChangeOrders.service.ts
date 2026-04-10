import { supabase } from "../lib/supabaseClient";

export type ChantierChangeOrderStatus =
  | "a_analyser"
  | "a_chiffrer"
  | "en_attente_validation"
  | "valide"
  | "refuse"
  | "realise";

export type ChantierChangeOrderType =
  | "travaux_supplementaires"
  | "modification_client"
  | "imprevu_technique"
  | "temps_supplementaire"
  | "materiau_non_prevu";

export type ChantierChangeOrderRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  zone_id: string | null;
  devis_ligne_id: string | null;
  type_ecart: ChantierChangeOrderType;
  titre: string;
  description: string | null;
  impact_temps_h: number;
  impact_cout_ht: number;
  statut: ChantierChangeOrderStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierChangeOrderInput = {
  chantier_id: string;
  task_id?: string | null;
  zone_id?: string | null;
  devis_ligne_id?: string | null;
  type_ecart?: ChantierChangeOrderType;
  titre: string;
  description?: string | null;
  impact_temps_h?: number | string | null;
  impact_cout_ht?: number | string | null;
  statut?: ChantierChangeOrderStatus;
};

export type ChantierChangeOrderPatch = Partial<Omit<ChantierChangeOrderInput, "chantier_id">>;

const CHANGE_ORDER_SELECT = [
  "id",
  "chantier_id",
  "task_id",
  "zone_id",
  "devis_ligne_id",
  "type_ecart",
  "titre",
  "description",
  "impact_temps_h",
  "impact_cout_ht",
  "statut",
  "requested_by",
  "approved_by",
  "approved_at",
  "created_at",
  "updated_at",
].join(",");

function fromChangeOrders() {
  return (supabase as any).from("chantier_change_orders");
}

function isMissingChangeOrderSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return msg.includes("chantier_change_orders") && (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"));
}

function normalizeNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const raw = value.trim().replace(",", ".");
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return 0;
}

function normalizeChangeOrderType(value: unknown): ChantierChangeOrderType {
  const raw = String(value ?? "").trim();
  if (raw === "travaux_supplementaires") return "travaux_supplementaires";
  if (raw === "modification_client") return "modification_client";
  if (raw === "temps_supplementaire") return "temps_supplementaire";
  if (raw === "materiau_non_prevu") return "materiau_non_prevu";
  return "imprevu_technique";
}

function normalizeChangeOrderStatus(value: unknown): ChantierChangeOrderStatus {
  const raw = String(value ?? "").trim();
  if (raw === "a_chiffrer") return "a_chiffrer";
  if (raw === "en_attente_validation" || raw === "a_valider") return "en_attente_validation";
  if (raw === "valide") return "valide";
  if (raw === "refuse") return "refuse";
  if (raw === "realise" || raw === "integre") return "realise";
  return "a_analyser";
}

function normalizeChangeOrderRow(row: any): ChantierChangeOrderRow {
  return {
    id: String(row?.id ?? ""),
    chantier_id: String(row?.chantier_id ?? ""),
    task_id: row?.task_id ?? null,
    zone_id: row?.zone_id ?? null,
    devis_ligne_id: row?.devis_ligne_id ?? null,
    type_ecart: normalizeChangeOrderType(row?.type_ecart),
    titre: String(row?.titre ?? "Écart chantier").trim() || "Écart chantier",
    description: row?.description ?? null,
    impact_temps_h: normalizeNumber(row?.impact_temps_h),
    impact_cout_ht: normalizeNumber(row?.impact_cout_ht),
    statut: normalizeChangeOrderStatus(row?.statut),
    requested_by: row?.requested_by ?? null,
    approved_by: row?.approved_by ?? null,
    approved_at: row?.approved_at ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function cleanChangeOrderPayload(payload: ChantierChangeOrderInput | ChantierChangeOrderPatch) {
  const titre = typeof payload.titre === "string" ? payload.titre.trim() : payload.titre;
  const description = typeof payload.description === "string" ? payload.description.trim() || null : payload.description;

  if (Object.prototype.hasOwnProperty.call(payload, "titre") && !titre) {
    throw new Error("Titre d'écart obligatoire.");
  }

  return {
    ...payload,
    task_id: payload.task_id || null,
    zone_id: payload.zone_id || null,
    devis_ligne_id: payload.devis_ligne_id || null,
    type_ecart: payload.type_ecart ? normalizeChangeOrderType(payload.type_ecart) : undefined,
    titre,
    description,
    impact_temps_h: normalizeNumber(payload.impact_temps_h),
    impact_cout_ht: normalizeNumber(payload.impact_cout_ht),
    statut: payload.statut ? normalizeChangeOrderStatus(payload.statut) : undefined,
  };
}

export async function listChantierChangeOrders(
  chantierId: string,
): Promise<{ changeOrders: ChantierChangeOrderRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromChangeOrders()
    .select(CHANGE_ORDER_SELECT)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (!error) return { changeOrders: (data ?? []).map(normalizeChangeOrderRow), schemaReady: true };
  if (isMissingChangeOrderSchemaError(error)) return { changeOrders: [], schemaReady: false };
  throw error;
}

export async function createChantierChangeOrder(
  payload: ChantierChangeOrderInput,
): Promise<ChantierChangeOrderRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const { data, error } = await fromChangeOrders()
    .insert([cleanChangeOrderPayload(payload)])
    .select(CHANGE_ORDER_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingChangeOrderSchemaError(error)) throw new Error("Migration pilotage non appliquée sur Supabase.");
    throw error;
  }
  if (!data) throw new Error("Création écart OK mais ligne non retournée.");
  return normalizeChangeOrderRow(data);
}

export async function updateChantierChangeOrder(
  id: string,
  patch: ChantierChangeOrderPatch,
): Promise<ChantierChangeOrderRow> {
  if (!id) throw new Error("id écart manquant.");

  const { data, error } = await fromChangeOrders()
    .update(cleanChangeOrderPayload(patch))
    .eq("id", id)
    .select(CHANGE_ORDER_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingChangeOrderSchemaError(error)) throw new Error("Migration pilotage non appliquée sur Supabase.");
    throw error;
  }
  if (!data) throw new Error("Mise à jour écart OK mais ligne non retournée.");
  return normalizeChangeOrderRow(data);
}

export async function deleteChantierChangeOrder(id: string): Promise<void> {
  if (!id) throw new Error("id écart manquant.");
  const { error } = await fromChangeOrders().delete().eq("id", id);
  if (error) {
    if (isMissingChangeOrderSchemaError(error)) throw new Error("Migration pilotage non appliquée sur Supabase.");
    throw error;
  }
}
