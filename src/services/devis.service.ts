// src/services/devis.service.ts
import { supabase } from "../lib/supabaseClient";

/* =========================================================
   TYPES
   ========================================================= */

export type DevisRow = {
  id: string;
  chantier_id: string;
  nom: string;
  created_at?: string | null;
};

export type DevisLigneRow = {
  id: string;
  devis_id: string;
  ordre: number | null;
  corps_etat: string | null;

  // ✅ NOUVEAU
  entreprise: string | null;

  designation: string;
  unite: string | null;
  quantite: number | null;
  prix_unitaire_ht: number | null;
  tva_rate: number | null;
  generer_tache: boolean | null;
  titre_tache: string | null;
  date_prevue: string | null;
  created_at?: string | null;
};

const DEVIS_SELECT = "id, chantier_id, nom, created_at" as const;

const DEVIS_LIGNES_SELECT =
  "id, devis_id, ordre, corps_etat, entreprise, designation, unite, quantite, prix_unitaire_ht, tva_rate, generer_tache, titre_tache, date_prevue, created_at" as const;

/* =========================================================
   DEVIS
   ========================================================= */

export async function listDevisByChantier(chantierId: string): Promise<DevisRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("devis")
    .select(DEVIS_SELECT)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DevisRow[];
}

export async function createDevis(payload: { chantier_id: string; nom: string }): Promise<DevisRow> {
  const chantier_id = payload?.chantier_id;
  const nom = (payload?.nom ?? "").trim();

  if (!chantier_id) throw new Error("chantier_id manquant.");
  if (!nom) throw new Error("nom du devis manquant.");

  const { data, error } = await supabase
    .from("devis")
    .insert([{ chantier_id, nom }])
    .select(DEVIS_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Création devis OK mais non retourné.");

  return data as DevisRow;
}

export async function deleteDevis(devisId: string): Promise<void> {
  if (!devisId) throw new Error("devisId manquant.");
  const { error } = await supabase.from("devis").delete().eq("id", devisId);
  if (error) throw error;
}

/* =========================================================
   LIGNES DE DEVIS
   ========================================================= */

export async function listDevisLignes(devisId: string): Promise<DevisLigneRow[]> {
  if (!devisId) throw new Error("devisId manquant.");

  const { data, error } = await supabase
    .from("devis_lignes")
    .select(DEVIS_LIGNES_SELECT)
    .eq("devis_id", devisId)
    .order("ordre", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DevisLigneRow[];
}

export async function createDevisLigne(payload: {
  devis_id: string;
  ordre?: number | null;
  corps_etat?: string | null;
  entreprise?: string | null;
  designation: string;
  unite?: string | null;
  quantite?: number | null;
  prix_unitaire_ht?: number | null;
  tva_rate?: number | null;
  generer_tache?: boolean | null;
  titre_tache?: string | null;
  date_prevue?: string | null;
}): Promise<DevisLigneRow> {
  const devis_id = payload?.devis_id;
  const designation = (payload?.designation ?? "").trim();

  if (!devis_id) throw new Error("devis_id manquant.");
  if (!designation) throw new Error("designation manquante.");

  const insertRow = {
    devis_id,
    ordre: payload.ordre ?? null,
    corps_etat: payload.corps_etat ?? null,
    entreprise: payload.entreprise ?? null,
    designation,
    unite: payload.unite ?? null,
    quantite: payload.quantite ?? null,
    prix_unitaire_ht: payload.prix_unitaire_ht ?? null,
    tva_rate: payload.tva_rate ?? null,
    generer_tache: payload.generer_tache ?? true,
    titre_tache: payload.titre_tache ?? null,
    date_prevue: payload.date_prevue ?? null,
  };

  const { data, error } = await supabase
    .from("devis_lignes")
    .insert([insertRow])
    .select(DEVIS_LIGNES_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Ajout ligne OK mais non retournée.");

  return data as DevisLigneRow;
}

export async function updateDevisLigne(
  id: string,
  patch: Partial<Omit<DevisLigneRow, "id" | "created_at">>,
): Promise<DevisLigneRow> {
  if (!id) throw new Error("id ligne manquant.");

  const { data, error } = await supabase
    .from("devis_lignes")
    .update(patch)
    .eq("id", id)
    .select(DEVIS_LIGNES_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Mise à jour OK mais ligne non retournée.");

  return data as DevisLigneRow;
}

export async function deleteDevisLigne(id: string): Promise<void> {
  if (!id) throw new Error("id ligne manquant.");
  const { error } = await supabase.from("devis_lignes").delete().eq("id", id);
  if (error) throw error;
}

/* =========================================================
   ALIAS compat avec ChantierPage.tsx
   ========================================================= */

export const listDevisByChantierId = listDevisByChantier;

/* =========================================================
   EXPORTS EXPLICITES (anti-bug Vite / import)
   ========================================================= */
export {
  // Devis
  listDevisByChantier as _listDevisByChantier,
  createDevis as _createDevis,
  deleteDevis as _deleteDevis,

  // Lignes
  listDevisLignes as _listDevisLignes,
  createDevisLigne as _createDevisLigne,
  updateDevisLigne as _updateDevisLigne,
  deleteDevisLigne as _deleteDevisLigne,
};
