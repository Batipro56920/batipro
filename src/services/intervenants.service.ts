// src/services/intervenants.service.ts
import { supabase } from "../lib/supabaseClient";

/* =========================================================
   TYPES
   ========================================================= */

export type IntervenantRow = {
  id: string;
  chantier_id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at?: string | null;
};

/* =========================================================
   QUERIES
   ========================================================= */

export async function listIntervenantsByChantierId(chantierId: string) {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("intervenants")
    .select("id, chantier_id, nom, email, telephone, created_at")
    .eq("chantier_id", chantierId)
    .order("nom", { ascending: true });

  if (error) throw error;
  return (data ?? []) as IntervenantRow[];
}

export async function createIntervenant(payload: {
  chantier_id: string;
  nom: string;
  email?: string | null;
  telephone?: string | null;
}) {
  const chantier_id = payload?.chantier_id;
  const nom = (payload?.nom ?? "").trim();

  if (!chantier_id) throw new Error("chantier_id manquant.");
  if (!nom) throw new Error("nom intervenant manquant.");

  const { data, error } = await supabase
    .from("intervenants")
    .insert([
      {
        chantier_id,
        nom,
        email: payload.email ?? null,
        telephone: payload.telephone ?? null,
      },
    ])
    .select("id, chantier_id, nom, email, telephone, created_at")
    .single();

  if (error) throw error;
  return data as IntervenantRow;
}

export async function updateIntervenant(
  id: string,
  patch: Partial<Pick<IntervenantRow, "nom" | "email" | "telephone">>,
) {
  if (!id) throw new Error("id intervenant manquant.");

  const cleaned: any = { ...patch };
  if (typeof cleaned.nom === "string") cleaned.nom = cleaned.nom.trim();
  if (cleaned.email === "") cleaned.email = null;
  if (cleaned.telephone === "") cleaned.telephone = null;

  if (cleaned.nom !== undefined && !cleaned.nom) {
    throw new Error("Le nom de l’intervenant est obligatoire.");
  }

  const { data, error } = await supabase
    .from("intervenants")
    .update(cleaned)
    .eq("id", id)
    .select("id, chantier_id, nom, email, telephone, created_at")
    .single();

  if (error) throw error;
  return data as IntervenantRow;
}

export async function deleteIntervenant(id: string) {
  if (!id) throw new Error("id intervenant manquant.");
  const { error } = await supabase.from("intervenants").delete().eq("id", id);
  if (error) throw error;
}
