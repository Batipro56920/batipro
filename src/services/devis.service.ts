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

  // ? NOUVEAU
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
const DEVIS_LIGNES_SELECT_LEGACY =
  "id, devis_id, ordre, corps_etat, designation, unite, quantite, prix_unitaire_ht, tva_rate, generer_tache, titre_tache, date_prevue, created_at" as const;
let devisLignesSupportsEntrepriseColumn: boolean | null = null;

function isMissingColumnError(error: { message?: string } | null, table: string, column: string): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  const hasColumn = msg.includes(column.toLowerCase());
  const hasTable =
    msg.includes(table.toLowerCase()) ||
    msg.includes(`relation "${table.toLowerCase()}"`) ||
    msg.includes(`table "${table.toLowerCase()}"`);
  const isSchemaCache = msg.includes("schema cache");
  const isUnknownColumn = msg.includes("could not find") || msg.includes("does not exist");
  const isColumnError = msg.includes("column");

  return hasColumn && (isSchemaCache || (isColumnError && isUnknownColumn)) && (hasTable || isSchemaCache);
}

function mapLegacyLigne(row: any): DevisLigneRow {
  return {
    ...row,
    entreprise: row?.entreprise ?? null,
  } as DevisLigneRow;
}

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

function generateDevisNumero(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `DV-${y}${m}${d}-${hh}${mm}${ss}-${suffix}`;
}

function isUnknownColumnError(error: { message?: string } | null, column: string): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  const hasColumn = msg.includes(column.toLowerCase());
  const isSchemaCache = msg.includes("could not find");
  const isSqlUnknownColumn = msg.includes("column") && msg.includes("does not exist");
  return hasColumn && (isSchemaCache || isSqlUnknownColumn);
}

export async function createDevis(payload: {
  chantier_id: string;
  nom: string;
  numero?: string | null;
  titre?: string | null;
}): Promise<DevisRow> {
  const chantier_id = payload?.chantier_id;
  const nom = (payload?.nom ?? "").trim();
  const numero = (payload?.numero ?? "").trim() || generateDevisNumero();
  const titre = (payload?.titre ?? "").trim() || nom;

  if (!chantier_id) throw new Error("chantier_id manquant.");
  if (!nom) throw new Error("nom du devis manquant.");

  const insertModern = { chantier_id, nom, numero, titre };
  const { data, error } = await supabase
    .from("devis")
    .insert([insertModern as any])
    .select(DEVIS_SELECT)
    .maybeSingle();

  if (error) {
    // Compat schéma ancien sans numero/titre.
    if (isUnknownColumnError(error, "numero") || isUnknownColumnError(error, "titre")) {
      const legacy = await supabase
        .from("devis")
        .insert([{ chantier_id, nom }])
        .select(DEVIS_SELECT)
        .maybeSingle();

      if (legacy.error) throw legacy.error;
      if (!legacy.data) throw new Error("Création devis OK mais non retourné.");
      return legacy.data as DevisRow;
    }
    throw error;
  }
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

  if (devisLignesSupportsEntrepriseColumn === false) {
    const legacyOnly = await supabase
      .from("devis_lignes")
      .select(DEVIS_LIGNES_SELECT_LEGACY)
      .eq("devis_id", devisId)
      .order("ordre", { ascending: true });
    if (legacyOnly.error) throw legacyOnly.error;
    return (legacyOnly.data ?? []).map(mapLegacyLigne);
  }

  const first = await supabase
    .from("devis_lignes")
    .select(DEVIS_LIGNES_SELECT)
    .eq("devis_id", devisId)
    .order("ordre", { ascending: true });

  if (!first.error) {
    devisLignesSupportsEntrepriseColumn = true;
    return (first.data ?? []) as DevisLigneRow[];
  }

  if (!isMissingColumnError(first.error, "devis_lignes", "entreprise")) {
    throw first.error;
  }
  devisLignesSupportsEntrepriseColumn = false;

  const legacy = await supabase
    .from("devis_lignes")
    .select(DEVIS_LIGNES_SELECT_LEGACY)
    .eq("devis_id", devisId)
    .order("ordre", { ascending: true });

  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []).map(mapLegacyLigne);
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

  if (devisLignesSupportsEntrepriseColumn === false) {
    const legacyInsertRow = {
      devis_id,
      ordre: payload.ordre ?? null,
      corps_etat: payload.corps_etat ?? null,
      designation,
      unite: payload.unite ?? null,
      quantite: payload.quantite ?? null,
      prix_unitaire_ht: payload.prix_unitaire_ht ?? null,
      tva_rate: payload.tva_rate ?? null,
      generer_tache: payload.generer_tache ?? true,
      titre_tache: payload.titre_tache ?? null,
      date_prevue: payload.date_prevue ?? null,
    };

    const legacy = await supabase
      .from("devis_lignes")
      .insert([legacyInsertRow])
      .select(DEVIS_LIGNES_SELECT_LEGACY)
      .maybeSingle();

    if (legacy.error) throw legacy.error;
    if (!legacy.data) throw new Error("Ajout ligne OK mais non retournée.");
    return mapLegacyLigne(legacy.data);
  }

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

  const first = await supabase
    .from("devis_lignes")
    .insert([insertRow])
    .select(DEVIS_LIGNES_SELECT)
    .maybeSingle();

  if (!first.error) {
    devisLignesSupportsEntrepriseColumn = true;
    if (!first.data) throw new Error("Ajout ligne OK mais non retournée.");
    return first.data as DevisLigneRow;
  }

  if (!isMissingColumnError(first.error, "devis_lignes", "entreprise")) {
    throw first.error;
  }
  devisLignesSupportsEntrepriseColumn = false;

  const legacyInsertRow = {
    ...insertRow,
  } as any;
  delete legacyInsertRow.entreprise;

  const legacy = await supabase
    .from("devis_lignes")
    .insert([legacyInsertRow])
    .select(DEVIS_LIGNES_SELECT_LEGACY)
    .maybeSingle();

  if (legacy.error) throw legacy.error;
  if (!legacy.data) throw new Error("Ajout ligne OK mais non retournée.");

  return mapLegacyLigne(legacy.data);
}

export async function updateDevisLigne(
  id: string,
  patch: Partial<Omit<DevisLigneRow, "id" | "created_at">>,
): Promise<DevisLigneRow> {
  if (!id) throw new Error("id ligne manquant.");

  if (devisLignesSupportsEntrepriseColumn === false) {
    const legacyPatch = { ...(patch as any) };
    delete legacyPatch.entreprise;

    const legacy = await supabase
      .from("devis_lignes")
      .update(legacyPatch)
      .eq("id", id)
      .select(DEVIS_LIGNES_SELECT_LEGACY)
      .maybeSingle();

    if (legacy.error) throw legacy.error;
    if (!legacy.data) throw new Error("Mise à jour OK mais ligne non retournée.");
    return mapLegacyLigne(legacy.data);
  }

  const first = await supabase
    .from("devis_lignes")
    .update(patch)
    .eq("id", id)
    .select(DEVIS_LIGNES_SELECT)
    .maybeSingle();

  if (!first.error) {
    devisLignesSupportsEntrepriseColumn = true;
    if (!first.data) throw new Error("Mise à jour OK mais ligne non retournée.");
    return first.data as DevisLigneRow;
  }

  if (!isMissingColumnError(first.error, "devis_lignes", "entreprise")) {
    throw first.error;
  }
  devisLignesSupportsEntrepriseColumn = false;

  const legacyPatch = { ...(patch as any) };
  delete legacyPatch.entreprise;

  const legacy = await supabase
    .from("devis_lignes")
    .update(legacyPatch)
    .eq("id", id)
    .select(DEVIS_LIGNES_SELECT_LEGACY)
    .maybeSingle();

  if (legacy.error) throw legacy.error;
  if (!legacy.data) throw new Error("Mise à jour OK mais ligne non retournée.");

  return mapLegacyLigne(legacy.data);
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



