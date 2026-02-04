// src/services/chantiers.service.ts
import { supabase } from "../lib/supabaseClient";
import type { ChantierStatus } from "../types/chantier";
import { CHANTIER_EN_COURS_STATUSES } from "../lib/chantierRules";

/* =========================================================
   TYPES
   ========================================================= */

export type ChantierRow = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
  status: ChantierStatus;
  avancement: number | null;
  date_debut: string | null;

  // Champs optionnels (si présents dans ta DB)
  date_fin_prevue?: string | null;
  heures_prevues: number | null;
  heures_passees: number | null;

  created_at?: string | null;
};

export const CHANTIER_SELECT =
  "id, nom, client, adresse, status, avancement, date_debut, date_fin_prevue, heures_prevues, heures_passees, created_at" as const;

export type ChantierScope = "all" | "en_cours";

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeChantier(row: any): ChantierRow {
  return {
    id: row.id,
    nom: row.nom,
    client: row.client ?? null,
    adresse: row.adresse ?? null,
    status: (row.status ?? "PREPARATION") as ChantierStatus,
    avancement: row.avancement ?? 0,
    date_debut: row.date_debut ?? null,
    date_fin_prevue: row.date_fin_prevue ?? null,
    heures_prevues: row.heures_prevues ?? 0,
    heures_passees: row.heures_passees ?? 0,
    created_at: row.created_at ?? null,
  };
}

function applyChantiersScope(query: any, scope: ChantierScope) {
  if (scope === "en_cours") {
    return query.in("status", [...CHANTIER_EN_COURS_STATUSES]);
  }
  return query;
}

/* =========================================================
   CRUD
   ========================================================= */

export async function listChantiers(params: { scope?: ChantierScope } = {}): Promise<ChantierRow[]> {
  const scope = params.scope ?? "all";

  const query = supabase
    .from("chantiers")
    .select(CHANTIER_SELECT)
    .order("created_at", { ascending: false });

  const { data, error } = await applyChantiersScope(query, scope);

  if (error) throw error;
  return (data ?? []).map(normalizeChantier);
}

export async function countChantiers(params: { scope?: ChantierScope } = {}): Promise<number> {
  const scope = params.scope ?? "all";

  const query = supabase.from("chantiers").select("id", { count: "exact", head: true });
  const { count, error } = await applyChantiersScope(query, scope);

  if (error) throw error;
  return count ?? 0;
}

export async function getChantiers(): Promise<ChantierRow[]> {
  return listChantiers({ scope: "all" });
}

export async function getChantierById(id: string): Promise<ChantierRow> {
  if (!id) throw new Error("id manquant.");

  // ✅ important : maybeSingle() évite le 406 "Cannot coerce the result to a single JSON object"
  const { data, error } = await supabase
    .from("chantiers")
    .select(CHANTIER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Chantier introuvable.");

  return normalizeChantier(data);
}

export async function createChantier(payload: {
  nom: string;
  client?: string | null;
  adresse?: string | null;
  status?: ChantierStatus;
  date_debut?: string | null;
  date_fin_prevue?: string | null;
  heures_prevues?: number | null;
}): Promise<ChantierRow> {
  const nom = (payload?.nom ?? "").trim();
  if (!nom) throw new Error("Le nom du chantier est obligatoire.");

  const insertRow: Record<string, any> = {
    nom,
    client: payload.client ?? null,
    adresse: payload.adresse ?? null,
    status: payload.status ?? "PREPARATION",
    date_debut: payload.date_debut ?? null,
    date_fin_prevue: payload.date_fin_prevue ?? null,
    heures_prevues: payload.heures_prevues ?? 0,
    heures_passees: 0,
    avancement: 0,
  };

  const { data, error } = await supabase
    .from("chantiers")
    .insert([insertRow])
    .select(CHANTIER_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Création chantier OK mais non retourné.");

  return normalizeChantier(data);
}

export async function updateChantier(
  id: string,
  patch: Partial<Omit<ChantierRow, "id" | "created_at">>
): Promise<ChantierRow> {
  if (!id) throw new Error("id manquant.");

  const { data, error } = await supabase
    .from("chantiers")
    .update(patch)
    .eq("id", id)
    .select(CHANTIER_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Mise à jour OK mais chantier non retourné.");

  return normalizeChantier(data);
}

export async function deleteChantier(id: string): Promise<void> {
  if (!id) throw new Error("id manquant.");

  const { error } = await supabase.from("chantiers").delete().eq("id", id);
  if (error) throw error;
}
