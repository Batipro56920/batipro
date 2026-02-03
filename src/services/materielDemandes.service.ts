// src/services/materielDemandes.service.ts
import { supabase } from "./supabaseClient";

/**
 * Table attendue : public.materiel_demandes
 * Colonnes attendues :
 * - id (uuid)
 * - chantier_id (uuid)
 * - intervenant_id (uuid) NOT NULL
 * - designation (text) NOT NULL
 * - quantite (numeric/int) NOT NULL
 * - unite (text) NULL
 * - date_livraison (date) NULL
 * - remarques (text) NULL
 * - status (text) NOT NULL  -> A_COMMANDER | COMMANDE | LIVRE
 * - created_at (timestamptz)
 * - updated_at (timestamptz)
 */

export type MaterielStatus = "A_COMMANDER" | "COMMANDE" | "LIVRE";

export type MaterielDemandeRow = {
  id: string;
  chantier_id: string;
  intervenant_id: string;
  designation: string;
  quantite: number;
  unite: string | null;
  date_livraison: string | null; // "YYYY-MM-DD"
  remarques: string | null;
  status: MaterielStatus;
  created_at: string;
  updated_at: string;
};

const TABLE = "materiel_demandes";

function normalizeNumber(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const raw = String(input ?? "").trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

function assertRequired(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** LIST */
export async function listMaterielDemandesByChantierId(chantierId: string): Promise<MaterielDemandeRow[]> {
  assertRequired(Boolean(chantierId), "chantierId manquant.");

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MaterielDemandeRow[];
}

/** CREATE */
export async function createMaterielDemande(input: {
  chantier_id: string;
  intervenant_id: string; // obligatoire
  designation: string; // obligatoire
  quantite: number | string; // obligatoire
  unite?: string | null; // optionnel
  date_livraison?: string | null; // optionnel (YYYY-MM-DD)
  remarques?: string | null; // optionnel
  status?: MaterielStatus; // optionnel, défaut A_COMMANDER
}): Promise<MaterielDemandeRow> {
  assertRequired(Boolean(input?.chantier_id), "chantier_id obligatoire.");
  assertRequired(Boolean(input?.intervenant_id), "intervenant_id obligatoire.");
  assertRequired(Boolean(String(input?.designation ?? "").trim()), "designation obligatoire.");

  const q = normalizeNumber(input?.quantite);
  assertRequired(!Number.isNaN(q), "quantite invalide.");
  assertRequired(q > 0, "quantite doit être > 0.");

  const payload = {
    chantier_id: input.chantier_id,
    intervenant_id: input.intervenant_id,
    designation: String(input.designation).trim(),
    quantite: q,
    unite: input.unite ?? null,
    date_livraison: input.date_livraison ?? null,
    remarques: input.remarques ?? null,
    status: input.status ?? "A_COMMANDER",
  };

  const { data, error } = await supabase.from(TABLE).insert(payload).select("*").single();

  if (error) throw new Error(error.message);
  return data as MaterielDemandeRow;
}

/** UPDATE (patch) */
export async function updateMaterielDemande(
  id: string,
  patch: Partial<{
    intervenant_id: string;
    designation: string;
    quantite: number | string;
    unite: string | null;
    date_livraison: string | null;
    remarques: string | null;
    status: MaterielStatus;
  }>,
): Promise<MaterielDemandeRow> {
  assertRequired(Boolean(id), "id manquant.");

  const updatePayload: any = {};

  if (patch.intervenant_id !== undefined) {
    assertRequired(Boolean(patch.intervenant_id), "intervenant_id obligatoire.");
    updatePayload.intervenant_id = patch.intervenant_id;
  }

  if (patch.designation !== undefined) {
    const d = String(patch.designation ?? "").trim();
    assertRequired(Boolean(d), "designation obligatoire.");
    updatePayload.designation = d;
  }

  if (patch.quantite !== undefined) {
    const q = normalizeNumber(patch.quantite);
    assertRequired(!Number.isNaN(q), "quantite invalide.");
    assertRequired(q > 0, "quantite doit être > 0.");
    updatePayload.quantite = q;
  }

  if (patch.unite !== undefined) updatePayload.unite = patch.unite ?? null;
  if (patch.date_livraison !== undefined) updatePayload.date_livraison = patch.date_livraison ?? null;
  if (patch.remarques !== undefined) updatePayload.remarques = patch.remarques ?? null;
  if (patch.status !== undefined) updatePayload.status = patch.status;

  const { data, error } = await supabase.from(TABLE).update(updatePayload).eq("id", id).select("*").single();

  if (error) throw new Error(error.message);
  return data as MaterielDemandeRow;
}

/** DELETE */
export async function deleteMaterielDemande(id: string): Promise<void> {
  assertRequired(Boolean(id), "id manquant.");

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
