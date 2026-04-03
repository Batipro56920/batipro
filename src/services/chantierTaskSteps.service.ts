import { supabase } from "../lib/supabaseClient";

export type ChantierTaskStepStatus = "a_faire" | "en_cours" | "termine";

export type ChantierTaskStepRow = {
  id: string;
  chantier_id: string;
  task_id: string;
  titre: string;
  statut: ChantierTaskStepStatus;
  ordre: number;
  commentaire: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const TASK_STEP_SELECT = [
  "id",
  "chantier_id",
  "task_id",
  "titre",
  "statut",
  "ordre",
  "commentaire",
  "created_at",
  "updated_at",
].join(",");

function fromTaskSteps() {
  return (supabase as any).from("chantier_task_steps");
}

function isMissingTaskStepsSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return msg.includes("chantier_task_steps") && (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"));
}

function normalizeStepStatus(value: unknown): ChantierTaskStepStatus {
  const raw = String(value ?? "").trim();
  if (raw === "en_cours") return "en_cours";
  if (raw === "termine") return "termine";
  return "a_faire";
}

function normalizeStepRow(row: any): ChantierTaskStepRow {
  return {
    id: String(row?.id ?? ""),
    chantier_id: String(row?.chantier_id ?? ""),
    task_id: String(row?.task_id ?? ""),
    titre: String(row?.titre ?? "Étape").trim() || "Étape",
    statut: normalizeStepStatus(row?.statut),
    ordre: Number.isFinite(Number(row?.ordre)) ? Number(row.ordre) : 0,
    commentaire: row?.commentaire ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function listTaskStepsByChantierId(
  chantierId: string,
): Promise<{ steps: ChantierTaskStepRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromTaskSteps()
    .select(TASK_STEP_SELECT)
    .eq("chantier_id", chantierId)
    .order("task_id", { ascending: true })
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: true });

  if (!error) return { steps: (data ?? []).map(normalizeStepRow), schemaReady: true };
  if (isMissingTaskStepsSchemaError(error)) return { steps: [], schemaReady: false };
  throw error;
}

export async function createTaskStep(input: {
  chantier_id: string;
  task_id: string;
  titre: string;
  ordre?: number;
}): Promise<ChantierTaskStepRow> {
  const titre = String(input.titre ?? "").trim();
  if (!input.chantier_id || !input.task_id) throw new Error("chantier_id/task_id manquant.");
  if (!titre) throw new Error("Titre d'étape obligatoire.");

  const { data, error } = await fromTaskSteps()
    .insert([{
      chantier_id: input.chantier_id,
      task_id: input.task_id,
      titre,
      ordre: Number.isFinite(Number(input.ordre)) ? Number(input.ordre) : 0,
      statut: "a_faire",
      commentaire: null,
    }])
    .select(TASK_STEP_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingTaskStepsSchemaError(error)) throw new Error("Migration étapes de tâches non appliquée sur Supabase.");
    throw error;
  }
  if (!data) throw new Error("Création étape OK mais ligne non retournée.");
  return normalizeStepRow(data);
}

export async function updateTaskStep(
  id: string,
  patch: { titre?: string; statut?: ChantierTaskStepStatus; ordre?: number },
): Promise<ChantierTaskStepRow> {
  if (!id) throw new Error("id étape manquant.");
  const payload: Record<string, unknown> = {};
  if (patch.titre !== undefined) {
    const titre = String(patch.titre ?? "").trim();
    if (!titre) throw new Error("Titre d'étape obligatoire.");
    payload.titre = titre;
  }
  if (patch.statut !== undefined) payload.statut = normalizeStepStatus(patch.statut);
  if (patch.ordre !== undefined) payload.ordre = Number.isFinite(Number(patch.ordre)) ? Number(patch.ordre) : 0;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await fromTaskSteps()
    .update(payload)
    .eq("id", id)
    .select(TASK_STEP_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingTaskStepsSchemaError(error)) throw new Error("Migration étapes de tâches non appliquée sur Supabase.");
    throw error;
  }
  if (!data) throw new Error("Mise à jour étape OK mais ligne non retournée.");
  return normalizeStepRow(data);
}

export async function deleteTaskStep(id: string): Promise<void> {
  if (!id) throw new Error("id étape manquant.");
  const { error } = await fromTaskSteps().delete().eq("id", id);
  if (error) {
    if (isMissingTaskStepsSchemaError(error)) throw new Error("Migration étapes de tâches non appliquée sur Supabase.");
    throw error;
  }
}
