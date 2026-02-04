// src/services/chantierTasks.service.ts
import { supabase } from "../lib/supabaseClient";

/* =========================================================
   TYPES
   ========================================================= */

export type TaskStatus = "A_FAIRE" | "EN_COURS" | "FAIT";

export type ChantierTaskRow = {
  id: string;
  chantier_id: string;

  titre: string;
  corps_etat: string | null;
  date: string | null; // date prévue (ancienne logique)
  status: TaskStatus;

  intervenant_id: string | null;

  quantite: number | null;
  unite: string | null;
  temps_prevu_h: number | null;

  // ✅ TEMPS V1 (optionnel)
  date_debut: string | null; // YYYY-MM-DD
  date_fin: string | null; // YYYY-MM-DD
  temps_reel_h: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type CreateTaskPayload = {
  chantier_id: string;
  titre: string;
  corps_etat?: string | null;
  date?: string | null;
  status?: TaskStatus;
  intervenant_id?: string | null;

  quantite?: number | string | null;
  unite?: string | null;
  temps_prevu_h?: number | string | null;

  // ✅ TEMPS V1 (optionnel)
  date_debut?: string | null;
  date_fin?: string | null;
  temps_reel_h?: number | null;
};

type UpdateTaskPatch = Partial<
  Pick<
    ChantierTaskRow,
    | "titre"
    | "corps_etat"
    | "date"
    | "status"
    | "intervenant_id"
    | "quantite"
    | "unite"
    | "temps_prevu_h"
    | "date_debut"
    | "date_fin"
    | "temps_reel_h"
  >
>;

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
  if (typeof cleaned.corps_etat === "string") cleaned.corps_etat = cleaned.corps_etat.trim();
  if (typeof cleaned.unite === "string") cleaned.unite = cleaned.unite.trim();

  // vides -> null
  if (cleaned.corps_etat === "") cleaned.corps_etat = null;
  if (cleaned.date === "") cleaned.date = null;
  if (cleaned.date_debut === "") cleaned.date_debut = null;
  if (cleaned.date_fin === "") cleaned.date_fin = null;
  if (cleaned.intervenant_id === "") cleaned.intervenant_id = null;
  if (cleaned.unite === "") cleaned.unite = null;

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

  // aucune obligation demandée par toi,
  // mais on garde une petite sécurité: si titre fourni, il ne doit pas être vide
  if (cleaned.titre !== undefined && !cleaned.titre) {
    throw new Error("Le titre ne peut pas être vide.");
  }

  return cleaned as UpdateTaskPatch;
}

/* =========================================================
   QUERIES
   ========================================================= */

export async function getTasksByChantierId(chantierId: string) {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("chantier_tasks")
    .select(
      [
        "id",
        "chantier_id",
        "titre",
        "corps_etat",
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
      ].join(","),
    )
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ChantierTaskRow[];
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
    corps_etat: payload.corps_etat ?? null,
    date: payload.date ?? null,
    status: payload.status ?? "A_FAIRE",
    intervenant_id: payload.intervenant_id ?? null,
    quantite: quantiteValue === null ? 1 : quantiteValue,
    unite: (payload.unite ?? "").trim() || null,
    temps_prevu_h: tempsPrevuValue ?? null,

    // ✅ temps (optionnel)
    date_debut: payload.date_debut ?? null,
    date_fin: payload.date_fin ?? null,
    temps_reel_h: payload.temps_reel_h ?? null,
  };

  const { data, error } = await supabase
    .from("chantier_tasks")
    .insert([insertRow])
    .select(
      [
        "id",
        "chantier_id",
        "titre",
        "corps_etat",
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
      ].join(","),
    )
    .single();

  if (error) throw error;
  return data as unknown as ChantierTaskRow;
}

export async function updateTask(id: string, patch: UpdateTaskPatch) {
  if (!id) throw new Error("id tâche manquant.");

  const cleaned = cleanPatch(patch);

  const { data, error } = await supabase
    .from("chantier_tasks")
    .update(cleaned as any)
    .eq("id", id)
    .select(
      [
        "id",
        "chantier_id",
        "titre",
        "corps_etat",
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
      ].join(","),
    )
    .single();

  if (error) throw error;
  return data as unknown as ChantierTaskRow;
}
