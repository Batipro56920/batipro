import { supabase } from "../lib/supabaseClient";

export type ChantierPreparationStatus = "chantier_incomplet" | "chantier_pret";

export type ChantierPreparationChecklistRow = {
  chantier_id: string;
  plans_disponibles: boolean;
  materiaux_commandes: boolean;
  materiel_prevu: boolean;
  intervenants_affectes: boolean;
  acces_chantier_valide: boolean;
  statut: ChantierPreparationStatus;
  commentaire: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierPreparationChecklistPatch = Partial<
  Pick<
    ChantierPreparationChecklistRow,
    | "plans_disponibles"
    | "materiaux_commandes"
    | "materiel_prevu"
    | "intervenants_affectes"
    | "acces_chantier_valide"
    | "commentaire"
  >
>;

const PREPARATION_SELECT = [
  "chantier_id",
  "plans_disponibles",
  "materiaux_commandes",
  "materiel_prevu",
  "intervenants_affectes",
  "acces_chantier_valide",
  "statut",
  "commentaire",
  "validated_by",
  "validated_at",
  "created_at",
  "updated_at",
].join(",");

function fromPreparationChecklists() {
  return (supabase as any).from("chantier_preparation_checklists");
}

function fallbackChecklist(chantierId: string): ChantierPreparationChecklistRow {
  return {
    chantier_id: chantierId,
    plans_disponibles: false,
    materiaux_commandes: false,
    materiel_prevu: false,
    intervenants_affectes: false,
    acces_chantier_valide: false,
    statut: "chantier_incomplet",
    commentaire: null,
    validated_by: null,
    validated_at: null,
    created_at: null,
    updated_at: null,
  };
}

function isMissingPreparationTableError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  if (!msg) return false;
  return (
    msg.includes("chantier_preparation_checklists") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function normalizeChecklist(row: any, chantierId: string): ChantierPreparationChecklistRow {
  return {
    chantier_id: row?.chantier_id ?? chantierId,
    plans_disponibles: Boolean(row?.plans_disponibles),
    materiaux_commandes: Boolean(row?.materiaux_commandes),
    materiel_prevu: Boolean(row?.materiel_prevu),
    intervenants_affectes: Boolean(row?.intervenants_affectes),
    acces_chantier_valide: Boolean(row?.acces_chantier_valide),
    statut: row?.statut === "chantier_pret" ? "chantier_pret" : "chantier_incomplet",
    commentaire: row?.commentaire ?? null,
    validated_by: row?.validated_by ?? null,
    validated_at: row?.validated_at ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function computeStatus(
  payload: ChantierPreparationChecklistPatch,
  current: ChantierPreparationChecklistRow,
): ChantierPreparationStatus {
  const merged = { ...current, ...payload };
  const ready =
    Boolean(merged.plans_disponibles) &&
    Boolean(merged.materiaux_commandes) &&
    Boolean(merged.materiel_prevu) &&
    Boolean(merged.intervenants_affectes) &&
    Boolean(merged.acces_chantier_valide);

  return ready ? "chantier_pret" : "chantier_incomplet";
}

export async function getChantierPreparationChecklist(
  chantierId: string,
): Promise<{ checklist: ChantierPreparationChecklistRow; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const result = await fromPreparationChecklists()
    .select(PREPARATION_SELECT)
    .eq("chantier_id", chantierId)
    .maybeSingle();

  if (!result.error) {
    return {
      checklist: result.data ? normalizeChecklist(result.data, chantierId) : fallbackChecklist(chantierId),
      schemaReady: true,
    };
  }

  if (isMissingPreparationTableError(result.error)) {
    return {
      checklist: fallbackChecklist(chantierId),
      schemaReady: false,
    };
  }

  throw result.error;
}

export async function upsertChantierPreparationChecklist(
  chantierId: string,
  patch: ChantierPreparationChecklistPatch,
): Promise<ChantierPreparationChecklistRow> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const current = await getChantierPreparationChecklist(chantierId);
  if (!current.schemaReady) {
    throw new Error("Migration préparation chantier non appliquée sur Supabase.");
  }

  const commentaire = typeof patch.commentaire === "string" ? patch.commentaire.trim() || null : current.checklist.commentaire;
  const nextStatus = computeStatus({ ...patch, commentaire }, current.checklist);

  const payload = {
    chantier_id: chantierId,
    plans_disponibles: patch.plans_disponibles ?? current.checklist.plans_disponibles,
    materiaux_commandes: patch.materiaux_commandes ?? current.checklist.materiaux_commandes,
    materiel_prevu: patch.materiel_prevu ?? current.checklist.materiel_prevu,
    intervenants_affectes: patch.intervenants_affectes ?? current.checklist.intervenants_affectes,
    acces_chantier_valide: patch.acces_chantier_valide ?? current.checklist.acces_chantier_valide,
    statut: nextStatus,
    commentaire,
    validated_at: nextStatus === "chantier_pret" ? new Date().toISOString() : null,
  };

  const { data, error } = await fromPreparationChecklists()
    .upsert(payload, { onConflict: "chantier_id" })
    .select(PREPARATION_SELECT)
    .maybeSingle();

  if (error) throw error;
  return normalizeChecklist(data ?? payload, chantierId);
}
